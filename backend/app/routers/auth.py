"""
Authentication Router

This module handles all authentication-related endpoints:
- Driver registration
- Driver login (JWT token generation)
- Token validation
- Password changes

Security is critical here - we hash all passwords and never store plain text.
"""

from fastapi import APIRouter, Depends, HTTPException, status
from fastapi.security import OAuth2PasswordBearer, OAuth2PasswordRequestForm
from motor.motor_asyncio import AsyncIOMotorDatabase
from datetime import datetime
import logging

from app.models.driver import (
    DriverCreate,
    DriverResponse,
    DriverLogin,
    Token,
    DriverInDB
)
from app.services.database import get_database
from app.utils.security import (
    hash_password,
    verify_password,
    create_access_token,
    decode_access_token,
    generate_driver_id
)

logger = logging.getLogger(__name__)

# Create router
router = APIRouter(prefix="/auth", tags=["Authentication"])

# OAuth2 scheme for JWT token authentication
# tokenUrl="auth/login" tells FastAPI where clients should POST credentials
oauth2_scheme = OAuth2PasswordBearer(tokenUrl="auth/login")


@router.post("/register", response_model=DriverResponse, status_code=status.HTTP_201_CREATED)
async def register_driver(
    driver: DriverCreate,
    db: AsyncIOMotorDatabase = Depends(get_database)
):
    """
    Register a New Driver
    
    Creates a new driver account with hashed password.
    
    Process:
    1. Check if email already exists
    2. Hash the password (NEVER store plain text)
    3. Generate unique driver_id
    4. Save to database
    5. Return driver info (without password)
    
    Args:
        driver: Driver registration data
        db: Database connection
        
    Returns:
        DriverResponse: Created driver information
        
    Raises:
        HTTPException 400: If email already registered
    """
    
    logger.info(f"Registration attempt for email: {driver.email}")
    
    # Step 1: Check if email already exists
    existing_driver = await db.drivers.find_one({"email": driver.email})
    if existing_driver:
        logger.warning(f"Registration failed: Email {driver.email} already exists")
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Email already registered. Please login or use a different email."
        )
    
    # Step 2: Hash the password
    # CRITICAL: Never store passwords in plain text!
    hashed_password = hash_password(driver.password)
    
    # Step 3: Generate unique driver ID
    driver_id = generate_driver_id()
    
    # Step 4: Create driver document for database
    driver_dict = driver.dict(exclude={"password"})  # Exclude plain password
    driver_dict.update({
        "driver_id": driver_id,
        "hashed_password": hashed_password,
        "created_at": datetime.utcnow(),
        "updated_at": datetime.utcnow(),
        "is_active": True,
        "is_verified": False,  # Require manual verification
        "total_deliveries": 0,
        "rating": None
    })
    
    # Step 5: Insert into database
    result = await db.drivers.insert_one(driver_dict)
    
    if not result.inserted_id:
        logger.error("Failed to insert driver into database")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Registration failed. Please try again."
        )
    
    logger.info(f"✓ Driver registered successfully: {driver_id}")
    
    # Step 6: Return driver info (without password)
    driver_dict.pop("hashed_password")  # Remove password hash from response
    return DriverResponse(**driver_dict)


@router.post("/login", response_model=Token)
async def login_driver(
    form_data: OAuth2PasswordRequestForm = Depends(),
    db: AsyncIOMotorDatabase = Depends(get_database)
):
    """
    Driver Login
    
    Authenticates a driver and returns a JWT access token.
    
    Process:
    1. Find driver by email (username in OAuth2 form)
    2. Verify password
    3. Check if account is active
    4. Generate JWT token
    5. Update last_login timestamp
    6. Return token
    
    Args:
        form_data: OAuth2 form with username (email) and password
        db: Database connection
        
    Returns:
        Token: JWT access token and driver_id
        
    Raises:
        HTTPException 401: If credentials are invalid or account is inactive
    """
    
    logger.info(f"Login attempt for email: {form_data.username}")
    
    # Step 1: Find driver by email
    driver = await db.drivers.find_one({"email": form_data.username})
    
    if not driver:
        logger.warning(f"Login failed: Email {form_data.username} not found")
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid email or password",
            headers={"WWW-Authenticate": "Bearer"},
        )
    
    # Step 2: Verify password
    if not verify_password(form_data.password, driver["hashed_password"]):
        logger.warning(f"Login failed: Invalid password for {form_data.username}")
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid email or password",
            headers={"WWW-Authenticate": "Bearer"},
        )
    
    # Step 3: Check if account is active
    if not driver.get("is_active", False):
        logger.warning(f"Login failed: Account {form_data.username} is inactive")
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Account is inactive. Please contact support.",
            headers={"WWW-Authenticate": "Bearer"},
        )
    
    # Step 4: Generate JWT token
    # The token contains the driver's email and driver_id
    token_data = {
        "sub": driver["email"],  # "sub" is standard JWT claim for subject
        "driver_id": driver["driver_id"]
    }
    access_token = create_access_token(data=token_data)
    
    # Step 5: Update last login timestamp
    await db.drivers.update_one(
        {"email": driver["email"]},
        {"$set": {"last_login": datetime.utcnow()}}
    )
    
    logger.info(f"✓ Login successful for driver: {driver['driver_id']}")
    
    # Step 6: Return token
    return Token(
        access_token=access_token,
        token_type="bearer",
        driver_id=driver["driver_id"]
    )


async def get_current_driver(
    token: str = Depends(oauth2_scheme),
    db: AsyncIOMotorDatabase = Depends(get_database)
) -> DriverInDB:
    """
    Get Current Authenticated Driver
    
    This is a dependency function that validates the JWT token
    and returns the authenticated driver.
    
    Use this in protected routes like:
    @router.get("/protected")
    async def protected_route(
        current_driver: DriverInDB = Depends(get_current_driver)
    ):
        return {"message": f"Hello {current_driver.full_name}"}
    
    Args:
        token: JWT token from Authorization header
        db: Database connection
        
    Returns:
        DriverInDB: The authenticated driver
        
    Raises:
        HTTPException 401: If token is invalid or driver not found
    """
    
    credentials_exception = HTTPException(
        status_code=status.HTTP_401_UNAUTHORIZED,
        detail="Could not validate credentials",
        headers={"WWW-Authenticate": "Bearer"},
    )
    
    # Step 1: Decode and validate token
    token_data = decode_access_token(token)
    if token_data is None or token_data.email is None:
        logger.warning("Invalid token received")
        raise credentials_exception
    
    # Step 2: Find driver in database
    driver = await db.drivers.find_one({"email": token_data.email})
    if driver is None:
        logger.warning(f"Token valid but driver {token_data.email} not found")
        raise credentials_exception
    
    # Step 3: Check if account is still active
    if not driver.get("is_active", False):
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Account is inactive",
        )
    
    # Step 4: Convert MongoDB ObjectId to string
    if "_id" in driver:
        driver["_id"] = str(driver["_id"])
    
    # Step 5: Return driver object
    return DriverInDB(**driver)


@router.get("/me", response_model=DriverResponse)
async def get_current_driver_info(
    current_driver: DriverInDB = Depends(get_current_driver)
):
    """
    Get Current Driver Information
    
    Returns the authenticated driver's profile information.
    Useful for displaying user info in the frontend.
    
    Args:
        current_driver: The authenticated driver (from JWT token)
        
    Returns:
        DriverResponse: Driver profile information
    """
    
    # Convert to response model (excludes hashed_password)
    return DriverResponse(**current_driver.dict(exclude={"hashed_password"}))


@router.post("/logout")
async def logout_driver(
    current_driver: DriverInDB = Depends(get_current_driver)
):
    """
    Driver Logout
    
    JWT tokens are stateless, so we can't truly "invalidate" them server-side
    without maintaining a blacklist. Instead, the client should delete the token.
    
    This endpoint is mainly for logging purposes and future token blacklist
    implementation if needed.
    
    Args:
        current_driver: The authenticated driver
        
    Returns:
        dict: Success message
    """
    
    logger.info(f"Driver {current_driver.driver_id} logged out")
    
    return {
        "message": "Logged out successfully. Please delete your access token."
    }


@router.put("/profile")
async def update_profile(
    profile_data: dict,
    db: AsyncIOMotorDatabase = Depends(get_database),
    current_driver: DriverInDB = Depends(get_current_driver)
):
    """
    Update Driver Profile
    
    Updates the driver's profile information.
    
    Args:
        profile_data: Profile fields to update
        db: Database connection
        current_driver: The authenticated driver
        
    Returns:
        dict: Updated profile information
    """
    
    logger.info(f"Profile update request from driver: {current_driver.driver_id}")
    
    # Allowed fields to update
    allowed_fields = ["full_name", "phone", "vehicle_type", "license_plate", "max_capacity"]
    
    # Filter to only allowed fields
    update_data = {k: v for k, v in profile_data.items() if k in allowed_fields and v is not None}
    
    if not update_data:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="No valid fields to update"
        )
    
    # Add updated_at timestamp
    update_data["updated_at"] = datetime.utcnow()
    
    # Update in database
    result = await db.drivers.update_one(
        {"driver_id": current_driver.driver_id},
        {"$set": update_data}
    )
    
    if result.modified_count == 0:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="No changes made"
        )
    
    logger.info(f"Profile updated for driver: {current_driver.driver_id}")
    
    return {
        "message": "Profile updated successfully",
        "updated_fields": list(update_data.keys())
    }


@router.put("/password")
async def change_password(
    password_data: dict,
    db: AsyncIOMotorDatabase = Depends(get_database),
    current_driver: DriverInDB = Depends(get_current_driver)
):
    """
    Change Driver Password
    
    Changes the driver's password after verifying the current password.
    
    Args:
        password_data: Contains current_password and new_password
        db: Database connection
        current_driver: The authenticated driver
        
    Returns:
        dict: Success message
    """
    
    logger.info(f"Password change request from driver: {current_driver.driver_id}")
    
    # Validate required fields
    current_password = password_data.get("current_password")
    new_password = password_data.get("new_password")
    
    if not current_password or not new_password:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Current password and new password are required"
        )
    
    # Get driver from database to verify current password
    driver = await db.drivers.find_one({"driver_id": current_driver.driver_id})
    
    if not driver:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Driver not found"
        )
    
    # Verify current password
    if not verify_password(current_password, driver["hashed_password"]):
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Current password is incorrect"
        )
    
    # Validate new password
    if len(new_password) < 8:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="New password must be at least 8 characters"
        )
    
    # Hash new password
    new_hashed_password = hash_password(new_password)
    
    # Update in database
    result = await db.drivers.update_one(
        {"driver_id": current_driver.driver_id},
        {"$set": {
            "hashed_password": new_hashed_password,
            "updated_at": datetime.utcnow()
        }}
    )
    
    if result.modified_count == 0:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Failed to update password"
        )
    
    logger.info(f"Password changed for driver: {current_driver.driver_id}")
    
    return {
        "message": "Password changed successfully"
    }
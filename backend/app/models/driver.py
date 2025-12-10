"""
Driver Data Models

This module defines the data structure for delivery drivers.
Drivers are the users who execute the optimized routes and
confirm deliveries.

Includes authentication fields for login functionality.
"""

from pydantic import BaseModel, Field, EmailStr, validator
from typing import Optional, List
from datetime import datetime
from enum import Enum


class DriverStatus(str, Enum):
    """
    Driver Status Enumeration
    
    Defines the possible states a driver can be in.
    Using an Enum ensures only valid statuses are used.
    """
    AVAILABLE = "available"      # Ready to take routes
    ON_ROUTE = "on_route"        # Currently delivering
    OFF_DUTY = "off_duty"        # Not working
    ON_BREAK = "on_break"        # Temporary break


class VehicleType(str, Enum):
    """
    Vehicle Type Enumeration
    
    Defines the types of vehicles used for deliveries.
    This can affect route optimization (e.g., bike vs van capacity).
    """
    BIKE = "bike"                # Bicycle or motorcycle
    CAR = "car"                  # Standard car
    VAN = "van"                  # Delivery van
    TRUCK = "truck"              # Large truck


class DriverRole(str, Enum):
    """
    Driver Role Enumeration
    
    Defines access levels for drivers.
    """
    DRIVER = "driver"            # Regular driver
    ADMIN = "admin"              # Admin with full access
    DISPATCHER = "dispatcher"    # Can manage routes but not admin settings


class DriverBase(BaseModel):
    """
    Base Driver Model
    
    Contains core driver information used across all driver models.
    """
    
    # Driver's full name
    full_name: str = Field(..., min_length=2, max_length=100, description="Driver's full name")
    
    # Unique email address (used for login)
    email: EmailStr = Field(..., description="Driver's email address")
    
    # Contact phone number (optional)
    phone: Optional[str] = Field(None, max_length=20, description="Contact phone number")
    
    # Type of vehicle driver uses
    vehicle_type: VehicleType = Field(..., description="Type of delivery vehicle")
    
    # Vehicle license plate number
    license_plate: Optional[str] = Field(None, max_length=20, description="Vehicle license plate")
    
    # Maximum number of packages driver can carry
    max_capacity: int = Field(default=20, ge=1, le=100, description="Maximum delivery capacity")
    
    # Driver's current status
    status: DriverStatus = Field(default=DriverStatus.AVAILABLE, description="Current driver status")
    
    # Driver's role (driver, admin, dispatcher)
    role: DriverRole = Field(default=DriverRole.DRIVER, description="Driver's access role")
    
    # Driver's home base/preferred depot
    home_store_id: Optional[str] = Field(None, description="Assigned depot/store ID")
    
    @validator('phone')
    def validate_phone(cls, v):
        """
        Validate Phone Number
        
        Ensures phone number contains only valid characters.
        Moroccan phone numbers typically start with +212 or 0.
        
        Args:
            v: Phone number to validate
            
        Returns:
            str: Validated phone number
            
        Raises:
            ValueError: If phone format is invalid
        """
        if v is None or v == '':
            return v
        
        # Remove spaces and dashes for validation
        cleaned = v.replace(" ", "").replace("-", "")
        
        # Check if it contains only digits and optional + prefix
        if not cleaned.lstrip("+").isdigit():
            raise ValueError('Phone number must contain only digits, spaces, dashes, or + prefix')
        
        return v


class DriverCreate(DriverBase):
    """
    Driver Creation Model
    
    Used when registering a new driver.
    Includes password field for authentication setup.
    """
    
    # Plain text password (will be hashed before storage)
    password: str = Field(
        ..., 
        min_length=8, 
        max_length=100,
        description="Driver's password (min 8 characters)"
    )
    
    @validator('password')
    def validate_password(cls, v):
        """
        Validate Password Strength
        
        Ensures password meets minimum security requirements:
        - At least 8 characters
        - Contains at least one letter and one number
        
        Args:
            v: Password to validate
            
        Returns:
            str: Validated password
            
        Raises:
            ValueError: If password doesn't meet requirements
        """
        if len(v) < 8:
            raise ValueError('Password must be at least 8 characters')
        
        # Check for at least one letter and one number
        has_letter = any(c.isalpha() for c in v)
        has_number = any(c.isdigit() for c in v)
        
        if not (has_letter and has_number):
            raise ValueError('Password must contain at least one letter and one number')
        
        return v


class DriverUpdate(BaseModel):
    """
    Driver Update Model
    
    Used for updating driver information.
    All fields are optional for partial updates.
    """
    
    full_name: Optional[str] = Field(None, min_length=2, max_length=100)
    phone: Optional[str] = Field(None, min_length=10, max_length=20)
    vehicle_type: Optional[VehicleType] = None
    license_plate: Optional[str] = Field(None, max_length=20)
    max_capacity: Optional[int] = Field(None, ge=1, le=100)
    status: Optional[DriverStatus] = None
    home_store_id: Optional[str] = None
    
    # Allow password updates (will be hashed)
    password: Optional[str] = Field(None, min_length=8, max_length=100)


class DriverInDB(DriverBase):
    """
    Driver Database Model
    
    Represents a driver as stored in MongoDB.
    Includes hashed password and metadata fields.
    """
    
    # Unique driver identifier
    driver_id: str = Field(..., description="Unique driver identifier")
    
    # Hashed password (NEVER return this in API responses)
    hashed_password: str = Field(..., description="Bcrypt hashed password")
    
    # MongoDB's internal ID
    id: Optional[str] = Field(None, alias="_id")
    
    # Account creation timestamp
    created_at: datetime = Field(default_factory=datetime.utcnow)
    
    # Last update timestamp
    updated_at: datetime = Field(default_factory=datetime.utcnow)
    
    # Last login timestamp
    last_login: Optional[datetime] = None
    
    # Account active status
    is_active: bool = Field(default=True, description="Account active status")
    
    # Whether driver is verified/approved
    is_verified: bool = Field(default=False, description="Verification status")
    
    # Total number of completed deliveries (for statistics)
    total_deliveries: int = Field(default=0, ge=0)
    
    # Average rating from customers (if implemented)
    rating: Optional[float] = Field(None, ge=0, le=5)
    
    class Config:
        populate_by_name = True
        json_schema_extra = {
            "example": {
                "driver_id": "DRV_001",
                "full_name": "Mohammed El Amrani",
                "email": "m.elamrani@routechain.ma",
                "phone": "+212 661 234567",
                "vehicle_type": "van",
                "license_plate": "A-12345",
                "max_capacity": 20,
                "status": "available",
                "home_store_id": "STORE_CASA_001",
                "is_active": True,
                "is_verified": True,
                "total_deliveries": 150,
                "rating": 4.7
            }
        }


class DriverResponse(BaseModel):
    """
    Driver API Response Model
    
    Used for API responses. Excludes sensitive information
    like hashed_password.
    
    This ensures we never accidentally expose password hashes.
    """
    
    driver_id: str
    full_name: str
    email: EmailStr
    phone: Optional[str] = None
    vehicle_type: VehicleType
    license_plate: Optional[str] = None
    max_capacity: int
    status: DriverStatus
    role: DriverRole = DriverRole.DRIVER  # Added role field
    home_store_id: Optional[str] = None
    created_at: datetime
    last_login: Optional[datetime] = None
    is_active: bool
    is_verified: bool
    total_deliveries: int = 0
    rating: Optional[float] = None
    
    class Config:
        json_schema_extra = {
            "example": {
                "driver_id": "DRV_001",
                "full_name": "Mohammed El Amrani",
                "email": "m.elamrani@routechain.ma",
                "phone": "+212 661 234567",
                "vehicle_type": "van",
                "license_plate": "A-12345",
                "max_capacity": 20,
                "status": "available",
                "home_store_id": "STORE_CASA_001",
                "is_active": True,
                "is_verified": True,
                "total_deliveries": 150,
                "rating": 4.7
            }
        }


class DriverLogin(BaseModel):
    """
    Driver Login Model
    
    Used for authentication requests.
    Simple email + password combination.
    """
    
    email: EmailStr = Field(..., description="Driver's email")
    password: str = Field(..., description="Driver's password")
    
    class Config:
        json_schema_extra = {
            "example": {
                "email": "m.elamrani@routechain.ma",
                "password": "SecurePass123"
            }
        }


class Token(BaseModel):
    """
    JWT Token Response Model
    
    Returned after successful authentication.
    Contains the access token and token type.
    """
    
    access_token: str = Field(..., description="JWT access token")
    token_type: str = Field(default="bearer", description="Token type")
    driver_id: str = Field(..., description="Authenticated driver's ID")
    
    class Config:
        json_schema_extra = {
            "example": {
                "access_token": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...",
                "token_type": "bearer",
                "driver_id": "DRV_001"
            }
        }


class TokenData(BaseModel):
    """
    Token Payload Model
    
    Represents the data encoded within the JWT token.
    Used for extracting driver information from the token.
    """
    
    email: Optional[str] = None
    driver_id: Optional[str] = None
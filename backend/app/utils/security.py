"""
Security Utilities Module

This module handles all authentication and security operations:
- Password hashing using bcrypt
- JWT token generation and verification
- Password verification

Using industry-standard security practices to protect user credentials.
"""

from datetime import datetime, timedelta
from typing import Optional
from jose import JWTError, jwt
import bcrypt
from app.config import settings
from app.models.driver import TokenData
import logging

logger = logging.getLogger(__name__)


def hash_password(password: str) -> str:
    """
    Hash a Plain Text Password
    
    Uses bcrypt to create a secure, one-way hash of the password.
    The hash includes a randomly generated salt, making each hash unique
    even for identical passwords.
    
    Args:
        password: Plain text password to hash
        
    Returns:
        str: Bcrypt hashed password (60 characters)
        
    Example:
        hashed = hash_password("SecurePass123")
        # Returns: "$2b$12$KIXvZ8..."
    """
    # Encode password to bytes and hash it
    password_bytes = password.encode('utf-8')
    salt = bcrypt.gensalt(rounds=12)
    hashed = bcrypt.hashpw(password_bytes, salt)
    return hashed.decode('utf-8')


def verify_password(plain_password: str, hashed_password: str) -> bool:
    """
    Verify a Password Against its Hash
    
    Compares a plain text password with a stored hash.
    Uses constant-time comparison to prevent timing attacks.
    
    Args:
        plain_password: The password to verify (from user input)
        hashed_password: The stored bcrypt hash
        
    Returns:
        bool: True if password matches, False otherwise
        
    Example:
        is_valid = verify_password("SecurePass123", stored_hash)
        if is_valid:
            # Allow login
    """
    try:
        password_bytes = plain_password.encode('utf-8')
        hashed_bytes = hashed_password.encode('utf-8')
        return bcrypt.checkpw(password_bytes, hashed_bytes)
    except Exception as e:
        logger.error(f"Password verification error: {e}")
        return False


def create_access_token(data: dict, expires_delta: Optional[timedelta] = None) -> str:
    """
    Create a JWT Access Token
    
    Generates a signed JWT token containing user data.
    The token is signed with our SECRET_KEY, making it tamper-proof.
    
    JWT Structure:
    - Header: Algorithm and token type
    - Payload: User data + expiration time
    - Signature: HMAC signature for verification
    
    Args:
        data: Dictionary of data to encode in the token (e.g., {"sub": email})
        expires_delta: Optional custom expiration time
        
    Returns:
        str: Signed JWT token
        
    Example:
        token = create_access_token(
            data={"sub": driver.email, "driver_id": driver.driver_id}
        )
    """
    # Create a copy of the data to avoid modifying the original
    to_encode = data.copy()
    
    # Set expiration time
    if expires_delta:
        expire = datetime.utcnow() + expires_delta
    else:
        # Use default expiration from settings (7 days)
        expire = datetime.utcnow() + timedelta(
            minutes=settings.ACCESS_TOKEN_EXPIRE_MINUTES
        )
    
    # Add expiration claim to the token payload
    # "exp" is a standard JWT claim that decoders check automatically
    to_encode.update({"exp": expire})
    
    # Encode and sign the token
    # The SECRET_KEY ensures only we can create valid tokens
    encoded_jwt = jwt.encode(
        to_encode,
        settings.SECRET_KEY,
        algorithm=settings.ALGORITHM
    )
    
    return encoded_jwt


def decode_access_token(token: str) -> Optional[TokenData]:
    """
    Decode and Verify a JWT Access Token
    
    Validates the token signature and expiration, then extracts the payload.
    
    Args:
        token: The JWT token to decode
        
    Returns:
        Optional[TokenData]: Token payload if valid, None if invalid/expired
        
    Raises:
        JWTError: If token is invalid or expired
        
    Example:
        token_data = decode_access_token(token)
        if token_data:
            driver_email = token_data.email
    """
    try:
        # Decode and verify the token
        # This automatically checks:
        # 1. Signature is valid (token hasn't been tampered with)
        # 2. Token hasn't expired
        payload = jwt.decode(
            token,
            settings.SECRET_KEY,
            algorithms=[settings.ALGORITHM]
        )
        
        # Extract the email from the "sub" (subject) claim
        # This is a standard JWT practice
        email: str = payload.get("sub")
        driver_id: str = payload.get("driver_id")
        
        if email is None:
            logger.warning("Token missing 'sub' claim")
            return None
        
        # Return structured token data
        return TokenData(email=email, driver_id=driver_id)
        
    except jwt.ExpiredSignatureError:
        # Token has expired
        logger.warning("Attempted use of expired token")
        return None
        
    except JWTError as e:
        # Invalid token (bad signature, malformed, etc.)
        logger.warning(f"JWT validation error: {e}")
        return None


def generate_driver_id() -> str:
    """
    Generate a Unique Driver ID
    
    Creates a unique identifier for new drivers.
    Format: DRV_YYYYMMDDHHMMSS (e.g., DRV_20241208143022)
    
    Returns:
        str: Unique driver ID
        
    Example:
        driver_id = generate_driver_id()
        # Returns: "DRV_20241208143022"
    """
    timestamp = datetime.utcnow().strftime("%Y%m%d%H%M%S")
    return f"DRV_{timestamp}"


def generate_route_id() -> str:
    """
    Generate a Unique Route ID
    
    Creates a unique identifier for new routes.
    Format: ROUTE_YYYYMMDD_XXX (e.g., ROUTE_20241208_001)
    
    Note: The XXX suffix should be incremented if multiple routes
    are created on the same day. For simplicity, we use timestamp seconds.
    
    Returns:
        str: Unique route ID
        
    Example:
        route_id = generate_route_id()
        # Returns: "ROUTE_20241208_001"
    """
    date_str = datetime.utcnow().strftime("%Y%m%d")
    time_str = datetime.utcnow().strftime("%H%M%S")
    return f"ROUTE_{date_str}_{time_str}"


def generate_point_id(route_id: str, sequence: int) -> str:
    """
    Generate a Unique Delivery Point ID
    
    Creates an identifier for a delivery point within a route.
    Format: {route_id}_P{sequence} (e.g., ROUTE_20241208_001_P01)
    
    Args:
        route_id: The parent route ID
        sequence: Point sequence number (1, 2, 3, etc.)
        
    Returns:
        str: Unique point ID
        
    Example:
        point_id = generate_point_id("ROUTE_20241208_001", 1)
        # Returns: "ROUTE_20241208_001_P01"
    """
    return f"{route_id}_P{sequence:02d}"


def mask_sensitive_data(data: str, visible_chars: int = 4) -> str:
    """
    Mask Sensitive Data for Logging
    
    Replaces most characters with asterisks, leaving only a few visible.
    Useful for logging emails, phone numbers, etc. without exposing full data.
    
    Args:
        data: The sensitive string to mask
        visible_chars: Number of trailing characters to leave visible
        
    Returns:
        str: Masked string
        
    Example:
        masked = mask_sensitive_data("user@example.com")
        # Returns: "*************.com"
    """
    if not data or len(data) <= visible_chars:
        return "*" * len(data)
    
    mask_length = len(data) - visible_chars
    return "*" * mask_length + data[-visible_chars:]
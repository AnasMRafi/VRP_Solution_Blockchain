"""
Store/Depot Data Models

This module defines the data structure for stores (depots).
A store is the starting point for all delivery routes.

Pydantic models provide:
- Automatic data validation
- JSON serialization/deserialization
- Type checking
- API documentation generation
"""

from pydantic import BaseModel, Field, validator
from typing import Optional
from datetime import datetime


class Location(BaseModel):
    """
    Geographic Location Model
    
    Represents a point on the map with latitude and longitude.
    This is used for both stores and delivery addresses.
    
    Validation ensures coordinates are within valid ranges:
    - Latitude: -90 to 90 degrees
    - Longitude: -180 to 180 degrees
    """
    
    # Latitude in decimal degrees (North-South position)
    latitude: float = Field(..., ge=-90, le=90, description="Latitude in decimal degrees")
    
    # Longitude in decimal degrees (East-West position)
    longitude: float = Field(..., ge=-180, le=180, description="Longitude in decimal degrees")
    
    @validator('latitude', 'longitude')
    def validate_coordinates(cls, v):
        """
        Validate Coordinates
        
        Ensures coordinates are not exactly 0,0 (which would be in the ocean
        off the coast of Africa and likely indicates an error).
        
        Args:
            v: The coordinate value to validate
            
        Returns:
            float: The validated coordinate
            
        Raises:
            ValueError: If coordinate is invalid
        """
        if v == 0:
            raise ValueError('Coordinate cannot be exactly 0 (likely invalid address)')
        return v
    
    class Config:
        # Example data for API documentation
        json_schema_extra = {
            "example": {
                "latitude": 33.5731,
                "longitude": -7.5898
            }
        }


class Address(BaseModel):
    """
    Physical Address Model
    
    Represents a complete address with all necessary details
    for delivery and geocoding.
    """
    
    # Street address (e.g., "123 Rue Mohammed V")
    street: str = Field(..., min_length=5, max_length=200, description="Street address")
    
    # City name (e.g., "Casablanca")
    city: str = Field(..., min_length=2, max_length=100, description="City name")
    
    # Postal code (optional in Morocco)
    postal_code: Optional[str] = Field(None, max_length=20, description="Postal code")
    
    # Country (default to Morocco for this application)
    country: str = Field(default="Morocco", description="Country name")
    
    # Full formatted address (auto-generated or provided)
    full_address: Optional[str] = Field(None, description="Complete formatted address")
    
    def get_full_address(self) -> str:
        """
        Generate Full Address String
        
        Creates a complete address string suitable for display
        and geocoding APIs.
        
        Returns:
            str: Formatted complete address
        """
        parts = [self.street, self.city]
        if self.postal_code:
            parts.append(self.postal_code)
        parts.append(self.country)
        return ", ".join(parts)
    
    class Config:
        json_schema_extra = {
            "example": {
                "street": "Boulevard Mohammed V",
                "city": "Casablanca",
                "postal_code": "20000",
                "country": "Morocco"
            }
        }


class StoreBase(BaseModel):
    """
    Base Store Model
    
    Contains the core fields that define a store/depot.
    This is the base model that other store models inherit from.
    """
    
    # Store name (e.g., "Casablanca Distribution Center")
    name: str = Field(..., min_length=2, max_length=100, description="Store name")
    
    # Physical address of the store
    address: Address = Field(..., description="Store address")
    
    # Geographic coordinates of the store
    location: Location = Field(..., description="Store GPS coordinates")
    
    # Contact phone number
    phone: Optional[str] = Field(None, max_length=20, description="Contact phone number")
    
    # Email address for the store
    email: Optional[str] = Field(None, description="Store email address")
    
    # Store manager or contact person name
    manager_name: Optional[str] = Field(None, max_length=100, description="Manager name")
    
    # Operating hours (e.g., "8:00 - 18:00")
    operating_hours: Optional[str] = Field(None, description="Operating hours")


class StoreCreate(StoreBase):
    """
    Store Creation Model
    
    Used when creating a new store via the API.
    Inherits all fields from StoreBase with no modifications.
    """
    pass


class StoreUpdate(BaseModel):
    """
    Store Update Model
    
    Used for partial updates to existing stores.
    All fields are optional so you can update just what you need.
    """
    
    name: Optional[str] = Field(None, min_length=2, max_length=100)
    address: Optional[Address] = None
    location: Optional[Location] = None
    phone: Optional[str] = Field(None, max_length=20)
    email: Optional[str] = None
    manager_name: Optional[str] = Field(None, max_length=100)
    operating_hours: Optional[str] = None


class StoreInDB(StoreBase):
    """
    Store Database Model
    
    Represents a store as stored in MongoDB.
    Includes additional fields that are auto-generated by the database.
    """
    
    # Unique identifier for the store (generated by our app)
    store_id: str = Field(..., description="Unique store identifier")
    
    # MongoDB's internal ID (auto-generated)
    id: Optional[str] = Field(None, alias="_id", description="MongoDB document ID")
    
    # Timestamp when store was created
    created_at: datetime = Field(default_factory=datetime.utcnow, description="Creation timestamp")
    
    # Timestamp when store was last updated
    updated_at: datetime = Field(default_factory=datetime.utcnow, description="Last update timestamp")
    
    # Whether this store is active/enabled
    is_active: bool = Field(default=True, description="Store active status")
    
    class Config:
        # Allow population by field name and alias
        populate_by_name = True
        # Example for API docs
        json_schema_extra = {
            "example": {
                "store_id": "STORE_CASA_001",
                "name": "Casablanca Distribution Center",
                "address": {
                    "street": "Boulevard Mohammed V",
                    "city": "Casablanca",
                    "postal_code": "20000",
                    "country": "Morocco"
                },
                "location": {
                    "latitude": 33.5731,
                    "longitude": -7.5898
                },
                "phone": "+212 522 123456",
                "email": "depot.casa@routechain.ma",
                "manager_name": "Ahmed Bennani",
                "operating_hours": "08:00 - 18:00",
                "is_active": True
            }
        }


class StoreResponse(StoreInDB):
    """
    Store API Response Model
    
    Used for API responses. Identical to StoreInDB but can be
    extended with additional computed fields if needed.
    """
    pass
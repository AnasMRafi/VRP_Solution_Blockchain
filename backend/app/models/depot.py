"""
Depot Model

Stores depot/warehouse locations for route optimization.
Routes can start and/or end at a depot.
"""

from pydantic import BaseModel, Field
from typing import Optional, List
from datetime import datetime


class DepotLocation(BaseModel):
    """Depot GPS coordinates"""
    latitude: float = Field(..., ge=-90, le=90)
    longitude: float = Field(..., ge=-180, le=180)
    address: Optional[str] = None


class DepotBase(BaseModel):
    """Base depot model"""
    name: str = Field(..., min_length=1, max_length=100)
    location: DepotLocation
    is_default: bool = Field(default=False)
    capacity: Optional[int] = Field(default=None, description="Max packages")
    operating_hours: Optional[str] = Field(default=None, description="e.g., '08:00-18:00'")
    contact_phone: Optional[str] = None
    notes: Optional[str] = None


class DepotCreate(DepotBase):
    """Create depot request"""
    pass


class DepotUpdate(BaseModel):
    """Update depot request - all fields optional"""
    name: Optional[str] = None
    location: Optional[DepotLocation] = None
    is_default: Optional[bool] = None
    capacity: Optional[int] = None
    operating_hours: Optional[str] = None
    contact_phone: Optional[str] = None
    notes: Optional[str] = None


class DepotResponse(DepotBase):
    """Depot response model"""
    depot_id: str
    driver_id: str
    created_at: datetime
    updated_at: datetime
    routes_count: int = 0

    class Config:
        from_attributes = True


class DepotInDB(DepotResponse):
    """Depot stored in database"""
    pass

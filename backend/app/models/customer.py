"""
Customer Model

Stores customer information for recurring deliveries.
"""

from pydantic import BaseModel, Field, EmailStr
from typing import Optional, List
from datetime import datetime


class CustomerAddress(BaseModel):
    """Customer address details"""
    street: str = Field(..., min_length=1)
    city: str = Field(..., min_length=1)
    postal_code: Optional[str] = None
    country: str = Field(default="Morocco")
    latitude: Optional[float] = None
    longitude: Optional[float] = None
    notes: Optional[str] = None


class CustomerBase(BaseModel):
    """Base customer model"""
    name: str = Field(..., min_length=1, max_length=100)
    email: Optional[EmailStr] = None
    phone: Optional[str] = None
    company: Optional[str] = None
    address: CustomerAddress
    tags: List[str] = Field(default_factory=list)
    notes: Optional[str] = None


class CustomerCreate(CustomerBase):
    """Create customer request"""
    pass


class CustomerUpdate(BaseModel):
    """Update customer request - all fields optional"""
    name: Optional[str] = None
    email: Optional[EmailStr] = None
    phone: Optional[str] = None
    company: Optional[str] = None
    address: Optional[CustomerAddress] = None
    tags: Optional[List[str]] = None
    notes: Optional[str] = None


class CustomerResponse(CustomerBase):
    """Customer response model"""
    customer_id: str
    driver_id: str
    created_at: datetime
    updated_at: datetime
    delivery_count: int = 0
    last_delivery: Optional[datetime] = None
    created_by: Optional[str] = None  # Creator name for admin view

    class Config:
        from_attributes = True


class CustomerInDB(CustomerResponse):
    """Customer stored in database"""
    pass


class CustomerListResponse(BaseModel):
    """Paginated customer list"""
    customers: List[CustomerResponse]
    total: int
    page: int
    limit: int

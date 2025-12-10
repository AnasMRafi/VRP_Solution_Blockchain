"""
Customers Router

CRUD operations for customer management.
Customers can be linked to delivery points for quick address lookup.
"""

from fastapi import APIRouter, Depends, HTTPException, status, Query
from motor.motor_asyncio import AsyncIOMotorDatabase
from datetime import datetime
from typing import Optional, List
import logging
import uuid

from app.models.customer import (
    CustomerCreate,
    CustomerUpdate,
    CustomerResponse,
    CustomerListResponse
)
from app.models.driver import DriverInDB
from app.services.database import get_database
from app.routers.auth import get_current_driver

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/customers", tags=["Customers"])


def generate_customer_id() -> str:
    """Generate unique customer ID"""
    return f"cust_{uuid.uuid4().hex[:12]}"


@router.post("", response_model=CustomerResponse, status_code=status.HTTP_201_CREATED)
async def create_customer(
    customer: CustomerCreate,
    db: AsyncIOMotorDatabase = Depends(get_database),
    current_driver: DriverInDB = Depends(get_current_driver)
):
    """
    Create a new customer
    """
    customer_id = generate_customer_id()
    
    customer_dict = customer.dict()
    customer_dict.update({
        "customer_id": customer_id,
        "driver_id": current_driver.driver_id,
        "created_at": datetime.utcnow(),
        "updated_at": datetime.utcnow(),
        "delivery_count": 0,
        "last_delivery": None
    })
    
    await db.customers.insert_one(customer_dict)
    
    logger.info(f"Customer created: {customer_id} by driver {current_driver.driver_id}")
    
    return CustomerResponse(**customer_dict)


@router.get("", response_model=CustomerListResponse)
async def list_customers(
    search: Optional[str] = Query(None, description="Search by name, email, or company"),
    tag: Optional[str] = Query(None, description="Filter by tag"),
    page: int = Query(1, ge=1),
    limit: int = Query(20, ge=1, le=100),
    db: AsyncIOMotorDatabase = Depends(get_database),
    current_driver: DriverInDB = Depends(get_current_driver)
):
    """
    List all customers for the current driver
    """
    query = {"driver_id": current_driver.driver_id}
    
    # Search filter
    if search:
        query["$or"] = [
            {"name": {"$regex": search, "$options": "i"}},
            {"email": {"$regex": search, "$options": "i"}},
            {"company": {"$regex": search, "$options": "i"}},
            {"phone": {"$regex": search, "$options": "i"}}
        ]
    
    # Tag filter
    if tag:
        query["tags"] = tag
    
    # Get total count
    total = await db.customers.count_documents(query)
    
    # Get paginated results
    skip = (page - 1) * limit
    cursor = db.customers.find(query).sort("name", 1).skip(skip).limit(limit)
    customers = await cursor.to_list(length=limit)
    
    # Convert ObjectId
    for c in customers:
        if "_id" in c:
            c["_id"] = str(c["_id"])
    
    return CustomerListResponse(
        customers=[CustomerResponse(**c) for c in customers],
        total=total,
        page=page,
        limit=limit
    )


@router.get("/{customer_id}", response_model=CustomerResponse)
async def get_customer(
    customer_id: str,
    db: AsyncIOMotorDatabase = Depends(get_database),
    current_driver: DriverInDB = Depends(get_current_driver)
):
    """
    Get a specific customer
    """
    customer = await db.customers.find_one({
        "customer_id": customer_id,
        "driver_id": current_driver.driver_id
    })
    
    if not customer:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Customer not found"
        )
    
    if "_id" in customer:
        customer["_id"] = str(customer["_id"])
    
    return CustomerResponse(**customer)


@router.put("/{customer_id}", response_model=CustomerResponse)
async def update_customer(
    customer_id: str,
    update_data: CustomerUpdate,
    db: AsyncIOMotorDatabase = Depends(get_database),
    current_driver: DriverInDB = Depends(get_current_driver)
):
    """
    Update a customer
    """
    # Get existing customer
    customer = await db.customers.find_one({
        "customer_id": customer_id,
        "driver_id": current_driver.driver_id
    })
    
    if not customer:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Customer not found"
        )
    
    # Build update dict
    update_dict = {k: v for k, v in update_data.dict().items() if v is not None}
    
    if "address" in update_dict and update_dict["address"]:
        update_dict["address"] = update_data.address.dict()
    
    if not update_dict:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="No valid fields to update"
        )
    
    update_dict["updated_at"] = datetime.utcnow()
    
    # Update in database
    await db.customers.update_one(
        {"customer_id": customer_id},
        {"$set": update_dict}
    )
    
    # Get updated document
    updated = await db.customers.find_one({"customer_id": customer_id})
    if "_id" in updated:
        updated["_id"] = str(updated["_id"])
    
    logger.info(f"Customer updated: {customer_id}")
    
    return CustomerResponse(**updated)


@router.delete("/{customer_id}")
async def delete_customer(
    customer_id: str,
    db: AsyncIOMotorDatabase = Depends(get_database),
    current_driver: DriverInDB = Depends(get_current_driver)
):
    """
    Delete a customer
    """
    result = await db.customers.delete_one({
        "customer_id": customer_id,
        "driver_id": current_driver.driver_id
    })
    
    if result.deleted_count == 0:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Customer not found"
        )
    
    logger.info(f"Customer deleted: {customer_id}")
    
    return {"message": "Customer deleted successfully"}


@router.get("/{customer_id}/deliveries")
async def get_customer_deliveries(
    customer_id: str,
    limit: int = Query(10, ge=1, le=50),
    db: AsyncIOMotorDatabase = Depends(get_database),
    current_driver: DriverInDB = Depends(get_current_driver)
):
    """
    Get delivery history for a customer
    """
    # Verify customer exists
    customer = await db.customers.find_one({
        "customer_id": customer_id,
        "driver_id": current_driver.driver_id
    })
    
    if not customer:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Customer not found"
        )
    
    # Find deliveries linked to this customer
    cursor = db.deliveries.find({
        "customer_id": customer_id
    }).sort("confirmed_at", -1).limit(limit)
    
    deliveries = await cursor.to_list(length=limit)
    
    # Convert ObjectId
    for d in deliveries:
        if "_id" in d:
            d["_id"] = str(d["_id"])
    
    return {
        "customer_id": customer_id,
        "customer_name": customer["name"],
        "deliveries": deliveries,
        "total_deliveries": customer.get("delivery_count", 0)
    }

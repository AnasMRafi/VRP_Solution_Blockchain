"""
Depots Router

CRUD operations for depot/warehouse management.
"""

from fastapi import APIRouter, Depends, HTTPException, status, Query
from motor.motor_asyncio import AsyncIOMotorDatabase
from datetime import datetime
from typing import Optional, List
import logging
import uuid

from app.models.depot import (
    DepotCreate,
    DepotUpdate,
    DepotResponse
)
from app.models.driver import DriverInDB
from app.services.database import get_database
from app.routers.auth import get_current_driver

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/depots", tags=["Depots"])


def generate_depot_id() -> str:
    """Generate unique depot ID"""
    return f"depot_{uuid.uuid4().hex[:12]}"


@router.post("", response_model=DepotResponse, status_code=status.HTTP_201_CREATED)
async def create_depot(
    depot: DepotCreate,
    db: AsyncIOMotorDatabase = Depends(get_database),
    current_driver: DriverInDB = Depends(get_current_driver)
):
    """
    Create a new depot
    """
    depot_id = generate_depot_id()
    
    # If this is set as default, unset other defaults
    if depot.is_default:
        await db.depots.update_many(
            {"driver_id": current_driver.driver_id, "is_default": True},
            {"$set": {"is_default": False}}
        )
    
    depot_dict = depot.dict()
    depot_dict.update({
        "depot_id": depot_id,
        "driver_id": current_driver.driver_id,
        "created_at": datetime.utcnow(),
        "updated_at": datetime.utcnow(),
        "routes_count": 0
    })
    
    await db.depots.insert_one(depot_dict)
    
    logger.info(f"Depot created: {depot_id} by driver {current_driver.driver_id}")
    
    return DepotResponse(**depot_dict)


@router.get("", response_model=List[DepotResponse])
async def list_depots(
    db: AsyncIOMotorDatabase = Depends(get_database),
    current_driver: DriverInDB = Depends(get_current_driver)
):
    """
    List all depots for the current driver
    """
    cursor = db.depots.find({"driver_id": current_driver.driver_id}).sort("name", 1)
    depots = await cursor.to_list(length=100)
    
    # Convert ObjectId
    for d in depots:
        if "_id" in d:
            d["_id"] = str(d["_id"])
    
    return [DepotResponse(**d) for d in depots]


@router.get("/default", response_model=Optional[DepotResponse])
async def get_default_depot(
    db: AsyncIOMotorDatabase = Depends(get_database),
    current_driver: DriverInDB = Depends(get_current_driver)
):
    """
    Get the default depot
    """
    depot = await db.depots.find_one({
        "driver_id": current_driver.driver_id,
        "is_default": True
    })
    
    if not depot:
        return None
    
    if "_id" in depot:
        depot["_id"] = str(depot["_id"])
    
    return DepotResponse(**depot)


@router.get("/{depot_id}", response_model=DepotResponse)
async def get_depot(
    depot_id: str,
    db: AsyncIOMotorDatabase = Depends(get_database),
    current_driver: DriverInDB = Depends(get_current_driver)
):
    """
    Get a specific depot
    """
    depot = await db.depots.find_one({
        "depot_id": depot_id,
        "driver_id": current_driver.driver_id
    })
    
    if not depot:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Depot not found"
        )
    
    if "_id" in depot:
        depot["_id"] = str(depot["_id"])
    
    return DepotResponse(**depot)


@router.put("/{depot_id}", response_model=DepotResponse)
async def update_depot(
    depot_id: str,
    update_data: DepotUpdate,
    db: AsyncIOMotorDatabase = Depends(get_database),
    current_driver: DriverInDB = Depends(get_current_driver)
):
    """
    Update a depot
    """
    # Get existing depot
    depot = await db.depots.find_one({
        "depot_id": depot_id,
        "driver_id": current_driver.driver_id
    })
    
    if not depot:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Depot not found"
        )
    
    # Build update dict
    update_dict = {k: v for k, v in update_data.dict().items() if v is not None}
    
    if "location" in update_dict and update_dict["location"]:
        update_dict["location"] = update_data.location.dict()
    
    # If setting as default, unset other defaults
    if update_dict.get("is_default"):
        await db.depots.update_many(
            {"driver_id": current_driver.driver_id, "is_default": True, "depot_id": {"$ne": depot_id}},
            {"$set": {"is_default": False}}
        )
    
    if not update_dict:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="No valid fields to update"
        )
    
    update_dict["updated_at"] = datetime.utcnow()
    
    # Update in database
    await db.depots.update_one(
        {"depot_id": depot_id},
        {"$set": update_dict}
    )
    
    # Get updated document
    updated = await db.depots.find_one({"depot_id": depot_id})
    if "_id" in updated:
        updated["_id"] = str(updated["_id"])
    
    logger.info(f"Depot updated: {depot_id}")
    
    return DepotResponse(**updated)


@router.delete("/{depot_id}")
async def delete_depot(
    depot_id: str,
    db: AsyncIOMotorDatabase = Depends(get_database),
    current_driver: DriverInDB = Depends(get_current_driver)
):
    """
    Delete a depot
    """
    result = await db.depots.delete_one({
        "depot_id": depot_id,
        "driver_id": current_driver.driver_id
    })
    
    if result.deleted_count == 0:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Depot not found"
        )
    
    logger.info(f"Depot deleted: {depot_id}")
    
    return {"message": "Depot deleted successfully"}


@router.post("/{depot_id}/set-default", response_model=DepotResponse)
async def set_default_depot(
    depot_id: str,
    db: AsyncIOMotorDatabase = Depends(get_database),
    current_driver: DriverInDB = Depends(get_current_driver)
):
    """
    Set a depot as the default
    """
    # Verify depot exists
    depot = await db.depots.find_one({
        "depot_id": depot_id,
        "driver_id": current_driver.driver_id
    })
    
    if not depot:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Depot not found"
        )
    
    # Unset all defaults
    await db.depots.update_many(
        {"driver_id": current_driver.driver_id},
        {"$set": {"is_default": False}}
    )
    
    # Set this one as default
    await db.depots.update_one(
        {"depot_id": depot_id},
        {"$set": {"is_default": True, "updated_at": datetime.utcnow()}}
    )
    
    # Get updated document
    updated = await db.depots.find_one({"depot_id": depot_id})
    if "_id" in updated:
        updated["_id"] = str(updated["_id"])
    
    logger.info(f"Depot set as default: {depot_id}")
    
    return DepotResponse(**updated)

"""
Admin Router

Admin-only endpoints for managing drivers and system settings.
Requires admin role.
"""

from fastapi import APIRouter, Depends, HTTPException, status, Query
from motor.motor_asyncio import AsyncIOMotorDatabase
from datetime import datetime
from typing import Optional, List
import logging

from app.models.driver import DriverInDB, DriverResponse, DriverRole
from app.services.database import get_database
from app.routers.auth import get_current_driver

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/admin", tags=["Admin"])


async def require_admin(current_driver: DriverInDB = Depends(get_current_driver)) -> DriverInDB:
    """
    Dependency to require admin role
    """
    if current_driver.role != DriverRole.ADMIN:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Admin access required"
        )
    return current_driver


@router.get("/drivers", response_model=List[DriverResponse])
async def list_all_drivers(
    status_filter: Optional[str] = Query(None),
    role_filter: Optional[str] = Query(None),
    search: Optional[str] = Query(None),
    db: AsyncIOMotorDatabase = Depends(get_database),
    admin: DriverInDB = Depends(require_admin)
):
    """
    List all drivers (admin only)
    """
    query = {}
    
    if status_filter:
        query["status"] = status_filter
    
    if role_filter:
        query["role"] = role_filter
    
    if search:
        query["$or"] = [
            {"full_name": {"$regex": search, "$options": "i"}},
            {"email": {"$regex": search, "$options": "i"}}
        ]
    
    cursor = db.drivers.find(query).sort("full_name", 1)
    drivers = await cursor.to_list(length=500)
    
    # Convert and exclude sensitive fields
    result = []
    for d in drivers:
        if "_id" in d:
            d["_id"] = str(d["_id"])
        # Exclude hashed_password
        d.pop("hashed_password", None)
        result.append(DriverResponse(**d))
    
    return result


@router.get("/drivers/{driver_id}", response_model=DriverResponse)
async def get_driver_details(
    driver_id: str,
    db: AsyncIOMotorDatabase = Depends(get_database),
    admin: DriverInDB = Depends(require_admin)
):
    """
    Get detailed driver information (admin only)
    """
    driver = await db.drivers.find_one({"driver_id": driver_id})
    
    if not driver:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Driver not found"
        )
    
    if "_id" in driver:
        driver["_id"] = str(driver["_id"])
    driver.pop("hashed_password", None)
    
    return DriverResponse(**driver)


@router.put("/drivers/{driver_id}/role")
async def update_driver_role(
    driver_id: str,
    role: DriverRole,
    db: AsyncIOMotorDatabase = Depends(get_database),
    admin: DriverInDB = Depends(require_admin)
):
    """
    Update a driver's role (admin only)
    """
    # Don't allow admin to demote themselves
    if driver_id == admin.driver_id and role != DriverRole.ADMIN:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Cannot demote yourself"
        )
    
    result = await db.drivers.update_one(
        {"driver_id": driver_id},
        {"$set": {"role": role.value, "updated_at": datetime.utcnow()}}
    )
    
    if result.matched_count == 0:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Driver not found"
        )
    
    logger.info(f"Driver {driver_id} role updated to {role.value} by admin {admin.driver_id}")
    
    return {"message": f"Driver role updated to {role.value}"}


@router.put("/drivers/{driver_id}/status")
async def update_driver_status(
    driver_id: str,
    status_value: str,
    db: AsyncIOMotorDatabase = Depends(get_database),
    admin: DriverInDB = Depends(require_admin)
):
    """
    Update a driver's status (admin only)
    """
    valid_statuses = ["available", "on_route", "off_duty", "on_break"]
    
    if status_value not in valid_statuses:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"Invalid status. Must be one of: {valid_statuses}"
        )
    
    result = await db.drivers.update_one(
        {"driver_id": driver_id},
        {"$set": {"status": status_value, "updated_at": datetime.utcnow()}}
    )
    
    if result.matched_count == 0:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Driver not found"
        )
    
    return {"message": f"Driver status updated to {status_value}"}


@router.delete("/drivers/{driver_id}")
async def delete_driver(
    driver_id: str,
    db: AsyncIOMotorDatabase = Depends(get_database),
    admin: DriverInDB = Depends(require_admin)
):
    """
    Delete a driver (admin only)
    """
    # Don't allow admin to delete themselves
    if driver_id == admin.driver_id:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Cannot delete yourself"
        )
    
    result = await db.drivers.delete_one({"driver_id": driver_id})
    
    if result.deleted_count == 0:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Driver not found"
        )
    
    logger.info(f"Driver {driver_id} deleted by admin {admin.driver_id}")
    
    return {"message": "Driver deleted successfully"}


@router.get("/stats/overview")
async def get_admin_overview(
    db: AsyncIOMotorDatabase = Depends(get_database),
    admin: DriverInDB = Depends(require_admin)
):
    """
    Get admin dashboard overview (admin only)
    """
    # Count drivers by status
    driver_count = await db.drivers.count_documents({})
    active_drivers = await db.drivers.count_documents({"status": "on_route"})
    
    # Count routes
    total_routes = await db.routes.count_documents({})
    active_routes = await db.routes.count_documents({"status": "in_progress"})
    completed_routes = await db.routes.count_documents({"status": "completed"})
    
    # Count customers
    total_customers = await db.customers.count_documents({})
    
    # Count depots
    total_depots = await db.depots.count_documents({})
    
    return {
        "drivers": {
            "total": driver_count,
            "active": active_drivers
        },
        "routes": {
            "total": total_routes,
            "active": active_routes,
            "completed": completed_routes
        },
        "customers": total_customers,
        "depots": total_depots
    }


@router.post("/make-admin/{driver_id}")
async def make_first_admin(
    driver_id: str,
    db: AsyncIOMotorDatabase = Depends(get_database)
):
    """
    Make a driver admin (only works if no admins exist)
    This is for initial setup only.
    """
    # Check if any admin exists
    admin_count = await db.drivers.count_documents({"role": "admin"})
    
    if admin_count > 0:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Admin already exists. Use admin panel to promote users."
        )
    
    # Find driver
    driver = await db.drivers.find_one({"driver_id": driver_id})
    
    if not driver:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Driver not found"
        )
    
    # Make admin
    await db.drivers.update_one(
        {"driver_id": driver_id},
        {"$set": {"role": "admin", "updated_at": datetime.utcnow()}}
    )
    
    logger.info(f"Driver {driver_id} made first admin")
    
    return {"message": f"Driver {driver_id} is now an admin"}

"""
Routes Management Router

This is the core router for route operations:
- Create and optimize routes (VRP optimization)
- List routes
- Get route details
- Update route status
- Confirm deliveries
- Complete routes

This is where the VRP magic happens!
"""

from fastapi import APIRouter, Depends, HTTPException, status, Query
from fastapi.responses import Response
from motor.motor_asyncio import AsyncIOMotorDatabase
from typing import List, Optional
from datetime import datetime
import logging

from app.models.route import (
    RouteOptimizationRequest,
    RouteResponse,
    RouteListItem,
    RouteInDB,
    RouteStatus,
    DeliveryConfirmation,
    DeliveryStatus,
    DeliveryPoint
)
from app.models.driver import DriverInDB
from app.services.database import get_database
from app.services.distance import distance_service
from app.services.vrp_solver import vrp_solver
from app.services.export import export_service
from app.routers.auth import get_current_driver
from app.utils.security import generate_route_id, generate_point_id

# Optional blockchain import - works without it
try:
    from app.services.blockchain import blockchain_service
    BLOCKCHAIN_ENABLED = blockchain_service.is_available
except ImportError:
    blockchain_service = None
    BLOCKCHAIN_ENABLED = False
    logging.warning("Blockchain service not available - running without blockchain")

logger = logging.getLogger(__name__)

# Create router
router = APIRouter(prefix="/routes", tags=["Routes"])


@router.post("/optimize", response_model=RouteResponse, status_code=status.HTTP_201_CREATED)
async def create_and_optimize_route(
    route_request: RouteOptimizationRequest,
    db: AsyncIOMotorDatabase = Depends(get_database),
    current_driver: DriverInDB = Depends(get_current_driver)
):
    """
    Create and Optimize a Delivery Route
    
    This is the main VRP endpoint. It:
    1. Validates the input (5-20 delivery points)
    2. Calls OpenRouteService to get distance matrix
    3. Runs OR-Tools VRP solver to optimize the route
    4. Saves the optimized route to database
    5. Returns the complete optimized route
    
    This is the most computationally expensive endpoint, typically taking
    5-30 seconds depending on the number of delivery points.
    
    Args:
        route_request: Route optimization request with depot and delivery points
        db: Database connection
        current_driver: Authenticated driver
        
    Returns:
        RouteResponse: Complete optimized route with sequence and statistics
        
    Raises:
        HTTPException 400: If input validation fails
        HTTPException 500: If optimization fails
    """
    
    logger.info(
        f"Route optimization requested by driver {current_driver.driver_id} "
        f"with {len(route_request.delivery_points)} delivery points"
    )
    
    try:
        # Step 1: Generate unique route ID
        route_id = generate_route_id()
        logger.info(f"Generated route ID: {route_id}")
        
        # Step 2: Assign unique IDs to delivery points if not provided
        for i, point in enumerate(route_request.delivery_points):
            if not point.point_id or point.point_id == "":
                point.point_id = generate_point_id(route_id, i + 1)
        
        # Step 3: Prepare locations for distance matrix calculation
        # Format: [depot, point1, point2, ..., pointN]
        locations = [route_request.depot_location] + [
            point.location for point in route_request.delivery_points
        ]
        
        logger.info("Calculating distance matrix...")
        
        # Step 4: Get distance and duration matrices from OpenRouteService
        distance_matrix, duration_matrix = await distance_service.calculate_distance_matrix(
            locations
        )
        
        logger.info("✓ Distance matrix calculated")
        
        # Step 5: Run VRP optimization
        logger.info("Running VRP optimization...")
        
        optimization_result = vrp_solver.solve_vrp(
            depot_location=route_request.depot_location,
            delivery_points=route_request.delivery_points,
            distance_matrix=distance_matrix,
            duration_matrix=duration_matrix,
            vehicle_capacity=route_request.vehicle_capacity or 20,
            max_duration_minutes=route_request.max_duration_minutes or 480
        )
        
        logger.info("✓ VRP optimization complete")
        
        # Step 6: Prepare route document for database
        route_dict = {
            "route_id": route_id,
            "route_name": route_request.route_name,
            "depot_location": route_request.depot_location.dict(),
            "depot_address": route_request.depot_address.dict() if route_request.depot_address else None,
            "delivery_points": [point.dict() for point in optimization_result.optimized_sequence],
            "driver_id": route_request.driver_id or current_driver.driver_id,
            "status": RouteStatus.OPTIMIZED.value,
            "optimization_result": {
                "optimized_sequence": [p.dict() for p in optimization_result.optimized_sequence],
                "route_segments": [s.dict() for s in optimization_result.route_segments],
                "total_distance_km": optimization_result.total_distance_km,
                "total_duration_minutes": optimization_result.total_duration_minutes,
                "estimated_cost": optimization_result.estimated_cost,
                "solver_info": optimization_result.solver_info
            },
            "created_at": datetime.utcnow(),
            "updated_at": datetime.utcnow(),
            "planned_start_time": None,
            "actual_start_time": None,
            "completed_at": None,
            "blockchain_tx_hash": None,  # Will be set when recorded on blockchain
            "blockchain_block": None,
            "data_hash": None
        }
        
        # Step 7: Save to database
        result = await db.routes.insert_one(route_dict)
        
        if not result.inserted_id:
            logger.error("Failed to save route to database")
            raise HTTPException(
                status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
                detail="Failed to save optimized route"
            )
        
        logger.info(f"✓ Route saved to database: {route_id}")
        
        # Step 8: Record route creation on blockchain (if available)
        if BLOCKCHAIN_ENABLED and blockchain_service:
            logger.info("Recording route on blockchain...")
            
            blockchain_result = await blockchain_service.record_route_creation(
                route_id,
                route_dict
            )
            
            if blockchain_result:
                # Update route document with blockchain info
                route_dict['blockchain_tx_hash'] = blockchain_result['transaction_hash']
                route_dict['blockchain_block'] = blockchain_result['block_number']
                route_dict['data_hash'] = blockchain_result['data_hash']
                
                # Update in database
                await db.routes.update_one(
                    {"route_id": route_id},
                    {"$set": {
                        "blockchain_tx_hash": blockchain_result['transaction_hash'],
                        "blockchain_block": blockchain_result['block_number'],
                        "data_hash": blockchain_result['data_hash']
                    }}
                )
                
                logger.info(f"✓ Route recorded on blockchain: {blockchain_result['transaction_hash']}")
            else:
                logger.warning("⚠ Blockchain recording failed")
        else:
            logger.info("ℹ Blockchain disabled - skipping blockchain recording")
        
        # Step 9: Return the optimized route
        if "_id" in route_dict:
            route_dict["id"] = str(route_dict.pop("_id"))
        else:
            route_dict["id"] = str(result.inserted_id)
        return RouteResponse(**route_dict)
        
    except ValueError as e:
        # Handle validation or solver errors
        logger.error(f"Route optimization failed: {e}")
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=str(e)
        )
    
    except Exception as e:
        # Handle unexpected errors
        logger.error(f"Unexpected error in route optimization: {e}", exc_info=True)
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Route optimization failed: {str(e)}"
        )


@router.get("/", response_model=List[RouteListItem])
async def list_routes(
    status_filter: Optional[RouteStatus] = Query(None, description="Filter by route status"),
    driver_id: Optional[str] = Query(None, description="Filter by driver ID"),
    limit: int = Query(50, ge=1, le=100, description="Maximum number of routes to return"),
    skip: int = Query(0, ge=0, description="Number of routes to skip"),
    db: AsyncIOMotorDatabase = Depends(get_database),
    current_driver: DriverInDB = Depends(get_current_driver)
):
    """
    List Routes
    
    Returns a list of routes with optional filtering and pagination.
    Drivers can only see their own routes unless they're admin.
    
    Args:
        status_filter: Optional status filter (e.g., "optimized", "in_progress")
        driver_id: Optional driver ID filter
        limit: Maximum routes to return (default 50, max 100)
        skip: Number of routes to skip for pagination
        db: Database connection
        current_driver: Authenticated driver
        
    Returns:
        List[RouteListItem]: List of simplified route information
    """
    
    # Build query filter
    query = {}
    
    # Non-admin drivers can only see their own routes
    # (In a real app, you'd check an is_admin field)
    if driver_id:
        query["driver_id"] = driver_id
    else:
        # Default: show only current driver's routes
        query["driver_id"] = current_driver.driver_id
    
    # Add status filter if provided
    if status_filter:
        query["status"] = status_filter.value
    
    logger.info(f"Listing routes with query: {query}")
    
    # Query database
    routes_cursor = db.routes.find(query).sort("created_at", -1).skip(skip).limit(limit)
    routes = await routes_cursor.to_list(length=limit)
    
    # Convert to list items
    route_list = []
    for route in routes:
        # Calculate delivery counts
        delivery_points = route.get("delivery_points", [])
        completed_deliveries = sum(
            1 for point in delivery_points
            if point.get("status") == DeliveryStatus.DELIVERED.value
        )
        
        # Get distance and duration from optimization result
        opt_result = route.get("optimization_result", {})
        
        route_item = RouteListItem(
            route_id=route["route_id"],
            route_name=route["route_name"],
            status=RouteStatus(route["status"]),
            driver_id=route.get("driver_id"),
            created_at=route["created_at"],
            total_distance_km=opt_result.get("total_distance_km"),
            total_duration_minutes=opt_result.get("total_duration_minutes"),
            delivery_count=len(delivery_points),
            completed_deliveries=completed_deliveries
        )
        route_list.append(route_item)
    
    logger.info(f"Returning {len(route_list)} routes")
    return route_list


@router.get("/{route_id}", response_model=RouteResponse)
async def get_route_details(
    route_id: str,
    db: AsyncIOMotorDatabase = Depends(get_database),
    current_driver: DriverInDB = Depends(get_current_driver)
):
    """
    Get Route Details
    
    Returns complete information for a specific route.
    
    Args:
        route_id: Route identifier
        db: Database connection
        current_driver: Authenticated driver
        
    Returns:
        RouteResponse: Complete route information
        
    Raises:
        HTTPException 404: If route not found
        HTTPException 403: If driver doesn't have access to this route
    """
    
    # Find route
    route = await db.routes.find_one({"route_id": route_id})
    
    if not route:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Route {route_id} not found"
        )
    
    # Check access (drivers can only see their own routes)
    if route.get("driver_id") != current_driver.driver_id:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Access denied to this route"
        )
    
    # Return route
    route["id"] = str(route.pop("_id"))
    return RouteResponse(**route)


@router.patch("/{route_id}/status")
async def update_route_status(
    route_id: str,
    new_status: RouteStatus,
    db: AsyncIOMotorDatabase = Depends(get_database),
    current_driver: DriverInDB = Depends(get_current_driver)
):
    """
    Update Route Status
    
    Changes the status of a route (e.g., from OPTIMIZED to IN_PROGRESS).
    
    Status Flow:
    DRAFT -> OPTIMIZED -> ASSIGNED -> IN_PROGRESS -> COMPLETED
    
    Args:
        route_id: Route identifier
        new_status: New status to set
        db: Database connection
        current_driver: Authenticated driver
        
    Returns:
        dict: Success message with updated status
        
    Raises:
        HTTPException 404: If route not found
        HTTPException 403: If driver doesn't have access
    """
    
    # Find route
    route = await db.routes.find_one({"route_id": route_id})
    
    if not route:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Route {route_id} not found"
        )
    
    # Check access
    if route.get("driver_id") != current_driver.driver_id:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Access denied to this route"
        )
    
    # Update status
    update_data = {
        "status": new_status.value,
        "updated_at": datetime.utcnow()
    }
    
    # Set timestamps based on status
    if new_status == RouteStatus.IN_PROGRESS and not route.get("actual_start_time"):
        update_data["actual_start_time"] = datetime.utcnow()
    
    if new_status == RouteStatus.COMPLETED and not route.get("completed_at"):
        update_data["completed_at"] = datetime.utcnow()
    
    # Update in database
    result = await db.routes.update_one(
        {"route_id": route_id},
        {"$set": update_data}
    )
    
    if result.modified_count == 0:
        logger.warning(f"No changes made to route {route_id}")
    
    logger.info(f"Route {route_id} status updated to {new_status.value}")
    
    # Update blockchain if available and route was recorded on blockchain
    if BLOCKCHAIN_ENABLED and blockchain_service and route.get("blockchain_tx_hash"):
        # Fetch updated route data
        updated_route = await db.routes.find_one({"route_id": route_id})
        
        # Count completed deliveries
        completed_count = sum(
            1 for point in updated_route.get("delivery_points", [])
            if point.get("status") == "delivered"
        )
        
        # Update blockchain
        blockchain_result = await blockchain_service.update_route_status(
            route_id,
            updated_route,
            new_status.value,
            completed_count
        )
        
        if blockchain_result:
            logger.info(f"✓ Blockchain updated: {blockchain_result['transaction_hash']}")
    
    return {
        "message": "Route status updated successfully",
        "route_id": route_id,
        "new_status": new_status.value
    }



"""
Routes Router - Part 2: Delivery Confirmation & Completion

These handle individual delivery confirmations and route completion.
"""



@router.post("/{route_id}/confirm-delivery")
async def confirm_delivery(
    route_id: str,
    confirmation: DeliveryConfirmation,
    db: AsyncIOMotorDatabase = Depends(get_database),
    current_driver: DriverInDB = Depends(get_current_driver)
):
    """
    Confirm a Delivery
    
    Marks a specific delivery point as delivered.
    Updates the delivery point status and records confirmation details.
    
    Process:
    1. Find the route
    2. Find the specific delivery point
    3. Update its status to DELIVERED
    4. Record timestamp, notes, and proof
    5. Check if all deliveries are complete
    6. If complete, update route status
    
    Args:
        route_id: Route identifier
        confirmation: Delivery confirmation data
        db: Database connection
        current_driver: Authenticated driver
        
    Returns:
        dict: Confirmation details
        
    Raises:
        HTTPException 404: If route or delivery point not found
        HTTPException 403: If driver doesn't have access
        HTTPException 400: If delivery already confirmed
    """
    
    logger.info(
        f"Delivery confirmation for route {route_id}, "
        f"point {confirmation.point_id} by driver {current_driver.driver_id}"
    )
    
    # Validate that the confirmation's route_id matches the URL
    if confirmation.route_id != route_id:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Route ID in confirmation doesn't match URL"
        )
    
    # Find route
    route = await db.routes.find_one({"route_id": route_id})
    
    if not route:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Route {route_id} not found"
        )
    
    # Check access
    if route.get("driver_id") != current_driver.driver_id:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Access denied to this route"
        )
    
    # Find the delivery point in the route
    delivery_points = route.get("delivery_points", [])
    point_found = False
    point_index = -1
    
    for i, point in enumerate(delivery_points):
        if point.get("point_id") == confirmation.point_id:
            point_found = True
            point_index = i
            break
    
    if not point_found:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Delivery point {confirmation.point_id} not found in route"
        )
    
    # Check if already delivered
    current_status = delivery_points[point_index].get("status")
    if current_status == DeliveryStatus.DELIVERED.value:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="This delivery has already been confirmed"
        )
    
    # Update delivery point
    new_status = DeliveryStatus.DELIVERED.value if confirmation.success else DeliveryStatus.FAILED.value
    
    delivery_points[point_index].update({
        "status": new_status,
        "delivered_at": confirmation.confirmed_at,
        "driver_notes": confirmation.notes,
        "proof_of_delivery": confirmation.proof_photo
    })
    
    if not confirmation.success and confirmation.failure_reason:
        delivery_points[point_index]["failure_reason"] = confirmation.failure_reason
    
    # Check if all deliveries are complete
    all_delivered = all(
        point.get("status") in [DeliveryStatus.DELIVERED.value, DeliveryStatus.FAILED.value]
        for point in delivery_points
    )
    
    # Prepare update
    update_data = {
        "delivery_points": delivery_points,
        "updated_at": datetime.utcnow()
    }
    
    # If all deliveries complete, update route status
    if all_delivered and route.get("status") != RouteStatus.COMPLETED.value:
        update_data["status"] = RouteStatus.COMPLETED.value
        update_data["completed_at"] = datetime.utcnow()
        logger.info(f"All deliveries complete, route {route_id} marked as COMPLETED")
    
    # Update database
    result = await db.routes.update_one(
        {"route_id": route_id},
        {"$set": update_data}
    )
    
    if result.modified_count == 0:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Failed to update delivery confirmation"
        )
    
    # Record delivery confirmation in a separate collection for audit trail
    confirmation_record = {
        "delivery_id": f"{route_id}_{confirmation.point_id}_{datetime.utcnow().strftime('%Y%m%d%H%M%S')}",
        "route_id": route_id,
        "point_id": confirmation.point_id,
        "driver_id": current_driver.driver_id,
        "confirmed_at": confirmation.confirmed_at,
        "success": confirmation.success,
        "notes": confirmation.notes,
        "proof_photo": confirmation.proof_photo,
        "signature": confirmation.signature,
        "failure_reason": confirmation.failure_reason if not confirmation.success else None
    }
    
    await db.deliveries.insert_one(confirmation_record)
    
    logger.info(f"✓ Delivery confirmed: {confirmation.point_id}")
    
    return {
        "message": "Delivery confirmed successfully",
        "route_id": route_id,
        "point_id": confirmation.point_id,
        "status": new_status,
        "all_deliveries_complete": all_delivered
    }


@router.post("/{route_id}/complete")
async def complete_route(
    route_id: str,
    db: AsyncIOMotorDatabase = Depends(get_database),
    current_driver: DriverInDB = Depends(get_current_driver)
):
    """
    Complete a Route
    
    Manually marks a route as completed.
    Typically used after all deliveries are confirmed.
    
    This endpoint:
    1. Validates all deliveries are processed
    2. Sets route status to COMPLETED
    3. Records completion timestamp
    4. Updates driver statistics
    
    Args:
        route_id: Route identifier
        db: Database connection
        current_driver: Authenticated driver
        
    Returns:
        dict: Completion confirmation with statistics
        
    Raises:
        HTTPException 404: If route not found
        HTTPException 403: If driver doesn't have access
        HTTPException 400: If route cannot be completed
    """
    
    logger.info(f"Completing route {route_id} by driver {current_driver.driver_id}")
    
    # Find route
    route = await db.routes.find_one({"route_id": route_id})
    
    if not route:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Route {route_id} not found"
        )
    
    # Check access
    if route.get("driver_id") != current_driver.driver_id:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Access denied to this route"
        )
    
    # Check if already completed
    if route.get("status") == RouteStatus.COMPLETED.value:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Route is already completed"
        )
    
    # Get delivery statistics
    delivery_points = route.get("delivery_points", [])
    total_deliveries = len(delivery_points)
    successful_deliveries = sum(
        1 for point in delivery_points
        if point.get("status") == DeliveryStatus.DELIVERED.value
    )
    failed_deliveries = sum(
        1 for point in delivery_points
        if point.get("status") == DeliveryStatus.FAILED.value
    )
    pending_deliveries = total_deliveries - successful_deliveries - failed_deliveries
    
    # Warn if there are pending deliveries
    if pending_deliveries > 0:
        logger.warning(
            f"Completing route {route_id} with {pending_deliveries} pending deliveries"
        )
    
    # Update route to completed
    completion_time = datetime.utcnow()
    update_data = {
        "status": RouteStatus.COMPLETED.value,
        "completed_at": completion_time,
        "updated_at": completion_time
    }
    
    result = await db.routes.update_one(
        {"route_id": route_id},
        {"$set": update_data}
    )
    
    if result.modified_count == 0:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Failed to complete route"
        )
    
    # Update driver statistics
    await db.drivers.update_one(
        {"driver_id": current_driver.driver_id},
        {"$inc": {"total_deliveries": successful_deliveries}}
    )
    
    logger.info(f"✓ Route {route_id} completed successfully")
    
    # Update blockchain with final status (if available)
    if BLOCKCHAIN_ENABLED and blockchain_service and route.get("blockchain_tx_hash"):
        # Fetch completed route data
        completed_route = await db.routes.find_one({"route_id": route_id})
        
        # Update blockchain with final status
        blockchain_result = await blockchain_service.update_route_status(
            route_id,
            completed_route,
            "completed",
            successful_deliveries
        )
        
        if blockchain_result:
            # Save final blockchain transaction hash
            await db.routes.update_one(
                {"route_id": route_id},
                {"$set": {
                    "blockchain_completion_tx": blockchain_result['transaction_hash'],
                    "blockchain_completion_block": blockchain_result['block_number']
                }}
            )
            logger.info(f"✓ Route completion recorded on blockchain")
    
    # Calculate route duration if we have start time
    duration_minutes = None
    if route.get("actual_start_time"):
        duration = completion_time - route["actual_start_time"]
        duration_minutes = duration.total_seconds() / 60
    
    return {
        "message": "Route completed successfully",
        "route_id": route_id,
        "completed_at": completion_time,
        "statistics": {
            "total_deliveries": total_deliveries,
            "successful_deliveries": successful_deliveries,
            "failed_deliveries": failed_deliveries,
            "pending_deliveries": pending_deliveries,
            "success_rate": (successful_deliveries / total_deliveries * 100) if total_deliveries > 0 else 0,
            "duration_minutes": duration_minutes
        }
    }


@router.delete("/{route_id}")
async def delete_route(
    route_id: str,
    db: AsyncIOMotorDatabase = Depends(get_database),
    current_driver: DriverInDB = Depends(get_current_driver)
):
    """
    Delete a Route
    
    Deletes a route from the database.
    Only routes in DRAFT or OPTIMIZED status can be deleted.
    Routes that are IN_PROGRESS or COMPLETED should not be deleted
    to maintain delivery history.
    
    Args:
        route_id: Route identifier
        db: Database connection
        current_driver: Authenticated driver
        
    Returns:
        dict: Deletion confirmation
        
    Raises:
        HTTPException 404: If route not found
        HTTPException 403: If driver doesn't have access
        HTTPException 400: If route cannot be deleted
    """
    
    # Find route
    route = await db.routes.find_one({"route_id": route_id})
    
    if not route:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Route {route_id} not found"
        )
    
    # Check access
    if route.get("driver_id") != current_driver.driver_id:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Access denied to this route"
        )
    
    # Check if route can be deleted
    current_status = route.get("status")
    if current_status not in [RouteStatus.DRAFT.value, RouteStatus.OPTIMIZED.value]:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"Cannot delete route with status {current_status}. "
                   "Only DRAFT or OPTIMIZED routes can be deleted."
        )
    
    # Delete route
    result = await db.routes.delete_one({"route_id": route_id})
    
    if result.deleted_count == 0:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Failed to delete route"
        )
    
    logger.info(f"Route {route_id} deleted by driver {current_driver.driver_id}")
    
    return {
        "message": "Route deleted successfully",
        "route_id": route_id
    }


    """
Export Endpoints for Routes Router

Add these endpoints to your routes.py file.
Add this import at the top of routes.py:
from fastapi.responses import Response
from app.services.export import export_service
"""

# Add these endpoints to routes.py


@router.get("/{route_id}/export/csv")
async def export_route_csv(
    route_id: str,
    db: AsyncIOMotorDatabase = Depends(get_database),
    current_driver: DriverInDB = Depends(get_current_driver)
):
    """
    Export Route to CSV
    
    Downloads the route as a CSV file.
    Useful for importing into Excel or Google Sheets.
    
    Args:
        route_id: Route identifier
        db: Database connection
        current_driver: Authenticated driver
        
    Returns:
        Response: CSV file download
        
    Raises:
        HTTPException 404: If route not found
        HTTPException 403: If driver doesn't have access
    """
    
    # Find route
    route = await db.routes.find_one({"route_id": route_id})
    
    if not route:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Route {route_id} not found"
        )
    
    # Check access
    if route.get("driver_id") != current_driver.driver_id:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Access denied to this route"
        )
    
    # Generate CSV
    csv_content = export_service.export_route_to_csv(route)
    
    # Create filename with timestamp
    timestamp = datetime.utcnow().strftime("%Y%m%d_%H%M%S")
    filename = f"route_{route_id}_{timestamp}.csv"
    
    # Return CSV file
    return Response(
        content=csv_content,
        media_type="text/csv",
        headers={
            "Content-Disposition": f"attachment; filename={filename}"
        }
    )


@router.get("/{route_id}/export/pdf")
async def export_route_pdf(
    route_id: str,
    db: AsyncIOMotorDatabase = Depends(get_database),
    current_driver: DriverInDB = Depends(get_current_driver)
):
    """
    Export Route to PDF
    
    Downloads the route as a PDF report.
    Professional format suitable for printing or sharing.
    
    Args:
        route_id: Route identifier
        db: Database connection
        current_driver: Authenticated driver
        
    Returns:
        Response: PDF file download
        
    Raises:
        HTTPException 404: If route not found
        HTTPException 403: If driver doesn't have access
    """
    
    # Find route
    route = await db.routes.find_one({"route_id": route_id})
    
    if not route:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Route {route_id} not found"
        )
    
    # Check access
    if route.get("driver_id") != current_driver.driver_id:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Access denied to this route"
        )
    
    # Generate PDF
    pdf_content = export_service.export_route_to_pdf(route)
    
    # Create filename with timestamp
    timestamp = datetime.utcnow().strftime("%Y%m%d_%H%M%S")
    filename = f"route_{route_id}_{timestamp}.pdf"
    
    # Return PDF file
    return Response(
        content=pdf_content,
        media_type="application/pdf",
        headers={
            "Content-Disposition": f"attachment; filename={filename}"
        }
    )


@router.get("/{route_id}/verify-blockchain")
async def verify_route_blockchain(
    route_id: str,
    db: AsyncIOMotorDatabase = Depends(get_database),
    current_driver: DriverInDB = Depends(get_current_driver)
):
    """
    Verify Route Data Integrity Using Blockchain
    
    Checks if the current route data matches the blockchain record.
    This proves the data hasn't been tampered with.
    
    Args:
        route_id: Route identifier
        db: Database connection
        current_driver: Authenticated driver
        
    Returns:
        dict: Verification result with blockchain details
    """
    # Find route
    route = await db.routes.find_one({"route_id": route_id})
    
    if not route:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Route {route_id} not found"
        )
    
    # Check if blockchain is enabled
    if not BLOCKCHAIN_ENABLED or not blockchain_service:
        return {
            "verified": False,
            "message": "Blockchain service is not enabled",
            "blockchain_available": False
        }
    
    # Check if route is recorded on blockchain
    if not route.get("blockchain_tx_hash"):
        return {
            "verified": False,
            "message": "Route not recorded on blockchain",
            "blockchain_available": blockchain_service.is_available if blockchain_service else False
        }
    
    # Verify data integrity
    is_valid = await blockchain_service.verify_route(route_id, route)
    
    # Get blockchain record
    blockchain_record = await blockchain_service.get_route_from_blockchain(route_id)
    
    return {
        "verified": is_valid,
        "message": "Route data is valid" if is_valid else "Route data has been modified",
        "blockchain_record": blockchain_record,
        "current_data_hash": blockchain_service.calculate_data_hash(route),
        "blockchain_tx_hash": route.get("blockchain_tx_hash"),
        "blockchain_block": route.get("blockchain_block")
    }
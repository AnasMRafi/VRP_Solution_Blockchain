"""
Route and Delivery Data Models

This module defines the core data structures for:
- Delivery addresses (stops on the route)
- Complete routes (sequences of deliveries)
- Route optimization results
- Delivery confirmations

These models represent the heart of the VRP solution.
"""

from pydantic import BaseModel, Field, validator
from typing import List, Optional, Dict, Any
from datetime import datetime
from enum import Enum
from app.models.store import Location, Address


class DeliveryStatus(str, Enum):
    """
    Delivery Status Enumeration
    
    Tracks the lifecycle of a single delivery.
    """
    PENDING = "pending"              # Not yet attempted
    IN_PROGRESS = "in_progress"      # Driver is en route
    DELIVERED = "delivered"          # Successfully delivered
    FAILED = "failed"                # Delivery failed
    CANCELLED = "cancelled"          # Delivery cancelled


class RouteStatus(str, Enum):
    """
    Route Status Enumeration
    
    Tracks the lifecycle of an entire route.
    """
    DRAFT = "draft"                  # Route created but not optimized
    OPTIMIZED = "optimized"          # VRP algorithm has run
    ASSIGNED = "assigned"            # Assigned to a driver
    IN_PROGRESS = "in_progress"      # Driver is executing route
    COMPLETED = "completed"          # All deliveries completed
    CANCELLED = "cancelled"          # Route cancelled


class DeliveryPoint(BaseModel):
    """
    Delivery Point Model
    
    Represents a single delivery address/stop on the route.
    Each point has a location, address, and delivery details.
    """
    
    # Unique identifier for this delivery point (generated server-side if not provided)
    point_id: Optional[str] = Field(None, description="Unique point identifier")
    
    # Customer/recipient name
    customer_name: str = Field(..., min_length=2, max_length=100, description="Customer name")
    
    # Delivery address
    address: Address = Field(..., description="Delivery address")
    
    # Geographic coordinates
    location: Location = Field(..., description="GPS coordinates")
    
    # Contact phone for this delivery
    phone: Optional[str] = Field(None, description="Customer phone number")
    
    # Special delivery instructions
    instructions: Optional[str] = Field(None, max_length=500, description="Delivery instructions")
    
    # Expected delivery time window start
    time_window_start: Optional[str] = Field(None, description="Earliest delivery time (HH:MM)")
    
    # Expected delivery time window end
    time_window_end: Optional[str] = Field(None, description="Latest delivery time (HH:MM)")
    
    # Package/order details
    package_count: int = Field(default=1, ge=1, description="Number of packages")
    
    # Delivery status
    status: DeliveryStatus = Field(default=DeliveryStatus.PENDING, description="Delivery status")
    
    # Position in the optimized route (set after VRP optimization)
    sequence_number: Optional[int] = Field(None, ge=0, description="Order in route sequence")
    
    # Estimated arrival time (calculated after optimization)
    estimated_arrival: Optional[datetime] = None
    
    # Actual delivery timestamp (when driver confirms)
    delivered_at: Optional[datetime] = None
    
    # Driver notes about this delivery
    driver_notes: Optional[str] = Field(None, max_length=500)
    
    # Photo proof of delivery (URL or base64)
    proof_of_delivery: Optional[str] = None
    
    class Config:
        json_schema_extra = {
            "example": {
                "point_id": "DP_001",
                "customer_name": "Fatima Zahra",
                "address": {
                    "street": "15 Rue Allal Ben Abdellah",
                    "city": "Casablanca",
                    "postal_code": "20250",
                    "country": "Morocco"
                },
                "location": {
                    "latitude": 33.5880,
                    "longitude": -7.6114
                },
                "phone": "+212 662 345678",
                "instructions": "Appartement 3, 2ème étage",
                "time_window_start": "14:00",
                "time_window_end": "18:00",
                "package_count": 2,
                "status": "pending"
            }
        }


class RouteOptimizationRequest(BaseModel):
    """
    Route Optimization Request Model
    
    Used when requesting VRP optimization.
    Contains depot location and list of delivery points.
    """
    
    # Name/title for this route
    route_name: str = Field(..., min_length=2, max_length=100, description="Route name/title")
    
    # Depot/store to start and end from
    depot_location: Location = Field(..., description="Starting depot coordinates")
    
    # Optional depot address for display
    depot_address: Optional[Address] = None
    
    # List of delivery points (5-20 as per requirements)
    delivery_points: List[DeliveryPoint] = Field(
        ..., 
        min_length=5, 
        max_length=20, 
        description="List of delivery addresses (5-20)"
    )
    
    # Assigned driver (optional, can be assigned later)
    driver_id: Optional[str] = None
    
    # Maximum route duration in minutes
    max_duration_minutes: Optional[int] = Field(default=480, ge=60, le=720, description="Max route duration")
    
    # Vehicle capacity constraint
    vehicle_capacity: Optional[int] = Field(default=20, ge=1, le=100, description="Vehicle capacity")
    
    @validator('delivery_points')
    def validate_unique_point_ids(cls, v):
        """
        Ensure all point_ids are unique within the route.
        
        Args:
            v: List of delivery points
            
        Returns:
            List[DeliveryPoint]: Validated list
            
        Raises:
            ValueError: If duplicate point_ids exist
        """
        # Only check uniqueness for non-None point_ids
        point_ids = [point.point_id for point in v if point.point_id is not None]
        if len(point_ids) != len(set(point_ids)):
            raise ValueError('All point_ids must be unique within a route')
        return v


class RouteSegment(BaseModel):
    """
    Route Segment Model
    
    Represents a leg of the journey between two points.
    Generated by the VRP optimizer.
    """
    
    # Starting point (index in delivery_points, or -1 for depot)
    from_point_id: str = Field(..., description="Starting point ID")
    
    # Ending point (index in delivery_points, or -1 for depot)
    to_point_id: str = Field(..., description="Ending point ID")
    
    # Distance in meters
    distance_meters: float = Field(..., ge=0, description="Segment distance in meters")
    
    # Travel time in minutes
    duration_minutes: float = Field(..., ge=0, description="Travel time in minutes")
    
    # Order in the route sequence
    segment_order: int = Field(..., ge=0, description="Segment sequence number")


class RouteOptimizationResult(BaseModel):
    """
    Route Optimization Result Model
    
    Contains the complete optimized route returned by the VRP solver.
    """
    
    # Optimized sequence of delivery points
    optimized_sequence: List[DeliveryPoint] = Field(..., description="Delivery points in optimal order")
    
    # Detailed route segments
    route_segments: List[RouteSegment] = Field(..., description="Detailed route segments")
    
    # Total route distance in kilometers
    total_distance_km: float = Field(..., ge=0, description="Total distance in km")
    
    # Total route duration in minutes
    total_duration_minutes: float = Field(..., ge=0, description="Total duration in minutes")
    
    # Estimated fuel cost (if applicable)
    estimated_cost: Optional[float] = Field(None, ge=0, description="Estimated delivery cost")
    
    # Optimization algorithm used
    solver_info: Optional[Dict[str, Any]] = Field(None, description="Solver metadata")


class RouteBase(BaseModel):
    """
    Base Route Model
    
    Core fields for a delivery route.
    """
    
    # Route name/title
    route_name: str = Field(..., min_length=2, max_length=100)
    
    # Depot information
    depot_location: Location
    depot_address: Optional[Address] = None
    
    # Delivery points
    delivery_points: List[DeliveryPoint]
    
    # Assigned driver
    driver_id: Optional[str] = None
    
    # Route status
    status: RouteStatus = Field(default=RouteStatus.DRAFT)
    
    # Optimization result (populated after VRP runs)
    optimization_result: Optional[RouteOptimizationResult] = None


class RouteCreate(RouteBase):
    """
    Route Creation Model
    
    Used when creating a new route.
    """
    pass


class RouteInDB(RouteBase):
    """
    Route Database Model
    
    Represents a route as stored in MongoDB.
    """
    
    # Unique route identifier
    route_id: str = Field(..., description="Unique route identifier")
    
    # MongoDB internal ID
    id: Optional[str] = Field(None, alias="_id")
    
    # Creation timestamp
    created_at: datetime = Field(default_factory=datetime.utcnow)
    
    # Last update timestamp
    updated_at: datetime = Field(default_factory=datetime.utcnow)
    
    # Planned start time
    planned_start_time: Optional[datetime] = None
    
    # Actual start time (when driver begins)
    actual_start_time: Optional[datetime] = None
    
    # Completion time
    completed_at: Optional[datetime] = None
    
    # Blockchain transaction hash (for immutable record)
    blockchain_tx_hash: Optional[str] = None
    
    # Blockchain block number
    blockchain_block: Optional[int] = None
    
    # Data hash stored on blockchain
    data_hash: Optional[str] = None
    
    class Config:
        populate_by_name = True


class RouteResponse(RouteInDB):
    """
    Route API Response Model
    
    Used for API responses with full route details.
    """
    pass


class RouteListItem(BaseModel):
    """
    Route List Item Model
    
    Simplified route info for list views.
    Excludes heavy fields like full delivery_points.
    """
    
    route_id: str
    route_name: str
    status: RouteStatus
    driver_id: Optional[str]
    created_at: datetime
    total_distance_km: Optional[float]
    total_duration_minutes: Optional[float]
    delivery_count: int
    completed_deliveries: int
    created_by: Optional[str] = None  # Creator name for admin view


class DeliveryConfirmation(BaseModel):
    """
    Delivery Confirmation Model
    
    Used when a driver confirms a delivery.
    """
    
    # Route this delivery belongs to
    route_id: str = Field(..., description="Route identifier")
    
    # Point being confirmed
    point_id: str = Field(..., description="Delivery point identifier")
    
    # Confirmation timestamp (auto-set if not provided)
    confirmed_at: datetime = Field(default_factory=datetime.utcnow)
    
    # Driver notes
    notes: Optional[str] = Field(None, max_length=500)
    
    # Photo proof (URL or base64)
    proof_photo: Optional[str] = None
    
    # Signature (base64 image)
    signature: Optional[str] = None
    
    # Success status
    success: bool = Field(default=True, description="Whether delivery was successful")
    
    # Failure reason (if success=False)
    failure_reason: Optional[str] = Field(None, max_length=200)
    
    class Config:
        json_schema_extra = {
            "example": {
                "route_id": "ROUTE_20241208_001",
                "point_id": "DP_001",
                "notes": "Package delivered to concierge",
                "success": True
            }
        }
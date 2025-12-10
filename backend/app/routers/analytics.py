"""
Analytics Router

Provides reporting and analytics endpoints for route performance.
"""

from fastapi import APIRouter, Depends, Query
from motor.motor_asyncio import AsyncIOMotorDatabase
from datetime import datetime, timedelta
from typing import Optional
import logging

from app.models.driver import DriverInDB
from app.services.database import get_database
from app.routers.auth import get_current_driver

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/analytics", tags=["Analytics"])


@router.get("/summary")
async def get_analytics_summary(
    days: int = Query(30, ge=1, le=365, description="Number of days to analyze"),
    db: AsyncIOMotorDatabase = Depends(get_database),
    current_driver: DriverInDB = Depends(get_current_driver)
):
    """
    Get overall analytics summary
    """
    start_date = datetime.utcnow() - timedelta(days=days)
    
    # Get all routes in date range
    routes = await db.routes.find({
        "driver_id": current_driver.driver_id,
        "created_at": {"$gte": start_date}
    }).to_list(length=1000)
    
    # Calculate stats
    total_routes = len(routes)
    completed_routes = len([r for r in routes if r.get("status") == "completed"])
    cancelled_routes = len([r for r in routes if r.get("status") == "cancelled"])
    in_progress_routes = len([r for r in routes if r.get("status") == "in_progress"])
    
    # Count deliveries from delivery_points array
    total_deliveries = 0
    completed_deliveries = 0
    total_distance = 0
    total_duration = 0
    
    for route in routes:
        delivery_points = route.get("delivery_points", [])
        total_deliveries += len(delivery_points)
        
        # Count completed deliveries (status = 'delivered')
        completed_deliveries += len([
            d for d in delivery_points 
            if d.get("status") == "delivered"
        ])
        
        # Get distance and duration from optimization_result
        opt_result = route.get("optimization_result") or {}
        total_distance += opt_result.get("total_distance_km", 0) or 0
        total_duration += opt_result.get("total_duration_minutes", 0) or 0
    
    # Success rate
    success_rate = (completed_deliveries / total_deliveries * 100) if total_deliveries > 0 else 0
    
    # Average per route
    avg_deliveries_per_route = total_deliveries / total_routes if total_routes > 0 else 0
    avg_distance_per_route = total_distance / total_routes if total_routes > 0 else 0
    
    return {
        "period_days": days,
        "start_date": start_date.isoformat(),
        "end_date": datetime.utcnow().isoformat(),
        "routes": {
            "total": total_routes,
            "completed": completed_routes,
            "cancelled": cancelled_routes,
            "in_progress": in_progress_routes,
            "completion_rate": round(completed_routes / total_routes * 100, 1) if total_routes > 0 else 0
        },
        "deliveries": {
            "total": total_deliveries,
            "completed": completed_deliveries,
            "failed": total_deliveries - completed_deliveries,
            "success_rate": round(success_rate, 1)
        },
        "distance": {
            "total_km": round(total_distance, 1),
            "average_per_route_km": round(avg_distance_per_route, 1)
        },
        "time": {
            "total_minutes": round(total_duration, 0),
            "total_hours": round(total_duration / 60, 1)
        },
        "averages": {
            "deliveries_per_route": round(avg_deliveries_per_route, 1),
            "distance_per_route_km": round(avg_distance_per_route, 1)
        }
    }


@router.get("/routes-by-status")
async def get_routes_by_status(
    days: int = Query(30, ge=1, le=365),
    db: AsyncIOMotorDatabase = Depends(get_database),
    current_driver: DriverInDB = Depends(get_current_driver)
):
    """
    Get route counts by status for charts
    """
    start_date = datetime.utcnow() - timedelta(days=days)
    
    pipeline = [
        {
            "$match": {
                "driver_id": current_driver.driver_id,
                "created_at": {"$gte": start_date}
            }
        },
        {
            "$group": {
                "_id": "$status",
                "count": {"$sum": 1}
            }
        }
    ]
    
    cursor = db.routes.aggregate(pipeline)
    results = await cursor.to_list(length=100)
    
    # Format for charts
    status_counts = {r["_id"]: r["count"] for r in results}
    
    return {
        "period_days": days,
        "data": [
            {"status": "completed", "count": status_counts.get("completed", 0), "color": "#22c55e"},
            {"status": "in_progress", "count": status_counts.get("in_progress", 0), "color": "#f59e0b"},
            {"status": "optimized", "count": status_counts.get("optimized", 0), "color": "#3b82f6"},
            {"status": "cancelled", "count": status_counts.get("cancelled", 0), "color": "#ef4444"},
            {"status": "pending", "count": status_counts.get("pending", 0), "color": "#6b7280"}
        ]
    }


@router.get("/routes-over-time")
async def get_routes_over_time(
    days: int = Query(30, ge=7, le=365),
    db: AsyncIOMotorDatabase = Depends(get_database),
    current_driver: DriverInDB = Depends(get_current_driver)
):
    """
    Get routes created over time for line charts
    """
    start_date = datetime.utcnow() - timedelta(days=days)
    
    pipeline = [
        {
            "$match": {
                "driver_id": current_driver.driver_id,
                "created_at": {"$gte": start_date}
            }
        },
        {
            "$group": {
                "_id": {
                    "$dateToString": {
                        "format": "%Y-%m-%d",
                        "date": "$created_at"
                    }
                },
                "routes_created": {"$sum": 1},
                "total_deliveries": {"$sum": "$delivery_count"},
                "completed_deliveries": {"$sum": "$completed_deliveries"}
            }
        },
        {"$sort": {"_id": 1}}
    ]
    
    cursor = db.routes.aggregate(pipeline)
    results = await cursor.to_list(length=365)
    
    return {
        "period_days": days,
        "data": [
            {
                "date": r["_id"],
                "routes": r["routes_created"],
                "deliveries": r["total_deliveries"],
                "completed": r["completed_deliveries"]
            }
            for r in results
        ]
    }


@router.get("/top-customers")
async def get_top_customers(
    limit: int = Query(10, ge=1, le=50),
    db: AsyncIOMotorDatabase = Depends(get_database),
    current_driver: DriverInDB = Depends(get_current_driver)
):
    """
    Get top customers by delivery count
    """
    cursor = db.customers.find({
        "driver_id": current_driver.driver_id
    }).sort("delivery_count", -1).limit(limit)
    
    customers = await cursor.to_list(length=limit)
    
    return {
        "top_customers": [
            {
                "customer_id": c["customer_id"],
                "name": c["name"],
                "company": c.get("company"),
                "delivery_count": c.get("delivery_count", 0),
                "last_delivery": c.get("last_delivery")
            }
            for c in customers
        ]
    }


@router.get("/performance-metrics")
async def get_performance_metrics(
    db: AsyncIOMotorDatabase = Depends(get_database),
    current_driver: DriverInDB = Depends(get_current_driver)
):
    """
    Get performance metrics and trends
    """
    now = datetime.utcnow()
    
    # This week vs last week
    this_week_start = now - timedelta(days=7)
    last_week_start = now - timedelta(days=14)
    
    # Get routes for both periods
    this_week_routes = await db.routes.find({
        "driver_id": current_driver.driver_id,
        "created_at": {"$gte": this_week_start}
    }).to_list(length=1000)
    
    last_week_routes = await db.routes.find({
        "driver_id": current_driver.driver_id,
        "created_at": {"$gte": last_week_start, "$lt": this_week_start}
    }).to_list(length=1000)
    
    # Calculate metrics
    def calc_metrics(routes):
        total = len(routes)
        completed = len([r for r in routes if r.get("status") == "completed"])
        
        deliveries = 0
        distance = 0
        for route in routes:
            delivery_points = route.get("delivery_points", [])
            deliveries += len([d for d in delivery_points if d.get("status") == "delivered"])
            opt_result = route.get("optimization_result") or {}
            distance += opt_result.get("total_distance_km", 0) or 0
        
        return {
            "routes": total,
            "completed": completed,
            "deliveries": deliveries,
            "distance": round(distance, 1)
        }
    
    this_week = calc_metrics(this_week_routes)
    last_week = calc_metrics(last_week_routes)
    
    # Calculate trends (percentage change)
    def calc_trend(current, previous):
        if previous == 0:
            return 100 if current > 0 else 0
        return round((current - previous) / previous * 100, 1)
    
    return {
        "this_week": this_week,
        "last_week": last_week,
        "trends": {
            "routes": calc_trend(this_week["routes"], last_week["routes"]),
            "completed": calc_trend(this_week["completed"], last_week["completed"]),
            "deliveries": calc_trend(this_week["deliveries"], last_week["deliveries"]),
            "distance": calc_trend(this_week["distance"], last_week["distance"])
        }
    }

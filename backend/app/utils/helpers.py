"""
Helper Utilities

This module contains various helper functions used throughout the application.
These are small utility functions that don't fit into a specific service.
"""

import hashlib
import json
from typing import Dict, Any, List
from datetime import datetime, timedelta
import re
import logging

logger = logging.getLogger(__name__)


def calculate_data_hash(data: Dict[str, Any]) -> str:
    """
    Calculate SHA-256 Hash of Data
    
    Creates a cryptographic hash of dictionary data.
    This is used for blockchain integrity verification.
    
    The hash is deterministic - same data always produces same hash.
    
    Args:
        data: Dictionary to hash
        
    Returns:
        str: Hexadecimal hash string (64 characters)
        
    Example:
        route_hash = calculate_data_hash({
            "route_id": "ROUTE_001",
            "deliveries": [...],
            "timestamp": "2024-12-08T14:30:00"
        })
        # Store hash on blockchain
    """
    # Sort keys for consistent hashing
    # json.dumps with sort_keys=True ensures same dict order
    json_str = json.dumps(data, sort_keys=True, default=str)
    
    # Calculate SHA-256 hash
    hash_obj = hashlib.sha256(json_str.encode('utf-8'))
    
    return hash_obj.hexdigest()


def format_distance(meters: float) -> str:
    """
    Format Distance for Display
    
    Converts meters to human-readable format.
    - Less than 1000m: show in meters
    - 1000m or more: show in kilometers
    
    Args:
        meters: Distance in meters
        
    Returns:
        str: Formatted distance string
        
    Example:
        format_distance(500)    # "500 m"
        format_distance(1500)   # "1.5 km"
        format_distance(15750)  # "15.8 km"
    """
    if meters < 1000:
        return f"{int(meters)} m"
    else:
        km = meters / 1000
        return f"{km:.1f} km"


def format_duration(seconds: float) -> str:
    """
    Format Duration for Display
    
    Converts seconds to human-readable time format.
    - Less than 60s: show seconds
    - Less than 3600s: show minutes
    - 3600s or more: show hours and minutes
    
    Args:
        seconds: Duration in seconds
        
    Returns:
        str: Formatted duration string
        
    Example:
        format_duration(45)     # "45 sec"
        format_duration(150)    # "2.5 min"
        format_duration(3800)   # "1h 3min"
    """
    if seconds < 60:
        return f"{int(seconds)} sec"
    elif seconds < 3600:
        minutes = seconds / 60
        return f"{minutes:.1f} min"
    else:
        hours = int(seconds // 3600)
        minutes = int((seconds % 3600) // 60)
        return f"{hours}h {minutes}min"


def validate_moroccan_phone(phone: str) -> bool:
    """
    Validate Moroccan Phone Number
    
    Checks if a phone number matches Moroccan format.
    Moroccan mobile numbers: +212 6XX XXX XXX or 06XX XXX XXX
    Moroccan landline: +212 5XX XXX XXX or 05XX XXX XXX
    
    Args:
        phone: Phone number string
        
    Returns:
        bool: True if valid Moroccan phone
        
    Example:
        validate_moroccan_phone("+212 661 234567")  # True
        validate_moroccan_phone("0661234567")       # True
        validate_moroccan_phone("123")              # False
    """
    # Remove spaces and dashes
    clean_phone = re.sub(r'[\s\-]', '', phone)
    
    # Pattern for Moroccan numbers
    # Either: +212XXXXXXXXX or 0XXXXXXXXX
    patterns = [
        r'^\+212[5-7]\d{8}$',  # +212 format
        r'^0[5-7]\d{8}$'        # 0 prefix format
    ]
    
    return any(re.match(pattern, clean_phone) for pattern in patterns)


def calculate_estimated_arrival_times(
    start_time: datetime,
    duration_matrix: List[List[float]],
    route_sequence: List[int]
) -> List[datetime]:
    """
    Calculate Estimated Arrival Times
    
    Given a route sequence and travel times, calculates when
    the driver will arrive at each delivery point.
    
    Args:
        start_time: Route start time
        duration_matrix: Matrix of travel times in seconds
        route_sequence: Sequence of location indices
        
    Returns:
        List[datetime]: Estimated arrival time for each point
        
    Example:
        arrivals = calculate_estimated_arrival_times(
            datetime(2024, 12, 8, 8, 0),  # Start at 8 AM
            duration_matrix,
            [0, 2, 1, 3, 0]  # Depot -> Point 2 -> Point 1 -> Point 3 -> Depot
        )
    """
    arrival_times = []
    current_time = start_time
    
    # Calculate arrival time at each point
    for i in range(1, len(route_sequence)):
        from_index = route_sequence[i - 1]
        to_index = route_sequence[i]
        
        # Add travel time
        travel_seconds = duration_matrix[from_index][to_index]
        current_time += timedelta(seconds=travel_seconds)
        
        # Skip depot (typically index 0)
        if to_index != 0:
            arrival_times.append(current_time)
        
        # Add 5 minutes service time at each delivery
        if to_index != 0:
            current_time += timedelta(minutes=5)
    
    return arrival_times


def is_within_time_window(
    arrival_time: datetime,
    window_start: str,
    window_end: str
) -> bool:
    """
    Check if Arrival is Within Time Window
    
    Validates if an estimated arrival time falls within
    a customer's requested delivery window.
    
    Args:
        arrival_time: Estimated arrival datetime
        window_start: Time window start (HH:MM format)
        window_end: Time window end (HH:MM format)
        
    Returns:
        bool: True if within window
        
    Example:
        is_within = is_within_time_window(
            datetime(2024, 12, 8, 14, 30),
            "14:00",
            "18:00"
        )  # Returns True
    """
    try:
        # Parse time window
        start_hour, start_min = map(int, window_start.split(':'))
        end_hour, end_min = map(int, window_end.split(':'))
        
        # Create datetime objects for comparison
        window_start_dt = arrival_time.replace(
            hour=start_hour,
            minute=start_min,
            second=0,
            microsecond=0
        )
        window_end_dt = arrival_time.replace(
            hour=end_hour,
            minute=end_min,
            second=0,
            microsecond=0
        )
        
        # Check if arrival is within window
        return window_start_dt <= arrival_time <= window_end_dt
        
    except ValueError:
        logger.error(f"Invalid time window format: {window_start} - {window_end}")
        return False


def sanitize_filename(filename: str) -> str:
    """
    Sanitize Filename
    
    Removes or replaces characters that are invalid in filenames.
    
    Args:
        filename: Original filename
        
    Returns:
        str: Sanitized filename safe for all operating systems
        
    Example:
        sanitize_filename("Route/Plan:2024")  # "Route_Plan_2024"
    """
    # Replace problematic characters with underscores
    sanitized = re.sub(r'[<>:"/\\|?*]', '_', filename)
    
    # Remove leading/trailing spaces and dots
    sanitized = sanitized.strip(' .')
    
    # Limit length (most filesystems have 255 char limit)
    if len(sanitized) > 200:
        sanitized = sanitized[:200]
    
    return sanitized


def parse_coordinates(coord_string: str) -> tuple:
    """
    Parse Coordinate String
    
    Extracts latitude and longitude from various string formats.
    
    Args:
        coord_string: Coordinates as string (e.g., "33.5731, -7.5898")
        
    Returns:
        tuple: (latitude, longitude) as floats
        
    Raises:
        ValueError: If string cannot be parsed
        
    Example:
        lat, lon = parse_coordinates("33.5731, -7.5898")
    """
    # Remove common prefixes
    coord_string = coord_string.replace('lat:', '').replace('lon:', '').replace('lng:', '')
    
    # Try to parse comma-separated values
    try:
        parts = [p.strip() for p in coord_string.split(',')]
        if len(parts) != 2:
            raise ValueError("Expected 2 comma-separated values")
        
        lat = float(parts[0])
        lon = float(parts[1])
        
        # Validate ranges
        if not (-90 <= lat <= 90):
            raise ValueError(f"Latitude {lat} out of range [-90, 90]")
        if not (-180 <= lon <= 180):
            raise ValueError(f"Longitude {lon} out of range [-180, 180]")
        
        return lat, lon
        
    except (ValueError, IndexError) as e:
        raise ValueError(f"Invalid coordinate format: {coord_string}. Error: {e}")


def calculate_route_summary_stats(route: Dict[str, Any]) -> Dict[str, Any]:
    """
    Calculate Route Summary Statistics
    
    Computes various statistics about a route for reporting.
    
    Args:
        route: Route dictionary
        
    Returns:
        Dict: Summary statistics
        
    Example:
        stats = calculate_route_summary_stats(route)
        print(f"Success rate: {stats['success_rate']}%")
    """
    delivery_points = route.get('delivery_points', [])
    
    total_deliveries = len(delivery_points)
    successful = sum(1 for p in delivery_points if p.get('status') == 'delivered')
    failed = sum(1 for p in delivery_points if p.get('status') == 'failed')
    pending = total_deliveries - successful - failed
    
    opt_result = route.get('optimization_result', {})
    
    stats = {
        'total_deliveries': total_deliveries,
        'successful_deliveries': successful,
        'failed_deliveries': failed,
        'pending_deliveries': pending,
        'success_rate': round((successful / total_deliveries * 100) if total_deliveries > 0 else 0, 1),
        'total_distance_km': opt_result.get('total_distance_km', 0),
        'total_duration_minutes': opt_result.get('total_duration_minutes', 0),
        'total_packages': sum(p.get('package_count', 1) for p in delivery_points)
    }
    
    # Calculate actual duration if route is completed
    if route.get('actual_start_time') and route.get('completed_at'):
        duration = route['completed_at'] - route['actual_start_time']
        stats['actual_duration_minutes'] = round(duration.total_seconds() / 60, 1)
    
    return stats
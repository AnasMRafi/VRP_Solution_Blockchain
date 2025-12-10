"""
Distance Matrix Service

This module handles all distance and duration calculations using
the OpenRouteService API. It's crucial for VRP optimization.

OpenRouteService provides:
- Real road distances (not straight-line)
- Realistic travel times considering road types
- Free tier: 2000 requests/day (sufficient for small operations)

Get your free API key: https://openrouteservice.org/dev/#/signup
"""

import httpx
import logging
from typing import List, Tuple, Dict, Optional
from app.config import settings
from app.models.store import Location

logger = logging.getLogger(__name__)


class DistanceMatrixService:
    """
    OpenRouteService Distance Matrix Service
    
    This service calculates distances and travel times between multiple locations.
    The distance matrix is essential for VRP optimization - it tells the solver
    how far apart each delivery point is.
    
    Example Distance Matrix:
    If we have locations [Depot, A, B, C], the matrix looks like:
    
           Depot   A      B      C
    Depot  0       5km    8km    12km
    A      5km     0      3km    10km
    B      8km     3km    0      7km
    C      12km    10km   7km    0
    """
    
    def __init__(self):
        """
        Initialize the Distance Matrix Service
        
        Sets up the HTTP client and API configuration.
        """
        self.api_key = settings.OPENROUTESERVICE_API_KEY
        self.base_url = "https://api.openrouteservice.org/v2/matrix/driving-car"
        
        # Create an async HTTP client
        # timeout=30 prevents hanging on slow API responses
        self.client = httpx.AsyncClient(timeout=30.0)
        
        # Validate API key
        if not self.api_key or self.api_key == "your_openrouteservice_api_key_here":
            logger.warning(
                "⚠ OpenRouteService API key not configured! "
                "Distance calculations will fail. "
                "Get your free API key at: https://openrouteservice.org/dev/#/signup"
            )
    
    async def calculate_distance_matrix(
        self,
        locations: List[Location]
    ) -> Tuple[List[List[float]], List[List[float]]]:
        """
        Calculate Distance and Duration Matrices
        
        Given a list of locations, this method returns:
        1. Distance matrix (in meters)
        2. Duration matrix (in seconds)
        
        The matrices are NxN where N is the number of locations.
        matrix[i][j] = distance/time from location i to location j
        
        Args:
            locations: List of Location objects (GPS coordinates)
            
        Returns:
            Tuple containing:
            - distance_matrix: List[List[float]] - distances in meters
            - duration_matrix: List[List[float]] - durations in seconds
            
        Raises:
            httpx.HTTPError: If API request fails
            ValueError: If API returns invalid data
            
        Example:
            locations = [depot_location, point1_location, point2_location]
            distances, durations = await service.calculate_distance_matrix(locations)
            # distances[0][1] = meters from depot to point1
            # durations[0][1] = seconds from depot to point1
        """
        
        # Validate input
        if not locations or len(locations) < 2:
            raise ValueError("Need at least 2 locations to calculate distance matrix")
        
        if len(locations) > 50:
            # OpenRouteService free tier limit
            raise ValueError("Maximum 50 locations per request")
        
        try:
            # Prepare locations in OpenRouteService format
            # Format: [[longitude, latitude], [longitude, latitude], ...]
            # IMPORTANT: OpenRouteService uses [lon, lat] order, not [lat, lon]!
            coordinates = [
                [loc.longitude, loc.latitude]
                for loc in locations
            ]
            
            # Prepare API request
            headers = {
                "Authorization": self.api_key,
                "Content-Type": "application/json",
                "Accept": "application/json"
            }
            
            payload = {
                "locations": coordinates,
                "metrics": ["distance", "duration"],  # Request both metrics
                "units": "m"  # Meters for distance
            }
            
            logger.info(f"Requesting distance matrix for {len(locations)} locations...")
            
            # Make API request
            response = await self.client.post(
                self.base_url,
                headers=headers,
                json=payload
            )
            
            # Check for errors
            response.raise_for_status()
            
            # Parse response
            data = response.json()
            
            # Extract matrices
            distance_matrix = data.get("distances", [])
            duration_matrix = data.get("durations", [])
            
            # Validate response
            if not distance_matrix or not duration_matrix:
                raise ValueError("Invalid response from OpenRouteService: missing matrices")
            
            if len(distance_matrix) != len(locations):
                raise ValueError(
                    f"Distance matrix size mismatch: expected {len(locations)}, "
                    f"got {len(distance_matrix)}"
                )
            
            logger.info("✓ Distance matrix calculated successfully")
            
            # Log some statistics for debugging
            total_distance = sum(sum(row) for row in distance_matrix) / 1000  # km
            logger.debug(f"Total distance in matrix: {total_distance:.2f} km")
            
            return distance_matrix, duration_matrix
            
        except httpx.HTTPStatusError as e:
            # Handle HTTP errors (4xx, 5xx)
            logger.error(f"OpenRouteService API error: {e.response.status_code}")
            logger.error(f"Response: {e.response.text}")
            
            if e.response.status_code == 401:
                raise ValueError(
                    "Invalid OpenRouteService API key. "
                    "Please check your OPENROUTESERVICE_API_KEY in .env"
                )
            elif e.response.status_code == 403:
                raise ValueError(
                    "OpenRouteService API key quota exceeded or forbidden. "
                    "Check your account limits."
                )
            elif e.response.status_code == 429:
                raise ValueError(
                    "OpenRouteService rate limit exceeded. "
                    "Please wait before making more requests."
                )
            else:
                raise ValueError(f"OpenRouteService API error: {e.response.text}")
                
        except httpx.RequestError as e:
            # Handle connection errors
            logger.error(f"Failed to connect to OpenRouteService: {e}")
            raise ValueError(
                f"Could not connect to OpenRouteService. "
                f"Check your internet connection. Error: {e}"
            )
        
        except Exception as e:
            # Handle unexpected errors
            logger.error(f"Unexpected error in distance calculation: {e}")
            raise ValueError(f"Distance calculation failed: {e}")
    
    async def calculate_single_distance(
        self,
        origin: Location,
        destination: Location
    ) -> Tuple[float, float]:
        """
        Calculate Distance Between Two Points
        
        Convenience method for calculating distance between just two locations.
        Uses the matrix API but only requests 2x2 matrix.
        
        Args:
            origin: Starting location
            destination: Ending location
            
        Returns:
            Tuple of (distance_meters, duration_seconds)
            
        Example:
            distance, duration = await service.calculate_single_distance(
                depot_location,
                delivery_location
            )
            print(f"Distance: {distance/1000:.2f} km")
            print(f"Duration: {duration/60:.2f} minutes")
        """
        distance_matrix, duration_matrix = await self.calculate_distance_matrix(
            [origin, destination]
        )
        
        # Extract the distance and duration from origin (0) to destination (1)
        distance = distance_matrix[0][1]
        duration = duration_matrix[0][1]
        
        return distance, duration
    
    async def get_route_geometry(
        self,
        locations: List[Location]
    ) -> Optional[Dict]:
        """
        Get Route Geometry for Map Visualization
        
        This method gets the actual route path (polyline) for drawing on a map.
        Uses the OpenRouteService Directions API.
        
        Args:
            locations: Ordered list of locations (depot, stop1, stop2, ..., depot)
            
        Returns:
            Dict containing route geometry and metadata, or None if error
            
        Example:
            geometry = await service.get_route_geometry(ordered_locations)
            # Use geometry to draw route on Leaflet map
        """
        
        if not locations or len(locations) < 2:
            return None
        
        try:
            # Prepare coordinates
            coordinates = [
                [loc.longitude, loc.latitude]
                for loc in locations
            ]
            
            # Use directions API for route geometry
            directions_url = "https://api.openrouteservice.org/v2/directions/driving-car/geojson"
            
            headers = {
                "Authorization": self.api_key,
                "Content-Type": "application/json"
            }
            
            payload = {
                "coordinates": coordinates,
                "preference": "fastest",  # Optimize for time
                "geometry": "true",  # Include route geometry
                "instructions": "false"  # We don't need turn-by-turn directions
            }
            
            response = await self.client.post(
                directions_url,
                headers=headers,
                json=payload
            )
            
            response.raise_for_status()
            
            return response.json()
            
        except Exception as e:
            logger.error(f"Failed to get route geometry: {e}")
            return None
    
    async def close(self):
        """
        Close the HTTP Client
        
        Call this when shutting down the application to properly
        close all HTTP connections.
        """
        await self.client.aclose()
        logger.info("Distance service HTTP client closed")


# Create a global instance
distance_service = DistanceMatrixService()
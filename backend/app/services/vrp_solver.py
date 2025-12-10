"""
VRP Solver Service using Google OR-Tools

This is the core optimization engine of RouteChain.
It solves the Vehicle Routing Problem (VRP) to find the optimal
delivery sequence that minimizes total distance/time.

The VRP is an NP-hard problem, meaning it's computationally expensive
to find the perfect solution. OR-Tools uses sophisticated algorithms
(like simulated annealing and tabu search) to find near-optimal solutions quickly.

Key Concepts:
- Depot: Starting/ending point (our warehouse)
- Nodes: Delivery locations
- Distance Matrix: Travel costs between all pairs of nodes
- Objective: Minimize total route distance/time
"""

from ortools.constraint_solver import routing_enums_pb2
from ortools.constraint_solver import pywrapcp
from typing import List, Dict, Tuple, Optional
import logging
from datetime import datetime, timedelta

from app.models.route import (
    DeliveryPoint,
    RouteOptimizationResult,
    RouteSegment
)
from app.models.store import Location

logger = logging.getLogger(__name__)


class VRPSolver:
    """
    Vehicle Routing Problem Solver
    
    This class encapsulates all VRP optimization logic using Google OR-Tools.
    It transforms our delivery problem into OR-Tools format, runs optimization,
    and transforms the solution back into our data models.
    """
    
    def __init__(self):
        """
        Initialize VRP Solver
        
        Sets default parameters for the optimization algorithm.
        These can be tuned for better performance or solution quality.
        """
        # Maximum time to spend searching for solution (in seconds)
        # Higher = better solutions but slower
        self.time_limit_seconds = 30
        
        # Solution strategy
        # PATH_CHEAPEST_ARC: Greedy approach, fast but may miss global optimum
        # Other options: GLOBAL_CHEAPEST_ARC, LOCAL_CHEAPEST_ARC
        self.first_solution_strategy = routing_enums_pb2.FirstSolutionStrategy.PATH_CHEAPEST_ARC
        
        # Local search metaheuristic
        # GUIDED_LOCAL_SEARCH: Good balance of quality and speed
        # Other options: SIMULATED_ANNEALING, TABU_SEARCH
        self.local_search_metaheuristic = routing_enums_pb2.LocalSearchMetaheuristic.GUIDED_LOCAL_SEARCH
    
    def solve_vrp(
        self,
        depot_location: Location,
        delivery_points: List[DeliveryPoint],
        distance_matrix: List[List[float]],
        duration_matrix: List[List[float]],
        vehicle_capacity: int = 20,
        max_duration_minutes: int = 480
    ) -> RouteOptimizationResult:
        """
        Solve the Vehicle Routing Problem
        
        This is the main entry point for route optimization.
        
        The algorithm works as follows:
        1. Create a routing model with depot and delivery points
        2. Define the distance dimension (what we're minimizing)
        3. Add constraints (capacity, time windows, etc.)
        4. Run the solver to find optimal solution
        5. Extract and format the solution
        
        Args:
            depot_location: Starting/ending depot coordinates
            delivery_points: List of delivery addresses to visit
            distance_matrix: NxN matrix of distances (meters) between all points
            duration_matrix: NxN matrix of travel times (seconds) between all points
            vehicle_capacity: Maximum packages the vehicle can carry
            max_duration_minutes: Maximum route duration allowed
            
        Returns:
            RouteOptimizationResult: Complete optimization result with ordered route
            
        Raises:
            ValueError: If no solution can be found
        """
        
        logger.info(f"Starting VRP optimization for {len(delivery_points)} delivery points")
        
        # Validate inputs
        num_locations = len(delivery_points) + 1  # +1 for depot
        if len(distance_matrix) != num_locations:
            raise ValueError(
                f"Distance matrix size ({len(distance_matrix)}) doesn't match "
                f"number of locations ({num_locations})"
            )
        
        # Step 1: Create the routing index manager
        # This manages the mapping between locations and internal node indices
        # Parameters:
        # - num_locations: Total number of locations (depot + delivery points)
        # - 1: Number of vehicles (we're optimizing for a single vehicle)
        # - 0: Index of the depot (always 0 in our setup)
        manager = pywrapcp.RoutingIndexManager(
            num_locations,  # Total nodes
            1,              # Number of vehicles
            0               # Depot index
        )
        
        # Step 2: Create the routing model
        # This is the core OR-Tools object that holds the problem definition
        routing = pywrapcp.RoutingModel(manager)
        
        # Step 3: Define the distance callback
        # This function tells OR-Tools the "cost" of traveling between any two nodes
        def distance_callback(from_index: int, to_index: int) -> int:
            """
            Distance Callback Function
            
            OR-Tools calls this function to get the distance between nodes.
            We convert from our distance matrix to OR-Tools' internal format.
            
            Args:
                from_index: OR-Tools node index of origin
                to_index: OR-Tools node index of destination
                
            Returns:
                int: Distance in meters (as integer)
            """
            # Convert from routing node index to location index
            from_node = manager.IndexToNode(from_index)
            to_node = manager.IndexToNode(to_index)
            
            # Return distance from our pre-calculated matrix
            # Convert to int as OR-Tools works with integers for performance
            return int(distance_matrix[from_node][to_node])
        
        # Register the distance callback with OR-Tools
        # This returns a callback index that we'll use to reference it
        transit_callback_index = routing.RegisterTransitCallback(distance_callback)
        
        # Step 4: Define the arc cost evaluator
        # This tells OR-Tools to minimize total distance
        routing.SetArcCostEvaluatorOfAllVehicles(transit_callback_index)
        
        # Step 5: Add capacity constraint (optional but recommended)
        # This ensures the vehicle doesn't exceed its package capacity
        def demand_callback(from_index: int) -> int:
            """
            Demand Callback Function
            
            Returns the package count at each location.
            Depot has 0 demand, delivery points have their package_count.
            
            Args:
                from_index: OR-Tools node index
                
            Returns:
                int: Number of packages at this location
            """
            from_node = manager.IndexToNode(from_index)
            
            # Depot (node 0) has no demand
            if from_node == 0:
                return 0
            
            # Delivery points have their package count
            # Subtract 1 because node 0 is depot
            return delivery_points[from_node - 1].package_count
        
        demand_callback_index = routing.RegisterUnaryTransitCallback(demand_callback)
        
        # Add capacity dimension
        # Parameters:
        # - callback: Function that returns demand at each location
        # - 0: Slack (unused capacity) at depot
        # - [vehicle_capacity]: Max capacity for each vehicle
        # - True: Cumulative constraint (capacity accumulates as we visit nodes)
        # - "Capacity": Dimension name
        routing.AddDimensionWithVehicleCapacity(
            demand_callback_index,
            0,  # No slack
            [vehicle_capacity],  # Vehicle capacity
            True,  # Start cumul to zero
            "Capacity"
        )
        
        # Step 6: Add time/distance limit constraint
        # Prevents routes that are too long
        max_duration_seconds = max_duration_minutes * 60
        
        # Add time dimension using duration matrix
        def time_callback(from_index: int, to_index: int) -> int:
            """Time callback - returns travel time between nodes"""
            from_node = manager.IndexToNode(from_index)
            to_node = manager.IndexToNode(to_index)
            return int(duration_matrix[from_node][to_node])
        
        time_callback_index = routing.RegisterTransitCallback(time_callback)
        
        # Add time dimension
        routing.AddDimension(
            time_callback_index,
            max_duration_seconds,  # Maximum waiting time at a node
            max_duration_seconds,  # Maximum total time for route
            False,  # Don't force start cumul to zero
            "Time"
        )
        
        # Step 7: Configure search parameters
        # These control how OR-Tools searches for solutions
        search_parameters = pywrapcp.DefaultRoutingSearchParameters()
        
        # Set first solution strategy (how to construct initial solution)
        search_parameters.first_solution_strategy = self.first_solution_strategy
        
        # Set local search metaheuristic (how to improve solution)
        search_parameters.local_search_metaheuristic = self.local_search_metaheuristic
        
        # Set time limit for search
        search_parameters.time_limit.seconds = self.time_limit_seconds
        
        # Enable logging for debugging (set to False in production)
        search_parameters.log_search = False
        
        logger.info("Running OR-Tools solver...")
        start_time = datetime.utcnow()
        
        # Step 8: Solve the problem!
        # This is where the magic happens
        solution = routing.SolveWithParameters(search_parameters)
        
        solve_time = (datetime.utcnow() - start_time).total_seconds()
        logger.info(f"Solver completed in {solve_time:.2f} seconds")
        
        # Step 9: Check if solution was found
        if not solution:
            logger.error("OR-Tools could not find a solution")
            raise ValueError(
                "No feasible solution found. "
                "Try reducing the number of deliveries, increasing vehicle capacity, "
                "or extending the time limit."
            )
        
        # Step 10: Extract and format the solution
        logger.info("Extracting solution...")
        result = self._extract_solution(
            manager,
            routing,
            solution,
            depot_location,
            delivery_points,
            distance_matrix,
            duration_matrix
        )
        
        # Add solver metadata
        result.solver_info = {
            "solve_time_seconds": solve_time,
            "objective_value": solution.ObjectiveValue(),
            "status": "OPTIMAL" if solution.ObjectiveValue() < float('inf') else "FEASIBLE",
            "num_locations": num_locations,
            "strategy": "PATH_CHEAPEST_ARC + GUIDED_LOCAL_SEARCH"
        }
        
        logger.info(
            f"✓ Optimization complete: "
            f"{result.total_distance_km:.2f}km, "
            f"{result.total_duration_minutes:.1f}min"
        )
        
        return result
    
    def _extract_solution(
        self,
        manager: pywrapcp.RoutingIndexManager,
        routing: pywrapcp.RoutingModel,
        solution,
        depot_location: Location,
        delivery_points: List[DeliveryPoint],
        distance_matrix: List[List[float]],
        duration_matrix: List[List[float]]
    ) -> RouteOptimizationResult:
        """
        Extract Solution from OR-Tools
        
        Converts the OR-Tools solution into our RouteOptimizationResult format.
        This involves traversing the solution route and collecting all relevant data.
        
        Args:
            manager: OR-Tools routing index manager
            routing: OR-Tools routing model
            solution: The solution object from OR-Tools
            depot_location: Depot coordinates
            delivery_points: Original delivery points list
            distance_matrix: Distance matrix used in solving
            duration_matrix: Duration matrix used in solving
            
        Returns:
            RouteOptimizationResult: Formatted solution with ordered points and segments
        """
        
        # Initialize results
        optimized_sequence = []
        route_segments = []
        total_distance_meters = 0
        total_duration_seconds = 0
        
        # Get the route for vehicle 0 (we only have one vehicle)
        index = routing.Start(0)
        
        # Track the previous node for segment creation
        previous_node = None
        segment_order = 0
        
        # Traverse the route
        # OR-Tools represents the route as a linked list of nodes
        # We follow the NextVar to traverse the entire route
        while not routing.IsEnd(index):
            # Get the actual node index
            node = manager.IndexToNode(index)
            
            # Skip depot at start (we'll add it back at the end if needed)
            if node != 0 or previous_node is not None:
                # Get the delivery point for this node
                if node == 0:
                    # Back to depot
                    pass
                else:
                    # This is a delivery point
                    # Node indices: 0=depot, 1=first delivery, 2=second delivery, etc.
                    point = delivery_points[node - 1]
                    
                    # Set sequence number
                    point.sequence_number = len(optimized_sequence)
                    
                    # Add to optimized sequence
                    optimized_sequence.append(point)
            
            # Create route segment if we have a previous node
            if previous_node is not None:
                segment = RouteSegment(
                    from_point_id=self._get_point_id(previous_node, delivery_points),
                    to_point_id=self._get_point_id(node, delivery_points),
                    distance_meters=distance_matrix[previous_node][node],
                    duration_minutes=duration_matrix[previous_node][node] / 60,
                    segment_order=segment_order
                )
                route_segments.append(segment)
                
                # Accumulate totals
                total_distance_meters += segment.distance_meters
                total_duration_seconds += duration_matrix[previous_node][node]
                
                segment_order += 1
            
            # Move to next node in the route
            previous_node = node
            index = solution.Value(routing.NextVar(index))
        
        # Convert total distance to kilometers
        total_distance_km = total_distance_meters / 1000
        
        # Convert total duration to minutes
        total_duration_minutes = total_duration_seconds / 60
        
        # Create and return the result
        result = RouteOptimizationResult(
            optimized_sequence=optimized_sequence,
            route_segments=route_segments,
            total_distance_km=round(total_distance_km, 2),
            total_duration_minutes=round(total_duration_minutes, 1)
        )
        
        return result
    
    def _get_point_id(
        self,
        node: int,
        delivery_points: List[DeliveryPoint]
    ) -> str:
        """
        Get Point ID from Node Index
        
        Helper method to get the point_id for a given node index.
        Node 0 = "DEPOT", other nodes = delivery point IDs
        
        Args:
            node: Node index from OR-Tools
            delivery_points: List of delivery points
            
        Returns:
            str: Point ID
        """
        if node == 0:
            return "DEPOT"
        return delivery_points[node - 1].point_id


# Create a global instance
vrp_solver = VRPSolver()
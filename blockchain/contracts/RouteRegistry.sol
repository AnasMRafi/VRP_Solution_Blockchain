// SPDX-License-Identifier: MIT
pragma solidity ^0.8.0;

/**
 * RouteRegistry Smart Contract
 * 
 * This contract stores immutable records of delivery routes on the Ethereum blockchain.
 * 
 * Features:
 * - Store route completion data with hash verification
 * - Verify route integrity using stored hashes
 * - Track route status progression
 * - Emit events for external monitoring
 * 
 * Use Cases:
 * - Proof of delivery completion
 * - Immutable audit trail
 * - Dispute resolution
 * - Regulatory compliance
 */

contract RouteRegistry {
    
    // Route record structure
    struct RouteRecord {
        string routeId;              // Unique route identifier
        bytes32 dataHash;            // SHA-256 hash of route data
        uint256 timestamp;           // Block timestamp when recorded
        address driver;              // Ethereum address of driver who recorded it
        string status;               // Route status (optimized, in_progress, completed)
        uint256 totalDistance;       // Total distance in meters (for statistics)
        uint256 deliveryCount;       // Number of deliveries
        uint256 completedDeliveries; // Number of completed deliveries
        bool exists;                 // Flag to check if record exists
    }
    
    // Mapping from route ID to route record
    mapping(string => RouteRecord) public routes;
    
    // Array of all route IDs (for iteration)
    string[] public routeIds;
    
    // Events for external monitoring
    event RouteCreated(
        string indexed routeId,
        bytes32 dataHash,
        uint256 timestamp,
        address driver
    );
    
    event RouteUpdated(
        string indexed routeId,
        bytes32 newDataHash,
        string newStatus,
        uint256 timestamp
    );
    
    event RouteCompleted(
        string indexed routeId,
        bytes32 finalDataHash,
        uint256 completedDeliveries,
        uint256 timestamp
    );
    
    /**
     * Record a new route on the blockchain
     * 
     * This function should be called when a route is first optimized.
     * It creates an immutable record of the route's initial state.
     * 
     * @param _routeId Unique route identifier
     * @param _dataHash SHA-256 hash of the route data
     * @param _status Initial status (typically "optimized")
     * @param _totalDistance Total route distance in meters
     * @param _deliveryCount Number of deliveries in the route
     */
    function createRoute(
        string memory _routeId,
        bytes32 _dataHash,
        string memory _status,
        uint256 _totalDistance,
        uint256 _deliveryCount
    ) public {
        // Require that route doesn't already exist
        require(!routes[_routeId].exists, "Route already exists");
        
        // Require valid data
        require(bytes(_routeId).length > 0, "Route ID cannot be empty");
        require(_dataHash != bytes32(0), "Data hash cannot be empty");
        
        // Create route record
        routes[_routeId] = RouteRecord({
            routeId: _routeId,
            dataHash: _dataHash,
            timestamp: block.timestamp,
            driver: msg.sender,
            status: _status,
            totalDistance: _totalDistance,
            deliveryCount: _deliveryCount,
            completedDeliveries: 0,
            exists: true
        });
        
        // Add to route IDs array
        routeIds.push(_routeId);
        
        // Emit event
        emit RouteCreated(_routeId, _dataHash, block.timestamp, msg.sender);
    }
    
    /**
     * Update route status and data hash
     * 
     * Called when route status changes (e.g., optimized -> in_progress -> completed).
     * Updates the data hash to reflect current state.
     * 
     * @param _routeId Route identifier
     * @param _newDataHash Updated SHA-256 hash of route data
     * @param _newStatus New status
     * @param _completedDeliveries Number of completed deliveries
     */
    function updateRoute(
        string memory _routeId,
        bytes32 _newDataHash,
        string memory _newStatus,
        uint256 _completedDeliveries
    ) public {
        // Require that route exists
        require(routes[_routeId].exists, "Route does not exist");
        
        // Require that sender is the original driver (optional, can be removed for flexibility)
        require(routes[_routeId].driver == msg.sender, "Only original driver can update");
        
        // Update route
        routes[_routeId].dataHash = _newDataHash;
        routes[_routeId].status = _newStatus;
        routes[_routeId].completedDeliveries = _completedDeliveries;
        
        // Emit event
        emit RouteUpdated(_routeId, _newDataHash, _newStatus, block.timestamp);
        
        // If completed, emit completion event
        if (keccak256(bytes(_newStatus)) == keccak256(bytes("completed"))) {
            emit RouteCompleted(
                _routeId,
                _newDataHash,
                _completedDeliveries,
                block.timestamp
            );
        }
    }
    
    /**
     * Verify route data integrity
     * 
     * Checks if the provided data hash matches the stored hash.
     * Used to verify that route data hasn't been tampered with.
     * 
     * @param _routeId Route identifier
     * @param _dataHash Hash to verify
     * @return bool True if hash matches, false otherwise
     */
    function verifyRoute(
        string memory _routeId,
        bytes32 _dataHash
    ) public view returns (bool) {
        require(routes[_routeId].exists, "Route does not exist");
        return routes[_routeId].dataHash == _dataHash;
    }
    
    /**
     * Get route details
     * 
     * Retrieves complete route record from blockchain.
     * 
     * @param _routeId Route identifier
     * @return RouteRecord struct with all route data
     */
    function getRoute(string memory _routeId) public view returns (
        string memory routeId,
        bytes32 dataHash,
        uint256 timestamp,
        address driver,
        string memory status,
        uint256 totalDistance,
        uint256 deliveryCount,
        uint256 completedDeliveries
    ) {
        require(routes[_routeId].exists, "Route does not exist");
        
        RouteRecord memory route = routes[_routeId];
        
        return (
            route.routeId,
            route.dataHash,
            route.timestamp,
            route.driver,
            route.status,
            route.totalDistance,
            route.deliveryCount,
            route.completedDeliveries
        );
    }
    
    /**
     * Get total number of routes
     * 
     * @return uint256 Total count of registered routes
     */
    function getRouteCount() public view returns (uint256) {
        return routeIds.length;
    }
    
    /**
     * Get route ID by index
     * 
     * Useful for iterating through all routes.
     * 
     * @param _index Index in routeIds array
     * @return string Route ID
     */
    function getRouteIdByIndex(uint256 _index) public view returns (string memory) {
        require(_index < routeIds.length, "Index out of bounds");
        return routeIds[_index];
    }
}
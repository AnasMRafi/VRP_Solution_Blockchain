"""
Blockchain Service

This module handles all interactions with the Ethereum blockchain.
It records route data on the blockchain for immutability and verification.

Features:
- Record route creation on blockchain
- Update route status on blockchain
- Verify route data integrity
- Calculate data hashes
"""

from web3 import Web3
from eth_account import Account
import json
import hashlib
import logging
from typing import Dict, Any, Optional
from pathlib import Path

from app.config import settings

logger = logging.getLogger(__name__)


class BlockchainService:
    """
    Blockchain Integration Service
    
    Manages connection to Ganache and interactions with RouteRegistry contract.
    """
    
    def __init__(self):
        """
        Initialize Blockchain Service
        
        Sets up Web3 connection and loads contract ABI.
        """
        self.w3 = None
        self.contract = None
        self.account = None
        self.is_available = False
        
        # Try to connect to blockchain
        self._initialize_connection()
    
    def _initialize_connection(self):
        """
        Initialize connection to Ganache
        
        Loads contract ABI and establishes Web3 connection.
        """
        try:
            # Connect to Ganache
            self.w3 = Web3(Web3.HTTPProvider(settings.GANACHE_URL))
            
            if not self.w3.is_connected():
                logger.warning("Blockchain not available: Cannot connect to Ganache")
                return
            
            logger.info(f"✓ Connected to Ganache at {settings.GANACHE_URL}")
            
            # Check if contract address is configured
            if not settings.CONTRACT_ADDRESS:
                logger.warning("Blockchain not available: CONTRACT_ADDRESS not configured in .env")
                return
            
            # Load contract ABI
            abi_file = Path(__file__).parent.parent.parent.parent / "blockchain" / "deployed" / "RouteRegistry_abi.json"
            
            if not abi_file.exists():
                logger.warning(f"Blockchain not available: ABI file not found at {abi_file}")
                return
            
            with open(abi_file, 'r') as f:
                contract_abi = json.load(f)
            
            # Create contract instance
            self.contract = self.w3.eth.contract(
                address=settings.CONTRACT_ADDRESS,
                abi=contract_abi
            )
            
            # Set default account (first account from Ganache)
            self.account = self.w3.eth.accounts[0]
            
            # Verify contract is functional
            route_count = self.contract.functions.getRouteCount().call()
            
            self.is_available = True
            logger.info(f"✓ Blockchain service initialized (Routes on chain: {route_count})")
            
        except Exception as e:
            logger.error(f"Failed to initialize blockchain service: {e}")
            self.is_available = False
    
    def calculate_data_hash(self, data: Dict[str, Any]) -> str:
        """
        Calculate SHA-256 Hash of Immutable Route Data
        
        Creates a deterministic hash of ONLY immutable route fields.
        This ensures verification works even after status/delivery updates.
        
        Immutable fields:
        - route_id
        - route_name
        - depot_location
        - delivery_points (addresses and locations only, not status)
        
        Args:
            data: Dictionary containing route data
            
        Returns:
            str: Hexadecimal hash string (with 0x prefix)
        """
        # Extract only immutable fields for hashing
        immutable_data = {
            "route_id": data.get("route_id"),
            "route_name": data.get("route_name"),
            "depot_location": data.get("depot_location"),
            "delivery_points": []
        }
        
        # For delivery points, only include immutable fields (not status)
        for point in data.get("delivery_points", []):
            immutable_point = {
                "customer_name": point.get("customer_name"),
                "address": point.get("address"),
                "location": point.get("location"),
                "point_id": point.get("point_id")
            }
            immutable_data["delivery_points"].append(immutable_point)
        
        # Sort keys for deterministic hashing
        json_str = json.dumps(immutable_data, sort_keys=True, default=str)
        
        # Debug logging
        logger.debug(f"Hash input (first 200 chars): {json_str[:200]}")
        
        # Calculate SHA-256 hash
        hash_bytes = hashlib.sha256(json_str.encode('utf-8')).digest()
        
        # Convert to hex with 0x prefix (Ethereum format)
        result_hash = '0x' + hash_bytes.hex()
        logger.info(f"Calculated hash: {result_hash[:20]}...")
        
        return result_hash
    
    async def record_route_creation(
        self,
        route_id: str,
        route_data: Dict[str, Any]
    ) -> Optional[Dict[str, Any]]:
        """
        Record Route Creation on Blockchain
        
        Creates an immutable record when a route is optimized.
        
        Args:
            route_id: Unique route identifier
            route_data: Complete route data including optimization result
            
        Returns:
            Dict with transaction details, or None if blockchain unavailable
            
        Example:
            result = await blockchain_service.record_route_creation(
                "ROUTE_20241208_001",
                {
                    "route_id": "ROUTE_20241208_001",
                    "delivery_points": [...],
                    "optimization_result": {...}
                }
            )
        """
        if not self.is_available:
            logger.warning("Blockchain not available - skipping route creation record")
            return None
        
        try:
            logger.info(f"Recording route creation on blockchain: {route_id}")
            
            # Calculate data hash
            data_hash = self.calculate_data_hash(route_data)
            
            # Extract statistics from route data
            opt_result = route_data.get('optimization_result', {})
            total_distance = int(opt_result.get('total_distance_km', 0) * 1000)  # Convert to meters
            delivery_count = len(route_data.get('delivery_points', []))
            
            # Build transaction
            tx_hash = self.contract.functions.createRoute(
                route_id,
                self.w3.to_bytes(hexstr=data_hash),  # Convert hex string to bytes32
                'optimized',
                total_distance,
                delivery_count
            ).transact({
                'from': self.account
            })
            
            # Wait for transaction confirmation
            tx_receipt = self.w3.eth.wait_for_transaction_receipt(tx_hash)
            
            logger.info(f"✓ Route recorded on blockchain: {route_id}")
            logger.info(f"  Transaction: {tx_hash.hex()}")
            logger.info(f"  Block: {tx_receipt.blockNumber}")
            logger.info(f"  Gas used: {tx_receipt.gasUsed}")
            
            return {
                'transaction_hash': tx_hash.hex(),
                'block_number': tx_receipt.blockNumber,
                'data_hash': data_hash,
                'gas_used': tx_receipt.gasUsed,
                'status': 'success' if tx_receipt.status == 1 else 'failed'
            }
            
        except Exception as e:
            logger.error(f"Failed to record route creation on blockchain: {e}")
            return None
    
    async def update_route_status(
        self,
        route_id: str,
        route_data: Dict[str, Any],
        new_status: str,
        completed_deliveries: int
    ) -> Optional[Dict[str, Any]]:
        """
        Update Route Status on Blockchain
        
        Records status changes (optimized -> in_progress -> completed).
        
        Args:
            route_id: Route identifier
            route_data: Updated route data
            new_status: New status string
            completed_deliveries: Number of completed deliveries
            
        Returns:
            Dict with transaction details, or None if blockchain unavailable
        """
        if not self.is_available:
            logger.warning("Blockchain not available - skipping route update")
            return None
        
        try:
            logger.info(f"Updating route status on blockchain: {route_id} -> {new_status}")
            
            # Calculate new data hash
            data_hash = self.calculate_data_hash(route_data)
            
            # Build transaction
            tx_hash = self.contract.functions.updateRoute(
                route_id,
                self.w3.to_bytes(hexstr=data_hash),
                new_status,
                completed_deliveries
            ).transact({
                'from': self.account
            })
            
            # Wait for confirmation
            tx_receipt = self.w3.eth.wait_for_transaction_receipt(tx_hash)
            
            logger.info(f"✓ Route status updated on blockchain: {route_id}")
            
            return {
                'transaction_hash': tx_hash.hex(),
                'block_number': tx_receipt.blockNumber,
                'data_hash': data_hash,
                'gas_used': tx_receipt.gasUsed,
                'status': 'success' if tx_receipt.status == 1 else 'failed'
            }
            
        except Exception as e:
            logger.error(f"Failed to update route status on blockchain: {e}")
            return None
    
    async def verify_route(
        self,
        route_id: str,
        route_data: Dict[str, Any]
    ) -> bool:
        """
        Verify Route Data Integrity
        
        Compares current route data hash with the stored hash from when
        the route was recorded on blockchain.
        
        Args:
            route_id: Route identifier
            route_data: Route data to verify (from database)
            
        Returns:
            bool: True if data is valid (hash matches), False otherwise
        """
        if not self.is_available:
            logger.warning("Blockchain not available - cannot verify route")
            return False
        
        try:
            # Get the stored hash from when route was created
            stored_hash = route_data.get("data_hash")
            
            if not stored_hash:
                logger.warning(f"No stored hash for route {route_id}")
                return False
            
            # Calculate current data hash
            current_hash = self.calculate_data_hash(route_data)
            
            # Compare hashes
            is_valid = stored_hash == current_hash
            
            logger.info(f"Route verification: {route_id}")
            logger.info(f"  Stored hash:  {stored_hash[:20]}...")
            logger.info(f"  Current hash: {current_hash[:20]}...")
            logger.info(f"  Result: {'✓ Valid' if is_valid else '✗ Invalid'}")
            
            return is_valid
            
        except Exception as e:
            logger.error(f"Failed to verify route: {e}")
            return False
    
    async def get_route_from_blockchain(
        self,
        route_id: str
    ) -> Optional[Dict[str, Any]]:
        """
        Get Route Record from Blockchain
        
        Retrieves stored route information.
        
        Args:
            route_id: Route identifier
            
        Returns:
            Dict with route details, or None if not found
        """
        if not self.is_available:
            return None
        
        try:
            result = self.contract.functions.getRoute(route_id).call()
            
            return {
                'route_id': result[0],
                'data_hash': result[1].hex(),
                'timestamp': result[2],
                'driver': result[3],
                'status': result[4],
                'total_distance': result[5],
                'delivery_count': result[6],
                'completed_deliveries': result[7]
            }
            
        except Exception as e:
            logger.error(f"Failed to get route from blockchain: {e}")
            return None


# Create global instance
blockchain_service = BlockchainService()
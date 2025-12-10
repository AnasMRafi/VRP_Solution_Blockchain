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
        Calculate SHA-256 Hash of Data
        
        Creates a deterministic hash of route data for blockchain storage.
        
        Args:
            data: Dictionary containing route data
            
        Returns:
            str: Hexadecimal hash string (with 0x prefix)
            
        Example:
            hash_str = service.calculate_data_hash({
                "route_id": "ROUTE_001",
                "deliveries": [...],
                "status": "completed"
            })
        """
        # Sort keys for deterministic hashing
        json_str = json.dumps(data, sort_keys=True, default=str)
        
        # Calculate SHA-256 hash
        hash_bytes = hashlib.sha256(json_str.encode('utf-8')).digest()
        
        # Convert to hex with 0x prefix (Ethereum format)
        return '0x' + hash_bytes.hex()
    
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
        
        Checks if route data matches blockchain record.
        
        Args:
            route_id: Route identifier
            route_data: Route data to verify
            
        Returns:
            bool: True if data is valid, False otherwise
        """
        if not self.is_available:
            logger.warning("Blockchain not available - cannot verify route")
            return False
        
        try:
            # Calculate current data hash
            data_hash = self.calculate_data_hash(route_data)
            
            # Query blockchain
            is_valid = self.contract.functions.verifyRoute(
                route_id,
                self.w3.to_bytes(hexstr=data_hash)
            ).call()
            
            logger.info(f"Route verification: {route_id} - {'✓ Valid' if is_valid else '✗ Invalid'}")
            
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
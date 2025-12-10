"""
Database Service Module

This module handles all MongoDB connections and operations.
It uses Motor (async MongoDB driver) for non-blocking database operations,
which is essential for FastAPI's async architecture.
"""

from motor.motor_asyncio import AsyncIOMotorClient, AsyncIOMotorDatabase
from pymongo.errors import ConnectionFailure, ServerSelectionTimeoutError
from app.config import settings
import logging

# Configure logging to track database operations
logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)


class DatabaseManager:
    """
    MongoDB Database Manager
    
    This class manages the MongoDB connection lifecycle:
    - Establishes connection on startup
    - Provides access to database collections
    - Closes connection on shutdown
    
    Using a class allows us to maintain state (the connection)
    and provides a clean interface for database operations.
    """
    
    def __init__(self):
        """
        Initialize Database Manager
        
        We set client and db to None initially.
        The actual connection is established in connect() method.
        """
        self.client: AsyncIOMotorClient = None
        self.db: AsyncIOMotorDatabase = None
        
    async def connect(self):
        """
        Establish MongoDB Connection
        
        This method:
        1. Creates an AsyncIOMotorClient with the MongoDB URI
        2. Tests the connection with a ping command
        3. Sets up the database instance
        
        The serverSelectionTimeoutMS parameter prevents the app from
        hanging if MongoDB is unreachable.
        
        Raises:
            ConnectionFailure: If unable to connect to MongoDB
        """
        try:
            logger.info("Connecting to MongoDB Atlas...")
            
            # Create async MongoDB client
            # maxPoolSize limits concurrent connections to prevent overwhelming the server
            # serverSelectionTimeoutMS ensures we fail fast if MongoDB is down
            self.client = AsyncIOMotorClient(
                settings.MONGODB_URI,
                maxPoolSize=10,
                minPoolSize=1,
                serverSelectionTimeoutMS=5000  # 5 second timeout
            )
            
            # Test the connection by sending a ping command
            # This ensures we're actually connected before proceeding
            await self.client.admin.command('ping')
            
            # Get reference to our specific database
            self.db = self.client[settings.MONGODB_DB_NAME]
            
            logger.info(f"✓ Connected to MongoDB database: {settings.MONGODB_DB_NAME}")
            
            # Create indexes for better query performance
            await self._create_indexes()
            
        except (ConnectionFailure, ServerSelectionTimeoutError) as e:
            logger.error(f"✗ Failed to connect to MongoDB: {e}")
            raise ConnectionFailure(
                f"Could not connect to MongoDB Atlas. "
                f"Please check your MONGODB_URI in .env file. Error: {e}"
            )
    
    async def _create_indexes(self):
        """
        Create Database Indexes
        
        Indexes dramatically improve query performance for frequently
        searched fields. We create indexes on:
        - routes: route_id (for quick lookups)
        - drivers: email (for authentication)
        - deliveries: route_id (for finding deliveries by route)
        
        The 'unique=True' parameter ensures no duplicate emails/route_ids.
        """
        try:
            # Index for routes collection - ensures fast route lookups
            await self.db.routes.create_index("route_id", unique=True)
            await self.db.routes.create_index("created_at")  # For sorting by date
            
            # Index for drivers collection - ensures unique emails
            await self.db.drivers.create_index("email", unique=True)
            
            # Index for deliveries collection
            await self.db.deliveries.create_index("route_id")
            await self.db.deliveries.create_index("delivery_id", unique=True)
            
            logger.info("✓ Database indexes created successfully")
            
        except Exception as e:
            logger.warning(f"Index creation warning (may already exist): {e}")
    
    async def disconnect(self):
        """
        Close MongoDB Connection
        
        This method should be called when the application shuts down.
        It ensures all connections are properly closed and resources freed.
        """
        if self.client:
            logger.info("Closing MongoDB connection...")
            self.client.close()
            logger.info("✓ MongoDB connection closed")
    
    def get_collection(self, collection_name: str):
        """
        Get a MongoDB Collection
        
        This is a convenience method to access collections.
        Collections are like tables in SQL databases.
        
        Args:
            collection_name: Name of the collection to access
            
        Returns:
            AsyncIOMotorCollection: The requested collection
            
        Example:
            routes_collection = db_manager.get_collection("routes")
            route = await routes_collection.find_one({"route_id": "R123"})
        """
        if not self.db:
            raise ConnectionFailure("Database not connected. Call connect() first.")
        return self.db[collection_name]


# Create a global instance of DatabaseManager
# This will be imported and used throughout the application
db_manager = DatabaseManager()


async def get_database() -> AsyncIOMotorDatabase:
    """
    Dependency Function for FastAPI
    
    This function is used as a FastAPI dependency to inject
    the database into route handlers.
    
    Usage in routes:
        @router.get("/routes")
        async def get_routes(db: AsyncIOMotorDatabase = Depends(get_database)):
            routes = await db.routes.find().to_list(100)
            return routes
    
    Returns:
        AsyncIOMotorDatabase: The connected database instance
    """
    if db_manager.db is None:
        raise ConnectionFailure(
            "Database not initialized. "
            "Ensure connect() is called during app startup."
        )
    return db_manager.db
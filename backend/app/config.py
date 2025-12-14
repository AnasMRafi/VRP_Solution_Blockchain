"""
Configuration Module
This module loads all environment variables and provides them as Pydantic settings.
Using Pydantic ensures type safety and validation of configuration values.
"""

from pydantic_settings import BaseSettings
from typing import List
from functools import lru_cache


class Settings(BaseSettings):
    """
    Application Settings
    
    This class loads configuration from .env file and environment variables.
    Pydantic automatically validates types and required fields.
    
    The @lru_cache decorator ensures we only create one instance of settings,
    improving performance and ensuring consistency across the application.
    """
    
    # MongoDB Configuration
    # The connection URI for MongoDB Atlas
    MONGODB_URI: str
    # Database name to use within MongoDB
    MONGODB_DB_NAME: str = "routechain"
    
    # OpenRouteService Configuration
    # API key for accessing OpenRouteService distance matrix API
    OPENROUTESERVICE_API_KEY: str
    
    # JWT Authentication Configuration
    # Secret key used for signing JWT tokens - MUST be kept secure
    SECRET_KEY: str
    # Algorithm used for JWT encoding (HS256 is standard)
    ALGORITHM: str = "HS256"
    # Token expiration time in minutes (default 7 days)
    ACCESS_TOKEN_EXPIRE_MINUTES: int = 10080
    
    # FastAPI Application Configuration
    APP_NAME: str = "RouteChain"
    APP_VERSION: str = "1.0.0"
    DEBUG: bool = True
    
    # CORS Configuration
    # List of allowed origins for CORS (React frontend)
    # We parse this as a comma-separated string and convert to list
    CORS_ORIGINS: str = "http://localhost:5173,http://localhost:3000"
    
    @property
    def cors_origins_list(self) -> List[str]:
        """
        Convert CORS_ORIGINS string to a list of URLs.
        Use '*' to allow all origins (useful for development).
        """
        if self.CORS_ORIGINS.strip() == "*":
            return ["*"]  # Allow all origins
        return [origin.strip() for origin in self.CORS_ORIGINS.split(",")]
    
    # Blockchain Configuration (for later use)
    GANACHE_URL: str = "http://127.0.0.1:7545"
    CONTRACT_ADDRESS: str = ""
    
    # Server Configuration
    HOST: str = "0.0.0.0"
    PORT: int = 8000
    
    class Config:
        """
        Pydantic configuration
        Tells Pydantic to load values from .env file
        """
        env_file = ".env"
        # Allow extra fields in .env that aren't defined here
        extra = "allow"


@lru_cache()
def get_settings() -> Settings:
    """
    Get Settings Instance
    
    This function creates and caches a single Settings instance.
    The @lru_cache decorator ensures this function only runs once,
    and subsequent calls return the cached instance.
    
    Returns:
        Settings: Application settings instance
    """
    return Settings()


# Create a global settings instance for easy import
settings = get_settings()
"""
RouteChain Backend - Main Application

This is the entry point for the FastAPI application.
It configures and starts the entire backend system.

To run: uvicorn app.main:app --reload --host 0.0.0.0 --port 8000
"""

from fastapi import FastAPI, Request, status
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse
from fastapi.exceptions import RequestValidationError
from contextlib import asynccontextmanager
import logging
from datetime import datetime

# Import configuration
from app.config import settings

# Import database manager
from app.services.database import db_manager

# Import distance service
from app.services.distance import distance_service

# Import routers
from app.routers import auth, routes, customers, depots, analytics, admin

# Configure logging
logging.basicConfig(
    level=logging.INFO if not settings.DEBUG else logging.DEBUG,
    format='%(asctime)s - %(name)s - %(levelname)s - %(message)s'
)
logger = logging.getLogger(__name__)


@asynccontextmanager
async def lifespan(app: FastAPI):
    """
    Application Lifespan Manager
    
    This function handles startup and shutdown events for the application.
    It's called when the application starts and stops.
    
    Startup:
    - Connect to MongoDB
    - Initialize services
    - Log startup information
    
    Shutdown:
    - Close database connections
    - Close HTTP clients
    - Clean up resources
    
    The yield statement separates startup (before) from shutdown (after) code.
    """
    # ==================== STARTUP ====================
    logger.info("=" * 60)
    logger.info(f"Starting {settings.APP_NAME} v{settings.APP_VERSION}")
    logger.info("=" * 60)
    
    try:
        # Connect to MongoDB
        logger.info("Connecting to MongoDB...")
        await db_manager.connect()
        logger.info("✓ MongoDB connected successfully")
        
        # Log configuration (without sensitive data)
        logger.info("Configuration:")
        logger.info(f"  - Database: {settings.MONGODB_DB_NAME}")
        logger.info(f"  - Debug Mode: {settings.DEBUG}")
        logger.info(f"  - CORS Origins: {settings.CORS_ORIGINS}")
        logger.info(f"  - OpenRouteService: {'Configured' if settings.OPENROUTESERVICE_API_KEY else 'NOT CONFIGURED'}")
        
        logger.info("=" * 60)
        logger.info(f"✓ {settings.APP_NAME} started successfully!")
        logger.info(f"✓ Server running at: http://{settings.HOST}:{settings.PORT}")
        logger.info(f"✓ API Documentation: http://{settings.HOST}:{settings.PORT}/docs")
        logger.info("=" * 60)
        
    except Exception as e:
        logger.error(f"✗ Startup failed: {e}")
        raise
    
    # Application is now running - yield control
    yield
    
    # ==================== SHUTDOWN ====================
    logger.info("Shutting down application...")
    
    try:
        # Close database connection
        await db_manager.disconnect()
        logger.info("✓ MongoDB connection closed")
        
        # Close distance service HTTP client
        await distance_service.close()
        logger.info("✓ Distance service closed")
        
        logger.info("✓ Application shut down successfully")
        
    except Exception as e:
        logger.error(f"Error during shutdown: {e}")


# Create FastAPI application instance
app = FastAPI(
    title=settings.APP_NAME,
    version=settings.APP_VERSION,
    description="""
    RouteChain API - Vehicle Routing Problem (VRP) Solution with Blockchain Traceability
    
    This API provides endpoints for:
    - Driver authentication and management
    - Route optimization using Google OR-Tools
    - Real-time delivery tracking
    - Route export (CSV/PDF)
    - Blockchain integration (coming soon)
    
    ## Authentication
    Most endpoints require JWT authentication. Use the `/auth/login` endpoint to obtain a token,
    then include it in the `Authorization` header as `Bearer <token>`.
    
    ## Rate Limiting
    OpenRouteService API: 2000 requests/day (free tier)
    
    ## Contact
    - Email: support@routechain.ma
    - GitHub: https://github.com/routechain
    """,
    docs_url="/docs",
    redoc_url="/redoc",
    lifespan=lifespan,
    debug=settings.DEBUG
)


# ==================== MIDDLEWARE ====================

# CORS Middleware
# Allows the React frontend to make requests to this API
app.add_middleware(
    CORSMiddleware,
    allow_origins=settings.cors_origins_list,  # React app URLs
    allow_credentials=True,  # Allow cookies and auth headers
    allow_methods=["*"],  # Allow all HTTP methods (GET, POST, etc.)
    allow_headers=["*"],  # Allow all headers
)


# Request Logging Middleware
@app.middleware("http")
async def log_requests(request: Request, call_next):
    """
    Log all incoming requests
    
    This middleware logs every API request with:
    - HTTP method
    - Request path
    - Client IP
    - Response time
    - Status code
    
    Useful for debugging and monitoring.
    """
    start_time = datetime.utcnow()
    
    # Log incoming request
    logger.info(f"→ {request.method} {request.url.path} from {request.client.host}")
    
    # Process request
    response = await call_next(request)
    
    # Calculate processing time
    process_time = (datetime.utcnow() - start_time).total_seconds()
    
    # Log response
    logger.info(
        f"← {request.method} {request.url.path} "
        f"[{response.status_code}] in {process_time:.3f}s"
    )
    
    # Add custom header with processing time
    response.headers["X-Process-Time"] = str(process_time)
    
    return response


# ==================== EXCEPTION HANDLERS ====================

@app.exception_handler(RequestValidationError)
async def validation_exception_handler(request: Request, exc: RequestValidationError):
    """
    Handle Validation Errors
    
    When Pydantic validation fails (e.g., missing required field, wrong type),
    this handler formats the error nicely for the client.
    """
    logger.warning(f"Validation error on {request.url.path}: {exc.errors()}")
    
    return JSONResponse(
        status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
        content={
            "detail": "Validation error",
            "errors": exc.errors(),
            "body": exc.body
        }
    )


@app.exception_handler(Exception)
async def general_exception_handler(request: Request, exc: Exception):
    """
    Handle Unexpected Errors
    
    Catches any unhandled exceptions and returns a generic error response.
    In production, this prevents leaking sensitive error details.
    """
    logger.error(f"Unhandled exception on {request.url.path}: {exc}", exc_info=True)
    
    # In debug mode, show full error details
    if settings.DEBUG:
        return JSONResponse(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            content={
                "detail": "Internal server error",
                "error": str(exc),
                "type": type(exc).__name__
            }
        )
    
    # In production, show generic message
    return JSONResponse(
        status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
        content={
            "detail": "Internal server error. Please contact support."
        }
    )


# ==================== ROUTES ====================

# Include routers
app.include_router(auth.router)
app.include_router(routes.router)
app.include_router(customers.router)
app.include_router(depots.router)
app.include_router(analytics.router)
app.include_router(admin.router)


# Root endpoint
@app.get("/", tags=["Root"])
async def root():
    """
    Root Endpoint
    
    Returns basic API information.
    Useful for health checks.
    """
    return {
        "name": settings.APP_NAME,
        "version": settings.APP_VERSION,
        "status": "running",
        "timestamp": datetime.utcnow(),
        "docs": "/docs",
        "redoc": "/redoc"
    }


# Health check endpoint
@app.get("/health", tags=["Root"])
async def health_check():
    """
    Health Check Endpoint
    
    Verifies that the API and its dependencies are running correctly.
    Used by monitoring systems and load balancers.
    
    Returns:
    - Status: "healthy" or "unhealthy"
    - Database: Connection status
    - Timestamp: Current server time
    """
    health_status = {
        "status": "healthy",
        "timestamp": datetime.utcnow(),
        "services": {}
    }
    
    # Check MongoDB connection
    try:
        # Try to execute a simple command
        await db_manager.db.command('ping')
        health_status["services"]["mongodb"] = "connected"
    except Exception as e:
        health_status["status"] = "unhealthy"
        health_status["services"]["mongodb"] = f"error: {str(e)}"
    
    # Check OpenRouteService API key configuration
    if settings.OPENROUTESERVICE_API_KEY and settings.OPENROUTESERVICE_API_KEY != "your_openrouteservice_api_key_here":
        health_status["services"]["openrouteservice"] = "configured"
    else:
        health_status["services"]["openrouteservice"] = "not configured"
    
    status_code = status.HTTP_200_OK if health_status["status"] == "healthy" else status.HTTP_503_SERVICE_UNAVAILABLE
    
    return JSONResponse(
        status_code=status_code,
        content=health_status
    )


# API Information endpoint
@app.get("/api/info", tags=["Root"])
async def api_info():
    """
    API Information
    
    Returns detailed information about the API endpoints and features.
    """
    return {
        "name": settings.APP_NAME,
        "version": settings.APP_VERSION,
        "description": "VRP optimization with blockchain traceability",
        "features": [
            "Driver authentication (JWT)",
            "Route optimization (Google OR-Tools)",
            "Distance calculation (OpenRouteService)",
            "Real-time delivery tracking",
            "Route export (CSV/PDF)",
            "Blockchain integration (coming soon)"
        ],
        "endpoints": {
            "authentication": "/auth",
            "routes": "/routes",
            "documentation": "/docs"
        },
        "contact": {
            "email": "support@routechain.ma"
        }
    }


# Development mode indicator
if settings.DEBUG:
    @app.get("/debug/config", tags=["Debug"])
    async def debug_config():
        """
        Debug Configuration Endpoint
        
        ONLY AVAILABLE IN DEBUG MODE
        Returns current configuration (with secrets masked).
        """
        return {
            "debug": settings.DEBUG,
            "database": settings.MONGODB_DB_NAME,
            "cors_origins": settings.cors_origins_list,
            "openrouteservice_configured": bool(settings.OPENROUTESERVICE_API_KEY),
            "jwt_expiry_minutes": settings.ACCESS_TOKEN_EXPIRE_MINUTES
        }


# Entry point when running directly
if __name__ == "__main__":
    import uvicorn
    
    logger.info(f"Starting {settings.APP_NAME} development server...")
    
    uvicorn.run(
        "app.main:app",
        host=settings.HOST,
        port=settings.PORT,
        reload=settings.DEBUG,
        log_level="info" if not settings.DEBUG else "debug"
    )
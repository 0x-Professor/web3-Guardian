#!/usr/bin/env python3
"""Check database connection and initialize tables."""
import asyncio
import logging
import sys
from pathlib import Path

# Add the project root to the Python path
sys.path.append(str(Path(__file__).resolve().parent.parent))

from src.database.config import init_db, close_db
from src.utils.config import settings

# Configure logging
logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s - %(name)s - %(levelname)s - %(message)s",
)
logger = logging.getLogger(__name__)

async def check_database() -> bool:
    """Check database connection and initialize tables."""
    logger.info("Checking database connection...")
    logger.info(f"Database URL: {settings.DATABASE_URL}")
    
    try:
        # Initialize database (creates tables)
        logger.info("Initializing database...")
        await init_db()
        logger.info("Database initialized successfully!")
        return True
    except Exception as e:
        logger.error(f"Database initialization failed: {e}", exc_info=True)
        return False
    finally:
        # Close database connections
        await close_db()

if __name__ == "__main__":
    logger.info("Starting database check...")
    
    # Create event loop and run the check
    success = asyncio.run(check_database())
    
    if success:
        logger.info("Database check completed successfully!")
        sys.exit(0)
    else:
        logger.error("Database check failed!")
        sys.exit(1)

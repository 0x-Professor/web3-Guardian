import logging
from typing import AsyncGenerator, TypeVar, Type, Any
from contextlib import asynccontextmanager
from sqlalchemy.ext.asyncio import create_async_engine, AsyncSession, async_sessionmaker
from sqlalchemy.orm import sessionmaker, declarative_base, Session
from sqlalchemy.pool import NullPool
from sqlalchemy.exc import SQLAlchemyError
from ..utils.config import settings

# Configure logging
logger = logging.getLogger(__name__)

# Create async database engine with connection pooling
DATABASE_URL = settings.DATABASE_URL.replace("postgresql://", "postgresql+asyncpg://")

engine = create_async_engine(
    DATABASE_URL,
    echo=settings.DEBUG,
    future=True,
    pool_pre_ping=True,
    pool_recycle=300,  # Recycle connections after 5 minutes
    pool_size=5,
    max_overflow=10,
    pool_timeout=30,
    pool_use_lifo=True,  # Use LIFO queue for better performance
)

# Create async session factory with improved configuration
async_session_factory = async_sessionmaker(
    bind=engine,
    class_=AsyncSession,
    expire_on_commit=False,
    autoflush=False,
    autocommit=False,
    future=True,
)

# Base class for models
Base = declarative_base()

# Import models to ensure they are registered with the Base
from .models import ContractAnalysis, Vulnerability, AnalysisCache  # noqa

# Type variable for database session
AsyncSessionT = TypeVar("AsyncSessionT", bound=AsyncSession)

@asynccontextmanager
async def get_db() -> AsyncGenerator[AsyncSession, None]:
    """Dependency for getting async DB session with proper error handling."""
    session = async_session_factory()
    try:
        logger.debug("Creating new database session")
        yield session
        await session.commit()
    except SQLAlchemyError as e:
        logger.error(f"Database error occurred: {e}")
        await session.rollback()
        raise
    finally:
        await session.close()
        logger.debug("Database session closed")

async def init_db() -> None:
    """Initialize database tables."""
    async with engine.begin() as conn:
        await conn.run_sync(Base.metadata.create_all)
    logger.info("Database tables initialized")

async def close_db() -> None:
    """Close database connections."""
    if engine is not None:
        await engine.dispose()
        logger.info("Database connections closed")

# Helper function to execute raw SQL (use with caution)
async def execute_raw_sql(query: str, params: dict = None) -> Any:
    """Execute raw SQL query and return results."""
    async with async_session_factory() as session:
        try:
            result = await session.execute(query, params or {})
            await session.commit()
            return result
        except SQLAlchemyError as e:
            await session.rollback()
            logger.error(f"Error executing raw SQL: {e}")
            raise

#!/usr/bin/env python3
"""Test database connection and models."""
import asyncio
import logging
import sys
from pathlib import Path

# Add the project root to the Python path
sys.path.append(str(Path(__file__).resolve().parent.parent))

from src.database.config import init_db, close_db, get_db
from src.database.models import ContractAnalysis, Vulnerability
from src.utils.config import settings

# Configure logging
logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s - %(name)s - %(levelname)s - %(message)s",
)
logger = logging.getLogger(__name__)

async def test_connection():
    """Test database connection and basic operations."""
    logger.info("Testing database connection...")
    
    try:
        # Initialize database (creates tables)
        logger.info("Initializing database...")
        await init_db()
        
        # Test creating a new analysis
        async with async_session_factory() as session:
            # Create a test analysis
            analysis = ContractAnalysis(
                contract_address="0x" + "1" * 40,  # Test address
                network="mainnet",
                contract_name="TestContract",
                compiler_version="0.8.20",
                is_verified=True,
                security_score=8.5,
                static_analysis={"checks": ["reentrancy", "access_control"], "status": "completed"},
                dynamic_analysis={"simulations": [], "status": "pending"}
            )
            
            # Add a vulnerability
            vulnerability = Vulnerability(
                title="Reentrancy Vulnerability",
                description="Potential reentrancy in withdraw function",
                severity="high",
                category="reentrancy",
                location="contracts/Vault.sol:42-58",
                recommendation="Use checks-effects-interactions pattern",
                swc_id="SWC-107"
            )
            
            analysis.vulnerabilities.append(vulnerability)
            session.add(analysis)
            await session.commit()
            
            logger.info(f"Created analysis with ID: {analysis.id}")
            
            # Query the analysis
            result = await session.get(ContractAnalysis, analysis.id)
            logger.info(f"Retrieved analysis: {result}")
            
            # List vulnerabilities
            logger.info("Vulnerabilities:")
            for vuln in result.vulnerabilities:
                logger.info(f"- {vuln.title} ({vuln.severity})")
            
            return True
            
    except Exception as e:
        logger.error(f"Database test failed: {e}", exc_info=True)
        return False
    finally:
        # Close database connections
        await close_db()

if __name__ == "__main__":
    logger.info("Starting database test...")
    
    # Create event loop and run the test
    loop = asyncio.get_event_loop()
    success = loop.run_until_complete(test_connection())
    
    if success:
        logger.info("Database test completed successfully!")
    else:
        logger.error("Database test failed!")
    
    loop.close()

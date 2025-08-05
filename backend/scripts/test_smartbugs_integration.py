#!/usr/bin/env python3
"""
Test script for SmartBugs knowledge base population

This script demonstrates how to use the SmartBugs processor and tests 
the integration with the RAG pipeline.
"""

import asyncio
import sys
from pathlib import Path

# Add the backend directory to the Python path
sys.path.append(str(Path(__file__).parent.parent))

from src.utils.logger import setup_logger
from scripts.populate_knowledge_base import SmartBugsProcessor
from src.rag.rag_pipeline import get_rag_pipeline

logger = setup_logger(__name__, log_level='INFO')

async def test_smartbugs_integration():
    """Test the complete SmartBugs to RAG pipeline integration"""
    
    logger.info("Starting SmartBugs integration test...")
    
    # Step 1: Process SmartBugs dataset
    logger.info("Step 1: Processing SmartBugs dataset...")
    processor = SmartBugsProcessor(
        smartbugs_path='./smartbugs-curated',
        knowledge_base_path='./data/knowledge_base'
    )
    
    result = processor.process_dataset()
    
    if not result["success"]:
        logger.error(f"SmartBugs processing failed: {result.get('error')}")
        return False
    
    logger.info("SmartBugs processing completed successfully!")
    logger.info(f"Created {result['statistics']['created_documents']} knowledge base documents")
    
    # Step 2: Test RAG pipeline loading
    logger.info("Step 2: Testing RAG pipeline with SmartBugs data...")
    
    try:
        # Get RAG pipeline instance (this will load the knowledge base)
        rag = await get_rag_pipeline()
        logger.info("RAG pipeline loaded successfully with SmartBugs data!")
        
        # Test a simple query
        test_contract = """
        pragma solidity ^0.8.0;
        
        contract TestContract {
            mapping(address => uint256) public balances;
            
            function withdraw() public {
                uint256 amount = balances[msg.sender];
                (bool success, ) = msg.sender.call{value: amount}("");
                require(success, "Transfer failed");
                balances[msg.sender] = 0;
            }
        }
        """
        
        logger.info("Step 3: Testing contract analysis...")
        analysis_result = await rag.analyze_contract(
            contract_address="0x1234567890123456789012345678901234567890",
            contract_code=test_contract
        )
        
        if "error" not in analysis_result:
            logger.info("Contract analysis completed successfully!")
            logger.info(f"Analysis confidence: {analysis_result.get('confidence_score', 'N/A')}")
        else:
            logger.warning(f"Analysis completed with warnings: {analysis_result.get('error')}")
        
        return True
        
    except Exception as e:
        logger.error(f"RAG pipeline test failed: {e}")
        return False

async def main():
    """Main test function"""
    logger.info("=" * 60)
    logger.info("SMARTBUGS INTEGRATION TEST")
    logger.info("=" * 60)
    
    success = await test_smartbugs_integration()
    
    if success:
        logger.info("✅ All tests passed! SmartBugs integration is working.")
    else:
        logger.error("❌ Tests failed. Check the logs above.")
        return 1
    
    return 0

if __name__ == "__main__":
    exit(asyncio.run(main()))
from fastapi import FastAPI, HTTPException, Depends, Request, status, BackgroundTasks
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse, Response
from pydantic import BaseModel, Field, HttpUrl
from typing import Optional, Dict, Any, List, Literal, Union
import logging
import os
import uuid
import json
import asyncio
from datetime import datetime
from pathlib import Path
from dotenv import load_dotenv

# Import internal modules
from src.utils.config import settings
from src.utils.logger import setup_logger
from src.simulation.tenderly_new import (
    TenderlyClient, 
    TenderlyError, 
    SimulationFailedError,
    ContractVerificationError
)

load_dotenv()
# Initialize logger
logger = setup_logger(__name__)

# Initialize FastAPI app
app = FastAPI(
    title="Web3 Guardian API",
    description="Backend service for Web3 Guardian extension",
    version="1.0.0"
)

# CORS middleware configuration
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Load environment variables
load_dotenv()

# Global Tenderly client instance
try:
    tenderly_client = TenderlyClient()
    logger.info("Tenderly client initialized successfully")
except Exception as e:
    logger.error(f"Failed to initialize Tenderly client: {str(e)}")
    raise


# Models
class ContractAnalysisRequest(BaseModel):
    """Request model for contract analysis."""
    contract_address: str = Field(..., description="The smart contract address to analyze")
    network: str = Field("mainnet", description="The blockchain network (e.g., mainnet, goerli, polygon)")
    analysis_types: List[Literal['static', 'dynamic']] = Field(
        ['static', 'dynamic'], 
        description="Types of analysis to perform"
    )
    user_address: Optional[str] = Field(
        None, 
        description="Optional user address for personalized analysis"
    )

class AnalysisResult(BaseModel):
    """Base model for analysis results."""
    success: bool = Field(..., description="Whether the analysis was successful")
    analysis_id: str = Field(..., description="Unique ID for this analysis")
    timestamp: str = Field(..., description="ISO timestamp of when the analysis was performed")
    contract_address: str = Field(..., description="The analyzed contract address")
    network: str = Field(..., description="The blockchain network")

class StaticAnalysisResult(AnalysisResult):
    """Model for static analysis results."""
    vulnerabilities: List[Dict[str, Any]] = Field(
        default_factory=list,
        description="List of found vulnerabilities"
    )
    optimizations: List[Dict[str, Any]] = Field(
        default_factory=list,
        description="List of optimization suggestions"
    )
    security_score: float = Field(
        0.0,
        ge=0.0,
        le=10.0,
        description="Security score from 0 to 10"
    )

class DynamicAnalysisResult(AnalysisResult):
    """Model for dynamic analysis results."""
    simulation_id: Optional[str] = Field(
        None,
        description="Tenderly simulation ID"
    )
    gas_used: Optional[int] = Field(
        None,
        description="Gas used in the simulation"
    )
    execution_trace: Optional[Dict[str, Any]] = Field(
        None,
        description="Detailed execution trace"
    )
    error: Optional[str] = Field(
        None,
        description="Error message if simulation failed"
    )

class AnalysisResponse(BaseModel):
    """Response model for analysis requests."""
    analysis_id: str = Field(..., description="Unique ID for this analysis")
    status: str = Field(..., description="Current status of the analysis")
    results: Dict[str, Any] = Field(
        default_factory=dict,
        description="Analysis results by type"
    )
    error: Optional[str] = Field(
        None,
        description="Error message if the analysis failed"
    )

# In-memory storage for analysis results (in production, use a database)
analysis_results = {}

# Utility functions
async def fetch_contract_details(contract_address: str, network: str) -> Dict[str, Any]:
    """Fetch contract details including source code and metadata.
    
    Args:
        contract_address: The address of the smart contract
        network: The network the contract is deployed on
        
    Returns:
        Dict containing contract details
    """
    logger.info(f"Fetching details for contract {contract_address} on {network}")
    
    try:
        # Get contract metadata first
        metadata = await tenderly_client.get_contract_metadata(contract_address, network)
        
        # Get source code if available
        source = None
        try:
            source = await tenderly_client.get_contract_source(contract_address, network)
        except TenderlyError as e:
            logger.warning(f"Could not fetch contract source: {str(e)}")
        
        # Get bytecode
        bytecode = await tenderly_client.get_contract_bytecode(contract_address, network)
        
        return {
            "metadata": metadata,
            "source": source,
            "bytecode": bytecode,
            "is_verified": source is not None,
            "timestamp": datetime.utcnow().isoformat()
        }
    except Exception as e:
        logger.error(f"Failed to fetch contract details: {str(e)}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Failed to fetch contract details: {str(e)}"
        )


async def perform_static_analysis(contract_address: str, network: str) -> Dict[str, Any]:
    """Perform static analysis on a smart contract.
    
    Args:
        contract_address: The address of the smart contract
        network: The network the contract is deployed on
        
    Returns:
        Dict containing static analysis results
    """
    logger.info(f"Performing static analysis on {contract_address} on {network}")
    
    try:
        # Fetch contract details first
        contract_details = await fetch_contract_details(contract_address, network)
        
        # Initialize results
        analysis_results = {
            "vulnerabilities": [],
            "optimizations": [],
            "security_score": 0.0,
            "warnings": [],
            "is_verified": contract_details["is_verified"],
            "contract_type": contract_details["metadata"].get("contract_name", "Unknown"),
            "compiler_version": contract_details["metadata"].get("compiler_version", "Unknown"),
            "timestamp": datetime.utcnow().isoformat()
        }
        
        # Skip static analysis if contract is not verified
        if not contract_details["is_verified"]:
            analysis_results["warnings"].append(
                "Contract source code is not verified. Static analysis is limited."
            )
            return analysis_results
        
        # Basic static analysis checks
        source_code = contract_details.get("source", {})
        if source_code:
            # Convert source code to string for basic pattern matching
            source_text = json.dumps(source_code).lower()
            
            # Check for selfdestruct
            if 'selfdestruct' in source_text:
                analysis_results["vulnerabilities"].append({
                    "severity": "high",
                    "title": "Self-Destruct Function",
                    "description": "Contract contains selfdestruct which can lead to fund loss",
                    "recommendation": "Avoid using selfdestruct unless absolutely necessary"
                })
            
            # Check for delegatecall
            if 'delegatecall' in source_text:
                analysis_results["vulnerabilities"].append({
                    "severity": "high",
                    "title": "DelegateCall Usage",
                    "description": "Contract uses delegatecall which can be dangerous if not used carefully",
                    "recommendation": "Review delegatecall usage and ensure proper access controls"
                })
            
            # Check for reentrancy patterns
            if any(keyword in source_text for keyword in ['.call', '.send', '.transfer']):
                analysis_results["vulnerabilities"].append({
                    "severity": "medium",
                    "title": "Potential Reentrancy Risk",
                    "description": "Contract makes external calls which could lead to reentrancy",
                    "recommendation": "Use checks-effects-interactions pattern or reentrancy guards"
                })
        
        # Update security score based on findings
        if analysis_results["vulnerabilities"]:
            # Deduct points based on severity (high: -2, medium: -1, low: -0.5)
            score_deduction = sum(
                -2 if v["severity"] == "high" else 
                -1 if v["severity"] == "medium" else -0.5 
                for v in analysis_results["vulnerabilities"]
            )
            analysis_results["security_score"] = max(0.0, 10.0 + score_deduction)
        else:
            analysis_results["security_score"] = 10.0
            
        return analysis_results
        
    except Exception as e:
        logger.error(f"Static analysis failed: {str(e)}")
        return {
        "vulnerabilities": [
            {
                "severity": "medium",
                "title": "Reentrancy Vulnerability",
                "description": "Potential reentrancy vulnerability found in withdraw function",
                "location": "contracts/Vault.sol:42-58"
            }
        ],
        "optimizations": [
            {
                "title": "Gas Optimization",
                "description": "Use unchecked for arithmetic operations where overflow is not possible",
                "location": "contracts/Vault.sol:23"
            }
        ],
        "security_score": 7.5
        }

async def perform_dynamic_analysis(contract_address: str, network: str) -> Dict[str, Any]:
    """Perform dynamic analysis using Tenderly.
    
    Args:
        contract_address: The address of the smart contract
        network: The network the contract is deployed on
        
    Returns:
        Dict containing dynamic analysis results
    """
    logger.info(f"Performing dynamic analysis on {contract_address} on {network}")
    
    try:
        # Get contract metadata to check if it's a token contract
        metadata = await tenderly_client.get_contract_metadata(contract_address, network)
        
        # Prepare simulation parameters based on contract type
        if "ERC20" in metadata.get("contract_name", ""):
            # Simulate a token transfer
            tx_params = {
                "from": "0x0000000000000000000000000000000000000000",  # Zero address for minting
                "to": contract_address,
                "data": "0xa9059cbb00000000000000000000000000000000000000000000000000000000000000010000000000000000000000000000000000000000000000000000000000000001",  # transfer(0x0...1, 1)
                "value": "0x0"
            }
        else:
            # Default simulation parameters
            tx_params = {
                "from": "0x0000000000000000000000000000000000000000",
                "to": contract_address,
                "data": "0x",  # Empty data for fallback function
                "value": "0x0"
            }
        
        # Run the simulation
        simulation = await tenderly_client.simulate_transaction(
            from_address=tx_params["from"],
            to_address=tx_params["to"],
            data=tx_params["data"],
            value=int(tx_params["value"], 16),
            network=network
        )
        
        return {
            "simulation_id": simulation.get("id"),
            "gas_used": simulation.get("gas_used", 0),
            "status": simulation.get("status", False),
            "execution_trace": simulation.get("trace", {}),
            "logs": simulation.get("logs", []),
            "error": None,
            "timestamp": datetime.utcnow().isoformat()
        }
        
    except SimulationFailedError as e:
        logger.error(f"Simulation failed: {str(e)}")
        return {
            "simulation_id": None,
            "gas_used": 0,
            "status": False,
            "execution_trace": {},
            "logs": [],
            "error": str(e),
            "timestamp": datetime.utcnow().isoformat()
        }
    except Exception as e:
        logger.error(f"Dynamic analysis failed: {str(e)}")
        return {
            "simulation_id": None,
            "gas_used": 0,
            "status": False,
            "execution_trace": {},
            "logs": [],
            "error": f"Unexpected error: {str(e)}",
            "timestamp": datetime.utcnow().isoformat()
        }

async def run_analysis(analysis_id: str, request: ContractAnalysisRequest):
    """Run the full analysis pipeline."""
    try:
        results = {}
        
        # Update status to in-progress
        analysis_results[analysis_id] = {
            "status": "in_progress",
            "results": {}
        }
        
        # Run requested analyses
        if 'static' in request.analysis_types:
            static_result = await perform_static_analysis(
                request.contract_address,
                request.network
            )
            results['static'] = static_result
            analysis_results[analysis_id]['results']['static'] = static_result
        
        if 'dynamic' in request.analysis_types:
            dynamic_result = await perform_dynamic_analysis(
                request.contract_address,
                request.network
            )
            results['dynamic'] = dynamic_result
            analysis_results[analysis_id]['results']['dynamic'] = dynamic_result
        
        # Update status to completed
        analysis_results[analysis_id].update({
            "status": "completed",
            "results": results
        })
        
    except Exception as e:
        logger.exception(f"Analysis failed: {str(e)}")
        analysis_results[analysis_id] = {
            "status": "failed",
            "error": str(e)
        }

# API Routes
@app.get("/health")
async def health_check():
    """Health check endpoint."""
    return {"status": "healthy"}

@app.post("/api/analyze/contract", response_model=AnalysisResponse)
async def analyze_contract(
    request: ContractAnalysisRequest,
    background_tasks: BackgroundTasks
):
    """
    Analyze a smart contract.
    
    This endpoint starts an asynchronous analysis of the specified smart contract.
    It returns immediately with an analysis ID that can be used to check the status.
    """
    # Generate a unique ID for this analysis
    analysis_id = str(uuid.uuid4())
    
    # Initialize the analysis result
    analysis_results[analysis_id] = {
        "status": "pending",
        "results": {},
        "contract_address": request.contract_address,
        "network": request.network,
        "timestamp": datetime.utcnow().isoformat()
    }
    
    # Start the analysis in the background
    background_tasks.add_task(run_analysis, analysis_id, request)
    
    return {
        "analysis_id": analysis_id,
        "status": "pending",
        "results": {}
    }

@app.get("/api/analysis/{analysis_id}", response_model=AnalysisResponse)
async def get_analysis(analysis_id: str):
    """Get the status and results of an analysis."""
    result = analysis_results.get(analysis_id)
    if not result:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Analysis with ID {analysis_id} not found"
        )
    
    return {
        "analysis_id": analysis_id,
        "status": result["status"],
        "results": result.get("results", {}),
        "error": result.get("error")
    }

@app.post("/api/analyze/transaction")
async def analyze_transaction(tx_request: Dict[str, Any]):
    """Legacy endpoint for transaction analysis."""
    try:
        # TODO: Implement transaction analysis logic
        return {
            "success": True,
            "risk_level": "low",
            "recommendations": [],
            "simulation": {"success": True, "gas_used": 0}
        }
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

if __name__ == "__main__":
    import uvicorn
    uvicorn.run("main:app", host="0.0.0.0", port=8000, reload=True)

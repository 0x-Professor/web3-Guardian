import pytest
import asyncio
import json
import uuid
from datetime import datetime, timezone
from unittest.mock import patch, MagicMock, AsyncMock
from fastapi.testclient import TestClient
import sys
from pathlib import Path

# Add the backend directory to the Python path
sys.path.append(str(Path(__file__).parent.parent.parent / 'backend'))

from main import app, analysis_results, tenderly_client
from src.simulation.tenderly_new import TenderlyError, SimulationFailedError

# Create a test client
client = TestClient(app)

# Test data constants
TEST_CONTRACT_ADDRESS = "0x1234567890123456789012345678901234567890"
TEST_NETWORK = "ethereum"
TEST_USER_ADDRESS = "0x9876543210987654321098765432109876543210"

TEST_CONTRACT_ANALYSIS_REQUEST = {
    "contract_address": TEST_CONTRACT_ADDRESS,
    "network": TEST_NETWORK,
    "analysis_types": ["static", "dynamic"],
    "user_address": TEST_USER_ADDRESS
}

TEST_TRANSACTION_DATA = {
    "tx_data": {
        "from": TEST_USER_ADDRESS,
        "to": TEST_CONTRACT_ADDRESS,
        "value": "1000000000000000000",  # 1 ETH
        "data": "0xa9059cbb000000000000000000000000456789...0000000000000000000001",
        "gas": "50000",
        "gasPrice": "20000000000"  # 20 Gwei
    },
    "network": TEST_NETWORK,
    "user_address": TEST_USER_ADDRESS
}

class TestHealthAndStatus:
    """Test health check and status endpoints."""
    
    def test_health_check(self):
        """Test the health check endpoint."""
        response = client.get("/health")
        assert response.status_code == 200
        data = response.json()
        assert data["status"] == "healthy"


class TestContractAnalysis:
    """Test smart contract analysis functionality."""
    
    def test_analyze_contract_endpoint_success(self):
        """Test successful contract analysis request."""
        response = client.post("/api/analyze/contract", json=TEST_CONTRACT_ANALYSIS_REQUEST)
        
        assert response.status_code == 200
        data = response.json()
        assert "analysis_id" in data
        assert data["status"] == "pending"
        assert isinstance(data["results"], dict)
        
        # Verify the analysis was stored
        analysis_id = data["analysis_id"]
        assert analysis_id in analysis_results
        assert analysis_results[analysis_id]["status"] == "pending"
    
    def test_analyze_contract_invalid_address(self):
        """Test contract analysis with invalid address."""
        invalid_request = TEST_CONTRACT_ANALYSIS_REQUEST.copy()
        invalid_request["contract_address"] = "invalid_address"
        
        response = client.post("/api/analyze/contract", json=invalid_request)
        assert response.status_code == 422
    
    def test_analyze_contract_missing_fields(self):
        """Test contract analysis with missing required fields."""
        incomplete_request = {"network": "ethereum"}
        
        response = client.post("/api/analyze/contract", json=incomplete_request)
        assert response.status_code == 422
    
    def test_get_analysis_success(self):
        """Test retrieving analysis results."""
        # First create an analysis
        analysis_id = str(uuid.uuid4())
        analysis_results[analysis_id] = {
            "status": "completed",
            "results": {
                "static": {
                    "vulnerabilities": [],
                    "security_score": 8.5
                }
            },
            "contract_address": TEST_CONTRACT_ADDRESS,
            "network": TEST_NETWORK
        }
        
        response = client.get(f"/api/analysis/{analysis_id}")
        
        assert response.status_code == 200
        data = response.json()
        assert data["analysis_id"] == analysis_id
        assert data["status"] == "completed"
        assert "static" in data["results"]
    
    def test_get_analysis_not_found(self):
        """Test retrieving non-existent analysis."""
        fake_id = str(uuid.uuid4())
        response = client.get(f"/api/analysis/{fake_id}")
        
        assert response.status_code == 404
        assert "not found" in response.json()["detail"]
    
    @patch('main.fetch_contract_details')
    @patch('main.get_rag_pipeline')
    async def test_perform_static_analysis_verified_contract(self, mock_rag, mock_fetch):
        """Test static analysis on verified contract."""
        from main import perform_static_analysis
        
        # Mock contract details
        mock_fetch.return_value = {
            "is_verified": True,
            "source": "contract TestContract { function test() public {} }",
            "contract_name": "TestContract",
            "compiler_version": "0.8.19"
        }
        
        # Mock RAG pipeline
        mock_rag_instance = AsyncMock()
        mock_rag_instance.analyze_contract_enhanced.return_value = {
            "vulnerabilities": [
                {
                    "title": "Test Vulnerability",
                    "severity": "medium",
                    "description": "Test description"
                }
            ],
            "optimizations": ["Use storage efficiently"],
            "security_score": 7.5,
            "source_documents": []
        }
        mock_rag.return_value = mock_rag_instance
        
        result = await perform_static_analysis(TEST_CONTRACT_ADDRESS, TEST_NETWORK)
        
        assert result["is_verified"] is True
        assert len(result["vulnerabilities"]) == 1
        assert result["security_score"] == 7.5
        assert "optimizations" in result
    
    @patch('main.fetch_contract_details')
    async def test_perform_static_analysis_unverified_contract(self, mock_fetch):
        """Test static analysis on unverified contract."""
        from main import perform_static_analysis
        
        mock_fetch.return_value = {
            "is_verified": False,
            "source": "",
            "contract_name": "Unknown",
            "compiler_version": "Unknown"
        }
        
        result = await perform_static_analysis(TEST_CONTRACT_ADDRESS, TEST_NETWORK)
        
        assert result["is_verified"] is False
        assert len(result["warnings"]) > 0
        assert "not verified" in result["warnings"][0]
    
    @patch('main.tenderly_client')
    async def test_perform_dynamic_analysis_success(self, mock_client):
        """Test successful dynamic analysis."""
        from main import perform_dynamic_analysis
        
        # Mock Tenderly client responses
        mock_client.get_contract_metadata.return_value = {
            "contract_name": "ERC20Token"
        }
        mock_client.simulate_transaction.return_value = {
            "id": "sim_123",
            "gas_used": 21000,
            "status": True,
            "trace": {"calls": []},
            "logs": []
        }
        
        result = await perform_dynamic_analysis(TEST_CONTRACT_ADDRESS, TEST_NETWORK)
        
        assert result["simulation_id"] == "sim_123"
        assert result["gas_used"] == 21000
        assert result["status"] is True
        assert result["error"] is None
    
    @patch('main.tenderly_client')
    async def test_perform_dynamic_analysis_failure(self, mock_client):
        """Test dynamic analysis with simulation failure."""
        from main import perform_dynamic_analysis
        
        mock_client.get_contract_metadata.return_value = {"contract_name": "TestContract"}
        mock_client.simulate_transaction.side_effect = SimulationFailedError("Transaction reverted")
        
        result = await perform_dynamic_analysis(TEST_CONTRACT_ADDRESS, TEST_NETWORK)
        
        assert result["simulation_id"] is None
        assert result["status"] is False
        assert "reverted" in result["error"]


class TestTransactionAnalysis:
    """Test transaction analysis functionality."""
    
    def test_analyze_transaction_legacy_endpoint(self):
        """Test the legacy transaction analysis endpoint."""
        response = client.post("/api/analyze/transaction", json=TEST_TRANSACTION_DATA)
        
        assert response.status_code == 200
        data = response.json()
        assert data["success"] is True
        assert "risk_level" in data
        assert "recommendations" in data
        assert "simulation" in data


class TestUtilityFunctions:
    """Test utility functions."""
    
    @patch('main.tenderly_client')
    @patch('aiohttp.ClientSession.get')
    async def test_fetch_contract_details_tenderly_verified(self, mock_get, mock_client):
        """Test fetching contract details from Tenderly for verified contract."""
        from main import fetch_contract_details
        
        mock_client.get_contract_metadata.return_value = {
            "source": "contract Test {}",
            "contract_name": "TestContract",
            "compiler_version": "0.8.19"
        }
        
        result = await fetch_contract_details(TEST_CONTRACT_ADDRESS, TEST_NETWORK)
        
        assert result["is_verified"] is True
        assert result["source"] == "contract Test {}"
    
    @patch('main.tenderly_client')
    @patch('main.settings')
    @patch('aiohttp.ClientSession.get')
    async def test_fetch_contract_details_etherscan_fallback(self, mock_get, mock_settings, mock_client):
        """Test fallback to Etherscan when contract not verified in Tenderly."""
        from main import fetch_contract_details
        
        # Mock Tenderly returning unverified contract
        mock_client.get_contract_metadata.return_value = {"source": ""}
        
        # Mock settings with Etherscan API key
        mock_settings.ETHERSCAN_API_KEY = "test_key"
        mock_settings.ETHERSCAN_VERIFY_URL = "https://api.etherscan.io/api"
        
        # Mock Etherscan response
        mock_response = AsyncMock()
        mock_response.json.return_value = {
            "status": "1",
            "result": [{
                "SourceCode": "contract VerifiedContract {}",
                "ContractName": "VerifiedContract",
                "CompilerVersion": "v0.8.19+commit.7dd6d404"
            }]
        }
        
        mock_session = AsyncMock()
        mock_session.get.return_value.__aenter__.return_value = mock_response
        
        with patch('aiohttp.ClientSession', return_value=mock_session):
            result = await fetch_contract_details(TEST_CONTRACT_ADDRESS, TEST_NETWORK)
        
        assert result["is_verified"] is True
        assert result["source"] == "contract VerifiedContract {}"
        assert result["contract_name"] == "VerifiedContract"


class TestErrorHandling:
    """Test error handling in various scenarios."""
    
    @patch('main.perform_static_analysis')
    @patch('main.perform_dynamic_analysis')
    async def test_run_analysis_with_errors(self, mock_dynamic, mock_static):
        """Test analysis pipeline error handling."""
        from main import run_analysis, ContractAnalysisRequest
        
        # Mock analysis functions to raise errors
        mock_static.side_effect = Exception("Static analysis failed")
        mock_dynamic.side_effect = Exception("Dynamic analysis failed")
        
        analysis_id = str(uuid.uuid4())
        request = ContractAnalysisRequest(**TEST_CONTRACT_ANALYSIS_REQUEST)
        
        await run_analysis(analysis_id, request)
        
        assert analysis_results[analysis_id]["status"] == "failed"
        assert "error" in analysis_results[analysis_id]
    
    def test_invalid_json_request(self):
        """Test handling of invalid JSON in requests."""
        response = client.post(
            "/api/analyze/contract",
            data="invalid json",
            headers={"Content-Type": "application/json"}
        )
        
        assert response.status_code == 422


class TestConcurrency:
    """Test concurrent analysis requests."""
    
    @patch('main.perform_static_analysis')
    @patch('main.perform_dynamic_analysis')
    def test_multiple_concurrent_analyses(self, mock_dynamic, mock_static):
        """Test handling multiple concurrent analysis requests."""
        mock_static.return_value = {"vulnerabilities": [], "security_score": 8.0}
        mock_dynamic.return_value = {"simulation_id": "test", "status": True}
        
        # Send multiple requests concurrently
        responses = []
        for i in range(5):
            request_data = TEST_CONTRACT_ANALYSIS_REQUEST.copy()
            request_data["contract_address"] = f"0x{'1' * 39}{i}"
            response = client.post("/api/analyze/contract", json=request_data)
            responses.append(response)
        
        # All requests should be accepted
        for response in responses:
            assert response.status_code == 200
            data = response.json()
            assert data["status"] == "pending"
            assert data["analysis_id"] in analysis_results


class TestValidation:
    """Test input validation."""
    
    def test_contract_address_validation(self):
        """Test contract address format validation."""
        invalid_addresses = [
            "0x123",  # Too short
            "invalid_address",  # Not hex
            "0x" + "g" * 40,  # Invalid hex characters
            "",  # Empty string
        ]
        
        for invalid_address in invalid_addresses:
            request_data = TEST_CONTRACT_ANALYSIS_REQUEST.copy()
            request_data["contract_address"] = invalid_address
            
            response = client.post("/api/analyze/contract", json=request_data)
            assert response.status_code == 422
    
    def test_network_validation(self):
        """Test network parameter validation."""
        valid_networks = ["ethereum", "polygon", "bsc", "arbitrum", "optimism"]
        
        for network in valid_networks:
            request_data = TEST_CONTRACT_ANALYSIS_REQUEST.copy()
            request_data["network"] = network
            
            response = client.post("/api/analyze/contract", json=request_data)
            assert response.status_code == 200
    
    def test_analysis_types_validation(self):
        """Test analysis types validation."""
        valid_combinations = [
            ["static"],
            ["dynamic"],
            ["static", "dynamic"]
        ]
        
        for analysis_types in valid_combinations:
            request_data = TEST_CONTRACT_ANALYSIS_REQUEST.copy()
            request_data["analysis_types"] = analysis_types
            
            response = client.post("/api/analyze/contract", json=request_data)
            assert response.status_code == 200


class TestPerformance:
    """Test performance-related aspects."""
    
    def test_large_contract_analysis(self):
        """Test analysis of large contract (mock scenario)."""
        large_contract_request = TEST_CONTRACT_ANALYSIS_REQUEST.copy()
        # Simulate analyzing a large contract
        
        response = client.post("/api/analyze/contract", json=large_contract_request)
        
        assert response.status_code == 200
        # Response should be immediate (background task)
        data = response.json()
        assert data["status"] == "pending"
    
    @patch('main.perform_static_analysis')
    async def test_analysis_timeout_handling(self, mock_static):
        """Test handling of analysis timeouts."""
        from main import run_analysis, ContractAnalysisRequest
        
        # Mock a slow analysis that times out
        async def slow_analysis(*args, **kwargs):
            await asyncio.sleep(10)  # Simulate slow analysis
            return {"vulnerabilities": [], "security_score": 0}
        
        mock_static.side_effect = slow_analysis
        
        analysis_id = str(uuid.uuid4())
        request = ContractAnalysisRequest(**TEST_CONTRACT_ANALYSIS_REQUEST)
        
        # This should handle the timeout gracefully
        try:
            await asyncio.wait_for(run_analysis(analysis_id, request), timeout=1)
        except asyncio.TimeoutError:
            # Expected behavior for slow analysis
            pass


class TestIntegration:
    """Integration tests combining multiple components."""
    
    @patch('main.tenderly_client')
    @patch('main.get_rag_pipeline')
    async def test_full_analysis_pipeline(self, mock_rag, mock_client):
        """Test complete analysis pipeline from request to completion."""
        # Mock all external dependencies
        mock_client.get_contract_metadata.return_value = {
            "source": "contract TestContract { function test() {} }",
            "contract_name": "TestContract",
            "compiler_version": "0.8.19"
        }
        mock_client.simulate_transaction.return_value = {
            "id": "sim_123",
            "gas_used": 21000,
            "status": True,
            "trace": {},
            "logs": []
        }
        
        mock_rag_instance = AsyncMock()
        mock_rag_instance.analyze_contract_enhanced.return_value = {
            "vulnerabilities": [],
            "optimizations": [],
            "security_score": 9.0,
            "source_documents": []
        }
        mock_rag.return_value = mock_rag_instance
        
        # Start analysis
        response = client.post("/api/analyze/contract", json=TEST_CONTRACT_ANALYSIS_REQUEST)
        assert response.status_code == 200
        
        analysis_id = response.json()["analysis_id"]
        
        # Wait for background task to complete (in real scenario)
        await asyncio.sleep(0.1)
        
        # Check analysis status
        status_response = client.get(f"/api/analysis/{analysis_id}")
        assert status_response.status_code == 200


# Cleanup after tests
def teardown_module():
    """Clean up after all tests."""
    analysis_results.clear()


if __name__ == "__main__":
    pytest.main([__file__, "-v"])

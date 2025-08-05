import pytest
from fastapi.testclient import TestClient
from unittest.mock import patch, MagicMock, AsyncMock
import json
import asyncio
from datetime import datetime

# Add the backend directory to the Python path
import sys
from pathlib import Path
sys.path.append(str(Path(__file__).parent.parent.parent / 'backend'))

from main import app

# Create a test client
client = TestClient(app)

# Test data constants
TEST_TRANSACTION = {
    "tx_data": {
        "from": "0x1234567890123456789012345678901234567890",
        "to": "0x0987654321098765432109876543210987654321",
        "value": "1000000000000000000",  # 1 ETH
        "data": "0x",
        "gas": "21000",
        "gasPrice": "20000000000"  # 20 Gwei
    },
    "network": "ethereum",
    "user_address": "0x1234567890123456789012345678901234567890"
}

TEST_CONTRACT_CODE = """
pragma solidity ^0.8.0;
contract TestContract {
    mapping(address => uint256) public balances;
    
    function deposit() public payable {
        balances[msg.sender] += msg.value;
    }
    
    function withdraw(uint256 amount) public {
        require(balances[msg.sender] >= amount, "Insufficient balance");
        balances[msg.sender] -= amount;
        payable(msg.sender).transfer(amount);
    }
}
"""

TEST_BYTECODE = "0x608060405234801561001057600080fd5b50610150806100206000396000f3fe608060405234801561001057600080fd5b50600436106100365760003560e01c80632e1a7d4d1461003b5780638f4ffcb114610057575b600080fd5b6100556004803603810190610050919061009a565b610075565b005b61005f6100f7565b60405161006c91906100d6565b60405180910390f35b80600080335"

class TestHealthAndStatus:
    """Test health check and status endpoints."""
    
    def test_health_check(self):
        """Test the health check endpoint."""
        response = client.get("/health")
        assert response.status_code == 200
        data = response.json()
        assert data["status"] == "healthy"
        assert "timestamp" in data
        assert "version" in data
        assert "uptime" in data

    def test_status_endpoint(self):
        """Test the status endpoint."""
        response = client.get("/api/status")
        assert response.status_code == 200
        data = response.json()
        assert "system" in data
        assert "api" in data
        assert "database" in data
        assert "redis" in data

    def test_metrics_endpoint(self):
        """Test the metrics endpoint."""
        response = client.get("/metrics")
        assert response.status_code == 200
        # Metrics should be in Prometheus format
        assert "web3guardian_" in response.text


class TestTransactionAnalysis:
    """Test transaction analysis functionality."""
    
    @patch('main.analyze_transaction')
    def test_analyze_transaction_success(self, mock_analyze):
        """Test successful transaction analysis."""
        mock_result = {
            "risk_level": "low",
            "risk_score": 0.2,
            "recommendations": ["Consider using a lower gas price"],
            "vulnerabilities": [],
            "simulation": {
                "success": True,
                "gas_used": 21000,
                "gas_estimate": 21000,
                "error": None
            },
            "analysis_time": 1.5,
            "timestamp": datetime.now().isoformat()
        }
        mock_analyze.return_value = mock_result
        
        response = client.post("/api/analyze", json=TEST_TRANSACTION)
        
        assert response.status_code == 200
        data = response.json()
        assert data["risk_level"] == "low"
        assert data["risk_score"] == 0.2
        assert "recommendations" in data
        assert "simulation" in data
        mock_analyze.assert_called_once_with(TEST_TRANSACTION)

    def test_analyze_transaction_invalid_address(self):
        """Test analysis with invalid address format."""
        invalid_tx = TEST_TRANSACTION.copy()
        invalid_tx["tx_data"]["to"] = "invalid_address"
        
        response = client.post("/api/analyze", json=invalid_tx)
        assert response.status_code == 422

    def test_analyze_transaction_missing_fields(self):
        """Test analysis with missing required fields."""
        invalid_data = {"tx_data": {"from": "0x123"}}
        response = client.post("/api/analyze", json=invalid_data)
        assert response.status_code == 422

    @patch('main.analyze_transaction')
    def test_analyze_transaction_high_risk(self, mock_analyze):
        """Test high-risk transaction analysis."""
        mock_result = {
            "risk_level": "high",
            "risk_score": 0.9,
            "recommendations": [
                "Do not proceed with this transaction",
                "Contract appears to be malicious"
            ],
            "vulnerabilities": [
                {
                    "type": "reentrancy",
                    "severity": "critical",
                    "description": "Potential reentrancy vulnerability detected"
                }
            ],
            "simulation": {
                "success": False,
                "gas_used": 0,
                "error": "Transaction would revert"
            }
        }
        mock_analyze.return_value = mock_result
        
        response = client.post("/api/analyze", json=TEST_TRANSACTION)
        
        assert response.status_code == 200
        data = response.json()
        assert data["risk_level"] == "high"
        assert data["risk_score"] == 0.9
        assert len(data["vulnerabilities"]) > 0

    @patch('main.analyze_transaction')
    def test_analyze_transaction_timeout(self, mock_analyze):
        """Test analysis timeout handling."""
        mock_analyze.side_effect = asyncio.TimeoutError("Analysis timeout")
        
        response = client.post("/api/analyze", json=TEST_TRANSACTION)
        
        assert response.status_code == 408
        assert "timeout" in response.json()["detail"].lower()

    @patch('main.analyze_transaction')
    def test_analyze_transaction_error(self, mock_analyze):
        """Test error handling in transaction analysis."""
        mock_analyze.side_effect = Exception("Analysis failed")
        
        response = client.post("/api/analyze", json=TEST_TRANSACTION)
        
        assert response.status_code == 500
        assert "detail" in response.json()


class TestContractAnalysis:
    """Test smart contract analysis functionality."""
    
    @patch('main.analyze_contract')
    def test_analyze_contract_by_address(self, mock_analyze):
        """Test contract analysis by address."""
        mock_result = {
            "contract_address": "0x123...",
            "contract_name": "TestContract",
            "vulnerabilities": [],
            "risk_level": "low",
            "audit_score": 8.5,
            "functions": [
                {
                    "name": "deposit",
                    "visibility": "public",
                    "payable": True,
                    "risk_level": "low"
                }
            ]
        }
        mock_analyze.return_value = mock_result
        
        response = client.post("/api/analyze/contract", json={
            "address": "0x1234567890123456789012345678901234567890",
            "network": "ethereum"
        })
        
        assert response.status_code == 200
        data = response.json()
        assert data["risk_level"] == "low"
        assert "functions" in data

    @patch('main.analyze_contract_code')
    def test_analyze_contract_code(self, mock_analyze):
        """Test contract code analysis."""
        mock_result = {
            "vulnerabilities": [
                {
                    "type": "reentrancy",
                    "severity": "medium",
                    "line": 15,
                    "description": "Potential reentrancy in withdraw function"
                }
            ],
            "risk_level": "medium",
            "audit_score": 6.5,
            "gas_optimization": [
                "Use storage variables efficiently",
                "Consider using events for logging"
            ]
        }
        mock_analyze.return_value = mock_result
        
        response = client.post("/api/analyze/contract/code", json={
            "source_code": TEST_CONTRACT_CODE,
            "compiler_version": "0.8.19"
        })
        
        assert response.status_code == 200
        data = response.json()
        assert data["risk_level"] == "medium"
        assert len(data["vulnerabilities"]) > 0

    @patch('main.analyze_bytecode')
    def test_analyze_bytecode(self, mock_analyze):
        """Test bytecode analysis."""
        mock_result = {
            "functions": ["deposit", "withdraw", "balances"],
            "vulnerabilities": [],
            "complexity_score": 3.2,
            "risk_level": "low"
        }
        mock_analyze.return_value = mock_result
        
        response = client.post("/api/analyze/bytecode", json={
            "bytecode": TEST_BYTECODE
        })
        
        assert response.status_code == 200
        data = response.json()
        assert "functions" in data
        assert data["risk_level"] == "low"


class TestSimulation:
    """Test transaction simulation functionality."""
    
    @patch('main.simulate_transaction')
    def test_simulate_transaction_success(self, mock_simulate):
        """Test successful transaction simulation."""
        mock_result = {
            "success": True,
            "gas_used": 21000,
            "gas_estimate": 21000,
            "error": None,
            "trace": [
                {
                    "action": "call",
                    "from": "0x123...",
                    "to": "0x456...",
                    "value": "1000000000000000000",
                    "gas": 21000
                }
            ],
            "state_changes": [],
            "events": []
        }
        mock_simulate.return_value = mock_result
        
        response = client.post("/api/simulate", json={
            "tx_data": TEST_TRANSACTION["tx_data"],
            "network": "ethereum"
        })
        
        assert response.status_code == 200
        data = response.json()
        assert data["success"] is True
        assert data["gas_used"] == 21000
        assert "trace" in data

    @patch('main.simulate_transaction')
    def test_simulate_transaction_failure(self, mock_simulate):
        """Test failed transaction simulation."""
        mock_result = {
            "success": False,
            "gas_used": 0,
            "error": "Transaction reverted",
            "revert_reason": "Insufficient balance",
            "trace": []
        }
        mock_simulate.return_value = mock_result
        
        response = client.post("/api/simulate", json={
            "tx_data": TEST_TRANSACTION["tx_data"]
        })
        
        assert response.status_code == 200
        data = response.json()
        assert data["success"] is False
        assert "error" in data

    @patch('src.simulation.tenderly_new.TenderlySimulator')
    def test_simulate_with_tenderly(self, mock_tenderly):
        """Test simulation using Tenderly."""
        mock_simulator = MagicMock()
        mock_simulator.simulate_transaction.return_value = {
            "success": True,
            "gas_used": 25000,
            "trace": []
        }
        mock_tenderly.return_value = mock_simulator
        
        response = client.post("/api/simulate/tenderly", json={
            "tx_data": TEST_TRANSACTION["tx_data"],
            "network": "ethereum"
        })
        
        assert response.status_code == 200


class TestGasOptimization:
    """Test gas optimization functionality."""
    
    @patch('web3.eth.Eth.gas_price')
    @patch('web3.eth.Eth.get_block')
    def test_get_gas_prices(self, mock_get_block, mock_gas_price):
        """Test gas price retrieval."""
        mock_gas_price.return_value = 20000000000  # 20 Gwei
        mock_block = MagicMock()
        mock_block.baseFeePerGas = 15000000000  # 15 Gwei
        mock_get_block.return_value = mock_block
        
        response = client.get("/api/gas/prices")
        
        assert response.status_code == 200
        data = response.json()
        assert "current" in data
        assert "base_fee" in data
        assert "priority_fee" in data
        assert "recommendations" in data

    @patch('main.optimize_gas')
    def test_optimize_transaction_gas(self, mock_optimize):
        """Test gas optimization for transactions."""
        mock_result = {
            "original_gas": 50000,
            "optimized_gas": 35000,
            "savings": 15000,
            "savings_percentage": 30.0,
            "optimizations": [
                "Remove unnecessary storage operations",
                "Use memory instead of storage where possible"
            ]
        }
        mock_optimize.return_value = mock_result
        
        response = client.post("/api/gas/optimize", json={
            "tx_data": TEST_TRANSACTION["tx_data"]
        })
        
        assert response.status_code == 200
        data = response.json()
        assert data["savings"] > 0
        assert data["savings_percentage"] > 0

    def test_gas_estimation(self):
        """Test gas estimation endpoint."""
        response = client.post("/api/gas/estimate", json={
            "tx_data": TEST_TRANSACTION["tx_data"]
        })
        
        assert response.status_code == 200
        data = response.json()
        assert "gas_estimate" in data
        assert "gas_price_options" in data


class TestRealTimeUpdates:
    """Test real-time update functionality."""
    
    def test_websocket_connection(self):
        """Test WebSocket connection establishment."""
        with client.websocket_connect("/ws/updates") as websocket:
            data = websocket.receive_json()
            assert data["type"] == "connection_established"

    def test_websocket_transaction_updates(self):
        """Test real-time transaction updates via WebSocket."""
        with client.websocket_connect("/ws/transactions") as websocket:
            # Send a transaction for monitoring
            websocket.send_json({
                "action": "monitor",
                "tx_hash": "0x123..."
            })
            
            # Should receive acknowledgment
            response = websocket.receive_json()
            assert response["type"] == "monitoring_started"


class TestRateLimit:
    """Test API rate limiting."""
    
    def test_rate_limit_exceeded(self):
        """Test rate limit enforcement."""
        # Make many requests quickly to trigger rate limit
        responses = []
        for _ in range(110):  # Exceed default limit of 100/hour
            response = client.get("/health")
            responses.append(response.status_code)
        
        # Should get rate limited
        assert 429 in responses

    def test_rate_limit_headers(self):
        """Test rate limit headers in response."""
        response = client.get("/health")
        
        assert "X-RateLimit-Limit" in response.headers
        assert "X-RateLimit-Remaining" in response.headers
        assert "X-RateLimit-Reset" in response.headers


class TestAPIKeyAuth:
    """Test API key authentication."""
    
    def test_missing_api_key(self):
        """Test request without API key."""
        response = client.post("/api/analyze", 
                             json=TEST_TRANSACTION,
                             headers={})
        assert response.status_code == 401

    def test_invalid_api_key(self):
        """Test request with invalid API key."""
        response = client.post("/api/analyze",
                             json=TEST_TRANSACTION,
                             headers={"X-API-Key": "invalid_key"})
        assert response.status_code == 401

    @patch('main.validate_api_key')
    def test_valid_api_key(self, mock_validate):
        """Test request with valid API key."""
        mock_validate.return_value = True
        
        with patch('main.analyze_transaction') as mock_analyze:
            mock_analyze.return_value = {"risk_level": "low"}
            
            response = client.post("/api/analyze",
                                 json=TEST_TRANSACTION,
                                 headers={"X-API-Key": "valid_key"})
            assert response.status_code == 200


class TestErrorHandling:
    """Test error handling and edge cases."""
    
    def test_malformed_json(self):
        """Test handling of malformed JSON."""
        response = client.post("/api/analyze",
                             data="invalid json",
                             headers={"Content-Type": "application/json"})
        assert response.status_code == 422

    def test_network_not_supported(self):
        """Test unsupported network handling."""
        invalid_tx = TEST_TRANSACTION.copy()
        invalid_tx["network"] = "unsupported_network"
        
        response = client.post("/api/analyze", json=invalid_tx)
        assert response.status_code == 400

    def test_internal_server_error(self):
        """Test internal server error handling."""
        with patch('main.analyze_transaction') as mock_analyze:
            mock_analyze.side_effect = Exception("Internal error")
            
            response = client.post("/api/analyze", json=TEST_TRANSACTION)
            assert response.status_code == 500
            assert "detail" in response.json()

import pytest
from fastapi.testclient import TestClient
from unittest.mock import patch, MagicMock
import json

# Add the backend directory to the Python path
import sys
from pathlib import Path
sys.path.append(str(Path(__file__).parent.parent.parent / 'backend'))

from main import app

# Create a test client
client = TestClient(app)

# Test data
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

class TestMain:
    def test_health_check(self):
        """Test the health check endpoint."""
        response = client.get("/health")
        assert response.status_code == 200
        assert response.json() == {"status": "healthy"}
    
    @patch('main.analyze_transaction')
    def test_analyze_transaction(self, mock_analyze):
        """Test the transaction analysis endpoint."""
        # Mock the analysis result
        mock_result = {
            "risk_level": "low",
            "recommendations": [],
            "simulation": {"success": True, "gas_used": 21000}
        }
        mock_analyze.return_value = mock_result
        
        # Make the request
        response = client.post("/api/analyze", json=TEST_TRANSACTION)
        
        # Verify the response
        assert response.status_code == 200
        assert response.json() == mock_result
        mock_analyze.assert_called_once_with(TEST_TRANSACTION)
    
    def test_analyze_transaction_invalid_input(self):
        """Test the transaction analysis with invalid input."""
        # Missing required fields
        invalid_data = {"tx_data": {}}
        response = client.post("/api/analyze", json=invalid_data)
        assert response.status_code == 422  # Validation error
    
    @patch('main.analyze_transaction')
    def test_analyze_transaction_error(self, mock_analyze):
        """Test error handling in the transaction analysis endpoint."""
        # Mock an exception
        mock_analyze.side_effect = Exception("Test error")
        
        # Make the request
        response = client.post("/api/analyze", json=TEST_TRANSACTION)
        
        # Verify the error response
        assert response.status_code == 500
        assert "detail" in response.json()
        assert "Test error" in response.json()["detail"]
    
    @patch('main.simulate_transaction')
    def test_simulate_transaction(self, mock_simulate):
        """Test the transaction simulation endpoint."""
        # Mock the simulation result
        mock_result = {
            "success": True,
            "gas_used": 21000,
            "error": None,
            "trace": []
        }
        mock_simulate.return_value = mock_result
        
        # Make the request
        response = client.post(
            "/api/simulate",
            json={"tx_data": TEST_TRANSACTION["tx_data"]}
        )
        
        # Verify the response
        assert response.status_code == 200
        assert response.json() == mock_result
        mock_simulate.assert_called_once()
    
    @patch('web3.eth.Eth.get_block')
    @patch('web3.eth.Eth.gas_price')
    def test_gas_prices(self, mock_gas_price, mock_get_block):
        """Test the gas prices endpoint."""
        # Mock the Web3 responses
        mock_gas_price.return_value = 20000000000  # 20 Gwei
        mock_block = MagicMock()
        mock_block.get.return_value = 15000000  # Block number
        mock_get_block.return_value = mock_block
        
        # Make the request
        response = client.get("/api/gas/prices")
        
        # Verify the response
        assert response.status_code == 200
        data = response.json()
        assert "current" in data
        assert "base_fee" in data
        assert "priority_fee" in data
        assert data["current"] == 20000000000

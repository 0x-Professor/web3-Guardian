import pytest
from fastapi.testclient import TestClient
from unittest.mock import patch, MagicMock, AsyncMock
import json
import asyncio
from datetime import datetime, timezone

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
        "data": "0xa9059cbb000000000000000000000000742d35cc6b1d3c2db0e08a1a7e5e7b3c2e8f1a2b3c4d000000000000000000000000000000000000000000000000000000000000000a",
        "gas": "21000",
        "gasPrice": "20000000000",  # 20 Gwei
        "nonce": "42",
        "chainId": "1"
    },
    "network": "ethereum",
    "user_address": "0x1234567890123456789012345678901234567890"
}

TEST_CONTRACT_DATA = {
    "address": "0x742d35cc6b1d3c2db0e08a1a7e5e7b3c2e8f1a2b",
    "bytecode": "0x608060405234801561001057600080fd5b50...",
    "abi": [{"type": "function", "name": "transfer", "inputs": [{"name": "to", "type": "address"}, {"name": "value", "type": "uint256"}]}]
}

class TestHealthEndpoints:
    def test_health_check(self):
        """Test the health check endpoint."""
        response = client.get("/health")
        assert response.status_code == 200
        data = response.json()
        assert data["status"] == "healthy"
        assert "timestamp" in data
        assert "version" in data
        assert "database" in data
        assert "cache" in data

    def test_metrics_endpoint(self):
        """Test the metrics endpoint."""
        response = client.get("/metrics")
        assert response.status_code == 200
        # Prometheus metrics should be in text format
        assert response.headers.get("content-type") == "text/plain; version=0.0.4; charset=utf-8"

class TestTransactionAnalysis:
    @patch('main.analyze_transaction_comprehensive')
    def test_analyze_transaction_success(self, mock_analyze):
        """Test successful transaction analysis."""
        mock_result = {
            "transaction_id": "tx_123456",
            "timestamp": datetime.now(timezone.utc).isoformat(),
            "risk_assessment": {
                "overall_risk": "medium",
                "risk_score": 6.5,
                "risk_factors": [
                    {"type": "high_value", "severity": "medium", "description": "High value transaction"},
                    {"type": "new_contract", "severity": "low", "description": "Interacting with new contract"}
                ]
            },
            "security_analysis": {
                "vulnerabilities": [],
                "contract_verified": True,
                "honeypot_check": False,
                "rug_pull_indicators": []
            },
            "simulation_results": {
                "success": True,
                "gas_used": 35000,
                "gas_estimate": 40000,
                "state_changes": [
                    {"type": "balance_change", "address": "0x123...", "amount": "-1000000000000000000"},
                    {"type": "balance_change", "address": "0x456...", "amount": "1000000000000000000"}
                ]
            },
            "recommendations": [
                {
                    "type": "gas_optimization",
                    "message": "Consider reducing gas price to save costs",
                    "priority": "low"
                }
            ],
            "ai_insights": "This appears to be a standard ERC-20 transfer with medium risk due to high value."
        }
        mock_analyze.return_value = mock_result
        
        response = client.post("/api/analyze", json=TEST_TRANSACTION)
        
        assert response.status_code == 200
        data = response.json()
        assert data["risk_assessment"]["overall_risk"] == "medium"
        assert data["simulation_results"]["success"] is True
        assert len(data["recommendations"]) > 0
        mock_analyze.assert_called_once()

    def test_analyze_transaction_invalid_input(self):
        """Test transaction analysis with invalid input."""
        # Missing required fields
        invalid_data = {"tx_data": {}}
        response = client.post("/api/analyze", json=invalid_data)
        assert response.status_code == 422

        # Invalid address format
        invalid_address_data = {
            "tx_data": {
                "from": "invalid_address",
                "to": "0x123",
                "value": "1000000000000000000"
            }
        }
        response = client.post("/api/analyze", json=invalid_address_data)
        assert response.status_code == 422

    @patch('main.analyze_transaction_comprehensive')
    def test_analyze_transaction_error_handling(self, mock_analyze):
        """Test error handling in transaction analysis."""
        mock_analyze.side_effect = Exception("Analysis service unavailable")
        
        response = client.post("/api/analyze", json=TEST_TRANSACTION)
        
        assert response.status_code == 500
        assert "detail" in response.json()
        assert "Analysis service unavailable" in response.json()["detail"]

    @patch('main.analyze_batch_transactions')
    def test_batch_analysis(self, mock_batch_analyze):
        """Test batch transaction analysis."""
        batch_data = {
            "transactions": [TEST_TRANSACTION, TEST_TRANSACTION],
            "options": {"include_simulation": True, "risk_threshold": "medium"}
        }
        
        mock_result = {
            "batch_id": "batch_123",
            "total_transactions": 2,
            "results": [
                {"transaction_id": "tx_1", "risk_assessment": {"overall_risk": "low"}},
                {"transaction_id": "tx_2", "risk_assessment": {"overall_risk": "medium"}}
            ],
            "summary": {
                "high_risk": 0,
                "medium_risk": 1,
                "low_risk": 1,
                "total_gas_estimate": 70000
            }
        }
        mock_batch_analyze.return_value = mock_result
        
        response = client.post("/api/analyze/batch", json=batch_data)
        
        assert response.status_code == 200
        data = response.json()
        assert data["total_transactions"] == 2
        assert len(data["results"]) == 2
        assert "summary" in data

class TestContractAnalysis:
    @patch('main.analyze_smart_contract')
    def test_contract_analysis(self, mock_analyze_contract):
        """Test smart contract analysis."""
        mock_result = {
            "contract_address": TEST_CONTRACT_DATA["address"],
            "analysis_timestamp": datetime.now(timezone.utc).isoformat(),
            "security_score": 8.5,
            "vulnerabilities": [
                {
                    "type": "reentrancy",
                    "severity": "medium",
                    "line": 45,
                    "description": "Potential reentrancy vulnerability",
                    "recommendation": "Use ReentrancyGuard"
                }
            ],
            "gas_analysis": {
                "optimization_score": 7.2,
                "expensive_operations": ["SSTORE", "CALL"],
                "suggestions": ["Cache storage variables", "Use events for logging"]
            },
            "audit_findings": {
                "total_issues": 3,
                "critical": 0,
                "high": 0,
                "medium": 1,
                "low": 2,
                "informational": 0
            },
            "contract_metadata": {
                "verified": True,
                "compiler_version": "0.8.19",
                "license": "MIT",
                "proxy_contract": False
            }
        }
        mock_analyze_contract.return_value = mock_result
        
        response = client.post("/api/contracts/analyze", json=TEST_CONTRACT_DATA)
        
        assert response.status_code == 200
        data = response.json()
        assert data["security_score"] == 8.5
        assert len(data["vulnerabilities"]) == 1
        assert data["audit_findings"]["total_issues"] == 3

    @patch('main.get_contract_info')
    def test_get_contract_info(self, mock_get_info):
        """Test getting contract information."""
        mock_info = {
            "address": TEST_CONTRACT_DATA["address"],
            "name": "TestToken",
            "symbol": "TT",
            "total_supply": "1000000000000000000000000",
            "decimals": 18,
            "verified": True,
            "creation_block": 12345678,
            "creator": "0x742d35cc6b1d3c2db0e08a1a7e5e7b3c2e8f1a2b"
        }
        mock_get_info.return_value = mock_info
        
        response = client.get(f"/api/contracts/{TEST_CONTRACT_DATA['address']}")
        
        assert response.status_code == 200
        data = response.json()
        assert data["name"] == "TestToken"
        assert data["verified"] is True

class TestSimulation:
    @patch('main.simulate_transaction_advanced')
    def test_simulate_transaction(self, mock_simulate):
        """Test transaction simulation."""
        mock_result = {
            "simulation_id": "sim_123456",
            "timestamp": datetime.now(timezone.utc).isoformat(),
            "success": True,
            "gas_used": 35247,
            "gas_estimate": 40000,
            "execution_trace": [
                {"op": "CALL", "gas": 35000, "depth": 1},
                {"op": "SSTORE", "gas": 20000, "depth": 1},
                {"op": "LOG1", "gas": 375, "depth": 1}
            ],
            "state_changes": [
                {
                    "type": "balance",
                    "address": "0x1234567890123456789012345678901234567890",
                    "before": "5000000000000000000",
                    "after": "4000000000000000000",
                    "diff": "-1000000000000000000"
                },
                {
                    "type": "storage",
                    "address": "0x0987654321098765432109876543210987654321",
                    "slot": "0x0",
                    "before": "0x0",
                    "after": "0x1234567890123456789012345678901234567890"
                }
            ],
            "events": [
                {
                    "address": "0x0987654321098765432109876543210987654321",
                    "topics": ["0xddf252ad1be2c89b69c2b068fc378daa952ba7f163c4a11628f55a4df523b3ef"],
                    "data": "0x000000000000000000000000000000000000000000000000000000000000000a"
                }
            ],
            "revert_reason": None,
            "performance_metrics": {
                "execution_time": "0.125s",
                "memory_usage": "2.4MB",
                "cpu_usage": "15%"
            }
        }
        mock_simulate.return_value = mock_result
        
        response = client.post("/api/simulate", json={"tx_data": TEST_TRANSACTION["tx_data"]})
        
        assert response.status_code == 200
        data = response.json()
        assert data["success"] is True
        assert data["gas_used"] == 35247
        assert len(data["state_changes"]) == 2
        assert len(data["events"]) == 1

    @patch('main.simulate_transaction_advanced')
    def test_simulate_transaction_failure(self, mock_simulate):
        """Test failed transaction simulation."""
        mock_result = {
            "simulation_id": "sim_failed_123",
            "timestamp": datetime.now(timezone.utc).isoformat(),
            "success": False,
            "gas_used": 0,
            "revert_reason": "Insufficient balance",
            "execution_trace": [
                {"op": "CALL", "gas": 21000, "depth": 1, "error": "InsufficientBalance"}
            ],
            "state_changes": [],
            "events": []
        }
        mock_simulate.return_value = mock_result
        
        response = client.post("/api/simulate", json={"tx_data": TEST_TRANSACTION["tx_data"]})
        
        assert response.status_code == 200
        data = response.json()
        assert data["success"] is False
        assert data["revert_reason"] == "Insufficient balance"

class TestGasOptimization:
    @patch('main.get_gas_prices')
    def test_gas_prices(self, mock_gas_prices):
        """Test gas price endpoint."""
        mock_prices = {
            "timestamp": datetime.now(timezone.utc).isoformat(),
            "network": "ethereum",
            "prices": {
                "slow": {"price": 15000000000, "time": "5-10 min"},
                "standard": {"price": 20000000000, "time": "2-5 min"},
                "fast": {"price": 25000000000, "time": "< 2 min"},
                "instant": {"price": 30000000000, "time": "< 30 sec"}
            },
            "base_fee": 18000000000,
            "priority_fee": {
                "slow": 1000000000,
                "standard": 2000000000,
                "fast": 3000000000,
                "instant": 5000000000
            }
        }
        mock_gas_prices.return_value = mock_prices
        
        response = client.get("/api/gas/prices")
        
        assert response.status_code == 200
        data = response.json()
        assert "prices" in data
        assert "base_fee" in data
        assert data["prices"]["standard"]["price"] == 20000000000

    @patch('main.optimize_gas')
    def test_gas_optimization(self, mock_optimize):
        """Test gas optimization endpoint."""
        mock_result = {
            "original_gas": 50000,
            "optimized_gas": 42000,
            "savings": 8000,
            "savings_percentage": 16.0,
            "optimizations": [
                {
                    "type": "batch_operations",
                    "description": "Combine multiple storage operations",
                    "gas_saved": 5000
                },
                {
                    "type": "storage_packing",
                    "description": "Pack struct variables efficiently",
                    "gas_saved": 3000
                }
            ],
            "estimated_cost_savings": {
                "eth": "0.000008",
                "usd": "0.016"
            }
        }
        mock_optimize.return_value = mock_result
        
        response = client.post("/api/gas/optimize", json={"tx_data": TEST_TRANSACTION["tx_data"]})
        
        assert response.status_code == 200
        data = response.json()
        assert data["original_gas"] == 50000
        assert data["optimized_gas"] == 42000
        assert data["savings_percentage"] == 16.0

class TestWebSocketEndpoints:
    @pytest.mark.asyncio
    async def test_websocket_connection(self):
        """Test WebSocket connection and message handling."""
        with client.websocket_connect("/ws") as websocket:
            # Send a test message
            test_message = {
                "type": "subscribe",
                "channel": "transactions",
                "user_id": "test_user_123"
            }
            websocket.send_json(test_message)
            
            # Receive acknowledgment
            response = websocket.receive_json()
            assert response["type"] == "subscription_confirmed"
            assert response["channel"] == "transactions"

    @pytest.mark.asyncio
    async def test_websocket_real_time_analysis(self):
        """Test real-time transaction analysis via WebSocket."""
        with client.websocket_connect("/ws") as websocket:
            # Subscribe to analysis updates
            websocket.send_json({
                "type": "subscribe",
                "channel": "analysis_updates"
            })
            
            # Send transaction for analysis
            websocket.send_json({
                "type": "analyze_transaction",
                "data": TEST_TRANSACTION
            })
            
            # Receive analysis result
            response = websocket.receive_json()
            assert response["type"] == "analysis_result"
            assert "risk_assessment" in response["data"]

class TestUserManagement:
    def test_create_user_session(self):
        """Test creating a user session."""
        user_data = {
            "wallet_address": "0x1234567890123456789012345678901234567890",
            "preferences": {
                "risk_tolerance": "medium",
                "notifications": True,
                "auto_approve_low_risk": False
            }
        }
        
        response = client.post("/api/users/session", json=user_data)
        
        assert response.status_code == 201
        data = response.json()
        assert "session_id" in data
        assert data["wallet_address"] == user_data["wallet_address"]

    def test_get_user_preferences(self):
        """Test getting user preferences."""
        session_id = "test_session_123"
        
        with patch('main.get_user_session') as mock_get_session:
            mock_get_session.return_value = {
                "session_id": session_id,
                "wallet_address": "0x1234567890123456789012345678901234567890",
                "preferences": {
                    "risk_tolerance": "high",
                    "notifications": True
                }
            }
            
            response = client.get(f"/api/users/{session_id}/preferences")
            
            assert response.status_code == 200
            data = response.json()
            assert data["risk_tolerance"] == "high"

class TestAnalyticsAndReporting:
    @patch('main.get_analytics_dashboard')
    def test_analytics_dashboard(self, mock_dashboard):
        """Test analytics dashboard endpoint."""
        mock_data = {
            "period": "24h",
            "total_transactions": 1250,
            "risk_distribution": {
                "low": 950,
                "medium": 250,
                "high": 50
            },
            "top_risks": [
                {"type": "high_value", "count": 45},
                {"type": "new_contract", "count": 23},
                {"type": "unusual_pattern", "count": 12}
            ],
            "gas_savings": {
                "total_saved": "0.125 ETH",
                "average_per_tx": "0.0001 ETH"
            },
            "performance_metrics": {
                "avg_analysis_time": "1.2s",
                "success_rate": "99.8%"
            }
        }
        mock_dashboard.return_value = mock_data
        
        response = client.get("/api/analytics/dashboard")
        
        assert response.status_code == 200
        data = response.json()
        assert data["total_transactions"] == 1250
        assert "risk_distribution" in data
        assert "performance_metrics" in data

    @patch('main.generate_security_report')
    def test_security_report(self, mock_report):
        """Test security report generation."""
        mock_report_data = {
            "report_id": "report_123456",
            "generated_at": datetime.now(timezone.utc).isoformat(),
            "period": {"start": "2025-07-01", "end": "2025-08-01"},
            "summary": {
                "total_transactions_analyzed": 5000,
                "threats_detected": 25,
                "threats_prevented": 23,
                "false_positives": 2
            },
            "threat_breakdown": {
                "malicious_contracts": 8,
                "phishing_attempts": 7,
                "rug_pulls": 5,
                "honeypots": 3,
                "other": 2
            },
            "recommendations": [
                "Increase monitoring for new contract interactions",
                "Implement additional checks for high-value transactions"
            ]
        }
        mock_report.return_value = mock_report_data
        
        response = client.get("/api/reports/security?period=30d")
        
        assert response.status_code == 200
        data = response.json()
        assert data["summary"]["total_transactions_analyzed"] == 5000
        assert len(data["recommendations"]) == 2

class TestErrorHandling:
    def test_404_error(self):
        """Test 404 error handling."""
        response = client.get("/api/nonexistent-endpoint")
        assert response.status_code == 404
        assert "detail" in response.json()

    def test_rate_limiting(self):
        """Test rate limiting functionality."""
        # Make multiple requests rapidly
        responses = []
        for i in range(5):
            response = client.get("/health")
            responses.append(response)
        
        # All should succeed under normal rate limits
        assert all(r.status_code == 200 for r in responses)

    @patch('main.analyze_transaction_comprehensive')
    def test_timeout_handling(self, mock_analyze):
        """Test timeout handling for long-running operations."""
        import asyncio
        
        async def slow_analysis(*args, **kwargs):
            await asyncio.sleep(10)  # Simulate slow operation
            return {"risk_level": "low"}
        
        mock_analyze.side_effect = slow_analysis
        
        response = client.post("/api/analyze", json=TEST_TRANSACTION, timeout=5)
        
        # Should handle timeout gracefully
        assert response.status_code in [408, 504]  # Timeout or Gateway Timeout

if __name__ == "__main__":
    pytest.main([__file__, "-v"])

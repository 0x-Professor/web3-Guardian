import pytest
from unittest.mock import patch, MagicMock, AsyncMock
import numpy as np
import json
from datetime import datetime, timezone
import asyncio

# Add the backend directory to the Python path
import sys
from pathlib import Path
sys.path.append(str(Path(__file__).parent.parent.parent / 'backend'))

from src.rag.rag_pipeline import RAGPipeline, SecurityKnowledgeBase

class TestRAGPipeline:
    @pytest.fixture
    def rag_pipeline(self):
        """Create a RAG pipeline instance for testing."""
        return RAGPipeline()
    
    @pytest.fixture
    def mock_knowledge_base(self):
        """Create a mock knowledge base with test data."""
        kb = SecurityKnowledgeBase()
        kb.vulnerabilities = {
            "reentrancy": {
                "description": "A vulnerability where external calls can re-enter the contract",
                "severity": "high",
                "examples": ["DAO hack", "Parity wallet"],
                "mitigation": "Use ReentrancyGuard or checks-effects-interactions pattern",
                "patterns": ["external_call_before_state_change", "multiple_external_calls"]
            },
            "integer_overflow": {
                "description": "Arithmetic operations that exceed variable limits",
                "severity": "medium",
                "examples": ["BEC token", "Beauty Chain"],
                "mitigation": "Use SafeMath library or Solidity 0.8+",
                "patterns": ["unchecked_arithmetic", "multiplication_before_division"]
            }
        }
        kb.best_practices = {
            "access_control": {
                "description": "Implement proper access controls",
                "importance": "critical",
                "guidelines": ["Use OpenZeppelin AccessControl", "Implement role-based permissions"]
            },
            "gas_optimization": {
                "description": "Optimize gas usage for efficiency",
                "importance": "medium",
                "guidelines": ["Pack structs", "Use events for data storage", "Batch operations"]
            }
        }
        return kb

    def test_initialization(self, rag_pipeline):
        """Test RAG pipeline initialization."""
        assert rag_pipeline is not None
        assert hasattr(rag_pipeline, 'knowledge_base')
        assert hasattr(rag_pipeline, 'embeddings_model')
        assert hasattr(rag_pipeline, 'vector_store')

    @patch('src.rag.rag_pipeline.SentenceTransformer')
    def test_load_embeddings_model(self, mock_transformer, rag_pipeline):
        """Test loading the embeddings model."""
        mock_model = MagicMock()
        mock_transformer.return_value = mock_model
        
        rag_pipeline._load_embeddings_model()
        
        mock_transformer.assert_called_once()
        assert rag_pipeline.embeddings_model == mock_model

    def test_create_embeddings(self, rag_pipeline):
        """Test creating embeddings for text."""
        with patch.object(rag_pipeline, 'embeddings_model') as mock_model:
            mock_model.encode.return_value = np.array([[0.1, 0.2, 0.3]])
            
            embeddings = rag_pipeline.create_embeddings(["test text"])
            
            assert embeddings.shape == (1, 3)
            mock_model.encode.assert_called_once_with(["test text"])

    def test_build_knowledge_index(self, rag_pipeline, mock_knowledge_base):
        """Test building the knowledge index."""
        rag_pipeline.knowledge_base = mock_knowledge_base
        
        with patch.object(rag_pipeline, 'create_embeddings') as mock_embeddings:
            mock_embeddings.return_value = np.array([[0.1, 0.2], [0.3, 0.4]])
            
            rag_pipeline.build_knowledge_index()
            
            assert rag_pipeline.knowledge_index is not None
            assert len(rag_pipeline.knowledge_texts) > 0
            mock_embeddings.assert_called_once()

    def test_similarity_search(self, rag_pipeline):
        """Test similarity search functionality."""
        # Setup mock vector store
        rag_pipeline.knowledge_index = np.array([[0.1, 0.2], [0.3, 0.4], [0.5, 0.6]])
        rag_pipeline.knowledge_texts = [
            "Reentrancy vulnerability description",
            "Integer overflow mitigation",
            "Access control best practices"
        ]
        
        with patch.object(rag_pipeline, 'create_embeddings') as mock_embeddings:
            mock_embeddings.return_value = np.array([[0.15, 0.25]])
            
            results = rag_pipeline.similarity_search("reentrancy attack", top_k=2)
            
            assert len(results) == 2
            assert all(isinstance(result, dict) for result in results)
            assert all('text' in result and 'score' in result for result in results)

    @pytest.mark.asyncio
    async def test_analyze_vulnerability_patterns(self, rag_pipeline, mock_knowledge_base):
        """Test vulnerability pattern analysis."""
        rag_pipeline.knowledge_base = mock_knowledge_base
        
        contract_code = """
        pragma solidity ^0.8.0;
        contract Test {
            mapping(address => uint) balances;
            
            function withdraw() external {
                uint amount = balances[msg.sender];
                (bool success,) = msg.sender.call{value: amount}("");
                balances[msg.sender] = 0;
            }
        }
        """
        
        with patch.object(rag_pipeline, 'similarity_search') as mock_search:
            mock_search.return_value = [
                {
                    "text": "Reentrancy vulnerability in withdraw function",
                    "score": 0.95,
                    "metadata": {"vulnerability": "reentrancy", "severity": "high"}
                }
            ]
            
            results = await rag_pipeline.analyze_vulnerability_patterns(contract_code)
            
            assert len(results) > 0
            assert results[0]["vulnerability"] == "reentrancy"
            assert results[0]["severity"] == "high"

    @pytest.mark.asyncio
    async def test_get_security_recommendations(self, rag_pipeline, mock_knowledge_base):
        """Test getting security recommendations."""
        rag_pipeline.knowledge_base = mock_knowledge_base
        
        vulnerabilities = [
            {"type": "reentrancy", "severity": "high", "location": "line 10"},
            {"type": "integer_overflow", "severity": "medium", "location": "line 25"}
        ]
        
        with patch.object(rag_pipeline, 'similarity_search') as mock_search:
            mock_search.side_effect = [
                [{"text": "Use ReentrancyGuard pattern", "score": 0.9}],
                [{"text": "Use SafeMath library", "score": 0.85}]
            ]
            
            recommendations = await rag_pipeline.get_security_recommendations(vulnerabilities)
            
            assert len(recommendations) == 2
            assert all("recommendation" in rec for rec in recommendations)
            assert all("priority" in rec for rec in recommendations)

    @pytest.mark.asyncio
    async def test_generate_ai_insights(self, rag_pipeline):
        """Test AI insights generation."""
        analysis_data = {
            "vulnerabilities": [
                {"type": "reentrancy", "severity": "high"},
                {"type": "access_control", "severity": "medium"}
            ],
            "gas_analysis": {"optimization_score": 6.5},
            "contract_complexity": "medium"
        }
        
        with patch.object(rag_pipeline, 'similarity_search') as mock_search:
            mock_search.return_value = [
                {
                    "text": "High severity vulnerabilities require immediate attention",
                    "score": 0.88
                }
            ]
            
            insights = await rag_pipeline.generate_ai_insights(analysis_data)
            
            assert isinstance(insights, str)
            assert len(insights) > 0

    def test_update_knowledge_base(self, rag_pipeline):
        """Test updating the knowledge base."""
        new_vulnerability = {
            "name": "flash_loan_attack",
            "description": "Exploiting flash loans for arbitrage attacks",
            "severity": "high",
            "examples": ["bZx attack", "Harvest Finance"],
            "mitigation": "Implement proper slippage protection"
        }
        
        rag_pipeline.update_knowledge_base("vulnerabilities", new_vulnerability)
        
        assert "flash_loan_attack" in rag_pipeline.knowledge_base.vulnerabilities

    def test_search_knowledge_base(self, rag_pipeline, mock_knowledge_base):
        """Test searching the knowledge base."""
        rag_pipeline.knowledge_base = mock_knowledge_base
        
        results = rag_pipeline.search_knowledge_base("reentrancy", category="vulnerabilities")
        
        assert len(results) > 0
        assert "reentrancy" in results[0]

    @pytest.mark.asyncio
    async def test_contextual_analysis(self, rag_pipeline):
        """Test contextual analysis with RAG."""
        transaction_data = {
            "to": "0x123...",
            "data": "0xa9059cbb...",  # transfer function
            "value": "1000000000000000000"
        }
        
        contract_info = {
            "name": "TestToken",
            "verified": True,
            "audit_report": "No critical issues found"
        }
        
        with patch.object(rag_pipeline, 'similarity_search') as mock_search:
            mock_search.return_value = [
                {
                    "text": "ERC-20 transfer functions are generally safe",
                    "score": 0.82,
                    "metadata": {"category": "transaction_patterns"}
                }
            ]
            
            analysis = await rag_pipeline.contextual_analysis(
                transaction_data, 
                contract_info
            )
            
            assert "risk_assessment" in analysis
            assert "recommendations" in analysis

class TestSecurityKnowledgeBase:
    @pytest.fixture
    def knowledge_base(self):
        """Create a knowledge base instance for testing."""
        return SecurityKnowledgeBase()

    def test_initialization(self, knowledge_base):
        """Test knowledge base initialization."""
        assert hasattr(knowledge_base, 'vulnerabilities')
        assert hasattr(knowledge_base, 'best_practices')
        assert hasattr(knowledge_base, 'threat_patterns')
        assert hasattr(knowledge_base, 'audit_reports')

    def test_load_vulnerability_data(self, knowledge_base):
        """Test loading vulnerability data."""
        with patch('builtins.open', create=True) as mock_open:
            mock_open.return_value.__enter__.return_value.read.return_value = json.dumps({
                "test_vuln": {
                    "description": "Test vulnerability",
                    "severity": "medium"
                }
            })
            
            knowledge_base.load_vulnerability_data("test_file.json")
            
            assert "test_vuln" in knowledge_base.vulnerabilities

    def test_add_vulnerability(self, knowledge_base):
        """Test adding a new vulnerability."""
        vuln_data = {
            "description": "New vulnerability type",
            "severity": "critical",
            "examples": ["Example 1"],
            "mitigation": "Mitigation strategy"
        }
        
        knowledge_base.add_vulnerability("new_vuln", vuln_data)
        
        assert "new_vuln" in knowledge_base.vulnerabilities
        assert knowledge_base.vulnerabilities["new_vuln"]["severity"] == "critical"

    def test_get_vulnerability_info(self, knowledge_base):
        """Test getting vulnerability information."""
        # Add test vulnerability
        knowledge_base.vulnerabilities["test"] = {
            "description": "Test vuln",
            "severity": "high"
        }
        
        info = knowledge_base.get_vulnerability_info("test")
        
        assert info is not None
        assert info["severity"] == "high"

    def test_search_vulnerabilities(self, knowledge_base):
        """Test searching vulnerabilities."""
        # Add test data
        knowledge_base.vulnerabilities.update({
            "reentrancy": {"description": "Reentrancy attack", "severity": "high"},
            "overflow": {"description": "Integer overflow", "severity": "medium"},
            "reentrancy_dao": {"description": "DAO reentrancy", "severity": "critical"}
        })
        
        results = knowledge_base.search_vulnerabilities("reentrancy")
        
        assert len(results) == 2  # Should find both reentrancy entries
        assert all("reentrancy" in key.lower() for key in results.keys())

    def test_get_severity_classification(self, knowledge_base):
        """Test severity classification."""
        severity_info = knowledge_base.get_severity_classification("critical")
        
        assert severity_info is not None
        assert "score" in severity_info
        assert "description" in severity_info

    def test_update_threat_patterns(self, knowledge_base):
        """Test updating threat patterns."""
        new_pattern = {
            "pattern": "flash_loan_arbitrage",
            "indicators": ["flash_loan", "dex_interaction", "price_manipulation"],
            "risk_level": "high"
        }
        
        knowledge_base.update_threat_patterns(new_pattern)
        
        assert any(p["pattern"] == "flash_loan_arbitrage" for p in knowledge_base.threat_patterns)

    def test_export_knowledge_base(self, knowledge_base):
        """Test exporting knowledge base."""
        knowledge_base.vulnerabilities = {"test": {"severity": "low"}}
        
        exported = knowledge_base.export_knowledge_base()
        
        assert "vulnerabilities" in exported
        assert "best_practices" in exported
        assert exported["vulnerabilities"]["test"]["severity"] == "low"

class TestRAGIntegration:
    """Integration tests for the complete RAG system."""
    
    @pytest.fixture
    def integrated_rag(self):
        """Create a fully integrated RAG system for testing."""
        rag = RAGPipeline()
        kb = SecurityKnowledgeBase()
        
        # Add some test data
        kb.vulnerabilities = {
            "reentrancy": {
                "description": "Reentrancy vulnerability allows attackers to recursively call functions",
                "severity": "high",
                "mitigation": "Use ReentrancyGuard or follow checks-effects-interactions pattern"
            }
        }
        
        rag.knowledge_base = kb
        return rag

    @pytest.mark.asyncio
    async def test_end_to_end_analysis(self, integrated_rag):
        """Test complete end-to-end analysis workflow."""
        contract_code = """
        contract VulnerableContract {
            mapping(address => uint) public balances;
            
            function withdraw() public {
                uint amount = balances[msg.sender];
                require(amount > 0);
                (bool success, ) = msg.sender.call{value: amount}("");
                require(success);
                balances[msg.sender] = 0;
            }
        }
        """
        
        # Mock the embeddings and similarity search
        with patch.object(integrated_rag, 'create_embeddings') as mock_embeddings, \
             patch.object(integrated_rag, 'similarity_search') as mock_search:
            
            mock_embeddings.return_value = np.array([[0.1, 0.2, 0.3]])
            mock_search.return_value = [
                {
                    "text": "Reentrancy vulnerability detected in withdraw function",
                    "score": 0.92,
                    "metadata": {"vulnerability": "reentrancy", "severity": "high"}
                }
            ]
            
            # Perform analysis
            vulnerabilities = await integrated_rag.analyze_vulnerability_patterns(contract_code)
            recommendations = await integrated_rag.get_security_recommendations(vulnerabilities)
            insights = await integrated_rag.generate_ai_insights({
                "vulnerabilities": vulnerabilities,
                "contract_code": contract_code
            })
            
            # Verify results
            assert len(vulnerabilities) > 0
            assert vulnerabilities[0]["vulnerability"] == "reentrancy"
            assert len(recommendations) > 0
            assert isinstance(insights, str)
            assert len(insights) > 0

    @pytest.mark.asyncio
    async def test_performance_benchmarks(self, integrated_rag):
        """Test performance benchmarks for RAG operations."""
        import time
        
        test_queries = [
            "reentrancy vulnerability analysis",
            "gas optimization strategies",
            "access control best practices",
            "smart contract security audit"
        ]
        
        with patch.object(integrated_rag, 'similarity_search') as mock_search:
            mock_search.return_value = [{"text": "test result", "score": 0.8}]
            
            start_time = time.time()
            
            for query in test_queries:
                results = integrated_rag.similarity_search(query, top_k=5)
                assert len(results) > 0
            
            total_time = time.time() - start_time
            avg_time = total_time / len(test_queries)
            
            # Performance assertion - should be fast
            assert avg_time < 1.0  # Less than 1 second per query

    def test_memory_usage(self, integrated_rag):
        """Test memory usage during operations."""
        import psutil
        import os
        
        process = psutil.Process(os.getpid())
        initial_memory = process.memory_info().rss
        
        # Perform memory-intensive operations
        with patch.object(integrated_rag, 'create_embeddings') as mock_embeddings:
            mock_embeddings.return_value = np.random.random((1000, 384))  # Large embedding matrix
            
            integrated_rag.build_knowledge_index()
        
        final_memory = process.memory_info().rss
        memory_increase = final_memory - initial_memory
        
        # Memory increase should be reasonable (less than 100MB for test)
        assert memory_increase < 100 * 1024 * 1024

if __name__ == "__main__":
    pytest.main([__file__, "-v"])

import pytest
import os
from pathlib import Path
from unittest.mock import MagicMock, patch, AsyncMock
import asyncio
import json
from datetime import datetime

# Add the backend directory to the Python path
import sys
sys.path.append(str(Path(__file__).parent.parent.parent / 'backend'))

from src.rag.rag_pipeline import RAGPipeline, VulnerabilityKnowledgeBase


class TestRAGPipeline:
    """Test RAG pipeline functionality."""
    
    @pytest.fixture
    def rag_pipeline(self):
        """Create a RAG pipeline instance for testing."""
        return RAGPipeline()
    
    @pytest.fixture
    def sample_contract_code(self):
        """Sample contract code for testing."""
        return """
        pragma solidity ^0.8.0;
        contract VulnerableContract {
            mapping(address => uint256) public balances;
            
            function withdraw() public {
                uint256 amount = balances[msg.sender];
                require(amount > 0, "No balance");
                
                // Vulnerable to reentrancy
                (bool success, ) = msg.sender.call{value: amount}("");
                require(success, "Transfer failed");
                
                balances[msg.sender] = 0;
            }
        }
        """
    
    def test_rag_pipeline_initialization(self, rag_pipeline):
        """Test RAG pipeline initialization."""
        assert rag_pipeline is not None
        assert hasattr(rag_pipeline, 'knowledge_base')
        assert hasattr(rag_pipeline, 'embeddings')
        assert hasattr(rag_pipeline, 'vector_store')
    
    @patch('src.rag.rag_pipeline.OpenAIEmbeddings')
    def test_initialize_embeddings(self, mock_embeddings, rag_pipeline):
        """Test embeddings initialization."""
        mock_embeddings.return_value = MagicMock()
        
        rag_pipeline.initialize_embeddings()
        
        mock_embeddings.assert_called_once()
        assert rag_pipeline.embeddings is not None
    
    @patch('src.rag.rag_pipeline.Chroma')
    def test_initialize_vector_store(self, mock_chroma, rag_pipeline):
        """Test vector store initialization."""
        mock_store = MagicMock()
        mock_chroma.return_value = mock_store
        rag_pipeline.embeddings = MagicMock()
        
        rag_pipeline.initialize_vector_store()
        
        mock_chroma.assert_called_once()
        assert rag_pipeline.vector_store == mock_store
    
    def test_preprocess_contract_code(self, rag_pipeline, sample_contract_code):
        """Test contract code preprocessing."""
        processed = rag_pipeline.preprocess_contract_code(sample_contract_code)
        
        assert isinstance(processed, dict)
        assert 'functions' in processed
        assert 'events' in processed
        assert 'modifiers' in processed
        assert 'variables' in processed
        assert len(processed['functions']) > 0
    
    def test_extract_vulnerability_patterns(self, rag_pipeline, sample_contract_code):
        """Test vulnerability pattern extraction."""
        patterns = rag_pipeline.extract_vulnerability_patterns(sample_contract_code)
        
        assert isinstance(patterns, list)
        assert len(patterns) > 0
        # Should detect reentrancy pattern
        reentrancy_found = any('reentrancy' in str(pattern).lower() for pattern in patterns)
        assert reentrancy_found
    
    @patch('src.rag.rag_pipeline.ChatOpenAI')
    async def test_analyze_with_rag(self, mock_llm, rag_pipeline, sample_contract_code):
        """Test RAG-based analysis."""
        mock_llm_instance = AsyncMock()
        mock_llm_instance.agenerate.return_value.generations = [
            [MagicMock(text="High risk: Reentrancy vulnerability detected")]
        ]
        mock_llm.return_value = mock_llm_instance
        
        rag_pipeline.vector_store = MagicMock()
        rag_pipeline.vector_store.similarity_search.return_value = [
            MagicMock(page_content="Reentrancy attack pattern", metadata={"severity": "high"})
        ]
        
        result = await rag_pipeline.analyze_with_rag(sample_contract_code)
        
        assert isinstance(result, dict)
        assert 'risk_level' in result
        assert 'vulnerabilities' in result
        assert 'recommendations' in result
    
    def test_load_vulnerability_knowledge(self, rag_pipeline):
        """Test loading vulnerability knowledge base."""
        with patch('builtins.open') as mock_open:
            mock_file = MagicMock()
            mock_file.read.return_value = json.dumps({
                "vulnerabilities": [
                    {
                        "name": "Reentrancy",
                        "severity": "high",
                        "description": "Contract allows reentrant calls",
                        "patterns": ["external call before state change"]
                    }
                ]
            })
            mock_open.return_value.__enter__.return_value = mock_file
            
            knowledge = rag_pipeline.load_vulnerability_knowledge()
            
            assert isinstance(knowledge, dict)
            assert 'vulnerabilities' in knowledge
            assert len(knowledge['vulnerabilities']) > 0
    
    def test_update_knowledge_base(self, rag_pipeline):
        """Test knowledge base updates."""
        new_vulnerability = {
            "name": "Flash Loan Attack",
            "severity": "critical",
            "description": "Manipulation of DeFi protocols using flash loans",
            "patterns": ["flash loan", "price manipulation"]
        }
        
        result = rag_pipeline.update_knowledge_base(new_vulnerability)
        
        assert result is True
        # Verify the vulnerability was added
        knowledge = rag_pipeline.knowledge_base.get_all_vulnerabilities()
        flash_loan_vuln = next((v for v in knowledge if v['name'] == 'Flash Loan Attack'), None)
        assert flash_loan_vuln is not None
    
    def test_similarity_search(self, rag_pipeline):
        """Test similarity search functionality."""
        rag_pipeline.vector_store = MagicMock()
        mock_documents = [
            MagicMock(page_content="Reentrancy vulnerability", metadata={"severity": "high"}),
            MagicMock(page_content="Integer overflow", metadata={"severity": "medium"})
        ]
        rag_pipeline.vector_store.similarity_search.return_value = mock_documents
        
        results = rag_pipeline.similarity_search("external call vulnerability")
        
        assert len(results) == 2
        assert results[0].page_content == "Reentrancy vulnerability"
        rag_pipeline.vector_store.similarity_search.assert_called_once_with(
            "external call vulnerability", k=10
        )
    
    def test_generate_recommendations(self, rag_pipeline):
        """Test recommendation generation."""
        vulnerabilities = [
            {
                "type": "reentrancy",
                "severity": "high",
                "description": "Potential reentrancy vulnerability"
            }
        ]
        
        recommendations = rag_pipeline.generate_recommendations(vulnerabilities)
        
        assert isinstance(recommendations, list)
        assert len(recommendations) > 0
        # Should include reentrancy-specific recommendations
        reentrancy_rec = any('mutex' in rec.lower() or 'checks-effects-interactions' in rec.lower() 
                           for rec in recommendations)
        assert reentrancy_rec
    
    @patch('src.rag.rag_pipeline.requests.get')
    def test_fetch_latest_vulnerabilities(self, mock_get, rag_pipeline):
        """Test fetching latest vulnerabilities from external sources."""
        mock_response = MagicMock()
        mock_response.json.return_value = {
            "vulnerabilities": [
                {
                    "cve_id": "CVE-2023-12345",
                    "description": "Smart contract reentrancy vulnerability",
                    "severity": "high"
                }
            ]
        }
        mock_get.return_value = mock_response
        
        vulnerabilities = rag_pipeline.fetch_latest_vulnerabilities()
        
        assert isinstance(vulnerabilities, list)
        assert len(vulnerabilities) > 0
        mock_get.assert_called()
    
    def test_calculate_risk_score(self, rag_pipeline):
        """Test risk score calculation."""
        vulnerabilities = [
            {"severity": "high", "confidence": 0.9},
            {"severity": "medium", "confidence": 0.7},
            {"severity": "low", "confidence": 0.8}
        ]
        
        risk_score = rag_pipeline.calculate_risk_score(vulnerabilities)
        
        assert 0 <= risk_score <= 1
        assert risk_score > 0.5  # Should be high due to high severity vuln


class TestVulnerabilityKnowledgeBase:
    """Test vulnerability knowledge base functionality."""
    
    @pytest.fixture
    def knowledge_base(self):
        """Create a knowledge base instance for testing."""
        return VulnerabilityKnowledgeBase()
    
    def test_knowledge_base_initialization(self, knowledge_base):
        """Test knowledge base initialization."""
        assert knowledge_base is not None
        assert hasattr(knowledge_base, 'vulnerabilities')
        assert isinstance(knowledge_base.vulnerabilities, list)
    
    def test_add_vulnerability(self, knowledge_base):
        """Test adding a vulnerability to the knowledge base."""
        vulnerability = {
            "name": "Test Vulnerability",
            "severity": "medium",
            "description": "Test vulnerability description",
            "patterns": ["test pattern"]
        }
        
        result = knowledge_base.add_vulnerability(vulnerability)
        
        assert result is True
        assert vulnerability in knowledge_base.vulnerabilities
    
    def test_get_vulnerability_by_name(self, knowledge_base):
        """Test retrieving vulnerability by name."""
        vulnerability = {
            "name": "Reentrancy",
            "severity": "high",
            "description": "Reentrancy attack vulnerability"
        }
        knowledge_base.add_vulnerability(vulnerability)
        
        retrieved = knowledge_base.get_vulnerability_by_name("Reentrancy")
        
        assert retrieved is not None
        assert retrieved["name"] == "Reentrancy"
        assert retrieved["severity"] == "high"
    
    def test_search_vulnerabilities(self, knowledge_base):
        """Test searching vulnerabilities by pattern."""
        vulnerabilities = [
            {
                "name": "Reentrancy",
                "patterns": ["external call", "state change"],
                "severity": "high"
            },
            {
                "name": "Integer Overflow",
                "patterns": ["arithmetic operation", "unchecked math"],
                "severity": "medium"
            }
        ]
        
        for vuln in vulnerabilities:
            knowledge_base.add_vulnerability(vuln)
        
        results = knowledge_base.search_vulnerabilities("external call")
        
        assert len(results) > 0
        assert any(r["name"] == "Reentrancy" for r in results)
    
    def test_get_vulnerabilities_by_severity(self, knowledge_base):
        """Test filtering vulnerabilities by severity."""
        vulnerabilities = [
            {"name": "Critical Bug", "severity": "critical"},
            {"name": "High Bug", "severity": "high"},
            {"name": "Medium Bug", "severity": "medium"}
        ]
        
        for vuln in vulnerabilities:
            knowledge_base.add_vulnerability(vuln)
        
        high_severity = knowledge_base.get_vulnerabilities_by_severity("high")
        
        assert len(high_severity) == 1
        assert high_severity[0]["name"] == "High Bug"
    
    def test_update_vulnerability(self, knowledge_base):
        """Test updating an existing vulnerability."""
        original = {
            "name": "Test Vuln",
            "severity": "low",
            "description": "Original description"
        }
        knowledge_base.add_vulnerability(original)
        
        updated = {
            "name": "Test Vuln",
            "severity": "high",
            "description": "Updated description"
        }
        
        result = knowledge_base.update_vulnerability("Test Vuln", updated)
        
        assert result is True
        retrieved = knowledge_base.get_vulnerability_by_name("Test Vuln")
        assert retrieved["severity"] == "high"
        assert retrieved["description"] == "Updated description"
    
    def test_remove_vulnerability(self, knowledge_base):
        """Test removing a vulnerability from the knowledge base."""
        vulnerability = {
            "name": "Temporary Vuln",
            "severity": "low"
        }
        knowledge_base.add_vulnerability(vulnerability)
        
        result = knowledge_base.remove_vulnerability("Temporary Vuln")
        
        assert result is True
        retrieved = knowledge_base.get_vulnerability_by_name("Temporary Vuln")
        assert retrieved is None
    
    def test_export_knowledge_base(self, knowledge_base):
        """Test exporting knowledge base to file."""
        vulnerability = {
            "name": "Export Test",
            "severity": "medium"
        }
        knowledge_base.add_vulnerability(vulnerability)
        
        with patch('builtins.open', create=True) as mock_open:
            mock_file = MagicMock()
            mock_open.return_value.__enter__.return_value = mock_file
            
            result = knowledge_base.export_to_file("test_export.json")
            
            assert result is True
            mock_open.assert_called_once()
            mock_file.write.assert_called()
    
    def test_import_knowledge_base(self, knowledge_base):
        """Test importing knowledge base from file."""
        test_data = {
            "vulnerabilities": [
                {
                    "name": "Imported Vuln",
                    "severity": "high",
                    "description": "Imported vulnerability"
                }
            ]
        }
        
        with patch('builtins.open', create=True) as mock_open:
            mock_file = MagicMock()
            mock_file.read.return_value = json.dumps(test_data)
            mock_open.return_value.__enter__.return_value = mock_file
            
            result = knowledge_base.import_from_file("test_import.json")
            
            assert result is True
            imported = knowledge_base.get_vulnerability_by_name("Imported Vuln")
            assert imported is not None
            assert imported["severity"] == "high"


class TestRAGIntegration:
    """Test RAG pipeline integration with other components."""
    
    @pytest.fixture
    def rag_pipeline(self):
        return RAGPipeline()
    
    @patch('src.rag.rag_pipeline.SmartBugsAnalyzer')
    async def test_integration_with_smartbugs(self, mock_smartbugs, rag_pipeline):
        """Test RAG integration with SmartBugs analyzer."""
        mock_analyzer = MagicMock()
        mock_analyzer.analyze.return_value = {
            "vulnerabilities": [
                {"type": "reentrancy", "severity": "high"}
            ]
        }
        mock_smartbugs.return_value = mock_analyzer
        
        contract_code = "contract Test { }"
        result = await rag_pipeline.analyze_with_external_tools(contract_code)
        
        assert "smartbugs_results" in result
        assert "rag_analysis" in result
    
    @patch('src.simulation.tenderly_new.TenderlySimulator')
    async def test_integration_with_simulation(self, mock_tenderly, rag_pipeline):
        """Test RAG integration with transaction simulation."""
        mock_simulator = MagicMock()
        mock_simulator.simulate_transaction.return_value = {
            "success": False,
            "error": "Reentrancy detected"
        }
        mock_tenderly.return_value = mock_simulator
        
        tx_data = {"to": "0x123", "data": "0x456"}
        result = await rag_pipeline.analyze_transaction_with_simulation(tx_data)
        
        assert "simulation_result" in result
        assert "rag_recommendations" in result
    
    def test_context_aware_analysis(self, rag_pipeline):
        """Test context-aware vulnerability analysis."""
        contract_context = {
            "contract_type": "defi",
            "protocols": ["uniswap", "compound"],
            "functions": ["swap", "lend", "borrow"]
        }
        
        contract_code = """
        contract DeFiProtocol {
            function flashLoan(uint256 amount) external {
                // Flash loan logic
            }
        }
        """
        
        result = rag_pipeline.context_aware_analysis(contract_code, contract_context)
        
        assert "defi_specific_risks" in result
        assert "protocol_interactions" in result
        assert "flash_loan_risks" in result
    
    def test_multi_language_support(self, rag_pipeline):
        """Test analysis of different smart contract languages."""
        vyper_code = """
# @version ^0.3.0

balances: HashMap[address, uint256]

@external
@payable
def deposit():
    self.balances[msg.sender] += msg.value
        """
        
        result = rag_pipeline.analyze_vyper_contract(vyper_code)
        
        assert result is not None
        assert "language" in result
        assert result["language"] == "vyper"

import pytest
import os
from pathlib import Path
from unittest.mock import MagicMock, patch

# Add the backend directory to the Python path
import sys
sys.path.append(str(Path(__file__).parent.parent.parent / 'backend'))



class TestRAGPipeline:
    @pytest.fixture
    def rag_pipeline(self):
        # Use a test API key
        return RAGPipeline(openai_api_key="test_key")
    
    def test_initialization(self, rag_pipeline):
        assert rag_pipeline is not None
        assert rag_pipeline.embeddings is not None
        assert rag_pipeline.vector_store is None
    
    @patch('langchain.document_loaders.TextLoader')
    def test_load_documents_from_file(self, mock_loader, rag_pipeline, tmp_path):
        # Create a test file
        test_file = tmp_path / "test.txt"
        test_file.write_text("Test document content")
        
        # Mock the loader to return a document
        mock_doc = MagicMock()
        mock_doc.page_content = "Test document content"
        mock_loader.return_value.load.return_value = [mock_doc]
        
        # Test loading the document
        docs = rag_pipeline.load_documents(file_paths=[str(test_file)])
        assert len(docs) > 0
        assert "Test document content" in docs[0].page_content
    
    @patch('langchain.vectorstores.FAISS.from_documents')
    def test_create_vector_store(self, mock_faiss, rag_pipeline):
        # Mock documents
        mock_doc = MagicMock()
        mock_doc.page_content = "Test document"
        
        # Mock FAISS return value
        mock_faiss.return_value = "mock_vector_store"
        
        # Test creating vector store
        vector_store = rag_pipeline.create_vector_store([mock_doc])
        assert vector_store == "mock_vector_store"
        assert rag_pipeline.vector_store == "mock_vector_store"
    
    @patch('langchain.vectorstores.FAISS.similarity_search')
    def test_similarity_search(self, mock_search, rag_pipeline):
        # Setup mock vector store
        mock_doc = MagicMock()
        mock_doc.page_content = "Test document"
        mock_doc.metadata = {}
        mock_search.return_value = [mock_doc]
        rag_pipeline.vector_store = MagicMock()
        rag_pipeline.vector_store.similarity_search = mock_search
        
        # Test similarity search
        results = rag_pipeline.similarity_search("test query")
        assert len(results) > 0
        assert results[0]["content"] == "Test document"
    
    def test_format_transaction_query(self, rag_pipeline):
        tx_data = {
            'to': '0x123...',
            'value': '1000000000000000000',  # 1 ETH
            'data': '0x123456'
        }
        query = rag_pipeline._format_transaction_query(tx_data)
        assert "0x123..." in query
        assert "1000000000000000000" in query
        assert "0x123456" in query

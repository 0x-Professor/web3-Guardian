from langchain.embeddings import OpenAIEmbeddings
from langchain.vectorstores import FAISS
from langchain.text_splitter import RecursiveCharacterTextSplitter
from langchain.document_loaders import TextLoader, WebBaseLoader
from typing import List, Dict, Any
import os
import logging

logger = logging.getLogger(__name__)

class RAGPipeline:
    def __init__(self, openai_api_key: str):
        """Initialize the RAG pipeline with OpenAI embeddings."""
        self.embeddings = OpenAIEmbeddings(openai_api_key=openai_api_key)
        self.vector_store = None
        self.text_splitter = RecursiveCharacterTextSplitter(
            chunk_size=1000,
            chunk_overlap=200
        )

    def load_documents(self, file_paths: List[str] = None, urls: List[str] = None):
        """Load documents from files or URLs."""
        documents = []
        
        # Load from files if provided
        if file_paths:
            for file_path in file_paths:
                try:
                    loader = TextLoader(file_path)
                    documents.extend(loader.load())
                except Exception as e:
                    logger.error(f"Error loading {file_path}: {str(e)}")
        
        # Load from URLs if provided
        if urls:
            try:
                loader = WebBaseLoader(urls)
                documents.extend(loader.load())
            except Exception as e:
                logger.error(f"Error loading URLs: {str(e)}")
        
        # Split documents into chunks
        if documents:
            return self.text_splitter.split_documents(documents)
        return []

    def create_vector_store(self, documents):
        """Create a vector store from documents."""
        if not documents:
            raise ValueError("No documents provided to create vector store")
        
        self.vector_store = FAISS.from_documents(documents, self.embeddings)
        return self.vector_store

    def similarity_search(self, query: str, k: int = 5) -> List[Dict[str, Any]]:
        """Search for similar documents to the query."""
        if not self.vector_store:
            raise ValueError("Vector store not initialized. Call create_vector_store first.")
        
        docs = self.vector_store.similarity_search(query, k=k)
        return [{"content": doc.page_content, "metadata": doc.metadata} for doc in docs]

    def get_relevant_context(self, transaction_data: Dict[str, Any]) -> str:
        """Get relevant context for a transaction."""
        # Convert transaction data to a query string
        query = self._format_transaction_query(transaction_data)
        
        # Get similar documents
        results = self.similarity_search(query)
        
        # Format results into a single context string
        context = "\n\n".join([doc["content"] for doc in results])
        return context
    
    def _format_transaction_query(self, tx_data: Dict[str, Any]) -> str:
        """Format transaction data into a query string."""
        return (
            f"Transaction to {tx_data.get('to', 'unknown')} "
            f"with value {tx_data.get('value', 0)} wei. "
            f"Data: {tx_data.get('data', '')}"
        )

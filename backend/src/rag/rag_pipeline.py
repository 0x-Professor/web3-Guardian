"""
RAG Pipeline for Smart Contract Analysis
Integrates Gemini AI, vector databases, and comprehensive security analysis
"""

import asyncio
import json
import logging
from typing import List, Dict, Any, Optional, Tuple
from pathlib import Path
import hashlib
from datetime import datetime, timedelta

# LangChain imports
from langchain.text_splitter import RecursiveCharacterTextSplitter
from langchain.embeddings import HuggingFaceEmbeddings
from langchain.vectorstores import Chroma
from langchain.docstore.document import Document
from langchain.chains import RetrievalQA
from langchain_google_genai import GoogleGenerativeAI, ChatGoogleGenerativeAI
from langchain.prompts import PromptTemplate
from langchain.schema import BaseRetriever

# Google Gemini
import google.generativeai as genai

# Web3 and analysis tools
from web3 import Web3
import requests
import pandas as pd
import numpy as np

# Internal imports
from ..utils.config import settings
from ..utils.logger import setup_logger
from ..simulation.tenderly import TenderlySimulator

logger = setup_logger(__name__)

class SmartContractRAGPipeline:
    """
    Comprehensive RAG pipeline for smart contract security analysis
    """
    
    def __init__(self):
        self.setup_gemini()
        self.setup_embeddings()
        self.setup_vector_store()
        self.setup_llm_chain()
        self.tenderly_simulator = TenderlySimulator()
        self.knowledge_base_path = Path(settings.KNOWLEDGE_BASE_PATH)
        self.cache = {}
        
    def setup_gemini(self):
        """Initialize Google Gemini AI"""
        if not settings.GOOGLE_API_KEY:
            logger.warning("Google API key not provided. Gemini features will be disabled.")
            return
            
        genai.configure(api_key=settings.GOOGLE_API_KEY)
        self.gemini_model = genai.GenerativeModel(settings.GEMINI_MODEL)
        
        # LangChain integration
        self.llm = ChatGoogleGenerativeAI(
            model=settings.GEMINI_MODEL,
            google_api_key=settings.GOOGLE_API_KEY,
            temperature=settings.TEMPERATURE,
            max_tokens=settings.MAX_TOKENS
        )
        
    def setup_embeddings(self):
        """Initialize embedding model"""
        self.embeddings = HuggingFaceEmbeddings(
            model_name=settings.EMBEDDING_MODEL,
            model_kwargs={'device': 'cpu'},
            encode_kwargs={'normalize_embeddings': True}
        )
        
    def setup_vector_store(self):
        """Initialize ChromaDB vector store"""
        self.vector_store = Chroma(
            persist_directory=settings.CHROMA_PERSIST_DIRECTORY,
            embedding_function=self.embeddings,
            collection_name="smart_contracts_knowledge"
        )
        
    def setup_llm_chain(self):
        """Setup the LangChain retrieval QA chain"""
        
        # Custom prompt template for smart contract analysis
        prompt_template = """
        You are an expert smart contract security auditor and blockchain analyst. 
        Use the following context to analyze the smart contract and provide comprehensive security insights.
        
        Context: {context}
        
        Question: {question}
        
        Please provide a detailed analysis including:
        1. Security vulnerabilities and their severity levels
        2. Code quality assessment
        3. Gas optimization opportunities  
        4. Best practices compliance
        5. Potential attack vectors
        6. Recommendations for improvements
        
        Format your response as a structured JSON with the following fields:
        - overall_risk_score (0-100)
        - vulnerabilities (array of vulnerability objects)
        - recommendations (array of recommendation strings)
        - gas_analysis (object with optimization suggestions)
        - code_quality_score (0-100)
        - compliance_issues (array of compliance issue objects)
        
        Answer:
        """
        
        self.prompt = PromptTemplate(
            template=prompt_template,
            input_variables=["context", "question"]
        )
        
        # Create retrieval QA chain
        self.qa_chain = RetrievalQA.from_chain_type(
            llm=self.llm,
            chain_type="stuff",
            retriever=self.vector_store.as_retriever(
                search_type="similarity",
                search_kwargs={"k": 5}
            ),
            chain_type_kwargs={"prompt": self.prompt}
        )
        
    async def load_knowledge_base(self):
        """Load and index security knowledge base"""
        logger.info("Loading smart contract security knowledge base...")
        
        # Define knowledge sources
        knowledge_sources = [
            self._load_vulnerability_patterns(),
            self._load_audit_reports(),
            self._load_best_practices(),
            self._load_exploit_examples(),
            await self._fetch_latest_security_data(),
            self._load_smartbugs_documents()  # Add SmartBugs documents
        ]
        
        documents = []
        
        for source_data in knowledge_sources:
            if source_data:
                # Handle both Dict data and Document objects
                if isinstance(source_data, list) and source_data:
                    if isinstance(source_data[0], Document):
                        # Already Document objects from file loading
                        documents.extend(source_data)
                    else:
                        # Dict data that needs conversion
                        docs = self._create_documents(source_data)
                        documents.extend(docs)
        
        if documents:
            # Split documents into chunks
            text_splitter = RecursiveCharacterTextSplitter(
                chunk_size=settings.CHUNK_SIZE,
                chunk_overlap=settings.CHUNK_OVERLAP,
                length_function=len,
                separators=["\n\n", "\n", " ", ""]
            )
            
            split_docs = text_splitter.split_documents(documents)
            
            # Add to vector store
            self.vector_store.add_documents(split_docs)
            self.vector_store.persist()
            
            logger.info(f"Loaded {len(split_docs)} document chunks into knowledge base")
    
    def _load_smartbugs_documents(self) -> List[Document]:
        """Load SmartBugs vulnerability documents from knowledge base directory"""
        documents = []
        
        if not self.knowledge_base_path.exists():
            logger.warning(f"Knowledge base directory not found: {self.knowledge_base_path}")
            return documents
        
        # Find all .txt files in the knowledge base directory
        txt_files = list(self.knowledge_base_path.glob("*.txt"))
        
        if not txt_files:
            logger.info("No SmartBugs documents found in knowledge base directory")
            return documents
        
        logger.info(f"Loading {len(txt_files)} SmartBugs documents from {self.knowledge_base_path}")
        
        for file_path in txt_files:
            try:
                with open(file_path, 'r', encoding='utf-8') as f:
                    content = f.read()
                
                # Extract metadata from filename
                filename = file_path.stem
                parts = filename.split('_')
                
                metadata = {
                    "source": "smartbugs_dataset",
                    "file_path": str(file_path),
                    "filename": filename,
                    "timestamp": datetime.utcnow().isoformat()
                }
                
                # Try to extract contract name and category from filename
                if len(parts) >= 2:
                    metadata["contract_name"] = parts[0]
                    metadata["vulnerability_category"] = parts[1]
                
                if len(parts) >= 4:
                    metadata["line_start"] = parts[2]
                    metadata["line_end"] = parts[3]
                
                doc = Document(
                    page_content=content,
                    metadata=metadata
                )
                documents.append(doc)
                
            except Exception as e:
                logger.error(f"Error loading SmartBugs document {file_path}: {e}")
        
        logger.info(f"Successfully loaded {len(documents)} SmartBugs documents")
        return documents
    
    def _load_vulnerability_patterns(self) -> List[Dict]:
        """Load common smart contract vulnerability patterns"""
        return [
            {
                "title": "Reentrancy Attack",
                "description": "Occurs when external calls are made before state changes",
                "pattern": "external_call_before_state_change",
                "severity": "high",
                "mitigation": "Use checks-effects-interactions pattern or reentrancy guards"
            },
            {
                "title": "Integer Overflow/Underflow",
                "description": "Arithmetic operations that exceed variable limits",
                "pattern": "unchecked_arithmetic",
                "severity": "high", 
                "mitigation": "Use SafeMath library or Solidity 0.8+ built-in checks"
            },
            {
                "title": "Access Control Issues",
                "description": "Missing or improper access controls",
                "pattern": "missing_access_control",
                "severity": "critical",
                "mitigation": "Implement proper role-based access control"
            },
            {
                "title": "Unchecked External Calls",
                "description": "External calls without proper error handling",
                "pattern": "unchecked_call",
                "severity": "medium",
                "mitigation": "Always check return values of external calls"
            },
            {
                "title": "Denial of Service",
                "description": "Functions that can be blocked by malicious actors",
                "pattern": "dos_vulnerability",
                "severity": "medium",
                "mitigation": "Implement withdrawal pattern and gas limit considerations"
            }
        ]
        
    def _load_audit_reports(self) -> List[Dict]:
        """Load historical audit report data"""
        # This would typically load from a database or file system
        return [
            {
                "project": "DeFi Protocol Example",
                "findings": "Multiple reentrancy vulnerabilities found in withdrawal functions",
                "recommendations": "Implement OpenZeppelin ReentrancyGuard",
                "severity": "high"
            }
        ]
        
    def _load_best_practices(self) -> List[Dict]:
        """Load smart contract best practices"""
        return [
            {
                "category": "Security",
                "practice": "Always use the latest stable Solidity version",
                "reasoning": "Latest versions include security fixes and improvements"
            },
            {
                "category": "Gas Optimization",
                "practice": "Pack struct variables efficiently",
                "reasoning": "Reduces storage costs by minimizing storage slots"
            },
            {
                "category": "Code Quality",
                "practice": "Use descriptive variable and function names",
                "reasoning": "Improves code readability and maintainability"
            }
        ]
        
    def _load_exploit_examples(self) -> List[Dict]:
        """Load real exploit examples for learning"""
        return [
            {
                "exploit_name": "The DAO Attack",
                "vulnerability": "Reentrancy",
                "description": "Famous reentrancy attack that drained millions from The DAO",
                "lesson": "Always update state before external calls"
            }
        ]
        
    async def _fetch_latest_security_data(self) -> List[Dict]:
        """Fetch latest security data from external sources"""
        try:
            # This could fetch from security databases, GitHub advisories, etc.
            # For now, return empty list
            return []
        except Exception as e:
            logger.error(f"Failed to fetch latest security data: {e}")
            return []
            
    def _create_documents(self, data: List[Dict]) -> List[Document]:
        """Convert data into LangChain documents"""
        documents = []
        
        for item in data:
            content = json.dumps(item, indent=2)
            doc = Document(
                page_content=content,
                metadata={
                    "source": "knowledge_base",
                    "type": type(item.get("title", item.get("category", "general"))).__name__,
                    "timestamp": datetime.utcnow().isoformat()
                }
            )
            documents.append(doc)
            
        return documents
        
    async def analyze_contract(self, 
                             contract_address: str,
                             contract_code: str,
                             transaction_data: Optional[Dict] = None) -> Dict[str, Any]:
        """
        Comprehensive contract analysis using RAG pipeline
        """
        logger.info(f"Starting comprehensive analysis for contract: {contract_address}")
        
        try:
            # Create cache key
            cache_key = self._generate_cache_key(contract_address, contract_code)
            
            # Check cache first
            if cache_key in self.cache:
                cached_result = self.cache[cache_key]
                if self._is_cache_valid(cached_result):
                    logger.info("Returning cached analysis result")
                    return cached_result["data"]
            
            # Perform multi-stage analysis
            analysis_results = await asyncio.gather(
                self._static_analysis(contract_code),
                self._dynamic_analysis(contract_address, transaction_data),
                self._rag_analysis(contract_code, contract_address),
                self._gas_analysis(contract_code),
                return_exceptions=True
            )
            
            static_result, dynamic_result, rag_result, gas_result = analysis_results
            
            # Combine results
            comprehensive_result = self._combine_analysis_results(
                static_result, dynamic_result, rag_result, gas_result
            )
            
            # Cache the result
            self.cache[cache_key] = {
                "data": comprehensive_result,
                "timestamp": datetime.utcnow(),
                "ttl": timedelta(hours=1)
            }
            
            logger.info("Comprehensive analysis completed successfully")
            return comprehensive_result
            
        except Exception as e:
            logger.error(f"Error in contract analysis: {str(e)}")
            return {
                "success": False,
                "error": str(e),
                "analysis_type": "comprehensive_rag_analysis"
            }
            
    async def _static_analysis(self, contract_code: str) -> Dict[str, Any]:
        """Perform static code analysis"""
        try:
            # Use Gemini for advanced static analysis
            prompt = f"""
            Perform a comprehensive static analysis of this Solidity smart contract code:
            
            {contract_code}
            
            Focus on:
            1. Security vulnerabilities (reentrancy, overflow, access control)
            2. Code quality issues
            3. Gas inefficiencies  
            4. Best practices violations
            5. Potential logic errors
            
            Provide detailed findings with line numbers where possible.
            """
            
            response = await self._query_gemini(prompt)
            
            return {
                "type": "static_analysis",
                "findings": self._parse_gemini_response(response),
                "confidence": 0.85
            }
            
        except Exception as e:
            logger.error(f"Static analysis failed: {e}")
            return {"type": "static_analysis", "error": str(e)}
            
    async def _dynamic_analysis(self, contract_address: str, transaction_data: Optional[Dict]) -> Dict[str, Any]:
        """Perform dynamic analysis using Tenderly simulation"""
        try:
            if not transaction_data:
                return {"type": "dynamic_analysis", "status": "skipped", "reason": "No transaction data provided"}
                
            # Simulate transaction using Tenderly
            simulation_result = await self.tenderly_simulator.simulate_transaction(
                contract_address, transaction_data
            )
            
            return {
                "type": "dynamic_analysis",
                "simulation": simulation_result,
                "confidence": 0.9
            }
            
        except Exception as e:
            logger.error(f"Dynamic analysis failed: {e}")
            return {"type": "dynamic_analysis", "error": str(e)}
            
    async def _rag_analysis(self, contract_code: str, contract_address: str) -> Dict[str, Any]:
        """Perform RAG-based analysis using knowledge base"""
        try:
            # Create comprehensive query
            query = f"""
            Analyze this smart contract for security vulnerabilities and provide recommendations:
            
            Contract Address: {contract_address}
            Contract Code: {contract_code[:2000]}...
            
            What are the potential security issues and how can they be mitigated?
            """
            
            # Query the RAG chain
            response = self.qa_chain.run(query)
            
            return {
                "type": "rag_analysis", 
                "analysis": response,
                "confidence": 0.8
            }
            
        except Exception as e:
            logger.error(f"RAG analysis failed: {e}")
            return {"type": "rag_analysis", "error": str(e)}
            
    async def _gas_analysis(self, contract_code: str) -> Dict[str, Any]:
        """Analyze gas optimization opportunities"""
        try:
            prompt = f"""
            Analyze this Solidity contract for gas optimization opportunities:
            
            {contract_code}
            
            Identify:
            1. Expensive operations that can be optimized
            2. Storage vs memory usage inefficiencies
            3. Loop optimizations
            4. Struct packing opportunities
            5. Function visibility optimizations
            
            Provide specific recommendations with estimated gas savings.
            """
            
            response = await self._query_gemini(prompt)
            
            return {
                "type": "gas_analysis",
                "optimizations": self._parse_gemini_response(response),
                "confidence": 0.75
            }
            
        except Exception as e:
            logger.error(f"Gas analysis failed: {e}")
            return {"type": "gas_analysis", "error": str(e)}
            
    async def _query_gemini(self, prompt: str) -> str:
        """Query Gemini AI model"""
        try:
            response = await asyncio.to_thread(
                self.gemini_model.generate_content, prompt
            )
            return response.text
        except Exception as e:
            logger.error(f"Gemini query failed: {e}")
            raise
            
    def _parse_gemini_response(self, response: str) -> Dict[str, Any]:
        """Parse and structure Gemini response"""
        try:
            # Try to extract JSON if present
            if "```json" in response:
                json_start = response.find("```json") + 7
                json_end = response.find("```", json_start)
                json_str = response[json_start:json_end].strip()
                return json.loads(json_str)
            
            # Otherwise return structured text analysis
            return {
                "raw_response": response,
                "parsed_at": datetime.utcnow().isoformat()
            }
            
        except json.JSONDecodeError:
            return {"raw_response": response, "parse_error": "Failed to parse JSON"}
            
    def _combine_analysis_results(self, *results) -> Dict[str, Any]:
        """Combine multiple analysis results into comprehensive report"""
        combined = {
            "analysis_timestamp": datetime.utcnow().isoformat(),
            "overall_risk_score": 0,
            "analyses": [],
            "summary": {
                "total_vulnerabilities": 0,
                "critical_issues": 0,
                "high_severity": 0,
                "medium_severity": 0,
                "low_severity": 0
            },
            "recommendations": [],
            "confidence_score": 0
        }
        
        valid_results = [r for r in results if isinstance(r, dict) and "error" not in r]
        
        for result in valid_results:
            if isinstance(result, dict):
                combined["analyses"].append(result)
                
        # Calculate overall metrics
        combined["confidence_score"] = np.mean([
            r.get("confidence", 0) for r in valid_results
        ]) if valid_results else 0
        
        return combined
        
    def _generate_cache_key(self, address: str, code: str) -> str:
        """Generate cache key for analysis results"""
        content = f"{address}:{hashlib.md5(code.encode()).hexdigest()}"
        return hashlib.sha256(content.encode()).hexdigest()
        
    def _is_cache_valid(self, cached_item: Dict) -> bool:
        """Check if cached analysis is still valid"""
        if "timestamp" not in cached_item or "ttl" not in cached_item:
            return False
            
        expiry_time = cached_item["timestamp"] + cached_item["ttl"]
        return datetime.utcnow() < expiry_time

# Global RAG pipeline instance
rag_pipeline = None

async def get_rag_pipeline() -> SmartContractRAGPipeline:
    """Get or create RAG pipeline instance"""
    global rag_pipeline
    
    if rag_pipeline is None:
        rag_pipeline = SmartContractRAGPipeline()
        await rag_pipeline.load_knowledge_base()
        
    return rag_pipeline

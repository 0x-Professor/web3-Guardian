#!/usr/bin/env python3
"""
SmartBugs Dataset Processing Script

This script processes the SmartBugs dataset to populate the knowledge base for the RAG pipeline.
It extracts vulnerability information and code snippets from the dataset and creates structured
text files that can be used by the RAG system for smart contract security analysis.

The SmartBugs dataset includes 143 contracts with 208 labeled vulnerabilities across categories
like reentrancy, access control, and arithmetic issues.
"""

import json
import os
from pathlib import Path
import logging
from typing import Dict, List, Any
import sys

# Add the backend directory to the Python path
sys.path.append(str(Path(__file__).parent.parent))

from src.utils.logger import setup_logger

# Setup logging
logger = setup_logger(__name__, log_level='INFO')

class SmartBugsProcessor:
    """Process SmartBugs dataset for RAG knowledge base"""
    
    def __init__(self, smartbugs_path: str = './smartbugs-curated', 
                 knowledge_base_path: str = './data/knowledge_base'):
        """
        Initialize the SmartBugs processor
        
        Args:
            smartbugs_path: Path to the SmartBugs dataset
            knowledge_base_path: Path where knowledge base files will be stored
        """
        self.smartbugs_path = Path(smartbugs_path)
        self.knowledge_base_path = Path(knowledge_base_path)
        self.knowledge_base_path.mkdir(parents=True, exist_ok=True)
        
        # Statistics tracking
        self.stats = {
            'total_contracts': 0,
            'processed_contracts': 0,
            'total_vulnerabilities': 0,
            'created_documents': 0,
            'errors': 0,
            'categories': {}
        }
    
    def validate_dataset(self) -> bool:
        """Validate that the SmartBugs dataset exists and has required files"""
        if not self.smartbugs_path.exists():
            logger.error(f"SmartBugs dataset not found at: {self.smartbugs_path}")
            return False
        
        vulnerabilities_file = self.smartbugs_path / 'vulnerabilities.json'
        if not vulnerabilities_file.exists():
            logger.error(f"vulnerabilities.json not found at: {vulnerabilities_file}")
            return False
        
        logger.info(f"SmartBugs dataset validated at: {self.smartbugs_path}")
        return True
    
    def load_vulnerabilities(self) -> List[Dict[str, Any]]:
        """Load vulnerability data from SmartBugs dataset"""
        vulnerabilities_file = self.smartbugs_path / 'vulnerabilities.json'
        
        try:
            with open(vulnerabilities_file, 'r', encoding='utf-8') as f:
                vulnerabilities = json.load(f)
            
            logger.info(f"Loaded {len(vulnerabilities)} contracts from vulnerabilities.json")
            return vulnerabilities
        
        except Exception as e:
            logger.error(f"Error loading vulnerabilities.json: {e}")
            return []
    
    def read_contract_code(self, contract_path: Path) -> List[str]:
        """Read contract code and return as list of lines"""
        try:
            with open(contract_path, 'r', encoding='utf-8') as f:
                return f.readlines()
        except UnicodeDecodeError:
            # Try with different encoding
            try:
                with open(contract_path, 'r', encoding='latin-1') as f:
                    return f.readlines()
            except Exception as e:
                logger.error(f"Error reading {contract_path} with latin-1: {e}")
                return []
        except Exception as e:
            logger.error(f"Error reading {contract_path}: {e}")
            return []
    
    def extract_code_snippet(self, contract_code: List[str], lines: List[int], 
                           context_lines: int = 5) -> str:
        """
        Extract code snippet around vulnerability lines with context
        
        Args:
            contract_code: List of code lines
            lines: List of vulnerable line numbers
            context_lines: Number of context lines before and after
        
        Returns:
            Code snippet as string
        """
        if not lines or not contract_code:
            return ""
        
        min_line = max(1, min(lines) - context_lines)
        max_line = min(len(contract_code), max(lines) + context_lines)
        
        snippet_lines = []
        for i in range(min_line, max_line + 1):
            line_marker = ">>> " if i in lines else "    "
            snippet_lines.append(f"{line_marker}{i:3d}: {contract_code[i-1].rstrip()}")
        
        return '\n'.join(snippet_lines)
    
    def create_vulnerability_document(self, contract_name: str, vulnerability: Dict[str, Any], 
                                    code_snippet: str, contract_info: Dict[str, Any]) -> str:
        """Create a structured document for a vulnerability"""
        category = vulnerability.get('category', 'unknown')
        lines = vulnerability.get('lines', [])
        description = vulnerability.get('description', f"{category} vulnerability detected")
        
        # Create comprehensive document
        document = f"""# Smart Contract Vulnerability Analysis

## Contract Information
- **Name**: {contract_name}
- **File**: {contract_info.get('path', 'unknown')}
- **Total Vulnerabilities**: {len(contract_info.get('vulnerabilities', []))}

## Vulnerability Details
- **Category**: {category}
- **Severity**: {vulnerability.get('severity', 'medium')}
- **Affected Lines**: {lines}
- **Description**: {description}

## Code Analysis
The following code snippet shows the vulnerable code with context:

```solidity
{code_snippet}
```

## Security Implications
Category: {category}
- This type of vulnerability can lead to various security issues
- Lines {lines} contain the problematic code patterns
- Immediate attention required for remediation

## Recommended Mitigations
Based on the vulnerability category "{category}", consider the following:
1. Review the highlighted code sections carefully
2. Apply security best practices for {category} vulnerabilities  
3. Consider using established security libraries
4. Implement proper access controls and validation

## Learning Context
This vulnerability was identified in the SmartBugs curated dataset, which contains
real-world examples of smart contract security issues. Use this information to
understand common vulnerability patterns and improve security analysis capabilities.

---
Generated from SmartBugs dataset for RAG knowledge base
"""
        return document
    
    def process_contract(self, contract_info: Dict[str, Any]) -> int:
        """Process a single contract and create vulnerability documents"""
        contract_name = contract_info.get('name', 'unknown')
        contract_path = self.smartbugs_path / contract_info.get('path', '')
        vulnerabilities = contract_info.get('vulnerabilities', [])
        
        if not vulnerabilities:
            logger.debug(f"No vulnerabilities found for contract: {contract_name}")
            return 0
        
        # Read contract code
        contract_code = self.read_contract_code(contract_path)
        if not contract_code:
            logger.error(f"Could not read contract code for: {contract_name}")
            self.stats['errors'] += 1
            return 0
        
        documents_created = 0
        
        for idx, vulnerability in enumerate(vulnerabilities):
            try:
                category = vulnerability.get('category', 'unknown')
                lines = vulnerability.get('lines', [])
                
                # Update category statistics
                self.stats['categories'][category] = self.stats['categories'].get(category, 0) + 1
                
                # Extract code snippet
                code_snippet = self.extract_code_snippet(contract_code, lines)
                
                # Create document
                document = self.create_vulnerability_document(
                    contract_name, vulnerability, code_snippet, contract_info
                )
                
                # Create filename
                line_range = f"{min(lines)}_{max(lines)}" if lines else "unknown"
                filename = f"{contract_name}_{category}_{line_range}_{idx}.txt"
                
                # Remove any invalid filename characters
                filename = "".join(c for c in filename if c.isalnum() or c in "._-")
                
                # Save document
                doc_path = self.knowledge_base_path / filename
                with open(doc_path, 'w', encoding='utf-8') as f:
                    f.write(document)
                
                documents_created += 1
                logger.debug(f"Created document: {filename}")
                
            except Exception as e:
                logger.error(f"Error processing vulnerability {idx} in {contract_name}: {e}")
                self.stats['errors'] += 1
        
        return documents_created
    
    def process_dataset(self) -> Dict[str, Any]:
        """Process the entire SmartBugs dataset"""
        logger.info("Starting SmartBugs dataset processing...")
        
        if not self.validate_dataset():
            return {"success": False, "error": "Dataset validation failed"}
        
        # Load vulnerability data
        vulnerabilities = self.load_vulnerabilities()
        if not vulnerabilities:
            return {"success": False, "error": "Could not load vulnerability data"}
        
        self.stats['total_contracts'] = len(vulnerabilities)
        
        # Process each contract
        for contract_info in vulnerabilities:
            try:
                contract_name = contract_info.get('name', 'unknown')
                logger.info(f"Processing contract: {contract_name}")
                
                # Process vulnerabilities for this contract
                docs_created = self.process_contract(contract_info)
                
                if docs_created > 0:
                    self.stats['processed_contracts'] += 1
                    self.stats['created_documents'] += docs_created
                    self.stats['total_vulnerabilities'] += len(contract_info.get('vulnerabilities', []))
                
            except Exception as e:
                logger.error(f"Error processing contract {contract_info.get('name', 'unknown')}: {e}")
                self.stats['errors'] += 1
        
        # Log final statistics
        self.log_statistics()
        
        return {
            "success": True,
            "statistics": self.stats
        }
    
    def log_statistics(self):
        """Log processing statistics"""
        logger.info("=" * 60)
        logger.info("SMARTBUGS PROCESSING COMPLETED")
        logger.info("=" * 60)
        logger.info(f"Total contracts in dataset: {self.stats['total_contracts']}")
        logger.info(f"Successfully processed contracts: {self.stats['processed_contracts']}")
        logger.info(f"Total vulnerabilities: {self.stats['total_vulnerabilities']}")
        logger.info(f"Documents created: {self.stats['created_documents']}")
        logger.info(f"Errors encountered: {self.stats['errors']}")
        logger.info(f"Knowledge base path: {self.knowledge_base_path.absolute()}")
        
        if self.stats['categories']:
            logger.info("\nVulnerability Categories:")
            for category, count in sorted(self.stats['categories'].items()):
                logger.info(f"  - {category}: {count}")
        
        logger.info("=" * 60)

def main():
    """Main function to run the SmartBugs processing"""
    import argparse
    
    parser = argparse.ArgumentParser(description='Process SmartBugs dataset for RAG knowledge base')
    parser.add_argument('--smartbugs-path', default='./smartbugs-curated',
                       help='Path to SmartBugs dataset (default: ./smartbugs-curated)')
    parser.add_argument('--knowledge-base-path', default='./data/knowledge_base',
                       help='Path to knowledge base directory (default: ./data/knowledge_base)')
    parser.add_argument('--log-level', default='INFO', choices=['DEBUG', 'INFO', 'WARNING', 'ERROR'],
                       help='Logging level (default: INFO)')
    
    args = parser.parse_args()
    
    # Update logger level
    logger.setLevel(args.log_level)
    
    # Create processor and run
    processor = SmartBugsProcessor(
        smartbugs_path=args.smartbugs_path,
        knowledge_base_path=args.knowledge_base_path
    )
    
    result = processor.process_dataset()
    
    if result["success"]:
        logger.info("SmartBugs dataset processing completed successfully!")
        return 0
    else:
        logger.error(f"Processing failed: {result.get('error', 'Unknown error')}")
        return 1

if __name__ == "__main__":
    exit(main())
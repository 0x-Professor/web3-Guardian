#!/usr/bin/env python3
"""
Knowledge Base Update Script

This script periodically updates the knowledge base with latest vulnerability data
from external sources like CVE databases, security blogs, and optimization patterns.
"""

import asyncio
import json
import os
from pathlib import Path
from datetime import datetime, timedelta
from typing import Dict, List, Any
import aiohttp
import feedparser
import sys

# Add the backend directory to the Python path
sys.path.append(str(Path(__file__).parent.parent))

from src.utils.logger import setup_logger
from src.utils.config import settings

logger = setup_logger(__name__, log_level='INFO')

class KnowledgeBaseUpdater:
    """Automated knowledge base updater for Web3 Guardian"""
    
    def __init__(self, knowledge_base_path: str = None):
        self.knowledge_base_path = Path(knowledge_base_path or settings.KNOWLEDGE_BASE_PATH)
        self.knowledge_base_path.mkdir(parents=True, exist_ok=True)
        
        # External data sources
        self.cve_api_url = "https://services.nvd.nist.gov/rest/json/cves/2.0"
        self.consensys_rss = "https://consensys.net/diligence/blog/feed/"
        self.openzeppelin_patterns_url = "https://raw.githubusercontent.com/OpenZeppelin/openzeppelin-contracts/master"
        
        self.stats = {
            'cve_updates': 0,
            'blog_updates': 0,
            'pattern_updates': 0,
            'total_documents': 0,
            'errors': 0
        }
    
    async def update_all_sources(self) -> Dict[str, Any]:
        """Update knowledge base from all external sources"""
        logger.info("Starting knowledge base update from all sources...")
        
        try:
            # Run all updates concurrently
            await asyncio.gather(
                self.update_cve_data(),
                self.update_security_blogs(),
                self.update_optimization_patterns(),
                return_exceptions=True
            )
            
            self.log_update_statistics()
            
            return {
                "success": True,
                "statistics": self.stats,
                "timestamp": datetime.utcnow().isoformat()
            }
            
        except Exception as e:
            logger.error(f"Knowledge base update failed: {e}")
            return {
                "success": False,
                "error": str(e),
                "statistics": self.stats
            }
    
    async def update_cve_data(self):
        """Fetch and process CVE data related to smart contracts"""
        logger.info("Updating CVE data...")
        
        try:
            # Search for smart contract related CVEs
            keywords = ["smart contract", "ethereum", "solidity", "defi", "blockchain"]
            
            for keyword in keywords:
                await self._fetch_cve_by_keyword(keyword)
                
        except Exception as e:
            logger.error(f"CVE update failed: {e}")
            self.stats['errors'] += 1
    
    async def _fetch_cve_by_keyword(self, keyword: str):
        """Fetch CVEs by keyword and create knowledge base documents"""
        try:
            async with aiohttp.ClientSession() as session:
                params = {
                    'keywordSearch': keyword,
                    'resultsPerPage': 20,
                    'startIndex': 0
                }
                
                async with session.get(self.cve_api_url, params=params) as response:
                    if response.status == 200:
                        data = await response.json()
                        
                        for cve in data.get('vulnerabilities', []):
                            await self._process_cve(cve)
                            
        except Exception as e:
            logger.error(f"Failed to fetch CVE data for keyword '{keyword}': {e}")
    
    async def _process_cve(self, cve_data: Dict):
        """Process a single CVE and create knowledge base document"""
        try:
            cve_info = cve_data.get('cve', {})
            cve_id = cve_info.get('id', 'unknown')
            
            # Skip if document already exists
            doc_filename = f"cve_{cve_id.lower().replace('-', '_')}.txt"
            doc_path = self.knowledge_base_path / doc_filename
            
            if doc_path.exists():
                return
            
            # Extract vulnerability information
            descriptions = cve_info.get('descriptions', [])
            description = next((d['value'] for d in descriptions if d['lang'] == 'en'), 'No description available')
            
            metrics = cve_info.get('metrics', {})
            severity = 'medium'  # default
            
            if 'cvssMetricV31' in metrics:
                severity_score = metrics['cvssMetricV31'][0]['cvssData']['baseScore']
                if severity_score >= 9.0:
                    severity = 'critical'
                elif severity_score >= 7.0:
                    severity = 'high'
                elif severity_score >= 4.0:
                    severity = 'medium'
                else:
                    severity = 'low'
            
            # Create structured document
            document = f"""# CVE Vulnerability Analysis: {cve_id}

## Vulnerability Information
- **CVE ID**: {cve_id}
- **Severity**: {severity}
- **Published**: {cve_info.get('published', 'Unknown')}
- **Last Modified**: {cve_info.get('lastModified', 'Unknown')}

## Description
{description}

## Security Implications
This CVE represents a documented vulnerability that has been reported and analyzed by security researchers. Smart contracts should be evaluated against similar patterns to prevent similar vulnerabilities.

## References
- **CVE Database**: https://nvd.nist.gov/vuln/detail/{cve_id}
- **MITRE**: https://cve.mitre.org/cgi-bin/cvename.cgi?name={cve_id}

## Recommended Actions
1. Review your smart contracts for similar vulnerability patterns
2. Implement proper input validation and access controls
3. Follow security best practices for smart contract development
4. Consider professional security audits for critical contracts

## Learning Context
This vulnerability information comes from the National Vulnerability Database (NVD) and represents real-world security issues that have been identified and documented by the security community.

---
Generated from CVE database for Web3 Guardian knowledge base
Last updated: {datetime.utcnow().isoformat()}
"""
            
            # Save document
            with open(doc_path, 'w', encoding='utf-8') as f:
                f.write(document)
            
            self.stats['cve_updates'] += 1
            logger.debug(f"Created CVE document: {doc_filename}")
            
        except Exception as e:
            logger.error(f"Failed to process CVE: {e}")
            self.stats['errors'] += 1
    
    async def update_security_blogs(self):
        """Update with latest security blog posts"""
        logger.info("Updating security blog data...")
        
        try:
            # Parse ConsenSys Diligence blog RSS
            feed = feedparser.parse(self.consensys_rss)
            
            for entry in feed.entries[:10]:  # Latest 10 posts
                await self._process_blog_post(entry)
                
        except Exception as e:
            logger.error(f"Security blog update failed: {e}")
            self.stats['errors'] += 1
    
    async def _process_blog_post(self, entry):
        """Process a blog post and create knowledge base document"""
        try:
            title = entry.title
            content = entry.summary
            link = entry.link
            published = getattr(entry, 'published', datetime.utcnow().isoformat())
            
            # Create filename from title
            safe_title = "".join(c for c in title if c.isalnum() or c in (' ', '-', '_')).rstrip()
            filename = f"blog_{safe_title[:50].replace(' ', '_').lower()}.txt"
            doc_path = self.knowledge_base_path / filename
            
            # Skip if document already exists
            if doc_path.exists():
                return
            
            # Create structured document
            document = f"""# Security Blog Analysis: {title}

## Article Information
- **Title**: {title}
- **Published**: {published}
- **Source**: ConsenSys Diligence Blog
- **URL**: {link}

## Content Summary
{content}

## Security Learning
This content comes from security experts and represents current thinking on smart contract security practices. Use this information to stay updated on emerging threats and best practices.

## Application to Smart Contracts
Review the discussed concepts and consider how they apply to your smart contract development and security analysis processes.

---
Generated from security blog for Web3 Guardian knowledge base
Last updated: {datetime.utcnow().isoformat()}
"""
            
            # Save document
            with open(doc_path, 'w', encoding='utf-8') as f:
                f.write(document)
            
            self.stats['blog_updates'] += 1
            logger.debug(f"Created blog document: {filename}")
            
        except Exception as e:
            logger.error(f"Failed to process blog post: {e}")
            self.stats['errors'] += 1
    
    async def update_optimization_patterns(self):
        """Update with gas optimization patterns"""
        logger.info("Updating optimization patterns...")
        
        try:
            optimization_patterns = [
                {
                    "title": "Storage Packing",
                    "description": "Pack struct variables to minimize storage slots",
                    "example": "struct User { uint128 balance; uint128 timestamp; address wallet; }",
                    "gas_savings": "Up to 20,000 gas per storage slot saved"
                },
                {
                    "title": "Unchecked Arithmetic",
                    "description": "Use unchecked blocks for safe arithmetic operations",
                    "example": "unchecked { counter += 1; }",
                    "gas_savings": "~20 gas per operation"
                },
                {
                    "title": "Function Visibility",
                    "description": "Use external instead of public for functions only called externally",
                    "example": "function withdraw() external { ... }",
                    "gas_savings": "~20 gas per call"
                },
                {
                    "title": "Short-circuit Evaluation",
                    "description": "Order conditional checks by gas costs",
                    "example": "require(cheapCheck && expensiveCheck, 'Invalid');",
                    "gas_savings": "Variable, depends on check complexity"
                }
            ]
            
            for pattern in optimization_patterns:
                await self._create_optimization_document(pattern)
                
        except Exception as e:
            logger.error(f"Optimization patterns update failed: {e}")
            self.stats['errors'] += 1
    
    async def _create_optimization_document(self, pattern: Dict):
        """Create an optimization pattern document"""
        try:
            title = pattern['title']
            filename = f"optimization_{title.lower().replace(' ', '_')}.txt"
            doc_path = self.knowledge_base_path / filename
            
            # Skip if document already exists
            if doc_path.exists():
                return
            
            document = f"""# Gas Optimization Pattern: {title}

## Optimization Details
- **Pattern**: {title}
- **Description**: {pattern['description']}
- **Estimated Savings**: {pattern['gas_savings']}

## Implementation Example
```solidity
{pattern['example']}
```

## When to Apply
This optimization should be considered when:
1. Gas costs are a primary concern
2. The pattern fits naturally into your contract design
3. Security is not compromised by the optimization

## Security Considerations
Always ensure that optimizations do not introduce security vulnerabilities. Security should never be compromised for gas savings.

## Learning Context
This optimization pattern is derived from best practices in the Ethereum community and OpenZeppelin contracts. Regular application of these patterns can significantly reduce gas costs.

---
Generated from optimization patterns for Web3 Guardian knowledge base
Last updated: {datetime.utcnow().isoformat()}
"""
            
            # Save document
            with open(doc_path, 'w', encoding='utf-8') as f:
                f.write(document)
            
            self.stats['pattern_updates'] += 1
            logger.debug(f"Created optimization document: {filename}")
            
        except Exception as e:
            logger.error(f"Failed to create optimization document: {e}")
            self.stats['errors'] += 1
    
    def log_update_statistics(self):
        """Log update statistics"""
        logger.info("=" * 60)
        logger.info("KNOWLEDGE BASE UPDATE COMPLETED")
        logger.info("=" * 60)
        logger.info(f"CVE updates: {self.stats['cve_updates']}")
        logger.info(f"Blog updates: {self.stats['blog_updates']}")
        logger.info(f"Pattern updates: {self.stats['pattern_updates']}")
        logger.info(f"Total new documents: {sum([self.stats['cve_updates'], self.stats['blog_updates'], self.stats['pattern_updates']])}")
        logger.info(f"Errors encountered: {self.stats['errors']}")
        logger.info(f"Knowledge base path: {self.knowledge_base_path.absolute()}")
        logger.info("=" * 60)

async def main():
    """Main function to run knowledge base updates"""
    import argparse
    
    parser = argparse.ArgumentParser(description='Update Web3 Guardian knowledge base')
    parser.add_argument('--knowledge-base-path', 
                       default=None,
                       help='Path to knowledge base directory')
    parser.add_argument('--source', 
                       choices=['all', 'cve', 'blogs', 'patterns'],
                       default='all',
                       help='Which sources to update')
    
    args = parser.parse_args()
    
    updater = KnowledgeBaseUpdater(args.knowledge_base_path)
    
    if args.source == 'all':
        result = await updater.update_all_sources()
    elif args.source == 'cve':
        await updater.update_cve_data()
        result = {"success": True, "statistics": updater.stats}
    elif args.source == 'blogs':
        await updater.update_security_blogs()
        result = {"success": True, "statistics": updater.stats}
    elif args.source == 'patterns':
        await updater.update_optimization_patterns()
        result = {"success": True, "statistics": updater.stats}
    
    if result["success"]:
        logger.info("Knowledge base update completed successfully!")
        return 0
    else:
        logger.error(f"Knowledge base update failed: {result.get('error')}")
        return 1

if __name__ == "__main__":
    exit(asyncio.run(main()))
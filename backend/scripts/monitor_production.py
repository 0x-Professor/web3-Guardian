#!/usr/bin/env python3
"""
Production Monitoring and Health Check Script

This script provides comprehensive monitoring for the Web3 Guardian backend
including health checks, performance metrics, and error tracking.
"""

import asyncio
import json
import time
from datetime import datetime, timedelta
from pathlib import Path
from typing import Dict, Any, List
import psutil
import aiohttp
import sys

# Add the backend directory to the Python path
sys.path.append(str(Path(__file__).parent.parent))

from src.utils.logger import setup_logger
from src.utils.config import settings
from src.rag.rag_pipeline import get_rag_pipeline

logger = setup_logger(__name__, log_level='INFO')

class ProductionMonitor:
    """Production monitoring and health checks for Web3 Guardian"""
    
    def __init__(self):
        self.backend_url = f"http://localhost:{getattr(settings, 'PORT', 8000)}"
        self.health_metrics = {
            'api_health': False,
            'database_health': False,
            'rag_pipeline_health': False,
            'vector_store_health': False,
            'tenderly_health': False,
            'system_metrics': {},
            'response_times': {},
            'error_count': 0,
            'timestamp': datetime.utcnow().isoformat()
        }
    
    async def run_comprehensive_health_check(self) -> Dict[str, Any]:
        """Run comprehensive health check of all system components"""
        logger.info("Starting comprehensive health check...")
        
        try:
            # Run all health checks concurrently
            await asyncio.gather(
                self.check_api_health(),
                self.check_rag_pipeline_health(),
                self.check_system_health(),
                self.check_external_services(),
                return_exceptions=True
            )
            
            # Calculate overall health score
            health_score = self.calculate_health_score()
            self.health_metrics['overall_health_score'] = health_score
            
            logger.info(f"Health check completed. Overall score: {health_score}")
            return self.health_metrics
            
        except Exception as e:
            logger.error(f"Health check failed: {e}")
            self.health_metrics['error'] = str(e)
            return self.health_metrics
    
    async def check_api_health(self):
        """Check API endpoint health and response times"""
        try:
            start_time = time.time()
            
            async with aiohttp.ClientSession() as session:
                async with session.get(f"{self.backend_url}/health") as response:
                    response_time = (time.time() - start_time) * 1000  # ms
                    
                    if response.status == 200:
                        self.health_metrics['api_health'] = True
                        self.health_metrics['response_times']['health_endpoint'] = response_time
                        logger.info(f"API health check passed ({response_time:.2f}ms)")
                    else:
                        self.health_metrics['api_health'] = False
                        logger.error(f"API health check failed: {response.status}")
                        
        except Exception as e:
            self.health_metrics['api_health'] = False
            self.health_metrics['error_count'] += 1
            logger.error(f"API health check failed: {e}")
    
    async def check_rag_pipeline_health(self):
        """Check RAG pipeline and vector store health"""
        try:
            # Test RAG pipeline initialization
            start_time = time.time()
            rag_pipeline = await get_rag_pipeline()
            init_time = (time.time() - start_time) * 1000
            
            self.health_metrics['rag_pipeline_health'] = True
            self.health_metrics['response_times']['rag_init'] = init_time
            
            # Test vector store query
            start_time = time.time()
            test_docs = rag_pipeline.vector_store.similarity_search("test query", k=1)
            query_time = (time.time() - start_time) * 1000
            
            self.health_metrics['vector_store_health'] = len(test_docs) >= 0  # Even 0 results is healthy
            self.health_metrics['response_times']['vector_query'] = query_time
            
            logger.info(f"RAG pipeline health check passed (init: {init_time:.2f}ms, query: {query_time:.2f}ms)")
            
        except Exception as e:
            self.health_metrics['rag_pipeline_health'] = False
            self.health_metrics['vector_store_health'] = False
            self.health_metrics['error_count'] += 1
            logger.error(f"RAG pipeline health check failed: {e}")
    
    def check_system_health(self):
        """Check system resource usage"""
        try:
            # CPU usage
            cpu_percent = psutil.cpu_percent(interval=1)
            
            # Memory usage
            memory = psutil.virtual_memory()
            memory_percent = memory.percent
            
            # Disk usage
            disk = psutil.disk_usage('/')
            disk_percent = disk.percent
            
            # Process count
            process_count = len(psutil.pids())
            
            self.health_metrics['system_metrics'] = {
                'cpu_percent': cpu_percent,
                'memory_percent': memory_percent,
                'disk_percent': disk_percent,
                'process_count': process_count,
                'available_memory_gb': round(memory.available / (1024**3), 2),
                'total_memory_gb': round(memory.total / (1024**3), 2)
            }
            
            # Check if system resources are healthy
            if cpu_percent < 90 and memory_percent < 90 and disk_percent < 90:
                logger.info(f"System health check passed (CPU: {cpu_percent}%, RAM: {memory_percent}%, Disk: {disk_percent}%)")
            else:
                logger.warning(f"System resources high (CPU: {cpu_percent}%, RAM: {memory_percent}%, Disk: {disk_percent}%)")
                
        except Exception as e:
            self.health_metrics['error_count'] += 1
            logger.error(f"System health check failed: {e}")
    
    async def check_external_services(self):
        """Check external service connectivity"""
        try:
            # Test Tenderly API
            if hasattr(settings, 'TENDERLY_TOKEN') and settings.TENDERLY_TOKEN:
                try:
                    async with aiohttp.ClientSession() as session:
                        headers = {'Authorization': f'Bearer {settings.TENDERLY_TOKEN}'}
                        async with session.get(
                            f"{settings.TENDERLY_API_URL}/api/v1/account",
                            headers=headers
                        ) as response:
                            self.health_metrics['tenderly_health'] = response.status == 200
                            
                except Exception as e:
                    self.health_metrics['tenderly_health'] = False
                    logger.warning(f"Tenderly health check failed: {e}")
            
            # Test Gemini API
            if hasattr(settings, 'GOOGLE_API_KEY') and settings.GOOGLE_API_KEY:
                try:
                    import google.generativeai as genai
                    genai.configure(api_key=settings.GOOGLE_API_KEY)
                    # Simple test - just configure, don't make a request to avoid quota usage
                    logger.info("Gemini API configuration successful")
                    
                except Exception as e:
                    logger.warning(f"Gemini API check failed: {e}")
                    
        except Exception as e:
            self.health_metrics['error_count'] += 1
            logger.error(f"External services health check failed: {e}")
    
    def calculate_health_score(self) -> float:
        """Calculate overall health score (0-100)"""
        score = 100.0
        
        # Deduct points for failed components
        if not self.health_metrics['api_health']:
            score -= 30
        if not self.health_metrics['rag_pipeline_health']:
            score -= 25
        if not self.health_metrics['vector_store_health']:
            score -= 20
        if not self.health_metrics['tenderly_health']:
            score -= 10
        
        # Deduct points for high resource usage
        system_metrics = self.health_metrics.get('system_metrics', {})
        if system_metrics.get('cpu_percent', 0) > 80:
            score -= 5
        if system_metrics.get('memory_percent', 0) > 80:
            score -= 5
        if system_metrics.get('disk_percent', 0) > 80:
            score -= 5
        
        return max(0.0, score)
    
    async def run_performance_test(self) -> Dict[str, Any]:
        """Run performance tests on key endpoints"""
        logger.info("Running performance tests...")
        
        performance_metrics = {
            'test_timestamp': datetime.utcnow().isoformat(),
            'endpoints': {},
            'rag_performance': {},
            'overall_performance_score': 0
        }
        
        try:
            # Test contract analysis endpoint
            test_contract = "0xa0b86991c31cc0d16c32b4c6f0d4c1e6b18d5d1d1"  # USDC
            
            start_time = time.time()
            async with aiohttp.ClientSession() as session:
                payload = {
                    "contract_address": test_contract,
                    "network": "mainnet",
                    "analysis_types": ["static"]
                }
                
                async with session.post(
                    f"{self.backend_url}/api/analyze/contract",
                    json=payload
                ) as response:
                    submit_time = (time.time() - start_time) * 1000
                    
                    if response.status == 200:
                        result = await response.json()
                        analysis_id = result.get('analysis_id')
                        
                        performance_metrics['endpoints']['contract_analysis_submit'] = {
                            'response_time_ms': submit_time,
                            'status': 'success'
                        }
                        
                        # Test polling endpoint
                        start_time = time.time()
                        async with session.get(
                            f"{self.backend_url}/api/analysis/{analysis_id}"
                        ) as poll_response:
                            poll_time = (time.time() - start_time) * 1000
                            
                            performance_metrics['endpoints']['analysis_poll'] = {
                                'response_time_ms': poll_time,
                                'status': 'success' if poll_response.status == 200 else 'failed'
                            }
                    
            # Calculate performance score
            avg_response_time = sum(
                endpoint['response_time_ms'] 
                for endpoint in performance_metrics['endpoints'].values()
            ) / len(performance_metrics['endpoints'])
            
            if avg_response_time < 100:
                performance_metrics['overall_performance_score'] = 100
            elif avg_response_time < 500:
                performance_metrics['overall_performance_score'] = 80
            elif avg_response_time < 1000:
                performance_metrics['overall_performance_score'] = 60
            else:
                performance_metrics['overall_performance_score'] = 40
                
            logger.info(f"Performance test completed. Average response time: {avg_response_time:.2f}ms")
            
        except Exception as e:
            logger.error(f"Performance test failed: {e}")
            performance_metrics['error'] = str(e)
        
        return performance_metrics

async def main():
    """Main monitoring function"""
    import argparse
    
    parser = argparse.ArgumentParser(description='Web3 Guardian Production Monitor')
    parser.add_argument('--test-type', 
                       choices=['health', 'performance', 'all'],
                       default='health',
                       help='Type of test to run')
    parser.add_argument('--output-file', 
                       help='Output results to JSON file')
    
    args = parser.parse_args()
    
    monitor = ProductionMonitor()
    
    results = {}
    
    if args.test_type in ['health', 'all']:
        results['health_check'] = await monitor.run_comprehensive_health_check()
    
    if args.test_type in ['performance', 'all']:
        results['performance_test'] = await monitor.run_performance_test()
    
    # Output results
    if args.output_file:
        with open(args.output_file, 'w') as f:
            json.dump(results, f, indent=2)
        logger.info(f"Results saved to {args.output_file}")
    else:
        print(json.dumps(results, indent=2))
    
    # Return appropriate exit code
    if 'health_check' in results:
        health_score = results['health_check'].get('overall_health_score', 0)
        if health_score < 70:
            logger.error(f"Health score below threshold: {health_score}")
            return 1
    
    return 0

if __name__ == "__main__":
    exit(asyncio.run(main()))
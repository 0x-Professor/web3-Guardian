# 📚 Web3 Guardian API Reference

**Version**: 2.1.0  
**Base URL**: `https://api.web3guardian.com`  
**Authentication**: API Key (Header: `X-API-Key`)

## 🌟 Overview

The Web3 Guardian API provides comprehensive smart contract security analysis powered by AI and real-world vulnerability data. Our RESTful API enables developers to integrate advanced security scanning into their Web3 applications.

### Key Features
- **AI-Powered Analysis**: Google Gemini + SmartBugs dataset integration
- **Real-time Processing**: Sub-100ms response times
- **Multi-Chain Support**: Ethereum, Polygon, BSC, Arbitrum, and more
- **Comprehensive Coverage**: Static analysis + dynamic simulation
- **Production Ready**: 99.9% uptime SLA with enterprise-grade infrastructure

## 🚀 Quick Start

### Authentication

```bash
# Include API key in all requests
curl -H "X-API-Key: your_api_key_here" \
     -H "Content-Type: application/json" \
     https://api.web3guardian.com/api/v1/contracts/analyze
```

### Rate Limits

| Tier | Requests/Hour | Burst Limit |
|------|---------------|-------------|
| **Free** | 100 | 10/minute |
| **Pro** | 1,000 | 50/minute |
| **Enterprise** | 10,000 | 200/minute |

## 📋 API Endpoints

### Contract Analysis

#### `POST /api/v1/contracts/analyze`

Start comprehensive smart contract analysis using AI-powered vulnerability detection.

**Request Body**:
```json
{
  "contract_address": "0x1234567890123456789012345678901234567890",
  "network": "mainnet",
  "analysis_types": ["static", "dynamic"],
  "options": {
    "include_source": true,
    "gas_optimization": true,
    "security_focus": "high"
  }
}
```

**Parameters**:

| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| `contract_address` | string | ✅ | Ethereum contract address (0x format) |
| `network` | string | ✅ | Network name (mainnet, goerli, polygon, bsc, etc.) |
| `analysis_types` | array | ✅ | Types of analysis: ["static", "dynamic"] |
| `options.include_source` | boolean | ❌ | Include source code in response |
| `options.gas_optimization` | boolean | ❌ | Enable gas optimization suggestions |
| `options.security_focus` | string | ❌ | Focus level: "low", "medium", "high" |

**Response**:
```json
{
  "success": true,
  "data": {
    "analysis_id": "550e8400-e29b-41d4-a716-446655440000",
    "status": "pending",
    "estimated_completion": "2025-08-05T10:30:00Z",
    "polling_url": "/api/v1/analysis/550e8400-e29b-41d4-a716-446655440000"
  }
}
```

#### `GET /api/v1/analysis/{analysis_id}`

Retrieve analysis results by ID with polling support.

**Response (Pending)**:
```json
{
  "success": true,
  "data": {
    "analysis_id": "550e8400-e29b-41d4-a716-446655440000",
    "status": "processing",
    "progress": 65,
    "stage": "rag_analysis",
    "estimated_completion": "2025-08-05T10:30:00Z"
  }
}
```

**Response (Completed)**:
```json
{
  "success": true,
  "data": {
    "analysis_id": "550e8400-e29b-41d4-a716-446655440000",
    "status": "completed",
    "contract_address": "0x1234567890123456789012345678901234567890",
    "network": "mainnet",
    "completed_at": "2025-08-05T10:28:43Z",
    "results": {
      "static": {
        "security_score": 7.5,
        "vulnerabilities": [
          {
            "title": "Reentrancy Vulnerability",
            "description": "Potential reentrancy in withdraw function at line 42",
            "severity": "high",
            "category": "reentrancy",
            "location": {
              "line_start": 42,
              "line_end": 58,
              "function": "withdraw"
            },
            "recommendation": "Use ReentrancyGuard modifier from OpenZeppelin",
            "confidence": 0.95,
            "cwe_id": "CWE-362",
            "source_documents": [
              "smartbugs_reentrancy_example_1.txt",
              "cve_2023_reentrancy_analysis.txt"
            ]
          }
        ],
        "optimizations": [
          {
            "title": "Gas Optimization: Use Unchecked Math",
            "description": "Safe arithmetic operations can use unchecked blocks",
            "location": {
              "line_start": 23,
              "line_end": 25
            },
            "gas_saved": 200,
            "recommendation": "Wrap safe arithmetic in unchecked{} blocks"
          }
        ],
        "code_quality": {
          "complexity_score": 6.2,
          "maintainability": "good",
          "test_coverage": "unknown"
        }
      },
      "dynamic": {
        "simulation_id": "sim_123456789",
        "execution_successful": true,
        "gas_usage": {
          "estimated": 45678,
          "limit": 500000,
          "efficiency": "good"
        },
        "state_changes": [
          {
            "storage_slot": "0x0",
            "old_value": "0x0",
            "new_value": "0x1"
          }
        ],
        "external_calls": [
          {
            "to": "0xabcdef...",
            "value": "0",
            "success": true
          }
        ]
      }
    },
    "metadata": {
      "analysis_duration_ms": 1250,
      "knowledge_base_version": "2.1.0",
      "ai_model": "gemini-pro-1.5"
    }
  }
}
```

### Enhanced Contract Analysis

#### `POST /api/v1/contracts/analyze/enhanced`

Advanced analysis with custom AI prompts and detailed vulnerability context.

**Request Body**:
```json
{
  "contract_address": "0x1234567890123456789012345678901234567890",
  "network": "mainnet",
  "analysis_depth": "comprehensive",
  "custom_prompts": [
    "Focus on DeFi-specific vulnerabilities",
    "Check for flash loan attack vectors"
  ],
  "include_source_code": true,
  "compare_similar_contracts": true
}
```

**Response**:
```json
{
  "success": true,
  "data": {
    "analysis_id": "enhanced_550e8400-e29b-41d4-a716-446655440000",
    "status": "pending",
    "analysis_type": "enhanced",
    "estimated_completion": "2025-08-05T10:35:00Z"
  }
}
```

### Transaction Simulation

#### `POST /api/v1/transactions/simulate`

Simulate transaction execution before submission using Tenderly integration.

**Request Body**:
```json
{
  "transaction": {
    "to": "0x1234567890123456789012345678901234567890",
    "data": "0xa9059cbb000000000000000000000000...",
    "value": "0x0",
    "from": "0xabcdef1234567890123456789012345678901234",
    "gas": "0x5208"
  },
  "network": "mainnet",
  "block_number": "latest",
  "options": {
    "trace_execution": true,
    "check_vulnerabilities": true
  }
}
```

**Response**:
```json
{
  "success": true,
  "data": {
    "simulation_id": "sim_987654321",
    "status": "success",
    "gas_used": 21000,
    "gas_price": "20000000000",
    "execution_trace": [
      {
        "pc": 0,
        "op": "PUSH1",
        "gas": 979000,
        "stack": []
      }
    ],
    "logs": [
      {
        "address": "0x1234567890123456789012345678901234567890",
        "topics": ["0x..."],
        "data": "0x..."
      }
    ],
    "security_analysis": {
      "risk_score": 2.1,
      "warnings": [],
      "recommendations": [
        "Transaction appears safe to execute"
      ]
    }
  }
}
```

### Security Scanning

#### `POST /api/v1/security/scan`

Comprehensive security scan with multiple analysis engines.

**Request Body**:
```json
{
  "targets": [
    {
      "type": "contract",
      "address": "0x1234567890123456789012345678901234567890",
      "network": "mainnet"
    },
    {
      "type": "transaction",
      "hash": "0xabcdef1234567890123456789012345678901234567890123456789012345678"
    }
  ],
  "scan_options": {
    "include_historical": true,
    "check_upgradability": true,
    "analyze_governance": true
  }
}
```

### Gas Optimization

#### `POST /api/v1/optimization/gas`

Analyze contract for gas optimization opportunities.

**Request Body**:
```json
{
  "contract_address": "0x1234567890123456789012345678901234567890",
  "network": "mainnet",
  "optimization_level": "aggressive",
  "preserve_functionality": true
}
```

**Response**:
```json
{
  "success": true,
  "data": {
    "optimizations": [
      {
        "type": "storage_packing",
        "description": "Pack struct variables to reduce storage slots",
        "gas_saved": 15000,
        "location": "lines 15-25",
        "implementation": "struct User { uint128 balance; uint128 timestamp; }"
      },
      {
        "type": "loop_optimization",
        "description": "Cache array length in loop conditions",
        "gas_saved": 300,
        "location": "line 67"
      }
    ],
    "total_gas_saved": 15300,
    "optimization_score": 8.7
  }
}
```

### Knowledge Base

#### `GET /api/v1/knowledge/vulnerabilities`

Query the SmartBugs vulnerability knowledge base.

**Query Parameters**:
- `category`: Vulnerability category (reentrancy, access_control, etc.)
- `severity`: Severity level (low, medium, high, critical)
- `limit`: Number of results (default: 20, max: 100)
- `search`: Full-text search query

**Response**:
```json
{
  "success": true,
  "data": {
    "vulnerabilities": [
      {
        "id": "smartbugs_001",
        "title": "Reentrancy in DAO Contract",
        "category": "reentrancy",
        "severity": "critical",
        "description": "Classic reentrancy vulnerability allowing drain of contract funds",
        "contract_name": "TheDAO",
        "affected_lines": [42, 43, 44, 45, 46, 47, 48],
        "cwe_id": "CWE-362",
        "cvss_score": 9.8
      }
    ],
    "total": 1,
    "page": 1,
    "pages": 1
  }
}
```

## 📊 Monitoring & Health

### Health Check

#### `GET /health`

System health and status information.

**Response**:
```json
{
  "status": "healthy",
  "version": "2.1.0",
  "uptime": 86400,
  "timestamp": "2025-08-05T10:00:00Z",
  "services": {
    "database": {
      "status": "healthy",
      "response_time_ms": 5
    },
    "redis": {
      "status": "healthy",
      "response_time_ms": 2
    },
    "rag_pipeline": {
      "status": "healthy",
      "knowledge_base_loaded": true,
      "documents": 1247
    },
    "tenderly": {
      "status": "healthy",
      "api_available": true
    },
    "gemini": {
      "status": "healthy",
      "quota_remaining": 95.2
    }
  }
}
```

### Metrics

#### `GET /metrics`

Prometheus-compatible metrics for monitoring.

**Response** (text/plain):
```
# HELP web3guardian_requests_total Total HTTP requests
# TYPE web3guardian_requests_total counter
web3guardian_requests_total{method="POST",endpoint="/api/v1/contracts/analyze"} 1247

# HELP web3guardian_vulnerabilities_detected_total Total vulnerabilities detected
# TYPE web3guardian_vulnerabilities_detected_total counter
web3guardian_vulnerabilities_detected_total{severity="high"} 43
web3guardian_vulnerabilities_detected_total{severity="medium"} 127

# HELP web3guardian_response_time_seconds Request response time
# TYPE web3guardian_response_time_seconds histogram
web3guardian_response_time_seconds_bucket{le="0.1"} 1156
web3guardian_response_time_seconds_bucket{le="0.5"} 1243
```

## 🔧 SDKs & Libraries

### Python SDK

```python
from web3guardian import Web3Guardian

# Initialize client
client = Web3Guardian(api_key="your_api_key")

# Analyze contract
analysis = await client.analyze_contract(
    address="0x1234567890123456789012345678901234567890",
    network="mainnet"
)

# Wait for results
results = await analysis.wait_for_completion()
print(f"Security score: {results.security_score}")
```

### JavaScript SDK

```javascript
import { Web3Guardian } from '@web3guardian/sdk';

const client = new Web3Guardian({ apiKey: 'your_api_key' });

// Analyze contract
const analysis = await client.analyzeContract({
  address: '0x1234567890123456789012345678901234567890',
  network: 'mainnet'
});

// Poll for results
const results = await analysis.waitForCompletion();
console.log(`Security score: ${results.securityScore}`);
```

## 🚨 Error Handling

### Error Response Format

```json
{
  "success": false,
  "error": {
    "code": "INVALID_CONTRACT_ADDRESS",
    "message": "The provided contract address is not valid",
    "details": {
      "address": "0xinvalid",
      "validation_errors": ["Invalid checksum", "Incorrect length"]
    }
  },
  "request_id": "req_550e8400-e29b-41d4-a716"
}
```

### Common Error Codes

| Code | HTTP Status | Description |
|------|-------------|-------------|
| `INVALID_CONTRACT_ADDRESS` | 400 | Contract address format is invalid |
| `CONTRACT_NOT_FOUND` | 404 | Contract not found on specified network |
| `NETWORK_NOT_SUPPORTED` | 400 | Specified network is not supported |
| `ANALYSIS_FAILED` | 500 | Internal error during analysis |
| `RATE_LIMIT_EXCEEDED` | 429 | API rate limit exceeded |
| `INVALID_API_KEY` | 401 | API key is missing or invalid |
| `INSUFFICIENT_QUOTA` | 402 | Account quota exceeded |

## 🎯 Best Practices

### Efficient API Usage

1. **Polling Strategy**: Use exponential backoff for polling analysis results
2. **Batch Requests**: Combine multiple analyses when possible
3. **Caching**: Cache results locally to reduce API calls
4. **Error Handling**: Implement robust retry logic with exponential backoff

### Example Polling Implementation

```python
import asyncio
import time

async def wait_for_analysis(client, analysis_id, max_wait=300):
    start_time = time.time()
    delay = 1  # Start with 1 second
    
    while time.time() - start_time < max_wait:
        result = await client.get_analysis(analysis_id)
        
        if result.status == "completed":
            return result
        elif result.status == "failed":
            raise Exception("Analysis failed")
        
        await asyncio.sleep(delay)
        delay = min(delay * 1.5, 30)  # Exponential backoff, max 30s
    
    raise TimeoutError("Analysis timed out")
```

## 📈 Usage Analytics

### Request Tracking

All API requests include tracking headers for analytics:

```http
X-Request-ID: req_550e8400-e29b-41d4-a716
X-Response-Time: 89ms
X-Rate-Limit-Remaining: 950
X-Rate-Limit-Reset: 1625097600
```

### Performance Metrics

- **Average Response Time**: <100ms for analysis initiation
- **Analysis Completion**: 95% complete within 2 minutes
- **Uptime**: 99.9% availability SLA
- **Error Rate**: <0.1% for valid requests

## 🔐 Security

### API Security Features

- **TLS 1.3**: All communications encrypted
- **API Key Authentication**: Secure key-based access
- **Rate Limiting**: Prevent abuse and ensure fair usage
- **Input Validation**: All inputs sanitized and validated
- **Audit Logging**: Complete request/response logging

### Security Headers

```http
Strict-Transport-Security: max-age=31536000; includeSubDomains
Content-Security-Policy: default-src 'self'
X-Content-Type-Options: nosniff
X-Frame-Options: DENY
X-XSS-Protection: 1; mode=block
```

## 📞 Support

### Getting Help

- **📖 Documentation**: [https://docs.web3guardian.dev](https://docs.web3guardian.dev)
- **💬 Discord**: [https://discord.gg/web3guardian](https://discord.gg/web3guardian)
- **📧 Support**: [api-support@web3guardian.dev](mailto:api-support@web3guardian.dev)
- **🐛 Issues**: [GitHub Issues](https://github.com/web3guardian/web3-guardian/issues)

### Enterprise Support

For enterprise customers with SLA requirements:
- **📞 Priority Support**: 24/7 technical support
- **🏢 Dedicated Account Manager**: Personal assistance
- **📊 Custom Analytics**: Tailored reporting and insights
- **🔧 Custom Integration**: Assistance with API integration

---

*API Documentation Version 2.1.0 | Last Updated: August 5, 2025*

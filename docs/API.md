# Web3 Guardian API Documentation

This document provides comprehensive API documentation for Web3 Guardian's FastAPI backend service.

## Base URL

- **Development**: `http://localhost:8000`
- **Production**: `https://api.web3guardian.com`

## Authentication

Currently, the API does not require authentication for basic endpoints. Rate limiting is implemented to prevent abuse.

## Core Endpoints

### Health Check

#### `GET /health`

Health check endpoint to verify service status.

**Response:**
```json
{
  "status": "healthy",
  "timestamp": "2025-08-05T10:30:00Z",
  "version": "1.0.0"
}
```

**Status Codes:**
- `200`: Service is healthy
- `503`: Service unavailable

---

### Smart Contract Analysis

#### `POST /analyze/contract`

Analyze a smart contract for vulnerabilities and security issues using the RAG pipeline.

**Request Body:**
```json
{
  "contract_address": "0x742d35cc6ccfcf8c2bb69b3c6bb12cf8c2bb69b3c",
  "network": "mainnet",
  "analysis_depth": "comprehensive",
  "include_gas_analysis": true,
  "user_context": {
    "user_address": "0x123...",
    "transaction_value": "1000000000000000000"
  }
}
```

**Parameters:**
- `contract_address` (string, required): Ethereum contract address
- `network` (string, optional): Network name (default: "mainnet")
- `analysis_depth` (string, optional): "quick" | "comprehensive" (default: "comprehensive")
- `include_gas_analysis` (boolean, optional): Include gas optimization analysis (default: true)
- `user_context` (object, optional): Additional context for analysis

**Response:**
```json
{
  "analysis_id": "550e8400-e29b-41d4-a716-446655440000",
  "status": "pending",
  "estimated_completion": "2025-08-05T10:35:00Z",
  "polling_url": "/analysis/550e8400-e29b-41d4-a716-446655440000"
}
```

**Status Codes:**
- `202`: Analysis started successfully
- `400`: Invalid request parameters
- `429`: Rate limit exceeded
- `500`: Internal server error

---

#### `GET /analysis/{analysis_id}`

Retrieve analysis results by analysis ID.

**Path Parameters:**
- `analysis_id` (string, required): UUID of the analysis

**Response (Pending):**
```json
{
  "analysis_id": "550e8400-e29b-41d4-a716-446655440000",
  "status": "pending",
  "progress": 45,
  "message": "Analyzing contract with RAG pipeline..."
}
```

**Response (Completed):**
```json
{
  "analysis_id": "550e8400-e29b-41d4-a716-446655440000",
  "status": "completed",
  "timestamp": "2025-08-05T10:35:00Z",
  "contract_info": {
    "address": "0x742d35cc6ccfcf8c2bb69b3c6bb12cf8c2bb69b3c",
    "network": "mainnet",
    "verified": true,
    "name": "ExampleContract",
    "compiler_version": "0.8.19"
  },
  "results": {
    "security_analysis": {
      "overall_risk_score": 7.5,
      "vulnerabilities": [
        {
          "id": "REENTRANCY_001",
          "title": "Reentrancy Vulnerability",
          "description": "External call before state change detected in withdraw function",
          "severity": "high",
          "confidence": 0.95,
          "location": {
            "function": "withdraw",
            "line_start": 45,
            "line_end": 50
          },
          "recommendation": "Use checks-effects-interactions pattern and consider using ReentrancyGuard",
          "cwe_id": "CWE-362",
          "source_documents": [
            {
              "content": "Similar reentrancy pattern found in DAO attack...",
              "metadata": {
                "source": "smartbugs_dataset",
                "contract": "reentrancy_simple",
                "similarity_score": 0.87
              }
            }
          ]
        }
      ],
      "code_quality": {
        "score": 8.2,
        "issues": [
          {
            "type": "naming_convention",
            "description": "Variable names should follow camelCase convention",
            "severity": "low",
            "location": "line 23"
          }
        ]
      },
      "compliance": {
        "erc_standards": ["ERC-20"],
        "issues": []
      }
    },
    "gas_analysis": {
      "total_deployment_gas": 1500000,
      "function_gas_estimates": {
        "transfer": 21000,
        "approve": 45000,
        "withdraw": 55000
      },
      "optimizations": [
        {
          "title": "Pack Struct Variables",
          "description": "Reorder struct members to reduce storage slots",
          "location": "line 15-20",
          "estimated_savings": "2000 gas per transaction",
          "code_suggestion": "struct User { uint128 balance; uint128 timestamp; address account; }"
        }
      ]
    },
    "simulation_results": {
      "tenderly_simulation_id": "sim_123456789",
      "test_scenarios": [
        {
          "name": "Normal Transfer",
          "status": "success",
          "gas_used": 21000,
          "state_changes": []
        },
        {
          "name": "Reentrancy Attack",
          "status": "reverted",
          "reason": "Potential reentrancy detected",
          "gas_used": 0
        }
      ]
    },
    "metadata": {
      "analysis_duration_ms": 2500,
      "rag_retrieval_count": 5,
      "vector_similarity_threshold": 0.8,
      "gemini_model_used": "gemini-1.5-flash",
      "knowledge_base_version": "1.2.0"
    }
  }
}
```

**Status Codes:**
- `200`: Analysis results retrieved successfully
- `202`: Analysis still in progress
- `404`: Analysis ID not found
- `500`: Internal server error

---

### Transaction Analysis

#### `POST /analyze/transaction`

Analyze a transaction before execution using Tenderly simulation.

**Request Body:**
```json
{
  "to": "0x742d35cc6ccfcf8c2bb69b3c6bb12cf8c2bb69b3c",
  "from": "0x123...",
  "value": "1000000000000000000",
  "data": "0xa9059cbb...",
  "gas_limit": 100000,
  "network": "mainnet"
}
```

**Response:**
```json
{
  "transaction_id": "tx_550e8400-e29b-41d4-a716-446655440000",
  "risk_assessment": {
    "overall_risk": "medium",
    "risk_factors": [
      {
        "type": "contract_security",
        "severity": "medium",
        "description": "Contract has known vulnerabilities"
      }
    ]
  },
  "simulation": {
    "success": true,
    "gas_used": 85000,
    "gas_price_gwei": 20,
    "estimated_cost_usd": 12.50,
    "state_changes": [
      {
        "address": "0x742d35cc6ccfcf8c2bb69b3c6bb12cf8c2bb69b3c",
        "storage_changes": [
          {
            "slot": "0x1",
            "before": "0x0",
            "after": "0x1"
          }
        ]
      }
    ],
    "events": [
      {
        "address": "0x742d35cc6ccfcf8c2bb69b3c6bb12cf8c2bb69b3c",
        "topics": ["0xddf252ad1be2c89b69c2b068fc378daa952ba7f163c4a11628f55a4df523b3ef"],
        "data": "0x..."
      }
    ]
  },
  "recommendations": [
    "Consider reducing gas limit to 90000 for cost optimization",
    "Review contract security issues before proceeding"
  ]
}
```

---

### Batch Analysis

#### `POST /analyze/batch`

Analyze multiple contracts or transactions in a single request.

**Request Body:**
```json
{
  "analyses": [
    {
      "type": "contract",
      "contract_address": "0x742d35cc6ccfcf8c2bb69b3c6bb12cf8c2bb69b3c",
      "network": "mainnet"
    },
    {
      "type": "transaction",
      "to": "0x456...",
      "from": "0x123...",
      "value": "500000000000000000"
    }
  ],
  "priority": "normal"
}
```

**Response:**
```json
{
  "batch_id": "batch_550e8400-e29b-41d4-a716-446655440000",
  "total_analyses": 2,
  "status": "processing",
  "individual_analyses": [
    {
      "analysis_id": "550e8400-e29b-41d4-a716-446655440001",
      "type": "contract",
      "status": "pending"
    },
    {
      "analysis_id": "550e8400-e29b-41d4-a716-446655440002",
      "type": "transaction", 
      "status": "completed"
    }
  ]
}
```

---

## Knowledge Base Endpoints

### `GET /knowledge-base/stats`

Get statistics about the loaded knowledge base.

**Response:**
```json
{
  "total_documents": 208,
  "vulnerability_categories": {
    "reentrancy": 35,
    "integer_overflow": 28,
    "access_control": 42,
    "denial_of_service": 18,
    "other": 85
  },
  "vector_store_size": 15420,
  "last_updated": "2025-08-05T08:00:00Z",
  "smartbugs_version": "2.0",
  "embedding_model": "sentence-transformers/all-MiniLM-L6-v2"
}
```

### `POST /knowledge-base/search`

Search the knowledge base for similar vulnerability patterns.

**Request Body:**
```json
{
  "query": "function withdraw() public { msg.sender.call.value(balances[msg.sender])(); balances[msg.sender] = 0; }",
  "max_results": 5,
  "similarity_threshold": 0.7
}
```

**Response:**
```json
{
  "results": [
    {
      "document_id": "smartbugs_reentrancy_001",
      "similarity_score": 0.95,
      "content": "Vulnerable reentrancy pattern detected...",
      "metadata": {
        "source": "smartbugs_dataset",
        "vulnerability_type": "reentrancy",
        "contract_name": "reentrancy_simple"
      }
    }
  ],
  "total_results": 3,
  "query_time_ms": 150
}
```

---

## Administrative Endpoints

### `POST /admin/knowledge-base/refresh`

Refresh the knowledge base with latest data (admin only).

**Request Body:**
```json
{
  "source": "smartbugs",
  "force_reload": true
}
```

**Response:**
```json
{
  "status": "refreshing",
  "job_id": "refresh_550e8400-e29b-41d4-a716-446655440000",
  "estimated_duration_minutes": 5
}
```

---

## WebSocket Endpoints

### `WS /ws/analysis/{analysis_id}`

Real-time updates for analysis progress.

**Connection Example:**
```javascript
const ws = new WebSocket('ws://localhost:8000/ws/analysis/550e8400-e29b-41d4-a716-446655440000');

ws.onmessage = function(event) {
    const data = JSON.parse(event.data);
    console.log('Analysis update:', data);
};
```

**Message Format:**
```json
{
  "type": "progress_update",
  "analysis_id": "550e8400-e29b-41d4-a716-446655440000",
  "progress": 75,
  "stage": "vector_similarity_search",
  "message": "Searching for similar vulnerability patterns..."
}
```

---

## Error Handling

### Standard Error Response

```json
{
  "error": {
    "code": "INVALID_CONTRACT_ADDRESS",
    "message": "The provided contract address is not valid",
    "details": {
      "field": "contract_address",
      "provided_value": "0xinvalid"
    },
    "timestamp": "2025-08-05T10:30:00Z",
    "request_id": "req_550e8400-e29b-41d4-a716-446655440000"
  }
}
```

### Common Error Codes

| Code | HTTP Status | Description |
|------|-------------|-------------|
| `INVALID_CONTRACT_ADDRESS` | 400 | Contract address format is invalid |
| `CONTRACT_NOT_FOUND` | 404 | Contract not found on specified network |
| `ANALYSIS_NOT_FOUND` | 404 | Analysis ID does not exist |
| `RATE_LIMIT_EXCEEDED` | 429 | Too many requests from client |
| `GEMINI_API_ERROR` | 503 | Google Gemini API unavailable |
| `TENDERLY_API_ERROR` | 503 | Tenderly simulation service unavailable |
| `KNOWLEDGE_BASE_ERROR` | 503 | Vector store or embeddings unavailable |

---

## Rate Limiting

- **Contract Analysis**: 10 requests per minute per IP
- **Transaction Analysis**: 20 requests per minute per IP
- **Knowledge Base Search**: 50 requests per minute per IP
- **Batch Analysis**: 5 requests per minute per IP

Rate limit headers are included in responses:
```
X-RateLimit-Limit: 10
X-RateLimit-Remaining: 7
X-RateLimit-Reset: 1691236800
```

---

## SDK Examples

### Python SDK

```python
import asyncio
from web3guardian import Web3GuardianClient

async def analyze_contract():
    client = Web3GuardianClient(base_url="http://localhost:8000")
    
    # Start analysis
    analysis = await client.analyze_contract(
        contract_address="0x742d35cc6ccfcf8c2bb69b3c6bb12cf8c2bb69b3c",
        network="mainnet"
    )
    
    # Poll for results
    results = await client.wait_for_analysis(analysis.analysis_id)
    
    print(f"Security Score: {results.security_analysis.overall_risk_score}")
    for vuln in results.security_analysis.vulnerabilities:
        print(f"Vulnerability: {vuln.title} ({vuln.severity})")

asyncio.run(analyze_contract())
```

### JavaScript SDK

```javascript
import { Web3GuardianClient } from '@web3guardian/sdk';

const client = new Web3GuardianClient({
  baseUrl: 'http://localhost:8000'
});

async function analyzeContract() {
  try {
    const analysis = await client.analyzeContract({
      contractAddress: '0x742d35cc6ccfcf8c2bb69b3c6bb12cf8c2bb69b3c',
      network: 'mainnet'
    });
    
    const results = await client.waitForAnalysis(analysis.analysisId);
    
    console.log('Security Score:', results.securityAnalysis.overallRiskScore);
    results.securityAnalysis.vulnerabilities.forEach(vuln => {
      console.log(`Vulnerability: ${vuln.title} (${vuln.severity})`);
    });
  } catch (error) {
    console.error('Analysis failed:', error);
  }
}

analyzeContract();
```

---

## Changelog

### Version 1.0.0 (Current)
- Initial API release
- RAG pipeline integration
- SmartBugs knowledge base
- Tenderly simulation support
- Real-time WebSocket updates

### Upcoming Features
- Multi-chain support expansion
- Advanced gas optimization recommendations
- Custom rule engine
- Webhook notifications
- GraphQL API support

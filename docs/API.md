# Web3 Guardian API Documentation

## Overview

The Web3 Guardian API is a FastAPI-based RESTful service that provides comprehensive smart contract analysis, transaction simulation, and security assessment capabilities. It integrates with Tenderly for dynamic analysis and includes RAG-powered vulnerability detection.

## Base URL

```
Production: https://api.web3guardian.dev
Development: http://localhost:8000
```

## Authentication

Currently, the API is open for public use. Authentication will be implemented in future versions.

## Rate Limiting

- **Default**: 100 requests per minute per IP
- **Analysis endpoints**: 10 requests per minute per IP
- **Health check**: No rate limiting

## Response Format

All API responses follow a consistent format:

```json
{
  "success": true,
  "data": {},
  "error": null,
  "timestamp": "2025-08-04T12:00:00Z"
}
```

## Endpoints

### Health Check

Check the API service status.

**Endpoint:** `GET /health`

**Response:**
```json
{
  "status": "healthy",
  "version": "1.0.0",
  "timestamp": "2025-08-04T12:00:00Z"
}
```

### Contract Analysis

Analyze a smart contract for vulnerabilities and optimization opportunities.

**Endpoint:** `POST /api/analyze/contract`

**Request Body:**
```json
{
  "contract_address": "0x1234567890123456789012345678901234567890",
  "network": "mainnet",
  "analysis_types": ["static", "dynamic"],
  "user_address": "0x0987654321098765432109876543210987654321"
}
```

**Parameters:**
- `contract_address` (string, required): The smart contract address to analyze
- `network` (string, optional): Blockchain network (default: "mainnet")
  - Supported networks: `mainnet`, `goerli`, `sepolia`, `polygon`, `arbitrum`, `optimism`, `bsc`, `avalanche`
- `analysis_types` (array, optional): Types of analysis to perform (default: ["static", "dynamic"])
  - `static`: Source code analysis, vulnerability detection
  - `dynamic`: Transaction simulation, gas estimation
- `user_address` (string, optional): User's wallet address for personalized analysis

**Response:**
```json
{
  "analysis_id": "550e8400-e29b-41d4-a716-446655440000",
  "status": "pending",
  "results": {},
  "error": null
}
```

**Status Codes:**
- `200`: Analysis started successfully
- `400`: Invalid request parameters
- `429`: Rate limit exceeded
- `500`: Internal server error

### Get Analysis Results

Retrieve the results of a previously submitted analysis.

**Endpoint:** `GET /api/analysis/{analysis_id}`

**Path Parameters:**
- `analysis_id` (string, required): The unique analysis identifier

**Response:**
```json
{
  "analysis_id": "550e8400-e29b-41d4-a716-446655440000",
  "status": "completed",
  "results": {
    "static": {
      "vulnerabilities": [
        {
          "severity": "high",
          "title": "Reentrancy Vulnerability",
          "description": "Potential reentrancy vulnerability found in withdraw function",
          "location": "contracts/Vault.sol:42-58",
          "recommendation": "Use checks-effects-interactions pattern or reentrancy guards"
        }
      ],
      "optimizations": [
        {
          "title": "Gas Optimization",
          "description": "Use unchecked for arithmetic operations where overflow is not possible",
          "location": "contracts/Vault.sol:23",
          "potential_savings": "~500 gas per operation"
        }
      ],
      "security_score": 7.5,
      "contract_type": "ERC20",
      "is_verified": true,
      "compiler_version": "0.8.19"
    },
    "dynamic": {
      "simulation_id": "tenderly-sim-12345",
      "gas_used": 45000,
      "status": true,
      "execution_trace": {
        "calls": [],
        "logs": []
      },
      "error": null
    }
  },
  "error": null
}
```

**Analysis Status:**
- `pending`: Analysis is queued
- `in_progress`: Analysis is currently running
- `completed`: Analysis finished successfully
- `failed`: Analysis encountered an error

**Vulnerability Severity Levels:**
- `critical`: Immediate security risk, funds at risk
- `high`: Significant security concern
- `medium`: Notable issue requiring attention
- `low`: Minor issue or best practice violation
- `info`: Informational finding

### Transaction Analysis (Legacy)

Analyze a transaction for potential risks before execution.

**Endpoint:** `POST /api/analyze/transaction`

**Request Body:**
```json
{
  "tx_data": {
    "from": "0x1234567890123456789012345678901234567890",
    "to": "0x0987654321098765432109876543210987654321",
    "value": "1000000000000000000",
    "data": "0xa9059cbb...",
    "gas": "21000",
    "gasPrice": "20000000000"
  },
  "network": "mainnet",
  "user_address": "0x1234567890123456789012345678901234567890"
}
```

**Response:**
```json
{
  "success": true,
  "risk_level": "low",
  "risk_score": 2.5,
  "recommendations": [
    "Transaction appears safe to execute",
    "Gas price is within optimal range"
  ],
  "simulation": {
    "success": true,
    "gas_used": 21000,
    "gas_estimate": 21000,
    "state_changes": []
  },
  "contract_analysis": {
    "is_verified": true,
    "has_known_vulnerabilities": false,
    "trust_score": 8.5
  }
}
```

### Contract Simulation

Simulate contract interactions using Tenderly.

**Endpoint:** `POST /api/simulate/transaction`

**Request Body:**
```json
{
  "from_address": "0x1234567890123456789012345678901234567890",
  "to_address": "0x0987654321098765432109876543210987654321",
  "value": "0",
  "data": "0xa9059cbb...",
  "network": "mainnet",
  "block_number": null,
  "save": true
}
```

**Response:**
```json
{
  "simulation_id": "tenderly-sim-12345",
  "success": true,
  "gas_used": 45000,
  "gas_estimate": 45000,
  "logs": [],
  "trace": {
    "calls": [],
    "steps": []
  },
  "state_changes": [],
  "error": null
}
```

### Gas Estimation

Get optimized gas prices for different confirmation speeds.

**Endpoint:** `GET /api/gas/{network}`

**Path Parameters:**
- `network` (string, required): Blockchain network

**Response:**
```json
{
  "network": "mainnet",
  "prices": {
    "slow": {
      "gas_price": "15000000000",
      "estimated_time": "5-10 minutes"
    },
    "standard": {
      "gas_price": "20000000000",
      "estimated_time": "2-5 minutes"
    },
    "fast": {
      "gas_price": "25000000000",
      "estimated_time": "<2 minutes"
    }
  },
  "base_fee": "12000000000",
  "priority_fee": "2000000000",
  "timestamp": "2025-08-04T12:00:00Z"
}
```

### Security Scan

Perform a comprehensive security scan on a contract or address.

**Endpoint:** `POST /api/security/scan`

**Request Body:**
```json
{
  "target": "0x1234567890123456789012345678901234567890",
  "scan_type": "contract",
  "network": "mainnet",
  "deep_scan": true
}
```

**Response:**
```json
{
  "scan_id": "scan-12345",
  "target": "0x1234567890123456789012345678901234567890",
  "scan_type": "contract",
  "results": {
    "security_score": 8.5,
    "risk_level": "low",
    "findings": [],
    "recommendations": [],
    "compliance": {
      "eip_compliance": true,
      "best_practices": 0.9
    }
  },
  "metadata": {
    "scan_duration": "45.2s",
    "rules_checked": 156,
    "timestamp": "2025-08-04T12:00:00Z"
  }
}
```

## Error Handling

### Error Response Format

```json
{
  "success": false,
  "error": {
    "code": "INVALID_CONTRACT_ADDRESS",
    "message": "The provided contract address is invalid",
    "details": {
      "field": "contract_address",
      "value": "invalid_address"
    }
  },
  "timestamp": "2025-08-04T12:00:00Z"
}
```

### Common Error Codes

| Code | HTTP Status | Description |
|------|-------------|-------------|
| `INVALID_REQUEST` | 400 | Request validation failed |
| `INVALID_CONTRACT_ADDRESS` | 400 | Contract address is invalid |
| `UNSUPPORTED_NETWORK` | 400 | Network is not supported |
| `ANALYSIS_NOT_FOUND` | 404 | Analysis ID not found |
| `RATE_LIMIT_EXCEEDED` | 429 | Too many requests |
| `TENDERLY_ERROR` | 502 | Tenderly API error |
| `INTERNAL_ERROR` | 500 | Internal server error |

## SDKs and Libraries

### JavaScript/TypeScript

```bash
npm install @web3guardian/sdk
```

```typescript
import { Web3Guardian } from '@web3guardian/sdk';

const guardian = new Web3Guardian('https://api.web3guardian.dev');

// Analyze a contract
const analysis = await guardian.analyzeContract({
  contract_address: '0x1234...',
  network: 'mainnet',
  analysis_types: ['static', 'dynamic']
});

// Get analysis results
const results = await guardian.getAnalysis(analysis.analysis_id);
```

### Python

```bash
pip install web3guardian-sdk
```

```python
from web3guardian import Web3Guardian

guardian = Web3Guardian('https://api.web3guardian.dev')

# Analyze a contract
analysis = guardian.analyze_contract(
    contract_address='0x1234...',
    network='mainnet',
    analysis_types=['static', 'dynamic']
)

# Get analysis results
results = guardian.get_analysis(analysis['analysis_id'])
```

## Webhooks

Configure webhooks to receive real-time notifications when analyses complete.

**Webhook URL Configuration:**
```json
{
  "url": "https://your-app.com/webhooks/web3guardian",
  "events": ["analysis.completed", "analysis.failed"],
  "secret": "your-webhook-secret"
}
```

**Webhook Payload:**
```json
{
  "event": "analysis.completed",
  "data": {
    "analysis_id": "550e8400-e29b-41d4-a716-446655440000",
    "status": "completed",
    "results": {
      // Analysis results
    }
  },
  "timestamp": "2025-08-04T12:00:00Z"
}
```

## Rate Limits and Quotas

| Plan | Requests/minute | Analyses/day | Storage |
|------|-----------------|--------------|---------|
| Free | 100 | 50 | 1GB |
| Pro | 1000 | 500 | 10GB |
| Enterprise | 10000 | Unlimited | 100GB |

## Support and Contact

- **Documentation**: https://docs.web3guardian.dev
- **Support**: https://support.web3guardian.dev
- **Discord**: https://discord.gg/web3guardian
- **Email**: api@web3guardian.dev

## Changelog

### v1.0.0 (2025-08-04)
- Initial API release
- Contract analysis endpoints
- Tenderly integration
- RAG-powered vulnerability detection
- Gas optimization recommendations

---

*Last updated: August 4, 2025*

# Web3 Guardian API Documentation

## Base URL

```
https://api.web3guardian.example.com/v1
```

## Authentication

All API endpoints (except `/health`) require authentication using a Bearer token:

```
Authorization: Bearer <your_api_key>
```

## Endpoints

### Health Check

```
GET /health
```

Check if the API is running.

**Response**
```json
{
  "status": "healthy",
  "version": "1.0.0",
  "timestamp": "2023-08-03T11:30:00Z"
}
```

### Analyze Transaction

```
POST /api/analyze
```

Analyze a Web3 transaction for security risks and optimization opportunities.

**Request Body**
```json
{
  "tx_data": {
    "from": "0x...",
    "to": "0x...",
    "value": "0x...",
    "data": "0x...",
    "gas": "0x...",
    "gasPrice": "0x..."
  },
  "network": "ethereum",
  "user_address": "0x..."
}
```

**Response**
```json
{
  "success": true,
  "risk_level": "low",
  "recommendations": [
    {
      "id": "gas_price_high",
      "severity": "medium",
      "title": "High Gas Price",
      "description": "Current gas price is 20% above the network average.",
      "suggested_action": "Reduce gas price to 42 Gwei"
    }
  ],
  "simulation": {
    "success": true,
    "gas_used": 21000,
    "error": null,
    "state_changes": []
  },
  "contract_analysis": {
    "verified": true,
    "malicious": false,
    "interactions": ["transfer", "approve"]
  }
}
```

### Simulate Transaction

```
POST /api/simulate
```

Simulate a transaction using Tenderly.

**Request Body**
```json
{
  "tx_data": {
    "from": "0x...",
    "to": "0x...",
    "value": "0x...",
    "data": "0x..."
  },
  "network_id": "1"
}
```

**Response**
```json
{
  "success": true,
  "gas_used": 45678,
  "error": null,
  "trace": [],
  "logs": []
}
```

### Get Gas Prices

```
GET /api/gas/prices
```

Get current gas price recommendations.

**Response**
```json
{
  "safe_low": {
    "max_priority_fee": 1.5,
    "max_fee": 45.2
  },
  "standard": {
    "max_priority_fee": 2.5,
    "max_fee": 47.8
  },
  "fast": {
    "max_priority_fee": 3.5,
    "max_fee": 50.1
  },
  "estimated_base_fee": 42.3,
  "block_number": 15438242,
  "block_time": 12.2
}
```

## Error Responses

### 400 Bad Request
```json
{
  "detail": "Invalid input data"
}
```

### 401 Unauthorized
```json
{
  "detail": "Could not validate credentials"
}
```

### 429 Too Many Requests
```json
{
  "detail": "Rate limit exceeded"
}
```

### 500 Internal Server Error
```json
{
  "detail": "Internal server error"
}
```

## Rate Limiting

- 100 requests per minute per IP address
- 1,000 requests per day per API key

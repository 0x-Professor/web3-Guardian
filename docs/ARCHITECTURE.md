# Web3 Guardian Architecture

## System Overview

Web3 Guardian is a browser extension that enhances security and optimizes transactions in the Web3 ecosystem. The system consists of two main components:

1. **Browser Extension**: Intercepts and analyzes Web3 transactions
2. **Backend Service**: Provides transaction analysis, simulation, and optimization

## Component Architecture

### 1. Browser Extension

#### Content Script (`content.js`)
- Injects into web pages to intercept Web3 transactions
- Monitors `window.ethereum` for transaction requests
- Communicates with the background script for analysis

#### Background Script (`background.js`)
- Acts as the extension's service worker
- Manages communication between content scripts and popup
- Handles transaction analysis requests
- Manages user settings and state

#### Popup UI (`popup/`)
- React-based user interface
- Displays transaction details and analysis
- Provides user controls (approve/reject)
- Shows security recommendations

### 2. Backend Service

#### API Server (`main.py`)
- FastAPI-based REST API
- Handles authentication and request validation
- Routes requests to appropriate services
- Implements rate limiting and security middleware

#### RAG Pipeline (`rag_pipeline.py`)
- Document analysis using LangChain
- Context-aware transaction analysis
- Integration with knowledge bases

#### Transaction Simulation (`tenderly.py`)
- Transaction simulation using Tenderly
- Gas estimation
- State change analysis

#### Gas Optimization (`gas_optimizer.py`)
- Gas price optimization
- Transaction batching
- Gas token support

## Data Flow

1. **Transaction Interception**
   - User initiates a transaction in a dApp
   - Content script intercepts the transaction
   - Transaction details are sent to the background script

2. **Analysis Request**
   - Background script sends transaction to backend
   - Backend performs security analysis and simulation
   - Results are returned to the extension

3. **User Decision**
   - User reviews analysis in the popup
   - Can approve, modify, or reject the transaction
   - Decision is sent back to the dApp

## Security Considerations

- All sensitive operations require user confirmation
- Private keys never leave the user's device
- HTTPS is enforced for all API communications
- Rate limiting prevents abuse
- Input validation on all endpoints

## Performance Considerations

- Caching of frequently accessed data
- Asynchronous processing of non-critical tasks
- Optimized database queries
- Load balancing for high availability

## Future Enhancements

- Support for more blockchains
- Decentralized storage for analysis results
- Machine learning for improved risk assessment
- Integration with hardware wallets

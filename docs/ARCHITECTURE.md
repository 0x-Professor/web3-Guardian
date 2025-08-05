# Web3 Guardian Architecture

## System Overview

Web3 Guardian is a comprehensive Web3 security platform that combines a browser extension with advanced backend services to provide real-time smart contract analysis, transaction simulation, and risk assessment. The system leverages cutting-edge RAG (Retrieval-Augmented Generation) technology with SmartBugs dataset integration and Tenderly simulation for comprehensive security analysis.

## High-Level Architecture

```
┌─────────────────────────────────────────────────────────────────┐
│                    Browser Extension Layer                      │
├─────────────────────────────────────────────────────────────────┤
│  Content Scripts  │  Background Service  │  Popup UI (React)   │
│  • TX Interception│  • API Communication │  • User Interface   │
│  • Web3 Detection│  • State Management   │  • Analysis Display │
│  • Risk Alerts   │  • Settings Storage   │  • User Controls    │
└─────────────────────┬───────────────────────────────────────────┘
                      │ HTTPS/WebSocket
┌─────────────────────▼───────────────────────────────────────────┐
│                    Backend API Layer                            │
├─────────────────────────────────────────────────────────────────┤
│  FastAPI Server   │  Authentication    │  Rate Limiting        │
│  • REST Endpoints │  • JWT Tokens      │  • Request Throttling │
│  • WebSocket      │  • API Keys        │  • DDoS Protection    │
│  • Auto Docs      │  • CORS Handling   │  • Security Headers   │
└─────────────────────┬───────────────────────────────────────────┘
                      │
┌─────────────────────▼───────────────────────────────────────────┐
│                   Analysis Engine Layer                         │
├─────────────────────────────────────────────────────────────────┤
│  RAG Pipeline     │  Static Analysis   │  Dynamic Analysis     │
│  • SmartBugs KB   │  • Code Patterns   │  • Tenderly Sim      │
│  • Vector Store   │  • Vulnerability   │  • Gas Estimation    │
│  • LLM Integration│    Detection       │  • State Changes     │
│  • Context Search │  • Best Practices  │  • Risk Assessment   │
└─────────────────────┬───────────────────────────────────────────┘
                      │
┌─────────────────────▼───────────────────────────────────────────┐
│                     Data Layer                                  │
├─────────────────────────────────────────────────────────────────┤
│  PostgreSQL       │  ChromaDB          │  Redis Cache          │
│  • Contract Data  │  • Vector Embeddings│  • Analysis Results  │
│  • Analysis Logs  │  • Vulnerability KB │  • Gas Price Data    │
│  • User Settings  │  • Code Snippets    │  • Session Data      │
└─────────────────────────────────────────────────────────────────┘
```

## Component Architecture

### 1. Browser Extension

#### Content Script (`content/content.js`)
- **Web3 Interception**: Monitors `window.ethereum` and Web3 provider calls
- **Transaction Detection**: Captures transaction requests before execution
- **Risk Assessment Display**: Shows real-time security warnings
- **dApp Integration**: Seamless integration with decentralized applications
- **Event Handling**: Manages Web3 events and user interactions

#### Background Service (`background/background.js`)
- **Service Worker**: Persistent background processing
- **API Communication**: Handles all backend communication
- **State Management**: Manages extension state and user preferences
- **Notification System**: Browser notifications for security alerts
- **Storage Management**: Secure local storage of settings and cache

#### Popup UI (`popup/`)
- **React Framework**: Modern, responsive user interface
- **Transaction Review**: Detailed transaction analysis display
- **Security Dashboard**: Risk scores and vulnerability summaries
- **User Controls**: Approve, modify, or reject transaction options
- **Settings Panel**: Configuration and preference management

### 2. Backend Service Architecture

#### API Server (`main.py`)
- **FastAPI Framework**: High-performance async web framework
- **RESTful Endpoints**: Comprehensive API for all functionality
- **WebSocket Support**: Real-time communication capabilities
- **Auto Documentation**: Swagger/OpenAPI documentation
- **Middleware Stack**: Security, logging, and request processing
- **Health Monitoring**: System health checks and metrics

#### RAG Pipeline (`rag/rag_pipeline.py`)

The RAG (Retrieval-Augmented Generation) pipeline is the core intelligence system:

##### Knowledge Base Integration
- **SmartBugs Dataset**: 143 real-world vulnerable contracts with 208 labeled vulnerabilities
- **Document Processing**: Automated extraction and structuring of vulnerability data
- **Vector Embeddings**: Semantic search capabilities using HuggingFace embeddings
- **ChromaDB Storage**: Persistent vector database for fast similarity search

##### LLM Integration
- **Google Gemini**: Advanced language model for contract analysis
- **LangChain Framework**: Orchestration of LLM workflows
- **Prompt Engineering**: Specialized prompts for security analysis
- **Response Parsing**: Structured extraction of analysis results

##### Analysis Pipeline
```python
SmartBugs Dataset → Document Processing → Vector Embeddings → 
ChromaDB Storage → Similarity Search → Context Retrieval → 
LLM Analysis → Risk Assessment → User Presentation
```

#### SmartBugs Knowledge Base Processing

##### Dataset Structure
- **vulnerabilities.json**: Master index of all vulnerabilities
- **Contract Files**: Solidity source code files (.sol)
- **Metadata**: Contract names, paths, vulnerability mappings

##### Processing Pipeline
1. **Data Extraction**: Parse vulnerabilities.json for contract metadata
2. **Code Processing**: Load .sol files and extract vulnerable code sections
3. **Context Generation**: Create 5-line context windows around vulnerabilities
4. **Document Creation**: Generate structured markdown documents
5. **Vector Indexing**: Embed documents using sentence transformers
6. **Storage**: Persist in ChromaDB for fast retrieval

##### Document Structure
```markdown
# Smart Contract Vulnerability Analysis
## Contract Information
- Name: {contract_name}
- File: {contract_path}
- Vulnerabilities: {count}

## Vulnerability Details
- Category: {vulnerability_type}
- Severity: {risk_level}
- Lines: {affected_lines}

## Code Analysis
```solidity
{code_snippet_with_context}
```

## Security Implications
{detailed_analysis}

## Recommended Mitigations
{specific_remediation_steps}
```

#### Transaction Simulation (`simulation/tenderly_new.py`)
- **Tenderly Integration**: Professional blockchain simulation platform
- **Fork Networks**: Create isolated blockchain forks for testing
- **Gas Analysis**: Accurate gas estimation and optimization
- **State Simulation**: Preview transaction effects before execution
- **Error Detection**: Identify potential transaction failures

#### Gas Optimization (`optimization/gas_optimizer.py`)
- **Price Prediction**: Dynamic gas price recommendations
- **Optimization Strategies**: Transaction batching and timing
- **Network Analysis**: Multi-chain gas price monitoring
- **Cost Reduction**: Automated optimization suggestions

### 3. Data Layer

#### PostgreSQL Database
- **Schema Design**: Normalized relational data structure
- **Contract Metadata**: Comprehensive contract information storage
- **Analysis History**: Persistent analysis results and logs
- **User Management**: Account data and preferences
- **Audit Trail**: Complete transaction and analysis logging

#### ChromaDB Vector Database
- **Vector Storage**: High-dimensional embeddings for semantic search
- **Collection Management**: Organized knowledge base collections
- **Similarity Search**: Fast retrieval of relevant vulnerability examples
- **Metadata Filtering**: Advanced query capabilities with metadata
- **Persistence**: Durable storage of vector embeddings

#### Redis Cache
- **Performance Optimization**: Fast access to frequently requested data
- **Session Management**: User session and authentication data
- **Rate Limiting**: Request throttling and abuse prevention
- **Real-time Data**: Gas prices and network status caching

## Data Flow Architecture

### 1. Transaction Analysis Flow

```
User Transaction → Content Script → Background Service → 
Backend API → RAG Pipeline → SmartBugs KB → 
Vector Search → Context Retrieval → LLM Analysis → 
Risk Assessment → User Interface → User Decision
```

### 2. SmartBugs Integration Flow

```
SmartBugs Dataset → populate_knowledge_base.py → 
Document Generation → Vector Embedding → ChromaDB Storage → 
RAG Pipeline Integration → Context-Aware Analysis
```

### 3. Real-time Analysis Flow

```
Transaction Request → Static Analysis → Dynamic Simulation → 
RAG Context Search → LLM Processing → Risk Scoring → 
Recommendation Generation → User Presentation
```

## Security Architecture

### 1. Extension Security
- **Content Security Policy**: Strict CSP to prevent XSS attacks
- **Sandboxed Execution**: Isolated script execution environments
- **Permission Model**: Minimal required permissions
- **Secure Communication**: Encrypted communication channels

### 2. Backend Security
- **Authentication**: JWT-based authentication system
- **Authorization**: Role-based access control (RBAC)
- **Input Validation**: Comprehensive input sanitization
- **Rate Limiting**: API abuse prevention
- **HTTPS Enforcement**: TLS encryption for all communications

### 3. Data Security
- **Encryption at Rest**: Database encryption for sensitive data
- **Encryption in Transit**: TLS 1.3 for all network communications
- **Key Management**: Secure API key storage and rotation
- **Privacy Protection**: No storage of private keys or sensitive user data

## Performance Architecture

### 1. Caching Strategy
- **Multi-Level Caching**: Browser, Redis, and application-level caching
- **Cache Invalidation**: Smart cache invalidation strategies
- **CDN Integration**: Content delivery network for static assets
- **Database Query Optimization**: Indexed queries and connection pooling

### 2. Scalability Design
- **Horizontal Scaling**: Microservices architecture for independent scaling
- **Load Balancing**: Request distribution across multiple instances
- **Async Processing**: Non-blocking I/O for improved throughput
- **Resource Optimization**: Efficient memory and CPU utilization

### 3. Monitoring and Observability
- **Health Checks**: Comprehensive system health monitoring
- **Metrics Collection**: Performance and usage metrics
- **Logging**: Structured logging with correlation IDs
- **Error Tracking**: Automated error detection and alerting

## Integration Architecture

### 1. Blockchain Integration
- **Multi-Chain Support**: Ethereum, Polygon, BSC, Arbitrum, Optimism
- **Web3 Providers**: Integration with multiple Web3 providers
- **RPC Optimization**: Efficient blockchain communication
- **Event Monitoring**: Real-time blockchain event processing

### 2. External Service Integration
- **Tenderly**: Transaction simulation and gas analysis
- **Google Gemini**: AI-powered security analysis
- **Etherscan**: Contract verification and metadata
- **CoinGecko**: Token price and market data

## Deployment Architecture

### 1. Development Environment
- **Local Development**: Docker Compose for full stack development
- **Hot Reloading**: Fast development iteration cycles
- **Testing Framework**: Comprehensive unit and integration testing
- **Code Quality**: Linting, formatting, and static analysis

### 2. Production Environment
- **Container Orchestration**: Kubernetes deployment
- **CI/CD Pipeline**: Automated testing and deployment
- **Environment Management**: Configuration management
- **Disaster Recovery**: Backup and recovery procedures

## Future Architecture Enhancements

### 1. Advanced AI Integration
- **Custom Model Training**: Domain-specific vulnerability detection models
- **Federated Learning**: Decentralized model improvement
- **Real-time Learning**: Dynamic vulnerability pattern detection
- **Explainable AI**: Transparent analysis reasoning

### 2. Decentralized Features
- **IPFS Integration**: Decentralized storage for analysis results
- **Blockchain Analytics**: On-chain analysis capabilities
- **DAO Governance**: Community-driven platform governance
- **Token Economics**: Platform token for premium features

### 3. Enterprise Features
- **Multi-tenant Architecture**: Enterprise customer isolation
- **Custom Compliance**: Regulatory compliance frameworks
- **Advanced Analytics**: Business intelligence and reporting
- **White-label Solutions**: Customizable platform branding

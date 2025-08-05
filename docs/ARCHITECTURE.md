# 🏗️ Web3 Guardian Architecture

**Version**: 2.1.0  
**Last Updated**: August 5, 2025

## 🌟 Executive Summary

Web3 Guardian is a production-grade, AI-powered Web3 security platform that combines advanced vulnerability detection, real-time smart contract analysis, and comprehensive transaction protection. Built with modern microservices architecture, the system leverages Google Gemini AI, SmartBugs vulnerability dataset, and Tenderly blockchain simulation to provide institutional-level security for Web3 applications.

### Core Principles

- **Security First**: Every component designed with security as the primary concern
- **Scalability**: Horizontal scaling to handle enterprise-level traffic
- **Reliability**: 99.9% uptime SLA with robust error handling
- **Performance**: Sub-100ms response times with intelligent caching
- **Extensibility**: Plugin architecture for custom security modules

## 🎯 System Overview

### High-Level Architecture

```mermaid
graph TB
    subgraph "Client Layer"
        WEB[Web3 dApps]
        EXT[Browser Extension]
        API_CLIENT[API Clients]
    end
    
    subgraph "API Gateway"
        NGINX[Nginx Load Balancer]
        RATE[Rate Limiter]
        AUTH[Authentication]
    end
    
    subgraph "Application Services"
        FASTAPI[FastAPI Backend]
        WORKER[Background Workers]
        SCHEDULER[Task Scheduler]
    end
    
    subgraph "AI & Analysis Engine"
        RAG[RAG Pipeline]
        GEMINI[Google Gemini]
        VECTORDB[ChromaDB Vector Store]
        SMARTBUGS[SmartBugs KB]
    end
    
    subgraph "External Services"
        TENDERLY[Tenderly API]
        ETHERSCAN[Etherscan API]
        BLOCKCHAIN[Blockchain RPCs]
    end
    
    subgraph "Data Layer"
        POSTGRES[(PostgreSQL)]
        REDIS[(Redis Cache)]
        S3[(Object Storage)]
    end
    
    subgraph "Infrastructure"
        DOCKER[Docker Containers]
        K8S[Kubernetes]
        MONITORING[Monitoring Stack]
    end
    
    WEB --> NGINX
    EXT --> NGINX  
    API_CLIENT --> NGINX
    NGINX --> RATE
    RATE --> AUTH
    AUTH --> FASTAPI
    
    FASTAPI --> RAG
    FASTAPI --> WORKER
    FASTAPI --> POSTGRES
    FASTAPI --> REDIS
    
    RAG --> GEMINI
    RAG --> VECTORDB
    VECTORDB --> SMARTBUGS
    
    WORKER --> TENDERLY
    WORKER --> ETHERSCAN
    WORKER --> BLOCKCHAIN
    
    FASTAPI --> S3
    DOCKER --> K8S
    K8S --> MONITORING
```

## 🧠 AI-Powered Security Engine

### RAG (Retrieval-Augmented Generation) Pipeline

The heart of Web3 Guardian's security analysis is our sophisticated RAG pipeline that combines real-world vulnerability data with advanced AI reasoning.

```mermaid
graph LR
    subgraph "Knowledge Base"
        SB[SmartBugs Dataset<br/>143 Contracts<br/>208 Vulnerabilities]
        CVE[CVE Database<br/>Daily Updates]
        BLOG[Security Blogs<br/>Expert Analysis]
        CUSTOM[Custom Patterns<br/>Enterprise Rules]
    end
    
    subgraph "Processing Pipeline"
        INGEST[Document Ingestion]
        SPLIT[Text Splitting]
        EMBED[Embedding Generation]
        INDEX[Vector Indexing]
    end
    
    subgraph "Analysis Engine"
        QUERY[Query Processing]
        RETRIEVE[Context Retrieval]
        RANK[Relevance Ranking]
        LLM[Gemini Analysis]
        VALIDATE[Result Validation]
    end
    
    SB --> INGEST
    CVE --> INGEST
    BLOG --> INGEST
    CUSTOM --> INGEST
    
    INGEST --> SPLIT
    SPLIT --> EMBED
    EMBED --> INDEX
    
    INDEX --> RETRIEVE
    QUERY --> RETRIEVE
    RETRIEVE --> RANK
    RANK --> LLM
    LLM --> VALIDATE
```

#### Knowledge Base Components

| Component | Size | Purpose | Update Frequency |
|-----------|------|---------|------------------|
| **SmartBugs Dataset** | 143 contracts, 208 vulns | Real-world vulnerability patterns | Static |
| **CVE Database** | 2000+ entries | Latest security advisories | Daily |
| **Security Blogs** | 500+ articles | Expert analysis and insights | Weekly |
| **Custom Patterns** | 50+ rules | Enterprise-specific patterns | On-demand |

#### Vector Store Architecture

```python
# ChromaDB Configuration
vector_store = {
    "embedding_model": "text-embedding-3-large",
    "dimensions": 3072,
    "distance_metric": "cosine",
    "index_type": "HNSW",
    "ef_construction": 200,
    "ef_search": 100,
    "max_connections": 32
}
```

### AI Model Integration

#### Google Gemini Configuration

```python
gemini_config = {
    "model": "gemini-1.5-pro",
    "temperature": 0.1,  # Low temperature for consistent security analysis
    "max_tokens": 8192,
    "top_p": 0.8,
    "safety_settings": {
        "harassment": "BLOCK_NONE",
        "hate_speech": "BLOCK_NONE", 
        "sexually_explicit": "BLOCK_NONE",
        "dangerous_content": "BLOCK_NONE"
    }
}
```

#### Prompt Engineering

Our security analysis prompts are carefully crafted for optimal vulnerability detection:

```python
SECURITY_ANALYSIS_PROMPT = """
You are an expert smart contract security auditor with access to real-world vulnerability data.

Context: {context}
Contract Code: {contract_code}

Analyze this smart contract for security vulnerabilities with the following focus:
1. Compare against known vulnerability patterns from the provided context
2. Identify potential reentrancy, access control, and arithmetic issues
3. Check for logic errors and state inconsistencies
4. Assess gas optimization opportunities
5. Provide specific line-by-line recommendations

Output Format:
- Vulnerability Title
- Severity (Critical/High/Medium/Low)
- Description with code references
- Specific remediation steps
- Confidence score (0.0-1.0)
"""
```

## 🔄 Data Flow Architecture

### Request Processing Pipeline

```mermaid
sequenceDiagram
    participant Client
    participant API Gateway
    participant FastAPI
    participant RAG Pipeline
    participant Gemini
    participant Database
    participant Cache
    
    Client->>API Gateway: Contract Analysis Request
    API Gateway->>API Gateway: Rate Limiting & Auth
    API Gateway->>FastAPI: Forward Request
    
    FastAPI->>Cache: Check Cache
    alt Cache Hit
        Cache-->>FastAPI: Return Cached Result
        FastAPI-->>Client: Analysis Result
    else Cache Miss
        FastAPI->>Database: Store Analysis Request
        FastAPI->>RAG Pipeline: Initiate Analysis
        FastAPI-->>Client: Analysis ID (Async)
        
        RAG Pipeline->>RAG Pipeline: Retrieve Contract Code
        RAG Pipeline->>RAG Pipeline: Query Vector Store
        RAG Pipeline->>Gemini: AI Analysis
        Gemini-->>RAG Pipeline: Security Assessment
        RAG Pipeline->>Database: Store Results
        RAG Pipeline->>Cache: Cache Results
        
        Client->>FastAPI: Poll for Results
        FastAPI->>Database: Get Analysis Status
        FastAPI-->>Client: Complete Analysis
    end
```

### Background Processing

```python
# Celery Task Configuration
celery_config = {
    "broker_url": "redis://redis:6379/1",
    "result_backend": "redis://redis:6379/2",
    "task_serializer": "json",
    "accept_content": ["json"],
    "result_serializer": "json",
    "timezone": "UTC",
    "enable_utc": True,
    "worker_concurrency": 4,
    "task_routes": {
        "analyze_contract": {"queue": "analysis"},
        "update_knowledge_base": {"queue": "maintenance"},
        "simulate_transaction": {"queue": "simulation"}
    }
}
```

## 🏢 Microservices Architecture

### Service Decomposition

| Service | Responsibility | Technology | Scaling Strategy |
|---------|---------------|------------|------------------|
| **API Gateway** | Request routing, auth, rate limiting | Nginx | Horizontal |
| **Analysis Service** | Contract security analysis | FastAPI + Python | Horizontal |
| **RAG Service** | AI-powered vulnerability detection | LangChain + Gemini | Vertical |
| **Simulation Service** | Transaction simulation | Tenderly Integration | Horizontal |
| **Knowledge Service** | Vulnerability database management | FastAPI + PostgreSQL | Vertical |
| **Cache Service** | High-speed data caching | Redis Cluster | Horizontal |
| **Monitoring Service** | System health and metrics | Prometheus + Grafana | Horizontal |

### Inter-Service Communication

```python
# Service Discovery Configuration
services = {
    "analysis": {
        "host": "analysis-service",
        "port": 8001,
        "health_check": "/health",
        "timeout": 30
    },
    "rag": {
        "host": "rag-service", 
        "port": 8002,
        "health_check": "/health",
        "timeout": 60
    },
    "simulation": {
        "host": "simulation-service",
        "port": 8003,
        "health_check": "/health",
        "timeout": 45
    }
}
```

## 📊 Data Architecture

### Database Design

#### PostgreSQL Schema

```sql
-- Core analysis tables
CREATE TABLE contract_analyses (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    contract_address VARCHAR(42) NOT NULL,
    network VARCHAR(50) NOT NULL,
    analysis_type VARCHAR(20) NOT NULL,
    status VARCHAR(20) DEFAULT 'pending',
    created_at TIMESTAMP DEFAULT NOW(),
    completed_at TIMESTAMP,
    security_score DECIMAL(3,1),
    metadata JSONB
);

CREATE INDEX idx_contract_analyses_address ON contract_analyses(contract_address);
CREATE INDEX idx_contract_analyses_status ON contract_analyses(status);
CREATE INDEX idx_contract_analyses_created ON contract_analyses(created_at);

-- Vulnerability findings
CREATE TABLE vulnerabilities (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    analysis_id UUID REFERENCES contract_analyses(id),
    title VARCHAR(255) NOT NULL,
    severity VARCHAR(10) NOT NULL,
    category VARCHAR(50) NOT NULL,
    description TEXT,
    location_start INTEGER,
    location_end INTEGER,
    confidence DECIMAL(3,2),
    cwe_id VARCHAR(10),
    recommendation TEXT,
    created_at TIMESTAMP DEFAULT NOW()
);

-- Knowledge base documents
CREATE TABLE knowledge_documents (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    title VARCHAR(255) NOT NULL,
    content TEXT NOT NULL,
    document_type VARCHAR(50) NOT NULL,
    source VARCHAR(100),
    vector_id VARCHAR(255),
    created_at TIMESTAMP DEFAULT NOW(),
    updated_at TIMESTAMP DEFAULT NOW()
);
```

#### Redis Cache Strategy

```python
cache_strategies = {
    "contract_metadata": {
        "key_pattern": "contract:{network}:{address}",
        "ttl": 3600,  # 1 hour
        "invalidation": "manual"
    },
    "analysis_results": {
        "key_pattern": "analysis:{analysis_id}",
        "ttl": 86400,  # 24 hours
        "invalidation": "time_based"
    },
    "vulnerability_patterns": {
        "key_pattern": "patterns:{category}",
        "ttl": 7200,  # 2 hours
        "invalidation": "version_based"
    }
}
```

### Data Processing Pipeline

```mermaid
graph TD
    subgraph "Data Ingestion"
        API[API Requests]
        BATCH[Batch Processing]
        STREAM[Stream Processing]
    end
    
    subgraph "Data Validation"
        VALIDATE[Input Validation]
        SANITIZE[Data Sanitization]
        TRANSFORM[Data Transformation]
    end
    
    subgraph "Data Storage"
        HOT[Hot Storage - Redis]
        WARM[Warm Storage - PostgreSQL]
        COLD[Cold Storage - S3]
    end
    
    subgraph "Data Processing"
        ETL[ETL Pipeline]
        ANALYTICS[Analytics Engine]
        ML[ML Pipeline]
    end
    
    API --> VALIDATE
    BATCH --> VALIDATE
    STREAM --> VALIDATE
    
    VALIDATE --> SANITIZE
    SANITIZE --> TRANSFORM
    
    TRANSFORM --> HOT
    TRANSFORM --> WARM
    TRANSFORM --> COLD
    
    WARM --> ETL
    ETL --> ANALYTICS
    ANALYTICS --> ML
```

## 🔒 Security Architecture

### Defense in Depth

```mermaid
graph TB
    subgraph "Perimeter Security"
        WAF[Web Application Firewall]
        DDoS[DDoS Protection]
        GEO[Geo-blocking]
    end
    
    subgraph "Network Security"
        VPC[Virtual Private Cloud]
        SG[Security Groups]
        NACL[Network ACLs]
    end
    
    subgraph "Application Security"
        TLS[TLS 1.3 Encryption]
        AUTH[Multi-factor Authentication]
        RBAC[Role-based Access Control]
    end
    
    subgraph "Data Security"
        ENCRYPT[Encryption at Rest]
        BACKUP[Encrypted Backups]
        AUDIT[Audit Logging]
    end
    
    WAF --> VPC
    DDoS --> VPC
    GEO --> VPC
    
    VPC --> TLS
    SG --> AUTH
    NACL --> RBAC
    
    TLS --> ENCRYPT
    AUTH --> BACKUP
    RBAC --> AUDIT
```

### Security Controls

| Layer | Control | Implementation | Monitoring |
|-------|---------|----------------|------------|
| **Network** | Firewall Rules | AWS Security Groups | CloudWatch |
| **Application** | Input Validation | FastAPI validators | Custom logs |
| **Authentication** | API Key Management | JWT + Redis | Auth logs |
| **Authorization** | Role-based Access | Custom middleware | Access logs |
| **Data** | Encryption at Rest | PostgreSQL encryption | Audit trails |
| **Communication** | TLS Encryption | Nginx SSL termination | SSL monitoring |

## 🚀 Deployment Architecture

### Container Strategy

```yaml
# Docker Composition
version: '3.8'

services:
  nginx:
    image: nginx:alpine
    ports:
      - "80:80"
      - "443:443"
    volumes:
      - ./nginx.conf:/etc/nginx/nginx.conf
      - ./ssl:/etc/nginx/ssl
    
  backend:
    image: web3guardian/backend:2.1.0
    replicas: 3
    environment:
      - DATABASE_URL=postgresql://user:pass@postgres:5432/db
      - REDIS_URL=redis://redis:6379/0
    depends_on:
      - postgres
      - redis
      
  postgres:
    image: postgres:14
    environment:
      - POSTGRES_DB=web3guardian
      - POSTGRES_USER=web3guardian
      - POSTGRES_PASSWORD=secure_password
    volumes:
      - postgres_data:/var/lib/postgresql/data
      
  redis:
    image: redis:7-alpine
    command: redis-server --appendonly yes
    volumes:
      - redis_data:/data
```

### Kubernetes Production Setup

```yaml
apiVersion: apps/v1
kind: Deployment
metadata:
  name: web3guardian-backend
spec:
  replicas: 5
  selector:
    matchLabels:
      app: web3guardian-backend
  template:
    metadata:
      labels:
        app: web3guardian-backend
    spec:
      containers:
      - name: backend
        image: web3guardian/backend:2.1.0
        ports:
        - containerPort: 8000
        resources:
          requests:
            memory: "1Gi"
            cpu: "500m"
          limits:
            memory: "4Gi"
            cpu: "2000m"
        env:
        - name: DATABASE_URL
          valueFrom:
            secretKeyRef:
              name: web3guardian-secrets
              key: database-url
        livenessProbe:
          httpGet:
            path: /health
            port: 8000
          initialDelaySeconds: 30
          periodSeconds: 10
        readinessProbe:
          httpGet:
            path: /ready
            port: 8000
          initialDelaySeconds: 5
          periodSeconds: 5
```

## 📈 Scalability & Performance

### Horizontal Scaling Strategy

```python
scaling_config = {
    "api_servers": {
        "min_replicas": 3,
        "max_replicas": 20,
        "target_cpu": 70,
        "target_memory": 80,
        "scale_up_cooldown": 300,
        "scale_down_cooldown": 600
    },
    "background_workers": {
        "min_replicas": 2,
        "max_replicas": 10,
        "queue_length_threshold": 100,
        "processing_time_threshold": 300
    }
}
```

### Performance Optimization

#### Database Optimization

```sql
-- Performance indexes
CREATE INDEX CONCURRENTLY idx_analyses_compound 
ON contract_analyses(status, created_at DESC) 
WHERE status IN ('pending', 'processing');

-- Connection pooling
ALTER SYSTEM SET max_connections = 200;
ALTER SYSTEM SET shared_buffers = '256MB';
ALTER SYSTEM SET effective_cache_size = '1GB';
ALTER SYSTEM SET work_mem = '4MB';
```

#### Caching Strategy

```python
cache_tiers = {
    "L1": {
        "type": "in_memory",
        "size": "100MB",
        "ttl": 300,
        "use_case": "hot_data"
    },
    "L2": {
        "type": "redis",
        "size": "1GB", 
        "ttl": 3600,
        "use_case": "warm_data"
    },
    "L3": {
        "type": "cdn",
        "size": "10GB",
        "ttl": 86400,
        "use_case": "static_data"
    }
}
```

## 🔍 Monitoring & Observability

### Monitoring Stack

```yaml
# Prometheus Configuration
global:
  scrape_interval: 15s
  evaluation_interval: 15s

rule_files:
  - "alert_rules.yml"

scrape_configs:
  - job_name: 'web3guardian-backend'
    static_configs:
      - targets: ['backend:8000']
    metrics_path: '/metrics'
    scrape_interval: 5s
    
  - job_name: 'postgres-exporter'
    static_configs:
      - targets: ['postgres-exporter:9187']
      
  - job_name: 'redis-exporter'
    static_configs:
      - targets: ['redis-exporter:9121']
```

### Key Metrics

| Category | Metric | Alert Threshold | Dashboard |
|----------|--------|----------------|-----------|
| **Performance** | Response Time | >100ms | API Performance |
| **Availability** | Uptime | <99.9% | System Health |
| **Security** | Vulnerabilities Found/Hour | >50 | Security Dashboard |
| **Usage** | API Requests/Second | >1000 | Traffic Analytics |
| **Errors** | Error Rate | >0.1% | Error Tracking |
| **Resources** | CPU Usage | >80% | Infrastructure |

## 🔄 Disaster Recovery

### Backup Strategy

```bash
#!/bin/bash
# Automated backup script

# Database backup
pg_dump -h postgres -U web3guardian web3guardian_prod | \
  gzip > /backup/db-$(date +%Y%m%d-%H%M%S).sql.gz

# Knowledge base backup
tar -czf /backup/kb-$(date +%Y%m%d-%H%M%S).tar.gz \
  /data/knowledge_base/

# Redis backup
redis-cli --rdb /backup/redis-$(date +%Y%m%d-%H%M%S).rdb

# Upload to S3
aws s3 sync /backup/ s3://web3guardian-backups/ \
  --delete --storage-class STANDARD_IA
```

### Recovery Procedures

1. **Database Recovery**: Point-in-time recovery from automated backups
2. **Service Recovery**: Rolling deployment with health checks
3. **Data Recovery**: Multi-region replication with automatic failover
4. **Knowledge Base Recovery**: Version-controlled knowledge base with Git

## 📋 Future Architecture Considerations

### Planned Enhancements

#### Q2 2025
- **Event-Driven Architecture**: Apache Kafka for real-time processing
- **Machine Learning Pipeline**: Custom ML models for vulnerability detection
- **Multi-Region Deployment**: Global load balancing and data replication

#### Q3 2025
- **Microservices Mesh**: Service mesh with Istio for advanced traffic management
- **Serverless Components**: AWS Lambda for burst workloads
- **Advanced Analytics**: Real-time analytics with Apache Flink

#### Q4 2025
- **Blockchain Integration**: Direct blockchain node integration
- **Edge Computing**: Edge nodes for reduced latency
- **AI Model Optimization**: Custom-trained security models

---

*Architecture Document Version 2.1.0 | Last Updated: August 5, 2025*

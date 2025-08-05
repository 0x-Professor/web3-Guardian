# 🚀 Web3 Guardian Deployment Guide

**Version**: 2.1.0  
**Last Updated**: August 5, 2025

## 🌟 Overview

This guide provides comprehensive instructions for deploying Web3 Guardian in production environments. Our deployment strategy supports multiple deployment models from single-server setups to enterprise-grade Kubernetes clusters.

### Deployment Options

| Option | Use Case | Complexity | Scalability | Cost |
|--------|----------|------------|-------------|------|
| **Docker Compose** | Small-medium production | Low | Medium | Low |
| **Kubernetes** | Enterprise production | High | High | Medium |
| **Cloud Managed** | Hands-off production | Medium | High | High |
| **Hybrid** | Custom requirements | High | Very High | Variable |

## 🎯 Prerequisites

### System Requirements

#### Minimum Production Requirements
- **CPU**: 4 cores (8 recommended)
- **Memory**: 8GB RAM (16GB recommended)  
- **Storage**: 100GB SSD (500GB recommended)
- **Network**: 1 Gbps connection
- **OS**: Ubuntu 20.04+ / RHEL 8+ / CentOS 8+

#### Recommended Production Requirements
- **CPU**: 8+ cores with hyper-threading
- **Memory**: 32GB+ RAM
- **Storage**: 1TB+ NVMe SSD with backup
- **Network**: 10 Gbps connection with redundancy
- **OS**: Ubuntu 22.04 LTS

### Software Dependencies

#### Required Software
```bash
# System packages
sudo apt update && sudo apt install -y \
    curl wget git unzip \
    build-essential \
    python3.13 python3.13-venv python3.13-dev \
    nodejs npm \
    postgresql-client \
    redis-tools \
    nginx \
    certbot python3-certbot-nginx

# Docker & Docker Compose
curl -fsSL https://get.docker.com -o get-docker.sh
sudo sh get-docker.sh
sudo curl -L "https://github.com/docker/compose/releases/latest/download/docker-compose-$(uname -s)-$(uname -m)" -o /usr/local/bin/docker-compose
sudo chmod +x /usr/local/bin/docker-compose

# Kubernetes (optional)
curl -s https://packages.cloud.google.com/apt/doc/apt-key.gpg | sudo apt-key add -
echo "deb https://apt.kubernetes.io/ kubernetes-xenial main" | sudo tee -a /etc/apt/sources.list.d/kubernetes.list
sudo apt update && sudo apt install -y kubectl
```

#### API Keys Required
- **Google Gemini API Key**: [Get from Google AI Studio](https://makersuite.google.com/app/apikey)
- **Etherscan API Key**: [Get from Etherscan](https://etherscan.io/apis)
- **Tenderly API Keys**: [Get from Tenderly Dashboard](https://dashboard.tenderly.co/)

## 🐳 Docker Compose Deployment

### Production Docker Compose Setup

#### 1. Environment Setup

```bash
# Create production directory
sudo mkdir -p /opt/web3guardian
cd /opt/web3guardian

# Clone repository
git clone https://github.com/web3guardian/web3-guardian.git .

# Create production environment file
cat > .env.prod << 'EOF'
# Production Configuration
DEBUG=false
ENVIRONMENT=production
LOG_LEVEL=INFO
SECRET_KEY=your-super-secure-production-key-min-32-characters

# Database Configuration
DATABASE_URL=postgresql://web3guardian:your-secure-db-password@postgres:5432/web3guardian_prod
POSTGRES_DB=web3guardian_prod
POSTGRES_USER=web3guardian  
POSTGRES_PASSWORD=your-secure-db-password

# Redis Configuration
REDIS_URL=redis://redis:6379/0

# Required API Keys
GOOGLE_API_KEY=your-production-gemini-api-key
ETHERSCAN_API_KEY=your-production-etherscan-api-key
TENDERLY_API_KEY=your-production-tenderly-api-key
TENDERLY_ACCOUNT_SLUG=your-tenderly-account
TENDERLY_PROJECT_SLUG=your-tenderly-project

# Security Settings
ALLOWED_ORIGINS=["https://yourdomain.com", "https://api.yourdomain.com", "chrome-extension://*"]
CORS_ALLOW_CREDENTIALS=true
API_RATE_LIMIT=1000

# Performance Settings
REDIS_CACHE_TTL=3600
MAX_WORKERS=4
CONNECTION_POOL_SIZE=20
WORKER_CONNECTIONS=1000

# Monitoring
SENTRY_DSN=https://your-sentry-dsn@sentry.io/project-id
PROMETHEUS_ENABLED=true
HEALTH_CHECK_INTERVAL=30

# Domain Configuration
DOMAIN=yourdomain.com
API_DOMAIN=api.yourdomain.com
EOF

# Secure the environment file
chmod 600 .env.prod
```

#### 2. Production Docker Compose

```yaml
# docker-compose.prod.yml
version: '3.8'

services:
  nginx:
    image: nginx:alpine
    container_name: web3guardian-nginx
    ports:
      - "80:80"
      - "443:443"
    volumes:
      - ./nginx/nginx.conf:/etc/nginx/nginx.conf:ro
      - ./nginx/ssl:/etc/nginx/ssl:ro
      - ./nginx/logs:/var/log/nginx
    depends_on:
      - backend
    restart: unless-stopped
    networks:
      - web3guardian-network

  backend:
    image: web3guardian/backend:2.1.0
    container_name: web3guardian-backend
    deploy:
      replicas: 3
      resources:
        limits:
          memory: 2G
          cpus: '2.0'
        reservations:
          memory: 1G
          cpus: '1.0'
    environment:
      - DEBUG=false
      - ENVIRONMENT=production
    env_file:
      - .env.prod
    volumes:
      - ./data:/app/data
      - ./logs:/app/logs
    depends_on:
      - postgres
      - redis
    restart: unless-stopped
    networks:
      - web3guardian-network
    healthcheck:
      test: ["CMD", "curl", "-f", "http://localhost:8000/health"]
      interval: 30s
      timeout: 10s
      retries: 3
      start_period: 40s

  postgres:
    image: postgres:14
    container_name: web3guardian-postgres
    environment:
      - POSTGRES_DB=web3guardian_prod
      - POSTGRES_USER=web3guardian
      - POSTGRES_PASSWORD=${POSTGRES_PASSWORD}
      - POSTGRES_INITDB_ARGS=--encoding=UTF-8 --lc-collate=C --lc-ctype=C
    volumes:
      - postgres_data:/var/lib/postgresql/data
      - ./postgres/init:/docker-entrypoint-initdb.d:ro
      - ./postgres/backup:/backup
    ports:
      - "127.0.0.1:5432:5432"  # Only accessible locally
    restart: unless-stopped
    networks:
      - web3guardian-network
    command: >
      postgres
        -c max_connections=200
        -c shared_buffers=256MB
        -c effective_cache_size=1GB
        -c maintenance_work_mem=64MB
        -c checkpoint_completion_target=0.9
        -c wal_buffers=16MB
        -c default_statistics_target=100
        -c random_page_cost=1.1
        -c effective_io_concurrency=200

  redis:
    image: redis:7-alpine
    container_name: web3guardian-redis
    command: >
      redis-server
        --appendonly yes
        --maxmemory 512mb
        --maxmemory-policy allkeys-lru
        --save 900 1
        --save 300 10
        --save 60 10000
    volumes:
      - redis_data:/data
    ports:
      - "127.0.0.1:6379:6379"  # Only accessible locally
    restart: unless-stopped
    networks:
      - web3guardian-network
    healthcheck:
      test: ["CMD", "redis-cli", "ping"]
      interval: 30s
      timeout: 10s
      retries: 3

  # Background workers for analysis
  worker:
    image: web3guardian/backend:2.1.0
    container_name: web3guardian-worker
    command: celery -A main.celery worker --loglevel=info --concurrency=4
    env_file:
      - .env.prod
    volumes:
      - ./data:/app/data
      - ./logs:/app/logs
    depends_on:
      - postgres
      - redis
    restart: unless-stopped
    networks:
      - web3guardian-network
    deploy:
      replicas: 2
      resources:
        limits:
          memory: 1G
          cpus: '1.0'

  # Monitoring stack
  prometheus:
    image: prom/prometheus:latest
    container_name: web3guardian-prometheus
    ports:
      - "127.0.0.1:9090:9090"
    volumes:
      - ./monitoring/prometheus.yml:/etc/prometheus/prometheus.yml:ro
      - ./monitoring/alert_rules.yml:/etc/prometheus/alert_rules.yml:ro
      - prometheus_data:/prometheus
    command:
      - '--config.file=/etc/prometheus/prometheus.yml'
      - '--storage.tsdb.path=/prometheus'
      - '--web.console.libraries=/etc/prometheus/console_libraries'
      - '--web.console.templates=/etc/prometheus/consoles'
      - '--web.enable-lifecycle'
    restart: unless-stopped
    networks:
      - web3guardian-network

  grafana:
    image: grafana/grafana:latest
    container_name: web3guardian-grafana
    ports:
      - "127.0.0.1:3000:3000"
    volumes:
      - grafana_data:/var/lib/grafana
      - ./monitoring/dashboards:/etc/grafana/provisioning/dashboards:ro
      - ./monitoring/datasources:/etc/grafana/provisioning/datasources:ro
    environment:
      - GF_SECURITY_ADMIN_PASSWORD=your-secure-grafana-password
      - GF_USERS_ALLOW_SIGN_UP=false
    restart: unless-stopped
    networks:
      - web3guardian-network

volumes:
  postgres_data:
    driver: local
  redis_data:
    driver: local
  prometheus_data:
    driver: local
  grafana_data:
    driver: local

networks:
  web3guardian-network:
    driver: bridge
    ipam:
      config:
        - subnet: 172.20.0.0/16
```

#### 3. Nginx Configuration

```nginx
# nginx/nginx.conf
worker_processes auto;
error_log /var/log/nginx/error.log warn;
pid /var/run/nginx.pid;

events {
    worker_connections 1024;
    use epoll;
    multi_accept on;
}

http {
    include /etc/nginx/mime.types;
    default_type application/octet-stream;
    
    # Logging
    log_format main '$remote_addr - $remote_user [$time_local] "$request" '
                    '$status $body_bytes_sent "$http_referer" '
                    '"$http_user_agent" "$http_x_forwarded_for" '
                    'rt=$request_time uct="$upstream_connect_time" '
                    'uht="$upstream_header_time" urt="$upstream_response_time"';
    
    access_log /var/log/nginx/access.log main;
    
    # Performance
    sendfile on;
    tcp_nopush on;
    tcp_nodelay on;
    keepalive_timeout 65;
    types_hash_max_size 2048;
    client_max_body_size 50M;
    
    # Security headers
    add_header X-Content-Type-Options nosniff;
    add_header X-Frame-Options DENY;
    add_header X-XSS-Protection "1; mode=block";
    add_header Referrer-Policy strict-origin-when-cross-origin;
    add_header Content-Security-Policy "default-src 'self'; script-src 'self' 'unsafe-inline'; style-src 'self' 'unsafe-inline';";
    
    # Rate limiting
    limit_req_zone $binary_remote_addr zone=api:10m rate=10r/s;
    limit_req_zone $binary_remote_addr zone=general:10m rate=50r/s;
    
    # Upstream backend
    upstream backend {
        least_conn;
        server backend:8000 max_fails=3 fail_timeout=30s;
        keepalive 32;
    }
    
    # HTTP to HTTPS redirect
    server {
        listen 80;
        server_name yourdomain.com api.yourdomain.com;
        return 301 https://$server_name$request_uri;
    }
    
    # Main API server
    server {
        listen 443 ssl http2;
        server_name api.yourdomain.com;
        
        # SSL configuration
        ssl_certificate /etc/nginx/ssl/fullchain.pem;
        ssl_certificate_key /etc/nginx/ssl/privkey.pem;
        ssl_protocols TLSv1.2 TLSv1.3;
        ssl_ciphers ECDHE-RSA-AES256-GCM-SHA512:DHE-RSA-AES256-GCM-SHA512:ECDHE-RSA-AES256-GCM-SHA384:DHE-RSA-AES256-GCM-SHA384;
        ssl_prefer_server_ciphers off;
        ssl_session_cache shared:SSL:10m;
        ssl_session_timeout 10m;
        
        # Security headers
        add_header Strict-Transport-Security "max-age=31536000; includeSubDomains" always;
        
        # API endpoints
        location /api/ {
            limit_req zone=api burst=20 nodelay;
            
            proxy_pass http://backend;
            proxy_set_header Host $host;
            proxy_set_header X-Real-IP $remote_addr;
            proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
            proxy_set_header X-Forwarded-Proto $scheme;
            
            # Timeouts
            proxy_connect_timeout 30s;
            proxy_send_timeout 30s;
            proxy_read_timeout 300s;  # Long timeout for analysis
            
            # WebSocket support
            proxy_http_version 1.1;
            proxy_set_header Upgrade $http_upgrade;
            proxy_set_header Connection "upgrade";
        }
        
        # Health check
        location /health {
            proxy_pass http://backend;
            access_log off;
        }
        
        # Metrics (restrict access)
        location /metrics {
            allow 127.0.0.1;
            allow 172.20.0.0/16;  # Docker network
            deny all;
            proxy_pass http://backend;
        }
    }
    
    # Main website
    server {
        listen 443 ssl http2;
        server_name yourdomain.com;
        
        # SSL configuration (same as above)
        ssl_certificate /etc/nginx/ssl/fullchain.pem;
        ssl_certificate_key /etc/nginx/ssl/privkey.pem;
        ssl_protocols TLSv1.2 TLSv1.3;
        ssl_ciphers ECDHE-RSA-AES256-GCM-SHA512:DHE-RSA-AES256-GCM-SHA512:ECDHE-RSA-AES256-GCM-SHA384:DHE-RSA-AES256-GCM-SHA384;
        ssl_prefer_server_ciphers off;
        ssl_session_cache shared:SSL:10m;
        
        add_header Strict-Transport-Security "max-age=31536000; includeSubDomains" always;
        
        root /var/www/html;
        index index.html;
        
        location / {
            try_files $uri $uri/ =404;
        }
    }
}
```

#### 4. SSL Certificate Setup

```bash
# Install Certbot and get SSL certificates
sudo apt install certbot python3-certbot-nginx

# Stop nginx temporarily
sudo docker-compose -f docker-compose.prod.yml stop nginx

# Get certificates
sudo certbot certonly --standalone \
    --email admin@yourdomain.com \
    --agree-tos \
    --no-eff-email \
    -d yourdomain.com \
    -d api.yourdomain.com

# Copy certificates to nginx directory
sudo mkdir -p /opt/web3guardian/nginx/ssl
sudo cp /etc/letsencrypt/live/yourdomain.com/fullchain.pem /opt/web3guardian/nginx/ssl/
sudo cp /etc/letsencrypt/live/yourdomain.com/privkey.pem /opt/web3guardian/nginx/ssl/
sudo chown -R 1000:1000 /opt/web3guardian/nginx/ssl/

# Set up automatic renewal
echo "0 12 * * * /usr/bin/certbot renew --quiet && docker-compose -f /opt/web3guardian/docker-compose.prod.yml restart nginx" | sudo crontab -
```

#### 5. Deploy Application

```bash
# Build and start services
docker-compose -f docker-compose.prod.yml --env-file .env.prod up -d

# Wait for services to start
sleep 30

# Initialize database
docker-compose -f docker-compose.prod.yml exec backend python scripts/init_db.py --environment production

# Populate knowledge base
docker-compose -f docker-compose.prod.yml exec backend python scripts/populate_knowledge_base.py

# Verify deployment
curl -k https://api.yourdomain.com/health

# Check logs
docker-compose -f docker-compose.prod.yml logs -f backend
```

## ☸️ Kubernetes Deployment

### Production Kubernetes Setup

#### 1. Namespace and ConfigMap

```yaml
# k8s/01-namespace.yaml
apiVersion: v1
kind: Namespace
metadata:
  name: web3guardian
  labels:
    name: web3guardian

---
# k8s/02-configmap.yaml
apiVersion: v1
kind: ConfigMap
metadata:
  name: web3guardian-config
  namespace: web3guardian
data:
  DEBUG: "false"
  ENVIRONMENT: "production"
  LOG_LEVEL: "INFO"
  API_RATE_LIMIT: "1000"
  REDIS_CACHE_TTL: "3600"
  MAX_WORKERS: "4"
  CONNECTION_POOL_SIZE: "20"
  PROMETHEUS_ENABLED: "true"
  HEALTH_CHECK_INTERVAL: "30"
```

#### 2. Secrets

```yaml
# k8s/03-secrets.yaml
apiVersion: v1
kind: Secret
metadata:
  name: web3guardian-secrets
  namespace: web3guardian
type: Opaque
stringData:
  SECRET_KEY: "your-super-secure-production-key-min-32-characters"
  DATABASE_URL: "postgresql://web3guardian:secure-password@postgres:5432/web3guardian_prod"
  POSTGRES_PASSWORD: "secure-password"
  REDIS_URL: "redis://redis:6379/0"
  GOOGLE_API_KEY: "your-production-gemini-api-key"
  ETHERSCAN_API_KEY: "your-production-etherscan-api-key" 
  TENDERLY_API_KEY: "your-production-tenderly-api-key"
  TENDERLY_ACCOUNT_SLUG: "your-tenderly-account"
  TENDERLY_PROJECT_SLUG: "your-tenderly-project"
  SENTRY_DSN: "https://your-sentry-dsn@sentry.io/project"
```

#### 3. Database Deployment

```yaml
# k8s/04-postgres.yaml
apiVersion: v1
kind: PersistentVolumeClaim
metadata:
  name: postgres-pvc
  namespace: web3guardian
spec:
  accessModes:
    - ReadWriteOnce
  resources:
    requests:
      storage: 100Gi
  storageClassName: fast-ssd

---
apiVersion: apps/v1
kind: Deployment
metadata:
  name: postgres
  namespace: web3guardian
spec:
  replicas: 1
  selector:
    matchLabels:
      app: postgres
  template:
    metadata:
      labels:
        app: postgres
    spec:
      containers:
      - name: postgres
        image: postgres:14
        ports:
        - containerPort: 5432
        env:
        - name: POSTGRES_DB
          value: "web3guardian_prod"
        - name: POSTGRES_USER
          value: "web3guardian"
        - name: POSTGRES_PASSWORD
          valueFrom:
            secretKeyRef:
              name: web3guardian-secrets
              key: POSTGRES_PASSWORD
        - name: POSTGRES_INITDB_ARGS
          value: "--encoding=UTF-8 --lc-collate=C --lc-ctype=C"
        resources:
          requests:
            memory: "2Gi"
            cpu: "1000m"
          limits:
            memory: "4Gi"
            cpu: "2000m"
        volumeMounts:
        - name: postgres-storage
          mountPath: /var/lib/postgresql/data
        livenessProbe:
          exec:
            command:
              - pg_isready
              - -U
              - web3guardian
          initialDelaySeconds: 30
          periodSeconds: 10
        readinessProbe:
          exec:
            command:
              - pg_isready
              - -U
              - web3guardian
          initialDelaySeconds: 5
          periodSeconds: 5
      volumes:
      - name: postgres-storage
        persistentVolumeClaim:
          claimName: postgres-pvc

---
apiVersion: v1
kind: Service
metadata:
  name: postgres
  namespace: web3guardian
spec:
  selector:
    app: postgres
  ports:
  - port: 5432
    targetPort: 5432
  type: ClusterIP
```

#### 4. Redis Deployment

```yaml
# k8s/05-redis.yaml
apiVersion: v1
kind: PersistentVolumeClaim
metadata:
  name: redis-pvc
  namespace: web3guardian
spec:
  accessModes:
    - ReadWriteOnce
  resources:
    requests:
      storage: 20Gi

---
apiVersion: apps/v1
kind: Deployment
metadata:
  name: redis
  namespace: web3guardian
spec:
  replicas: 1
  selector:
    matchLabels:
      app: redis
  template:
    metadata:
      labels:
        app: redis
    spec:
      containers:
      - name: redis
        image: redis:7-alpine
        ports:
        - containerPort: 6379
        command:
        - redis-server
        - --appendonly
        - "yes"
        - --maxmemory
        - "1gb"
        - --maxmemory-policy
        - "allkeys-lru"
        resources:
          requests:
            memory: "512Mi"
            cpu: "250m"
          limits:
            memory: "1Gi"
            cpu: "500m"
        volumeMounts:
        - name: redis-storage
          mountPath: /data
        livenessProbe:
          exec:
            command:
              - redis-cli
              - ping
          initialDelaySeconds: 30
          periodSeconds: 10
        readinessProbe:
          exec:
            command:
              - redis-cli
              - ping
          initialDelaySeconds: 5
          periodSeconds: 5
      volumes:
      - name: redis-storage
        persistentVolumeClaim:
          claimName: redis-pvc

---
apiVersion: v1
kind: Service
metadata:
  name: redis
  namespace: web3guardian
spec:
  selector:
    app: redis
  ports:
  - port: 6379
    targetPort: 6379
  type: ClusterIP
```

#### 5. Backend Application

```yaml
# k8s/06-backend.yaml
apiVersion: apps/v1
kind: Deployment
metadata:
  name: web3guardian-backend
  namespace: web3guardian
spec:
  replicas: 5
  strategy:
    type: RollingUpdate
    rollingUpdate:
      maxUnavailable: 1
      maxSurge: 2
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
        envFrom:
        - configMapRef:
            name: web3guardian-config
        - secretRef:
            name: web3guardian-secrets
        resources:
          requests:
            memory: "1Gi"
            cpu: "500m"
          limits:
            memory: "4Gi"
            cpu: "2000m"
        livenessProbe:
          httpGet:
            path: /health
            port: 8000
          initialDelaySeconds: 60
          periodSeconds: 30
          timeoutSeconds: 10
          failureThreshold: 3
        readinessProbe:
          httpGet:
            path: /health
            port: 8000
          initialDelaySeconds: 30
          periodSeconds: 10
          timeoutSeconds: 5
          failureThreshold: 3
        startupProbe:
          httpGet:
            path: /health
            port: 8000
          initialDelaySeconds: 30
          periodSeconds: 10
          timeoutSeconds: 5
          failureThreshold: 30

---
apiVersion: v1
kind: Service
metadata:
  name: web3guardian-backend-service
  namespace: web3guardian
spec:
  selector:
    app: web3guardian-backend
  ports:
  - port: 8000
    targetPort: 8000
    protocol: TCP
  type: ClusterIP

---
apiVersion: autoscaling/v2
kind: HorizontalPodAutoscaler
metadata:
  name: web3guardian-backend-hpa
  namespace: web3guardian
spec:
  scaleTargetRef:
    apiVersion: apps/v1
    kind: Deployment
    name: web3guardian-backend
  minReplicas: 3
  maxReplicas: 20
  metrics:
  - type: Resource
    resource:
      name: cpu
      target:
        type: Utilization
        averageUtilization: 70
  - type: Resource
    resource:
      name: memory
      target:
        type: Utilization
        averageUtilization: 80
  behavior:
    scaleUp:
      stabilizationWindowSeconds: 300
      policies:
      - type: Percent
        value: 100
        periodSeconds: 15
    scaleDown:
      stabilizationWindowSeconds: 600
      policies:
      - type: Percent
        value: 10
        periodSeconds: 60
```

#### 6. Ingress and Load Balancer

```yaml
# k8s/07-ingress.yaml
apiVersion: networking.k8s.io/v1
kind: Ingress
metadata:
  name: web3guardian-ingress
  namespace: web3guardian
  annotations:
    kubernetes.io/ingress.class: "nginx"
    cert-manager.io/cluster-issuer: "letsencrypt-prod"
    nginx.ingress.kubernetes.io/rate-limit: "100"
    nginx.ingress.kubernetes.io/rate-limit-window: "1m"
    nginx.ingress.kubernetes.io/ssl-redirect: "true"
    nginx.ingress.kubernetes.io/force-ssl-redirect: "true"
    nginx.ingress.kubernetes.io/proxy-body-size: "50m"
    nginx.ingress.kubernetes.io/proxy-connect-timeout: "30"
    nginx.ingress.kubernetes.io/proxy-send-timeout: "30"
    nginx.ingress.kubernetes.io/proxy-read-timeout: "300"
spec:
  tls:
  - hosts:
    - api.yourdomain.com
    secretName: web3guardian-tls
  rules:
  - host: api.yourdomain.com
    http:
      paths:
      - path: /
        pathType: Prefix
        backend:
          service:
            name: web3guardian-backend-service
            port:
              number: 8000
```

#### 7. Deploy to Kubernetes

```bash
# Create namespace and apply configurations
kubectl apply -f k8s/01-namespace.yaml
kubectl apply -f k8s/02-configmap.yaml
kubectl apply -f k8s/03-secrets.yaml

# Deploy database and cache
kubectl apply -f k8s/04-postgres.yaml
kubectl apply -f k8s/05-redis.yaml

# Wait for database to be ready
kubectl wait --for=condition=Ready pod -l app=postgres -n web3guardian --timeout=300s

# Deploy backend application
kubectl apply -f k8s/06-backend.yaml

# Setup ingress
kubectl apply -f k8s/07-ingress.yaml

# Initialize database
kubectl exec -n web3guardian deployment/web3guardian-backend -- python scripts/init_db.py --environment production

# Populate knowledge base
kubectl exec -n web3guardian deployment/web3guardian-backend -- python scripts/populate_knowledge_base.py

# Verify deployment
kubectl get pods -n web3guardian
kubectl get services -n web3guardian
kubectl get ingress -n web3guardian

# Check application health
kubectl exec -n web3guardian deployment/web3guardian-backend -- curl -f http://localhost:8000/health
```

## 🔍 Production Monitoring

### Monitoring Setup

```yaml
# monitoring/docker-compose.monitoring.yml
version: '3.8'

services:
  prometheus:
    image: prom/prometheus:latest
    container_name: prometheus
    ports:
      - "9090:9090"
    volumes:
      - ./prometheus.yml:/etc/prometheus/prometheus.yml
      - ./alert_rules.yml:/etc/prometheus/alert_rules.yml
      - prometheus_data:/prometheus
    command:
      - '--config.file=/etc/prometheus/prometheus.yml'
      - '--storage.tsdb.path=/prometheus'
      - '--web.console.libraries=/etc/prometheus/console_libraries'
      - '--web.console.templates=/etc/prometheus/consoles'
      - '--web.enable-lifecycle'
      - '--web.enable-admin-api'
    restart: unless-stopped

  grafana:
    image: grafana/grafana:latest
    container_name: grafana
    ports:
      - "3000:3000"
    volumes:
      - grafana_data:/var/lib/grafana
      - ./dashboards:/etc/grafana/provisioning/dashboards
      - ./datasources:/etc/grafana/provisioning/datasources
    environment:
      - GF_SECURITY_ADMIN_PASSWORD=secure-grafana-password
      - GF_USERS_ALLOW_SIGN_UP=false
      - GF_INSTALL_PLUGINS=grafana-piechart-panel
    restart: unless-stopped

  alertmanager:
    image: prom/alertmanager:latest
    container_name: alertmanager
    ports:
      - "9093:9093"
    volumes:
      - ./alertmanager.yml:/etc/alertmanager/alertmanager.yml
      - alertmanager_data:/alertmanager
    restart: unless-stopped

volumes:
  prometheus_data:
  grafana_data:
  alertmanager_data:
```

### Backup and Recovery

```bash
#!/bin/bash
# backup-production.sh

set -e

BACKUP_DIR="/backup/$(date +%Y%m%d)"
mkdir -p "$BACKUP_DIR"

echo "Starting Web3 Guardian production backup..."

# Database backup
echo "Backing up PostgreSQL..."
docker-compose exec -T postgres pg_dump -U web3guardian web3guardian_prod | gzip > "$BACKUP_DIR/database.sql.gz"

# Redis backup  
echo "Backing up Redis..."
docker-compose exec -T redis redis-cli --rdb - > "$BACKUP_DIR/redis.rdb"

# Application data backup
echo "Backing up application data..."
tar czf "$BACKUP_DIR/app-data.tar.gz" -C /opt/web3guardian data/ logs/

# Configuration backup
echo "Backing up configuration..."
tar czf "$BACKUP_DIR/config.tar.gz" -C /opt/web3guardian \
    .env.prod docker-compose.prod.yml nginx/ monitoring/

# Upload to cloud storage (optional)
if command -v aws &> /dev/null; then
    echo "Uploading to S3..."
    aws s3 sync "$BACKUP_DIR" "s3://web3guardian-backups/$(date +%Y%m%d)/" \
        --storage-class STANDARD_IA
fi

# Cleanup old backups (keep last 30 days)
find /backup -type d -mtime +30 -exec rm -rf {} +

echo "Backup completed: $BACKUP_DIR"
```

## 🔄 Maintenance and Updates

### Update Procedure

```bash
#!/bin/bash
# update-production.sh

set -e

echo "Starting Web3 Guardian production update..."

# Backup before update
./backup-production.sh

# Pull latest images
docker-compose -f docker-compose.prod.yml pull

# Update with zero downtime
docker-compose -f docker-compose.prod.yml up -d --no-deps backend

# Wait for health check
sleep 30
curl -f https://api.yourdomain.com/health || exit 1

# Update other services
docker-compose -f docker-compose.prod.yml up -d

# Run database migrations if needed
docker-compose -f docker-compose.prod.yml exec backend alembic upgrade head

# Update knowledge base
docker-compose -f docker-compose.prod.yml exec backend python scripts/update_knowledge_base.py

# Verify deployment
curl -f https://api.yourdomain.com/health
echo "Update completed successfully!"
```

### Health Monitoring Script

```bash
#!/bin/bash
# health-check.sh

# Check API health
if ! curl -f https://api.yourdomain.com/health > /dev/null 2>&1; then
    echo "CRITICAL: API health check failed"
    # Send alert (email, Slack, etc.)
    exit 1
fi

# Check database connectivity
if ! docker-compose -f docker-compose.prod.yml exec -T postgres pg_isready -U web3guardian > /dev/null 2>&1; then
    echo "CRITICAL: Database connectivity failed"
    exit 1
fi

# Check Redis connectivity
if ! docker-compose -f docker-compose.prod.yml exec -T redis redis-cli ping > /dev/null 2>&1; then
    echo "CRITICAL: Redis connectivity failed"
    exit 1
fi

# Check disk space
DISK_USAGE=$(df / | awk 'NR==2 {print $5}' | sed 's/%//')
if [ "$DISK_USAGE" -gt 85 ]; then
    echo "WARNING: Disk usage is ${DISK_USAGE}%"
fi

# Check memory usage
MEMORY_USAGE=$(free | awk 'NR==2{printf "%.0f", $3*100/$2}')
if [ "$MEMORY_USAGE" -gt 90 ]; then
    echo "WARNING: Memory usage is ${MEMORY_USAGE}%"
fi

echo "All health checks passed"
```

## 📋 Troubleshooting

### Common Issues

#### Service Won't Start
```bash
# Check logs
docker-compose -f docker-compose.prod.yml logs backend

# Check system resources
docker stats

# Check disk space
df -h

# Check port conflicts
netstat -tulpn | grep :8000
```

#### Database Connection Issues
```bash
# Test database connectivity
docker-compose -f docker-compose.prod.yml exec postgres pg_isready -U web3guardian

# Check database logs
docker-compose -f docker-compose.prod.yml logs postgres

# Reset database connection pool
docker-compose -f docker-compose.prod.yml restart backend
```

#### Performance Issues
```bash
# Monitor resource usage
docker stats

# Check API response times
curl -w "@curl-format.txt" -o /dev/null -s https://api.yourdomain.com/health

# Analyze slow queries
docker-compose -f docker-compose.prod.yml exec postgres psql -U web3guardian -d web3guardian_prod -c "SELECT query, mean_time, calls FROM pg_stat_statements ORDER BY mean_time DESC LIMIT 10;"
```

---

*Deployment Guide Version 2.1.0 | Last Updated: August 5, 2025*
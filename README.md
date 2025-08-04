# 🛡️ Web3 Guardian

Web3 Guardian is a comprehensive security suite for Web3 that combines a browser extension and backend services to provide real-time smart contract analysis, transaction simulation, and risk assessment for decentralized applications (dApps). Built with cutting-edge RAG (Retrieval-Augmented Generation) technology and Tenderly integration for dynamic analysis.

[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](https://opensource.org/licenses/MIT)
[![Python 3.13+](https://img.shields.io/badge/python-3.13+-blue.svg)](https://www.python.org/downloads/)
[![Node.js](https://img.shields.io/badge/Node.js-18+-green.svg)](https://nodejs.org/)
[![Code style: black](https://img.shields.io/badge/code%20style-black-000000.svg)](https://github.com/psf/black)
[![FastAPI](https://img.shields.io/badge/FastAPI-0.100+-009688.svg)](https://fastapi.tiangolo.com/)
[![Tenderly](https://img.shields.io/badge/Powered%20by-Tenderly-6366f1.svg)](https://tenderly.co/)

## 🌟 Features

### 🛡️ Advanced Security Features

- **Smart Contract Analysis**: Deep inspection of contract bytecode and source code using static analysis
- **RAG-Powered Vulnerability Detection**: AI-powered vulnerability detection using Google Gemini and LangChain
- **Dynamic Transaction Simulation**: Test transactions before execution in forked blockchain environments via Tenderly
- **Real-time Risk Assessment**: Comprehensive risk scoring for contracts and transactions
- **Phishing Protection**: Advanced detection of malicious domains and contract addresses
- **Permission Monitoring**: Track and manage dApp permissions and access requests

### ⚡ Performance & Optimization

- **Gas Estimation & Optimization**: Accurate gas cost predictions and optimization suggestions
- **Batch Transaction Support**: Combine multiple operations to save on gas costs
- **Network-Aware Pricing**: Dynamic gas price recommendations based on network conditions
- **Smart Caching**: Redis-powered caching for improved response times

### 📊 Analytics & Monitoring

- **Transaction History**: Detailed logs and analysis of all transactions
- **Security Scoring**: Comprehensive risk assessment for each interaction
- **Portfolio Monitoring**: Track assets and interactions across multiple chains
- **Vulnerability Database**: Continuously updated database of known smart contract vulnerabilities

### 🔗 Multi-Chain Support

- **Ethereum Mainnet & Testnets** (Goerli, Sepolia)
- **Layer 2 Solutions** (Polygon, Arbitrum, Optimism)
- **Alternative Networks** (BSC, Avalanche, Fantom)
- **More chains coming soon**

## 🏗️ Architecture

### System Overview

```
┌─────────────────────────────────────────────────────────────────┐
│                      User's Browser                             │
│  ┌─────────────┐     ┌─────────────────┐     ┌──────────────┐  │
│  │  Extension  │ ◄──►│  Content Script │ ◄──►│  Web Pages   │  │
│  └──────┬──────┘     └─────────────────┘     └──────────────┘  │
│         │                                                      │
│  ┌──────▼──────┐     ┌─────────────────┐                      │
│  │  Background │     │  Popup UI       │                      │
│  │  Service    │ ◄──►│  (React)        │                      │
│  └─────────────┘     └─────────────────┘                      │
└─────────────────────────────────────────────────┬──────────────┘
                                                  │
┌─────────────────────────────────────────────────▼──────────────┐
│                      Backend API (FastAPI)                     │
│  ┌─────────────────────────────────────────────────────────┐  │
│  │  RESTful Endpoints                                      │  │
│  │  • /api/v1/analyze/contract                             │  │
│  │  • /api/v1/simulate/transaction                         │  │
│  │  • /api/v1/security/scan                                │  │
│  └───────────────┬─────────────────────────────────────────┘  │
│                  │                                            │
│  ┌───────────────▼───────────────────┐  ┌──────────────────┐  │
│  │  RAG Pipeline (LangChain)         │  │  Tenderly Client │  │
│  │  • Document Retrieval             │  │  • Simulation    │  │
│  │  • Vector Database                │  │  • Gas Analysis  │  │
│  │  • Gemini LLM Integration         │  │  • Fork Testing  │  │
│  └────────────────────────────────────┘  └──────────────────┘  │
│                                                                │
│  ┌──────────────────────────────────┐  ┌──────────────────┐  │
│  │  Database (PostgreSQL)           │  │  Cache (Redis)   │  │
│  │  • Contract metadata             │  │  • Analysis      │  │
│  │  • Analysis results              │  │  • Gas prices    │  │
│  │  • User preferences              │  │  • API responses │  │
│  └──────────────────────────────────┘  └──────────────────┘  │
└───────────────────────────────────────────────────────────────┘
```

### Key Components

#### Frontend (Browser Extension)
- **Content Script**: Injects into web pages to detect and intercept Web3 transactions
- **Background Service**: Handles communication between extension and backend API
- **Popup UI**: User interface for settings, transaction review, and security insights
- **Notification System**: Real-time alerts about potential risks and security issues

#### Backend Services
- **FastAPI Server**: RESTful API with async support and automatic documentation
- **RAG Pipeline**: LangChain-powered analysis using Google Gemini for smart contract insights
- **Tenderly Integration**: Dynamic transaction simulation and gas optimization
- **Security Scanner**: Static and dynamic analysis of smart contracts
- **Caching Layer**: Redis for performance optimization and rate limiting

## 🚀 Getting Started

### Quick Start with Docker (Recommended)

1. **Clone the repository**
   ```bash
   git clone https://github.com/web3guardian/web3-guardian.git
   cd web3-guardian
   ```

2. **Set up environment variables**
   ```bash
   cp .env.example .env
   # Edit .env with your API keys and configuration
   ```

3. **Start all services**
   ```bash
   docker-compose up -d
   ```

4. **Install the browser extension**
   - Open Chrome and navigate to `chrome://extensions/`
   - Enable "Developer mode"  
   - Click "Load unpacked" and select `extension/dist`

### Manual Setup

#### Prerequisites
- Python 3.13+
- Node.js 18+
- PostgreSQL 14+
- Redis 6+

#### Backend Setup

1. **Navigate to backend directory**
   ```bash
   cd backend
   ```

2. **Create virtual environment**
   ```bash
   python -m venv venv
   source venv/bin/activate  # Windows: .\venv\Scripts\activate
   ```

3. **Install dependencies**
   ```bash
   pip install -r requirements.txt
   ```

4. **Configure environment**
   ```bash
   # Required API keys and configuration
   export GEMINI_API_KEY="AIzaSyBOc_PsNyd0SZSwwCe9fk9PEhfPMpJkWQw"
   export TENDERLY_API_KEY="your_tenderly_api_key"
   export TENDERLY_ACCOUNT_SLUG="0xProfessor"
   export TENDERLY_PROJECT_SLUG="project"
   export TENDERLY_SECRET_TOKEN="VufhEuJvtT-eKwDw8txlpPbMHVPgbiGC"
   export DATABASE_URL="postgresql://user:pass@localhost/web3guardian"
   export REDIS_URL="redis://localhost:6379/0"
   ```

5. **Initialize database**
   ```bash
   alembic upgrade head
   python scripts/init_db.py
   ```

6. **Start the server**
   ```bash
   uvicorn main:app --reload --host 0.0.0.0 --port 8000
   ```

#### Extension Setup

1. **Navigate to extension directory**
   ```bash
   cd extension
   ```

2. **Install dependencies**
   ```bash
   npm install
   ```

3. **Build extension**
   ```bash
   npm run build:dev  # Development build
   npm run build:prod # Production build
   ```

4. **Load in browser**
   - Chrome: Load unpacked extension from `extension/dist`
   - Firefox: Load temporary add-on from `extension/dist/manifest.json`

## 🔧 Development

### Project Structure

```
web3-guardian/
├── backend/                 # FastAPI backend service
│   ├── src/
│   │   ├── database/       # Database models and configuration
│   │   │   ├── models.py   # SQLAlchemy models
│   │   │   └── config.py   # Database configuration
│   │   ├── optimization/   # Gas optimization algorithms
│   │   │   └── gas_optimizer.py
│   │   ├── rag/           # RAG pipeline for vulnerability detection
│   │   │   └── rag_pipeline.py
│   │   ├── simulation/    # Tenderly integration
│   │   │   └── tenderly_new.py
│   │   └── utils/         # Utility functions
│   │       ├── config.py  # Application configuration
│   │       └── logger.py  # Logging setup
│   ├── scripts/           # Database and setup scripts
│   │   ├── init_db.py    # Database initialization
│   │   ├── check_db.py   # Database health check
│   │   └── test_db.py    # Database testing
│   ├── tests/            # Backend tests
│   ├── alembic/          # Database migrations
│   ├── main.py           # FastAPI application
│   └── requirements.txt  # Python dependencies
├── extension/             # Browser extension
│   ├── src/
│   │   ├── background/   # Service worker
│   │   ├── content/      # Content scripts
│   │   ├── popup/        # Extension popup UI
│   │   ├── utils/        # Shared utilities
│   │   └── manifest.json # Extension manifest
│   └── package.json      # Node.js dependencies
├── docs/                 # Documentation
│   ├── API.md           # API documentation
│   └── ARCHITECTURE.md  # System architecture
├── tests/               # Integration tests
└── docker-compose.yml   # Container orchestration
```

### Code Style & Standards

- **Python**: Black formatting, PEP 8 compliance, type hints
- **JavaScript/TypeScript**: Airbnb style guide with Prettier
- **Git**: Conventional Commits specification
- **Documentation**: Comprehensive docstrings and README files

### Testing

```bash
# Backend tests
cd backend && pytest --cov=src

# Extension tests  
cd extension && npm test

# Integration tests
npm run test:e2e

# All tests
npm run test:all
```

### API Documentation

The backend API provides comprehensive OpenAPI documentation:
- **Development**: http://localhost:8000/docs
- **ReDoc**: http://localhost:8000/redoc
- **OpenAPI JSON**: http://localhost:8000/openapi.json

## 🚀 Deployment

### Production Deployment

#### Docker (Recommended)

```bash
# Production deployment
docker-compose -f docker-compose.prod.yml up -d

# With SSL and reverse proxy
docker-compose -f docker-compose.prod.yml -f docker-compose.ssl.yml up -d
```

#### Manual Deployment

```bash
# Backend
cd backend
gunicorn main:app -w 4 -k uvicorn.workers.UvicornWorker --bind 0.0.0.0:8000

# Extension
cd extension
npm run build:prod
# Submit to Chrome Web Store / Firefox Add-ons
```

### Environment Configuration

#### Production Environment Variables

```bash
# Core Configuration
DEBUG=False
LOG_LEVEL=INFO
SECRET_KEY=your-production-secret-key

# Database
DATABASE_URL=postgresql://user:pass@db-host:5432/web3guardian
REDIS_URL=redis://redis-host:6379/0

# API Keys
GEMINI_API_KEY=your-production-gemini-key
TENDERLY_API_KEY=your-production-tenderly-key
TENDERLY_ACCOUNT_SLUG=0xProfessor
TENDERLY_PROJECT_SLUG=project
TENDERLY_SECRET_TOKEN=your-production-tenderly-token

# Security
ALLOWED_ORIGINS=["https://web3guardian.dev", "chrome-extension://*"]
CORS_ALLOW_CREDENTIALS=True

# Performance
REDIS_CACHE_TTL=3600
API_RATE_LIMIT=100
```

## 📊 Usage Examples

### Analyzing a Smart Contract

```python
import requests

# Start contract analysis
response = requests.post('http://localhost:8000/api/analyze/contract', json={
    "contract_address": "0x1234567890123456789012345678901234567890",
    "network": "mainnet",
    "analysis_types": ["static", "dynamic"]
})

analysis_id = response.json()["analysis_id"]

# Check analysis results
results = requests.get(f'http://localhost:8000/api/analysis/{analysis_id}')
print(results.json())
```

### Browser Extension Integration

```javascript
// In your dApp
window.addEventListener('web3guardian:analysis', (event) => {
  const { contractAddress, riskScore, vulnerabilities } = event.detail;
  
  if (riskScore > 7.0) {
    console.warn('High-risk contract detected:', vulnerabilities);
  }
});
```

## 🛡️ Security

Web3 Guardian takes security seriously. We implement multiple layers of protection:

### Security Features
- **Input Validation**: All inputs are validated and sanitized
- **Rate Limiting**: API endpoints are protected against abuse
- **Secure Storage**: Sensitive data is encrypted at rest
- **HTTPS Only**: All communications use TLS encryption
- **Content Security Policy**: Extension follows strict CSP guidelines

### Reporting Security Issues
Please report security vulnerabilities to [security@web3guardian.dev](mailto:security@web3guardian.dev). See our [Security Policy](SECURITY.md) for more details.

## 📚 Documentation

- **[API Reference](docs/API.md)**: Comprehensive API documentation
- **[Architecture](docs/ARCHITECTURE.md)**: System design and architecture decisions
- **[Contributing](CONTRIBUTING.md)**: Guidelines for contributors
- **[Security Policy](SECURITY.md)**: Security practices and vulnerability reporting
- **[Troubleshooting](TROUBLESHOOTING.md)**: Common issues and solutions

## 🤝 Contributing

We welcome contributions from the community! Please see our [Contributing Guidelines](CONTRIBUTING.md) for details on:

- Setting up the development environment
- Code style and standards
- Testing requirements
- Pull request process
- Issue reporting

### Quick Start for Contributors

1. Fork the repository
2. Create a feature branch: `git checkout -b feature/amazing-feature`
3. Make your changes and add tests
4. Commit using conventional commits: `git commit -m "feat: add amazing feature"`
5. Push to your fork: `git push origin feature/amazing-feature`
6. Open a Pull Request

## 🎯 Roadmap

### Q1 2025
- [ ] Enhanced RAG pipeline with domain-specific vulnerability patterns
- [ ] Mobile application development (React Native)
- [ ] Advanced gas optimization algorithms
- [ ] Multi-signature wallet integration

### Q2 2025
- [ ] Machine learning-based fraud detection
- [ ] Cross-chain bridge security analysis
- [ ] Enterprise dashboard and analytics
- [ ] API rate limiting and authentication

### Q3 2025
- [ ] DeFi protocol risk assessment
- [ ] NFT marketplace security features
- [ ] Compliance reporting tools
- [ ] Advanced smart contract auditing

### Q4 2025
- [ ] AI-powered security recommendations
- [ ] Institutional-grade features
- [ ] Regulatory compliance tools
- [ ] Third-party security integrations

## 📄 License

This project is licensed under the MIT License - see the [LICENSE](LICENSE) file for details.

## 🙏 Acknowledgments

Web3 Guardian is built with and inspired by:

### Core Technologies
- **[FastAPI](https://fastapi.tiangolo.com/)**: Modern, fast web framework for Python
- **[LangChain](https://langchain.com/)**: Framework for developing LLM applications
- **[Google Gemini](https://deepmind.google/technologies/gemini/)**: Advanced AI model for analysis
- **[Tenderly](https://tenderly.co/)**: Blockchain development platform and simulation
- **[PostgreSQL](https://www.postgresql.org/)**: Advanced open-source database
- **[Redis](https://redis.io/)**: In-memory data structure store

### Security Inspirations
- **[Revoke.cash](https://revoke.cash/)**: Token approval management
- **[MetaMask](https://metamask.io/)**: Browser wallet and Web3 gateway
- **[OpenZeppelin Defender](https://openzeppelin.com/defender/)**: Smart contract security platform
- **[Consensys Diligence](https://consensys.net/diligence/)**: Smart contract auditing

### Community & Support
- Built with ❤️ by the Web3 Guardian team
- Supported by the broader Web3 security community
- Special thanks to all contributors and beta testers

## 📞 Support & Community

- **🌐 Website**: [https://web3guardian.dev](https://web3guardian.dev)
- **📖 Documentation**: [https://docs.web3guardian.dev](https://docs.web3guardian.dev)
- **💬 Discord**: [https://discord.gg/web3guardian](https://discord.gg/web3guardian)
- **🐦 Twitter**: [@Web3Guardian](https://twitter.com/Web3Guardian)
- **📧 Email**: [support@web3guardian.dev](mailto:support@web3guardian.dev)
- **🛠️ Issues**: [GitHub Issues](https://github.com/web3guardian/web3-guardian/issues)

---

**Made with ❤️ for the Web3 community**

*Securing the decentralized future, one transaction at a time.*

---

*Last updated: August 4, 2025*

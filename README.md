# 🛡️ Web3 Guardian

Web3 Guardian is a comprehensive security suite for Web3 that combines browser extension and backend services to provide real-time transaction analysis, smart contract auditing, and risk assessment for decentralized applications (dApps).

[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](https://opensource.org/licenses/MIT)
[![Python 3.13+](https://img.shields.io/badge/python-3.13+-blue.svg)](https://www.python.org/downloads/)
[![Node.js](https://img.shields.io/badge/Node.js-18+-green.svg)](https://nodejs.org/)
[![Code style: black](https://img.shields.io/badge/code%20style-black-000000.svg)](https://github.com/psf/black)

## 🌟 Features

### 🛡️ Security Features
- **Smart Contract Analysis**: Deep inspection of contract bytecode and source code
- **Transaction Simulation**: Test transactions before execution in a forked environment
- **Vulnerability Detection**: Identify common smart contract vulnerabilities
- **Phishing Protection**: Warn about suspicious domains and addresses
- **Permission Monitoring**: Track and manage dApp permissions

### ⚙️ Optimization
- **Gas Estimation**: Accurate gas cost predictions
- **Gas Optimization**: Suggest optimal gas prices based on network conditions
- **Batch Transactions**: Combine multiple operations to save on gas

### 📊 Analytics
- **Transaction History**: Detailed logs of all transactions
- **Risk Scoring**: Comprehensive risk assessment for each interaction
- **Portfolio Monitoring**: Track assets across multiple chains

## 🏗️ Architecture

### System Overview

```
┌─────────────────────────────────────────────────────────────────┐
│                      User's Browser                             │
│  ┌─────────────┐     ┌─────────────────┐     ┌──────────────┐  │
│  │  Extension  │ ◄──►│  Content Script │ ◄──►│  Web Pages   │  │
│  └──────┬──────┘     └─────────────────┘     └──────────────┘  │
│         │                                                    │
│  ┌──────▼──────┐     ┌─────────────────┐                      │
│  │  Background │     │  Popup UI       │                      │
│  │  Service    │ ◄──►│  (React)        │                      │
│  └─────────────┘     └─────────────────┘                      │
└─────────────────────────────────────────────────┬──────────────┘                                                 │
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
│  │  RAG Pipeline                    │  │  Tenderly Client  │  │
│  │  • Document Retrieval            │  └──────────────────┘  │
│  │  • Vector Database               │                        │
│  │  • LLM Integration               │  ┌──────────────────┐  │
│  └──────────────────────────────────┘  │  Security Rules  │  │
│                                        │  Engine           │  │
│  ┌──────────────────────────────────┐  └──────────────────┘  │
│  │  Database (PostgreSQL)           │                        │
│  │  • Contract metadata             │  ┌──────────────────┐  │
│  │  • Analysis results              │  │  Cache (Redis)   │  │
│  └──────────────────────────────────┘  └──────────────────┘  │
└───────────────────────────────────────────────────────────────┘
```

### Extension Components

- **Content Script**: Injects into web pages to detect and intercept Web3 transactions
- **Background Service**: Handles communication between the extension and backend
- **Popup UI**: User interface for settings and transaction review
- **Notification System**: Alerts users about potential risks

### Backend Services

- **API Layer**: FastAPI-based RESTful endpoints
- **RAG Pipeline**: Retrieval-Augmented Generation for smart contract analysis
- **Simulation Engine**: Forked blockchain environments for safe testing
- **Security Scanner**: Static and dynamic analysis of smart contracts
- **Cache Layer**: Redis for performance optimization

## 🚀 Getting Started

### Prerequisites

- Node.js 18+ (LTS recommended)
- Python 3.13+
- PostgreSQL 14+
- Redis 6+
- Chrome or Firefox browser

### Installation

1. **Clone the repository**
   ```bash
   git clone https://github.com/0x-Professor/web3-Guardian.git
   cd web3-Guardian
   ```

2. **Set up the backend**
   ```bash
   cd backend
   python -m venv venv
   # On Windows: .\venv\Scripts\activate
   source venv/bin/activate  
   pip install -r requirements.txt
   ```

3. **Configure environment variables**
   Copy the example environment file and update with your settings:
   ```bash
   cp .env.example .env
   # Edit .env with your configuration
   ```

4. **Initialize the database**
   ```bash
   python scripts/init_db.py
   # Run migrations
   alembic upgrade head
   ```

5. **Set up the extension**
   ```bash
   cd ../extension
   npm install
   npm run build
   ```

### Running Locally

1. **Start the backend server**
   ```bash
   cd backend
   uvicorn src.main:app --reload --host 0.0.0.0 --port 8000
   ```

2. **Load the extension in your browser**
   - Open Chrome and go to `chrome://extensions/`
   - Enable "Developer mode" (toggle in top-right)
   - Click "Load unpacked" and select the `extension/dist` directory

3. **Access the API documentation**
   - Interactive API docs: http://localhost:8000/docs
   - Alternative docs: http://localhost:8000/redoc

## 🔧 Development

### Code Style

- **Python**: Follows PEP 8 with Black formatting
- **JavaScript/TypeScript**: Airbnb style guide with Prettier
- **Git**: Conventional Commits

### Testing

```bash
# Run backend tests
cd backend
pytest

# Run frontend tests
cd ../extension
npm test

# Run end-to-end tests
npm run test:e2e
```

### Building for Production

```bash
# Build the extension
cd extension
npm run build:prod

# Build the Docker image
cd ..
docker-compose build
```

## 🚀 Deployment

### Docker (Recommended)

```bash
docker-compose up -d
```

### Manual Deployment

1. **Backend**
   ```bash
   cd backend
   gunicorn src.main:app -w 4 -k uvicorn.workers.UvicornWorker
   ```

2. **Extension**
   - Build for production: `npm run build:prod`
   - Submit to Chrome Web Store/Firefox Add-ons

## 📚 Documentation

- [API Reference](/docs/API.md)
- [Architecture Decision Records](/docs/architecture/)
- [Security Model](/docs/SECURITY.md)
- [Troubleshooting](/docs/TROUBLESHOOTING.md)

## 🤝 Contributing

We welcome contributions! Please see our [Contributing Guidelines](CONTRIBUTING.md) for details.

## 📄 License

This project is licensed under the MIT License - see the [LICENSE](LICENSE) file for details.

## 🙏 Acknowledgments

- Built with ❤️ by the Web3 Guardian team
- Powered by [FastAPI](https://fastapi.tiangolo.com/), [React](https://reactjs.org/), and [Tenderly](https://tenderly.co/)
- Inspired by [Revoke.cash](https://revoke.cash/), [MetaMask](https://metamask.io/), and [OpenZeppelin Defender](https://openzeppelin.com/defender/)

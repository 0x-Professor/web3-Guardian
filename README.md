# Web3 Guardian

Web3 Guardian is a browser extension that enhances security and optimizes transactions in the Web3 ecosystem. It provides real-time transaction analysis, risk assessment, and gas optimization to help users interact safely with decentralized applications (dApps).

## Features

- 🔍 **Transaction Analysis**: Analyzes transactions for potential risks and security issues
- ⚡ **Gas Optimization**: Suggests optimal gas prices and estimates gas usage
- 🛡️ **Security Alerts**: Warns about suspicious contracts and addresses
- 📊 **Simulation**: Simulates transactions before execution
- 🔗 **Multi-Chain Support**: Works with Ethereum and other EVM-compatible chains
- 🔒 **Privacy-Focused**: All analysis happens locally or through your own backend

## Architecture

```
web3-guardian/
├── extension/                  # Browser extension files
│   ├── manifest.json           # Extension configuration
│   └── src/                    
│       ├── content/            # Content scripts for dApp interaction
│       ├── background/         # Background service worker
│       └── popup/              # React-based popup UI
├── backend/                    # Backend service
│   ├── main.py                # FastAPI server
│   └── src/
│       ├── rag/               # RAG pipeline for document analysis
│       ├── simulation/        # Transaction simulation
│       └── optimization/      # Gas optimization logic
└── tests/                     # Test suites
```

## Getting Started

### Prerequisites

- Node.js (v16 or later)
- Python 3.9+
- Chrome or Firefox browser

### Installation

1. **Clone the repository**
   ```bash
   git clone https://github.com/yourusername/web3-guardian.git
   cd web3-guardian
   ```

2. **Install frontend dependencies**
   ```bash
   npm install
   ```

3. **Set up the Python backend**
   ```bash
   cd backend
   python -m venv venv
   source venv/bin/activate  # On Windows: .\venv\Scripts\activate
   pip install -r requirements.txt
   ```

4. **Configure environment variables**
   Create a `.env` file in the backend directory:
   ```
   OPENAI_API_KEY=your_openai_api_key
   TENDERLY_ACCESS_KEY=your_tenderly_access_key
   TENDERLY_PROJECT=your_tenderly_project
   TENDERLY_USERNAME=your_tenderly_username
   ```

### Development

1. **Start the backend server**
   ```bash
   cd backend
   uvicorn main:app --reload
   ```

2. **Build the extension**
   ```bash
   npm run build
   ```

3. **Load the extension in your browser**
   - Open Chrome and go to `chrome://extensions/`
   - Enable "Developer mode"
   - Click "Load unpacked" and select the `dist` directory

## Usage

1. Click the Web3 Guardian icon in your browser toolbar to open the popup
2. Connect your wallet
3. When making transactions, Web3 Guardian will analyze them and provide security insights
4. Review the transaction details and recommendations before confirming

## Testing

Run the test suite:

```bash
# Frontend tests
npm test

# Backend tests
cd backend
pytest
```

## Deployment

### Docker

Build and run with Docker:

```bash
docker build -t web3-guardian .
docker run -p 8000:8000 web3-guardian
```

### Extension Stores

- [Chrome Web Store](https://chrome.google.com/webstore/devconsole/)
- [Firefox Add-ons](https://addons.mozilla.org/developers/)

## Contributing

Contributions are welcome! Please read our [Contributing Guidelines](CONTRIBUTING.md) for details.

## License

This project is licensed under the MIT License - see the [LICENSE](LICENSE) file for details.

## Acknowledgments

- Built with ❤️ by the Web3 Guardian team
- Uses [FastAPI](https://fastapi.tiangolo.com/) for the backend
- Uses [React](https://reactjs.org/) for the frontend
- Inspired by [Revoke.cash](https://revoke.cash/) and [Tenderly](https://tenderly.co/)

# Contributing to Web3 Guardian

Thank you for your interest in contributing to Web3 Guardian! We welcome contributions from the community to help improve this comprehensive Web3 security platform.

## Table of Contents

- [Code of Conduct](#code-of-conduct)
- [Getting Started](#getting-started)
- [Development Setup](#development-setup)
- [Project Structure](#project-structure)
- [Making Changes](#making-changes)
- [Pull Request Process](#pull-request-process)
- [Reporting Issues](#reporting-issues)
- [Feature Requests](#feature-requests)
- [Code Style](#code-style)
- [Testing](#testing)
- [Documentation](#documentation)
- [Deployment](#deployment)
- [License](#license)

## Code of Conduct

This project and everyone participating in it is governed by our [Code of Conduct](CODE_OF_CONDUCT.md). By participating, you are expected to uphold this code.

## Getting Started

1. Fork the repository on GitHub
2. Clone your forked repository to your local machine
3. Set up the development environment (see below)
4. Create a new branch for your feature or bug fix
5. Make your changes and test them thoroughly
6. Submit a pull request

## Development Setup

### Prerequisites

- **Python 3.13+** (for backend development)
- **Node.js 18+** (for extension development)
- **PostgreSQL 14+** (for database)
- **Redis 6+** (for caching)
- **Git** (version control)
- **Docker & Docker Compose** (optional, for containerized development)

### Environment Variables

Create a `.env` file in the root directory with the following variables:

```bash
# Tenderly Configuration
TENDERLY_API_KEY=your_tenderly_api_key
TENDERLY_ACCOUNT_SLUG=account
TENDERLY_PROJECT_SLUG=project
TENDERLY_API_URL=https://api.tenderly.co/api/v1/account/account/project/
TENDERLY_SECRET_TOKEN=your_tenderly_secret_token

# Gemini API Configuration
GEMINI_API_KEY=your_gemini_api_key

# Database Configuration
DATABASE_URL=postgresql://web3guardian:password@localhost:5432/web3guardian
REDIS_URL=redis://localhost:6379/0

# API Configuration
API_HOST=0.0.0.0
API_PORT=8000
DEBUG=True
LOG_LEVEL=INFO

# Security
SECRET_KEY=your-secret-key-here
ALLOWED_ORIGINS=["http://localhost:3000", "chrome-extension://*"]

# Vector Database (for RAG)
VECTOR_DB_URL=http://localhost:8080
VECTOR_DB_COLLECTION=vulnerabilities

# Blockchain RPC URLs
ETHEREUM_RPC_URL=https://mainnet.infura.io/v3/your-key
POLYGON_RPC_URL=https://polygon-mainnet.infura.io/v3/your-key
ARBITRUM_RPC_URL=https://arbitrum-mainnet.infura.io/v3/your-key
```

### Backend Setup

1. Navigate to the backend directory:
   ```bash
   cd backend
   ```

2. Create and activate a virtual environment:
   ```bash
   python -m venv venv
   source venv/bin/activate  # On Windows: .\venv\Scripts\activate
   ```

3. Install dependencies:
   ```bash
   pip install -r requirements.txt
   ```

4. Set up the database:
   ```bash
   # Install PostgreSQL and create database
   createdb web3guardian
   
   # Run database migrations
   alembic upgrade head
   
   # Initialize with test data (optional)
   python scripts/init_db.py
   ```

5. Start Redis server:
   ```bash
   redis-server
   ```

6. Run the development server:
   ```bash
   python main.py
   # Or with hot reload
   uvicorn main:app --reload --host 0.0.0.0 --port 8000
   ```

### Extension Setup

1. Navigate to the extension directory:
   ```bash
   cd extension
   ```

2. Install dependencies:
   ```bash
   npm install
   ```

3. Build the extension:
   ```bash
   # Development build
   npm run build:dev
   
   # Production build
   npm run build:prod
   ```

4. Load the extension in Chrome:
   - Open Chrome and navigate to `chrome://extensions/`
   - Enable "Developer mode"
   - Click "Load unpacked" and select the `extension/dist` folder

### Docker Setup (Alternative)

For a containerized development environment:

```bash
# Build and start all services
docker-compose up --build

# Run backend only
docker-compose up backend

# Run with hot reload
docker-compose -f docker-compose.dev.yml up
```

## Project Structure

```
web3-guardian/
├── backend/                 # FastAPI backend service
│   ├── src/
│   │   ├── database/       # Database models and configuration
│   │   ├── optimization/   # Gas optimization logic
│   │   ├── rag/           # RAG pipeline for vulnerability detection
│   │   ├── simulation/    # Tenderly integration
│   │   └── utils/         # Utility functions and configuration
│   ├── scripts/           # Setup and maintenance scripts
│   ├── tests/            # Backend tests
│   ├── alembic/          # Database migrations
│   ├── main.py           # FastAPI application entry point
│   └── requirements.txt  # Python dependencies
├── extension/             # Browser extension
│   ├── src/
│   │   ├── background/   # Service worker
│   │   ├── content/      # Content scripts
│   │   ├── popup/        # Extension popup UI
│   │   ├── utils/        # Shared utilities
│   │   └── manifest.json # Extension manifest
│   ├── package.json      # Node.js dependencies
│   └── webpack.config.js # Build configuration
├── docs/                 # Documentation
├── tests/               # Integration and E2E tests
└── docker-compose.yml   # Container orchestration
```

### Key Components

#### Backend Components

- **`main.py`**: FastAPI application with all API endpoints
- **`src/simulation/tenderly_new.py`**: Tenderly API integration for dynamic analysis
- **`src/rag/rag_pipeline.py`**: RAG pipeline for vulnerability detection using LangChain
- **`src/optimization/gas_optimizer.py`**: Gas optimization algorithms
- **`src/database/models.py`**: SQLAlchemy database models
- **`src/utils/config.py`**: Configuration management
- **`src/utils/logger.py`**: Logging setup

#### Extension Components

- **`src/background/background.js`**: Service worker for API communication
- **`src/content/content.js`**: Content script for Web3 transaction interception
- **`src/popup/popup.js`**: Extension popup interface
- **`src/utils/api.js`**: API client for backend communication

## Making Changes

### Branch Naming Convention

- `feature/feature-name` - New features
- `fix/bug-description` - Bug fixes
- `docs/documentation-update` - Documentation changes
- `refactor/component-name` - Code refactoring
- `test/test-description` - Test additions/improvements

### Development Workflow

1. Create a new branch for your feature or bugfix:
   ```bash
   git checkout -b feature/your-feature-name
   # or
   git checkout -b fix/issue-description
   ```

2. Make your changes following the code style guidelines

3. Add tests for your changes:
   ```bash
   # Backend tests
   cd backend && pytest tests/

   # Extension tests
   cd extension && npm test
   ```

4. Run the full test suite:
   ```bash
   # Run all tests
   npm run test:all

   # Run specific test categories
   npm run test:backend
   npm run test:extension
   npm run test:e2e
   ```

5. Update documentation if needed

6. Commit your changes with a descriptive commit message following [Conventional Commits](https://conventionalcommits.org/):
   ```bash
   git commit -m "feat(backend): add contract vulnerability detection"
   git commit -m "fix(extension): resolve popup rendering issue"
   git commit -m "docs: update API documentation"
   ```

## Pull Request Process

1. **Before submitting:**
   - Ensure all tests pass
   - Update documentation
   - Add changelog entry if applicable
   - Rebase your branch on the latest main branch

2. **Submitting the PR:**
   - Push your changes to your fork
   - Open a pull request against the main branch
   - Use a clear title and description
   - Reference any related issues

3. **PR Template:**
   ```markdown
   ## Description
   Brief description of changes

   ## Type of Change
   - [ ] Bug fix
   - [ ] New feature
   - [ ] Breaking change
   - [ ] Documentation update

   ## Testing
   - [ ] Unit tests pass
   - [ ] Integration tests pass
   - [ ] Manual testing completed

   ## Checklist
   - [ ] Code follows style guidelines
   - [ ] Self-review completed
   - [ ] Documentation updated
   - [ ] No breaking changes (or breaking changes documented)
   ```

4. **Review process:**
   - Address review comments promptly
   - Request re-review after making changes
   - Maintain a positive and collaborative attitude

## Reporting Issues

When reporting issues, please include:

### Bug Reports
- **Title**: Clear, concise description
- **Environment**: OS, browser version, extension version
- **Steps to reproduce**: Detailed step-by-step instructions
- **Expected behavior**: What should happen
- **Actual behavior**: What actually happens
- **Screenshots**: If applicable
- **Logs**: Console errors or backend logs
- **Additional context**: Any other relevant information

### Security Issues
For security vulnerabilities, please email [security@web3guardian.dev](mailto:security@web3guardian.dev) instead of creating a public issue.

## Feature Requests

For feature requests:

1. **Check existing requests**: Search for similar feature requests
2. **Use the template**: Follow the feature request template
3. **Provide context**: Explain the problem you're trying to solve
4. **Describe the solution**: Detail your proposed solution
5. **Consider alternatives**: Mention alternative approaches
6. **Additional context**: Include mockups, examples, or references

## Code Style

### Python (Backend)

- **Style Guide**: [PEP 8](https://www.python.org/dev/peps/pep-0008/)
- **Formatter**: [Black](https://black.readthedocs.io/) (88 character line length)
- **Linter**: [Flake8](https://flake8.pycqa.org/) with [mypy](https://mypy.readthedocs.io/)
- **Import sorting**: [isort](https://pycqa.github.io/isort/)

```python
# Good example
from typing import Dict, List, Optional

import httpx
from fastapi import HTTPException

from src.utils.logger import logger


async def analyze_contract(
    contract_address: str,
    network: str = "mainnet"
) -> Dict[str, Any]:
    """Analyze a smart contract for vulnerabilities.
    
    Args:
        contract_address: The contract address to analyze
        network: The blockchain network
        
    Returns:
        Analysis results dictionary
        
    Raises:
        HTTPException: If analysis fails
    """
    try:
        # Implementation here
        pass
    except Exception as e:
        logger.error(f"Analysis failed: {e}")
        raise HTTPException(status_code=500, detail=str(e))
```

### JavaScript/TypeScript (Extension)

- **Style Guide**: [Airbnb JavaScript Style Guide](https://github.com/airbnb/javascript)
- **Formatter**: [Prettier](https://prettier.io/)
- **Linter**: [ESLint](https://eslint.org/)
- **Type Checking**: TypeScript for all new code

```typescript
// Good example
interface ContractAnalysis {
  contractAddress: string;
  network: string;
  vulnerabilities: Vulnerability[];
  securityScore: number;
}

class Web3GuardianAPI {
  private baseUrl: string;

  constructor(baseUrl: string) {
    this.baseUrl = baseUrl;
  }

  /**
   * Analyze a smart contract
   * @param contractAddress - The contract address
   * @param network - The blockchain network
   * @returns Promise with analysis results
   */
  async analyzeContract(
    contractAddress: string,
    network: string = 'mainnet'
  ): Promise<ContractAnalysis> {
    try {
      const response = await fetch(`${this.baseUrl}/api/analyze/contract`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ contractAddress, network })
      });

      if (!response.ok) {
        throw new Error(`Analysis failed: ${response.statusText}`);
      }

      return await response.json();
    } catch (error) {
      console.error('Contract analysis failed:', error);
      throw error;
    }
  }
}
```

### Git Commit Messages

Follow the [Conventional Commits](https://conventionalcommits.org/) specification:

```
<type>[optional scope]: <description>

[optional body]

[optional footer(s)]
```

**Types:**
- `feat`: New feature
- `fix`: Bug fix
- `docs`: Documentation changes
- `style`: Code style changes (formatting, etc.)
- `refactor`: Code refactoring
- `test`: Test additions or improvements
- `chore`: Maintenance tasks

**Examples:**
```
feat(backend): add contract vulnerability detection using RAG
fix(extension): resolve popup not displaying on some websites
docs(api): update endpoint documentation with new parameters
test(backend): add integration tests for Tenderly simulation
```

## Testing

### Backend Testing

```bash
# Install test dependencies
pip install -r requirements-dev.txt

# Run all tests
pytest

# Run with coverage
pytest --cov=src --cov-report=html

# Run specific test file
pytest tests/test_main.py

# Run tests with specific markers
pytest -m "not slow"
```

### Extension Testing

```bash
# Run unit tests
npm test

# Run tests in watch mode
npm run test:watch

# Run E2E tests
npm run test:e2e

# Run tests with coverage
npm run test:coverage
```

### Writing Tests

#### Backend Tests
```python
import pytest
from fastapi.testclient import TestClient
from unittest.mock import patch, MagicMock

from main import app

client = TestClient(app)

class TestContractAnalysis:
    def test_analyze_contract_success(self):
        """Test successful contract analysis."""
        request_data = {
            "contract_address": "0x1234567890123456789012345678901234567890",
            "network": "mainnet",
            "analysis_types": ["static", "dynamic"]
        }
        
        response = client.post("/api/analyze/contract", json=request_data)
        
        assert response.status_code == 200
        data = response.json()
        assert "analysis_id" in data
        assert data["status"] == "pending"

    @patch('src.simulation.tenderly_new.TenderlyClient')
    def test_dynamic_analysis_with_mock(self, mock_tenderly):
        """Test dynamic analysis with mocked Tenderly client."""
        mock_client = MagicMock()
        mock_tenderly.return_value = mock_client
        mock_client.simulate_transaction.return_value = {
            "id": "sim-123",
            "gas_used": 45000,
            "status": True
        }
        
        # Test implementation
        pass
```

#### Extension Tests
```javascript
import { analyzeContract } from '../src/utils/api.js';

describe('API Client', () => {
  beforeEach(() => {
    global.fetch = jest.fn();
  });

  afterEach(() => {
    jest.resetAllMocks();
  });

  test('analyzeContract should return analysis results', async () => {
    const mockResponse = {
      analysis_id: '123',
      status: 'pending',
      results: {}
    };

    global.fetch.mockResolvedValueOnce({
      ok: true,
      json: () => Promise.resolve(mockResponse)
    });

    const result = await analyzeContract('0x123...', 'mainnet');
    
    expect(result).toEqual(mockResponse);
    expect(global.fetch).toHaveBeenCalledWith(
      expect.stringContaining('/api/analyze/contract'),
      expect.objectContaining({
        method: 'POST',
        headers: { 'Content-Type': 'application/json' }
      })
    );
  });
});
```

## Documentation

### Types of Documentation

1. **Code Documentation**: Docstrings, inline comments
2. **API Documentation**: OpenAPI/Swagger specs
3. **User Documentation**: Usage guides, tutorials
4. **Developer Documentation**: Architecture, setup guides

### Documentation Standards

- Use clear, concise language
- Include code examples
- Keep documentation up-to-date with code changes
- Use proper Markdown formatting
- Include diagrams where helpful

### Building Documentation

```bash
# Generate API documentation
cd backend && python -c "import main; print(main.app.openapi())" > docs/openapi.json

# Build documentation site (if using MkDocs)
mkdocs build
mkdocs serve
```

## Deployment

### Development Deployment

```bash
# Backend
cd backend
uvicorn main:app --reload --host 0.0.0.0 --port 8000

# Extension (development build)
cd extension
npm run build:dev
```

### Production Deployment

```bash
# Docker deployment
docker-compose -f docker-compose.prod.yml up -d

# Manual deployment
cd backend
gunicorn main:app -w 4 -k uvicorn.workers.UvicornWorker --bind 0.0.0.0:8000

# Extension (production build)
cd extension
npm run build:prod
```

### CI/CD Pipeline

Our GitHub Actions workflow includes:
- Code linting and formatting checks
- Unit and integration tests
- Security scans
- Docker image building
- Automated deployments to staging/production

## Performance Considerations

### Backend Performance
- Use async/await for I/O operations
- Implement proper caching strategies
- Monitor API response times
- Use database indexes appropriately
- Implement rate limiting

### Extension Performance
- Minimize content script execution time
- Use efficient DOM manipulation
- Implement proper error handling
- Cache analysis results when appropriate

## Security Guidelines

### General Security
- Never commit secrets to version control
- Use environment variables for configuration
- Validate all user input
- Implement proper error handling
- Follow security best practices

### API Security
- Implement rate limiting
- Use HTTPS in production
- Validate request parameters
- Implement proper CORS policies
- Log security events

### Extension Security
- Follow Chrome extension security guidelines
- Minimize permissions requested
- Validate data from web pages
- Use Content Security Policy
- Implement secure communication with backend

## Community Guidelines

### Communication
- Be respectful and inclusive
- Use clear, professional language
- Provide constructive feedback
- Help other contributors when possible
- Follow our Code of Conduct

### Collaboration
- Share knowledge and expertise
- Document your decisions and reasoning
- Be open to feedback and suggestions
- Participate in discussions and reviews
- Help maintain project quality

## License

By contributing to Web3 Guardian, you agree that your contributions will be licensed under the [MIT License](LICENSE).

## Getting Help

- **Documentation**: Check existing documentation first
- **GitHub Issues**: Search for similar issues
- **Discord**: Join our [Discord server](https://discord.gg/web3guardian) coming soon
- **Stack Overflow**: Ask questions using the `web3guardian` tag coming soon
- **Email**: Contact [contributors@web3guardian.dev](mailto:contributors@web3guardian.dev) coming soon

## Recognition

Contributors are recognized in:
- GitHub contributors list
- Project documentation
- Release notes
- Annual contributor acknowledgments
- Community forums and discussions
- Community guidelines coming soon

---

Thank you for contributing to Web3 Guardian! Together, we're making Web3 safer for everyone.

*Last updated: August 4, 2025*

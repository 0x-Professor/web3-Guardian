# Contributing to Web3 Guardian

Thank you for your interest in contributing to Web3 Guardian! We welcome contributions from the community to help improve this project.

## Table of Contents

- [Code of Conduct](#code-of-conduct)
- [Getting Started](#getting-started)
- [Development Setup](#development-setup)
- [Making Changes](#making-changes)
- [Pull Request Process](#pull-request-process)
- [Reporting Issues](#reporting-issues)
- [Feature Requests](#feature-requests)
- [Code Style](#code-style)
- [Testing](#testing)
- [Documentation](#documentation)
- [License](#license)

## Code of Conduct

This project and everyone participating in it is governed by our [Code of Conduct](CODE_OF_CONDUCT.md). By participating, you are expected to uphold this code.

## Getting Started

1. Fork the repository on GitHub
2. Clone your forked repository to your local machine
3. Set up the development environment (see below)

## Development Setup

### Prerequisites

- Python 3.13+
- Node.js 18+ (for extension development)
- PostgreSQL 14+
- Redis (for caching)
- Git

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
   pip install -r requirements-dev.txt
   ```

4. Set up environment variables:
   ```bash
   cp .env.example .env
   # Edit .env with your configuration
   ```

5. Initialize the database:
   ```bash
   python scripts/init_db.py
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
   npm run build
   ```

## Making Changes

1. Create a new branch for your feature or bugfix:
   ```bash
   git checkout -b feature/your-feature-name
   # or
   git checkout -b fix/issue-description
   ```

2. Make your changes following the code style guidelines

3. Add tests for your changes

4. Run the test suite:
   ```bash
   # Run backend tests
   cd backend
   pytest

   # Run extension tests
   cd ../extension
   npm test
   ```

5. Commit your changes with a descriptive commit message

## Pull Request Process

1. Push your changes to your fork
2. Open a pull request against the main branch
3. Ensure all CI checks pass
4. Request review from maintainers
5. Address any review comments
6. Once approved, a maintainer will merge your PR

## Reporting Issues

When reporting issues, please include:

- A clear title and description
- Steps to reproduce the issue
- Expected vs actual behavior
- Screenshots if applicable
- Environment details (OS, browser, extension version, etc.)

## Feature Requests

For feature requests:

1. Check if the feature already exists or has been requested
2. Describe the feature and why it would be valuable
3. Include any relevant technical details or implementation ideas

## Code Style

### Python

- Follow [PEP 8](https://www.python.org/dev/peps/pep-0008/)
- Use type hints
- Keep functions small and focused
- Write docstrings for all public functions and classes
- Use absolute imports
- Maximum line length: 88 characters (Black formatter)

### JavaScript/TypeScript

- Follow [Airbnb JavaScript Style Guide](https://github.com/airbnb/javascript)
- Use TypeScript for all new code
- Use ES6+ features
- Write JSDoc comments for all public functions and classes

## Testing

- Write unit tests for all new features
- Ensure test coverage doesn't decrease
- Run all tests before submitting a PR
- Test in multiple environments if possible

## Documentation

- Update documentation when adding new features or changing behavior
- Keep API documentation up to date
- Add examples where helpful

## License

By contributing, you agree that your contributions will be licensed under the [MIT License](LICENSE).

---

Thank you for helping make Web3 Guardian better!

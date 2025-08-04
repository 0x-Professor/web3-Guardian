# Web3 Guardian - Backend

This is the backend service for the Web3 Guardian project, providing smart contract analysis and security insights.

## Prerequisites

- Python 3.13+
- PostgreSQL 14+
- Redis (for caching)
- Docker (optional, for containerized deployment)

## Setup

1. **Clone the repository**
   ```bash
   git clone https://github.com/your-username/web3-guardian.git
   cd web3-guardian/backend
   ```

2. **Create and activate a virtual environment**
   ```bash
   python -m venv venv
   source venv/bin/activate  # On Windows: .\venv\Scripts\activate
   ```

3. **Install dependencies**
   ```bash
   pip install -r requirements.txt
   ```

4. **Set up environment variables**
   - Copy `.env.example` to `.env`
   - Update the values in `.env` with your configuration
   ```bash
   cp .env.example .env
   ```

5. **Set up PostgreSQL**
   - Install PostgreSQL if not already installed
   - Create a new database for the application
   - Update the database connection details in `.env`

## Running the Application

### Development Server

```bash
uvicorn src.main:app --reload --host 0.0.0.0 --port 8000
```

The API will be available at `http://localhost:8000`

### Database Migrations

1. Initialize the database:
   ```bash
   PYTHONPATH=$PWD python scripts/init_db.py
   ```

2. Run database migrations (if using Alembic):
   ```bash
   alembic upgrade head
   ```

### Testing

Run the test suite:
```bash
pytest
```

## API Documentation

Once the server is running, you can access:

- Interactive API docs: `http://localhost:8000/docs`
- Alternative API docs: `http://localhost:8000/redoc`

## Project Structure

```
backend/
├── src/
│   ├── __init__.py
│   ├── main.py              # FastAPI application
│   ├── database/            # Database models and configuration
│   ├── simulation/          # Smart contract simulation
│   ├── analysis/            # Analysis modules
│   └── utils/               # Utility functions
├── alembic/                 # Database migrations
├── tests/                   # Test files
├── scripts/                 # Utility scripts
├── .env.example             # Example environment variables
├── requirements.txt         # Project dependencies
└── README.md               # This file
```

## Environment Variables

See `.env.example` for all available environment variables.

## Deployment

### Docker

Build and run using Docker:

```bash
docker-compose up --build
```

### Production

For production deployment, consider using:
- Gunicorn with Uvicorn workers
- Nginx as a reverse proxy
- Process manager (e.g., systemd, Supervisor)

## License

This project is licensed under the MIT License - see the [LICENSE](LICENSE) file for details.

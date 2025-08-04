# Web3 Guardian Troubleshooting Guide

This guide provides solutions to common issues you might encounter while setting up, developing, or using Web3 Guardian.

## Table of Contents

- [Installation Issues](#installation-issues)
- [Backend Issues](#backend-issues)
- [Extension Issues](#extension-issues)
- [API Issues](#api-issues)
- [Database Issues](#database-issues)
- [Performance Issues](#performance-issues)
- [Security Issues](#security-issues)
- [Development Issues](#development-issues)

## Installation Issues

### Python Version Compatibility

**Problem**: Getting Python version errors during installation.

```bash
ERROR: This package requires Python >=3.13
```

**Solution**:
1. Check your Python version:
   ```bash
   python --version
   ```
2. Install Python 3.13+ from [python.org](https://python.org)
3. Use pyenv for multiple Python versions:
   ```bash
   pyenv install 3.13.0
   pyenv local 3.13.0
   ```

### Node.js Compatibility Issues

**Problem**: Extension build fails with Node.js version errors.

```bash
error: The engine "node" is incompatible with this module
```

**Solution**:
1. Install Node.js 18+:
   ```bash
   # Using nvm
   nvm install 18
   nvm use 18
   
   # Or download from nodejs.org
   ```
2. Clear npm cache:
   ```bash
   npm cache clean --force
   rm -rf node_modules
   npm install
   ```

### Docker Issues

**Problem**: Docker services fail to start.

**Solution**:
1. Check Docker version:
   ```bash
   docker --version
   docker-compose --version
   ```
2. Ensure Docker daemon is running
3. Check for port conflicts:
   ```bash
   docker-compose down
   docker system prune -f
   docker-compose up -d
   ```

## Backend Issues

### FastAPI Server Won't Start

**Problem**: Server fails to start with import errors.

```bash
ModuleNotFoundError: No module named 'src'
```

**Solution**:
1. Activate virtual environment:
   ```bash
   cd backend
   source venv/bin/activate
   ```
2. Install dependencies:
   ```bash
   pip install -r requirements.txt
   ```
3. Set PYTHONPATH:
   ```bash
   export PYTHONPATH="${PYTHONPATH}:$(pwd)"
   ```

### Environment Variables Not Loading

**Problem**: Environment variables are not being recognized.

**Solution**:
1. Check `.env` file exists in the backend directory
2. Verify file format (no spaces around `=`):
   ```bash
   # Correct
   API_KEY=your_key_here
   
   # Incorrect
   API_KEY = your_key_here
   ```
3. Load environment manually:
   ```bash
   source .env
   python main.py
   ```

### Tenderly API Connection Issues

**Problem**: Tenderly API calls are failing.

```bash
TenderlyError: Failed to authenticate with Tenderly API
```

**Solution**:
1. Verify API credentials in `.env`:
   ```bash
   TENDERLY_API_KEY=your_actual_api_key
   TENDERLY_ACCOUNT_SLUG=0xProfessor
   TENDERLY_PROJECT_SLUG=project
   TENDERLY_SECRET_TOKEN=VufhEuJvtT-eKwDw8txlpPbMHVPgbiGC
   ```
2. Test API connection:
   ```bash
   curl -H "X-Access-Key: YOUR_API_KEY" \
        https://api.tenderly.co/api/v1/account/0xProfessor/projects
   ```
3. Check Tenderly dashboard for project settings

### Gemini API Issues

**Problem**: RAG pipeline fails with Gemini API errors.

```bash
google.auth.exceptions.DefaultCredentialsError
```

**Solution**:
1. Verify Gemini API key:
   ```bash
   GEMINI_API_KEY=AIzaSyBOc_PsNyd0SZSwwCe9fk9PEhfPMpJkWQw
   ```
2. Test API access:
   ```python
   import google.generativeai as genai
   genai.configure(api_key="your-api-key")
   model = genai.GenerativeModel('gemini-pro')
   response = model.generate_content("Hello")
   print(response.text)
   ```

## Extension Issues

### Extension Won't Load in Browser

**Problem**: Extension fails to load with manifest errors.

**Solution**:
1. Check manifest.json syntax:
   ```bash
   cd extension
   node -e "console.log(JSON.parse(require('fs').readFileSync('src/manifest.json')))"
   ```
2. Rebuild extension:
   ```bash
   npm run build:dev
   ```
3. Load unpacked extension from `dist/` folder

### Content Script Not Injecting

**Problem**: Extension doesn't detect Web3 transactions.

**Solution**:
1. Check console for errors in developer tools
2. Verify content script permissions in manifest.json:
   ```json
   {
     "content_scripts": [{
       "matches": ["<all_urls>"],
       "js": ["content/content.js"]
     }]
   }
   ```
3. Test on a known Web3 site (e.g., Uniswap)

### Background Script Issues

**Problem**: Background service worker crashes.

**Solution**:
1. Check service worker errors in `chrome://extensions/`
2. Verify background script registration:
   ```json
   {
     "background": {
       "service_worker": "background/background.js"
     }
   }
   ```
3. Add error handling:
   ```javascript
   chrome.runtime.onStartup.addListener(() => {
     console.log('Background script started');
   });
   ```

## API Issues

### Rate Limiting Errors

**Problem**: Getting 429 Too Many Requests errors.

```json
{
  "error": "Rate limit exceeded",
  "retry_after": 60
}
```

**Solution**:
1. Implement exponential backoff:
   ```javascript
   async function makeRequestWithRetry(url, options, maxRetries = 3) {
     for (let i = 0; i < maxRetries; i++) {
       try {
         const response = await fetch(url, options);
         if (response.status === 429) {
           const retryAfter = response.headers.get('Retry-After') || Math.pow(2, i);
           await new Promise(resolve => setTimeout(resolve, retryAfter * 1000));
           continue;
         }
         return response;
       } catch (error) {
         if (i === maxRetries - 1) throw error;
       }
     }
   }
   ```
2. Check rate limit configuration in backend

### CORS Issues

**Problem**: Cross-origin request blocked.

```
Access to fetch at 'http://localhost:8000/api/analyze/contract' from origin 'chrome-extension://...' has been blocked by CORS policy
```

**Solution**:
1. Update CORS settings in backend:
   ```python
   app.add_middleware(
       CORSMiddleware,
       allow_origins=["chrome-extension://*", "moz-extension://*"],
       allow_credentials=True,
       allow_methods=["*"],
       allow_headers=["*"],
   )
   ```
2. Add extension ID to allowed origins

### Authentication Errors

**Problem**: API requests fail with authentication errors.

**Solution**:
1. Check API key format
2. Verify headers:
   ```javascript
   const response = await fetch('/api/analyze/contract', {
     method: 'POST',
     headers: {
       'Content-Type': 'application/json',
       'Authorization': 'Bearer your-token'
     },
     body: JSON.stringify(data)
   });
   ```

## Database Issues

### PostgreSQL Connection Failed

**Problem**: Cannot connect to PostgreSQL database.

```bash
psycopg2.OperationalError: could not connect to server
```

**Solution**:
1. Check PostgreSQL is running:
   ```bash
   # macOS
   brew services start postgresql
   
   # Ubuntu
   sudo systemctl start postgresql
   
   # Windows
   net start postgresql-x64-14
   ```
2. Verify connection string:
   ```bash
   DATABASE_URL=postgresql://username:password@localhost:5432/web3guardian
   ```
3. Create database if it doesn't exist:
   ```bash
   createdb web3guardian
   ```

### Migration Issues

**Problem**: Alembic migrations fail.

```bash
sqlalchemy.exc.ProgrammingError: relation "contract_analysis" does not exist
```

**Solution**:
1. Reset migrations:
   ```bash
   alembic downgrade base
   alembic upgrade head
   ```
2. Generate new migration:
   ```bash
   alembic revision --autogenerate -m "Initial migration"
   alembic upgrade head
   ```

### Redis Connection Issues

**Problem**: Cannot connect to Redis server.

```bash
redis.exceptions.ConnectionError: Error connecting to Redis
```

**Solution**:
1. Start Redis server:
   ```bash
   # macOS
   brew services start redis
   
   # Ubuntu
   sudo systemctl start redis
   
   # Windows
   redis-server
   ```
2. Test connection:
   ```bash
   redis-cli ping
   ```
3. Check Redis URL:
   ```bash
   REDIS_URL=redis://localhost:6379/0
   ```

## Performance Issues

### Slow API Responses

**Problem**: API endpoints are responding slowly.

**Solution**:
1. Enable Redis caching:
   ```bash
   REDIS_CACHE_TTL=3600
   ENABLE_CACHING=True
   ```
2. Monitor database queries:
   ```bash
   # Enable query debugging
   DB_ECHO=True
   ```
3. Add database indexes:
   ```sql
   CREATE INDEX idx_contract_address ON contract_analysis(contract_address);
   ```

### High Memory Usage

**Problem**: Backend consuming too much memory.

**Solution**:
1. Limit database connection pool:
   ```bash
   DB_POOL_SIZE=5
   DB_MAX_OVERFLOW=10
   ```
2. Configure worker processes:
   ```bash
   gunicorn main:app -w 2 --max-requests 1000 --max-requests-jitter 100
   ```
3. Monitor memory usage:
   ```bash
   pip install memory-profiler
   python -m memory_profiler main.py
   ```

### Extension Performance

**Problem**: Extension causing browser slowdown.

**Solution**:
1. Optimize content script:
   ```javascript
   // Use debouncing for frequent operations
   const debounce = (func, wait) => {
     let timeout;
     return function executedFunction(...args) {
       const later = () => {
         clearTimeout(timeout);
         func(...args);
       };
       clearTimeout(timeout);
       timeout = setTimeout(later, wait);
     };
   };
   ```
2. Reduce API calls with caching
3. Use web workers for heavy computations

## Security Issues

### SSL/TLS Certificate Errors

**Problem**: HTTPS certificate issues in production.

**Solution**:
1. Use Let's Encrypt certificates:
   ```bash
   certbot --nginx -d api.web3guardian.dev
   ```
2. Update nginx configuration:
   ```nginx
   server {
       listen 443 ssl;
       ssl_certificate /path/to/cert.pem;
       ssl_certificate_key /path/to/key.pem;
   }
   ```

### API Security Headers Missing

**Problem**: Security headers not present in API responses.

**Solution**:
1. Add security middleware:
   ```python
   from fastapi.middleware.trustedhost import TrustedHostMiddleware
   from fastapi.middleware.httpsredirect import HTTPSRedirectMiddleware
   
   app.add_middleware(HTTPSRedirectMiddleware)
   app.add_middleware(TrustedHostMiddleware, allowed_hosts=["api.web3guardian.dev"])
   ```

## Development Issues

### Hot Reload Not Working

**Problem**: Changes not reflected during development.

**Solution**:
1. For backend:
   ```bash
   uvicorn main:app --reload --host 0.0.0.0 --port 8000
   ```
2. For extension:
   ```bash
   npm run build:dev -- --watch
   ```
3. Clear browser cache and reload extension

### Import Path Issues

**Problem**: Python imports not resolving correctly.

**Solution**:
1. Use absolute imports:
   ```python
   from src.utils.config import settings
   ```
2. Add to PYTHONPATH:
   ```bash
   export PYTHONPATH="${PYTHONPATH}:$(pwd)"
   ```
3. Use relative imports within packages:
   ```python
   from .config import settings
   ```

### Testing Issues

**Problem**: Tests failing with import errors.

**Solution**:
1. Install test dependencies:
   ```bash
   pip install -r requirements-dev.txt
   ```
2. Set up test environment:
   ```bash
   export TESTING=True
   export DATABASE_URL=postgresql://test:test@localhost/test_web3guardian
   ```
3. Run tests with proper path:
   ```bash
   python -m pytest tests/
   ```

## Getting Additional Help

### Log Analysis

1. **Backend logs**:
   ```bash
   tail -f logs/web3guardian.log
   ```

2. **Extension logs**:
   - Open Chrome DevTools
   - Go to Extensions tab
   - Click "Inspect views: service worker"

3. **Database logs**:
   ```bash
   # PostgreSQL
   tail -f /var/log/postgresql/postgresql-14-main.log
   ```

### Debug Mode

Enable debug mode for more detailed information:

```bash
# Backend
DEBUG=True
LOG_LEVEL=DEBUG

# Extension
npm run build:dev
```

### Health Checks

Use built-in health check endpoints:

```bash
# Backend health
curl http://localhost:8000/health

# Database connectivity
python scripts/check_db.py

# Redis connectivity
redis-cli ping
```

### Performance Monitoring

1. **API response times**:
   ```bash
   curl -w "@curl-format.txt" -o /dev/null -s "http://localhost:8000/api/analyze/contract"
   ```

2. **Memory usage**:
   ```bash
   ps aux | grep python
   ```

3. **Database performance**:
   ```sql
   SELECT query, mean_time, calls 
   FROM pg_stat_statements 
   ORDER BY mean_time DESC 
   LIMIT 10;
   ```

## Support Channels

If you can't resolve your issue using this guide:

1. **GitHub Issues**: [Create an issue](https://github.com/web3guardian/web3-guardian/issues)
2. **Discord Community**: [Join our Discord](https://discord.gg/web3guardian)
3. **Email Support**: [support@web3guardian.dev](mailto:support@web3guardian.dev)
4. **Documentation**: [docs.web3guardian.dev](https://docs.web3guardian.dev)

When reporting issues, please include:
- Operating system and version
- Python/Node.js versions
- Full error messages and stack traces
- Steps to reproduce the issue
- Relevant configuration (without sensitive data)

---

*Last updated: August 4, 2025*

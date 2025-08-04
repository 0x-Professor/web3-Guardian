# Troubleshooting Guide

This guide provides solutions to common issues you might encounter while using or developing Web3 Guardian.

## Table of Contents
- [Installation Issues](#installation-issues)
- [Runtime Errors](#runtime-errors)
- [Extension Problems](#extension-problems)
- [Database Issues](#database-issues)
- [API and Network Problems](#api-and-network-problems)
- [Performance Issues](#performance-issues)
- [Getting Help](#getting-help)

## Installation Issues

### Python Dependencies Fail to Install
**Symptom**: `pip install -r requirements.txt` fails

**Solution**:
1. Ensure you're using Python 3.13 or later:
   ```bash
   python --version
   ```
2. Try upgrading pip:
   ```bash
   pip install --upgrade pip
   ```
3. Install system dependencies:
   - Ubuntu/Debian: `sudo apt-get install python3-dev libpq-dev`
   - macOS: `brew install postgresql`
   - Windows: Install [PostgreSQL for Windows](https://www.postgresql.org/download/windows/)

### Node.js Dependencies Fail to Install
**Symptom**: `npm install` fails

**Solution**:
1. Ensure you're using Node.js 18 or later:
   ```bash
   node --version
   ```
2. Clear npm cache:
   ```bash
   npm cache clean --force
   ```
3. Delete `node_modules` and `package-lock.json`, then reinstall:
   ```bash
   rm -rf node_modules package-lock.json
   npm install
   ```

## Runtime Errors

### Module Not Found Error
**Symptom**: `ModuleNotFoundError: No module named '...'`

**Solution**:
1. Ensure your virtual environment is activated
2. Reinstall requirements:
   ```bash
   pip install -r requirements.txt
   ```

### Database Connection Issues
**Symptom**: `sqlalchemy.exc.OperationalError` or similar database errors

**Solution**:
1. Verify PostgreSQL is running:
   ```bash
   # On Linux/macOS
   pg_isready
   
   # On Windows (if using default installation)
   "C:\Program Files\PostgreSQL\14\bin\pg_isready.exe"
   ```
2. Check your `.env` file for correct database credentials
3. Ensure the database exists and is accessible:
   ```bash
   psql -U your_username -d your_database_name -c "SELECT 1"
   ```

## Extension Problems

### Extension Not Loading in Browser
**Symptom**: The extension doesn't appear in the browser or shows an error

**Solution**:
1. In Chrome, go to `chrome://extensions/`
2. Enable "Developer mode" (toggle in top-right)
3. Click "Load unpacked" and select the `extension/dist` directory
4. If you see errors, click "Inspect views background page" to check the console

### Transaction Not Detected
**Symptom**: The extension doesn't detect transactions on dApps

**Solution**:
1. Ensure the extension is enabled
2. Refresh the dApp page after enabling the extension
3. Check the browser console for errors (F12 → Console)
4. Verify the dApp's network is supported by Web3 Guardian

## Database Issues

### Migration Errors
**Symptom**: `alembic.util.exc.CommandError: Can't locate revision identified by '...'`

**Solution**:
1. Delete the `alembic/versions` directory
2. Run:
   ```bash
   alembic revision --autogenerate -m "Initial migration"
   alembic upgrade head
   ```

### Database Schema Out of Sync
**Symptom**: SQLAlchemy errors about missing columns or tables

**Solution**:
1. Ensure all migrations are applied:
   ```bash
   alembic upgrade head
   ```
2. If issues persist, reset the database:
   ```bash
   dropdb your_database_name
   createdb your_database_name
   alembic upgrade head
   ```

## API and Network Problems

### Tenderly API Errors
**Symptom**: Errors when interacting with Tenderly API

**Solution**:
1. Verify your Tenderly API key in `.env`
2. Check your Tenderly project settings
3. Ensure your account has sufficient permissions
4. Check [Tenderly's status page](https://status.tenderly.co/)

### Rate Limiting
**Symptom**: `429 Too Many Requests` errors

**Solution**:
1. Implement proper rate limiting in your code
2. Add delays between API calls
3. Consider using a queue system for background processing

## Performance Issues

### Slow Transaction Analysis
**Symptom**: The extension is slow to analyze transactions

**Solution**:
1. Check server logs for slow database queries
2. Optimize database indexes
3. Implement caching for frequent requests
4. Consider using a CDN for static assets

### High Memory Usage
**Symptom**: The extension or backend uses too much memory

**Solution**:
1. Check for memory leaks in your code
2. Implement pagination for large datasets
3. Use streaming responses where possible
4. Monitor with tools like `htop` or Chrome DevTools

## Getting Help

If you've tried the solutions above and are still experiencing issues:

1. Check the [GitHub Issues](https://github.com/yourusername/web3-guardian/issues) to see if your issue has already been reported
2. Search the [Discussions](https://github.com/yourusername/web3-guardian/discussions) for similar problems
3. If you're sure it's a new issue, please open a new GitHub issue with:
   - A clear description of the problem
   - Steps to reproduce the issue
   - Expected vs actual behavior
   - Screenshots or error messages
   - Your environment details (OS, browser version, etc.)

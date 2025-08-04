# Security Policy

## Supported Versions

We provide security updates for the following versions of Web3 Guardian:

| Version | Supported          |
| ------- | ------------------ |
| 1.0.x   | :white_check_mark: |
| < 1.0   | :x:                |

## Reporting a Vulnerability

We take security issues very seriously. If you discover a security vulnerability in Web3 Guardian, we appreciate your efforts to disclose it to us in a responsible manner.

### How to Report

Please report security vulnerabilities by emailing our security team at [security@web3guardian.dev](mailto:security@web3guardian.dev).

In your report, please include:
- A description of the vulnerability
- Steps to reproduce the issue
- Any proof-of-concept code or exploit details
- Your contact information (optional)

### Response Time

We will acknowledge receipt of your report within 48 hours and will provide a more detailed response within 7 days, including:
- Confirmation of the vulnerability
- The severity level of the vulnerability
- An estimated timeline for resolution

### Bug Bounty

We currently do not have a formal bug bounty program, but we may offer rewards for significant security issues at our discretion.

## Security Best Practices

### For Users

1. Always verify the authenticity of the extension before installing
2. Keep your browser and operating system up to date
3. Use a hardware wallet for large transactions
4. Never share your private keys or seed phrases

### For Developers

1. Follow secure coding practices
2. Keep all dependencies up to date
3. Use environment variables for sensitive information
4. Implement proper input validation and sanitization
5. Use prepared statements for database queries

## Security Features

### Built-in Protections

- **Transaction Simulation**: All transactions are simulated before execution
- **Rate Limiting**: API endpoints are rate-limited to prevent abuse
- **Input Validation**: All user inputs are strictly validated
- **Secure Storage**: Sensitive data is encrypted at rest
- **CSP Headers**: Content Security Policy headers are enforced

### Third-party Audits

We conduct regular security audits of our codebase. The results of these audits are published in our [audits directory](/audits/).

## Security Updates

Security updates are released as patch versions (e.g., 1.0.0 → 1.0.1). We recommend always running the latest version of Web3 Guardian.

## Contact

For security-related inquiries, please contact [security@web3guardian.dev](mailto:security@web3guardian.dev).

---

*Last updated: August 4, 2025*

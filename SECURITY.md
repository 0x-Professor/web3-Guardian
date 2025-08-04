# Security Policy

## Overview

Web3 Guardian is committed to maintaining the highest security standards to protect our users and their digital assets. This document outlines our security policies, practices, and procedures for reporting vulnerabilities.

## Supported Versions

We provide security updates for the following versions of Web3 Guardian:

| Version | Supported          | End of Support |
| ------- | ------------------ | -------------- |
| 1.0.x   | :white_check_mark: | TBD            |
| 0.9.x   | :white_check_mark: | 2025-12-31     |
| < 0.9   | :x:                | Discontinued   |

### Update Policy
- **Critical Security Issues**: Patched within 24-48 hours
- **High Severity Issues**: Patched within 1 week
- **Medium/Low Severity Issues**: Included in next scheduled release

## Reporting a Vulnerability

We take security issues very seriously. If you discover a security vulnerability in Web3 Guardian, we appreciate your efforts to disclose it to us in a responsible manner.

### How to Report

**For Security Vulnerabilities:**
- Email: [security@web3guardian.dev](mailto:security@web3guardian.dev)
- PGP Key: Available at [https://web3guardian.dev/pgp-key.asc](https://web3guardian.dev/pgp-key.asc)
- Signal: +1-XXX-XXX-XXXX (for critical issues)

**For General Security Concerns:**
- GitHub Security Advisories (preferred for non-critical issues)
- Discord: @security-team (for questions about security practices)

### What to Include in Your Report

Please include the following information in your vulnerability report:

1. **Vulnerability Details**
   - Type of vulnerability (e.g., XSS, SQL injection, authorization bypass)
   - Affected components (backend API, browser extension, etc.)
   - Severity assessment (Critical/High/Medium/Low)

2. **Technical Information**
   - Steps to reproduce the issue
   - Proof-of-concept code or exploit
   - Screenshots or videos demonstrating the vulnerability
   - Environment details (OS, browser version, extension version)

3. **Impact Assessment**
   - Potential consequences of exploitation
   - Affected user data or functionality
   - Risk to user funds or privacy

4. **Suggested Remediation**
   - Recommended fixes or mitigations
   - Alternative approaches if applicable

### Response Timeline

We commit to the following response times:

| Severity | Initial Response | Status Update | Resolution Target |
|----------|------------------|---------------|-------------------|
| Critical | 2 hours          | Daily         | 24-48 hours       |
| High     | 24 hours         | Every 2 days  | 1 week            |
| Medium   | 48 hours         | Weekly        | 2 weeks           |
| Low      | 1 week           | Bi-weekly     | Next release      |

### Response Process

1. **Acknowledgment** (Within response time above)
   - Confirm receipt of your report
   - Assign a tracking ID
   - Initial severity assessment

2. **Investigation** (Ongoing)
   - Validate the vulnerability
   - Assess impact and scope
   - Develop remediation plan
   - Regular status updates

3. **Resolution**
   - Implement and test fix
   - Security review of the patch
   - Coordinate disclosure timeline
   - Release security update

4. **Disclosure**
   - Public disclosure after fix is deployed
   - Credit to the reporter (if desired)
   - Post-mortem analysis (for critical issues)

## Bug Bounty Program

We operate a responsible disclosure bug bounty program with the following reward structure:

### Reward Guidelines

| Severity | Reward Range     | Examples |
|----------|------------------|----------|
| Critical | $2,000 - $10,000 | RCE, fund theft, private key exposure |
| High     | $500 - $2,000    | Authentication bypass, sensitive data exposure |
| Medium   | $100 - $500      | XSS, CSRF, information disclosure |
| Low      | $25 - $100       | Minor information leaks, low-impact issues |

### Scope

**In Scope:**
- Web3 Guardian browser extension
- Backend API (api.web3guardian.dev)
- Web application (web3guardian.dev)
- Mobile applications (when available)
- Third-party integrations and dependencies

**Out of Scope:**
- Social engineering attacks
- Physical attacks
- Denial of Service (DoS) attacks
- Issues in third-party services we don't control
- Self-XSS
- Issues requiring physical access to devices

### Eligibility Requirements

To be eligible for rewards, you must:
- Be the first to report the vulnerability
- Provide a clear reproduction path
- Not access or modify user data
- Not disrupt our services
- Follow responsible disclosure practices
- Not violate any laws or regulations

## Security Best Practices

### For Users

#### Browser Extension Security
1. **Verify Installation Source**
   - Only install from official Chrome Web Store or Firefox Add-ons
   - Verify the publisher is "Web3 Guardian Team"
   - Check extension permissions before installation

2. **Keep Software Updated**
   - Enable automatic updates for the extension
   - Update your browser regularly
   - Keep your operating system current

3. **Safe Usage Practices**
   - Review transaction details carefully before approval
   - Don't ignore security warnings from the extension
   - Use hardware wallets for large transactions
   - Regularly review connected dApps and permissions

4. **Account Security**
   - Use strong, unique passwords
   - Enable two-factor authentication where available
   - Never share private keys or seed phrases
   - Store recovery phrases securely offline

### For Developers

#### Code Security
// Configuration and constants for the Web3 Guardian extension

// API Endpoints
const API_ENDPOINTS = {
  ANALYZE: '/api/analyze',
  SIMULATE: '/api/simulate',
  GAS_PRICES: '/api/gas/prices',
  TOKEN_INFO: '/api/tokens',
  CONTRACT_INFO: '/api/contracts',
  SECURITY_ALERTS: '/api/security/alerts',
  REPORT: '/api/security/report',
  HEALTH: '/health',
};

// Risk levels and their display properties
const RISK_LEVELS = {
  LOW: {
    level: 'low',
    color: '#10B981', // Green
    label: 'Low Risk',
    description: 'This transaction appears to be safe',
  },
  MEDIUM: {
    level: 'medium',
    color: '#F59E0B', // Yellow
    label: 'Medium Risk',
    description: 'Proceed with caution',
  },
  HIGH: {
    level: 'high',
    color: '#EF4444', // Red
    label: 'High Risk',
    description: 'This transaction may be unsafe',
  },
  CRITICAL: {
    level: 'critical',
    color: '#B91C1C', // Dark Red
    label: 'Critical Risk',
    description: 'This transaction is likely malicious',
  },
  UNKNOWN: {
    level: 'unknown',
    color: '#6B7280', // Gray
    label: 'Unknown',
    description: 'Unable to determine risk level',
  },
};

// Common error messages
const ERROR_MESSAGES = {
  NETWORK_ERROR: 'Network error. Please check your connection.',
  INVALID_RESPONSE: 'Received an invalid response from the server.',
  UNAUTHORIZED: 'Authentication required. Please log in again.',
  RATE_LIMITED: 'Too many requests. Please try again later.',
  UNKNOWN_ERROR: 'An unknown error occurred.',
  TRANSACTION_FAILED: 'Transaction simulation failed.',
  INSUFFICIENT_FUNDS: 'Insufficient funds for this transaction.',
  INVALID_INPUT: 'Invalid input provided.',
};

// Transaction types
const TRANSACTION_TYPES = {
  TOKEN_TRANSFER: 'TOKEN_TRANSFER',
  CONTRACT_INTERACTION: 'CONTRACT_INTERACTION',
  APPROVAL: 'APPROVAL',
  SWAP: 'SWAP',
  STAKE: 'STAKE',
  UNSTAKE: 'UNSTAKE',  
  CLAIM: 'CLAIM',
  DEPLOY: 'DEPLOY',
};

// Common token addresses (Ethereum mainnet)
const TOKEN_ADDRESSES = {
  ETH: '0x0000000000000000000000000000000000000000',
  WETH: '0xC02aaA39b223FE8D0A0e5C4F27eAD9083C756Cc2',
  DAI: '0x6B175474E89094C44Da98b954EedeAC495271d0F',
  USDC: '0xA0b86991c6218b36c1d19D4a2e9Eb0cE3606eB48',
  USDT: '0xdAC17F958D2ee523a2206206994597C13D831ec7',
};

// Default gas limits for common operations (in wei)
const DEFAULT_GAS_LIMITS = {
  SIMPLE_ETH_TRANSFER: 21000,
  TOKEN_TRANSFER: 60000,
  APPROVAL: 45000,
  SWAP: 200000,
  COMPLEX_CONTRACT_INTERACTION: 500000,
};

// Cache configuration
const CACHE_CONFIG = {
  TTL: 5 * 60 * 1000, // 5 minutes
  MAX_ITEMS: 100,
  PREFIX: 'web3guard_',
};

// Extension settings defaults
const DEFAULT_SETTINGS = {
  autoApproveLowRisk: true,
  showNotifications: true,
  rpcUrl: '', // Will use default provider if not set
  theme: 'system', // 'light', 'dark', or 'system'
  gasPriceMultiplier: 1.1, // 10% higher than estimated
  customRpcUrls: {},
  whitelistedDapps: [],
  blacklistedAddresses: [],
};

// Message types for extension communication
const MESSAGE_TYPES = {
  // Background script messages
  ANALYZE_TRANSACTION: 'ANALYZE_TRANSACTION',
  WEB3_TRANSACTION: 'WEB3_TRANSACTION',
  TRANSACTION_RESPONSE: 'TRANSACTION_RESPONSE',
  
  // Popup messages
  GET_SETTINGS: 'GET_SETTINGS',
  SAVE_SETTINGS: 'SAVE_SETTINGS',
  GET_TRANSACTION_HISTORY: 'GET_TRANSACTION_HISTORY',
  
  // Content script messages
  INJECT_PROVIDER: 'INJECT_PROVIDER',
  DETECT_PROVIDER: 'DETECT_PROVIDER',
};

export {
  API_ENDPOINTS,
  RISK_LEVELS,
  ERROR_MESSAGES,
  TRANSACTION_TYPES,
  TOKEN_ADDRESSES,
  DEFAULT_GAS_LIMITS,
  CACHE_CONFIG,
  DEFAULT_SETTINGS,
  MESSAGE_TYPES,
};

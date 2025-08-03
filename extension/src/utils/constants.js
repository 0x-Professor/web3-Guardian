// API Keys and Constants

export const ETHERSCAN_KEY = 'YOUR_ETHERSCAN_API_KEY';
export const INFURA_KEY = 'YOUR_INFURA_PROJECT_ID';

export const CONTRACT_ABI = [
  // Common ERC20/ERC721 ABI fragments
  'function name() view returns (string)',
  'function symbol() view returns (string)',
  'function decimals() view returns (uint8)',
  'function totalSupply() view returns (uint256)',
  'function balanceOf(address owner) view returns (uint256)',
  'function transfer(address to, uint256 value) returns (bool)',
  'function approve(address spender, uint256 value) returns (bool)',
  'function transferFrom(address from, address to, uint256 value) returns (bool)',
  'function allowance(address owner, address spender) view returns (uint256)'
];

export const BLACKLISTED_CONTRACTS = [
  // Add known malicious contract addresses here
];

export const KNOWN_PHISHING_SITES = [
  // Add known phishing domains here
];

export const DEFAULT_GAS_LIMITS = {
  ETH_TRANSFER: 21000,
  ERC20_TRANSFER: 65000,
  APPROVE: 45000,
  SWAP: 200000,
  COMPLEX: 500000
};

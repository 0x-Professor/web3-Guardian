import { logInfo, logError, logDebug } from "../utils/logger.js";

// Content script state
let isInitialized = false;
let originalProvider = null;
let providerProxy = null;
let interceptedRequests = new Map();
let connectedAccounts = [];
let currentChainId = null;

console.log('🛡️ Web3 Guardian content script loaded on', window.location.href);

// Modern popup implementation with improved UX and error handling
let currentTransaction = null;

// Performance utilities
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

const throttle = (func, limit) => {
  let inThrottle;
  return function() {
    const args = arguments;
    const context = this;
    if (!inThrottle) {
      func.apply(context, args);
      inThrottle = true;
      setTimeout(() => inThrottle = false, limit);
    }
  }
};

// Comprehensive Web3 provider detection and interception
function detectAndInterceptWeb3Provider() {
  // Check for existing provider
  if (window.ethereum) {
    return Promise.resolve(window.ethereum);
  }
  
  // Listen for provider injection (MetaMask, WalletConnect, etc.)
  return new Promise((resolve, reject) => {
    const timeout = setTimeout(() => {
      reject(new Error('No Web3 provider detected within timeout'));
    }, 5000);
    
    const checkProvider = () => {
      if (window.ethereum) {
        clearTimeout(timeout);
        resolve(window.ethereum);
      }
    };
    
    // Multiple detection strategies
    checkProvider();
    const interval = setInterval(checkProvider, 100);
    
    // Listen for various provider injection events
    const events = [
      'ethereum#initialized',
      'eip6963:announceProvider',
      'web3:connected',
      'metamask:init'
    ];
    
    events.forEach(eventName => {
      window.addEventListener(eventName, () => {
        clearTimeout(timeout);
        clearInterval(interval);
        resolve(window.ethereum);
      });
    });
    
    // EIP-6963 provider detection
    window.addEventListener('eip6963:announceProvider', (event) => {
      if (event.detail?.provider) {
        clearTimeout(timeout);
        clearInterval(interval);
        resolve(event.detail.provider);
      }
    });
    
    document.addEventListener('DOMContentLoaded', checkProvider);
  });
}

// Create comprehensive provider proxy
function createProviderProxy(originalProvider) {
  const handler = {
    get(target, prop) {
      const value = target[prop];
      
      // Intercept the request method (EIP-1193)
      if (prop === 'request') {
        return async function(args) {
          return await handleProviderRequest.call(target, args);
        };
      }
      
      // Intercept legacy methods
      if (prop === 'send' || prop === 'sendAsync') {
        return function(...args) {
          return handleLegacyProviderCall.call(target, prop, args);
        };
      }
      
      // Intercept enable method (legacy MetaMask)
      if (prop === 'enable') {
        return async function() {
          return await handleWalletConnection.call(target);
        };
      }
      
      // Bind functions to original context
      if (typeof value === 'function') {
        return value.bind(target);
      }  
      
      return value;
    },
    
    set(target, prop, value) {
      // Allow setting but don't override our intercepted methods
      if (['request', 'send', 'sendAsync', 'enable'].includes(prop)) {
        logDebug(`Prevented override of ${prop} method by dApp`);
        return true;
      }
      target[prop] = value;
      return true;
    }
  };
  
  return new Proxy(originalProvider, handler);
}

// Handle all provider requests with comprehensive interception
async function handleProviderRequest(args) {
  const { method: rpcMethod, params } = args;
  const requestId = generateRequestId();
  
  logDebug(`🔍 Intercepted request: ${rpcMethod}`, { params, requestId });
  
  try {
    // Store request for tracking
    interceptedRequests.set(requestId, {
      method: rpcMethod,
      params,
      timestamp: Date.now(),
      url: window.location.href
    });
    
    // Handle wallet connection requests
    if (rpcMethod === 'eth_requestAccounts' || rpcMethod === 'wallet_requestPermissions') {
      return await handleWalletConnection.call(this, args);
    }
    
    // Handle account access requests
    if (rpcMethod === 'eth_accounts') {
      const result = await this.request.call(this, args);
      await notifyAccountAccess(result);
      return result;
    }
    
    // Handle chain/network requests
    if (rpcMethod === 'eth_chainId' || rpcMethod === 'net_version') {
      const result = await this.request.call(this, args);
      currentChainId = result;
      return result;
    }
    
    // Handle transaction requests
    if (rpcMethod === 'eth_sendTransaction' || rpcMethod === 'eth_signTransaction') {
      return await handleTransactionRequest.call(this, args, requestId);
    }
    
    // Handle contract interaction requests
    if (rpcMethod === 'eth_call' || rpcMethod === 'eth_estimateGas') {
      return await handleContractInteraction.call(this, args, requestId);
    }
    
    // Handle signing requests
    if (rpcMethod.includes('sign') || rpcMethod.includes('Sign')) {
      return await handleSigningRequest.call(this, args, requestId);
    }
    
    // Pass through all other requests but log them
    logDebug(`Passing through request: ${rpcMethod}`);
    return await this.request.call(this, args);
    
  } catch (error) {
    logError(`Error handling request ${rpcMethod}:`, error);
    throw error;
  } finally {
    // Clean up old requests periodically
    setTimeout(() => interceptedRequests.delete(requestId), 300000); // 5 minutes
  }
}

// Handle wallet connection with comprehensive analysis
async function handleWalletConnection(args = {}) {
  try {
    logInfo('🔗 Wallet connection request intercepted - AUTO-APPROVING');
    
    // Get dApp information
    const dAppInfo = await analyzeDApp();
    
    // Send connection request to background for analysis (non-blocking)
    sendMessageToBackground({
      type: 'ANALYZE_WALLET_CONNECTION', 
      data: {
        dAppInfo,
        requestedPermissions: args.params || [],
        timestamp: Date.now()
      }
    }).catch(err => logError('Background analysis failed:', err));
    
    // AUTO-APPROVE: Proceed with actual connection immediately
    const result = await this.request.call(this, args.method ? args : { method: 'eth_requestAccounts' });
    
    // Update connected accounts
    connectedAccounts = result || [];
    
    // Notify background of successful connection (non-blocking)
    sendMessageToBackground({
      type: 'WALLET_CONNECTED',
      data: {
        accounts: connectedAccounts,
        dAppInfo,
        chainId: currentChainId
      }
    }).catch(err => logError('Failed to notify wallet connection:', err));
    
    logInfo('✅ Wallet connection AUTO-APPROVED and established');
    return result;
    
  } catch (error) {
    logError('❌ Wallet connection failed:', error);
    throw error;
  }
}

// Handle transaction requests with full analysis
async function handleTransactionRequest(args, requestId) {
  const transaction = args.params[0];
  
  try {
    logInfo('💰 Transaction request intercepted:', transaction);
    
    // Enrich transaction data
    const enrichedTransaction = await enrichTransactionData(transaction);
    
    // Send to background for comprehensive analysis
    const analysisResult = await sendMessageToBackground({
      type: 'ANALYZE_TRANSACTION',
      data: {
        ...enrichedTransaction,
        requestId,
        method: args.method,
        origin: window.location.origin
      }
    }, 15000); // Longer timeout for analysis
    
    if (!analysisResult.success) {
      logError('Transaction analysis failed:', analysisResult.error);
    }
    
    // Request user approval with analysis results
    const userApproved = await requestTransactionApproval({
      ...enrichedTransaction,
      ...analysisResult,
      type: 'transaction'
    });
    
    if (!userApproved) {
      throw new Error('Transaction rejected by Web3 Guardian');
    }
    
    // Proceed with transaction
    logInfo('✅ Transaction approved, proceeding...');
    return await this.request.call(this, args);
    
  } catch (error) {
    logError('❌ Transaction request failed:', error);
    throw error;
  }
}

// Handle contract interaction analysis with enhanced RAG pipeline
async function handleContractInteraction(args, requestId) {
  try {
    const contractData = {
      method: args.method,
      params: args.params,
      to: args.params[0]?.to,
      data: args.params[0]?.data
    };
    
    // Analyze contract interaction using enhanced RAG pipeline
    if (contractData.to && contractData.data) {
      logInfo('🔍 Analyzing contract interaction with RAG pipeline:', contractData.to);
      
      // Use the enhanced contract analysis API
      const analysisPromise = sendMessageToBackground({
        type: 'ANALYZE_CONTRACT_ENHANCED',
        data: {
          contract_address: contractData.to,
          network: getNetworkNameFromChainId(currentChainId) || 'mainnet',
          interaction_data: contractData.data,
          method: contractData.method,
          requestId,
          url: window.location.href,
          timestamp: Date.now()
        }
      }, 30000); // Longer timeout for RAG analysis
      
      // Don't block the original request, but log results when available
      analysisPromise
        .then(analysisResult => {
          if (analysisResult.success && analysisResult.data) {
            logInfo('✅ Contract analysis completed:', {
              address: contractData.to,
              securityScore: analysisResult.data.security_score,
              vulnerabilities: analysisResult.data.vulnerabilities?.length || 0,
              optimizations: analysisResult.data.optimizations?.length || 0
            });
            
            // Show user notification if high-risk issues found
            if (analysisResult.data.security_score < 6.0 || 
                (analysisResult.data.vulnerabilities?.length > 0)) {
              showSecurityWarning(analysisResult.data);
            }
          }
        })
        .catch(err => logError('Contract analysis failed:', err));
    }
    
    // Proceed with original request immediately
    return await this.request.call(this, args);
    
  } catch (error) {
    logError('Contract interaction analysis failed:', error);
    // Don't block the request on analysis failure
    return await this.request.call(this, args);
  }
}

// Show security warning for high-risk contracts
function showSecurityWarning(analysisData) {
  // Create a non-intrusive warning notification
  const warningDiv = document.createElement('div');
  warningDiv.id = 'web3-guardian-warning';
  warningDiv.style.cssText = `
    position: fixed;
    top: 20px;
    right: 20px;
    background: linear-gradient(135deg, #ff6b6b, #ff8e8e);
    color: white;
    padding: 16px 20px;
    border-radius: 12px;
    box-shadow: 0 8px 32px rgba(255, 107, 107, 0.3);
    z-index: 10000;
    font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', system-ui, sans-serif;
    font-size: 14px;
    max-width: 350px;
    backdrop-filter: blur(10px);
    border: 1px solid rgba(255, 255, 255, 0.2);
    animation: slideIn 0.3s ease-out;
  `;
  
  const vulnerabilityCount = analysisData.vulnerabilities?.length || 0;
  const securityScore = analysisData.security_score || 0;
  
  warningDiv.innerHTML = `
    <div style="display: flex; align-items: center; margin-bottom: 8px;">
      <span style="font-size: 20px; margin-right: 8px;">🛡️</span>
      <strong>Web3 Guardian Security Alert</strong>
    </div>
    <div style="margin-bottom: 8px;">
      Security Score: <strong>${securityScore.toFixed(1)}/10</strong>
    </div>
    ${vulnerabilityCount > 0 ? `
      <div style="margin-bottom: 8px;">
        Found <strong>${vulnerabilityCount}</strong> potential ${vulnerabilityCount === 1 ? 'vulnerability' : 'vulnerabilities'}
      </div>
    ` : ''}
    <div style="font-size: 12px; opacity: 0.9;">
      Review transaction carefully before proceeding
    </div>
    <div style="margin-top: 12px; text-align: right;">
      <button onclick="this.parentElement.parentElement.remove()" 
              style="background: rgba(255,255,255,0.2); border: none; color: white; 
                     padding: 4px 8px; border-radius: 4px; cursor: pointer; font-size: 12px;">
        Dismiss
      </button>
    </div>
  `;
  
  // Add animation styles
  const style = document.createElement('style');
  style.textContent = `
    @keyframes slideIn {
      from {
        transform: translateX(100%);
        opacity: 0;
      }
      to {
        transform: translateX(0);
        opacity: 1;
      }
    }
  `;
  document.head.appendChild(style);
  
  // Remove existing warning if present
  const existingWarning = document.getElementById('web3-guardian-warning');
  if (existingWarning) {
    existingWarning.remove();
  }
  
  document.body.appendChild(warningDiv);
  
  // Auto-remove after 10 seconds
  setTimeout(() => {
    if (document.getElementById('web3-guardian-warning')) {
      warningDiv.style.animation = 'slideIn 0.3s ease-out reverse';
      setTimeout(() => warningDiv.remove(), 300);
    }
  }, 10000);
}

// Get network name from chain ID for API calls
function getNetworkNameFromChainId(chainId) {
  if (!chainId) return 'mainnet';
  
  const chainIdNum = typeof chainId === 'string' ? parseInt(chainId, 16) : chainId;
  const networkMap = {
    1: 'mainnet',
    5: 'goerli', 
    11155111: 'sepolia',
    137: 'polygon',
    80001: 'mumbai',
    56: 'bsc',
    97: 'bsc-testnet',
    42161: 'arbitrum',
    421613: 'arbitrum-goerli',
    10: 'optimism',
    420: 'optimism-goerli',
    43114: 'avalanche',
    43113: 'fuji',
    250: 'fantom',
    4002: 'fantom-testnet'
  };
  
  return networkMap[chainIdNum] || 'mainnet';
}

// Advanced dApp analysis with mutation observers and dynamic content detection
async function analyzeDApp() {
  logInfo('🔍 Starting comprehensive dApp analysis...');
  
  // Wait for dynamic content to load
  await waitForDynamicContent();
  
  const dAppInfo = {
    // Basic identification
    url: window.location.href,
    domain: window.location.hostname,
    title: document.title,
    description: document.querySelector('meta[name="description"]')?.content || '',
    favicon: extractFavicon(),
    
    // Web3 provider detection
    web3Detection: detectWeb3Ecosystem(),
    
    // Smart contract addresses extraction with multiple techniques
    contractAddresses: await extractContractAddressesAdvanced(),
    
    // Network information with dynamic detection
    networkInfo: await detectNetworkInfoAdvanced(),
    
    // Token and NFT information
    tokenInfo: await extractTokenInfoAdvanced(),
    nftInfo: await extractNFTInfoAdvanced(),
    
    // Security analysis
    securityAnalysis: await performSecurityAnalysis(),
    
    // External resources and domains
    externalResources: analyzeExternalResources(),
    
    // dApp metadata and social links
    metadata: extractDAppMetadata(),
    
    // Technical architecture detection
    techStack: detectTechnicalStack(),
    
    // UI/UX analysis
    uiAnalysis: analyzeUserInterface(),
    
    // Transaction and wallet interaction patterns
    interactionPatterns: analyzeInteractionPatterns(),
    
    timestamp: Date.now()
  };
  
  logInfo('✅ dApp analysis complete:', dAppInfo);
  return dAppInfo;
}

// Wait for dynamic content to load
async function waitForDynamicContent() {
  return new Promise((resolve) => {
    let attempts = 0;
    const maxAttempts = 20;
    
    const checkContent = () => {
      attempts++;
      
      // Check if common Web3 elements are present
      const web3Elements = document.querySelectorAll([
        '[class*="connect"]',
        '[class*="wallet"]',
        '[class*="swap"]',
        '[class*="trade"]',
        '[class*="transaction"]',
        'button',
        'input',
        '[data-testid]'
      ].join(','));
      
      if (web3Elements.length > 10 || attempts >= maxAttempts) {
        resolve();
      } else {
        setTimeout(checkContent, 250);
      }
    };
    
    if (document.readyState === 'complete') {
      setTimeout(checkContent, 500); // Give time for React/Vue to render
    } else {
      document.addEventListener('DOMContentLoaded', () => {
        setTimeout(checkContent, 500);
      });
    }
  });
}

// Extract favicon with fallbacks
function extractFavicon() {
  const selectors = [
    'link[rel="icon"]',
    'link[rel="shortcut icon"]',
    'link[rel="apple-touch-icon"]',
    'meta[property="og:image"]'
  ];
  
  for (const selector of selectors) {
    const element = document.querySelector(selector);
    if (element) {
      return element.href || element.content;
    }
  }
  
  return `${window.location.origin}/favicon.ico`;
}

// Advanced Web3 ecosystem detection
function detectWeb3Ecosystem() {
  const detection = {
    hasWeb3: !!window.Web3,
    hasEthers: !!window.ethers,
    hasWagmi: !!window.wagmi,
    hasRainbowKit: !!window.RainbowKit,
    hasWalletConnect: !!window.WalletConnect,
    hasMetaMask: !!window.ethereum?.isMetaMask,
    providerType: detectProviderType(),
    libraries: []
  };
  
  // Check for Web3 libraries in global scope
  const web3Libraries = [
    'Web3', 'ethers', 'wagmi', 'viem', 'web3modal', 'connectkit',
    'RainbowKit', 'WalletConnect', 'Moralis', 'Alchemy', 'Infura'
  ];
  
  web3Libraries.forEach(lib => {
    if (window[lib]) {
      detection.libraries.push(lib);
    }
  });
  
  // Check for Web3 patterns in script content
  const scriptContent = Array.from(document.scripts)
    .map(script => script.textContent || script.src || '')
    .join(' ');
  
  const web3Patterns = [
    'ethereum', 'web3', 'ethers', 'wagmi', 'walletconnect',
    'metamask', 'coinbase', 'rainbow', 'uniswap', 'pancakeswap'
  ];
  
  web3Patterns.forEach(pattern => {
    if (scriptContent.toLowerCase().includes(pattern)) {
      detection.libraries.push(`detected_${pattern}`);
    }
  });
  
  return detection;
}

// Advanced contract address extraction
async function extractContractAddressesAdvanced() {
  const addresses = new Set();
  const addressRegex = /0x[a-fA-F0-9]{40}/g;
  
  // 1. Extract from visible text content
  const pageText = document.body.innerText;
  const textMatches = pageText.match(addressRegex);
  if (textMatches) {
    textMatches.forEach(addr => addresses.add(addr.toLowerCase()));
  }
  
  // 2. Extract from all script contents
  Array.from(document.scripts).forEach(script => {
    if (script.textContent) {
      const scriptMatches = script.textContent.match(addressRegex);
      if (scriptMatches) {
        scriptMatches.forEach(addr => addresses.add(addr.toLowerCase()));
      }
    }
  });
  
  // 3. Extract from data attributes and properties
  document.querySelectorAll('*').forEach(el => {
    // Check all attributes
    Array.from(el.attributes || []).forEach(attr => {
      if (attr.value) {
        const attrMatches = attr.value.match(addressRegex);
        if (attrMatches) {
          attrMatches.forEach(addr => addresses.add(addr.toLowerCase()));
        }
      }
    });
    
    // Check element properties
    ['value', 'textContent', 'innerHTML'].forEach(prop => {
      const value = el[prop];
      if (typeof value === 'string') {
        const propMatches = value.match(addressRegex);
        if (propMatches) {
          propMatches.forEach(addr => addresses.add(addr.toLowerCase()));
        }
      }
    });
  });
  
  // 4. Extract from localStorage and sessionStorage
  try {
    const storageKeys = [...Object.keys(localStorage), ...Object.keys(sessionStorage)];
    storageKeys.forEach(key => {
      try {
        const value = localStorage.getItem(key) || sessionStorage.getItem(key);
        if (value) {
          const storageMatches = value.match(addressRegex);
          if (storageMatches) {
            storageMatches.forEach(addr => addresses.add(addr.toLowerCase()));
          }
        }
      } catch (e) {}
    });
  } catch (e) {}
  
  // 5. Extract from network requests (if intercepted)
  if (window.fetch && window.fetch.intercepted) {
    // This would need to be implemented in the fetch interceptor
  }
  
  // 6. Look for specific contract address patterns in common locations
  const commonSelectors = [
    '[class*="contract"]', '[class*="address"]', '[id*="contract"]', '[id*="address"]',
    '[data-contract]', '[data-address]', '[data-token]', '[data-pool]',
    '.token-address', '.contract-address', '.pool-address', '.pair-address'
  ];
  
  commonSelectors.forEach(selector => {
    try {
      document.querySelectorAll(selector).forEach(el => {
        const sources = [
          el.textContent, el.value, el.title, el.alt,
          el.getAttribute('data-contract'), el.getAttribute('data-address'),
          el.getAttribute('data-token'), el.getAttribute('href')
        ].filter(Boolean);
        
        sources.forEach(source => {
          const matches = source.match(addressRegex);
          if (matches) {
            matches.forEach(addr => addresses.add(addr.toLowerCase()));
          }
        });
      });
    } catch (e) {}
  });
  
  const addressArray = Array.from(addresses);
  logInfo(`Found ${addressArray.length} contract addresses:`, addressArray);
  return addressArray;
}

// Advanced network detection
async function detectNetworkInfoAdvanced() {
  const networkInfo = {
    supportedNetworks: [],
    defaultNetwork: 'Unknown',
    chainId: null,
    networkVersion: null,
    rpcUrls: []
  };
  
  // Get current network from provider
  if (window.ethereum) {
    try {
      networkInfo.chainId = await window.ethereum.request({ method: 'eth_chainId' });
      networkInfo.networkVersion = await window.ethereum.request({ method: 'net_version' });
      networkInfo.defaultNetwork = getNetworkName(parseInt(networkInfo.chainId, 16));
    } catch (e) {
      logError('Error getting network info:', e);
    }
  }
  
  // Detect supported networks from content
  const networkPatterns = [
    { name: 'Ethereum', patterns: ['ethereum', 'mainnet', 'eth', 'erc20', 'erc721'], chainId: 1 },
    { name: 'Polygon', patterns: ['polygon', 'matic', 'pos'], chainId: 137 },
    { name: 'BSC', patterns: ['bsc', 'binance', 'bnb'], chainId: 56 },
    { name: 'Arbitrum', patterns: ['arbitrum', 'arb'], chainId: 42161 },
    { name: 'Optimism', patterns: ['optimism', 'op'], chainId: 10 },
    { name: 'Avalanche', patterns: ['avalanche', 'avax'], chainId: 43114 },
    { name: 'Fantom', patterns: ['fantom', 'ftm'], chainId: 250 },
    { name: 'Base', patterns: ['base'], chainId: 8453 },
    { name: 'Solana', patterns: ['solana', 'sol', 'spl'] }
  ];
  
  const pageContent = document.body.innerText.toLowerCase();
  const scriptContent = Array.from(document.scripts)
    .map(script => script.textContent || '')
    .join(' ')
    .toLowerCase();
  
  networkPatterns.forEach(network => {
    const found = network.patterns.some(pattern => 
      pageContent.includes(pattern) || scriptContent.includes(pattern)
    );
    if (found) {
      networkInfo.supportedNetworks.push({
        name: network.name,
        chainId: network.chainId,
        detected: true
      });
    }
  });
  
  // Extract RPC URLs
  const rpcRegex = /https?:\/\/[^\s"']+\.(?:infura|alchemy|quicknode|rpc)[\w\-\.\/]*/gi;
  const rpcMatches = scriptContent.match(rpcRegex);
  if (rpcMatches) {
    networkInfo.rpcUrls = [...new Set(rpcMatches)];
  }
  
  return networkInfo;
}

// Get network name from chain ID
function getNetworkName(chainId) {
  const networks = {
    1: 'Ethereum Mainnet',
    137: 'Polygon',
    56: 'BSC',
    42161: 'Arbitrum',
    10: 'Optimism',
    43114: 'Avalanche',
    250: 'Fantom',
    8453: 'Base',
    5: 'Goerli',
    11155111: 'Sepolia'
  };
  return networks[chainId] || `Chain ${chainId}`;
}

// Advanced token information extraction
async function extractTokenInfoAdvanced() {
  const tokens = [];
  const tokenPatterns = {
    symbols: /\b[A-Z]{2,6}\b(?=\s|$|[^A-Za-z])/g,
    addresses: /0x[a-fA-F0-9]{40}/g
  };
  
  // Common token selectors
  const tokenSelectors = [
    '[class*="token"]', '[class*="currency"]', '[class*="asset"]',
    '[data-token]', '[data-symbol]', '[data-currency]',
    '.token-symbol', '.currency-symbol', '.asset-symbol',
    'select option', '.dropdown-option'
  ];
  
  tokenSelectors.forEach(selector => {
    try {
      document.querySelectorAll(selector).forEach(el => {
        const tokenData = {
          symbol: null,
          address: null,
          name: null,
          source: selector,
          element: el.tagName.toLowerCase()
        };
        
        // Extract symbol
        const symbolSources = [
          el.textContent, el.value, el.getAttribute('data-symbol'),
          el.getAttribute('data-token'), el.title
        ];
        
        for (const source of symbolSources) {
          if (source) {
            const symbolMatch = source.match(/\b[A-Z]{2,8}\b/);
            if (symbolMatch) {
              tokenData.symbol = symbolMatch[0];
              break;
            }
          }
        }
        
        // Extract address
        const addressSources = [
          el.getAttribute('data-address'), el.getAttribute('data-token'),
          el.textContent, el.value
        ];
        
        for (const source of addressSources) {
          if (source) {
            const addressMatch = source.match(/0x[a-fA-F0-9]{40}/);
            if (addressMatch) {
              tokenData.address = addressMatch[0].toLowerCase();
              break;
            }
          }
        }
        
        // Extract token name
        const nameText = el.textContent?.trim();
        if (nameText && nameText.length > 2 && nameText.length < 50) {
          tokenData.name = nameText;
        }
        
        if (tokenData.symbol || tokenData.address || tokenData.name) {
          tokens.push(tokenData);
        }
      });
    } catch (e) {}
  });
  
  // Look for popular tokens in content
  const popularTokens = [
    { symbol: 'ETH', name: 'Ethereum' },
    { symbol: 'BTC', name: 'Bitcoin' },
    { symbol: 'USDC', name: 'USD Coin' },
    { symbol: 'USDT', name: 'Tether' },
    { symbol: 'DAI', name: 'Dai' },
    { symbol: 'WETH', name: 'Wrapped Ethereum' },
    { symbol: 'UNI', name: 'Uniswap' },
    { symbol: 'LINK', name: 'Chainlink' }
  ];
  
  const content = document.body.textContent.toLowerCase();
  popularTokens.forEach(token => {
    if (content.includes(token.symbol.toLowerCase()) || content.includes(token.name.toLowerCase())) {
      tokens.push({
        symbol: token.symbol,
        name: token.name,
        source: 'content_detection',
        popular: true
      });
    }
  });
  
  return tokens;
}

// Advanced NFT information extraction
async function extractNFTInfoAdvanced() {
  const nfts = [];
  const nftKeywords = ['nft', 'erc721', 'erc1155', 'opensea', 'collection', 'marketplace'];
  
  // Look for NFT-related elements
  const nftSelectors = [
    '[class*="nft"]', '[class*="collection"]', '[class*="marketplace"]',
    '[data-nft]', '[data-collection]', '[data-tokenid]'
  ];
  
  nftSelectors.forEach(selector => {
    try {
      document.querySelectorAll(selector).forEach(el => {
        const nftData = {
          type: 'unknown',
          address: null,
          tokenId: null,
          source: selector
        };
        
        // Extract contract address
        const addressMatch = el.textContent?.match(/0x[a-fA-F0-9]{40}/);
        if (addressMatch) {
          nftData.address = addressMatch[0].toLowerCase();
        }
        
        // Extract token ID
        const tokenIdMatch = el.textContent?.match(/#(\d+)/);
        if (tokenIdMatch) {
          nftData.tokenId = tokenIdMatch[1];
        }
        
        // Determine NFT type
        const text = el.textContent?.toLowerCase() || '';
        if (text.includes('erc721')) nftData.type = 'ERC721';
        else if (text.includes('erc1155')) nftData.type = 'ERC1155';
        else if (text.includes('collection')) nftData.type = 'Collection';
        
        if (nftData.address || nftData.tokenId) {
          nfts.push(nftData);
        }
      });
    } catch (e) {}
  });
  
  return nfts;
}

// Comprehensive security analysis
async function performSecurityAnalysis() {
  const analysis = {
    https: window.location.protocol === 'https:',
    csp: checkContentSecurityPolicy(),
    sri: checkSubresourceIntegrity(),
    obfuscation: checkForObfuscation(),
    suspiciousPatterns: detectSuspiciousPatterns(),
    trustIndicators: detectTrustIndicators(),
    externalScripts: analyzeExternalScripts(),
    permissions: analyzePermissions()
  };
  
  return analysis;
}

// Analyze external resources
function analyzeExternalResources() {
  const resources = {
    domains: new Set(),
    scripts: [],
    iframes: [],
    images: []
  };
  
  const currentDomain = window.location.hostname;
  
  // Analyze scripts
  Array.from(document.scripts).forEach(script => {
    if (script.src) {
      try {
        const url = new URL(script.src);
        if (url.hostname !== currentDomain) {
          resources.domains.add(url.hostname);
          resources.scripts.push({
            src: script.src,
            domain: url.hostname,
            hasIntegrity: !!script.integrity,
            async: script.async,
            defer: script.defer
          });
        }
      } catch (e) {}
    }
  });
  
  // Analyze iframes
  Array.from(document.querySelectorAll('iframe')).forEach(iframe => {
    if (iframe.src) {
      try {
        const url = new URL(iframe.src);
        resources.domains.add(url.hostname);
        resources.iframes.push({
          src: iframe.src,
          domain: url.hostname,
          sandbox: iframe.sandbox?.toString() || '',
          allow: iframe.allow || ''
        });
      } catch (e) {}
    }
  });
  
  // Analyze images
  Array.from(document.querySelectorAll('img')).forEach(img => {
    if (img.src) {
      try {
        const url = new URL(img.src);
        if (url.hostname !== currentDomain) {
          resources.domains.add(url.hostname);
          resources.images.push({
            src: img.src,
            domain: url.hostname,
            alt: img.alt || ''
          });
        }
      } catch (e) {}
    }
  });
  
  return {
    externalDomains: Array.from(resources.domains),
    scripts: resources.scripts,
    iframes: resources.iframes,
    images: resources.images
  };
}

// Extract dApp metadata
function extractDAppMetadata() {
  const metadata = {
    socialLinks: extractSocialLinks(),
    githubInfo: extractGithubInfo(),
    manifestInfo: extractManifestInfo(),
    metaTags: extractMetaTags()
  };
  
  return metadata;
}

// Extract meta tags
function extractMetaTags() {
  const metaTags = {};
  
  Array.from(document.querySelectorAll('meta')).forEach(meta => {
    const name = meta.getAttribute('name') || meta.getAttribute('property');
    const content = meta.getAttribute('content');
    
    if (name && content) {
      metaTags[name] = content;
    }
  });
  
  return metaTags;
}

// Detect technical stack
function detectTechnicalStack() {
  const stack = {
    framework: detectFramework(),
    buildTool: detectBuildTool(),
    bundler: detectBundler(),
    testing: detectTestingFramework(),
    styling: detectStylingFramework()
  };
  
  return stack;
}

// Detect bundler
function detectBundler() {
  const scripts = Array.from(document.scripts).map(s => s.src).join('');
  const content = document.documentElement.innerHTML;
  
  if (scripts.includes('webpack') || content.includes('webpackChunkName')) return 'Webpack';
  if (scripts.includes('vite') || content.includes('__vite')) return 'Vite';
  if (scripts.includes('parcel')) return 'Parcel';
  if (scripts.includes('rollup')) return 'Rollup';
  if (scripts.includes('esbuild')) return 'ESBuild';
  
  return 'Unknown';
}

// Detect testing framework
function detectTestingFramework() {
  const scriptContent = Array.from(document.scripts)
    .map(script => script.textContent || '')
    .join(' ');
  
  if (scriptContent.includes('jest')) return 'Jest';
  if (scriptContent.includes('mocha')) return 'Mocha';
  if (scriptContent.includes('cypress')) return 'Cypress';
  if (scriptContent.includes('playwright')) return 'Playwright';
  
  return 'Unknown';
}

// Detect styling framework
function detectStylingFramework() {
  const stylesheets = Array.from(document.styleSheets);
  const classNames = Array.from(document.querySelectorAll('*'))
    .map(el => el.className)
    .join(' ');
  
  if (classNames.includes('tailwind') || classNames.includes('tw-')) return 'Tailwind CSS';
  if (classNames.includes('bootstrap') || classNames.includes('btn-')) return 'Bootstrap';
  if (classNames.includes('mui') || classNames.includes('MuiButton')) return 'Material-UI';
  if (classNames.includes('ant-')) return 'Ant Design';
  if (classNames.includes('chakra-')) return 'Chakra UI';
  
  return 'Unknown';
}

// Analyze user interface
function analyzeUserInterface() {
  const analysis = {
    complexity: analyzeUIComplexity(),
    accessibility: analyzeAccessibility(),
    responsiveness: analyzeResponsiveness(),
    interactions: analyzeInteractions()
  };
  
  return analysis;
}

// Analyze accessibility
function analyzeAccessibility() {
  const accessibility = {
    hasAltTags: document.querySelectorAll('img[alt]').length > 0,
    hasAriaLabels: document.querySelectorAll('[aria-label]').length > 0,
    hasFocusIndicators: document.querySelectorAll(':focus').length > 0,
    hasSemanticHTML: document.querySelectorAll('header, nav, main, section, article, aside, footer').length > 0
  };
  
  return accessibility;
}

// Analyze responsiveness
function analyzeResponsiveness() {
  const viewport = document.querySelector('meta[name="viewport"]');
  const mediaQueries = Array.from(document.styleSheets)
    .flatMap(sheet => {
      try {
        return Array.from(sheet.cssRules || []);
      } catch (e) {
        return [];
      }
    })
    .filter(rule => rule.type === CSSRule.MEDIA_RULE).length;
  
  return {
    hasViewportMeta: !!viewport,
    mediaQueriesCount: mediaQueries,
    isResponsive: !!viewport && mediaQueries > 0
  };
}

// Analyze interactions
function analyzeInteractions() {
  const interactions = {
    buttons: document.querySelectorAll('button').length,
    links: document.querySelectorAll('a').length,
    forms: document.querySelectorAll('form').length,
    inputs: document.querySelectorAll('input, textarea, select').length,
    modals: document.querySelectorAll('[class*="modal"], [class*="popup"], [class*="dialog"]').length
  };
  
  return interactions;
}

// Analyze interaction patterns
function analyzeInteractionPatterns() {
  const patterns = {
    walletMethods: detectWalletMethods(),
    transactionPatterns: detectTransactionPatterns(),
    signaturePatterns: detectSignaturePatterns(),
    networkSwitching: detectNetworkSwitching()
  };
  
  return patterns;
}

// Detect transaction patterns
function detectTransactionPatterns() {
  const patterns = [];
  const content = document.body.textContent.toLowerCase();
  
  const transactionKeywords = [
    'swap', 'trade', 'buy', 'sell', 'transfer', 'send', 'approve',
    'stake', 'unstake', 'claim', 'mint', 'burn', 'bridge'
  ];
  
  transactionKeywords.forEach(keyword => {
    if (content.includes(keyword)) {
      patterns.push(keyword);
    }
  });
  
  return patterns;
}

// Detect signature patterns
function detectSignaturePatterns() {
  const scriptContent = Array.from(document.scripts)
    .map(script => script.textContent || '')
    .join(' ');
  
  const signatureMethods = [
    'personal_sign',
    'eth_signTypedData',
    'eth_signTypedData_v3',
    'eth_signTypedData_v4',
    'eth_sign'
  ];
  
  const detectedMethods = signatureMethods.filter(method => 
    scriptContent.includes(method)
  );
  
  return detectedMethods;
}

// Detect network switching
function detectNetworkSwitching() {
  const scriptContent = Array.from(document.scripts)
    .map(script => script.textContent || '')
    .join(' ');
  
  const networkMethods = [
    'wallet_addEthereumChain',
    'wallet_switchEthereumChain',
    'wallet_requestPermissions'
  ];
  
  const detectedMethods = networkMethods.filter(method => 
    scriptContent.includes(method)
  );
  
  return detectedMethods;
}

// Analyze permissions
function analyzePermissions() {
  const permissions = {
    camera: checkPermission('camera'),
    microphone: checkPermission('microphone'),
    location: checkPermission('geolocation'),
    notifications: checkPermission('notifications'),
    clipboard: checkPermission('clipboard-read')
  };
  
  return permissions;
}

// Check specific permission
function checkPermission(permission) {
  try {
    if (navigator.permissions) {
      return navigator.permissions.query({ name: permission })
        .then(result => result.state)
        .catch(() => 'unknown');
    }
  } catch (e) {}
  return 'unknown';
}

// Notify background of account access
async function notifyAccountAccess(accounts) {
  try {
    await sendMessageToBackground({
      type: 'ACCOUNT_ACCESS',
      data: {
        accounts,
        url: window.location.href,
        timestamp: Date.now()
      }
    });
  } catch (error) {
    logError('Failed to notify account access:', error);
  }
}

// Legacy provider support
function handleLegacyProviderCall(method, args) {
  const [payload, callback] = args;
  
  if (payload && (payload.method === 'eth_sendTransaction' || payload.method === 'eth_signTransaction')) {
    handleProviderRequest(payload)
      .then(result => {
        if (callback) callback(null, { result });
        return result;
      })
      .catch(error => {
        if (callback) callback(error);
        else throw error;
      });
    return;
  }
  
  // Handle other legacy requests
  return this[method].call(this, ...args);
}

// Request user approval for various actions
async function requestConnectionApproval(data) {
  return await requestUserApproval({ ...data, actionType: 'connection' });
}

async function requestTransactionApproval(data) {
  return await requestUserApproval({ ...data, actionType: 'transaction' });
}

async function requestSigningApproval(data) {
  return await requestUserApproval({ ...data, actionType: 'signing' });
}

async function requestUserApproval(data) {
  const messageId = generateRequestId();
  
  try {
    // Show approval popup
    const response = await sendMessageToBackground({
      type: 'SHOW_APPROVAL_POPUP',
      data: { ...data, messageId }
    }, 5000);
    
    if (!response.success) {
      throw new Error(response.error || 'Failed to show approval popup');
    }
    
    // Wait for user decision
    return new Promise((resolve, reject) => {
      const timeout = setTimeout(() => {
        reject(new Error('User approval timeout'));
      }, 120000); // 2 minute timeout
      
      const messageListener = (message) => {
        if (message.type === 'USER_DECISION' && message.messageId === messageId) {
          clearTimeout(timeout);
          chrome.runtime.onMessage.removeListener(messageListener);
          resolve(message.approved);
        }
      };
      
      chrome.runtime.onMessage.addListener(messageListener);
    });
    
  } catch (error) {
    logError('Error requesting user approval:', error);
    throw error;
  }
}

// Send message to background script
function sendMessageToBackground(message, timeout = 5000) {
  return new Promise((resolve, reject) => {
    const timeoutId = setTimeout(() => {
      reject(new Error('Message timeout'));
    }, timeout);
    
    chrome.runtime.sendMessage(message, (response) => {
      clearTimeout(timeoutId);
      
      if (chrome.runtime.lastError) {
        reject(new Error(chrome.runtime.lastError.message));
      } else if (!response) {
        reject(new Error('No response received'));
      } else {
        resolve(response);
      }
    });
  });
}

// Message handling for background script communication
chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
  logDebug('Content script received message:', request.type);
  
  try {
    switch (request.type) {
      case 'PING':
        sendResponse({ type: 'PONG', timestamp: Date.now() });
        break;
        
      case 'GET_TRANSACTION_STATUS':
        const status = getTransactionStatus();
        sendResponse({ success: true, data: status });
        break;
        
      case 'GET_PAGE_INFO':
        const pageInfo = getPageInfo();
        sendResponse({ success: true, data: pageInfo });
        break;
        
      case 'TRANSACTION_DECISION':
        // Handle user decision - this will be caught by the promise listener
        // No response needed as it's handled by the promise mechanism
        break;
        
      default:
        sendResponse({ success: false, error: 'Unknown message type' });
    }
  } catch (error) {
    logError('Error handling message:', error);
    sendResponse({ success: false, error: error.message });
  }
  
  return true; // Keep message channel open
});

// Get current transaction status
function getTransactionStatus() {
  return {
    url: window.location.href,
    hasProvider: !!window.ethereum,
    isConnected: !!window.ethereum?.selectedAddress,
    accounts: window.ethereum?.selectedAddress ? [window.ethereum.selectedAddress] : [],
    chainId: window.ethereum?.chainId || null,
    networkVersion: window.ethereum?.networkVersion || null,
    pendingTransactions: interceptedRequests.size,
    timestamp: new Date().toISOString()
  };
}

// Get page information
function getPageInfo() {
  return {
    url: window.location.href,
    title: document.title,
    domain: window.location.hostname,
    ...extractPageTransactionData(),
    timestamp: new Date().toISOString()
  };
}

// Utility functions
function generateRequestId() {
  return `req_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
}

function parseHexValue(hex) {
  if (typeof hex === 'string' && hex.startsWith('0x')) {
    return parseInt(hex, 16).toString();
  }
  return hex;
}

// Enrich transaction data with additional context
async function enrichTransactionData(transaction) {
  const pageData = extractPageTransactionData();
  
  return {
    ...transaction,
    ...pageData,
    timestamp: new Date().toISOString(),
    url: window.location.href,
    userAgent: navigator.userAgent,
    // Convert hex values for better analysis
    value: transaction.value ? parseHexValue(transaction.value) : '0',
    gas: transaction.gas ? parseHexValue(transaction.gas) : null,
    gasPrice: transaction.gasPrice ? parseHexValue(transaction.gasPrice) : null,
    nonce: transaction.nonce ? parseHexValue(transaction.nonce) : null
  };
}

// Extract transaction data from the current page
function extractPageTransactionData() {
  try {
    // Try to extract transaction details from common dApp patterns
    const selectors = {
      recipient: [
        '[data-testid*="recipient"]',
        '[data-testid*="to-address"]', 
        'input[placeholder*="address" i]',
        '.recipient-address',
        '.to-address'
      ],
      amount: [
        '[data-testid*="amount"]',
        '[data-testid*="value"]',
        'input[type="number"]',
        '.amount-input',
        '.value-input'
      ],
      token: [
        '[data-testid*="token"]',
        '[data-testid*="symbol"]',
        '.token-symbol',
        '.currency-symbol'
      ]
    };
    
    const findElement = (selectorArray) => {
      for (const selector of selectorArray) {
        const element = document.querySelector(selector);
        if (element) return element;
      }
      return null;
    };
    
    const recipientEl = findElement(selectors.recipient);
    const amountEl = findElement(selectors.amount);
    const tokenEl = findElement(selectors.token);
    
    return {
      pageRecipient: recipientEl?.value || recipientEl?.textContent?.trim() || null,
      pageAmount: amountEl?.value || amountEl?.textContent?.trim() || null,
      pageToken: tokenEl?.textContent?.replace(/[0-9.,\s]/g, '').trim() || 'ETH',
      connectedAccount: window.ethereum?.selectedAddress || null
    };
  } catch (error) {
    logError('Error extracting page data:', error);
    return {};
  }
}

// Check for code obfuscation (simple heuristic)
function checkForObfuscation() {
  try {
    const scripts = Array.from(document.scripts);
    let obfuscationScore = 0;
    
    for (const script of scripts) {
      if (script.textContent) {
        const content = script.textContent;
        // Check for common obfuscation patterns
        if (content.includes('eval(') || content.includes('Function(')) obfuscationScore += 2;
        if (content.match(/[a-zA-Z_$][a-zA-Z0-9_$]*\s*=\s*['"][^'"]*['"]\s*\[/)) obfuscationScore += 1;
        if (content.split('\n').length < 5 && content.length > 1000) obfuscationScore += 1;
        // Very long variable names or hex strings
        if (content.match(/[a-fA-F0-9]{50,}/)) obfuscationScore += 1;
      }
    }
    
    return obfuscationScore > 2;
  } catch (error) {
    return false;
  }
}

// Get external domains referenced by the page
function getExternalDomains() {
  try {
    const currentDomain = window.location.hostname;
    const externalDomains = new Set();
    
    // Check script sources
    Array.from(document.scripts).forEach(script => {
      if (script.src) {
        try {
          const url = new URL(script.src);
          if (url.hostname !== currentDomain) {
            externalDomains.add(url.hostname);
          }
        } catch (e) {}
      }
    });
    
    // Check iframe sources
    Array.from(document.querySelectorAll('iframe')).forEach(iframe => {
      if (iframe.src) {
        try {
          const url = new URL(iframe.src);
          if (url.hostname !== currentDomain) {
            externalDomains.add(url.hostname);
          }
        } catch (e) {}
      }
    });
    
    return Array.from(externalDomains);
  } catch (error) {
    return [];
  }
}

// Detect framework used by the dApp
function detectFramework() {
  const scripts = Array.from(document.scripts).map(s => s.src || s.textContent || '').join(' ');
  const content = document.documentElement.innerHTML;
  
  // Check for React
  if (window.React || window.ReactDOM || content.includes('data-reactroot') || 
      content.includes('__REACT_DEVTOOLS_GLOBAL_HOOK__') || scripts.includes('react')) {
    return 'React';
  }
  
  // Check for Vue
  if (window.Vue || content.includes('v-') || content.includes('data-v-') || 
      scripts.includes('vue')) {
    return 'Vue.js';
  }
  
  // Check for Angular
  if (window.ng || content.includes('ng-') || content.includes('_ngcontent') || 
      scripts.includes('angular')) {
    return 'Angular';
  }
  
  // Check for Svelte
  if (content.includes('svelte-') || scripts.includes('svelte')) {
    return 'Svelte';
  }
  
  // Check for Next.js
  if (window.__NEXT_DATA__ || content.includes('__NEXT_DATA__') || 
      scripts.includes('next')) {
    return 'Next.js';
  }
  
  // Check for Nuxt.js
  if (window.__NUXT__ || content.includes('__NUXT__') || scripts.includes('nuxt')) {
    return 'Nuxt.js';
  }
  
  return 'Unknown';
}

// Detect build tool
function detectBuildTool() {
  const scripts = Array.from(document.scripts).map(s => s.src).join('');
  const content = document.head.innerHTML;
  
  if (scripts.includes('webpack') || content.includes('webpack')) return 'Webpack';
  if (scripts.includes('vite') || content.includes('vite')) return 'Vite';
  if (scripts.includes('parcel')) return 'Parcel';
  if (scripts.includes('rollup')) return 'Rollup';
  if (scripts.includes('snowpack')) return 'Snowpack';
  
  return 'Unknown';
}

// Analyze UI complexity
function analyzeUIComplexity() {
  return {
    buttons: document.querySelectorAll('button, [role="button"], input[type="button"], input[type="submit"]').length,
    forms: document.querySelectorAll('form').length,
    inputs: document.querySelectorAll('input, textarea, select').length,
    links: document.querySelectorAll('a[href]').length,
    images: document.querySelectorAll('img').length,
    interactiveElements: document.querySelectorAll('button, a, input, select, textarea, [onclick], [role="button"]').length,
    totalElements: document.querySelectorAll('*').length,
    scriptsCount: document.scripts.length,
    stylesheetsCount: document.styleSheets.length
  };
}

// Detect wallet methods used
function detectWalletMethods() {
  const scriptContent = Array.from(document.scripts)
    .map(script => script.textContent || '')
    .join(' ');
  
  const walletMethods = [
    'eth_requestAccounts',
    'eth_accounts', 
    'eth_sendTransaction',
    'eth_signTransaction',
    'eth_sign',
    'personal_sign',
    'eth_signTypedData',
    'eth_signTypedData_v3',
    'eth_signTypedData_v4',
    'wallet_addEthereumChain',
    'wallet_switchEthereumChain',
    'wallet_requestPermissions',
    'eth_getBalance',
    'eth_call',
    'eth_estimateGas',
    'eth_gasPrice',
    'eth_getTransactionReceipt',
    'eth_getTransactionByHash'
  ];
  
  const detectedMethods = walletMethods.filter(method => 
    scriptContent.includes(method) || scriptContent.includes(`"${method}"`) || scriptContent.includes(`'${method}'`)
  );
  
  return detectedMethods;
}

// Extract social links
function extractSocialLinks() {
  const socialPlatforms = {
    twitter: ['twitter.com', 't.co'],
    github: ['github.com'],
    discord: ['discord.gg', 'discord.com'],
    telegram: ['t.me', 'telegram.me'],
    medium: ['medium.com'],
    reddit: ['reddit.com'],
    linkedin: ['linkedin.com'],
    youtube: ['youtube.com', 'youtu.be']
  };
  
  const socialLinks = {};
  
  Object.entries(socialPlatforms).forEach(([platform, domains]) => {
    const links = Array.from(document.querySelectorAll('a[href]'))
      .map(a => a.href)
      .filter(href => domains.some(domain => href.includes(domain)));
    
    if (links.length > 0) {
      socialLinks[platform] = links;
    }
  });
  
  return socialLinks;
}

// Extract GitHub information
function extractGithubInfo() {
  const githubLinks = Array.from(document.querySelectorAll('a[href*="github.com"]'))
    .map(a => a.href);
  
  const repoLinks = githubLinks.filter(link => 
    link.match(/github\.com\/[^\/]+\/[^\/]+\/?$/)
  );
  
  return {
    hasGithubLinks: githubLinks.length > 0,
    repositoryLinks: repoLinks,
    totalGithubLinks: githubLinks.length
  };
}

// Extract manifest information
function extractManifestInfo() {
  const manifestLink = document.querySelector('link[rel="manifest"]');
  const appleTouchIcon = document.querySelector('link[rel="apple-touch-icon"]');
  const themeColor = document.querySelector('meta[name="theme-color"]');
  
  return {
    hasManifest: !!manifestLink,
    manifestUrl: manifestLink?.href,
    hasAppleTouchIcon: !!appleTouchIcon,
    themeColor: themeColor?.content,
    isPWA: !!(manifestLink && appleTouchIcon)
  };
}

// Check Content Security Policy
function checkContentSecurityPolicy() {
  const cspMeta = document.querySelector('meta[http-equiv="Content-Security-Policy"]');
  const cspHeader = document.querySelector('meta[name="Content-Security-Policy"]');
  
  return {
    hasCSP: !!(cspMeta || cspHeader),
    cspContent: cspMeta?.content || cspHeader?.content || null,
    isStrict: false // Would need actual CSP parsing to determine
  };
}

// Check Subresource Integrity
function checkSubresourceIntegrity() {
  const scriptsWithIntegrity = Array.from(document.scripts)
    .filter(script => script.integrity);
  
  const linksWithIntegrity = Array.from(document.querySelectorAll('link[integrity]'));
  
  return {
    totalScripts: document.scripts.length,
    scriptsWithSRI: scriptsWithIntegrity.length,
    totalLinks: document.querySelectorAll('link').length,
    linksWithSRI: linksWithIntegrity.length,
    sriCoverage: document.scripts.length > 0 ? 
      (scriptsWithIntegrity.length / document.scripts.length) * 100 : 0
  };
}

// Detect suspicious patterns
function detectSuspiciousPatterns() {
  const suspiciousPatterns = [];
  const content = document.body.textContent.toLowerCase();
  const scripts = Array.from(document.scripts)
    .map(script => script.textContent || '')
    .join(' ');
  
  // Check for suspicious keywords
  const suspiciousKeywords = [
    'phishing', 'scam', 'fake', 'steal', 'hack', 'private key',
    'seed phrase', 'mnemonic', 'wallet recovery', 'urgent action required',
    'limited time', 'act now', 'verify account', 'suspended account',
    'click here immediately', 'congratulations you won'
  ];
  
  suspiciousKeywords.forEach(keyword => {
    if (content.includes(keyword)) {
      suspiciousPatterns.push(`suspicious_keyword_${keyword.replace(/\s+/g, '_')}`);
    }
  });
  
  // Check for obfuscated JavaScript
  if (scripts.includes('eval(') || scripts.includes('Function(')) {
    suspiciousPatterns.push('obfuscated_javascript');
  }
  
  // Check for multiple redirects in history
  if (window.history.length > 5) {
    suspiciousPatterns.push('multiple_redirects');
  }
  
  // Check for suspicious domains
  const domain = window.location.hostname;
  if (domain.includes('xn--') || domain.match(/[0-9]{1,3}\.[0-9]{1,3}\.[0-9]{1,3}\.[0-9]{1,3}/)) {
    suspiciousPatterns.push('suspicious_domain');
  }
  
  return suspiciousPatterns;
}

// Detect trust indicators
function detectTrustIndicators() {
  const indicators = [];
  
  // HTTPS
  if (window.location.protocol === 'https:') {
    indicators.push('https_enabled');
  }
  
  // Valid SSL certificate (basic check)
  if (window.location.protocol === 'https:' && !document.querySelector('body[data-ssl-error]')) {
    indicators.push('valid_ssl');
  }
  
  // CSP header
  if (document.querySelector('meta[http-equiv="Content-Security-Policy"]')) {
    indicators.push('csp_enabled');
  }
  
  // No mixed content
  const mixedContent = Array.from(document.querySelectorAll('script[src], img[src], link[href]'))
    .some(el => (el.src || el.href)?.startsWith('http://'));
  if (!mixedContent && window.location.protocol === 'https:') {
    indicators.push('no_mixed_content');
  }
  
  // Has privacy policy
  const privacyLink = document.querySelector('a[href*="privacy"], a[href*="terms"]');
  if (privacyLink) {
    indicators.push('has_privacy_policy');
  }
  
  // Professional domain
  const domain = window.location.hostname;
  if (!domain.includes('xn--') && !domain.match(/[0-9]{1,3}\.[0-9]{1,3}\.[0-9]{1,3}\.[0-9]{1,3}/)) {
    indicators.push('professional_domain');
  }
  
  return indicators;
}

// Analyze external scripts
function analyzeExternalScripts() {
  const scripts = Array.from(document.scripts)
    .filter(script => script.src)
    .map(script => {
      try {
        const url = new URL(script.src);
        return {
          src: script.src,
          domain: url.hostname,
          hasIntegrity: !!script.integrity,
          isThirdParty: url.hostname !== window.location.hostname,
          async: script.async,
          defer: script.defer,
          crossOrigin: script.crossOrigin || null
        };
      } catch (e) {
        return null;
      }
    })
    .filter(Boolean);
  
  const thirdPartyScripts = scripts.filter(s => s.isThirdParty);
  const scriptsWithoutSRI = thirdPartyScripts.filter(s => !s.hasIntegrity);
  
  return {
    totalScripts: scripts.length,
    thirdPartyScripts: thirdPartyScripts.length,
    scriptsWithoutSRI: scriptsWithoutSRI.length,
    uniqueDomains: [...new Set(thirdPartyScripts.map(s => s.domain))],
    riskScore: scriptsWithoutSRI.length > 0 ? 'medium' : 'low'
  };
}

// Detect provider type
function detectProviderType() {
  if (!window.ethereum) return 'none';
  
  if (window.ethereum.isMetaMask) return 'MetaMask';
  if (window.ethereum.isCoinbaseWallet) return 'Coinbase Wallet';
  if (window.ethereum.isFrame) return 'Frame';
  if (window.ethereum.isTrust) return 'Trust Wallet';
  if (window.ethereum.isImToken) return 'imToken';
  if (window.ethereum.isTokenPocket) return 'TokenPocket';
  if (window.ethereum.isMathWallet) return 'MathWallet';
  if (window.ethereum.isAlphaWallet) return 'AlphaWallet';
  if (window.ethereum.isBraveWallet) return 'Brave Wallet';
  if (window.ethereum.isRabby) return 'Rabby';
  if (window.ethereum.isOkxWallet) return 'OKX Wallet';
  
  // Check for WalletConnect
  if (window.WalletConnect || window.ethereum.isWalletConnect) return 'WalletConnect';
  
  return 'Unknown';
}

// Setup mutation observer for dynamic content
function setupMutationObserver() {
  if (!window.MutationObserver) return;
  
  const observer = new MutationObserver((mutations) => {
    let hasSignificantChanges = false;
    
    mutations.forEach((mutation) => {
      if (mutation.type === 'childList' && mutation.addedNodes.length > 0) {
        // Check if added nodes contain Web3-related content
        Array.from(mutation.addedNodes).forEach(node => {
          if (node.nodeType === Node.ELEMENT_NODE) {
            const element = node;
            const text = element.textContent?.toLowerCase() || '';
            const className = element.className?.toLowerCase() || '';
            
            if (text.includes('connect') || text.includes('wallet') || 
                text.includes('transaction') || text.includes('swap') ||
                className.includes('wallet') || className.includes('connect')) {
              hasSignificantChanges = true;
            }
          }
        });
      }
    });
    
    if (hasSignificantChanges) {
      logDebug('Significant DOM changes detected, re-analyzing...');
      // Debounce re-analysis
      clearTimeout(window.web3GuardianReanalysisTimeout);
      window.web3GuardianReanalysisTimeout = setTimeout(() => {
        analyzeDApp().then(dAppInfo => {
          sendMessageToBackground({
            type: 'DAPP_UPDATED',
            data: dAppInfo
          }).catch(err => logError('Failed to send updated dApp info:', err));
        });
      }, 2000);
    }
  });
  
  // Start observing
  observer.observe(document.body, {
    childList: true,
    subtree: true,
    attributes: false,
    characterData: false
  });
  
  return observer;
}

// Main initialization function
async function initialize() {
  if (isInitialized) {
    logDebug('Content script already initialized');
    return;
  }
  
  logInfo('🚀 Initializing Web3 Guardian content script...');
  
  try {
    // Detect and intercept Web3 provider
    const provider = await detectAndInterceptWeb3Provider();
    originalProvider = provider;
    
    // Create comprehensive proxy
    providerProxy = createProviderProxy(provider);
    
    // Replace the original provider with our proxy
    Object.defineProperty(window, 'ethereum', {
      value: providerProxy,
      writable: false,
      configurable: false
    });
    
    // Set up event listeners for provider events
    setupProviderEventListeners(providerProxy);
    
    // Perform initial dApp analysis
    const dAppInfo = await analyzeDApp();
    
    // Send initial analysis to background
    await sendMessageToBackground({
      type: 'DAPP_DETECTED',
      data: dAppInfo
    }).catch(err => logError('Failed to send initial dApp analysis:', err));
    
    // Set up periodic monitoring
    setupPeriodicMonitoring();
    
    // Set up network change monitoring
    setupNetworkMonitoring();
    
    // Set up account change monitoring
    setupAccountMonitoring();
    
    isInitialized = true;
    logInfo('✅ Web3 Guardian content script initialized successfully');
    
  } catch (error) {
    logError('❌ Failed to initialize Web3 Guardian:', error);
    
    // Still mark as initialized to prevent retry loops
    isInitialized = true;
    
    // Send error notification to background
    sendMessageToBackground({
      type: 'INITIALIZATION_ERROR',
      data: {
        error: error.message,
        url: window.location.href,
        timestamp: Date.now()
      }
    }).catch(err => logError('Failed to send initialization error:', err));
  }
}

// Set up provider event listeners
function setupProviderEventListeners(provider) {
  if (!provider || !provider.on) return;
  
  try {
    // Account changes
    provider.on('accountsChanged', (accounts) => {
      logInfo('🔄 Accounts changed:', accounts);
      connectedAccounts = accounts || [];
      
      sendMessageToBackground({
        type: 'ACCOUNTS_CHANGED',
        data: {
          accounts: connectedAccounts,
          url: window.location.href,
          timestamp: Date.now()
        }
      }).catch(err => logError('Failed to notify account change:', err));
    });
    
    // Chain changes
    provider.on('chainChanged', (chainId) => {
      logInfo('🔄 Chain changed:', chainId);
      currentChainId = chainId;
      
      sendMessageToBackground({
        type: 'CHAIN_CHANGED',
        data: {
          chainId,
          networkName: getNetworkName(parseInt(chainId, 16)),
          url: window.location.href,
          timestamp: Date.now()
        }
      }).catch(err => logError('Failed to notify chain change:', err));
    });
    
    // Connection changes
    provider.on('connect', (connectInfo) => {
      logInfo('🔗 Provider connected:', connectInfo);
      
      sendMessageToBackground({
        type: 'PROVIDER_CONNECTED',
        data: {
          ...connectInfo,
          url: window.location.href,
          timestamp: Date.now()
        }
      }).catch(err => logError('Failed to notify provider connection:', err));
    });
    
    // Disconnection
    provider.on('disconnect', (error) => {
      logInfo('🔌 Provider disconnected:', error);
      connectedAccounts = [];
      currentChainId = null;
      
      sendMessageToBackground({
        type: 'PROVIDER_DISCONNECTED',
        data: {
          error: error?.message || 'Unknown disconnection',
          url: window.location.href,
          timestamp: Date.now()
        }
      }).catch(err => logError('Failed to notify provider disconnection:', err));
    });
    
  } catch (error) {
    logError('Error setting up provider event listeners:', error);
  }
}

// Set up periodic monitoring
function setupPeriodicMonitoring() {
  // Monitor for new contract addresses every 30 seconds
  setInterval(async () => {
    try {
      const newAddresses = await extractContractAddressesAdvanced();
      if (newAddresses.length > 0) {
        sendMessageToBackground({
          type: 'NEW_CONTRACTS_DETECTED',
          data: {
            addresses: newAddresses,
            url: window.location.href,
            timestamp: Date.now()
          }
        }).catch(err => logError('Failed to send new contracts:', err));
      }
    } catch (error) {
      logError('Error in periodic contract monitoring:', error);
    }
  }, 30000);
  
  // Clean up old intercepted requests every 5 minutes
  setInterval(() => {
    const now = Date.now();
    const fiveMinutesAgo = now - (5 * 60 * 1000);
    
    for (const [requestId, request] of interceptedRequests.entries()) {
      if (request.timestamp < fiveMinutesAgo) {
        interceptedRequests.delete(requestId);
      }
    }
  }, 300000);
}

// Set up network monitoring
function setupNetworkMonitoring() {
  if (!window.ethereum) return;
  
  // Check network periodically
  setInterval(async () => {
    try {
      const chainId = await window.ethereum.request({ method: 'eth_chainId' });
      if (chainId !== currentChainId) {
        currentChainId = chainId;
        logInfo('🔄 Network change detected:', chainId);
        
        sendMessageToBackground({
          type: 'NETWORK_CHANGE_DETECTED',
          data: {
            chainId,
            networkName: getNetworkName(parseInt(chainId, 16)),
            url: window.location.href,
            timestamp: Date.now()
          }
        }).catch(err => logError('Failed to notify network change:', err));
      }
    } catch (error) {
      // Network request failed, possibly disconnected
      if (currentChainId !== null) {
        currentChainId = null;
        logInfo('🔌 Network disconnected');
      }
    }
  }, 10000); // Check every 10 seconds
}

// Set up account monitoring
function setupAccountMonitoring() {
  if (!window.ethereum) return;
  
  // Check accounts periodically
  setInterval(async () => {
    try {
      const accounts = await window.ethereum.request({ method: 'eth_accounts' });
      const accountsStr = JSON.stringify(accounts.sort());
      const currentAccountsStr = JSON.stringify(connectedAccounts.sort());
      
      if (accountsStr !== currentAccountsStr) {
        connectedAccounts = accounts || [];
        logInfo('🔄 Account change detected:', accounts);
        
        sendMessageToBackground({
          type: 'ACCOUNT_CHANGE_DETECTED',
          data: {
            accounts: connectedAccounts,
            url: window.location.href,
            timestamp: Date.now()
          }
        }).catch(err => logError('Failed to notify account change:', err));
      }
    } catch (error) {
      // Account request failed, possibly disconnected
      if (connectedAccounts.length > 0) {
        connectedAccounts = [];
        logInfo('🔌 Accounts disconnected');
      }
    }
  }, 15000); // Check every 15 seconds
}

// Enhanced error handling for uncaught errors
window.addEventListener('error', (event) => {
  if (event.error && event.error.message && event.error.message.includes('Web3 Guardian')) {
    logError('Web3 Guardian error caught:', {
      message: event.error.message,
      stack: event.error.stack,
      filename: event.filename,
      lineno: event.lineno,
      colno: event.colno
    });
    
    sendMessageToBackground({
      type: 'CONTENT_SCRIPT_ERROR',
      data: {
        error: event.error.message,
        stack: event.error.stack,
        url: window.location.href,
        timestamp: Date.now()
      }
    }).catch(err => logError('Failed to send error report:', err));
  }
});

// Enhanced unhandled promise rejection handling
window.addEventListener('unhandledrejection', (event) => {
  if (event.reason && event.reason.message && event.reason.message.includes('Web3 Guardian')) {
    logError('Web3 Guardian promise rejection:', event.reason);
    
    sendMessageToBackground({
      type: 'CONTENT_SCRIPT_REJECTION',
      data: {
        error: event.reason.message || 'Unknown promise rejection',
        url: window.location.href,
        timestamp: Date.now()
      }
    }).catch(err => logError('Failed to send rejection report:', err));
  }
});

// Page visibility change handling
document.addEventListener('visibilitychange', () => {
  if (document.visibilityState === 'visible') {
    logDebug('Page became visible, refreshing state...');
    
    // Refresh provider state when page becomes visible
    if (window.ethereum && isInitialized) {
      window.ethereum.request({ method: 'eth_accounts' })
        .then(accounts => {
          if (JSON.stringify(accounts) !== JSON.stringify(connectedAccounts)) {
            connectedAccounts = accounts || [];
            sendMessageToBackground({
              type: 'ACCOUNTS_REFRESHED',
              data: {
                accounts: connectedAccounts,
                url: window.location.href,
                timestamp: Date.now()
              }
            }).catch(err => logError('Failed to send account refresh:', err));
          }
        })
        .catch(err => logError('Failed to refresh accounts:', err));
    }
  }
});

// Handle page unload
window.addEventListener('beforeunload', () => {
  if (isInitialized) {
    sendMessageToBackground({
      type: 'PAGE_UNLOADING',
      data: {
        url: window.location.href,
        timestamp: Date.now(),
        sessionDuration: Date.now() - (window.web3GuardianStartTime || Date.now())
      }
    }).catch(() => {}); // Ignore errors on unload
  }
});

// Set start time for session tracking
window.web3GuardianStartTime = Date.now();

// Also try to initialize immediately in case provider is already available
setTimeout(initialize, 100);

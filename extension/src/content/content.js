import { logInfo, logError, logDebug } from "../utils/logger.js";

// Content script state
let isInitialized = false;
let originalProvider = null;
let providerProxy = null;
let interceptedRequests = new Map();
let connectedAccounts = [];
let currentChainId = null;

console.log('🛡️ Web3 Guardian content script loaded on', window.location.href);

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

// Handle contract interaction analysis
async function handleContractInteraction(args, requestId) {
  try {
    const contractData = {
      method: args.method,
      params: args.params,
      to: args.params[0]?.to,
      data: args.params[0]?.data
    };
    
    // Analyze contract interaction
    if (contractData.to && contractData.data) {
      await sendMessageToBackground({
        type: 'ANALYZE_CONTRACT_INTERACTION',
        data: {
          ...contractData,
          requestId,
          url: window.location.href
        }
      });
    }
    
    // Proceed with original request
    return await this.request.call(this, args);
    
  } catch (error) {
    logError('Contract interaction analysis failed:', error);
    // Don't block the request on analysis failure
    return await this.request.call(this, args);
  }
}

// Handle signing requests
async function handleSigningRequest(args, requestId) {
  try {
    const signingData = {
      method: args.method,
      params: args.params,
      message: args.params[1] || args.params[0]
    };
    
    logInfo('✍️ Signing request intercepted:', signingData.method);
    
    // Analyze signing request
    const analysisResult = await sendMessageToBackground({
      type: 'ANALYZE_SIGNING_REQUEST',  
      data: {
        ...signingData,
        requestId,
        url: window.location.href
      }
    });
    
    // Request user approval for signing
    const userApproved = await requestSigningApproval({
      ...signingData,
      ...analysisResult,
      type: 'signing'
    });
    
    if (!userApproved) {
      throw new Error('Signing request rejected by Web3 Guardian');
    }
    
    return await this.request.call(this, args);
    
  } catch (error) {
    logError('❌ Signing request failed:', error);
    throw error;
  }
}

// Analyze current dApp with comprehensive security data extraction
async function analyzeDApp() {
  const dAppInfo = {
    // Basic identification
    url: window.location.href,
    domain: window.location.hostname,
    title: document.title,
    description: document.querySelector('meta[name="description"]')?.content || '',
    favicon: document.querySelector('link[rel="icon"]')?.href || document.querySelector('link[rel="shortcut icon"]')?.href || '',
    
    // Web3 provider detection
    hasWeb3: !!window.Web3,
    hasEthers: !!window.ethers,
    hasWagmi: !!window.wagmi,
    hasRainbowKit: !!window.RainbowKit,
    hasWalletConnect: !!window.WalletConnect,
    providerType: detectProviderType(),
    
    // Smart contract addresses extraction
    contractAddresses: extractContractAddresses(),
    
    // Network information
    supportedNetworks: detectSupportedNetworks(),
    defaultNetwork: detectDefaultNetwork(),
    
    // Token information
    tokenContracts: extractTokenContracts(),
    nftContracts: extractNFTContracts(),
    
    // Security indicators
    hasObfuscatedCode: checkForObfuscation(),
    usesHttps: window.location.protocol === 'https:',
    hasContentSecurityPolicy: checkCSPHeaders(),
    hasSubResourceIntegrity: checkSRITags(),
    
    // External domains and resources
    externalDomains: getExternalDomains(),
    externalScripts: getExternalScripts(),
    iframes: getIframeInfo(),
    
    // dApp metadata
    manifestInfo: extractManifestInfo(),
    socialLinks: extractSocialLinks(),
    githubInfo: extractGithubInfo(),
    
    // Frontend framework detection
    framework: detectFramework(),
    buildTool: detectBuildTool(),
    
    // Security flags
    suspiciousPatterns: detectSuspiciousPatterns(),
    trustIndicators: detectTrustIndicators(),
    
    // Wallet interaction patterns
    walletMethods: detectWalletMethods(),
    permissionsRequested: [],
    
    // UI/UX analysis
    uiComplexity: analyzeUIComplexity(),
    hasTransactionPreview: checkTransactionPreview(),
    hasGasEstimation: checkGasEstimation(),
    
    timestamp: Date.now()
  };
  
  return dAppInfo;
}

// Enhanced contract address extraction
function extractContractAddresses() {
  const addresses = new Set();
  const addressRegex = /0x[a-fA-F0-9]{40}/g;
  
  // Search in page content
  const pageText = document.body.innerText;
  const matches = pageText.match(addressRegex);
  if (matches) {
    matches.forEach(addr => addresses.add(addr.toLowerCase()));
  }
  
  // Search in script contents
  Array.from(document.scripts).forEach(script => {
    if (script.textContent) {
      const scriptMatches = script.textContent.match(addressRegex);
      if (scriptMatches) {
        scriptMatches.forEach(addr => addresses.add(addr.toLowerCase()));
      }
    }
  });
  
  // Search in data attributes
  document.querySelectorAll('[data-*]').forEach(el => {
    Array.from(el.attributes).forEach(attr => {
      if (attr.value && attr.value.match(addressRegex)) {
        const attrMatches = attr.value.match(addressRegex);
        if (attrMatches) {
          attrMatches.forEach(addr => addresses.add(addr.toLowerCase()));
        }
      }
    });
  });
  
  // Common contract address locations
  const commonSelectors = [
    '[class*="contract"]',
    '[class*="address"]',
    '[id*="contract"]',
    '[id*="address"]',
    '[data-contract]',
    '[data-address]'
  ];
  
  commonSelectors.forEach(selector => {
    document.querySelectorAll(selector).forEach(el => {
      const text = el.textContent || el.value || el.getAttribute('data-contract') || el.getAttribute('data-address');
      if (text) {
        const selectorMatches = text.match(addressRegex);
        if (selectorMatches) {
          selectorMatches.forEach(addr => addresses.add(addr.toLowerCase()));
        }
      }
    });
  });
  
  return Array.from(addresses);
}

// Detect Web3 provider type
function detectProviderType() {
  if (window.ethereum?.isMetaMask) return 'MetaMask';
  if (window.ethereum?.isCoinbaseWallet) return 'Coinbase Wallet';
  if (window.ethereum?.isRabby) return 'Rabby';
  if (window.ethereum?.isTrust) return 'Trust Wallet';
  if (window.ethereum?.isPhantom) return 'Phantom';
  if (window.ethereum) return 'Generic Ethereum';
  return null;
}

// Detect supported networks
function detectSupportedNetworks() {
  const networks = [];
  const networkPatterns = [
    { name: 'Ethereum', patterns: ['ethereum', 'mainnet', 'eth'] },
    { name: 'Polygon', patterns: ['polygon', 'matic'] },
    { name: 'BSC', patterns: ['bsc', 'binance'] },
    { name: 'Arbitrum', patterns: ['arbitrum', 'arb'] },
    { name: 'Optimism', patterns: ['optimism', 'op'] },
    { name: 'Avalanche', patterns: ['avalanche', 'avax'] },
    { name: 'Fantom', patterns: ['fantom', 'ftm'] },
    { name: 'Solana', patterns: ['solana', 'sol'] }
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
      networks.push(network.name);
    }
  });
  
  return networks;
}

// Extract token contracts
function extractTokenContracts() {
  const tokens = [];
  
  // Look for common token patterns
  const tokenSelectors = [
    '[class*="token"]',
    '[data-token]',
    '[data-symbol]',
    '.currency',
    '.asset'
  ];
  
  tokenSelectors.forEach(selector => {
    document.querySelectorAll(selector).forEach(el => {
      const symbol = el.textContent?.match(/[A-Z]{2,6}/) || 
                    el.getAttribute('data-symbol') ||
                    el.getAttribute('data-token');
      
      const address = el.getAttribute('data-address') ||
                     el.textContent?.match(/0x[a-fA-F0-9]{40}/);
      
      if (symbol || address) {
        tokens.push({
          symbol: Array.isArray(symbol) ? symbol[0] : symbol,
          address: Array.isArray(address) ? address[0] : address,
          element: el.tagName
        });
      }
    });
  });
  
  return tokens;
}

// Extract NFT contracts
function extractNFTContracts() {
  const nfts = [];
  const nftKeywords = ['nft', 'erc721', 'erc1155', 'opensea', 'collection'];
  
  nftKeywords.forEach(keyword => {
    document.querySelectorAll(`[class*="${keyword}"], [id*="${keyword}"]`).forEach(el => {
      const address = el.textContent?.match(/0x[a-fA-F0-9]{40}/);
      if (address) {
        nfts.push({
          address: address[0],
          type: keyword,
          element: el.tagName
        });
      }
    });
  });
  
  return nfts;
}

// Check Content Security Policy
function checkCSPHeaders() {
  const cspMeta = document.querySelector('meta[http-equiv="Content-Security-Policy"]');
  return !!cspMeta;
}

// Check Subresource Integrity
function checkSRITags() {
  const scriptsWithSRI = document.querySelectorAll('script[integrity]');
  const linksWithSRI = document.querySelectorAll('link[integrity]');
  return scriptsWithSRI.length > 0 || linksWithSRI.length > 0;
}

// Get external scripts with security analysis
function getExternalScripts() {
  const scripts = [];
  const currentDomain = window.location.hostname;
  
  Array.from(document.scripts).forEach(script => {
    if (script.src) {
      try {
        const url = new URL(script.src);
        if (url.hostname !== currentDomain) {
          scripts.push({
            src: script.src,
            domain: url.hostname,
            hasIntegrity: !!script.integrity,
            async: script.async,
            defer: script.defer,
            crossOrigin: script.crossOrigin
          });
        }
      } catch (e) {
        scripts.push({
          src: script.src,
          domain: 'invalid-url',
          hasIntegrity: false
        });
      }
    }
  });
  
  return scripts;
}

// Get iframe information
function getIframeInfo() {
  const iframes = [];
  
  document.querySelectorAll('iframe').forEach(iframe => {
    try {
      const src = iframe.src;
      if (src) {
        const url = new URL(src);
        iframes.push({
          src: src,
          domain: url.hostname,
          sandbox: iframe.sandbox.toString(),
          allow: iframe.allow
        });
      }
    } catch (e) {
      iframes.push({
        src: iframe.src,
        domain: 'invalid-url',
        sandbox: iframe.sandbox?.toString() || '',
        allow: iframe.allow || ''
      });
    }
  });
  
  return iframes;
}

// Extract manifest information
function extractManifestInfo() {
  const manifest = document.querySelector('link[rel="manifest"]');
  if (!manifest) return null;
  
  return {
    href: manifest.href,
    crossOrigin: manifest.crossOrigin
  };
}

// Extract social links
function extractSocialLinks() {
  const socialLinks = {};
  const socialPatterns = {
    twitter: /twitter\.com|x\.com/,
    github: /github\.com/,
    discord: /discord\.(gg|com)/,
    telegram: /t\.me|telegram\.org/,
    medium: /medium\.com/,
    reddit: /reddit\.com/
  };
  
  document.querySelectorAll('a[href]').forEach(link => {
    const href = link.href;
    Object.entries(socialPatterns).forEach(([platform, pattern]) => {
      if (pattern.test(href)) {
        if (!socialLinks[platform]) {
          socialLinks[platform] = [];
        }
        socialLinks[platform].push(href);
      }
    });
  });
  
  return socialLinks;
}

// Extract GitHub information
function extractGithubInfo() {
  const githubLinks = [];
  document.querySelectorAll('a[href*="github.com"]').forEach(link => {
    const match = link.href.match(/github\.com\/([^\/]+)\/([^\/]+)/);
    if (match) {
      githubLinks.push({
        url: link.href,
        owner: match[1],
        repo: match[2]
      });
    }
  });
  
  return githubLinks;
}

// Detect frontend framework
function detectFramework() {
  if (window.React || document.querySelector('[data-reactroot]')) return 'React';
  if (window.Vue || document.querySelector('[data-v-]')) return 'Vue.js';
  if (window.angular || document.querySelector('[ng-app]')) return 'Angular';
  if (document.querySelector('[data-svelte]')) return 'Svelte';
  if (window.Ember) return 'Ember.js';
  return 'Unknown';
}

// Detect build tool
function detectBuildTool() {
  const scripts = Array.from(document.scripts).map(s => s.src).join('');
  if (scripts.includes('webpack')) return 'Webpack';
  if (scripts.includes('vite')) return 'Vite';
  if (scripts.includes('parcel')) return 'Parcel';
  if (scripts.includes('rollup')) return 'Rollup';
  return 'Unknown';
}

// Detect suspicious patterns
function detectSuspiciousPatterns() {
  const patterns = [];
  const content = document.body.innerText.toLowerCase();
  
  // Suspicious phrases
  const suspiciousPhrases = [
    'send eth to claim',
    'limited time offer',
    'urgent action required',
    'claim free tokens',
    'airdrop ending soon',
    'verify your wallet',
    'connect to claim',
    'approve transaction to receive'
  ];
  
  suspiciousPhrases.forEach(phrase => {
    if (content.includes(phrase)) {
      patterns.push(`suspicious_phrase_${phrase.replace(/\s+/g, '_')}`);
    }
  });
  
  // Check for fake domain indicators
  const domain = window.location.hostname;
  if (domain.includes('metamask') || domain.includes('uniswap') || domain.includes('opensea')) {
    if (!domain.endsWith('.app') && !domain.endsWith('.com') && !domain.endsWith('.org')) {
      patterns.push('potential_domain_spoofing');
    }
  }
  
  return patterns;
}

// Detect trust indicators
function detectTrustIndicators() {
  const indicators = [];
  
  // SSL/HTTPS
  if (window.location.protocol === 'https:') {
    indicators.push('https_enabled');
  }
  
  // Verified contracts (look for verification badges)
  if (document.querySelector('[class*="verified"], [class*="badge"]')) {
    indicators.push('verification_badges');
  }
  
  // Audit information
  const content = document.body.innerText.toLowerCase();
  const auditKeywords = ['audit', 'certik', 'consensys', 'trail of bits', 'openzeppelin'];
  auditKeywords.forEach(keyword => {
    if (content.includes(keyword)) {
      indicators.push(`audit_${keyword.replace(/\s+/g, '_')}`);
    }
  });
  
  return indicators;
}

// Detect wallet interaction methods
function detectWalletMethods() {
  const methods = [];
  const scriptContent = Array.from(document.scripts)
    .map(script => script.textContent || '')
    .join(' ');
  
  const walletMethods = [
    'eth_requestAccounts',
    'eth_sendTransaction',
    'eth_signTransaction',
    'personal_sign',
    'eth_signTypedData',
    'wallet_addEthereumChain',
    'wallet_switchEthereumChain'
  ];
  
  walletMethods.forEach(method => {
    if (scriptContent.includes(method)) {
      methods.push(method);
    }
  });
  
  return methods;
}

// Analyze UI complexity
function analyzeUIComplexity() {
  const complexity = {
    totalElements: document.querySelectorAll('*').length,
    forms: document.querySelectorAll('form').length,
    inputs: document.querySelectorAll('input').length,
    buttons: document.querySelectorAll('button').length,
    modals: document.querySelectorAll('[class*="modal"], [class*="popup"]').length,
    animations: document.querySelectorAll('[class*="animate"], [style*="animation"]').length
  };
  
  return complexity;
}

// Check for transaction preview functionality
function checkTransactionPreview() {
  const previewSelectors = [
    '[class*="preview"]',
    '[class*="summary"]',
    '[class*="review"]',
    '[id*="preview"]',
    '[data-testid*="preview"]'
  ];
  
  return previewSelectors.some(selector => 
    document.querySelector(selector) !== null
  );
}

// Check for gas estimation
function checkGasEstimation() {
  const gasSelectors = [
    '[class*="gas"]',
    '[class*="fee"]',
    '[id*="gas"]',
    '[data-testid*="gas"]'
  ];
  
  const content = document.body.innerText.toLowerCase();
  return gasSelectors.some(selector => document.querySelector(selector) !== null) ||
         content.includes('gas') || content.includes('gwei') || content.includes('fee');
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

// Initialize the content script
async function initialize() {
  if (isInitialized) {
    logDebug('Content script already initialized');
    return;
  }
  
  try {
    logInfo('Initializing Web3 Guardian content script...');
    
    // Detect Web3 provider
    originalProvider = await detectAndInterceptWeb3Provider();
    logInfo('Web3 provider detected:', originalProvider.constructor.name);
    
    // Create and install proxy
    providerProxy = createProviderProxy(originalProvider);
    
    // Replace the global provider with our proxy
    Object.defineProperty(window, 'ethereum', {
      value: providerProxy,
      writable: false,
      configurable: false
    });
    
    // Listen for account and chain changes
    setupProviderEventListeners();
    
    isInitialized = true;
    logInfo('✅ Web3 Guardian content script initialized successfully');
    
    // Notify background script
    try {
      await sendMessageToBackground({ type: 'CONTENT_SCRIPT_READY' }, 2000);
    } catch (error) {
      logError('Failed to notify background script:', error);
    }
    
  } catch (error) {
    logError('Failed to initialize Web3 Guardian:', error);
  }
}

// Setup provider event listeners
function setupProviderEventListeners() {
  if (!originalProvider) return;
  
  // Listen for account changes
  originalProvider.on?.('accountsChanged', (accounts) => {
    logInfo('Accounts changed:', accounts);
    chrome.runtime.sendMessage({
      type: 'ACCOUNTS_CHANGED',
      accounts
    }).catch(err => logError('Failed to notify account change:', err));
  });
  
  // Listen for chain changes
  originalProvider.on?.('chainChanged', (chainId) => {
    logInfo('Chain changed:', chainId);
    chrome.runtime.sendMessage({
      type: 'CHAIN_CHANGED',
      chainId
    }).catch(err => logError('Failed to notify chain change:', err));
  });
  
  // Listen for connection events
  originalProvider.on?.('connect', (connectInfo) => {
    logInfo('Provider connected:', connectInfo);
  });
  
  originalProvider.on?.('disconnect', (error) => {
    logInfo('Provider disconnected:', error);
  });
}

// Initialize when DOM is ready
if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', initialize);
} else {
  initialize();
}

// Also try to initialize immediately in case provider is already available
setTimeout(initialize, 100);

// Export functions for testing
if (typeof module !== 'undefined' && module.exports) {
  module.exports = {
    initialize,
    detectAndInterceptWeb3Provider,
    extractPageTransactionData,
    getTransactionStatus
  };
}

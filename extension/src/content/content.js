import { logInfo, logError, logDebug } from "../utils/logger.js";

// Content script state
let isInitialized = false;
let originalProvider = null;
let providerProxy = null;
let transactionQueue = new Map();
let messageId = 0;

console.log('🛡️ Web3 Guardian content script loaded on', window.location.href);

// EIP-1193 compliant provider detection
function detectWeb3Provider() {
  // Check for existing provider
  if (window.ethereum) {
    return window.ethereum;
  }
  
  // Listen for provider injection (some wallets inject asynchronously)
  return new Promise((resolve, reject) => {
    const timeout = setTimeout(() => {
      reject(new Error('No Web3 provider detected within timeout'));
    }, 3000);
    
    const checkProvider = () => {
      if (window.ethereum) {
        clearTimeout(timeout);
        resolve(window.ethereum);
      }
    };
    
    // Check immediately and then poll
    checkProvider();
    const interval = setInterval(checkProvider, 100);
    
    // Listen for provider injection events
    window.addEventListener('ethereum#initialized', () => {
      clearTimeout(timeout);
      clearInterval(interval);
      resolve(window.ethereum);
    });
    
    // Some providers use different events
    document.addEventListener('DOMContentLoaded', checkProvider);
  });
}

// Create a proxy for the Web3 provider
function createProviderProxy(originalProvider) {
  const handler = {
    get(target, prop) {
      const value = target[prop];
      
      // Intercept the request method (EIP-1193)
      if (prop === 'request') {
        return async function(args) {
          return await handleProviderRequest.call(target, args, 'request');
        };
      }
      
      // Intercept legacy methods
      if (prop === 'send' || prop === 'sendAsync') {
        return function(...args) {
          return handleLegacyProviderCall.call(target, prop, args);
        };
      }
      
      // Bind functions to original context
      if (typeof value === 'function') {
        return value.bind(target);
      }
      
      return value;
    },
    
    set(target, prop, value) {
      // Prevent overriding our intercepted methods
      if (['request', 'send', 'sendAsync'].includes(prop)) {
        logDebug(`Prevented override of ${prop} method`);
        return true;
      }
      target[prop] = value;
      return true;
    }
  };
  
  return new Proxy(originalProvider, handler);
}

// Handle EIP-1193 provider requests
async function handleProviderRequest(args, method = 'request') {
  const { method: rpcMethod, params } = args;
  
  logDebug(`Intercepted ${method}:`, { rpcMethod, params });
  
  // Handle account access requests
  if (rpcMethod === 'eth_requestAccounts' || rpcMethod === 'eth_accounts') {
    // Allow wallet connection requests to pass through
    return await this.request.call(this, args);
  }
  
  // Intercept transaction requests
  if (rpcMethod === 'eth_sendTransaction' || rpcMethod === 'eth_signTransaction') {
    const transaction = params?.[0];
    if (transaction) {
      const approved = await analyzeAndRequestApproval(transaction, rpcMethod);
      if (!approved) {
        throw new Error('Transaction rejected by Web3 Guardian');
      }
    }
  }
  
  // Pass through all other requests to the original provider
  return await this.request.call(this, args);
}

// Handle legacy provider calls (send/sendAsync)
function handleLegacyProviderCall(method, args) {
  const [payload, callback] = args;
  
  if (payload && (payload.method === 'eth_sendTransaction' || payload.method === 'eth_signTransaction')) {
    const transaction = payload.params?.[0];
    if (transaction) {
      analyzeAndRequestApproval(transaction, payload.method)
        .then((approved) => {
          if (approved) {
            return this[method].call(this, ...args);
          } else {
            const error = new Error('Transaction rejected by Web3 Guardian');
            if (callback) callback(error);
            else throw error;
          }
        })
        .catch((error) => {
          if (callback) callback(error);
          else throw error;
        });
      return;
    }
  }
  
  // Pass through non-transaction requests
  return this[method].call(this, ...args);
}

// Analyze transaction and request user approval
async function analyzeAndRequestApproval(transaction, method) {
  try {
    const messageId = generateMessageId();
    const enrichedTransaction = await enrichTransactionData(transaction);
    
    logInfo('Analyzing transaction:', enrichedTransaction);
    
    // Send to background script for analysis
    const analysisResult = await sendMessageWithTimeout({
      type: 'ANALYZE_TRANSACTION',
      data: {
        ...enrichedTransaction,
        method,
        origin: window.location.origin,
        messageId
      }
    }, 10000);
    
    if (!analysisResult.success) {
      logError('Transaction analysis failed:', analysisResult.error);
      // Still allow transaction but warn user
      return await requestUserApproval({
        ...enrichedTransaction,
        riskLevel: 'unknown',
        recommendations: ['Analysis failed: ' + (analysisResult.error || 'Unknown error')]
      });
    }
    
    // Request user approval with analysis results
    return await requestUserApproval({
      ...enrichedTransaction,
      ...analysisResult,
      messageId
    });
    
  } catch (error) {
    logError('Error in transaction analysis:', error);
    // In case of error, still show transaction to user with warning
    return await requestUserApproval({
      ...transaction,
      riskLevel: 'error',
      recommendations: ['Error analyzing transaction: ' + error.message]
    });
  }
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

// Request user approval through popup
async function requestUserApproval(transactionData) {
  const messageId = generateMessageId();
  
  try {
    // Store transaction in queue
    transactionQueue.set(messageId, transactionData);
    
    // Request popup to show transaction
    const response = await sendMessageWithTimeout({
      type: 'SHOW_TRANSACTION_POPUP',
      data: { ...transactionData, messageId }
    }, 5000);
    
    if (!response.success) {
      throw new Error(response.error || 'Failed to show transaction popup');
    }
    
    // Wait for user decision
    return new Promise((resolve, reject) => {
      const timeout = setTimeout(() => {
        transactionQueue.delete(messageId);
        reject(new Error('User approval timeout'));
      }, 60000); // 60 second timeout
      
      // Listen for user response
      const messageListener = (message) => {
        if (message.type === 'TRANSACTION_DECISION' && message.messageId === messageId) {
          clearTimeout(timeout);
          transactionQueue.delete(messageId);
          chrome.runtime.onMessage.removeListener(messageListener);
          resolve(message.approved);
        }
      };
      
      chrome.runtime.onMessage.addListener(messageListener);
    });
    
  } catch (error) {
    transactionQueue.delete(messageId);
    logError('Error requesting user approval:', error);
    throw error;
  }
}

// Send message with timeout
function sendMessageWithTimeout(message, timeout = 5000) {
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
    pendingTransactions: transactionQueue.size,
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
function generateMessageId() {
  return `msg_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
}

function parseHexValue(hex) {
  if (typeof hex === 'string' && hex.startsWith('0x')) {
    return parseInt(hex, 16).toString();
  }
  return hex;
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
    originalProvider = await detectWeb3Provider();
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
      await sendMessageWithTimeout({ type: 'CONTENT_SCRIPT_READY' }, 2000);
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
    detectWeb3Provider,
    extractPageTransactionData,
    getTransactionStatus
  };
}

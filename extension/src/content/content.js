// Content script that runs in the context of web pages
// Intercepts and analyzes Web3 transactions

console.log('Web3 Guardian content script loaded on', window.location.href);
console.log('Content script injected at:', new Date().toISOString());

// Store the original provider
let ORIGINAL_PROVIDER = window.ethereum;

// Initialize the content script
function initialize() {
  if (!window.ethereum) {
    logError("No Web3 provider detected on page load");
    // Poll for provider injection
    const checkForProvider = setInterval(() => {
      if (window.ethereum) {
        logInfo("Web3 provider detected after delay");
        originalProvider = window.ethereum;
        setupWeb3Interception();
        clearInterval(checkForProvider);
      }
    }, 1000);
    // Stop polling after 10 seconds
    setTimeout(() => clearInterval(checkForProvider), 10000);
  } else {
    logInfo("Original Web3 provider detected", window.ethereum);
    setupWeb3Interception();
  }
}


// Add a message listener for the background script
chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
  console.log('Content script received message:', request.type);
  
  if (request.type === 'PING') {
    console.log('PING received, responding with PONG');
    sendResponse({ type: 'PONG' });
    return true;
  }
  
  if (request.type === 'GET_TRANSACTION_STATUS') {
    try {
      const transactionData = getTransactionData();
      console.log('Sending transaction data to background');
      sendResponse({
        success: true,
        data: transactionData,
        timestamp: new Date().toISOString()
      });
    } catch (error) {
      console.error('Error getting transaction status:', error);
      sendResponse({
        success: false,
        error: error.message,
        timestamp: new Date().toISOString()
      });
    }
    return true; // Keep the message channel open for async response
  }
  
  return false;
});

// Notify the background script that we're ready
console.log('Content script initialized');

// Store the original provider if it exists
if (window.ethereum) {
  console.log('Original Web3 provider detected:', window.ethereum);
  ORIGINAL_PROVIDER = window.ethereum;
} else {
  console.warn('No Web3 provider detected on page load');
  // Try to detect if Web3 is injected later
  const checkForProvider = setInterval(() => {
    if (window.ethereum) {
      console.log('Web3 provider detected after delay');
      ORIGINAL_PROVIDER = window.ethereum;
      initProviderWrapper();
      clearInterval(checkForProvider);
    }
  }, 1000);
  
  // Stop checking after 10 seconds
  setTimeout(() => {
    clearInterval(checkForProvider);
  }, 10000);
}

// Function to wrap the provider methods
function wrapProvider(provider) {
  if (!provider) return null;
  
  // Create a proxy for the provider
  const handler = {
    get(target, prop) {
      // Intercept method calls
      if (typeof target[prop] === 'function') {
        return new Proxy(target[prop], {
          apply: (target, thisArg, args) => {
            console.log(`Intercepted ${prop} call:`, args);
            
            // Handle different method types
            switch (prop) {
              case 'request':
                return handleRequest(args[0]);
              case 'send':
              case 'sendAsync':
                return handleLegacyRequest(args[0], args[1]);
              default:
                return target.apply(thisArg, args);
            }
          }
        });
      }
      return target[prop];
    },
    set(target, prop, value) {
      // Prevent overwriting our wrapped methods
      if (prop === 'request' || prop === 'send' || prop === 'sendAsync') {
        console.warn(`Prevented overwrite of ${prop} method`);
        return true;
      }
      target[prop] = value;
      return true;
    }
  };
  
  // Create and return the proxy
  return new Proxy(provider, handler);
}

// Handle EIP-1193 provider requests
async function handleRequest(request) {
  console.log('Handling request:', request);
  
  // Intercept account and transaction requests
  if (request.method === 'eth_requestAccounts' || 
      request.method === 'eth_accounts') {
    console.log('Intercepted account access request');
    // Forward to the original provider
    return ORIGINAL_PROVIDER.request(request);
  }
  
  if (request.method === 'eth_sendTransaction' || 
      request.method === 'eth_signTransaction') {
    console.log('Intercepted transaction request:', request);
    
    try {
      // Send to background for analysis
      const response = await chrome.runtime.sendMessage({
        type: 'ANALYZE_TRANSACTION',
        data: request.params[0]
      });
      
      console.log('Analysis response:', response);
      
      // If transaction is approved, send it to the original provider
      if (response && response.approved) {
        console.log('Transaction approved, sending to provider');
        return ORIGINAL_PROVIDER.request(request);
      } else {
        console.log('Transaction rejected by user');
        throw new Error('Transaction rejected by Web3 Guardian');
      }
    } catch (error) {
      console.error('Error handling transaction:', error);
      throw error;
    }
  }
  
  // Forward all other requests to the original provider
  return ORIGINAL_PROVIDER.request(request);
}

// Handle legacy provider requests
function handleLegacyRequest(method, params) {
  console.log('Handling legacy request:', method, params);
  
  // Convert to EIP-1193 format
  const request = { method, params };
  const promise = handleRequest(request);
  
  // Convert to callback style if needed
  if (typeof params === 'function' || Array.isArray(params)) {
    return promise.then(
      result => params[1]?.(null, { result }),
      error => params[1]?.(error, null)
    );
  }
  
  return promise;
}

// Initialize the provider wrapper
function initProviderWrapper() {
  if (!window.ethereum) {
    console.warn('No Web3 provider detected');
    return;
  }
  
  console.log('Wrapping Web3 provider');
  
  // Wrap the provider
  const wrappedProvider = wrapProvider(window.ethereum);
  
  // Replace the global provider
  Object.defineProperty(window, 'ethereum', {
    value: wrappedProvider,
    configurable: false,
    writable: false
  });
  
  console.log('Web3 provider wrapped successfully');
}

// Initialize when the page loads
if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', initProviderWrapper);
} else {
  initProviderWrapper();
}

// Listen for messages from the popup and background script
chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
  console.log('Content script received message:', request.type, 'from:', sender);
  
  if (request.type === 'GET_TRANSACTION_STATUS') {
    try {
      console.log('Getting transaction status...');
      const transactionData = getTransactionData();
      console.log('Sending transaction data:', transactionData);
      sendResponse({
        success: true,
        data: transactionData,
        timestamp: new Date().toISOString()
      });
    } catch (error) {
      console.error('Error getting transaction status:', error);
      sendResponse({
        success: false,
        error: error.message,
        timestamp: new Date().toISOString()
      });
    }
    return true; // Keep the message channel open for async response
  }
  
  // Handle other message types here if needed
  return false;
});

// Log when the message listener is registered
console.log('Content script message listener registered');

// Function to extract transaction data from the page
function getTransactionData() {
  // Get the connected wallet address
  const from = window.ethereum?.selectedAddress || '0x000...';
  
  // Return null if no wallet is connected
  if (from === '0x000...') {
    return null;
  }
  
  // Get transaction data from the page if available
  // This is a simplified example - you may need to adjust selectors based on the dApp
  let to = document.querySelector('[data-testid="transaction-to-address"]')?.innerText ||
           document.querySelector('[data-testid="recipient-address"]')?.innerText ||
           'Unknown';
  
  // Clean up the address if it contains additional text
  to = to.replace('To: ', '').trim();
  
  // Get token amount and symbol if available
  const amountElement = document.querySelector('[data-testid*="amount"]') ||
                       document.querySelector('[data-testid*="input-amount"]');
  const tokenElement = document.querySelector('[data-testid*="token-amount"]') ||
                      document.querySelector('[data-testid*="token-symbol"]');
  
  const value = amountElement?.innerText || '0';
  const token = tokenElement?.innerText?.replace(/[0-9.,]/g, '').trim() || 'ETH';
  
  return {
    from,
    to,
    value,
    token,
    timestamp: new Date().toISOString(),
    network: window.ethereum?.networkVersion || '1',
    // These will be populated when we intercept the actual transaction
    gas: null,
    nonce: null,
    data: null,
    // These will be set by the background script after analysis
    riskLevel: null,
    recommendations: []
  };
}

// Listen for transaction events from Web3 providers
function setupWeb3Interception() {
  if (!window.ethereum) {
    console.log('No Web3 provider detected');
    return;
  }

  // Store the original methods
  const originalMethods = {
    send: window.ethereum.send,
    sendAsync: window.ethereum.sendAsync,
    request: window.ethereum.request,
    enable: window.ethereum.enable
  };

  // Helper function to handle transaction data
  async function handleTransaction(transaction) {
    try {
      // Get basic transaction data from the page
      const txData = getTransactionData();
      
      // Merge with transaction details
      const fullTxData = {
        ...txData,
        ...transaction,
        // Convert hex values to decimal for better readability
        value: transaction.value ? parseInt(transaction.value, 16) : 0,
        gas: transaction.gas ? parseInt(transaction.gas, 16) : null,
        gasPrice: transaction.gasPrice ? parseInt(transaction.gasPrice, 16) : null,
        nonce: transaction.nonce ? parseInt(transaction.nonce, 16) : null
      };
      
      console.log('Intercepted transaction:', fullTxData);
      
      // Send to background for analysis
      let response;
      try {
        response = await new Promise((resolve, reject) => {
          chrome.runtime.sendMessage(
            {
              type: 'ANALYZE_TRANSACTION',
              data: fullTxData
            },
            (result) => {
              if (chrome.runtime.lastError) {
                console.error('Error in message handler:', chrome.runtime.lastError);
                reject(chrome.runtime.lastError);
              } else {
                resolve(result);
              }
            }
          );
        });
        
        console.log('Analysis response:', response);
        
        if (!response || response.error) {
          throw new Error(response?.error || 'Invalid response from background script');
        }
        
        // Show the popup with transaction details
        chrome.runtime.sendMessage({
          type: 'SHOW_TRANSACTION',
          data: {
            ...fullTxData,
            riskLevel: response.riskLevel || 'unknown',
            recommendations: response.recommendations || ['Unable to analyze transaction']
          }
        });
        
      } catch (error) {
        console.error('Error during transaction analysis:', error);
        // Show error in popup
        chrome.runtime.sendMessage({
          type: 'SHOW_TRANSACTION',
          data: {
            ...fullTxData,
            riskLevel: 'error',
            recommendations: [
              'Error analyzing transaction',
              error.message || 'Unknown error occurred'
            ]
          }
        });
      }
      
      // Wait for user response
      return new Promise((resolve, reject) => {
        chrome.runtime.onMessage.addListener(function listener(msg) {
          if (msg.type === 'TRANSACTION_RESPONSE') {
            chrome.runtime.onMessage.removeListener(listener);
            if (msg.approved) {
              resolve(msg.data);
            } else {
              reject(new Error('Transaction rejected by user'));
            }
          }
        });
      });
    } catch (error) {
      console.error('Error handling transaction:', error);
      throw error;
    }
  }

  // Override the request method (used by most modern dApps)
  window.ethereum.request = async function(payload) {
    console.log('Intercepted request:', payload);
    
    // Handle transaction requests
    if (payload.method === 'eth_sendTransaction' || 
        payload.method === 'eth_signTransaction') {
      const transaction = payload.params[0];
      await handleTransaction(transaction);
    }
    
    // Call the original method
    return originalMethods.request.call(this, payload);
  };
  
  // Override the send method (legacy)
  window.ethereum.send = function(method, params) {
    console.log('Intercepted send:', { method, params });
    
    if (method === 'eth_sendTransaction' || 
        method === 'eth_signTransaction') {
      const transaction = Array.isArray(params) ? params[0] : params;
      return handleTransaction(transaction)
        .then(() => originalMethods.send.call(this, method, params));
    }
    
    return originalMethods.send.call(this, method, params);
  };
  
  // Override sendAsync (legacy)
  if (originalMethods.sendAsync) {
    window.ethereum.sendAsync = function(payload, callback) {
      console.log('Intercepted sendAsync:', payload);
      
      if (payload.method === 'eth_sendTransaction' || 
          payload.method === 'eth_signTransaction') {
        const transaction = payload.params[0];
        handleTransaction(transaction)
          .then(() => originalMethods.sendAsync.call(this, payload, callback))
          .catch(callback);
        return;
      }
      
      return originalMethods.sendAsync.call(this, payload, callback);
    };
  }
}

// Initialize the content script
if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', setupWeb3Interception);
} else {
  setupWeb3Interception();
}

// Listen for Web3 injection
const observer = new MutationObserver((mutations) => {
  if (window.ethereum) {
    setupWeb3Interception();
    observer.disconnect();
  }
});

observer.observe(document, { childList: true, subtree: true });

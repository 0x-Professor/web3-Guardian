// Content script that runs in the context of web pages
// Intercepts and analyzes Web3 transactions

console.log('Web3 Guardian content script loaded');

// Listen for messages from the popup
chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
  if (request.type === 'GET_TRANSACTION_STATUS') {
    // Get the current transaction data from the page
    const transactionData = getTransactionData();
    sendResponse(transactionData);
    return true; // Keep the message channel open for async response
  }
  return false;
});

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
      const response = await new Promise((resolve) => {
        chrome.runtime.sendMessage({
          type: 'ANALYZE_TRANSACTION',
          data: fullTxData
        }, resolve);
      });
      
      // Show the popup with transaction details
      chrome.runtime.sendMessage({
        type: 'SHOW_TRANSACTION',
        data: {
          ...fullTxData,
          riskLevel: response.riskLevel,
          recommendations: response.recommendations || []
        }
      });
      
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

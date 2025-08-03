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

  // Store the original send method
  const originalSend = window.ethereum.send || window.ethereum.sendAsync;
  
  if (!originalSend) {
    console.log('Could not intercept Web3 provider');
    return;
  }

  // Override the send method
  window.ethereum.send = function(method, params) {
    console.log('Intercepted Web3 transaction:', { method, params });
    
    // Show the extension popup for transaction review
    chrome.runtime.sendMessage({
      type: 'SHOW_TRANSACTION',
      data: { method, params }
    });
    
    // Return a promise that resolves when the user approves/rejects
    return new Promise((resolve, reject) => {
      chrome.runtime.onMessage.addListener(function listener(response) {
        if (response.type === 'TRANSACTION_RESPONSE') {
          chrome.runtime.onMessage.removeListener(listener);
          if (response.approved) {
            // User approved, proceed with the original transaction
            originalSend.call(window.ethereum, method, params)
              .then(resolve)
              .catch(reject);
          } else {
            // User rejected
            reject(new Error('Transaction rejected by user'));
          }
        }
      });
    });
  };
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

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
  // This is a simplified example - in a real implementation,
  // you would extract transaction details from the page
  // or from the Web3 provider
  
  return {
    from: window.ethereum?.selectedAddress || '0x000...',
    to: document.querySelector('[data-testid="page-container"]')?.innerText || 'Unknown',
    value: '0.01',
    gas: '21000',
    nonce: '0',
    data: '0x',
    riskLevel: 'low',
    recommendations: [
      'Transaction appears safe',
      'Gas price is optimal'
    ]
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

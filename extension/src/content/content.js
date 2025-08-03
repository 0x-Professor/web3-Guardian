// Content script that runs in the context of web pages
// Intercepts and analyzes Web3 transactions

console.log('Web3 Guardian content script loaded');

// Listen for messages from the background script
chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
  if (request.type === 'ANALYZE_TRANSACTION') {
    analyzeTransaction(request.data)
      .then(result => sendResponse({ success: true, data: result }))
      .catch(error => sendResponse({ success: false, error: error.message }));
    return true; // Required for async response
  }
});

// Detect and intercept Web3 transactions
function setupWeb3Interception() {
  // This is a simplified example - in a real implementation, you would need to
  // hook into the page's Web3 provider to intercept transactions
  
  // Store original send method
  const originalSend = window.ethereum?.sendAsync || window.ethereum?.send;
  
  if (!originalSend) {
    console.log('No Web3 provider detected');
    return;
  }
  
  // Override send method
  window.ethereum.sendAsync = function(method, params) {
    console.log('Intercepted Web3 transaction:', { method, params });
    
    // Send transaction details to background script for analysis
    return new Promise((resolve, reject) => {
      chrome.runtime.sendMessage(
        {
          type: 'WEB3_TRANSACTION',
          data: { method, params, origin: window.location.origin }
        },
        (response) => {
          if (response && response.shouldProceed) {
            // Proceed with original transaction
            originalSend.call(window.ethereum, method, params)
              .then(resolve)
              .catch(reject);
          } else {
            // User rejected or error occurred
            reject(new Error('Transaction was rejected by Web3 Guardian'));
          }
        }
      );
    });
  };
}

// Analyze transaction details
async function analyzeTransaction(txData) {
  try {
    // Send to background script for analysis
    const response = await new Promise((resolve) => {
      chrome.runtime.sendMessage(
        { type: 'ANALYZE_TRANSACTION', data: txData },
        resolve
      );
    });
    
    return {
      riskLevel: response.riskLevel || 'medium',
      recommendations: response.recommendations || [],
      gasEstimate: response.gasEstimate,
      simulation: response.simulation
    };
  } catch (error) {
    console.error('Error analyzing transaction:', error);
    return {
      riskLevel: 'unknown',
      error: error.message
    };
  }
}

// Initialize interception when the page loads
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

// Wait for the DOM to be fully loaded
document.addEventListener('DOMContentLoaded', function() {
  // Get DOM elements
  const loadingElement = document.getElementById('loading');
  const statusElement = document.getElementById('status');
  const transactionDetails = document.getElementById('transaction-details');
  const detailsElement = document.getElementById('details');
  const approveBtn = document.getElementById('approve-btn');
  const rejectBtn = document.getElementById('reject-btn');
  
  // Set initial UI state
  showLoading('Connecting to Web3 Guardian...');
  
  // Initialize the popup with retry logic
  let retryCount = 0;
  const MAX_RETRIES = 3;
  const RETRY_DELAY = 500; // ms
  
  // Start initialization
  initPopup().catch(error => {
    console.error('Popup initialization failed:', error);
    showMessage('Failed to initialize. Please try again.', 'error');
  });

  // Initialize the popup
async function initPopup() {
  try {
    // Get the active tab
    const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
    
    if (!tab) {
      showError('No active tab found');
      return;
    }
    
    console.log('Initializing popup for tab:', tab.url);
    
    // Try to get transaction status with retry logic
    let response;
    let retryCount = 0;
    const MAX_RETRIES = 3;
    const RETRY_DELAY = 1000; // ms
    
    while (retryCount < MAX_RETRIES) {
      try {
        console.log(`Attempt ${retryCount + 1}/${MAX_RETRIES} to connect to content script...`);
        
        // First try to get the transaction status
        response = await new Promise((resolve, reject) => {
          chrome.runtime.sendMessage(
            { type: 'GET_TRANSACTION_STATUS' },
            (response) => {
              if (chrome.runtime.lastError) {
                reject(chrome.runtime.lastError);
              } else if (!response) {
                reject(new Error('No response from background script'));
              } else if (response.error) {
                reject(new Error(response.error));
              } else {
                resolve(response);
              }
            }
          );
          
          // Set a timeout for the response
          setTimeout(() => {
            if (!response) {
              reject(new Error('Timeout waiting for content script response'));
            }
          }, 5000); // 5 second timeout
        });
      } catch (error) {
        console.error('Error communicating with content script:', error);
        if (retryCount < MAX_RETRIES) {
          retryCount++;
          const delay = RETRY_DELAY * retryCount; // Exponential backoff
          console.log(`Retry ${retryCount}/${MAX_RETRIES} in ${delay}ms...`);
          await new Promise(resolve => setTimeout(resolve, delay));
          return initPopup();
        }
        throw new Error(`Could not connect to the content script: ${error.message}`);
      }
      
      if (response && response.success === false) {
        throw new Error(response.error || 'Failed to analyze transaction');
      }
      
      if (response) {
        updateUI(response);
      } else {
        showMessage('No active transaction detected', 'info');
      }
    } catch (error) {
      console.error('Error in popup:', error);
      showMessage(error.message || 'Error analyzing transaction', 'error');
    }
  }

  // Update the UI based on transaction status
  function updateUI(data) {
    loadingElement.classList.add('hidden');
    statusElement.classList.remove('hidden');
    transactionDetails.classList.remove('hidden');
    
    // Enable buttons
    approveBtn.disabled = false;
    rejectBtn.disabled = false;
    
    // Update status
    let statusClass = '';
    let statusText = '';
    
    switch (data.riskLevel) {
      case 'low':
        statusClass = 'safe';
        statusText = '✅ Transaction appears safe';
        break;
      case 'medium':
        statusClass = 'warning';
        statusText = '⚠️ Review transaction carefully';
        break;
      case 'high':
      case 'critical':
        statusClass = 'danger';
        statusText = '❌ High risk transaction detected';
        break;
      default:
        statusClass = 'warning';
        statusText = '⚠️ Unable to determine risk level';
    }
    
    statusElement.className = `status ${statusClass}`;
    statusElement.textContent = statusText;
    
    // Clear previous details
    detailsElement.innerHTML = '';
    
    // Only show details if we have valid data
    if (data.from || data.to) {
      const detailsHTML = [];
      
      if (data.from) {
        detailsHTML.push(`<p><strong>From:</strong> ${shortenAddress(data.from)}</p>`);
      }
      
      if (data.to) {
        detailsHTML.push(`<p><strong>To:</strong> ${shortenAddress(data.to)}</p>`);
      }
      
      detailsHTML.push(`
        <p><strong>Value:</strong> ${data.value || '0'} ETH</p>
        <p><strong>Gas:</strong> ${data.gas || '0'}</p>
        <p><strong>Nonce:</strong> ${data.nonce || '0'}</p>
        <p><strong>Data:</strong> ${data.data ? 'Present' : 'None'}</p>
      `);
      
      detailsElement.innerHTML = detailsHTML.join('');
    }
    
    // Add recommendations if any
    if (data.recommendations && data.recommendations.length > 0) {
      const recommendations = document.createElement('div');
      recommendations.className = 'recommendations';
      recommendations.innerHTML = 
        '<h4>Recommendations:</h4><ul>' + 
        data.recommendations.map(rec => `<li>${rec}</li>`).join('') + 
        '</ul>';
      detailsElement.appendChild(recommendations);
    }
  }
  
  // Show loading state
  function showLoading(message = 'Loading...') {
    loadingElement.classList.remove('hidden');
    statusElement.classList.add('hidden');
    transactionDetails.classList.add('hidden');
    loadingElement.textContent = message;
    
    // Disable buttons while loading
    approveBtn.disabled = true;
    rejectBtn.disabled = true;
  }
  
  // Show a message
  function showMessage(message, type = 'info') {
    loadingElement.classList.add('hidden');
    statusElement.classList.remove('hidden');
    transactionDetails.classList.add('hidden');
    
    statusElement.textContent = message;
    statusElement.className = `status ${type}`;
    
    // Disable buttons on error
    if (type === 'error') {
      approveBtn.disabled = true;
      rejectBtn.disabled = true;
    }
  }
  
  // Shorten an Ethereum address for display
  function shortenAddress(address) {
    if (!address || typeof address !== 'string') return 'Unknown';
    return address.length > 10 
      ? `${address.substring(0, 6)}...${address.substring(address.length - 4)}`
      : address;
  }
  
  // Event listeners
  approveBtn.addEventListener('click', async () => {
    try {
      showLoading('Processing approval...');
      await chrome.runtime.sendMessage({ 
        type: 'TRANSACTION_RESPONSE', 
        approved: true 
      });
      window.close();
    } catch (error) {
      console.error('Error approving transaction:', error);
      showMessage('Failed to approve transaction', 'error');
    }
  });
  
  rejectBtn.addEventListener('click', async () => {
    try {
      showLoading('Processing rejection...');
      await chrome.runtime.sendMessage({ 
        type: 'TRANSACTION_RESPONSE', 
        approved: false 
      });
      window.close();
    } catch (error) {
      console.error('Error rejecting transaction:', error);
      showMessage('Failed to reject transaction', 'error');
    }
  });
  
  // Initialize the popup
  initPopup();
});

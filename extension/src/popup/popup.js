// Wait for the DOM to be fully loaded
document.addEventListener('DOMContentLoaded', function() {
  // Get DOM elements
  const loadingElement = document.getElementById('loading');
  const statusElement = document.getElementById('status');
  const transactionDetails = document.getElementById('transaction-details');
  const detailsElement = document.getElementById('details');
  const approveBtn = document.getElementById('approve-btn');
  const rejectBtn = document.getElementById('reject-btn');

  // Initialize the popup
  async function initPopup() {
    try {
      // Get the current tab
      const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
      
      // Send message to content script to get transaction status
      const response = await chrome.tabs.sendMessage(tab.id, { type: 'GET_TRANSACTION_STATUS' });
      
      if (response) {
        updateUI(response);
      } else {
        showMessage('No active transaction detected', 'info');
      }
    } catch (error) {
      console.error('Error initializing popup:', error);
      showMessage('Error analyzing transaction', 'error');
    }
  }

  // Update the UI based on transaction status
  function updateUI(data) {
    loadingElement.classList.add('hidden');
    statusElement.classList.remove('hidden');
    transactionDetails.classList.remove('hidden');
    
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
    
    // Update transaction details
    detailsElement.innerHTML = `
      <p><strong>From:</strong> ${shortenAddress(data.from)}</p>
      <p><strong>To:</strong> ${shortenAddress(data.to)}</p>
      <p><strong>Value:</strong> ${data.value || '0'} ETH</p>
      <p><strong>Gas:</strong> ${data.gas || '0'}</p>
      <p><strong>Nonce:</strong> ${data.nonce || '0'}</p>
      <p><strong>Data:</strong> ${data.data ? 'Present' : 'None'}</p>
    `;
    
    // Add recommendations if any
    if (data.recommendations && data.recommendations.length > 0) {
      const recommendations = document.createElement('div');
      recommendations.innerHTML = '<h4>Recommendations:</h4><ul>' + 
        data.recommendations.map(rec => `<li>${rec}</li>`).join('') + 
        '</ul>';
      detailsElement.appendChild(recommendations);
    }
  }
  
  // Show a message
  function showMessage(message, type = 'info') {
    loadingElement.classList.add('hidden');
    statusElement.classList.remove('hidden');
    statusElement.textContent = message;
    statusElement.className = `status ${type}`;
  }
  
  // Shorten an Ethereum address for display
  function shortenAddress(address) {
    if (!address) return 'Unknown';
    return `${address.substring(0, 6)}...${address.substring(38)}`;
  }
  
  // Event listeners
  approveBtn.addEventListener('click', () => {
    chrome.runtime.sendMessage({ type: 'TRANSACTION_RESPONSE', approved: true });
    window.close();
  });
  
  rejectBtn.addEventListener('click', () => {
    chrome.runtime.sendMessage({ type: 'TRANSACTION_RESPONSE', approved: false });
    window.close();
  });
  
  // Initialize the popup
  initPopup();
});

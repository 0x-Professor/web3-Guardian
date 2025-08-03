// Modern popup implementation with improved UX and error handling
let currentTransaction = null;
let isInitialized = false;

// UI State Management
const UI = {
  elements: {},
  state: {
    loading: false,
    error: null,
    transaction: null
  },
  
  init() {
    this.elements = {
      loadingElement: document.getElementById('loading'),
      statusElement: document.getElementById('status'),
      errorElement: document.getElementById('error-message'),
      transactionDetails: document.getElementById('transaction-details'),
      detailsElement: document.getElementById('details'),
      approveBtn: document.getElementById('approve-btn'),
      rejectBtn: document.getElementById('reject-btn'),
      settingsBtn: document.getElementById('settings-btn'),
      refreshBtn: document.getElementById('refresh-btn')
    };
    
    this.bindEvents();
    this.render();
  },
  
  bindEvents() {
    this.elements.approveBtn?.addEventListener('click', () => handleTransactionDecision(true));
    this.elements.rejectBtn?.addEventListener('click', () => handleTransactionDecision(false));
    this.elements.refreshBtn?.addEventListener('click', () => refreshTransactionStatus());
    this.elements.settingsBtn?.addEventListener('click', () => openSettings());
  },
  
  setState(newState) {
    Object.assign(this.state, newState);
    this.render();
  },
  
  render() {
    const { loading, error, transaction } = this.state;
    
    // Show/hide loading
    this.toggleElement(this.elements.loadingElement, loading);
    
    // Show/hide error
    if (error) {
      this.showError(error);
    } else {
      this.hideError();
    }
    
    // Show transaction details
    if (transaction && !loading && !error) {
      this.showTransaction(transaction);
    } else {
      this.hideTransaction();
    }
    
    // Update button states
    this.updateButtons(loading, !!transaction);
  },
  
  toggleElement(element, show) {
    if (!element) return;
    element.classList.toggle('hidden', !show);
  },
  
  showError(error) {
    if (!this.elements.errorElement) return;
    this.elements.errorElement.textContent = error;
    this.elements.errorElement.classList.remove('hidden');
  },
  
  hideError() {
    if (!this.elements.errorElement) return;
    this.elements.errorElement.classList.add('hidden');
  },
  
  showTransaction(transaction) {
    this.toggleElement(this.elements.transactionDetails, true);
    this.updateStatus(transaction);
    this.updateDetails(transaction);
  },
  
  hideTransaction() {
    this.toggleElement(this.elements.transactionDetails, false);
  },
  
  updateStatus(transaction) {
    if (!this.elements.statusElement) return;
    
    const { riskLevel, riskFactors = [] } = transaction;
    let statusClass = '';
    let statusText = '';
    let icon = '';
    
    switch (riskLevel) {
      case 'low':
        statusClass = 'safe';
        statusText = 'Transaction appears safe';
        icon = '✅';
        break;
      case 'medium':
        statusClass = 'warning';
        statusText = 'Review transaction carefully';
        icon = '⚠️';
        break;
      case 'high':
        statusClass = 'danger';
        statusText = 'High risk transaction detected';
        icon = '🚨';
        break;
      case 'critical':
        statusClass = 'danger';
        statusText = 'CRITICAL: Extremely risky transaction';
        icon = '💀';
        break;
      case 'error':
        statusClass = 'warning';
        statusText = 'Analysis failed';
        icon = '❌';
        break;
      default:
        statusClass = 'warning';
        statusText = 'Unable to determine risk level';
        icon = '❓';
    }
    
    this.elements.statusElement.className = `status ${statusClass}`;
    this.elements.statusElement.innerHTML = `<span class="status-icon">${icon}</span> ${statusText}`;
  },
  
  updateDetails(transaction) {
    if (!this.elements.detailsElement) return;
    
    const details = [];
    
    // Basic transaction info
    if (transaction.from) {
      details.push(`<div class="detail-row">
        <span class="label">From:</span>
        <span class="value address" title="${transaction.from}">${shortenAddress(transaction.from)}</span>
      </div>`);
    }
    
    if (transaction.to) {
      details.push(`<div class="detail-row">
        <span class="label">To:</span>
        <span class="value address" title="${transaction.to}">${shortenAddress(transaction.to)}</span>
      </div>`);
    }
    
    const valueEth = transaction.value ? (parseFloat(transaction.value) / 1e18).toFixed(6) : '0';
    details.push(`<div class="detail-row">
      <span class="label">Value:</span>
      <span class="value">${valueEth} ETH</span>
    </div>`);
    
    if (transaction.gasInfo) {
      const { gasLimit, gasPrice, estimatedCost } = transaction.gasInfo;
      const gasPriceGwei = gasPrice ? (gasPrice / 1e9).toFixed(2) : 'Unknown';
      details.push(`<div class="detail-row">
        <span class="label">Gas:</span>
        <span class="value">${gasLimit || 'Unknown'} @ ${gasPriceGwei} Gwei</span>
      </div>`);
    }
    
    if (transaction.data && transaction.data !== '0x') {
      details.push(`<div class="detail-row">
        <span class="label">Data:</span>
        <span class="value">Contract interaction</span>
      </div>`);
    }
    
    // Domain info
    if (transaction.url) {
      const domain = new URL(transaction.url).hostname;
      details.push(`<div class="detail-row">
        <span class="label">dApp:</span>
        <span class="value">${domain}</span>
      </div>`);
    }
    
    this.elements.detailsElement.innerHTML = details.join('');
    
    // Add recommendations
    this.addRecommendations(transaction.recommendations || []);
  },
  
  addRecommendations(recommendations) {
    if (!recommendations.length) return;
    
    const recommendationsEl = document.createElement('div');
    recommendationsEl.className = 'recommendations';
    recommendationsEl.innerHTML = `
      <h4>Security Analysis:</h4>
      <ul>
        ${recommendations.map(rec => `<li>${rec}</li>`).join('')}
      </ul>
    `;
    
    this.elements.detailsElement.appendChild(recommendationsEl);
  },
  
  updateButtons(loading, hasTransaction) {
    const buttonGroup = document.getElementById('button-group');
    
    if (this.elements.approveBtn) {
      this.elements.approveBtn.disabled = loading || !hasTransaction;
    }
    if (this.elements.rejectBtn) {
      this.elements.rejectBtn.disabled = loading || !hasTransaction;
    }
    
    // Show/hide button group based on transaction availability
    if (buttonGroup) {
      buttonGroup.classList.toggle('hidden', !hasTransaction || loading);
    }
  }
};

// Initialize popup when DOM is ready
document.addEventListener('DOMContentLoaded', async () => {
  console.log('🛡️ Web3 Guardian popup initializing...');
  
  try {
    UI.init();
    await initializePopup();
    isInitialized = true;
    console.log('✅ Popup initialized successfully');
  } catch (error) {
    console.error('❌ Popup initialization failed:', error);
    UI.setState({ 
      loading: false, 
      error: `Initialization failed: ${error.message}` 
    });
  }
});

// Main initialization function
async function initializePopup() {
  UI.setState({ loading: true, error: null });
  
  try {
    // First, try to get pending transactions
    const pendingTxResponse = await sendMessage({ type: 'GET_PENDING_TRANSACTIONS' });
    
    if (pendingTxResponse.success && pendingTxResponse.data.transactions.length > 0) {
      // Show the most recent pending transaction
      const latestTx = pendingTxResponse.data.transactions
        .sort((a, b) => b.timestamp - a.timestamp)[0];
      
      currentTransaction = latestTx;
      UI.setState({ 
        loading: false,
        transaction: latestTx
      });
      return;
    }
    
    // If no pending transactions, get current tab status
    });
    
    if (statusResponse.success) {
      UI.setState({ 
        loading: false,
        transaction: {
          ...statusResponse.data,
          riskLevel: 'info',
          recommendations: statusResponse.data.isConnected 
            ? ['Wallet connected - ready to analyze transactions']
            : ['No wallet connected to this site']
        }
      });
    } else if (statusResponse.fallbackData) {
      UI.setState({ 
        loading: false,
        transaction: {
          ...statusResponse.fallbackData,
          riskLevel: 'warning',
          recommendations: ['Content script not available - limited functionality']
        }
      });
    } else {
      throw new Error(statusResponse.error || 'Failed to get transaction status');
    }
    
  } catch (error) {
    console.error('Error during initialization:', error);
    UI.setState({ 
      loading: false, 
      error: `Failed to load: ${error.message}` 
    });
  }
}

// Handle transaction approval/rejection
async function handleTransactionDecision(approved) {
  if (!currentTransaction?.id) {
    UI.setState({ error: 'No transaction to process' });
    return;
  }
  
  UI.setState({ loading: true });
  
  try {
    const response = await sendMessage({
      type: 'TRANSACTION_DECISION',
      messageId: currentTransaction.id,
      approved
    });
    
    if (response.success) {
      // Show success message briefly then close
      UI.setState({ 
        loading: false,
        transaction: {
          ...currentTransaction,
          riskLevel: approved ? 'success' : 'rejected',
          recommendations: [approved ? '✅ Transaction approved' : '❌ Transaction rejected']
        }
      });
      
      setTimeout(() => {
        window.close();
      }, 1500);
    } else {
      throw new Error(response.error || 'Failed to process decision');
    }
    
  } catch (error) {
    console.error('Error processing transaction decision:', error);
    UI.setState({ 
      loading: false,
      error: `Failed to ${approved ? 'approve' : 'reject'} transaction: ${error.message}`
    });
  }
}

// Refresh transaction status
async function refreshTransactionStatus() {
  try {
    await initializePopup();
  } catch (error) {
    UI.setState({ error: `Refresh failed: ${error.message}` });
  }
}

// Open settings (placeholder)
function openSettings() {
  // In a full implementation, this would open a settings page
  alert('Settings panel coming soon!');
}

// Listen for messages from background script
chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  console.log('Popup received message:', message.type);
  
  switch (message.type) {
    case 'PENDING_TRANSACTION_UPDATE':
      if (message.data) {
        currentTransaction = message.data;
        UI.setState({ 
          loading: false,
          transaction: message.data
        });
      }
      break;
      
    case 'TRANSACTION_STATUS_UPDATE':
      if (message.data) {
        UI.setState({ 
          transaction: {
            ...UI.state.transaction,
            ...message.data
          }
        });
      }
      break;
  }
  
  sendResponse({ received: true });
});

// Utility functions
function sendMessage(message, timeout = 10000) {
  return new Promise((resolve, reject) => {
    const timeoutId = setTimeout(() => {
      reject(new Error('Request timeout'));
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

function shortenAddress(address) {
  if (!address || typeof address !== 'string') return 'Unknown';
  if (address.length <= 10) return address;
  return `${address.substring(0, 6)}...${address.substring(address.length - 4)}`;
}

// Export for testing
if (typeof module !== 'undefined' && module.exports) {
  module.exports = {
    UI,
    initializePopup,
    handleTransactionDecision,
    shortenAddress
  };
}

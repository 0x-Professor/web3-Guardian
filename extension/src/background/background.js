// Background script for Web3 Guardian extension
// Handles transaction analysis and communication with the backend

console.log('Web3 Guardian background script loaded');

// Configuration
const CONFIG = {
  BACKEND_URL: 'http://localhost:8000',
  CACHE_TTL: 5 * 60 * 1000, // 5 minutes
  MAX_CACHE_ITEMS: 100
};

// In-memory cache for analysis results
const analysisCache = new Map();

// Listen for messages from content scripts and popup
chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
  console.log('Background received message:', request.type);
  
  switch (request.type) {
    case 'ANALYZE_TRANSACTION':
      handleAnalyzeTransaction(request.data, sendResponse);
      return true; // Required for async response
      
    case 'SHOW_TRANSACTION':
      handleShowTransaction(request.data, sender.tab, sendResponse);
      return true;
      
    case 'TRANSACTION_RESPONSE':
      handleTransactionResponse(request.data);
      sendResponse({ success: true });
      break;
      
    default:
      console.warn('Unknown message type:', request.type);
      sendResponse({ success: false, error: 'Unknown message type' });
  }
});

// Handle transaction analysis request
async function handleAnalyzeTransaction(txData, sendResponse) {
  try {
    // Check cache first
    const cacheKey = generateCacheKey(txData);
    const cachedResult = analysisCache.get(cacheKey);
    
    if (cachedResult) {
      console.log('Using cached analysis result');
      sendResponse(cachedResult);
      return;
    }
    
    // In a real implementation, this would send the transaction to your backend
    // For now, we'll analyze the transaction locally
    const result = await analyzeTransactionLocally(txData);
    
    // Cache the result
    if (analysisCache.size >= CONFIG.MAX_CACHE_ITEMS) {
      // Remove oldest item if cache is full
      const oldestKey = analysisCache.keys().next().value;
      analysisCache.delete(oldestKey);
    }
    
    analysisCache.set(cacheKey, result);
    
    // Schedule cache invalidation
    setTimeout(() => {
      analysisCache.delete(cacheKey);
    }, CONFIG.CACHE_TTL);
    
    sendResponse(result);
    
  } catch (error) {
    console.error('Error analyzing transaction:', error);
    sendResponse({
      success: false,
      error: error.message,
      riskLevel: 'unknown',
      recommendations: ['Failed to analyze transaction']
    });
  }
}

// Analyze transaction locally (replace with backend call in production)
async function analyzeTransactionLocally(txData) {
  // Basic risk analysis
  const riskFactors = [];
  const recommendations = [];
  
  // Check for high-value transfers
  const value = parseFloat(txData.value || '0');
  if (value > 1) { // More than 1 ETH or token
    riskFactors.push('high_value');
    recommendations.push(`High value transfer: ${value} ETH`);
  }
  
  // Check for contract interactions
  if (txData.to && txData.to !== txData.from) {
    // In a real implementation, you would check if the address is a contract
    // For now, we'll assume any transaction with data is a contract interaction
    if (txData.data && txData.data !== '0x') {
      riskFactors.push('contract_interaction');
      recommendations.push('This is a contract interaction');
    }
  }
  
  // Check for known phishing addresses (simplified)
  const knownPhishingAddresses = [
    '0x0000000000000000000000000000000000000000',
    // Add more known malicious addresses here
  ];
  
  if (knownPhishingAddresses.includes(txData.to?.toLowerCase())) {
    riskFactors.push('known_phishing');
    recommendations.push('⚠️ Warning: This address is associated with phishing');
  }
  
  // Determine risk level
  let riskLevel = 'low';
  if (riskFactors.includes('known_phishing')) {
    riskLevel = 'critical';
  } else if (riskFactors.includes('high_value') && riskFactors.includes('contract_interaction')) {
    riskLevel = 'high';
  } else if (riskFactors.length > 0) {
    riskLevel = 'medium';
  }
  
  // Add general recommendations
  if (riskLevel === 'low') {
    recommendations.push('This transaction appears to be safe');
  } else if (riskLevel === 'medium') {
    recommendations.push('Please review this transaction carefully');
  } else if (riskLevel === 'high') {
    recommendations.unshift('⚠️ High risk transaction detected!');
  } else if (riskLevel === 'critical') {
    recommendations.unshift('🚨 CRITICAL WARNING: Potential scam detected!');
  }
  
  return {
    success: true,
    riskLevel,
    riskFactors,
    recommendations,
    timestamp: new Date().toISOString()
  };
}

// Handle showing transaction to user
function handleShowTransaction(txData, tab, sendResponse) {
  // Open the popup to show transaction details
  chrome.action.openPopup();
  
  // In a real implementation, you would store the pending transaction
  // and wait for user approval/rejection
  console.log('Showing transaction:', txData);
  
  sendResponse({ success: true });
}

// Handle transaction response from popup
function handleTransactionResponse(response) {
  // In a real implementation, you would handle the user's response
  // and either proceed with or cancel the transaction
  console.log('Received transaction response:', response);
}

// Generate a cache key for transaction data
function generateCacheKey(txData) {
  return JSON.stringify({
    from: txData.from,
    to: txData.to,
    value: txData.value,
    data: txData.data
  });
}

// Handle installation or update
chrome.runtime.onInstalled.addListener((details) => {
  if (details.reason === 'install') {
    console.log('Web3 Guardian installed');
    // Initialize extension state
    chrome.storage.local.set({
      settings: {
        autoApproveLowRisk: true,
        showNotifications: true
      },
      analyticsEnabled: false
    });
  } else if (details.reason === 'update') {
    console.log('Web3 Guardian updated to version', chrome.runtime.getManifest().version);
  }
});

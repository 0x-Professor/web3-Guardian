// Background script for Web3 Guardian extension
// Handles transaction analysis and communication with the backend

console.log('Web3 Guardian background script loaded');

// Configuration
const CONFIG = {
  BACKEND_URL: 'http://localhost:8000',
  RISK_LEVELS: {
    LOW: 'low',
    MEDIUM: 'medium',
    HIGH: 'high',
    CRITICAL: 'critical'
  },
  CACHE_TTL: 5 * 60 * 1000, // 5 minutes
  MAX_CACHE_ITEMS: 100
};

// In-memory cache for analysis results
const analysisCache = new Map();

// Listen for messages from content scripts
chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
  console.log('Background received message:', request.type);
  
  switch (request.type) {
    case 'ANALYZE_TRANSACTION':
      handleAnalyzeTransaction(request.data, sendResponse);
      return true; // Required for async response
      
    case 'WEB3_TRANSACTION':
      handleWeb3Transaction(request.data, sendResponse);
      return true;
      
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
    
    // Send to backend for analysis
    const response = await fetch(`${CONFIG.BACKEND_URL}/api/analyze`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        tx_data: txData,
        network: 'ethereum', // TODO: Detect network
        user_address: txData.from
      })
    });
    
    if (!response.ok) {
      throw new Error(`Backend error: ${response.status}`);
    }
    
    const result = await response.json();
    
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
      recommendations: []
    });
  }
}

// Handle Web3 transaction interception
async function handleWeb3Transaction(txData, sendResponse) {
  try {
    // Show notification to user
    const notificationId = `tx-${Date.now()}`;
    
    // Show notification to user
    chrome.notifications.create(notificationId, {
      type: 'basic',
      iconUrl: chrome.runtime.getURL('assets/icon128.png'),
      title: 'Web3 Transaction Detected',
      message: 'A Web3 transaction is being processed. Click to review.',
      priority: 2,
      requireInteraction: true
    });
    
    // Handle notification click
    const handleNotificationClick = (clickedNotificationId) => {
      if (clickedNotificationId === notificationId) {
        // Open popup with transaction details
        chrome.windows.create({
          url: chrome.runtime.getURL('popup.html') + `?tx=${encodeURIComponent(JSON.stringify(txData))}`,
          type: 'popup',
          width: 400,
          height: 600
        });
        chrome.notifications.clear(notificationId);
      }
    };
    
    // Add click listener
    chrome.notifications.onClicked.addListener(handleNotificationClick);
    
    // For now, auto-approve after a short delay
    // In a real implementation, this would wait for user action
    setTimeout(() => {
      chrome.notifications.clear(notificationId);
      chrome.notifications.onClicked.removeListener(handleNotificationClick);
      sendResponse({ shouldProceed: true });
    }, 3000);
    
  } catch (error) {
    console.error('Error handling Web3 transaction:', error);
    sendResponse({ shouldProceed: false, error: error.message });
  }
}

// Generate a cache key for transaction data
function generateCacheKey(txData) {
  // Create a stable string representation of the transaction
  const { from, to, value, data, gas, gasPrice } = txData;
  return `${from}-${to}-${value}-${data}-${gas}-${gasPrice}`;
}

// Handle installation or update
chrome.runtime.onInstalled.addListener((details) => {
  if (details.reason === 'install') {
    console.log('Web3 Guardian installed');
    // Open onboarding page
    chrome.tabs.create({
      url: chrome.runtime.getURL('onboarding.html')
    });
  } else if (details.reason === 'update') {
    console.log('Web3 Guardian updated to version', chrome.runtime.getManifest().version);
  }
});

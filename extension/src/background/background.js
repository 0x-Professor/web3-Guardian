import { ethers } from "ethers";
import { logInfo, logError, logDebug } from "../utils/logger.js";
import { fetchAnalysis, fetchGasPrice, simulateTransaction } from "../utils/api.js";

// Load environment variables
const ALCHEMY_API_KEY = process.env.ALCHEMY_API_KEY || 'vH5jh4T1PWnfVIxV7su69';
const ETHERSCAN_API_KEY = process.env.ETHERSCAN_MAINNET_API_KEY || '3NK7D3FBF2AQ23RBEDPX9BVZH4DD4E3DHZ';
const INFURA_KEY = process.env.INFURA_API_KEY || '';
const BACKEND_URL = process.env.BACKEND_URL || 'http://localhost:8000';

// Initialize provider with Alchemy as primary, fallback to Infura
let provider;
try {
  provider = new ethers.providers.AlchemyProvider('homestead', ALCHEMY_API_KEY);
  logInfo('Connected to Alchemy provider');
} catch (error) {
  logError('Failed to connect to Alchemy, falling back to Infura', error);
  provider = new ethers.providers.InfuraProvider('homestead', INFURA_KEY);
}

// Track current user accounts
let currentAccounts = [];

// Cache for contract information
const contractCache = new Map();
const CACHE_TTL = 5 * 60 * 1000; // 5 minutes

// Listen for messages from content scripts and popup
chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
  logInfo(`Received message type: ${request.type}`, { 
    url: sender.tab?.url || 'unknown',
    tabId: sender.tab?.id
  });
  
  // Handle the message based on type
  const messageHandlers = {
    ANALYZE_DAPP: () => handleAnalyzeDapp(request.url, sendResponse),
    ANALYZE_TRANSACTION: () => handleAnalyzeTransaction(request.txData, sendResponse, sender),
    ACCOUNTS_CHANGED: () => {
      currentAccounts = request.accounts;
      logInfo("Updated current accounts", { count: currentAccounts.length });
      sendResponse({ success: true });
    },
    ACCOUNTS_CONNECTED: () => {
      currentAccounts = request.accounts;
      logInfo("Accounts connected", { count: currentAccounts.length });
      sendResponse({ success: true });
    },
    PING: () => {
      logDebug("PING received, sending PONG");
      sendResponse({ type: "PONG" });
    }
  };

  try {
    const handler = messageHandlers[request.type];
    if (handler) {
      const result = handler();
      return result !== undefined ? result : true; // Keep message channel open if handler doesn't return anything
    }
    
    logError("Unknown message type", { type: request.type });
    sendResponse({ success: false, error: "Unknown message type" });
  } catch (error) {
    logError("Error handling message", { 
      type: request.type, 
      error: error.message,
      stack: error.stack 
    });
    sendResponse({ 
      success: false, 
      error: `Error handling ${request.type}: ${error.message}` 
    });
  }
  
  return true; // Keep message channel open for async responses
});
        chrome.tabs.sendMessage(
          tabId,
          { type: 'PING' },
          { frameId: 0 }, // Main frame only
          (response) => {
            if (chrome.runtime.lastError) {
              console.error('Content script not responding:', chrome.runtime.lastError);
              // Try to inject the content script
              chrome.scripting.executeScript({
                target: { tabId },
                files: ['content.bundle.js']
              }).then(() => {
                console.log('Content script injected programmatically');
                // Now try to get the transaction status again
                getTransactionStatus(tabId, sendResponse);
              }).catch(err => {
                console.error('Failed to inject content script:', err);
                sendResponse({
                  success: false,
                  error: 'Failed to inject content script: ' + err.message
                });
              });
            } else {
              console.log('Content script is responsive, getting transaction status');
              getTransactionStatus(tabId, sendResponse);
            }
          }
        );
     
      
     
    

// Helper function to get transaction status from content script
function getTransactionStatus(tabId, sendResponse) {
  chrome.tabs.sendMessage(
    tabId,
    { type: 'GET_TRANSACTION_STATUS' },
    { frameId: 0 }, // Main frame only
    (response) => {
      if (chrome.runtime.lastError) {
        console.error('Error getting transaction status:', chrome.runtime.lastError);
        sendResponse({
          success: false,
          error: 'Failed to get transaction status: ' + chrome.runtime.lastError.message
        });
      } else if (response) {
        sendResponse(response);
      } else {
        sendResponse({
          success: false,
          error: 'No response from content script'
        });
      }
    }
  );
}

// Handle transaction analysis request
async function handleAnalyzeTransaction(txData, sendResponse) {
  try {
    console.log('Analyzing transaction:', JSON.stringify(txData, null, 2));
    
    // Check cache first
    const cacheKey = generateCacheKey(txData);
    const cachedResult = analysisCache.get(cacheKey);
    
    if (cachedResult) {
      console.log('Using cached analysis result');
      sendResponse(cachedResult);
      return;
    }
    
    // Validate transaction data
    if (!txData || typeof txData !== 'object') {
      throw new Error('Invalid transaction data');
    }
    
    let result;
    
    // Try local analysis first
    try {
      result = await analyzeTransactionLocally(txData);
      console.log('Local analysis result:', result);
    } catch (localError) {
      console.error('Local analysis failed, trying backend...', localError);
      // In a real implementation, you would try the backend here
      // For now, we'll rethrow the local error
      throw new Error(`Analysis failed: ${localError.message}`);
    }
    
    // Cache the result if successful
    if (result && result.success !== false) {
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
    }
    
    sendResponse(result);
    
  } catch (error) {
    console.error('Error in handleAnalyzeTransaction:', error);
    const errorResponse = {
      success: false,
      error: error.message || 'Unknown error occurred',
      riskLevel: 'error',
      recommendations: [
        'Failed to analyze transaction',
        error.message || 'Please try again later'
      ]
    };
    console.error('Sending error response:', errorResponse);
    sendResponse(errorResponse);
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

chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
  switch (request.type) {
    case 'GET_TRANSACTION_STATUS':
      getTransactionStatus(sender.tab.id, sendResponse);
      break;
    case 'ANALYZE_TRANSACTION':
      handleAnalyzeTransaction(request.txData, sendResponse, sender);
      break;
    case 'SHOW_TRANSACTION':
      handleShowTransaction(request.txData, sender.tab, sendResponse);
      break;
    case 'TRANSACTION_RESPONSE':
      handleTransactionResponse(request.response);
      break;
    case 'ANALYZE_DAPP':
      handleAnalyzeDapp(request.url, sendResponse);
      break;
    default:
      console.warn('Unknown message type:', request.type);
      sendResponse({ success: false, error: 'Unknown message type' });
      return false;
  }
});

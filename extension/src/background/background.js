import { logInfo, logError, logDebug } from "../utils/logger.js";
import { fetchAnalysis, fetchGasPrice, simulateTransaction } from "../utils/api.js";

// Background script state
let pendingTransactions = new Map();
let connectedTabs = new Map();
let userSettings = {
  riskTolerance: 'medium',
  autoApprove: false,
  gasOptimization: true
};

// Cache for analysis results
const analysisCache = new Map();
const contractCache = new Map();
const CACHE_TTL = 5 * 60 * 1000; // 5 minutes
const MAX_CACHE_SIZE = 1000;

// Configuration
const CONFIG = {
  BACKEND_URL: process.env.BACKEND_URL || 'http://localhost:8000',
  ANALYSIS_TIMEOUT: 15000,
  USER_DECISION_TIMEOUT: 300000, // 5 minutes
  MAX_PENDING_TRANSACTIONS: 10
};

console.log('🛡️ Web3 Guardian background script starting...');

// Message handler registry
const messageHandlers = {
  // Content script messages
  CONTENT_SCRIPT_READY: handleContentScriptReady,
  ANALYZE_WALLET_CONNECTION: handleAnalyzeWalletConnection,
  ANALYZE_TRANSACTION: handleAnalyzeTransaction,
  ANALYZE_CONTRACT_INTERACTION: handleAnalyzeContractInteraction,
  ANALYZE_SIGNING_REQUEST: handleAnalyzeSigningRequest,
  SHOW_APPROVAL_POPUP: handleShowApprovalPopup,
  WALLET_CONNECTED: handleWalletConnected,
  ACCOUNT_ACCESS: handleAccountAccess,
  ACCOUNTS_CHANGED: handleAccountsChanged,
  CHAIN_CHANGED: handleChainChanged,
  
  // Popup messages
  GET_TRANSACTION_STATUS: handleGetTransactionStatus,
  GET_PENDING_TRANSACTIONS: handleGetPendingTransactions,
  TRANSACTION_DECISION: handleTransactionDecision,
  USER_DECISION: handleUserDecision,
  GET_SETTINGS: handleGetSettings,
  UPDATE_SETTINGS: handleUpdateSettings,
  
  // Common messages
  PING: handlePing,
  GET_PAGE_INFO: handleGetPageInfo
};

// Main message listener
chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
  const { type } = request;
  const tabId = sender.tab?.id;
  
  logDebug(`📨 Received message: ${type}`, { 
    tabId, 
    url: sender.tab?.url,
    hasData: !!request.data 
  });

  try {
    const handler = messageHandlers[type];
    if (!handler) {
      logError(`Unknown message type: ${type}`);
      sendResponse({ success: false, error: `Unknown message type: ${type}` });
      return false;
    }

    // Execute handler
    const result = handler(request, sender, sendResponse);
    
    // If handler returns a promise, handle it asynchronously
    if (result instanceof Promise) {
      result
        .then(response => sendResponse(response))
        .catch(error => {
          logError(`Handler error for ${type}:`, error);
          sendResponse({ 
            success: false, 
            error: error.message || 'Handler execution failed' 
          });
        });
      return true; // Keep message channel open
    }
    
    // If handler returned a value, send it
    if (result !== undefined) {
      sendResponse(result);
    }
    
    return true;
    
  } catch (error) {
    logError(`Error handling message ${type}:`, error);
    sendResponse({ 
      success: false, 
      error: error.message || 'Message handler error' 
    });
    return false;
  }
});

// Handler implementations
async function handleContentScriptReady(request, sender) {
  const tabId = sender.tab?.id;
  if (tabId) {
    connectedTabs.set(tabId, {
      url: sender.tab.url,
      timestamp: Date.now(),
      ready: true
    });
    logInfo(`Content script ready on tab ${tabId}: ${sender.tab.url}`);
  }
  return { success: true };
}

async function handleAnalyzeTransaction(request, sender) {
  const { data } = request;
  const tabId = sender.tab?.id;
  
  try {
    // Validate transaction data
    if (!data || !data.to) {
      throw new Error('Invalid transaction data');
    }
    
    logInfo('🔍 Analyzing transaction:', {
      to: data.to,
      value: data.value,
      origin: data.origin,
      tabId
    });
    
    // Check cache first
    const cacheKey = generateCacheKey(data);
    let analysisResult = getFromCache(analysisCache, cacheKey);
    
    if (!analysisResult) {
      // Perform analysis
      analysisResult = await performTransactionAnalysis(data);
      
      // Cache successful results
      if (analysisResult.success) {
        setCache(analysisCache, cacheKey, analysisResult);
      }
    } else {
      logDebug('Using cached analysis result');
    }
    
    // Store transaction for potential user approval
    if (data.messageId) {
      pendingTransactions.set(data.messageId, {
        data,
        analysisResult,
        tabId,
        timestamp: Date.now()
      });
      
      // Clean up old pending transactions
      cleanupPendingTransactions();
    }
    
    return {
      success: true,
      ...analysisResult,
      timestamp: new Date().toISOString()
    };
    
  } catch (error) {
    logError('Transaction analysis failed:', error);
    return {
      success: false,
      error: error.message,
      riskLevel: 'error',
      recommendations: ['Analysis failed: ' + error.message]
    };
  }
}

async function handleShowTransactionPopup(request, sender) {
  const { data } = request;
  const tabId = sender.tab?.id;
  
  try {
    // Open popup
    await chrome.action.openPopup();
    
    // Notify popup of pending transaction
    setTimeout(() => {
      chrome.runtime.sendMessage({
        type: 'PENDING_TRANSACTION_UPDATE',
        data: {
          ...data,
          tabId,
          url: sender.tab?.url
        }
      }).catch(err => logDebug('Popup not ready yet:', err.message));
    }, 500);
    
    return { success: true };
    
  } catch (error) {
    logError('Failed to show transaction popup:', error);
    return { success: false, error: error.message };
  }
}

async function handleGetTransactionStatus(request, sender) {
  const tabId = sender.tab?.id;
  
  if (!tabId) {
    return { success: false, error: 'No tab ID available' };
  }
  
  try {
    // Try to get status from content script
    const response = await sendMessageToTab(tabId, { type: 'GET_TRANSACTION_STATUS' });
    return response;
  } catch (error) {
    logError('Failed to get transaction status:', error);
    return {
      success: false,
      error: error.message,
      fallbackData: {
        url: sender.tab?.url || 'unknown',
        hasProvider: false,
        isConnected: false,
        accounts: [],
        pendingTransactions: pendingTransactions.size
      }
    };
  }
}

async function handleGetPendingTransactions(request, sender) {
  const transactions = Array.from(pendingTransactions.entries()).map(([id, tx]) => ({
    id,
    ...tx.data,
    analysisResult: tx.analysisResult,
    timestamp: tx.timestamp
  }));
  
  return {
    success: true,
    data: {
      transactions,
      count: transactions.length
    }
  };
}

async function handleTransactionDecision(request, sender) {
  const { messageId, approved } = request;
  
  if (!messageId) {
    return { success: false, error: 'Missing message ID' };
  }
  
  const transaction = pendingTransactions.get(messageId);
  if (!transaction) {
    return { success: false, error: 'Transaction not found' };
  }
  
  try {
    // Notify content script of decision
    await sendMessageToTab(transaction.tabId, {
      type: 'TRANSACTION_DECISION',
      messageId,
      approved
    });
    
    // Clean up
    pendingTransactions.delete(messageId);
    
    logInfo(`Transaction ${approved ? 'approved' : 'rejected'}:`, messageId);
    
    return { success: true };
    
  } catch (error) {
    logError('Failed to send transaction decision:', error);
    return { success: false, error: error.message };
  }
}

function handleAccountsChanged(request, sender) {
  const { accounts } = request;
  logInfo('Accounts changed:', accounts);
  
  // Broadcast to all connected tabs if needed
  return { success: true };
}

function handleChainChanged(request, sender) {
  const { chainId } = request;
  logInfo('Chain changed:', chainId);
  
  // Clear cache when chain changes
  analysisCache.clear();
  
  return { success: true };
}

function handlePing(request, sender) {
  console.log('🏓 PING received from:', sender.tab?.url || 'popup');
  return { 
    type: 'PONG', 
    timestamp: Date.now(),
    version: chrome.runtime.getManifest().version,
    success: true
  };
}

async function handleGetPageInfo(request, sender) {
  const tabId = sender.tab?.id;
  
  if (!tabId) {
    return { success: false, error: 'No tab ID available' };
  }
  
  try {
    const response = await sendMessageToTab(tabId, { type: 'GET_PAGE_INFO' });
    return response;
  } catch (error) {
    return {
      success: false,
      error: error.message,
      fallbackData: {
        url: sender.tab?.url,
        title: sender.tab?.title,
        domain: new URL(sender.tab?.url || '').hostname
      }
    };
  }
}

function handleGetSettings(request, sender) {
  return {
    success: true,
    data: userSettings
  };
}

async function handleUpdateSettings(request, sender) {
  const { settings } = request.data || {};
  
  if (!settings || typeof settings !== 'object') {
    return { success: false, error: 'Invalid settings data' };
  }
  
  try {
    // Update settings
    Object.assign(userSettings, settings);
    
    // Save to storage
    await chrome.storage.local.set({ userSettings });
    
    logInfo('Settings updated:', userSettings);
    
    return { success: true, data: userSettings };
    
  } catch (error) {
    logError('Failed to update settings:', error);
    return { success: false, error: error.message };
  }
}

// Core analysis functions
async function performTransactionAnalysis(txData) {
  const startTime = Date.now();
  
  try {
    // Perform multiple analysis checks in parallel
    const [
      riskAnalysis,
      contractAnalysis,
      gasAnalysis,
      simulationResult
    ] = await Promise.allSettled([
      analyzeTransactionRisk(txData),
      analyzeContract(txData.to),
      analyzeGasUsage(txData),
      simulateTransactionIfNeeded(txData)
    ]);
    
    // Combine results
    const result = {
      riskLevel: riskAnalysis.status === 'fulfilled' ? riskAnalysis.value.riskLevel : 'unknown',
      riskFactors: riskAnalysis.status === 'fulfilled' ? riskAnalysis.value.riskFactors : [],
      recommendations: [],
      contractInfo: contractAnalysis.status === 'fulfilled' ? contractAnalysis.value : null,
      gasInfo: gasAnalysis.status === 'fulfilled' ? gasAnalysis.value : null,
      simulation: simulationResult.status === 'fulfilled' ? simulationResult.value : null,
      analysisTime: Date.now() - startTime
    };
    
    // Generate recommendations
    result.recommendations = generateRecommendations(result, txData);
    
    return result;
    
  } catch (error) {
    logError('Analysis error:', error);
    throw new Error(`Analysis failed: ${error.message}`);
  }
}

async function analyzeTransactionRisk(txData) {
  const riskFactors = [];
  let riskLevel = 'low';
  
  // Value-based risk assessment
  const valueWei = BigInt(txData.value || '0');
  const valueEth = Number(valueWei) / 1e18;
  
  if (valueEth > 10) {
    riskFactors.push('very_high_value');
    riskLevel = 'high';
  } else if (valueEth > 1) {
    riskFactors.push('high_value');
    riskLevel = Math.max(riskLevel, 'medium');
  }
  
  // Contract interaction risk
  if (txData.data && txData.data !== '0x') {
    riskFactors.push('contract_interaction');
    riskLevel = Math.max(riskLevel, 'medium');
  }
  
  // Known address checks (simplified - in production, use comprehensive blacklists)
  const knownRiskyPatterns = [
    /^0x0+$/,  // Zero address
    /^0x1+$/,  // All ones
  ];
  
  if (knownRiskyPatterns.some(pattern => pattern.test(txData.to))) {
    riskFactors.push('suspicious_address');
    riskLevel = 'critical';
  }
  
  return { riskLevel, riskFactors };
}

async function analyzeContract(address) {
  if (!address || address === '0x' || !/^0x[a-fA-F0-9]{40}$/.test(address)) {
    return null;
  }
  
  // Check cache first
  const cached = getFromCache(contractCache, address);
  if (cached) {
    return cached;
  }
  
  try {
    // In production, this would call Etherscan API or similar
    const contractInfo = {
      address,
      isContract: false,
      isVerified: false,
      name: null,
      // This would be populated by actual API calls
    };
    
    setCache(contractCache, address, contractInfo);
    return contractInfo;
    
  } catch (error) {
    logError('Contract analysis failed:', error);
    return null;
  }
}

async function analyzeGasUsage(txData) {
  try {
    // Basic gas analysis
    const gasLimit = parseInt(txData.gas || '0', 16);
    const gasPrice = parseInt(txData.gasPrice || '0', 16);
    
    return {
      gasLimit,
      gasPrice,
      estimatedCost: gasLimit * gasPrice,
      // In production, would compare with network averages
      recommendation: gasPrice > 50e9 ? 'Consider lowering gas price' : 'Gas price looks reasonable'
    };
  } catch (error) {
    logError('Gas analysis failed:', error);
    return null;
  }
}

async function simulateTransactionIfNeeded(txData) {
  // Only simulate complex transactions
  if (!txData.data || txData.data === '0x') {
    return null;
  }
  
  try {
    // In production, would use Tenderly or similar
    return {
      success: true,
      gasUsed: parseInt(txData.gas || '21000', 16),
      error: null
    };
  } catch (error) {
    logError('Simulation failed:', error);
    return { success: false, error: error.message };
  }
}

function generateRecommendations(analysisResult, txData) {
  const recommendations = [];
  
  // Risk-based recommendations
  switch (analysisResult.riskLevel) {
    case 'critical':
      recommendations.push('🚨 CRITICAL: This transaction appears extremely risky. Consider rejecting.');
      break;
    case 'high':
      recommendations.push('⚠️ HIGH RISK: Please review this transaction very carefully.');
      break;
    case 'medium':
      recommendations.push('⚠️ Moderate risk detected. Please verify the transaction details.');
      break;
    case 'low':
      recommendations.push('✅ This transaction appears safe to proceed.');
      break;
  }
  
  // Specific risk factor recommendations
  if (analysisResult.riskFactors.includes('high_value')) {
    recommendations.push('💰 High value transaction - double-check the recipient address.');
  }
  
  if (analysisResult.riskFactors.includes('contract_interaction')) {
    recommendations.push('📄 Contract interaction - ensure you trust this smart contract.');
  }
  
  // Gas recommendations
  if (analysisResult.gasInfo?.gasPrice > 50e9) {
    recommendations.push('⛽ Consider lowering gas price to save on fees.');
  }
  
  return recommendations;
}

// New comprehensive handlers for Web3 interception
async function handleAnalyzeWalletConnection(request, sender) {
  const { data } = request;
  const tabId = sender.tab?.id;
  
  try {
    logInfo('🔗 Analyzing wallet connection request:', {
      domain: data.dAppInfo?.domain,
      url: data.dAppInfo?.url,
      tabId
    });
    
    // Analyze dApp legitimacy
    const dAppAnalysis = await analyzeDAppLegitimacy(data.dAppInfo);
    
    // Send data to backend for RAG analysis
    const backendAnalysis = await sendToBackend({
      type: 'wallet_connection',
      dAppInfo: data.dAppInfo,
      analysis: dAppAnalysis
    });
    
    const result = {
      success: true,
      riskLevel: dAppAnalysis.riskLevel,
      recommendations: [
        ...dAppAnalysis.recommendations,
        ...(backendAnalysis.recommendations || [])
      ],
      dAppVerified: dAppAnalysis.isVerified,
      trustScore: dAppAnalysis.trustScore,
      externalVerification: backendAnalysis.verification || null
    };
    
    return result;
    
  } catch (error) {
    logError('Wallet connection analysis failed:', error);
    return {
      success: false,
      error: error.message,
      riskLevel: 'unknown',
      recommendations: ['Unable to analyze connection request']
    };
  }
}

async function handleAnalyzeContractInteraction(request, sender) {
  const { data } = request;
  
  try {
    logInfo('📄 Analyzing contract interaction:', {
      to: data.to,
      method: data.method
    });
    
    // Get contract information from Etherscan
    const contractInfo = await getContractFromEtherscan(data.to);
    
    // Analyze function call if possible
    const functionAnalysis = await analyzeFunctionCall(data.data, contractInfo);
    
    // Send to backend for comprehensive analysis
    const backendAnalysis = await sendToBackend({
      type: 'contract_interaction',
      contractAddress: data.to,
      contractInfo,
      functionCall: data.data,
      functionAnalysis,
      url: data.url
    });
    
    return {
      success: true,
      contractInfo,
      functionAnalysis,
      backendAnalysis
    };
    
  } catch (error) {
    logError('Contract interaction analysis failed:', error);
    return {
      success: false,
      error: error.message
    };
  }
}

async function handleAnalyzeSigningRequest(request, sender) {
  const { data } = request;
  
  try {
    logInfo('✍️ Analyzing signing request:', {
      method: data.method,
      messageLength: data.message?.length
    });
    
    // Analyze the signing request
    const signingAnalysis = await analyzeSigningMessage(data);
    
    // Send to backend for analysis
    const backendAnalysis = await sendToBackend({
      type: 'signing_request',
      method: data.method,
      message: data.message,
      analysis: signingAnalysis
    });
    
    return {
      success: true,
      ...signingAnalysis,
      backendAnalysis
    };
    
  } catch (error) {
    logError('Signing request analysis failed:', error);
    return {
      success: false,
      error: error.message,
      riskLevel: 'unknown'
    };
  }
}

async function handleShowApprovalPopup(request, sender) {
  const { data } = request;
  const tabId = sender.tab?.id;
  
  try {
    // Store approval request
    const messageId = data.messageId;
    pendingTransactions.set(messageId, {
      data,
      tabId,
      type: data.actionType || 'unknown',
      timestamp: Date.now()
    });
    
    // Open popup
    await chrome.action.openPopup();
    
    // Notify popup of pending approval
    setTimeout(() => {
      chrome.runtime.sendMessage({
        type: 'PENDING_APPROVAL_UPDATE',
        data: {
          ...data,
          tabId,
          url: sender.tab?.url
        }
      }).catch(err => logDebug('Popup not ready yet:', err.message));
    }, 500);
    
    return { success: true };
    
  } catch (error) {
    logError('Failed to show approval popup:', error);
    return { success: false, error: error.message };
  }
}

async function handleWalletConnected(request, sender) {
  const { data } = request;
  
  try {
    logInfo('✅ Wallet connected:', {
      accounts: data.accounts?.length,
      domain: data.dAppInfo?.domain
    });
    
    // Store connection info
    const tabId = sender.tab?.id;
    if (tabId) {
      connectedTabs.set(tabId, {
        ...connectedTabs.get(tabId),
        connected: true,
        accounts: data.accounts,
        chainId: data.chainId,
        dAppInfo: data.dAppInfo
      });
    }
    
    // Send connection info to backend for monitoring
    await sendToBackend({
      type: 'wallet_connected',
      accounts: data.accounts,
      dAppInfo: data.dAppInfo,
      chainId: data.chainId
    });
    
    return { success: true };
    
  } catch (error) {
    logError('Failed to handle wallet connection:', error);
    return { success: false, error: error.message };
  }
}

async function handleAccountAccess(request, sender) {
  const { data } = request;
  
  try {
    // Log account access for monitoring
    logInfo('👤 Account access:', {
      accounts: data.accounts?.length,
      url: data.url
    });
    
    return { success: true };
    
  } catch (error) {
    return { success: false, error: error.message };
  }
}

async function handleUserDecision(request, sender) {
  const { messageId, approved } = request;
  
  try {
    // Forward decision to content script
    const transaction = pendingTransactions.get(messageId);
    if (transaction) {
      await sendMessageToTab(transaction.tabId, {
        type: 'USER_DECISION',
        messageId,
        approved
      });
      
      pendingTransactions.delete(messageId);
      
      logInfo(`User ${approved ? 'approved' : 'rejected'} ${transaction.type}:`, messageId);
    }
    
    return { success: true };
    
  } catch (error) {
    logError('Failed to handle user decision:', error);
    return { success: false, error: error.message };
  }
}

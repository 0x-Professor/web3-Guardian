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
  ETHERSCAN_API_KEY: process.env.ETHERSCAN_MAINNET_API_KEY || 'YourApiKeyToken',
  ALCHEMY_API_KEY: process.env.ALCHEMY_API_KEY || 'demo',
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

// Utility functions
function generateCacheKey(data) {
  return JSON.stringify({
    to: data.to,
    value: data.value,
    data: data.data,
    origin: data.origin
  });
}

function getFromCache(cache, key) {
  const item = cache.get(key);
  if (item && Date.now() - item.timestamp < CACHE_TTL) {
    return item.data;
  }
  if (item) {
    cache.delete(key);
  }
  return null;
}

function setCache(cache, key, data) {
  // Prevent cache from growing too large
  if (cache.size >= MAX_CACHE_SIZE) {
    const oldestKey = cache.keys().next().value;
    cache.delete(oldestKey);
  }
  
  cache.set(key, {
    data,
    timestamp: Date.now()
  });
}

function cleanupPendingTransactions() {
  const now = Date.now();
  const expired = [];
  
  for (const [id, tx] of pendingTransactions) {
    if (now - tx.timestamp > CONFIG.USER_DECISION_TIMEOUT) {
      expired.push(id);
    }
  }
  
  expired.forEach(id => {
    pendingTransactions.delete(id);
    logDebug(`Cleaned up expired transaction: ${id}`);
  });
  
  // Also enforce max pending transactions
  if (pendingTransactions.size > CONFIG.MAX_PENDING_TRANSACTIONS) {
    const sortedTxs = Array.from(pendingTransactions.entries())
      .sort((a, b) => a[1].timestamp - b[1].timestamp);
    
    const toRemove = sortedTxs.slice(0, sortedTxs.length - CONFIG.MAX_PENDING_TRANSACTIONS);
    toRemove.forEach(([id]) => {
      pendingTransactions.delete(id);
      logDebug(`Cleaned up old transaction due to limit: ${id}`);
    });
  }
}

async function sendMessageToTab(tabId, message) {
  return new Promise((resolve, reject) => {
    chrome.tabs.sendMessage(tabId, message, { frameId: 0 }, (response) => {
      if (chrome.runtime.lastError) {
        reject(new Error(chrome.runtime.lastError.message));
      } else if (!response) {
        reject(new Error('No response from tab'));
      } else {
        resolve(response);
      }
    });
  });
}

// Initialize background script
async function initialize() {
  try {
    // Load user settings
    const stored = await chrome.storage.local.get(['userSettings']);
    if (stored.userSettings) {
      Object.assign(userSettings, stored.userSettings);
    }
    
    // Set up periodic cleanup
    setInterval(cleanupPendingTransactions, 60000); // Every minute
    
    logInfo('✅ Web3 Guardian background script initialized');
    
  } catch (error) {
    logError('Failed to initialize background script:', error);
  }
}

// Start initialization
initialize();

// API Integration Functions
async function getContractFromEtherscan(address) {
  const ETHERSCAN_API_KEY = process.env.ETHERSCAN_API_KEY || 'YourApiKeyToken';
  const ETHERSCAN_BASE_URL = 'https://api.etherscan.io/api';
  
  try {
    // Get contract source code and ABI
    const sourceResponse = await fetch(
      `${ETHERSCAN_BASE_URL}?module=contract&action=getsourcecode&address=${address}&apikey=${ETHERSCAN_API_KEY}`
    );
    const sourceData = await sourceResponse.json();
    
    // Get contract info
    const contractInfo = {
      address,
      isContract: sourceData.result?.[0]?.SourceCode !== '',
      isVerified: sourceData.result?.[0]?.SourceCode !== '',
      contractName: sourceData.result?.[0]?.ContractName || null,
      compilerVersion: sourceData.result?.[0]?.CompilerVersion || null,
      abi: sourceData.result?.[0]?.ABI || null,
      sourceCode: sourceData.result?.[0]?.SourceCode || null,
      constructorArguments: sourceData.result?.[0]?.ConstructorArguments || null
    };
    
    // If it's a contract, get additional transaction history
    if (contractInfo.isContract) {
      const txResponse = await fetch(
        `${ETHERSCAN_BASE_URL}?module=account&action=txlist&address=${address}&startblock=0&endblock=99999999&page=1&offset=10&sort=desc&apikey=${ETHERSCAN_API_KEY}`
      );
      const txData = await txResponse.json();
      contractInfo.recentTransactions = txData.result || [];
    }
    
    return contractInfo;
    
  } catch (error) {
    logError('Etherscan API error:', error);
    return {
      address,
      isContract: false,
      isVerified: false,
      error: error.message
    };
  }
}

async function getAccountInfoFromAlchemy(address) {
  const ALCHEMY_API_KEY = process.env.ALCHEMY_API_KEY || 'demo';
  const ALCHEMY_BASE_URL = `https://eth-mainnet.g.alchemy.com/v2/${ALCHEMY_API_KEY}`;
  
  try {
    // Get account balance
    const balanceResponse = await fetch(ALCHEMY_BASE_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        jsonrpc: '2.0',
        id: 1,
        method: 'eth_getBalance',
        params: [address, 'latest']
      })
    });
    const balanceData = await balanceResponse.json();
    
    // Get transaction count
    const txCountResponse = await fetch(ALCHEMY_BASE_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        jsonrpc: '2.0',
        id: 2,
        method: 'eth_getTransactionCount',
        params: [address, 'latest']
      })
    });
    const txCountData = await txCountResponse.json();
    
    return {
      address,
      balance: balanceData.result || '0x0',
      transactionCount: txCountData.result || '0x0',
      balanceEth: parseInt(balanceData.result || '0x0', 16) / 1e18
    };
    
  } catch (error) {
    logError('Alchemy API error:', error);
    return {
      address,
      balance: '0x0',
      transactionCount: '0x0',
      error: error.message
    };
  }
}

async function sendToBackend(data) {
  try {
    const response = await fetch(`${CONFIG.BACKEND_URL}/api/analyze`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        tx_data: data,
        network: 'ethereum',
        user_address: data.accounts?.[0] || 'unknown',
        timestamp: new Date().toISOString()
      })
    });
    
    if (!response.ok) {
      throw new Error(`Backend API error: ${response.status}`);
    }
    
    const result = await response.json();
    return result;
    
  } catch (error) {
    logError('Backend API error:', error);
    return {
      success: false,
      error: error.message,
      recommendations: ['Backend analysis unavailable - using local analysis only']
    };
  }
}

// Comprehensive Analysis Functions
async function analyzeDAppLegitimacy(dAppInfo) {
  try {
    const analysis = {
      riskLevel: 'low',
      riskFactors: [],
      recommendations: [],
      trustScore: 100,
      isVerified: false
    };
    
    // Domain analysis
    const domain = dAppInfo.domain;
    
    // Check for suspicious domain patterns
    const suspiciousPatterns = [
      /[0-9]/, // Numbers in domain
      /[^a-z0-9.-]/, // Special characters
      /.{30,}/, // Very long domains
      /.*metamask.*/, // Impersonation attempts
      /.*uniswap.*/, // Impersonation attempts
      /.*opensea.*/ // Impersonation attempts
    ];
    
    if (suspiciousPatterns.some(pattern => pattern.test(domain))) {
      analysis.riskFactors.push('suspicious_domain');
      analysis.riskLevel = 'medium';
      analysis.trustScore -= 30;
    }
    
    // Check for code obfuscation
    if (dAppInfo.hasObfuscatedCode) {
      analysis.riskFactors.push('obfuscated_code');
      analysis.riskLevel = 'high';
      analysis.trustScore -= 50;
      analysis.recommendations.push('⚠️ Code obfuscation detected - proceed with extreme caution');
    }
    
    // Check external domains
    if (dAppInfo.externalDomains?.length > 5) {
      analysis.riskFactors.push('many_external_domains');
      analysis.riskLevel = Math.max(analysis.riskLevel, 'medium');
      analysis.trustScore -= 20;
    }
    
    // Check for HTTPS
    if (!dAppInfo.url.startsWith('https://')) {
      analysis.riskFactors.push('no_https');
      analysis.riskLevel = 'high';
      analysis.trustScore -= 40;
      analysis.recommendations.push('🔒 Site is not using HTTPS - data may not be secure');
    }
    
    // Generate recommendations based on risk level
    switch (analysis.riskLevel) {
      case 'low':
        analysis.recommendations.unshift('✅ dApp appears legitimate and safe to use');
        break;
      case 'medium':
        analysis.recommendations.unshift('⚠️ Some suspicious indicators detected - review carefully');
        break;
      case 'high':
        analysis.recommendations.unshift('🚨 HIGH RISK: Multiple security concerns detected');
        break;
    }
    
    return analysis;
    
  } catch (error) {
    logError('dApp analysis failed:', error);
    return {
      riskLevel: 'unknown',
      riskFactors: ['analysis_failed'],
      recommendations: ['Unable to analyze dApp - exercise caution'],
      trustScore: 0,
      isVerified: false
    };
  }
}

async function analyzeFunctionCall(data, contractInfo) {
  if (!data || data === '0x' || !contractInfo?.abi) {
    return null;
  }
  
  try {
    // Extract function selector (first 4 bytes)
    const selector = data.slice(0, 10);
    
    // Parse ABI to find matching function
    let abi = null;
    try {
      abi = typeof contractInfo.abi === 'string' ? JSON.parse(contractInfo.abi) : contractInfo.abi;
    } catch (e) {
      logError('Failed to parse contract ABI:', e);
      return { selector, error: 'Invalid ABI' };
    }
    
    if (!Array.isArray(abi)) {
      return { selector, error: 'ABI is not an array' };
    }
    
    // Find the function
    const functions = abi.filter(item => item.type === 'function');
    let matchedFunction = null;
    
    for (const func of functions) {
      // Create function signature for comparison
      const signature = `${func.name}(${func.inputs.map(input => input.type).join(',')})`;
      const hash = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(signature));
      const computedSelector = '0x' + Array.from(new Uint8Array(hash.slice(0, 4)))
        .map(b => b.toString(16).padStart(2, '0')).join('');
      
      if (computedSelector === selector) {
        matchedFunction = func;
        break;
      }
    }
    
    const analysis = {
      selector,
      functionName: matchedFunction?.name || 'unknown',
      functionSignature: matchedFunction ? 
        `${matchedFunction.name}(${matchedFunction.inputs.map(input => `${input.type} ${input.name}`).join(', ')})` : 
        'unknown',
      riskLevel: 'low',
      riskFactors: []
    };
    
    // Analyze function risk
    if (matchedFunction?.name) {
      const dangerousFunctions = [
        'transfer', 'transferFrom', 'approve', 'withdraw', 
        'emergencyWithdraw', 'drain', 'destroy', 'selfdestruct',
        'changeOwner', 'transferOwnership', 'renounceOwnership'
      ];
      
      if (dangerousFunctions.some(dangerous => 
        matchedFunction.name.toLowerCase().includes(dangerous.toLowerCase()))) {
        analysis.riskLevel = 'high';
        analysis.riskFactors.push('dangerous_function');
      }
    }
    
    return analysis;
    
  } catch (error) {
    logError('Function analysis failed:', error);
    return { selector: data.slice(0, 10), error: error.message };
  }
}

async function analyzeSigningMessage(data) {
  try {
    const analysis = {
      riskLevel: 'medium', // Signing is always at least medium risk
      riskFactors: ['message_signing'],
      recommendations: ['🖊️ Review the message carefully before signing'],
      messageType: data.method || 'unknown'
    };
    
    // Analyze message content
    if (data.message) {
      const message = typeof data.message === 'string' ? data.message : JSON.stringify(data.message);
      
      // Check for suspicious content
      const suspiciousPatterns = [
        /transfer|send|approve/i,
        /0x[a-fA-F0-9]{40}/g, // Ethereum addresses
        /[0-9]+\s*(eth|ether|wei)/i,
        /permit|allowance/i
      ];
      
      suspiciousPatterns.forEach(pattern => {
        if (pattern.test(message)) {
          analysis.riskLevel = 'high';
          analysis.riskFactors.push('suspicious_message_content');
        }
      });
      
      // Check message length
      if (message.length > 1000) {
        analysis.riskFactors.push('long_message');
        analysis.recommendations.push('📝 Very long message - ensure you understand what you\'re signing');
      }
    }
    
    // Method-specific analysis
    switch (data.method) {
      case 'eth_signTypedData_v4':
        analysis.riskLevel = 'high';
        analysis.riskFactors.push('typed_data_signing');
        analysis.recommendations.push('🔒 Typed data signing can authorize token transfers - be very careful');
        break;
      case 'personal_sign':
        analysis.recommendations.push('✍️ Simple message signing - generally safe but verify the content');
        break;
    }
    
    return analysis;
    
  } catch (error) {
    logError('Signing analysis failed:', error);
    return {
      riskLevel: 'unknown',
      riskFactors: ['analysis_failed'],
      recommendations: ['Unable to analyze signing request - exercise extreme caution'],
      messageType: 'unknown'
    };
  }
}

// Enhanced tab and content script communication
chrome.tabs.onUpdated.addListener((tabId, changeInfo, tab) => {
  if (changeInfo.status === 'complete' && tab.url) {
    // Clean up any old data for this tab
    if (connectedTabs.has(tabId)) {
      const tabInfo = connectedTabs.get(tabId);
      if (tabInfo.url !== tab.url) {
        // URL changed, reset connection status
        connectedTabs.set(tabId, {
          url: tab.url,
          timestamp: Date.now(),
          ready: false,
          connected: false
        });
      }
    }
  }
});

chrome.tabs.onRemoved.addListener((tabId) => {
  // Clean up when tab is closed
  connectedTabs.delete(tabId);
  
  // Clean up any pending transactions for this tab
  for (const [messageId, tx] of pendingTransactions) {
    if (tx.tabId === tabId) {
      pendingTransactions.delete(messageId);
    }
  }
});

// Enhanced error handling and logging
chrome.runtime.onSuspend.addListener(() => {
  logInfo('🔄 Background script suspending, cleaning up...');
  // Perform any necessary cleanup
});

// Export for testing
if (typeof module !== 'undefined' && module.exports) {
  module.exports = {
    handleAnalyzeTransaction,
    handleAnalyzeWalletConnection,
    handleAnalyzeContractInteraction,
    performTransactionAnalysis,
    analyzeDAppLegitimacy,
    analyzeFunctionCall,
    analyzeSigningMessage
  };
}

import { logInfo, logError } from "./logger.js";

const BACKEND_URL = 'http://localhost:8000';

/**
 * Analyze a smart contract using the enhanced RAG pipeline
 * @param {Object} analysisRequest - Contract analysis request
 * @returns {Promise<Object>} Analysis results
 */
export async function analyzeContract(analysisRequest) {
  try {
    logInfo('Starting contract analysis:', analysisRequest);
    
    // Step 1: Submit analysis request
    const response = await fetch(`${BACKEND_URL}/api/analyze/contract`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(analysisRequest)
    });
    
    if (!response.ok) {
      throw new Error(`HTTP error! status: ${response.status}`);
    }
    
    const { analysis_id } = await response.json();
    logInfo('Analysis submitted, ID:', analysis_id);
    
    // Step 2: Poll for results
    return await pollAnalysisResults(analysis_id);
    
  } catch (error) {
    logError('Error in analyzeContract:', error);
    throw error;
  }
}

/**
 * Poll for analysis results with exponential backoff
 * @param {string} analysisId - The analysis ID to poll
 * @returns {Promise<Object>} Final analysis results
 */
async function pollAnalysisResults(analysisId, maxAttempts = 30, initialDelay = 1000) {
  let attempts = 0;
  let delay = initialDelay;
  
  while (attempts < maxAttempts) {
    try {
      const response = await fetch(`${BACKEND_URL}/api/analysis/${analysisId}`);
      
      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }
      
      const result = await response.json();
      logInfo(`Analysis status (attempt ${attempts + 1}):`, result.status);
      
      // Check if analysis is complete
      if (result.status === 'completed') {
        logInfo('Analysis completed successfully');
        return result;
      } else if (result.status === 'failed') {
        throw new Error(`Analysis failed: ${result.error}`);
      }
      
      // Wait before next poll (exponential backoff)
      await new Promise(resolve => setTimeout(resolve, delay));
      delay = Math.min(delay * 1.2, 10000); // Cap at 10 seconds
      attempts++;
      
    } catch (error) {
      logError(`Polling attempt ${attempts + 1} failed:`, error);
      if (attempts >= maxAttempts - 1) {
        throw new Error(`Analysis polling failed after ${maxAttempts} attempts: ${error.message}`);
      }
      await new Promise(resolve => setTimeout(resolve, delay));
      attempts++;
    }
  }
  
  throw new Error('Analysis timed out after maximum attempts');
}

/**
 * Quick contract analysis for immediate feedback
 * @param {string} contractAddress - Contract address to analyze
 * @param {string} network - Network name
 * @returns {Promise<Object>} Basic analysis results
 */
export async function quickAnalyzeContract(contractAddress, network = 'mainnet') {
  return analyzeContract({
    contract_address: contractAddress,
    network: network,
    analysis_types: ['static'], // Quick analysis only does static
    user_address: null
  });
}

/**
 * Full contract analysis with static and dynamic analysis
 * @param {string} contractAddress - Contract address to analyze  
 * @param {string} network - Network name
 * @param {string} userAddress - User's wallet address
 * @returns {Promise<Object>} Complete analysis results
 */
export async function fullAnalyzeContract(contractAddress, network = 'mainnet', userAddress = null) {
  return analyzeContract({
    contract_address: contractAddress,
    network: network,
    analysis_types: ['static', 'dynamic'],
    user_address: userAddress
  });
}

export async function fetchAnalysis(url, data) {
  try {
    const response = await fetch(`${BACKEND_URL}/analyze`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ ...data, url })
    });
    
    if (!response.ok) {
      throw new Error(`HTTP error! status: ${response.status}`);
    }
    
    return await response.json();
  } catch (error) {
    logError('Error in fetchAnalysis:', error);
    throw error;
  }
}

export async function fetchGasPrice() {
  try {
    const response = await fetch(`${BACKEND_URL}/gas-price`);
    if (!response.ok) {
      throw new Error(`HTTP error! status: ${response.status}`);
    }
    return await response.json();
  } catch (error) {
    logError('Error fetching gas price:', error);
    throw error;
  }
}

export async function simulateTransaction(transaction) {
  try {
    const response = await fetch(`${BACKEND_URL}/simulate-tx`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(transaction)
    });
    
    if (!response.ok) {
      throw new Error(`HTTP error! status: ${response.status}`);
    }
    
    return await response.json();
  } catch (error) {
    logError('Error in simulateTransaction:', error);
    throw error;
  }
}

/**
 * Check backend health status
 * @returns {Promise<Object>} Health status
 */
export async function checkBackendHealth() {
  try {
    const response = await fetch(`${BACKEND_URL}/health`);
    if (!response.ok) {
      throw new Error(`Health check failed: ${response.status}`);
    }
    return await response.json();
  } catch (error) {
    logError('Backend health check failed:', error);
    throw error;
  }
}

import { logInfo, logError } from "./logger.js";

const BACKEND_URL = 'http://localhost:8000';

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

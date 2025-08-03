// API client for communicating with the Web3 Guardian backend

class ApiClient {
  constructor(baseUrl = 'http://localhost:8000') {
    this.baseUrl = baseUrl;
    this.authToken = null;
  }

  // Set authentication token
  setAuthToken(token) {
    this.authToken = token;
  }

  // Make an authenticated request
  async _request(method, endpoint, data = null) {
    const url = `${this.baseUrl}${endpoint}`;
    const headers = {
      'Content-Type': 'application/json',
    };

    if (this.authToken) {
      headers['Authorization'] = `Bearer ${this.authToken}`;
    }

    const config = {
      method,
      headers,
      credentials: 'include',
    };

    if (data) {
      config.body = JSON.stringify(data);
    }

    try {
      const response = await fetch(url, config);
      
      if (!response.ok) {
        const error = await response.json().catch(() => ({}));
        throw new Error(error.message || `HTTP error! status: ${response.status}`);
      }

      // Handle empty responses
      const contentType = response.headers.get('content-type');
      if (contentType && contentType.includes('application/json')) {
        return await response.json();
      }
      
      return await response.text();
    } catch (error) {
      console.error('API request failed:', error);
      throw error;
    }
  }

  // Health check
  async healthCheck() {
    return this._request('GET', '/health');
  }

  // Analyze a transaction
  async analyzeTransaction(transactionData) {
    return this._request('POST', '/api/analyze', {
      tx_data: transactionData,
      network: 'ethereum', // TODO: Detect network
    });
  }

  // Get transaction simulation
  async simulateTransaction(transactionData) {
    return this._request('POST', '/api/simulate', {
      tx_data: transactionData,
    });
  }

  // Get gas price recommendations
  async getGasRecommendations() {
    return this._request('GET', '/api/gas/recommendations');
  }

  // Get token information
  async getTokenInfo(tokenAddress) {
    return this._request('GET', `/api/tokens/${tokenAddress}`);
  }

  // Get contract information
  async getContractInfo(contractAddress) {
    return this._request('GET', `/api/contracts/${contractAddress}`);
  }

  // Get security alerts for an address
  async getSecurityAlerts(address) {
    return this._request('GET', `/api/security/alerts/${address}`);
  }

  // Report a suspicious address
  async reportAddress(address, reason) {
    return this._request('POST', '/api/security/report', {
      address,
      reason,
    });
  }
}

// Create a singleton instance
export const apiClient = new ApiClient();

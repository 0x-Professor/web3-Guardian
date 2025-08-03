// Mock the chrome API
const chrome = require('sinon-chrome');
global.chrome = chrome;

// Mock the fetch API
global.fetch = jest.fn();

// Import the background script after setting up mocks
require('../../extension/src/background/background');

describe('Background Script', () => {
  let messageHandlers = [];
  
  beforeEach(() => {
    // Reset mocks before each test
    jest.clearAllMocks();
    
    // Setup message handlers
    messageHandlers = [];
    chrome.runtime.onMessage.addListener.callsFake((handler) => {
      messageHandlers.push(handler);
      return true;
    });
    
    // Mock fetch responses
    global.fetch.mockResolvedValue({
      ok: true,
      json: () => Promise.resolve({
        success: true,
        riskLevel: 'low',
        recommendations: []
      })
    });
  });
  
  describe('Message Handling', () => {
    it('should handle ANALYZE_TRANSACTION message', async () => {
      const testData = {
        to: '0x123',
        value: '0x1234',
        data: '0x'
      };
      
      // Mock the sendResponse function
      const sendResponse = jest.fn();
      
      // Simulate receiving a message
      const message = {
        type: 'ANALYZE_TRANSACTION',
        data: testData
      };
      
      // Call the message handler
      const handler = messageHandlers[0];
      handler(message, {}, sendResponse);
      
      // Wait for async operations to complete
      await new Promise(process.nextTick);
      
      // Verify the response
      expect(sendResponse).toHaveBeenCalledWith(
        expect.objectContaining({
          success: true,
          riskLevel: 'low'
        })
      );
    });
    
    it('should handle WEB3_TRANSACTION message', async () => {
      const testData = {
        method: 'eth_sendTransaction',
        params: [{
          from: '0x123',
          to: '0x456',
          value: '0x1234'
        }]
      };
      
      // Mock the sendResponse function
      const sendResponse = jest.fn();
      
      // Simulate receiving a message
      const message = {
        type: 'WEB3_TRANSACTION',
        data: testData
      };
      
      // Call the message handler
      const handler = messageHandlers[0];
      handler(message, {}, sendResponse);
      
      // Wait for async operations to complete
      await new Promise(process.nextTick);
      
      // Verify the response
      expect(sendResponse).toHaveBeenCalledWith(
        expect.objectContaining({
          shouldProceed: true
        })
      );
    });
  });
  
  describe('Transaction Analysis', () => {
    it('should analyze transaction and return risk level', async () => {
      // Import the analyzeTransaction function directly
      const { analyzeTransaction } = require('../../extension/src/background/background');
      
      const result = await analyzeTransaction({
        to: '0x123',
        value: '0x1234',
        data: '0x'
      });
      
      expect(result).toEqual({
        success: true,
        riskLevel: 'low',
        recommendations: []
      });
    });
    
    it('should handle analysis errors', async () => {
      // Mock a failed fetch
      global.fetch.mockResolvedValueOnce({
        ok: false,
        status: 500,
        json: () => Promise.resolve({
          message: 'Internal server error'
        })
      });
      
      const { analyzeTransaction } = require('../../extension/src/background/background');
      
      const result = await analyzeTransaction({
        to: '0x123',
        value: '0x1234'
      });
      
      expect(result).toEqual({
        success: false,
        error: 'Failed to analyze transaction: 500'
      });
    });
  });
  
  describe('Notification Handling', () => {
    it('should show notification for new transaction', () => {
      // Import the showTransactionNotification function
      const { showTransactionNotification } = require('../../extension/src/background/background');
      
      const txData = {
        id: '123',
        from: '0x123',
        to: '0x456',
        value: '0x1234'
      };
      
      showTransactionNotification(txData);
      
      expect(chrome.notifications.create).toHaveBeenCalledWith(
        expect.any(String),
        expect.objectContaining({
          type: 'basic',
          title: 'New Transaction',
          message: 'Transaction to 0x456',
          iconUrl: '/assets/icon128.png'
        })
      );
    });
  });
});

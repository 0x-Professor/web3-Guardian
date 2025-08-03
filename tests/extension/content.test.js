// Mock the chrome API
const chrome = {
  runtime: {
    sendMessage: jest.fn(),
    onMessage: {
      addListener: jest.fn(),
      removeListener: jest.fn(),
    },
  },
  notifications: {
    create: jest.fn(),
    onClicked: {
      addListener: jest.fn(),
    },
  },
};

global.chrome = chrome;

// Import the content script after mocking chrome
require('../../extension/src/content/content');

describe('Content Script', () => {
  let messageHandlers = [];
  let notificationClickHandlers = [];
  
  beforeEach(() => {
    // Reset mocks
    jest.clearAllMocks();
    
    // Setup mock message handlers
    messageHandlers = [];
    chrome.runtime.sendMessage.mockImplementation((message, callback) => {
      // Simulate async response
      setTimeout(() => {
        if (message.type === 'ANALYZE_TRANSACTION') {
          callback({ success: true, data: { riskLevel: 'low' } });
        } else if (message.type === 'WEB3_TRANSACTION') {
          callback({ shouldProceed: true });
        }
      }, 0);
    });
    
    // Setup message listener
    chrome.runtime.onMessage.addListener.mockImplementation((handler) => {
      messageHandlers.push(handler);
      return true;
    });
    
    // Setup notification click handler
    chrome.notifications.onClicked.addListener.mockImplementation((handler) => {
      notificationClickHandlers.push(handler);
    });
  });
  
  describe('Message Handling', () => {
    it('should handle ANALYZE_TRANSACTION message', (done) => {
      // Simulate message from background script
      const testData = { to: '0x123', value: '100' };
      const sendResponse = jest.fn();
      
      // Call the message handler
      messageHandlers[0]({ type: 'ANALYZE_TRANSACTION', data: testData }, {}, sendResponse);
      
      // Verify response is sent
      setTimeout(() => {
        expect(sendResponse).toHaveBeenCalledWith(
          expect.objectContaining({
            riskLevel: expect.any(String),
          })
        );
        done();
      }, 10);
    });
  });
  
  describe('Web3 Transaction Interception', () => {
    it('should intercept Web3 transactions', () => {
      // Mock window.ethereum
      const originalSend = jest.fn();
      const originalSendAsync = jest.fn();
      
      window.ethereum = {
        send: originalSend,
        sendAsync: originalSendAsync,
      };
      
      // Call setup function
      const setupFn = require('../../extension/src/content/content').setupWeb3Interception;
      setupFn();
      
      // Verify sendAsync was overridden
      expect(window.ethereum.sendAsync).not.toBe(originalSendAsync);
    });
    
    it('should send transaction to background script', (done) => {
      // Setup
      const testMethod = 'eth_sendTransaction';
      const testParams = [{ from: '0x123', to: '0x456', value: '100' }];
      
      // Call the overridden sendAsync
      window.ethereum.sendAsync(testMethod, testParams, (error, result) => {
        expect(error).toBeNull();
        expect(result).toBeDefined();
        done();
      });
      
      // Verify message was sent to background
      expect(chrome.runtime.sendMessage).toHaveBeenCalledWith(
        {
          type: 'WEB3_TRANSACTION',
          data: {
            method: testMethod,
            params: testParams,
            origin: window.location.origin,
          },
        },
        expect.any(Function)
      );
    });
  });
  
  describe('Transaction Analysis', () => {
    it('should analyze transaction and return risk level', async () => {
      const { analyzeTransaction } = require('../../extension/src/content/content');
      
      const result = await analyzeTransaction({
        to: '0x123',
        value: '1000000000000000000', // 1 ETH
        data: '0x',
      });
      
      expect(result).toEqual({
        riskLevel: 'low',
        recommendations: expect.any(Array),
        gasEstimate: undefined,
        simulation: undefined,
      });
    });
    
    it('should handle analysis errors', async () => {
      // Mock a failed response
      chrome.runtime.sendMessage.mockImplementationOnce((message, callback) => {
        callback({ success: false, error: 'Analysis failed' });
      });
      
      const { analyzeTransaction } = require('../../extension/src/content/content');
      
      const result = await analyzeTransaction({ to: '0x123' });
      
      expect(result).toEqual({
        riskLevel: 'unknown',
        error: 'Analysis failed',
      });
    });
  });
});

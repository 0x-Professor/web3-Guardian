import React, { useState, useEffect } from 'react';
import { createRoot } from 'react-dom/client';
import TransactionDetails from './components/TransactionDetails';
import ActionButtons from './components/ActionButtons';

// Parse URL parameters
const getUrlParams = () => {
  const params = new URLSearchParams(window.location.search);
  const txParam = params.get('tx');
  return txParam ? JSON.parse(decodeURIComponent(txParam)) : null;
};

const Popup = () => {
  const [transaction, setTransaction] = useState(null);
  const [analysis, setAnalysis] = useState(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    const txData = getUrlParams();
    setTransaction(txData);
    
    if (txData) {
      // Simulate analysis (in a real app, this would call the backend)
      const analyzeTransaction = async () => {
        try {
          setIsLoading(true);
          // In a real app, we would call our background script here
          // which would then call the backend API
          const response = await new Promise(resolve => {
            chrome.runtime.sendMessage(
              { type: 'ANALYZE_TRANSACTION', data: txData },
              resolve
            );
          });
          
          if (response.success) {
            setAnalysis(response.data);
          } else {
            setError(response.error || 'Failed to analyze transaction');
          }
        } catch (err) {
          console.error('Error analyzing transaction:', err);
          setError('An error occurred while analyzing the transaction');
        } finally {
          setIsLoading(false);
        }
      };
      
      analyzeTransaction();
    } else {
      setIsLoading(false);
    }
  }, []);

  const handleApprove = () => {
    // Send message to background script to approve the transaction
    chrome.runtime.sendMessage({
      type: 'TRANSACTION_RESPONSE',
      transactionId: transaction?.id,
      approved: true
    });
    window.close();
  };

  const handleReject = () => {
    // Send message to background script to reject the transaction
    chrome.runtime.sendMessage({
      type: 'TRANSACTION_RESPONSE',
      transactionId: transaction?.id,
      approved: false
    });
    window.close();
  };

  if (isLoading) {
    return (
      <div className="loading">
        <div className="spinner"></div>
        <div>Analyzing transaction...</div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="card">
        <h3>Error</h3>
        <p>{error}</p>
        <button className="btn btn-outline btn-full" onClick={() => window.close()}>
          Close
        </button>
      </div>
    );
  }

  if (!transaction) {
    return (
      <div className="empty-state">
        <p>No active transaction found.</p>
        <p>This popup is used to review transactions.</p>
      </div>
    );
  }

  return (
    <div className="app">
      <header className="header">
        <div className="logo">
          <img src="../assets/icon48.png" alt="Web3 Guardian" />
          <span>Web3 Guardian</span>
        </div>
      </header>
      
      <main className="main">
        <TransactionDetails 
          transaction={transaction} 
          analysis={analysis} 
        />
        
        <ActionButtons 
          onApprove={handleApprove}
          onReject={handleReject}
          riskLevel={analysis?.riskLevel}
        />
      </main>
    </div>
  );
};

// Render the app
const container = document.getElementById('root');
const root = createRoot(container);
root.render(<Popup />);

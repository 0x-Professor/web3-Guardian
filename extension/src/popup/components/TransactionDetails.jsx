import React from 'react';

const formatAddress = (address) => {
  if (!address) return 'N/A';
  return `${address.substring(0, 6)}...${address.substring(address.length - 4)}`;
};

const formatValue = (value, decimals = 18) => {
  if (!value) return '0';
  // Convert from wei to ether
  const etherValue = parseFloat(value) / 1e18;
  return etherValue.toFixed(6);
};

const getRiskBadge = (riskLevel) => {
  if (!riskLevel) return null;
  
  const riskClasses = {
    low: 'risk-low',
    medium: 'risk-medium',
    high: 'risk-high',
    critical: 'risk-critical'
  };
  
  const displayText = riskLevel.charAt(0).toUpperCase() + riskLevel.slice(1);
  
  return (
    <span className={`risk-badge ${riskClasses[riskLevel] || ''}`}>
      {displayText} Risk
    </span>
  );
};

const TransactionDetails = ({ transaction, analysis }) => {
  if (!transaction) return null;
  
  const { method, params = [] } = transaction;
  const txData = params[0] || {};
  const { from, to, value, data, gas, gasPrice } = txData;
  
  return (
    <div className="transaction-details">
      <div className="card">
        <h3 className="card-title">Transaction Details</h3>
        
        <div className="detail-row">
          <span className="detail-label">Method:</span>
          <span className="detail-value">{method || 'eth_sendTransaction'}</span>
        </div>
        
        <div className="detail-row">
          <span className="detail-label">From:</span>
          <span className="detail-value" title={from}>
            {formatAddress(from)}
          </span>
        </div>
        
        <div className="detail-row">
          <span className="detail-label">To:</span>
          <span className="detail-value" title={to}>
            {to ? formatAddress(to) : 'Contract Deployment'}
          </span>
        </div>
        
        <div className="detail-row">
          <span className="detail-label">Value:</span>
          <span className="detail-value">
            {formatValue(value)} ETH
          </span>
        </div>
        
        {gas && (
          <div className="detail-row">
            <span className="detail-label">Gas Limit:</span>
            <span className="detail-value">{gas}</span>
          </div>
        )}
        
        {gasPrice && (
          <div className="detail-row">
            <span className="detail-label">Gas Price:</span>
            <span className="detail-value">
              {formatValue(gasPrice, 9)} Gwei
            </span>
          </div>
        )}
        
        {data && data !== '0x' && (
          <div className="detail-row">
            <span className="detail-label">Data:</span>
            <span className="detail-value" title={data}>
              {data.substring(0, 20)}...
            </span>
          </div>
        )}
      </div>
      
      {analysis && (
        <div className="card">
          <h3 className="card-title">Security Analysis</h3>
          
          <div className="detail-row">
            <span className="detail-label">Risk Level:</span>
            <span className="detail-value">
              {getRiskBadge(analysis.riskLevel)}
            </span>
          </div>
          
          {analysis.gasEstimate && (
            <div className="detail-row">
              <span className="detail-label">Estimated Gas:</span>
              <span className="detail-value">
                {analysis.gasEstimate}
              </span>
            </div>
          )}
          
          {analysis.simulation && (
            <div className="detail-row">
              <span className="detail-label">Simulation:</span>
              <span className="detail-value">
                {analysis.simulation.success ? '✅ Success' : '❌ Failed'}
              </span>
            </div>
          )}
        </div>
      )}
      
      {analysis?.recommendations?.length > 0 && (
        <div className="card">
          <h3 className="card-title">Recommendations</h3>
          
          {analysis.recommendations.map((rec, index) => (
            <div 
              key={index} 
              className={`recommendation ${rec.severity || ''}`}
            >
              <div className="recommendation-icon">
                {rec.severity === 'critical' ? '!' : 'i'}
              </div>
              <div>
                <div style={{ fontWeight: 500 }}>{rec.title}</div>
                <div style={{ fontSize: '13px', color: 'var(--text-secondary)' }}>
                  {rec.description}
                </div>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
};

export default TransactionDetails;

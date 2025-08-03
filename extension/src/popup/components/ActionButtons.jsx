import React from 'react';

const ActionButtons = ({ onApprove, onReject, riskLevel }) => {
  const getButtonVariant = () => {
    if (!riskLevel) return 'primary';
    
    const variants = {
      low: 'primary',
      medium: 'warning',
      high: 'danger',
      critical: 'danger',
    };
    
    return variants[riskLevel] || 'primary';
  };
  
  const getApproveButtonText = () => {
    if (!riskLevel) return 'Approve';
    
    const buttonText = {
      low: 'Approve',
      medium: 'Proceed Anyway',
      high: 'Proceed with Caution',
      critical: 'I Understand the Risks',
    };
    
    return buttonText[riskLevel] || 'Approve';
  };

  return (
    <div className="btn-group">
      <button 
        className={`btn btn-${getButtonVariant()}`}
        onClick={onApprove}
      >
        {getApproveButtonText()}
      </button>
      <button 
        className="btn btn-outline"
        onClick={onReject}
      >
        Reject
      </button>
    </div>
  );
};

export default ActionButtons;

from typing import Dict, Any, Optional, List, Tuple
from web3 import Web3
import logging

logger = logging.getLogger(__name__)

class GasOptimizer:
    """Handles gas optimization for transactions."""
    
    def __init__(self, web3: Web3, max_priority_fee_per_gas: int = 2 * 10**9):
        """Initialize the gas optimizer.
        
        Args:
            web3: Web3 instance
            max_priority_fee_per_gas: Default max priority fee per gas in wei
        """
        self.web3 = web3
        self.max_priority_fee_per_gas = max_priority_fee_per_gas
    
    async def optimize_gas(self, tx_params: Dict[str, Any]) -> Dict[str, Any]:
        """Optimize gas parameters for a transaction.
        
        Args:
            tx_params: Transaction parameters including from, to, value, data
            
        Returns:
            Optimized transaction parameters
        """
        try:
            # Make a copy of the original parameters
            optimized = tx_params.copy()
            
            # Get current gas price from the network
            current_gas_price = self.web3.eth.gas_price
            
            # Get base fee from the latest block
            latest_block = self.web3.eth.get_block('latest')
            base_fee = latest_block.get('baseFeePerGas', current_gas_price)
            
            # Set maxFeePerGas (base fee + priority fee)
            max_fee_per_gas = base_fee + self.max_priority_fee_per_gas
            
            # Update transaction parameters
            optimized['maxFeePerGas'] = max_fee_per_gas
            optimized['maxPriorityFeePerGas'] = self.max_priority_fee_per_gas
            
            # For legacy transactions, set gasPrice
            if 'gasPrice' not in tx_params:
                optimized['gasPrice'] = max_fee_per_gas
            
            # Estimate gas if not provided
            if 'gas' not in tx_params:
                try:
                    optimized['gas'] = self.web3.eth.estimate_gas(tx_params)
                except Exception as e:
                    logger.warning(f"Failed to estimate gas: {str(e)}")
                    # Use a default gas limit if estimation fails
                    optimized['gas'] = 200000
            
            return optimized
            
        except Exception as e:
            logger.error(f"Error in gas optimization: {str(e)}")
            # Return original parameters if optimization fails
            return tx_params
    
    def get_gas_savings(
        self, 
        original_tx: Dict[str, Any], 
        optimized_tx: Dict[str, Any]
    ) -> Dict[str, Any]:
        """Calculate gas savings between original and optimized transactions.
        
        Args:
            original_tx: Original transaction parameters
            optimized_tx: Optimized transaction parameters
            
        Returns:
            Dictionary with gas savings information
        """
        original_gas = original_tx.get('gas', 0)
        optimized_gas = optimized_tx.get('gas', 0)
        
        original_gas_price = original_tx.get('gasPrice', 0) or original_tx.get('maxFeePerGas', 0)
        optimized_gas_price = optimized_tx.get('gasPrice', 0) or optimized_tx.get('maxFeePerGas', 0)
        
        original_cost = original_gas * original_gas_price
        optimized_cost = optimized_gas * optimized_gas_price
        
        savings = original_cost - optimized_cost
        savings_percent = (savings / original_cost * 100) if original_cost > 0 else 0
        
        return {
            'original_gas': original_gas,
            'optimized_gas': optimized_gas,
            'original_gas_price': original_gas_price,
            'optimized_gas_price': optimized_gas_price,
            'original_cost': original_cost,
            'optimized_cost': optimized_cost,
            'savings': savings,
            'savings_percent': round(savings_percent, 2)
        }

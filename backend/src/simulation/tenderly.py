import os
import logging
from typing import Dict, Any, Optional, Union
from web3 import Web3
from tenderly import Tenderly

logger = logging.getLogger(__name__)

class TenderlySimulator:
    """Handles transaction simulation using Tenderly API."""
    
    def __init__(self, api_key: str, project_slug: str, account_slug: str):
        """Initialize the Tenderly simulator.
        
        Args:
            api_key: Tenderly API key
            project_slug: Tenderly project slug
            account_slug: Tenderly account slug (username or organization name)
        """
        self.tenderly = Tenderly(
            access_key=api_key,
            account_slug=account_slug,
            project_slug=project_slug
        )
        
        # Map common chain IDs to Tenderly network names
        self.network_map = {
            1: "mainnet",
            5: "goerli",
            137: "polygon",
            42161: "arbitrum-one",
            10: "optimism",
            56: "bsc",
        }
    
    def simulate_transaction(
        self,
        tx_params: Dict[str, Any],
        network_id: int = 1,
        block_number: Optional[int] = None,
        save: bool = True
    ) -> Dict[str, Any]:
        """Simulate a transaction using Tenderly.
        
        Args:
            tx_params: Transaction parameters including from, to, data, value, etc.
            network_id: Network ID (default: 1 for mainnet)
            block_number: Block number to simulate at (default: latest)
            save: Whether to save the simulation in Tenderly
            
        Returns:
            Dictionary containing simulation results
        """
        if not hasattr(self, 'tenderly') or not self.tenderly:
            logger.warning("Tenderly not properly initialized")
            return {"error": "Tenderly not configured"}
            
        try:
            # Get the network from our mapping, default to mainnet
            network = self.network_map.get(network_id, "mainnet")
            
            # Prepare transaction data
            tx_data = {
                "from": tx_params.get('from'),
                "to": tx_params.get('to'),
                "input": tx_params.get('data', '0x'),
                "gas": int(tx_params.get('gas', 3000000)),
                "gas_price": int(tx_params.get('gasPrice', '0x0'), 16) if isinstance(tx_params.get('gasPrice'), str) else tx_params.get('gasPrice', 0),
                "value": int(tx_params.get('value', '0x0'), 16) if isinstance(tx_params.get('value'), str) else tx_params.get('value', 0),
                "save": save,
                "save_if_fails": True,
                "network_id": str(network_id),
                "block_number": block_number
            }
            
            # Add optional parameters if they exist
            if 'nonce' in tx_params:
                tx_data["nonce"] = tx_params['nonce']
                
            if 'accessList' in tx_params:
                tx_data["access_list"] = tx_params['accessList']
                
            if 'maxFeePerGas' in tx_params:
                tx_data["max_fee_per_gas"] = int(tx_params['maxFeePerGas'], 16) if isinstance(tx_params['maxFeePerGas'], str) else tx_params['maxFeePerGas']
                
            if 'maxPriorityFeePerGas' in tx_params:
                tx_data["max_priority_fee_per_gas"] = (
                    int(tx_params['maxPriorityFeePerGas'], 16) 
                    if isinstance(tx_params['maxPriorityFeePerGas'], str) 
                    else tx_params['maxPriorityFeePerGas']
                )
            
            # Run the simulation
            simulation = self.tenderly.simulator.simulate(tx_data)
            
            # Process the simulation results
            return {
                "success": simulation.get("status", False),
                "gas_used": simulation.get("transaction", {}).get("gas_used", 0),
                "block_number": simulation.get("block_number"),
                "transaction_hash": simulation.get("transaction", {}).get("hash"),
                "status": simulation.get("transaction", {}).get("status"),
                "error": simulation.get("error", {}).get("error_message"),
                "logs": simulation.get("logs", []),
                "trace": simulation.get("trace", []),
                "state_diff": simulation.get("state_diff", {}),
                "simulation_id": simulation.get("id")
            }
            
        except Exception as e:
            logger.error(f"Tenderly simulation failed: {str(e)}")
            return {
                "success": False,
                "error": f"Tenderly simulation error: {str(e)}"
            }
    
    def get_gas_used(self, simulation_result: Dict[str, Any]) -> int:
        """Extract gas used from simulation result.
        
        Args:
            simulation_result: Result from simulate_transaction
            
        Returns:
            int: Gas used in the simulation, or 0 if not available
        """
        try:
            return int(simulation_result.get("gas_used", 0))
        except (ValueError, AttributeError):
            return 0
    
    def get_error_message(self, simulation_result: Dict[str, Any]) -> Optional[str]:
        """Extract error message from simulation result if any.
        
        Args:
            simulation_result: Result from simulate_transaction
            
        Returns:
            Optional[str]: Error message if simulation failed, None otherwise
        """
        if not simulation_result.get("success", False):
            return simulation_result.get("error")
        return None
    
    def is_simulation_successful(self, simulation_result: Dict[str, Any]) -> bool:
        """Check if simulation was successful.
        
        Args:
            simulation_result: Result from simulate_transaction
            
        Returns:
            bool: True if simulation was successful, False otherwise
        """
        return simulation_result.get("success", False) and simulation_result.get("status", False)
    
    def get_simulation_url(self, simulation_result: Dict[str, Any]) -> Optional[str]:
        """Get URL to view the simulation in Tenderly dashboard.
        
        Args:
            simulation_result: Result from simulate_transaction containing simulation_id
            
        Returns:
            Optional[str]: URL to view the simulation, or None if not available
        """
        if not hasattr(self, 'tenderly') or not self.tenderly:
            return None
            
        sim_id = simulation_result.get("simulation_id")
        if not sim_id:
            return None
            
        # Extract account and project from the Tenderly client
        account_slug = getattr(self.tenderly, 'account_slug', '')
        project_slug = getattr(self.tenderly, 'project_slug', '')
        
        if not account_slug or not project_slug:
            return None
            
        return (
            f"https://dashboard.tenderly.co/{account_slug}/"
            f"{project_slug}/simulator/{sim_id}"
        )

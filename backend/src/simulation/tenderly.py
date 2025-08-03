import os
import logging
from typing import Dict, Any, Optional, Union
from web3 import Web3
from tenderly_sdk import Tenderly, Network
from tenderly_sdk.simulation import SimulationRequest

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
        
        # Map common network names to Tenderly network IDs
        self.network_map = {
            1: Network.MAINNET,
            5: Network.GOERLI,
            137: Network.POLYGON,
            42161: Network.ARBITRUM_ONE,
            10: Network.OPTIMISM,
            56: Network.BSC_MAINNET,
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
            network = self.network_map.get(network_id, Network.MAINNET)
            
            # Prepare the simulation request
            request = SimulationRequest(
                from_=tx_params.get('from'),
                to=tx_params.get('to'),
                input=tx_params.get('data', '0x'),
                gas=int(tx_params.get('gas', 3000000)),
                gas_price=int(tx_params.get('gasPrice', '0x0'), 16) if isinstance(tx_params.get('gasPrice'), str) else tx_params.get('gasPrice', 0),
                value=int(tx_params.get('value', '0x0'), 16) if isinstance(tx_params.get('value'), str) else tx_params.get('value', 0),
                save=save,
                network_id=network.value,
                block_number=block_number,
                save_if_fails=True
            )
            
            # Add optional parameters if they exist
            if 'nonce' in tx_params:
                request.nonce = tx_params['nonce']
                
            if 'accessList' in tx_params:
                request.access_list = tx_params['accessList']
                
            if 'maxFeePerGas' in tx_params:
                request.max_fee_per_gas = int(tx_params['maxFeePerGas'], 16) if isinstance(tx_params['maxFeePerGas'], str) else tx_params['maxFeePerGas']
                
            if 'maxPriorityFeePerGas' in tx_params:
                request.max_priority_fee_per_gas = (
                    int(tx_params['maxPriorityFeePerGas'], 16) 
                    if isinstance(tx_params['maxPriorityFeePerGas'], str) 
                    else tx_params['maxPriorityFeePerGas']
                )
            
            # Run the simulation
            simulation = self.tenderly.simulator.simulate(request)
            
            # Process the simulation results
            return {
                "success": simulation.status,
                "gas_used": simulation.gas_used,
                "block_number": simulation.block_number,
                "transaction_hash": simulation.transaction_hash,
                "status": simulation.status,
                "error": simulation.error_message,
                "logs": simulation.logs or [],
                "trace": simulation.trace or [],
                "state_diff": simulation.state_diff or {},
                "simulation_id": simulation.id
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
            
        return (
            f"https://dashboard.tenderly.co/{self.tenderly.account_slug}/"
            f"{self.tenderly.project_slug}/simulator/{sim_id}"
        )

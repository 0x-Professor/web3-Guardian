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
        tx_data: Dict[str, Any],
        network_id: str = "1",  # Mainnet by default
        block_number: Optional[int] = None,
        save: bool = True
    ) -> Dict[str, Any]:
        """Simulate a transaction using Tenderly.
        
        Args:
            tx_data: Transaction data including from, to, value, data, gas, gasPrice
            network_id: Network ID (1 for mainnet, 5 for Goerli, etc.)
            block_number: Block number to simulate at (latest if None)
            save: Whether to save the simulation in Tenderly dashboard
            
        Returns:
            Simulation results
        """
        url = f"{self.BASE_URL}/account/{self.username}/project/{self.project_slug}/simulate"
        
        # Prepare simulation parameters
        params = {
            "save": save,
            "simulation_type": "full",
            "network_id": str(network_id),
        }
        
        if block_number is not None:
            params["block_number"] = block_number
        
        # Prepare transaction data
        simulation_data = {
            "from": tx_data.get("from"),
            "to": tx_data.get("to"),
            "input": tx_data.get("data", "0x"),
            "gas": int(tx_data.get("gas", 3000000)),
            "gas_price": str(tx_data.get("gasPrice", "0x0")),
            "value": str(tx_data.get("value", "0x0")),
            "save_if_fails": True
        }
        
        try:
            response = self.session.post(
                url,
                params=params,
                json=simulation_data
            )
            response.raise_for_status()
            return response.json()
        except requests.exceptions.RequestException as e:
            logger.error(f"Tenderly simulation failed: {str(e)}")
            if hasattr(e, 'response') and e.response is not None:
                logger.error(f"Response: {e.response.text}")
            raise
    
    def get_gas_used(self, simulation_result: Dict[str, Any]) -> int:
        """Extract gas used from simulation result."""
        return simulation_result.get("transaction", {}).get("gas_used", 0)
    
    def get_error_message(self, simulation_result: Dict[str, Any]) -> Optional[str]:
        """Extract error message if simulation failed."""
        if simulation_result.get("simulation", {}).get("status"):
            return None
        return simulation_result.get("transaction", {}).get("error_message")

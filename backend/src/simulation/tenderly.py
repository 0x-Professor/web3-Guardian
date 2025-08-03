import os
import requests
import logging
from typing import Dict, Any, Optional
from web3 import Web3

logger = logging.getLogger(__name__)

class TenderlySimulator:
    """Handles transaction simulation using Tenderly API."""
    
    BASE_URL = "https://api.tenderly.co/api/v1"
    
    def __init__(self, api_key: str, project_slug: str, username: str):
        """Initialize the Tenderly simulator.
        
        Args:
            api_key: Tenderly API key
            project_slug: Tenderly project slug
            username: Tenderly username
        """
        self.api_key = api_key
        self.project_slug = project_slug
        self.username = username
        self.session = requests.Session()
        self.session.headers.update({
            "X-Access-Key": self.api_key,
            "Content-Type": "application/json"
        })
    
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

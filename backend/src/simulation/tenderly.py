import json
import logging
import requests
from typing import Any, Dict, Optional, Union

from web3 import Web3

logger = logging.getLogger(__name__)


class TenderlySimulator:
    """Handles transaction simulation using Tenderly's API."""
    
    def __init__(self, api_key: str, project_slug: str, account_slug: str):
        """Initialize the Tenderly simulator.
        
        Args:
            api_key: Tenderly API key
            project_slug: Tenderly project slug
            account_slug: Tenderly account/team slug
        """
        self.api_key = api_key
        self.project_slug = project_slug
        self.account_slug = account_slug
        self.base_url = "https://api.tenderly.co/api/v1"
        self.headers = {
            "Content-Type": "application/json",
            "X-Access-Key": self.api_key,
        }
        
        # Map chain IDs to Tenderly network names
        self.network_map = {
            1: "mainnet",
            5: "goerli",
            137: "polygon",
            42161: "arbitrum",  # Note: Tenderly uses 'arbitrum' not 'arbitrum-one' in API
            10: "optimism",
            56: "bsc",
        }
    
    def _make_api_request(self, method: str, endpoint: str, **kwargs) -> Dict[str, Any]:
        """Make an authenticated request to the Tenderly API.
        
        Args:
            method: HTTP method (get, post, etc.)
            endpoint: API endpoint (without base URL)
            **kwargs: Additional arguments to pass to requests.request
            
        Returns:
            Dictionary containing the API response
            
        Raises:
            Exception: If the API request fails
        """
        url = f"{self.base_url.rstrip('/')}/{endpoint.lstrip('/')}"
        headers = {**self.headers, **kwargs.pop('headers', {})}
        
        try:
            response = requests.request(
                method=method,
                url=url,
                headers=headers,
                **kwargs
            )
            response.raise_for_status()
            return response.json()
        except requests.exceptions.RequestException as e:
            error_msg = f"Tenderly API request failed: {str(e)}"
            if hasattr(e, 'response') and e.response is not None:
                try:
                    error_data = e.response.json()
                    error_msg = error_data.get('error', {}).get('message', error_msg)
                except ValueError:
                    error_msg = f"{error_msg} (Status: {e.response.status_code})"
            logger.error(error_msg)
            raise Exception(error_msg) from e

    def simulate_transaction(
        self,
        tx_params: Dict[str, Any],
        network_id: int = 1,
        block_number: Optional[Union[int, str]] = None,
        save: bool = True
    ) -> Dict[str, Any]:
        """Simulate a transaction using Tenderly's API.
        
        Args:
            tx_params: Transaction parameters including from, to, data, value, etc.
            network_id: Network ID (default: 1 for mainnet)
            block_number: Block number to simulate at (default: latest)
            save: Whether to save the simulation in Tenderly
            
        Returns:
            Dictionary containing simulation results
        """
        if not self.api_key or not self.project_slug or not self.account_slug:
            error_msg = "Tenderly not properly configured. Missing API key, project slug, or account slug."
            logger.warning(error_msg)
            return {"error": error_msg}
        
        try:
            # Get the network from our mapping, default to mainnet
            network = self.network_map.get(network_id, "mainnet")
            
            # Prepare transaction data according to Tenderly API spec
            tx_data = {
                "from": tx_params.get('from'),
                "to": tx_params.get('to'),
                "input": tx_params.get('data', '0x'),
                "gas": int(tx_params.get('gas', 3000000)),
                "gas_price": int(tx_params.get('gasPrice', '0x0'), 16) if isinstance(tx_params.get('gasPrice'), str) else tx_params.get('gasPrice', 0),
                "value": int(tx_params.get('value', '0x0'), 16) if isinstance(tx_params.get('value'), str) else tx_params.get('value', 0),
                "save_if_fails": True,
                "save": save,
                "network_id": str(network_id),
                "simulation_type": "quick"  # 'quick' for faster simulations with less detail
            }
            
            # Add optional parameters if they exist
            if block_number is not None:
                tx_data["block_number"] = block_number
                
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
            
            # Prepare the request payload
            payload = {
                "network_id": str(network_id),
                "from": tx_data["from"],
                "to": tx_data["to"],
                "input": tx_data["input"],
                "gas": tx_data["gas"],
                "gas_price": str(tx_data["gas_price"]),
                "value": str(tx_data["value"]),
                "save_if_fails": True,
                "save": save,
                "simulation_type": "quick"
            }
            
            # Add optional fields if they exist
            if 'block_number' in tx_data:
                payload["block_number"] = tx_data["block_number"]
            if 'nonce' in tx_data:
                payload["nonce"] = tx_data["nonce"]
            if 'access_list' in tx_data:
                payload["access_list"] = tx_data["access_list"]
            if 'max_fee_per_gas' in tx_data:
                payload["max_fee_per_gas"] = str(tx_data["max_fee_per_gas"])
            if 'max_priority_fee_per_gas' in tx_data:
                payload["max_priority_fee_per_gas"] = str(tx_data["max_priority_fee_per_gas"])
            
            # Make the API request
            endpoint = f"account/{self.account_slug}/project/{self.project_slug}/simulate"
            simulation = self._make_api_request(
                method="POST",
                endpoint=endpoint,
                json=payload
            )
            
            # Process the simulation results
            transaction = simulation.get("transaction", {})
            status = transaction.get("status")
            
            return {
                "success": status is not None and status != 0,
                "gas_used": transaction.get("gas_used", 0),
                "block_number": simulation.get("block_number"),
                "transaction_hash": transaction.get("hash"),
                "status": status,
                "error": simulation.get("error", {}).get("error_message"),
                "logs": simulation.get("logs", []),
                "trace": simulation.get("trace", []),
                "state_diff": simulation.get("state_diff", {}),
                "simulation_id": simulation.get("id"),
                "raw_response": simulation  # Include full response for debugging
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
        if not all([self.account_slug, self.project_slug]):
            return None
            
        sim_id = simulation_result.get("simulation_id")
        if not sim_id:
            return None
            
        return (
            f"https://dashboard.tenderly.co/{self.account_slug}/"
            f"{self.project_slug}/simulator/{sim_id}"
        )

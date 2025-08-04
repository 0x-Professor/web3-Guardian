"""
Tenderly API client for smart contract simulation and analysis.
"""
import json
import logging
import time
from typing import Any, Dict, List, Optional, Union
from pathlib import Path
from urllib.parse import urljoin

import requests
from web3 import Web3
from web3.types import TxParams, Wei

from ..utils.config import settings
from ..utils.logger import setup_logger

# Set up logger
logger = setup_logger(__name__)

class TenderlyError(Exception):
    """Base exception for Tenderly-related errors."""
    pass

class SimulationFailedError(TenderlyError):
    """Raised when a simulation fails."""
    pass

class ContractVerificationError(TenderlyError):
    """Raised when contract verification fails."""
    pass

class TenderlyClient:
    """Handles all interactions with Tenderly's API for simulation and analysis."""
    
    def __init__(self, api_key: str = None, project_slug: str = None, account_slug: str = None):
        """Initialize the Tenderly client.
        
        Args:
            api_key: Tenderly API key. If not provided, will use from settings.
            project_slug: Tenderly project slug. If not provided, will use from settings.
            account_slug: Tenderly account/team slug. If not provided, will use from settings.
        """
        self.api_key = api_key or settings.TENDERLY_TOKEN
        self.project_slug = project_slug or settings.TENDERLY_PROJECT_SLUG
        self.account_slug = account_slug or settings.TENDERLY_ACCOUNT_SLUG
        self.base_url = settings.TENDERLY_API_URL.rstrip('/')
        self.headers = {
            "Content-Type": "application/json",
            "X-Access-Key": self.api_key,
        }
        self.timeout = settings.ANALYSIS_TIMEOUT / 1000  # Convert to seconds
        
        # Map chain IDs to Tenderly network names with additional metadata
        self.network_map = {
            1: {"name": "mainnet", "explorer": "https://etherscan.io"},
            5: {"name": "goerli", "explorer": "https://goerli.etherscan.io"},
            137: {"name": "polygon", "explorer": "https://polygonscan.com"},
            42161: {"name": "arbitrum", "explorer": "https://arbiscan.io"},
            10: {"name": "optimism", "explorer": "https://optimistic.etherscan.io"},
            56: {"name": "bsc", "explorer": "https://bscscan.com"},
            43114: {"name": "avalanche", "explorer": "https://snowtrace.io"},
            250: {"name": "fantom", "explorer": "https://ftmscan.com"},
            100: {"name": "gnosis", "explorer": "https://gnosisscan.io"},
            42170: {"name": "arbitrum-nova", "explorer": "https://nova.arbiscan.io"},
        }
    
    async def _make_api_request(
        self, 
        method: str, 
        endpoint: str, 
        params: Optional[Dict] = None,
        data: Optional[Dict] = None,
        retries: int = 3,
        backoff_factor: float = 2.0,
        **kwargs
    ) -> Dict[str, Any]:
        """Make an authenticated request to the Tenderly API with retries and error handling.
        
        Args:
            method: HTTP method (get, post, etc.)
            endpoint: API endpoint (without base URL)
            params: Query parameters
            data: Request body data
            retries: Number of retry attempts
            backoff_factor: Multiplier for exponential backoff
            **kwargs: Additional arguments to pass to requests.request
            
        Returns:
            Dict containing the parsed JSON response
            
        Raises:
            TenderlyError: If the request fails after all retries
        """
        url = urljoin(f"{self.base_url}/", endpoint.lstrip('/'))
        headers = {**self.headers, **kwargs.pop('headers', {})}
        last_exception = None
        
        for attempt in range(retries):
            try:
                response = requests.request(
                    method=method.upper(),
                    url=url,
                    params=params,
                    json=data,
                    headers=headers,
                    timeout=self.timeout,
                    **kwargs
                )
                
                response.raise_for_status()
                
                # Handle empty responses
                if not response.content:
                    return {}
                    
                return response.json()
                
            except requests.exceptions.RequestException as e:
                last_exception = e
                logger.warning(
                    f"Attempt {attempt + 1}/{retries} failed for {method.upper()} {url}: {str(e)}"
                )
                if attempt < retries - 1:
                    wait_time = backoff_factor ** attempt
                    logger.debug(f"Retrying in {wait_time:.1f} seconds...")
                    time.sleep(wait_time)
        
        # If we get here, all retries failed
        error_msg = f"Failed to execute {method.upper()} {url} after {retries} attempts"
        if last_exception:
            error_msg += f": {str(last_exception)}"
        
        logger.error(error_msg)
        raise TenderlyError(error_msg) from last_exception
    
    async def simulate_transaction(
        self,
        from_address: str,
        to_address: str,
        value: int = 0,
        data: str = "0x",
        network: str = "mainnet",
        block_number: Optional[int] = None,
        save: bool = True,
        save_if_fails: bool = True
    ) -> Dict[str, Any]:
        """Simulate a transaction using Tenderly.
        
        Args:
            from_address: Sender's address
            to_address: Recipient's address
            value: Amount of ETH to send in wei
            data: Transaction data (hex string)
            network: Network name or ID
            block_number: Block number to simulate at (latest if None)
            save: Whether to save the simulation
            save_if_fails: Whether to save the simulation if it fails
            
        Returns:
            Dict containing simulation results
            
        Raises:
            SimulationFailedError: If the simulation fails
        """
        network_id = self._get_network_id(network)
        
        payload = {
            "from": from_address.lower(),
            "to": to_address.lower(),
            "value": hex(value),
            "data": data,
            "save": save,
            "save_if_fails": save_if_fails,
            "simulation_type": "full"
        }
        
        if block_number is not None:
            payload["block_number"] = block_number
        
        try:
            endpoint = f"account/{self.account_slug}/project/{self.project_slug}/simulate"
            result = await self._make_api_request(
                "POST",
                endpoint,
                data=payload,
                params={"network_id": str(network_id)}
            )
            
            if not result.get("transaction", {}).get("status", False):
                error = result.get("error", {}).get("message", "Unknown error")
                raise SimulationFailedError(f"Transaction simulation failed: {error}")
                
            return {
                "id": result.get("id"),
                "gas_used": int(result.get("transaction", {}).get("gas_used", 0)),
                "status": result.get("transaction", {}).get("status", False),
                "logs": result.get("transaction", {}).get("logs", []),
                "trace": result.get("transaction", {}).get("transaction_info", {}).get("call_trace", {})
            }
            
        except Exception as e:
            if not isinstance(e, SimulationFailedError):
                raise SimulationFailedError(f"Failed to simulate transaction: {str(e)}") from e
            raise
    
    async def verify_contract(
        self,
        contract_name: str,
        contract_address: str,
        source_code: str,
        compiler_version: str,
        optimization_used: bool = False,
        optimization_runs: int = 200,
        evm_version: str = "london",
        license_type: str = "MIT",
        network: str = "mainnet"
    ) -> Dict[str, Any]:
        """Verify a smart contract on Tenderly.
        
        Args:
            contract_name: Name of the contract
            contract_address: Address of the deployed contract
            source_code: Full source code of the contract
            compiler_version: Solidity compiler version (e.g., "0.8.17")
            optimization_used: Whether optimization was enabled during compilation
            optimization_runs: Number of optimization runs
            evm_version: EVM version to target
            license_type: SPDX license identifier
            network: Network name or ID
            
        Returns:
            Dict containing verification results
            
        Raises:
            ContractVerificationError: If verification fails
        """
        network_id = self._get_network_id(network)
        
        payload = {
            "contract_to_verify": contract_address.lower(),
            "contracts": [{
                "contract_name": contract_name,
                "address": contract_address.lower(),
                "code": source_code,
                "compiler": {
                    "version": f"{compiler_version}",
                    "settings": {
                        "optimizer": {
                            "enabled": optimization_used,
                            "runs": optimization_runs
                        },
                        "evmVersion": evm_version
                    }
                },
                "networks": {
                    str(network_id): {"address": contract_address.lower()}
                },
                "compilationTarget": {
                    f"{contract_name}.sol": contract_name
                },
                "license": license_type
            }]
        }
        
        try:
            endpoint = f"account/{self.account_slug}/project/{self.project_slug}/contracts/verify"
            result = await self._make_api_request(
                "POST",
                endpoint,
                data=payload
            )
            
            if not result.get("success", False):
                error = result.get("error", {}).get("message", "Verification failed")
                raise ContractVerificationError(f"Contract verification failed: {error}")
                
            return result
            
        except Exception as e:
            if not isinstance(e, ContractVerificationError):
                raise ContractVerificationError(f"Failed to verify contract: {str(e)}") from e
            raise
    
    def _get_network_id(self, network: Union[str, int]) -> int:
        """Convert network name to ID.
        
        Args:
            network: Network name or ID
            
        Returns:
            Network ID
            
        Raises:
            ValueError: If the network is not supported
        """
        if isinstance(network, int) or (isinstance(network, str) and network.isdigit()):
            network_id = int(network)
            if network_id in self.network_map:
                return network_id
            
        network_lower = str(network).lower()
        for net_id, net_info in self.network_map.items():
            if net_info["name"].lower() == network_lower:
                return net_id
        
        supported_networks = ", ".join(f"{k} ({v['name']})" for k, v in self.network_map.items())
        raise ValueError(
            f"Unsupported network: {network}. "
            f"Supported networks: {supported_networks}"
        )
    
    def get_explorer_url(self, network: Union[str, int], address: str) -> str:
        """Get the explorer URL for a given address and network.
        
        Args:
            network: Network name or ID
            address: Contract or wallet address
            
        Returns:
            URL to view the address on the appropriate explorer
        """
        network_id = self._get_network_id(network)
        base_url = self.network_map[network_id]["explorer"]
        return f"{base_url}/address/{address}"
        
    async def get_contract_source(self, contract_address: str, network: str = "mainnet") -> Dict[str, Any]:
        """Fetch verified source code for a contract.
        
        Args:
            contract_address: The contract address to fetch source for
            network: Network name or ID
            
        Returns:
            Dict containing contract source code and metadata
            
        Raises:
            TenderlyError: If the request fails or contract is not verified
        """
        network_id = self._get_network_id(network)
        endpoint = f"api/v1/account/{self.account_slug}/project/{self.project_slug}/contracts/{contract_address}/source"
        
        try:
            return await self._make_api_request(
                "GET",
                endpoint,
                params={"networkId": str(network_id)}
            )
        except Exception as e:
            raise TenderlyError(f"Failed to fetch contract source: {str(e)}") from e
    
    async def get_contract_bytecode(self, contract_address: str, network: str = "mainnet") -> Dict[str, Any]:
        """Fetch bytecode and deployed bytecode for a contract.
        
        Args:
            contract_address: The contract address to fetch bytecode for
            network: Network name or ID
            
        Returns:
            Dict containing bytecode and deployed bytecode
            
        Raises:
            TenderlyError: If the request fails
        """
        network_id = self._get_network_id(network)
        endpoint = f"api/v1/account/{self.account_slug}/project/{self.project_slug}/contracts/{contract_address}/bytecode"
        
        try:
            return await self._make_api_request(
                "GET",
                endpoint,
                params={"networkId": str(network_id)}
            )
        except Exception as e:
            raise TenderlyError(f"Failed to fetch contract bytecode: {str(e)}") from e
    
    async def get_contract_metadata(self, contract_address: str, network: str = "mainnet") -> Dict[str, Any]:
        """Fetch metadata for a verified contract.
        
        Args:
            contract_address: The contract address to fetch metadata for
            network: Network name or ID
            
        Returns:
            Dict containing contract metadata including ABI, source code, etc.
            
        Raises:
            TenderlyError: If the request fails or contract is not verified
        """
        network_id = self._get_network_id(network)
        endpoint = f"api/v1/account/{self.account_slug}/project/{self.project_slug}/contracts/{contract_address}"
        
        try:
            return await self._make_api_request(
                "GET",
                endpoint,
                params={"networkId": str(network_id)}
            )
        except Exception as e:
            raise TenderlyError(f"Failed to fetch contract metadata: {str(e)}") from e

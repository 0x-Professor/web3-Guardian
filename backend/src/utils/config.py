"""
Configuration settings for Web3 Guardian backend
"""

import os
from typing import Optional, List
from pathlib import Path
from dotenv import load_dotenv
from pydantic_settings import BaseSettings
from pydantic import Field, field_validator

# Load environment variables from .env file
env_path = Path(__file__).resolve().parents[3] / '.env'
load_dotenv(dotenv_path=env_path)

class Settings(BaseSettings):
    # Basic API settings
    API_V1_STR: str = "/api/v1"
    PROJECT_NAME: str = "Web3 Guardian"
    VERSION: str = "1.0.0"
    DESCRIPTION: str = "Advanced Smart Contract Security Analysis Platform"
    
    # Server settings
    HOST: str = "0.0.0.0"
    PORT: int = 8000
    DEBUG: bool = False
    RELOAD: bool = False
    
    # Security settings
    SECRET_KEY: str = Field(default="your-secret-key-change-in-production")
    ACCESS_TOKEN_EXPIRE_MINUTES: int = 30
    ALGORITHM: str = "HS256"
    
    # CORS settings
    BACKEND_CORS_ORIGINS: List[str] = [
        "http://localhost:3000",
        "http://localhost:8080", 
        "chrome-extension://*"
    ]
    
    # Database settings (PostgreSQL)
    POSTGRES_SERVER: str = os.getenv("POSTGRES_SERVER", "localhost")
    POSTGRES_USER: str = os.getenv("POSTGRES_USER", "postgres")
    POSTGRES_PASSWORD: str = os.getenv("POSTGRES_PASSWORD", "")
    POSTGRES_DB: str = os.getenv("POSTGRES_DB", "web3guardian")
    POSTGRES_PORT: str = os.getenv("POSTGRES_PORT", "5432")
    DATABASE_URL: str = f"postgresql://{POSTGRES_USER}:{POSTGRES_PASSWORD}@{POSTGRES_SERVER}:{POSTGRES_PORT}/{POSTGRES_DB}"
    
    # Redis settings for caching
    REDIS_URL: str = os.getenv("REDIS_URL", "redis://localhost:6379")
    CACHE_TTL: int = int(os.getenv("CACHE_TTL", "3600"))  # 1 hour
    
    # Web3 settings
    WEB3_PROVIDER_URL: str = "https://mainnet.infura.io/v3/your-project-id"
    ETHERSCAN_API_KEY: Optional[str] = None
    
    # Google Gemini AI settings
    GOOGLE_API_KEY: Optional[str] = Field(default=os.getenv("GEMINI_API_KEY"), description="Google API key for Gemini")
    GEMINI_MODEL: str = "gemini-1.5-pro"
    TEMPERATURE: float = 0.1
    MAX_TOKENS: int = 8192
    
    # Tenderly settings
    TENDERLY_ACCOUNT_SLUG: str = Field(default=os.getenv("TENDERLY_ACCOUNT_SLUG", "0xProfessor"))
    TENDERLY_PROJECT_SLUG: str = Field(default=os.getenv("TENDERLY_PROJECT_SLUG", "project"))
    TENDERLY_API_URL: str = Field(default=os.getenv("TENDERLY_API_URL", "https://api.tenderly.co/api/v1"))
    TENDERLY_TOKEN: str = Field(default=os.getenv("TENDERLY_TOKEN"))
    
    @field_validator('TENDERLY_TOKEN')
    def validate_tenderly_token(cls, v):
        if not v:
            raise ValueError("TENDERLY_TOKEN environment variable is not set")
        return v
    
    # Analysis settings
    MAX_CONCURRENT_ANALYSIS: int = Field(default=int(os.getenv("MAX_CONCURRENT_ANALYSIS", 3)))
    ANALYSIS_TIMEOUT: int = Field(default=int(os.getenv("ANALYSIS_TIMEOUT", 300000)))  # 5 minutes in milliseconds
    
    # Vector store settings
    VECTOR_STORE_PATH: str = Field(default=os.getenv("VECTOR_STORE_PATH", "./data/vector_store"))
    
    # Web3 providers
    ALCHEMY_API_KEY: Optional[str] = Field(default=os.getenv("ALCHEMY_API_KEY"))
    INFURA_API_KEY: Optional[str] = Field(default=os.getenv("INFURA_API_KEY"))
    
    # Smart contract analysis settings
    ENABLE_STATIC_ANALYSIS: bool = True
    ENABLE_DYNAMIC_ANALYSIS: bool = True
    MAX_GAS_LIMIT: int = 30000000  # 30 million gas
    
    # Report generation
    REPORT_TEMPLATE_PATH: str = "./reports/templates/"
    REPORT_OUTPUT_PATH: str = "./reports/generated/"
    
    # RAG and Vector Database settings
    EMBEDDING_MODEL: str = "sentence-transformers/all-MiniLM-L6-v2"
    CHROMA_PERSIST_DIRECTORY: str = "./data/chroma_db"
    KNOWLEDGE_BASE_PATH: str = "./data/knowledge_base"
    CHUNK_SIZE: int = 1000
    CHUNK_OVERLAP: int = 200
    
    # Vector search settings
    SIMILARITY_THRESHOLD: float = 0.7
    MAX_RETRIEVAL_DOCS: int = 5
    
    # Tenderly simulation settings
    TENDERLY_ACCESS_KEY: Optional[str] = None
    TENDERLY_PROJECT: Optional[str] = None
    TENDERLY_USERNAME: Optional[str] = None
    TENDERLY_FORK_ID: Optional[str] = None
    TENDERLY_API_URL: str = "https://api.tenderly.co"
    
    # Analysis settings
    MAX_CONTRACT_SIZE: int = 1000000  # 1MB
    ANALYSIS_TIMEOUT: int = 300  # 5 minutes
    CONCURRENT_ANALYSES: int = 5
    
    # Security tool settings
    SLITHER_TIMEOUT: int = 120
    MYTHRIL_TIMEOUT: int = 180
    ENABLE_STATIC_ANALYSIS: bool = True
    ENABLE_DYNAMIC_ANALYSIS: bool = True
    
    # Rate limiting
    RATE_LIMIT_PER_MINUTE: int = 60
    RATE_LIMIT_BURST: int = 100
    
    # Monitoring and logging
    LOG_LEVEL: str = "INFO"
    SENTRY_DSN: Optional[str] = None
    ENABLE_METRICS: bool = True
    METRICS_PORT: int = 9090
    
    # File storage
    UPLOAD_DIR: str = "./uploads"
    MAX_FILE_SIZE: int = 10 * 1024 * 1024  # 10MB
    ALLOWED_FILE_TYPES: List[str] = [".sol", ".json", ".txt"]
    
    # External API settings
    COINGECKO_API_URL: str = "https://api.coingecko.com/api/v3"
    DEFILAMA_API_URL: str = "https://api.llama.fi"
    
    # Blockchain network settings
    SUPPORTED_NETWORKS: List[str] = [
        "ethereum", "polygon", "bsc", "arbitrum", "optimism", "avalanche"
    ]
    DEFAULT_NETWORK: str = "ethereum"
    
    # Gas analysis settings
    GAS_PRICE_API: str = "https://api.etherscan.io/api"
    GAS_OPTIMIZATION_THRESHOLD: float = 0.1  # 10% improvement threshold
    
    # Smart contract verification
    ETHERSCAN_VERIFY_URL: str = "https://api.etherscan.io/api"
    SOURCIFY_API_URL: str = "https://sourcify.dev/server"
    
    # AI model settings
    AI_CONFIDENCE_THRESHOLD: float = 0.7
    MIN_ANALYSIS_CONFIDENCE: float = 0.6
    
    # Batch processing
    BATCH_SIZE: int = 10
    MAX_BATCH_SIZE: int = 100
    BATCH_TIMEOUT: int = 600  # 10 minutes
    
    # WebSocket settings
    WS_HEARTBEAT_INTERVAL: int = 30
    WS_MAX_CONNECTIONS: int = 100
    
    # Development settings
    ENABLE_SWAGGER: bool = True
    ENABLE_REDOC: bool = True
    ENABLE_DEBUG_TOOLBAR: bool = False
    
    class Config:
        env_file = ".env"
        env_file_encoding = "utf-8"
        case_sensitive = True

# Create global settings instance
try:
    settings = Settings()
except Exception as e:
    print(f"Error loading settings: {e}")
    print(f"Current working directory: {os.getcwd()}")
    print(f"Looking for .env at: {env_path}")
    print(f"TENDERLY_TOKEN in env: {'TENDERLY_TOKEN' in os.environ}")
    raise

# Validation functions
def validate_api_keys():
    """Validate that required API keys are present"""
    missing_keys = []
    
    if not settings.GOOGLE_API_KEY:
        missing_keys.append("GOOGLE_API_KEY")
    
    if not settings.ETHERSCAN_API_KEY:
        missing_keys.append("ETHERSCAN_API_KEY")
        
    if missing_keys:
        print(f"Warning: Missing API keys: {', '.join(missing_keys)}")
        print("Some features may be disabled.")

def get_network_config(network: str) -> dict:
    """Get configuration for specific blockchain network"""
    network_configs = {
        "ethereum": {
            "rpc_url": "https://mainnet.infura.io/v3/your-project-id",
            "chain_id": 1,
            "explorer": "https://etherscan.io",
            "api_url": "https://api.etherscan.io/api"
        },
        "polygon": {
            "rpc_url": "https://polygon-mainnet.infura.io/v3/your-project-id", 
            "chain_id": 137,
            "explorer": "https://polygonscan.com",
            "api_url": "https://api.polygonscan.com/api"
        },
        "bsc": {
            "rpc_url": "https://bsc-dataseed1.binance.org",
            "chain_id": 56,
            "explorer": "https://bscscan.com",
            "api_url": "https://api.bscscan.com/api"
        }
    }
    
    return network_configs.get(network, network_configs["ethereum"])

# Initialize validation on import
validate_api_keys()

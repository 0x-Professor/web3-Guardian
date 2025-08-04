import os
from pathlib import Path
from typing import Dict, Any, Optional, List
from pydantic import BaseSettings, Field, validator
from dotenv import load_dotenv

# Load environment variables from .env file if it exists
env_path = Path(__file__).parent.parent.parent / '.env'
load_dotenv(dotenv_path=env_path)

class Settings(BaseSettings):
    # Application settings
    APP_NAME: str = "Web3 Guardian Backend"
    DEBUG: bool = False
    ENVIRONMENT: str = "production"
    
    # Server settings
    HOST: str = "0.0.0.0"
    PORT: int = 8000
    WORKERS: int = 1
    RELOAD: bool = False
    
    # CORS settings
    CORS_ORIGINS: List[str] = ["*"]
    CORS_METHODS: List[str] = ["*"]
    CORS_HEADERS: List[str] = ["*"]
    
    # API settings
    API_PREFIX: str = "/api"
    API_V1_STR: str = "/v1"
    
    # Security
    SECRET_KEY: str = Field(..., env="SECRET_KEY")
    ACCESS_TOKEN_EXPIRE_MINUTES: int = 60 * 24 * 7  # 7 days
    
    # Database settings (optional)
    DATABASE_URL: Optional[str] = Field(None, env="DATABASE_URL")
    
    # Google Gemini AI settings
    GOOGLE_API_KEY: Optional[str] = Field(None, env="GOOGLE_API_KEY")
    GEMINI_MODEL: str = Field("gemini-1.5-pro", env="GEMINI_MODEL")
    
    # Tenderly settings
    TENDERLY_ACCESS_KEY: Optional[str] = Field(None, env="TENDERLY_ACCESS_KEY")
    TENDERLY_PROJECT: Optional[str] = Field(None, env="TENDERLY_PROJECT")
    TENDERLY_USERNAME: Optional[str] = Field(None, env="TENDERLY_USERNAME")
    TENDERLY_ACCOUNT_ID: Optional[str] = Field(None, env="TENDERLY_ACCOUNT_ID")
    
    # Web3 settings
    WEB3_PROVIDER_URI: str = Field("https://mainnet.infura.io/v3/YOUR-PROJECT-ID", env="WEB3_PROVIDER_URI")
    INFURA_PROJECT_ID: Optional[str] = Field(None, env="INFURA_PROJECT_ID")
    ALCHEMY_API_KEY: Optional[str] = Field(None, env="ALCHEMY_API_KEY")
    CHAIN_ID: int = Field(1, env="CHAIN_ID")
    
    # Blockchain API Keys
    ETHERSCAN_API_KEY: Optional[str] = Field(None, env="ETHERSCAN_API_KEY")
    POLYGONSCAN_API_KEY: Optional[str] = Field(None, env="POLYGONSCAN_API_KEY")
    BSCSCAN_API_KEY: Optional[str] = Field(None, env="BSCSCAN_API_KEY")
    
    # Vector Database settings (for RAG)
    PINECONE_API_KEY: Optional[str] = Field(None, env="PINECONE_API_KEY")
    PINECONE_ENVIRONMENT: Optional[str] = Field(None, env="PINECONE_ENVIRONMENT")
    PINECONE_INDEX_NAME: str = Field("smart-contracts-knowledge", env="PINECONE_INDEX_NAME")
    
    # ChromaDB settings (alternative vector DB)
    CHROMA_PERSIST_DIRECTORY: str = Field("./chroma_db", env="CHROMA_PERSIST_DIRECTORY")
    
    # Caching settings
    REDIS_URL: str = Field("redis://localhost:6379/0", env="REDIS_URL")
    CACHE_TTL: int = Field(3600, env="CACHE_TTL")  # 1 hour
    
    # Logging
    LOG_LEVEL: str = Field("INFO", env="LOG_LEVEL")
    LOG_FORMAT: str = Field("json", env="LOG_FORMAT")
    LOG_FILE: Optional[str] = Field("logs/web3-guardian.log", env="LOG_FILE")
    
    # Rate limiting
    RATE_LIMIT: str = Field("100/minute", env="RATE_LIMIT")
    
    # Security Analysis settings
    SECURITY_ANALYSIS_TIMEOUT: int = Field(30, env="SECURITY_ANALYSIS_TIMEOUT")
    MAX_CONTRACT_SIZE: int = Field(1000000, env="MAX_CONTRACT_SIZE")
    ENABLE_DEEP_ANALYSIS: bool = Field(True, env="ENABLE_DEEP_ANALYSIS")
    
    # Report Generation settings
    REPORT_STORAGE_PATH: str = Field("./reports", env="REPORT_STORAGE_PATH")
    MAX_REPORT_SIZE: str = Field("50MB", env="MAX_REPORT_SIZE")
    
    # RAG Pipeline settings
    EMBEDDING_MODEL: str = Field("sentence-transformers/all-MiniLM-L6-v2", env="EMBEDDING_MODEL")
    CHUNK_SIZE: int = Field(1000, env="CHUNK_SIZE")
    CHUNK_OVERLAP: int = Field(200, env="CHUNK_OVERLAP")
    MAX_TOKENS: int = Field(4000, env="MAX_TOKENS")
    TEMPERATURE: float = Field(0.1, env="TEMPERATURE")
    
    # Knowledge Base settings
    KNOWLEDGE_BASE_PATH: str = Field("./knowledge_base", env="KNOWLEDGE_BASE_PATH")
    AUTO_UPDATE_KNOWLEDGE: bool = Field(True, env="AUTO_UPDATE_KNOWLEDGE")
    
    class Config:
        case_sensitive = True
        env_file = ".env"
        env_file_encoding = "utf-8"
    
    @validator("CORS_ORIGINS", "CORS_METHODS", "CORS_HEADERS", pre=True)
    def assemble_cors_origins(cls, v):
        if isinstance(v, str):
            return [i.strip() for i in v.split(",")]
        return v

# Create settings instance
settings = Settings()

# Ensure required directories exist
for directory in [
    settings.LOG_FILE and Path(settings.LOG_FILE).parent,
    Path(settings.REPORT_STORAGE_PATH),
    Path(settings.KNOWLEDGE_BASE_PATH),
    Path(settings.CHROMA_PERSIST_DIRECTORY)
]:
    if directory:
        directory.mkdir(parents=True, exist_ok=True)

import os
from pathlib import Path
from typing import Dict, Any, Optional
from pydantic import BaseSettings, Field, validator, HttpUrl
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
    CORS_ORIGINS: list = ["*"]
    CORS_METHODS: list = ["*"]
    CORS_HEADERS: list = ["*"]
    
    # API settings
    API_PREFIX: str = "/api"
    API_V1_STR: str = "/v1"
    
    # Security
    SECRET_KEY: str = Field(..., env="SECRET_KEY")
    ACCESS_TOKEN_EXPIRE_MINUTES: int = 60 * 24 * 7  # 7 days
    
    # Database settings (if needed)
    DATABASE_URL: Optional[str] = None
    
    # Tenderly settings
    TENDERLY_ACCESS_KEY: Optional[str] = Field(None, env="TENDERLY_ACCESS_KEY")
    TENDERLY_PROJECT: Optional[str] = Field(None, env="TENDERLY_PROJECT")
    TENDERLY_USERNAME: Optional[str] = Field(None, env="TENDERLY_USERNAME")
    
    # OpenAI settings
    OPENAI_API_KEY: Optional[str] = Field(None, env="OPENAI_API_KEY")
    
    # Web3 settings
    WEB3_PROVIDER_URI: str = "https://mainnet.infura.io/v3/YOUR-PROJECT-ID"
    CHAIN_ID: int = 1  # Mainnet
    
    # Logging
    LOG_LEVEL: str = "INFO"
    LOG_FORMAT: str = "json"
    LOG_FILE: Optional[str] = "logs/web3-guardian.log"
    
    # Rate limiting
    RATE_LIMIT: str = "100/minute"
    
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

# Ensure log directory exists
if settings.LOG_FILE:
    log_dir = Path(settings.LOG_FILE).parent
    log_dir.mkdir(parents=True, exist_ok=True)

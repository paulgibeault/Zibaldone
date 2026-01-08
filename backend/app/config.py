from pydantic_settings import BaseSettings
from typing import Optional
from pathlib import Path

class Settings(BaseSettings):
    API_V1_STR: str = "/api"
    PROJECT_NAME: str = "Zibaldone"
    
    # Storage
    STORAGE_TYPE: str = "filesystem" # filesystem or s3
    STORAGE_DIR: str = "../data/blob_storage"
    
    # S3
    S3_ENDPOINT: Optional[str] = None
    S3_ACCESS_KEY: Optional[str] = None
    S3_SECRET_KEY: Optional[str] = None
    S3_BUCKET_NAME: str = "zibaldone-blobs"
    S3_REGION: str = "us-east-1"
    S3_PUBLIC_URL: Optional[str] = None
    
    # LLM
    LITELLM_URL: str = "http://localhost:4000"
    ENABLE_LLM_LOGGING: bool = False
    
    # Security
    SECRET_KEY: str = "zibaldone-secret-key"
    
    class Config:
        env_file = ".env"
        case_sensitive = True
        extra = "ignore"

settings = Settings()

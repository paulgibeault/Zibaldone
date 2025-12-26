from abc import ABC, abstractmethod
import aiofiles
import os
import uuid
from typing import Dict, Any, Optional

class StorageInterface(ABC):
    @abstractmethod
    async def save(self, file_content: bytes, original_filename: str) -> str:
        """Saves a file and returns its storage path or identifier."""
        pass

    @abstractmethod
    def delete(self, storage_path: str):
        """Deletes a file from storage."""
        pass

    @abstractmethod
    def get_path(self, storage_path: str) -> str:
        """Returns the local path or an identifier for the file."""
        pass

    @abstractmethod
    async def get_upload_params(self, filename: str) -> Dict[str, Any]:
        """Returns parameters for browser-side upload (e.g. pre-signed URL)."""
        pass

    def get_date_prefix(self) -> str:
        """Returns the date-based prefix YYYY/MM/DD/."""
        from datetime import datetime
        now = datetime.utcnow()
        return now.strftime("%Y/%m/%d/")

class FileSystemStorage(StorageInterface):
    def __init__(self, storage_dir: str):
        self.storage_dir = storage_dir
        os.makedirs(self.storage_dir, exist_ok=True)

    async def save(self, file_content: bytes, original_filename: str) -> str:
        file_ext = os.path.splitext(original_filename)[1]
        storage_filename = f"{uuid.uuid4()}{file_ext}"
        
        # Implement date-based hierarchy
        date_prefix = self.get_date_prefix()
        relative_path = os.path.join(date_prefix, storage_filename)
        full_path = os.path.join(self.storage_dir, relative_path)
        
        # Ensure directory exists
        os.makedirs(os.path.dirname(full_path), exist_ok=True)
        
        async with aiofiles.open(full_path, 'wb') as out_file:
            await out_file.write(file_content)
            
        return relative_path # Return relative path for database storage

    def delete(self, storage_path: str):
        # Join with storage_dir since DB stores relative path now
        full_path = os.path.join(self.storage_dir, storage_path) if not os.path.isabs(storage_path) else storage_path
        if os.path.exists(full_path):
            if os.path.isfile(full_path):
                os.remove(full_path)

    def get_path(self, storage_path: str) -> str:
        if os.path.isabs(storage_path):
            return storage_path
        return os.path.join(self.storage_dir, storage_path)

    async def get_upload_params(self, filename: str) -> Dict[str, Any]:
        # For local filesystem, we still use the /upload endpoint as fallback
        return {"mode": "local", "upload_url": "/api/upload"}

def get_storage() -> StorageInterface:
    storage_type = os.getenv("STORAGE_TYPE", "filesystem").lower()
    
    if storage_type == "s3":
        print("Using S3/MinIO storage backend")
        from app.services.s3_storage import S3Storage
        return S3Storage()
    else:
        storage_dir = os.getenv("STORAGE_DIR", "../data/blob_storage")
        print(f"Using local filesystem storage backend ({storage_dir})")
        return FileSystemStorage(storage_dir)

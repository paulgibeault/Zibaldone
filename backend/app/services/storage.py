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

class FileSystemStorage(StorageInterface):
    def __init__(self, storage_dir: str):
        self.storage_dir = storage_dir
        os.makedirs(self.storage_dir, exist_ok=True)

    async def save(self, file_content: bytes, original_filename: str) -> str:
        file_ext = os.path.splitext(original_filename)[1]
        storage_filename = f"{uuid.uuid4()}{file_ext}"
        storage_path = os.path.join(self.storage_dir, storage_filename)
        
        async with aiofiles.open(storage_path, 'wb') as out_file:
            await out_file.write(file_content)
            
        return storage_path

    def delete(self, storage_path: str):
        if os.path.exists(storage_path):
            os.remove(storage_path)

    def get_path(self, storage_path: str) -> str:
        return storage_path

    async def get_upload_params(self, filename: str) -> Dict[str, Any]:
        # For local filesystem, we still use the /upload endpoint as fallback
        # return a flag indicating local upload
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

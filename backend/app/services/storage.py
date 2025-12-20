import aiofiles
import os
import uuid

class LocalObjectStore:
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

    def get_path(self, storage_path: str) -> str:
        return storage_path

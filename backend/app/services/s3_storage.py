import os
import boto3
from botocore.config import Config
from typing import Dict, Any
from app.services.storage import StorageInterface

class S3Storage(StorageInterface):
    def __init__(self):
        self.endpoint_url = os.getenv("S3_ENDPOINT")
        self.access_key = os.getenv("S3_ACCESS_KEY")
        self.secret_key = os.getenv("S3_SECRET_KEY")
        self.bucket_name = os.getenv("S3_BUCKET_NAME", "zibaldone-blobs")
        self.region = os.getenv("S3_REGION", "us-east-1")
        
        # Use path-style addressing for MinIO if endpoint is provided
        s3_config = Config(
            signature_version='s3v4',
            s3={'addressing_style': 'path'} if self.endpoint_url else None
        )
        
        self.s3_client = boto3.client(
            's3',
            endpoint_url=self.endpoint_url,
            aws_access_key_id=self.access_key,
            aws_secret_access_key=self.secret_key,
            region_name=self.region,
            config=s3_config
        )

    async def save(self, file_content: bytes, original_filename: str) -> str:
        # Note: This is a fallback/simple upload. For efficient transfers, we use pre-signed URLs.
        import uuid
        file_ext = os.path.splitext(original_filename)[1]
        storage_filename = f"{uuid.uuid4()}{file_ext}"
        
        self.s3_client.put_object(
            Bucket=self.bucket_name,
            Key=storage_filename,
            Body=file_content
        )
        
        return storage_filename

    def delete(self, storage_path: str):
        # Gracefully handle legacy filesystem paths if they exist
        if storage_path.startswith(".") or os.path.isabs(storage_path):
            if os.path.exists(storage_path):
                os.remove(storage_path)
            return

        self.s3_client.delete_object(
            Bucket=self.bucket_name,
            Key=storage_path
        )

    def get_path(self, storage_path: str) -> str:
        # Return the key; the application will need to know how to retrieve it (e.g. via pre-signed URL or CDN)
        return storage_path

    async def get_upload_params(self, filename: str) -> Dict[str, Any]:
        import uuid
        file_ext = os.path.splitext(filename)[1]
        storage_filename = f"{uuid.uuid4()}{file_ext}"
        
        # In a real S3 scenario, we'd use generate_presigned_post
        # For simple PUT, we can use generate_presigned_url
        url = self.s3_client.generate_presigned_url(
            'put_object',
            Params={
                'Bucket': self.bucket_name,
                'Key': storage_filename,
            },
            ExpiresIn=3600
        )
        
        return {
            "mode": "s3",
            "upload_url": url,
            "storage_path": storage_filename,
            "method": "PUT"
        }

import os
import boto3
from botocore.config import Config
from typing import Dict, Any, Optional
from app.services.storage import StorageInterface, StorageUnavailableError
from botocore.exceptions import ClientError, BotoCoreError

from app.config import settings

class S3Storage(StorageInterface):
    def __init__(self):
        self.endpoint_url = settings.S3_ENDPOINT
        self.access_key = settings.S3_ACCESS_KEY
        self.secret_key = settings.S3_SECRET_KEY
        self.bucket_name = settings.S3_BUCKET_NAME
        self.region = settings.S3_REGION
        
        # Use path-style addressing for MinIO if endpoint is provided
        s3_config = Config(
            signature_version='s3v4',
            s3={'addressing_style': 'path'} if self.endpoint_url else None,
            connect_timeout=2,
            read_timeout=2,
            retries={'max_attempts': 1}
        )
        
        try:
            print(f"Initializing S3 Client with Endpoint: {self.endpoint_url}, Region: {self.region}, Bucket: {self.bucket_name}")
            self.s3_client = boto3.client(
                's3',
                endpoint_url=self.endpoint_url,
                aws_access_key_id=self.access_key,
                aws_secret_access_key=self.secret_key,
                region_name=self.region,
                config=s3_config
            )
        except Exception as e:
            print(f"Warning: Failed to initialize S3 client: {e}")
            import traceback
            traceback.print_exc()
            self.s3_client = None

        self.public_url = settings.S3_PUBLIC_URL
        
        # If public_url is provided, we need a separate client for signing 
        # to ensure the signature matches the host the browser will use.
        if self.public_url:
            try:
                self.signer_client = boto3.client(
                    's3',
                    endpoint_url=self.public_url,
                    aws_access_key_id=self.access_key,
                    aws_secret_access_key=self.secret_key,
                    region_name=self.region,
                    config=s3_config
                )
            except Exception as e:
                print(f"Warning: Failed to initialize S3 signer client: {e}")
                self.signer_client = None
        else:
            self.signer_client = self.s3_client

    async def save(self, file_content: bytes, original_filename: str) -> str:
        if not self.s3_client:
             raise StorageUnavailableError("S3 client not initialized")

        # Note: This is a fallback/simple upload. For efficient transfers, we use pre-signed URLs.
        import uuid
        file_ext = os.path.splitext(original_filename)[1]
        storage_filename = f"{uuid.uuid4()}{file_ext}"
        
        # Implement date-based hierarchy
        date_prefix = self.get_date_prefix()
        storage_key = f"{date_prefix}{storage_filename}"
        
        try:
            self.s3_client.put_object(
                Bucket=self.bucket_name,
                Key=storage_key,
                Body=file_content
            )
        except (BotoCoreError, ClientError) as e:
            raise StorageUnavailableError(f"Failed to save to S3: {e}")
        
        return storage_key

    def delete(self, storage_path: str):
        # Gracefully handle legacy filesystem paths if they exist
        if storage_path.startswith(".") or os.path.isabs(storage_path):
            if os.path.exists(storage_path):
                os.remove(storage_path)
            return

        if not self.s3_client:
            return

        try:
            self.s3_client.delete_object(
                Bucket=self.bucket_name,
                Key=storage_path
            )
        except (BotoCoreError, ClientError) as e:
            print(f"Warning: Failed to delete from S3: {e}")

    def get_path(self, storage_path: str) -> str:
        # Return the key; the application will need to know how to retrieve it (e.g. via pre-signed URL or CDN)
        return storage_path

    async def get_upload_params(self, filename: str) -> Dict[str, Any]:
        if not self.signer_client:
             raise StorageUnavailableError("S3 signer client not initialized")

        import uuid
        file_ext = os.path.splitext(filename)[1]
        storage_filename = f"{uuid.uuid4()}{file_ext}"
        
        # Implement date-based hierarchy
        date_prefix = self.get_date_prefix()
        storage_key = f"{date_prefix}{storage_filename}"
        
        # Use the signer_client which is configured with the public_url if available.
        # This ensures the signature is valid for the browser's request.
        try:
            url = self.signer_client.generate_presigned_url(
                'put_object',
                Params={
                    'Bucket': self.bucket_name,
                    'Key': storage_key,
                },
                ExpiresIn=3600
            )
        except (BotoCoreError, ClientError) as e:
            raise StorageUnavailableError(f"Failed to generate presigned upload URL: {e}")
        
        return {
            "mode": "s3",
            "upload_url": url,
            "storage_path": storage_key,
            "method": "PUT"
        }

    def get_download_url(self, storage_path: str) -> Optional[str]:
        # Gracefully handle legacy filesystem paths
        if storage_path.startswith(".") or os.path.isabs(storage_path):
            return None

        if not self.signer_client:
            return None

        # Generate a pre-signed URL for downloading/viewing the file
        try:
            url = self.signer_client.generate_presigned_url(
                'get_object',
                Params={
                    'Bucket': self.bucket_name,
                    'Key': storage_path,
                },
                ExpiresIn=3600
            )
            return url
        except (BotoCoreError, ClientError) as e:
            print(f"Warning: Failed to generate presigned download URL: {e}")
            return None

    async def get_content(self, storage_path: str) -> bytes:
        # Gracefully handle legacy filesystem paths
        if storage_path.startswith(".") or os.path.isabs(storage_path):
            with open(storage_path, "rb") as f:
                return f.read()

        if not self.s3_client:
             raise StorageUnavailableError("S3 client not initialized")

        try:
            print(f"Attempting to download S3 Object: Bucket={self.bucket_name}, Key={storage_path}")
            response = self.s3_client.get_object(
                Bucket=self.bucket_name,
                Key=storage_path
            )
            return response['Body'].read()
        except (BotoCoreError, ClientError) as e:
            print(f"S3 Download Failed for {storage_path}: {e}")
            raise StorageUnavailableError(f"Failed to get content from S3: {e}")

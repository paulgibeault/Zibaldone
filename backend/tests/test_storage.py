import pytest
import os
import shutil
from unittest.mock import MagicMock, patch
from app.services.storage import FileSystemStorage, get_storage
from app.services.s3_storage import S3Storage

@pytest.fixture
def temp_storage():
    test_dir = "./test_storage"
    os.makedirs(test_dir, exist_ok=True)
    yield test_dir
    shutil.rmtree(test_dir)

@pytest.mark.asyncio
async def test_filesystem_storage(temp_storage):
    storage = FileSystemStorage(temp_storage)
    content = b"test content"
    filename = "test.txt"
    
    path = await storage.save(content, filename)
    assert os.path.exists(path)
    assert open(path, 'rb').read() == content
    
    assert storage.get_path(path) == path
    
    params = await storage.get_upload_params(filename)
    assert params["mode"] == "local"
    
    storage.delete(path)
    assert not os.path.exists(path)

@patch('boto3.client')
@pytest.mark.asyncio
async def test_s3_storage(mock_boto):
    mock_s3 = MagicMock()
    mock_boto.return_value = mock_s3
    
    with patch.dict(os.environ, {
        "S3_ENDPOINT": "http://localhost:9000",
        "S3_ACCESS_KEY": "test",
        "S3_SECRET_KEY": "test",
        "S3_BUCKET_NAME": "test-bucket"
    }):
        storage = S3Storage()
        content = b"test content"
        filename = "test.txt"
        
        # Test save
        path = await storage.save(content, filename)
        mock_s3.put_object.assert_called_once()
        
        # Test delete
        storage.delete(path)
        mock_s3.delete_object.assert_called_once_with(Bucket="test-bucket", Key=path)
        
        # Test get_upload_params
        mock_s3.generate_presigned_url.return_value = "http://presigned-url"
        params = await storage.get_upload_params(filename)
        assert params["mode"] == "s3"
        assert params["upload_url"] == "http://presigned-url"
        assert params["method"] == "PUT"

@patch('boto3.client')
@pytest.mark.asyncio
async def test_s3_storage_legacy_path(mock_boto, temp_storage):
    mock_s3 = MagicMock()
    mock_boto.return_value = mock_s3
    
    with patch.dict(os.environ, {
        "S3_ENDPOINT": "http://localhost:9000",
        "S3_ACCESS_KEY": "test",
        "S3_SECRET_KEY": "test",
        "S3_BUCKET_NAME": "test-bucket"
    }):
        storage = S3Storage()
        
        # Create a local file to simulate legacy storage
        legacy_filename = "legacy_file.txt"
        legacy_path = os.path.join(temp_storage, legacy_filename)
        with open(legacy_path, 'wb') as f:
            f.write(b"legacy content")
        
        assert os.path.exists(legacy_path)
        
        # Test delete with local path
        storage.delete(legacy_path)
        
        # Verify it was deleted from filesystem
        assert not os.path.exists(legacy_path)
        
        # Verify S3 delete was NOT called
        mock_s3.delete_object.assert_not_called()

def test_get_storage_factory():
    with patch.dict(os.environ, {"STORAGE_TYPE": "filesystem", "STORAGE_DIR": "/tmp/test"}):
        storage = get_storage()
        assert isinstance(storage, FileSystemStorage)
        assert storage.storage_dir == "/tmp/test"
    
    with patch.dict(os.environ, {"STORAGE_TYPE": "s3"}):
        with patch('app.services.s3_storage.S3Storage') as mock_s3_class:
            get_storage()
            mock_s3_class.assert_called_once()

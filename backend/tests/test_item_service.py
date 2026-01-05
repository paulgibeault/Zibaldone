
import pytest
import uuid
from sqlmodel import Session
from app.services.item_service import finalize_upload, enrich_item
from app.models import ContentItem, ContentStatus
from app import crud

@pytest.fixture
def mock_get_next_version(monkeypatch):
    def mock_version(*args, **kwargs):
        return 1
    monkeypatch.setattr(crud, "get_next_version", mock_version)

@pytest.mark.asyncio
async def test_finalize_upload(session: Session, mock_storage, mock_get_next_version):
    original_filename = "test.txt"
    storage_path = "uploads/test.txt"
    owner_id = uuid.uuid4()
    
    enriched_item = await finalize_upload(
        session,
        original_filename,
        storage_path,
        owner_id,
        metadata='{"key": "value"}',
        content_type="text/plain"
    )
    
    assert enriched_item.original_filename == original_filename
    assert enriched_item.status == ContentStatus.QUEUED
    assert enriched_item.download_url == f"http://mock-storage/{storage_path}"
    
    # Verify DB
    item = session.get(ContentItem, enriched_item.id)
    assert item is not None
    assert item.version == 1
    assert item.metadata_json == '{"key": "value"}'

@pytest.mark.asyncio
async def test_enrich_item(session: Session, mock_storage):
    item = ContentItem(
        original_filename="enrich_test.txt",
        owner_id=uuid.uuid4(),
        storage_path="path/to/file",
        status=ContentStatus.COMPLETED,
        version=1
    )
    session.add(item)
    session.commit()
    
    enriched = enrich_item(item)
    
    assert enriched.id == item.id
    assert enriched.download_url == "http://mock-storage/path/to/file"
    assert enriched.tags == []
    assert enriched.tasks == []

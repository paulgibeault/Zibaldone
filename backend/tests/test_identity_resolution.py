import pytest
from unittest.mock import MagicMock, patch
import uuid
from app.crud import get_next_version
from app.models import ContentItem
from app.exceptions import IdentityConflictError

# Mock TLSH to avoid dependency issues in this test
import sys
sys.modules['tlsh'] = MagicMock()

def test_get_next_version_simple(session):
    owner_id = uuid.uuid4()
    filename = "test.txt"
    
    # Case 0: No existing file
    v = get_next_version(session, filename, owner_id)
    assert v == 1

def test_get_next_version_increment(session):
    owner_id = uuid.uuid4()
    filename = "test_inc.txt"
    
    # Setup existing item
    item = ContentItem(
        original_filename=filename,
        owner_id=owner_id,
        storage_path="path",
        version=1,
        checksum="old_sum"
    )
    session.add(item)
    session.commit()
    
    # Case 1: Same name, no signature provided -> automatic increment
    v = get_next_version(session, filename, owner_id)
    assert v == 2

def test_get_next_version_signature_match(session):
    owner_id = uuid.uuid4()
    filename = "test_sig.txt"
    import json
    
    meta = json.dumps({"client_context": {"signature": "abc"}})
    item = ContentItem(
        original_filename=filename,
        owner_id=owner_id,
        storage_path="path",
        version=1,
        metadata_json=meta,
        checksum="old_sum"
    )
    session.add(item)
    session.commit()
    
    # Case 2: Signature matches -> increment
    v = get_next_version(session, filename, owner_id, signature="abc")
    assert v == 2

def test_get_next_version_signature_mismatch_conflict(session):
    owner_id = uuid.uuid4()
    filename = "test_conflict.txt"
    import json
    
    meta = json.dumps({"client_context": {"signature": "original_sig"}, "tlsh": "hash1"})
    item = ContentItem(
        original_filename=filename,
        owner_id=owner_id,
        storage_path="path",
        version=1,
        metadata_json=meta,
        checksum="old_sum"
    )
    session.add(item)
    session.commit()
    
    # Mock TLSH difference to be high (no match)
    with patch('app.crud.select') as mock_select:
        # We can't easily patch the inner logic of crud without heavier mocking or using real DB.
        # Since 'session' fixture usually implies real DB (sqlite memory), we rely on that.
        pass

    # Mock tlsh.diff to return high score
    with patch('tlsh.diff', return_value=200):
        # Case 3: Signature mismatch & Fuzzy mismatch -> Conflict
        with pytest.raises(IdentityConflictError):
            get_next_version(session, filename, owner_id, signature="new_sig", tlsh_hash="hash2")

def test_get_next_version_fuzzy_match(session):
    owner_id = uuid.uuid4()
    filename = "test_fuzzy.txt"
    import json
    
    meta = json.dumps({"client_context": {"signature": "original_sig"}, "tlsh": "hash1"})
    item = ContentItem(
        original_filename=filename,
        owner_id=owner_id,
        storage_path="path",
        version=1,
        metadata_json=meta,
        checksum="old_sum"
    )
    session.add(item)
    session.commit()

    # Mock tlsh.diff to return low score (match)
    with patch('tlsh.diff', return_value=50):
        # Case 4: Signature mismatch BUT Fuzzy match -> increment
        v = get_next_version(session, filename, owner_id, signature="new_sig", tlsh_hash="hash2")
        assert v == 2

def test_get_next_version_resolution_override(session):
    owner_id = uuid.uuid4()
    filename = "test_res.txt"
    
    item = ContentItem(
        original_filename=filename,
        owner_id=owner_id,
        storage_path="path",
        version=1
    )
    session.add(item)
    session.commit()
    
    # resolution='new_file' -> version 1 (implies separate item logic upstream, but version calculator returns 1)
    v = get_next_version(session, filename, owner_id, resolution='new_file')
    assert v == 1
    
    # resolution='new_version' -> version 2
    v = get_next_version(session, filename, owner_id, resolution='new_version')
    assert v == 2

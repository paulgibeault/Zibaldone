import pytest
import uuid
import json
from unittest.mock import MagicMock, patch
from app.crud import get_next_version
from app.models import ContentItem, SQLModel, create_engine
from sqlmodel import Session
from app.exceptions import IdentityConflictError

# Mock TLSH
import sys
sys.modules['tlsh'] = MagicMock()

@pytest.fixture(name="session")
def session_fixture():
    engine = create_engine("sqlite:///:memory:")
    SQLModel.metadata.create_all(engine)
    with Session(engine) as session:
        yield session

def test_repro_identical_header_different_content(session):
    owner_id = uuid.uuid4()
    filename = "README.md"
    
    # File 1: Common Header, Content A
    # Signature matches first 100 chars.
    common_header = "# README\n\nThis is a standard readme file."
    content_A = common_header + "\nProject A specific detailed content..." * 50
    content_B = common_header + "\nProject B specific detailed content..." * 50
    
    signature = common_header # Assume signature captures this
    
    # Create existing item (Project A)
    meta = json.dumps({
        "client_context": {"signature": signature}, 
        "tlsh": "hash_A"
    })
    item = ContentItem(
        original_filename=filename,
        owner_id=owner_id,
        storage_path="path/a",
        version=1,
        metadata_json=meta,
        checksum="checksum_A"
    )
    session.add(item)
    session.commit()
    
    # Try to upload Project B (Different content, same header/signature)
    # We expect a Conflict (or at least NOT version 2 if we want to be safe), 
    # but current logic might return 2.
    
    # Mock TLSH to show difference
    with patch('tlsh.diff', return_value=300): # High distance = different
        # Ideally, this should RAISE IdentityConflictError if we are strict.
        # Currently, it likely returns 2 because signature matches.
        
        try:
            v_next = get_next_version(
                session, 
                filename, 
                owner_id, 
                signature=signature, 
                tlsh_hash="hash_B"
            )
            print(f"\nResult: Version {v_next}")
            # If it returns a version, the fix FAILED. It should have conflicted.
            pytest.fail(f"Should have raised IdentityConflictError but got Version {v_next}")
        except IdentityConflictError:
            print("\nResult: Conflict Detected (Good!)")
            # Success

import pytest
from sqlmodel import Session, select
from app.models import Tag, ContentItem, engine
import uuid



def test_create_tag(session: Session):
    tag = Tag(name="Test Tag", color="#ff0000")
    session.add(tag)
    session.commit()
    session.refresh(tag)
    
    assert tag.id is not None
    assert tag.name == "Test Tag"
    assert tag.color == "#ff0000"

def test_add_tag_to_item(session: Session):
    # Create an item
    item = ContentItem(original_filename="test.txt", storage_path="/tmp/test.txt")
    session.add(item)
    
    # Create a tag
    tag = Tag(name="Resource", color="#00ff00")
    session.add(tag)
    session.commit()
    
    # Associate
    item.tags.append(tag)
    session.add(item)
    session.commit()
    session.refresh(item)
    
    assert len(item.tags) == 1
    assert item.tags[0].name == "Resource"

def test_delete_tag_removes_association(session: Session):
    # Setup
    item = ContentItem(original_filename="test_del.txt", storage_path="/tmp/test_del.txt")
    tag = Tag(name="Temporary", color="#0000ff")
    item.tags.append(tag)
    session.add(item)
    session.commit()
    
    tag_id = tag.id
    item_id = item.id
    
    # Delete tag
    session.delete(tag)
    session.commit()
    
    # Verify association is gone but item remains
    updated_item = session.get(ContentItem, item_id)
    assert updated_item is not None
    assert len(updated_item.tags) == 0
    
    deleted_tag = session.get(Tag, tag_id)
    assert deleted_tag is None

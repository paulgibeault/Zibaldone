
import sys
import os
from sqlmodel import Session, SQLModel, create_engine
from app import crud, models

# Setup in-memory DB
engine = create_engine("sqlite:///:memory:")
SQLModel.metadata.create_all(engine)

def test_get_tags_filtering():
    print("Testing get_tags filtering...")
    with Session(engine) as session:
        # Create approved tag
        t1 = crud.create_tag(session, name="approved_tag", color="#000000", is_autocreated=False, is_approved=True)
        # Create unapproved tag
        t2 = crud.create_tag(session, name="unapproved_tag", color="#000000", is_autocreated=True, is_approved=False)
        
        # Test default (all tags)
        all_tags = crud.get_tags(session, approved_only=False)
        print(f"All tags count: {len(all_tags)}")
        assert len(all_tags) == 2, f"Expected 2 tags, got {len(all_tags)}"
        
        # Test approved only
        approved_tags = crud.get_tags(session, approved_only=True)
        print(f"Approved tags count: {len(approved_tags)}")
        assert len(approved_tags) == 1, f"Expected 1 tag, got {len(approved_tags)}"
        assert approved_tags[0].name == "approved_tag", f"Expected 'approved_tag', got {approved_tags[0].name}"
        
        print("SUCCESS: Tag filtering works as expected.")

if __name__ == "__main__":
    try:
        test_get_tags_filtering()
    except Exception as e:
        print(f"FAILURE: {e}")
        sys.exit(1)

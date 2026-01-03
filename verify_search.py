import sys
import os

# Add backend directory to sys.path
sys.path.append(os.path.join(os.getcwd(), "backend"))

from app.models import create_db_and_tables, ContentItem, Tag
from app.crud import search_content, create_tag
from sqlmodel import Session, create_engine, select

# Setup DB connection (assuming default sqlite path)
from app.models import engine

def test_search():
    with Session(engine) as session:
        # Create some dummy data if needed, or just search existing
        # But to be safe, let's assume we are searching existing data or I can read what's there.
        
        # Test case 1: Search for a tag that likely exists or I can create one
        print("Testing Search...")
        
        # Create a test tag
        t = create_tag(session, "test_search_tag", "#ffffff")
        print(f"Created tag: {t.name}")
        
        # Search for it
        results = search_content(session, "test_search")
        print(f"Search 'test_search' results: {len(results['tags'])} tags, {len(results['items'])} items")
        
        found_tag = any(x.name == "test_search_tag" for x in results["tags"])
        if found_tag:
            print("SUCCESS: Found tag by partial name.")
        else:
            print("FAILURE: Did not find tag.")

        # Test case 2: Space delimited
        results2 = search_content(session, "test search")
        print(f"Search 'test search' results: {len(results2['tags'])} tags")
        found_tag2 = any(x.name == "test_search_tag" for x in results2["tags"])
        if found_tag2:
            print("SUCCESS: Found tag with space delimited query.")
        else:
            print("FAILURE: Did not find tag with space delimited query.")

        # Cleanup
        session.delete(t)
        session.commit()

if __name__ == "__main__":
    test_search()

import urllib.request
import urllib.parse
import json
import sys

BASE_URL = "http://127.0.0.1:8000/api"

def make_request(url, method="GET", data=None):
    if data:
        data = json.dumps(data).encode('utf-8')
    
    req = urllib.request.Request(url, data=data, method=method)
    req.add_header('Content-Type', 'application/json')
    
    try:
        with urllib.request.urlopen(req) as response:
            return json.loads(response.read().decode('utf-8'))
    except urllib.error.HTTPError as e:
        print(f"HTTP Error {e.code}: {e.read().decode('utf-8')}")
        sys.exit(1)
    except Exception as e:
        print(f"Error: {e}")
        sys.exit(1)

def test_metadata_update():
    # 1. List items to get an ID
    print("Listing items...")
    items = make_request(f"{BASE_URL}/items")
    
    if not items:
        print("No items found. Please upload an item first.")
        sys.exit(0)
        
    item = items[0]
    item_id = item["id"]
    print(f"Using item: {item_id}")
    
    # 2. Get current metadata
    current_metadata = json.loads(item["metadata_json"] or "{}")
    print(f"Current metadata: {current_metadata}")
    
    # 3. Update metadata
    new_metadata = current_metadata.copy()
    new_metadata["test_field"] = "test_value_urllib"
    
    print(f"Updating metadata to: {new_metadata}")
    updated_item = make_request(f"{BASE_URL}/items/{item_id}/metadata", method="PUT", data=new_metadata)
    
    updated_metadata = json.loads(updated_item["metadata_json"])
    print(f"Updated metadata from response: {updated_metadata}")
    
    if updated_metadata.get("test_field") != "test_value_urllib":
        print("Verification FAILED: test_field not found or incorrect")
        sys.exit(1)
        
    # 4. Verify tags are still there
    items = make_request(f"{BASE_URL}/items")
    target_item = next(i for i in items if i["id"] == item_id)
    print(f"Tags after update: {len(target_item['tags'])}")
    
    print("Verification SUCCESS")

if __name__ == "__main__":
    test_metadata_update()

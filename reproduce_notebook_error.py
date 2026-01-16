import requests
import uuid
import sys

API_URL = "http://localhost:8000/api"

def reproduce_error():
    print("Reproducing Notebook Error...")
    
    # 1. Create a Notebook
    print("1. Creating Notebook...")
    title = f"Repro Notebook {uuid.uuid4()}"
    desc = "This is a repro notebook"
    response = requests.post(f"{API_URL}/notebooks/", json={"title": title, "description": desc})
    
    if response.status_code != 200:
        print(f"Failed to create notebook: {response.status_code} {response.text}")
        return

    notebook = response.json()
    notebook_id = notebook["id"]
    print(f"Created notebook: {notebook_id}")
    
    # 2. Get some items to add
    print("2. Getting items...")
    items_resp = requests.get(f"{API_URL}/items/?limit=5")
    if items_resp.status_code != 200:
        print(f"Failed to get items: {items_resp.status_code} {items_resp.text}")
        return
        
    items = items_resp.json()
    if not items:
        print("No items found to add.")
        return
        
    item_ids = [item["id"] for item in items]
    print(f"Adding items: {item_ids}")
    
    # 3. Add Items to Notebook
    print("3. Adding items to notebook...")
    resp = requests.post(f"{API_URL}/notebooks/{notebook_id}/items", json={"item_ids": item_ids})
    
    if resp.status_code != 200:
        print(f"Failed to add items: {resp.status_code} {resp.text}")
    else:
        print("Successfully added items.")
        nb = resp.json()
        print(f"Notebook items count: {len(nb.get('items', []))}")

    # clean up
    requests.delete(f"{API_URL}/notebooks/{notebook_id}")

if __name__ == "__main__":
    reproduce_error()

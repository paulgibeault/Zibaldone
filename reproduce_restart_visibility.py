import asyncio
import uuid
import requests
import time
# from app.models import TaskStatus

BASE_URL = "http://localhost:8000/api"

def test_restart_visibility():
    # 1. Get a failed task or create one?
    # Let's list tasks first
    resp = requests.get(f"{BASE_URL}/tasks/")
    tasks = resp.json()
    
    failed_task = None
    for t in tasks:
        if t['status'] == 'FAILED':
            failed_task = t
            break
            
    if not failed_task:
        print("No failed tasks found to restart. Please ensure there is at least one failed task.")
        return

    print(f"Found failed task: {failed_task['id']} (Status: {failed_task['status']})")
    
    # 2. Restart it
    print(f"Restarting task {failed_task['id']}...")
    restart_resp = requests.post(f"{BASE_URL}/tasks/{failed_task['id']}/restart")
    if restart_resp.status_code != 200:
        print(f"Restart failed: {restart_resp.text}")
        return
        
    print("Restart initiated.")
    
    # 3. Poll for status change
    for i in range(10):
        time.sleep(0.5)
        resp = requests.get(f"{BASE_URL}/tasks/")
        tasks = resp.json()
        current_task = next((t for t in tasks if t['id'] == failed_task['id']), None)
        
        if current_task:
            print(f"[{i}] Task Status: {current_task['status']}")
            if current_task['status'] in ['PENDING', 'RUNNING']:
                print("SUCCESS: Task transitioned to running state!")
                return
        else:
            print("Task vanished?")
            
    print("FAILURE: Task did not appear running within 5 seconds.")

if __name__ == "__main__":
    test_restart_visibility()

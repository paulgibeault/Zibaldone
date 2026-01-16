import sys
import os

# Add backend to path
sys.path.append(os.getcwd())

print("Attempting to import app.main...")
try:
    from backend.app.main import app
    print("Successfully imported app.main")
except Exception as e:
    print(f"Failed to import app.main: {e}")
    import traceback
    traceback.print_exc()

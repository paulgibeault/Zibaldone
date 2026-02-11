
import logging
from pathlib import Path
import sys

# Mimic llm.py setup
try:
    log_dir = Path(__file__).parent / "logs"
    print(f"Log dir: {log_dir}")
    log_dir.mkdir(exist_ok=True, parents=True) # Added parents=True just in case
    
    llm_logger = logging.getLogger("reproduce_logging")
    llm_logger.setLevel(logging.INFO)
    
    log_file = log_dir / "llm_repro.log"
    print(f"Log file: {log_file}")
    
    file_handler = logging.FileHandler(log_file)
    file_handler.setFormatter(logging.Formatter('%(asctime)s - %(levelname)s - %(message)s'))
    llm_logger.addHandler(file_handler)
    
    llm_logger.info("Test log message from reproduction script")
    print("Log functionality verified via script.")
except Exception as e:
    print(f"Logging setup failed: {e}")
    import traceback
    traceback.print_exc()

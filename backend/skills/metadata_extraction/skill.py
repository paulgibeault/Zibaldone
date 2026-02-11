
import sys
import json
import logging
import os

# Configure logging to stderr
logging.basicConfig(stream=sys.stderr, level=logging.INFO)
logger = logging.getLogger("metadata_extraction")

def extract_metadata(file_path: str, content_text: str = None):
    """
    Simulates metadata extraction using an LLM.
    In a real sandbox, this would call an external API (like OpenAI/Anthropic) 
    using keys provided in env vars.
    """
    logger.info(f"Extracting metadata for {file_path}")
    
    # Check if we have content
    if not content_text:
        # Try reading file if valid path
        if os.path.exists(file_path):
             try:
                 with open(file_path, 'r', encoding='utf-8', errors='ignore') as f:
                     content_text = f.read(2000) # Read first 2KB for context
             except Exception as e:
                 return {"status": "error", "message": f"Failed to read file: {e}"}
        else:
             return {"status": "skipped", "message": "No content or file found"}
             
    # MOCK LLM CALL
    # In production, use `litellm` or `requests` to call the LLM API.
    # The sandbox usually allows outbound HTTP to 443.
    
    # Heuristic for demo:
    metadata = {
        "summary": f"This is a processed summary of the file {os.path.basename(file_path)}.",
        "word_count": len(content_text.split()),
        "keywords": ["extracted", "demo", "sandbox"]
    }
    
    return {
        "status": "success",
        "metadata_patch": metadata,
        "events_to_emit": ["metadata_updated"],
        "message": "Metadata extracted successfully"
    }

if __name__ == "__main__":
    if len(sys.argv) < 2:
        print(json.dumps({"error": "No input provided"}))
        sys.exit(1)
        
    file_path = sys.argv[1]
    
    # Optional: Read content from stdin if provided?
    # For now, just rely on file path.
    
    result = extract_metadata(file_path)
    print(json.dumps(result))


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
                     content_text = f.read(10000) # Read first 10KB 
             except Exception as e:
                 return {"status": "error", "message": f"Failed to read file: {e}"}
        else:
             return {"status": "skipped", "message": "No content or file found"}
             
    # LLM Configuration
    api_base = os.environ.get("LITELLM_URL", "http://localhost:4000")
    api_key = os.environ.get("LITELLM_API_KEY", "sk-1234")
    
    # Construct Prompt
    filename = os.path.basename(file_path)
    prompt = f"""
    You are a metadata extraction tool.
    Analyze the following document content and extract:
    1. A concise summary (max 2 sentences).
    2. A list of 3-5 relevant keywords.
    3. The detected language or type of content.

    Filename: {filename}
    Content Snippet:
    {content_text[:4000]}
    
    Return ONLY valid JSON in this format:
    {{
        "summary": "...",
        "keywords": ["..."],
        "content_type": "..."
    }}
    """
    
    messages = [
        {"role": "system", "content": "You are a helpful assistant that outputs only JSON."},
        {"role": "user", "content": prompt}
    ]
    
    payload = {
        "model": "zibaldone-model", # Default model name
        "messages": messages,
        "temperature": 0.0
    }
    
    try:
        import urllib.request
        import urllib.error
        
        # Construct proper endpoint URL
        # api_base might be "http://10.0.0.52:1234" or "http://10.0.0.52:1234/v1"
        # We need to append /v1/chat/completions if not present
        if "/v1/chat/completions" in api_base:
            url = api_base
        elif api_base.endswith("/v1"):
            url = api_base + "/chat/completions"
        else:
            # Strip trailing slash and add /v1/chat/completions
            url = api_base.rstrip("/") + "/v1/chat/completions"
        
        logger.info(f"LLM Request URL: {url}")
             
        req = urllib.request.Request(
            url, 
            data=json.dumps(payload).encode('utf-8'),
            headers={
                "Content-Type": "application/json",
                "Authorization": f"Bearer {api_key}"
            }
        )
        
        with urllib.request.urlopen(req) as response:
            response_body = response.read().decode('utf-8')
            resp_json = json.loads(response_body)
            
            content = resp_json['choices'][0]['message']['content']
            
            # Robust JSON extraction
            if "```json" in content:
                content = content.split("```json")[1].split("```")[0].strip()
            elif "```" in content:
                content = content.split("```")[1].split("```")[0].strip()
                
            metadata = json.loads(content)
            
            # Add word count manually
            metadata["word_count"] = len(content_text.split())
            
            return {
                "status": "success",
                "metadata_patch": metadata,
                "events_to_emit": ["metadata_updated"],
                "message": "Metadata extracted successfully via LLM"
            }
            
    except Exception as e:
        logger.error(f"LLM Call Failed: {e}")
        # Fallback to heuristic if LLM fails
        metadata = {
            "summary": f"Summary of {filename} (LLM Failed: {str(e)})",
            "word_count": len(content_text.split()),
            "keywords": ["error", "fallback"]
        }
        return {
            "status": "partial_success",
            "metadata_patch": metadata,
            "message": f"LLM failed, using fallback. Error: {e}"
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

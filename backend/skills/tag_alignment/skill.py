
import sys
import json
import logging

# Configure logging to stderr
logging.basicConfig(stream=sys.stderr, level=logging.INFO)
logger = logging.getLogger("tag_alignment")

def align_tags(current_tags: list, existing_tags: list):
    """
    Aligns free-form tags with existing taxonomy.
    """
    if not current_tags:
        return {"status": "skipped", "message": "No tags to align"}
        
    if not existing_tags:
        # Accept all current tags as new
        return {
            "status": "success",
            "tags_to_add": current_tags,
            "message": "No existing taxonomy, accepted all tags"
        }

    # MOCK LLM LOGIC for alignment
    # In production, this would call LLM.
    # Simple heuristic: case-insensitive match, or partial match?
    # For now, let's just assume we return the current_tags as-is if no obvious match, 
    # but strictly speaking this should be an LLM call.
    
    aligned = []
    existing_lower = {t.lower(): t for t in existing_tags}
    
    for tag in current_tags:
        t_low = tag.lower()
        if t_low in existing_lower:
            # Match found
            aligned.append(existing_lower[t_low])
        else:
            # No match, propose new
            aligned.append(tag)
            
    # Check if we actually changed anything
    if aligned == current_tags:
        msg = "Tags already aligned"
    else:
        msg = "Tags aligned to taxonomy"

    return {
        "status": "success", 
        "metadata_patch": {"tags": aligned},
        "tags_to_add": aligned,
        "message": msg
    }

if __name__ == "__main__":
    # Expect JSON input from stdin or argument
    try:
        # Check if argument is a file path (common for large inputs)
        if len(sys.argv) > 1 and sys.argv[1].endswith(".json"):
            with open(sys.argv[1], 'r') as f:
                data = json.load(f)
        else:
             # Try stdin (piped input)
             # Checking if there is data on stdin
             if not sys.stdin.isatty():
                 input_str = sys.stdin.read()
                 if input_str.strip():
                     data = json.loads(input_str)
                 else:
                     data = {}
             else:
                 # Demo/Test data
                 data = {"tags": [], "existing_tags": []}

        tags = data.get("tags", [])
        existing = data.get("existing_tags", [])
        
        result = align_tags(tags, existing)
        print(json.dumps(result))
        
    except Exception as e:
        # Print error details to stderr
        logger.error(f"Execution Error: {e}")
        # Return a structured error to stdout
        print(json.dumps({"status": "failure", "message": str(e)}))
        sys.exit(1)

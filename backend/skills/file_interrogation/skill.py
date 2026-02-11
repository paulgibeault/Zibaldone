
import sys
import json
import logging
import mimetypes
import os

# Configure logging to stderr so stdout is reserved for JSON output
logging.basicConfig(stream=sys.stderr, level=logging.INFO)
logger = logging.getLogger("file_interrogation")

# Explicitly register markdown types
mimetypes.add_type("text/markdown", ".md")
mimetypes.add_type("text/markdown", ".markdown")

def detect_file_type(file_path: str):
    """
    Detects mime type of a file using standard libraries and heuristics.
    No database access required.
    """
    if not os.path.exists(file_path):
        return {"error": f"File not found: {file_path}"}
        
    detected_type = None
    method = "unknown"
    
    # 1. Try filetype library (if available in sandbox)
    # For now, we rely on standard lib + extension as the sandbox env might be minimal.
    # If we install 'filetype' in the container image, we can use it.
    try:
        import filetype
        kind = filetype.guess(file_path)
        if kind:
            detected_type = kind.mime
            method = "filetype_header"
    except ImportError:
        logger.warning("filetype library not installed")
    except Exception as e:
        logger.warning(f"Filetype guess failed: {e}")

    # 2. Fallback to mimetypes
    if not detected_type:
        mime_guess, encoding = mimetypes.guess_type(file_path)
        if mime_guess:
            detected_type = mime_guess
            method = "mimetypes_extension"
        else:
            # 3. Binary vs Text Heuristic
            try:
                with open(file_path, 'rb') as f:
                    chunk = f.read(1024)
                    if b'\0' in chunk:
                        detected_type = "application/octet-stream"
                        method = "binary_fallback"
                    else:
                        detected_type = "text/plain"
                        method = "text_fallback"
            except Exception as e:
                return {"error": f"Read failed: {e}"}

    logger.info(f"Detected: {detected_type} via {method}")
    
    # Determine events to emit
    events = []
    if detected_type.startswith("text/") or detected_type in [
        "application/json", "application/pdf", "application/javascript", 
        "application/xml", "application/jsonlines", "application/x-yaml"]:
        events.append("content_text_ready")
    elif detected_type.startswith("image/") or detected_type.startswith("video/") or detected_type.startswith("audio/"):
        events.append("content_media_ready")

    return {
        "metadata_patch": {
            "mime_type": detected_type,
            "interrogation_method": method,
            "detected_at": "now" # In a real scenario, use isoformat date
        },
        "events_to_emit": events,
        "tags_to_add": [detected_type],
        "message": f"Detected {detected_type}"
    }

if __name__ == "__main__":
    # Expect input file path as first argument
    if len(sys.argv) < 2:
        print(json.dumps({"error": "No file path provided"}))
        sys.exit(1)
        
    file_path = sys.argv[1]
    result = detect_file_type(file_path)
    print(json.dumps(result))

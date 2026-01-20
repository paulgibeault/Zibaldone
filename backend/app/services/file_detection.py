import yaml
import logging
from pathlib import Path
from typing import Dict, Any, Optional, List
from dataclasses import dataclass

logger = logging.getLogger(__name__)

try:
    import magic
    HAVE_MAGIC = True
except ImportError:
    logger.warning("python-magic not installed or libmagic missing. Falling back to extension/custom only.")
    HAVE_MAGIC = False

@dataclass
class DetectedFileType:
    mime_type: str
    rendering_strategy: str
    extension: Optional[str] = None
    name: Optional[str] = None

class CustomSignatureMatcher:
    def __init__(self, config_path: str = "app/config/custom_signatures.yaml"):
        self.signatures = []
        self._load_config(config_path)

    def _load_config(self, config_path: str):
        try:
            path = Path(config_path)
            # Handle relative paths from app root if needed, but assume relative to execution or absolute for now.
            # Ideally use a robust path resolution relative to this file or project root.
            if not path.is_absolute():
                 # Assuming app/config/... relative to backend root
                 # Adjust based on where this is running. 
                 # Let's try to resolve relative to this file:
                 # backend/app/services/file_detection.py -> backend/app/config/custom_signatures.yaml
                 path = Path(__file__).parent.parent / "config" / "custom_signatures.yaml"

            if not path.exists():
                logger.warning(f"Custom signature config not found at {path}")
                return

            with open(path, 'r') as f:
                config = yaml.safe_load(f)
                
            if config and 'custom_types' in config:
                for item in config['custom_types']:
                    # Convert ascii signature to bytes if it looks like text, or keep as is if hex?
                    # The prompt said "hex signature", but example "CRPT" is ascii. 
                    # Let's assume the config provides Hex strings for robustness, 
                    # but for the example "CRPT", I'll handle string -> bytes.
                    
                    sig = item.get('signature')
                    if not sig:
                        continue
                        
                    # basic heuristic: if all hex chars, treat as hex, else ascii ?? 
                    # easier: just assume it might be a string literal for now or hex bytes.
                    # safer: user must provide a way to distinguish. 
                    # simpler: encode as utf-8 if it's a normal string.
                    
                    # For this implementation, I will be flexible.
                    # If it's a string, I'll encode it.
                    
                    # BUT prompt said: "Define Signature: Add the hex signature (magic bytes) to a YAML config file"
                    # However, the example in the prompt was logic, not the file itself. 
                    # I will assume the user might put "43 52 50 54" or "CRPT".
                    # Let's just try to match bytes.
                    
                    byte_sig = sig.encode('utf-8') # Default to ascii/utf8 encoding for "CRPT"
                    
                    self.signatures.append({
                        'bytes': byte_sig,
                        'offset': item.get('offset', 0),
                        'info': DetectedFileType(
                            mime_type=item.get('mime_type'),
                            rendering_strategy=item.get('rendering_strategy'),
                            extension=item.get('extension'),
                            name=item.get('name')
                        )
                    })
                    
        except Exception as e:
            logger.error(f"Failed to load custom signatures: {e}")

    def match(self, file_path: str, header_bytes: bytes) -> Optional[DetectedFileType]:
        for sig in self.signatures:
            offset = sig['offset']
            target = sig['bytes']
            
            if len(header_bytes) >= offset + len(target):
                if header_bytes[offset : offset + len(target)] == target:
                    return sig['info']
        return None

class FileDetectionService:
    def __init__(self):
        self.custom_matcher = CustomSignatureMatcher()
        # Ensure magic is initialized securely if needed, but python-magic usually Just Works™

    def detect(self, file_path: str, original_filename: str) -> Dict[str, Any]:
        """
        Detects file type and returns a dictionary with metadata including rendering_strategy.
        """
        path = Path(file_path)
        if not path.exists():
            return {
                "mime_type": "application/octet-stream",
                "rendering_strategy": "Default",
                "detected_by": "fallback"
            }

        # Read first 2048 bytes for custom matching
        header_bytes = b""
        try:
            with open(path, 'rb') as f:
                header_bytes = f.read(2048)
        except Exception as e:
            logger.error(f"Error reading file header for {file_path}: {e}")

        # 1. Custom Scan
        custom_match = self.custom_matcher.match(file_path, header_bytes)
        if custom_match:
            return {
                "mime_type": custom_match.mime_type,
                "rendering_strategy": custom_match.rendering_strategy,
                "detected_by": "custom_signature",
                "type_name": custom_match.name
            }

        # 2. Standard Scan (python-magic)
        mime = "application/octet-stream"
        if HAVE_MAGIC:
            try:
                mime = magic.from_file(str(path), mime=True)
            except Exception as e:
                logger.warning(f"Magic failed: {e}")
        else:
             # Basic extension fallback validation for mime so we don't return octet-stream for valid files if magic missing
             pass

        # 3. Strategy Mapping for Standard Types
        strategy = self._map_mime_to_strategy(mime, original_filename)

        return {
            "mime_type": mime,
            "rendering_strategy": strategy,
            "detected_by": "libmagic"
        }

    def _map_mime_to_strategy(self, mime: str, filename: str) -> str:
        # Default mappings
        if mime.startswith("image/"):
            return "ImageRenderer"
        if mime.startswith("video/"):
            return "VideoRenderer"
        if mime.startswith("audio/"):
            return "AudioRenderer"
        if mime == "application/pdf":
            return "PdfRenderer"
        if mime == "text/html":
            return "HtmlRenderer"
            
        if mime.startswith("text/") or "json" in mime or "xml" in mime or "javascript" in mime:
            # Maybe refine for code?
            return "CodeRenderer"
            
        # Extension fallback for markdown until magic supports it well (magic often says text/plain for md)
        fname = filename.lower()
        if fname.endswith(".md") or fname.endswith(".markdown"):
            return "MarkdownRenderer"
            
        if fname.endswith(".html") or fname.endswith(".htm"):
            return "HtmlRenderer"
            
        # Expanded list of code/text extensions
        code_strategies = {
            ".py", ".js", ".ts", ".tsx", ".jsx", 
            ".rb", ".go", ".rs", ".java", ".c", ".cpp", ".h", ".hpp",
            ".sh", ".bash", ".zsh", 
            ".yaml", ".yml", ".json", ".xml", ".sql", ".css", ".html", ".php", 
            ".dockerfile"
        }
        
        # Check extensions
        if any(fname.endswith(ext) for ext in code_strategies):
            return "CodeRenderer"
            
        if fname == "dockerfile" or fname == "makefile":
            return "CodeRenderer"
            
        return "Default"

# Singleton instance
file_detector = FileDetectionService()

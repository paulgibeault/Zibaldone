import filetype
import mimetypes
from app.services.skill_sdk import SkillContext, SkillResult
from app.services.storage import get_storage
import logging


logger = logging.getLogger(__name__)

# Explicitly register markdown types to ensure consistency across environments
mimetypes.add_type("text/markdown", ".md")
mimetypes.add_type("text/markdown", ".markdown")

async def run(ctx: SkillContext) -> SkillResult:
    item = ctx.item
    storage = get_storage()
    full_path = storage.get_path(item.storage_path)
    
    logger.info(f"Interrogating file: {full_path}")
    
    detected_type = None
    method = "unknown"

    # 1. Read file content (up to first 2KB for detection is usually enough, but we have helper for full)
    # Since we need to support S3, we should not use open(full_path).
    # Ideally, we should use a stream or range read, but for now read full content (or updated SDK method).
    # Note: ctx.read_file_content calls storage.get_content()
    
    try:
        content_bytes = await ctx.read_file_content(as_text=False)
    except Exception as e:
        logger.error(f"Failed to read file content: {e}")
        return ctx.fail(f"Could not read file content: {e}")

    # 1. Try filetype (header signature for binaries)
    try:
        kind = filetype.guess(content_bytes)
        if kind:
            detected_type = kind.mime
            method = "filetype_header"
    except Exception as e:
        logger.warning(f"Filetype guess failed: {e}")

    # 2. If valid mime not found, check for text vs binary
    if not detected_type:
        try:
             # Heuristic: Check first 1024 bytes
            is_binary = False
            chunk = content_bytes[:1024]
            if b'\0' in chunk:
                is_binary = True
            
            if not is_binary:
                # It's text. Use mimetypes to refine
                filename = item.original_filename or ""
                mime_guess, encoding = mimetypes.guess_type(filename)
                detected_type = mime_guess or "text/plain"
                method = "mimetypes_fallback"
            else:
                detected_type = "application/octet-stream"
                method = "binary_fallback"
        except Exception as e:
            logger.error(f"Fallback detection failed: {e}")
            detected_type = "application/octet-stream"
            method = f"fallback_error: {str(e)}"

    logger.info(f"Detected type: {detected_type} via {method}")
    
    # Update metadata
    metadata_patch = {
        "mime_type": detected_type,
        "interrogation_method": method,
        "detected_at": "now"
    }

    # Determine event to emit
    events = []
    
    # Text-based formats
    if detected_type.startswith("text/") or \
       detected_type in ["application/json", "application/pdf", "application/javascript", 
                         "application/xml", "application/jsonlines", "application/x-yaml"]:
        events.append("content_text_ready")
    
    # Media formats
    elif detected_type.startswith("image/") or \
         detected_type.startswith("video/") or \
         detected_type.startswith("audio/"):
        events.append("content_media_ready")
    
    else:
        logger.info(f"Unknown or unsupported type {detected_type} for automatic extraction pipeline.")

    return ctx.create_result(
        metadata=metadata_patch,
        events=events,
        tags=[detected_type],
        message=f"Detected {detected_type}"
    )

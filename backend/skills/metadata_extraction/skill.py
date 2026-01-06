from app.services.skill_sdk import SkillContext, SkillResult
from app.services.llm import LLMService
import os

async def run(ctx: SkillContext) -> SkillResult:
    # 1. Setup
    # Allow override from params, fallback to env var, fallback to default
    default_model = os.getenv("LLM_MODEL", "gpt-3.5-turbo")
    model_name = ctx.params.get('llm_model') or default_model
    
    ctx.logger.info(f"Running Metadata Extraction with model: {model_name}")
    llm_service = LLMService(model=model_name)
    
    # 2. Get Content
    # We try to read as text. If it fails (binary), we might skip or handle differently.
    # generate_metadata handles binary if we pass none?
    try:
        content_text = await ctx.read_file_content(as_text=True)
    except Exception:
        # Binary file?
        content_text = None
        
    # We can also get bytes if needed, but LLMService usually takes path or text
    # Checking existing workers.py:
    # content_bytes = await storage.get_content(item.storage_path)
    # content_text = content_bytes.decode('utf-8', errors='ignore')
    
    if content_text is None:
         # Try reading bytes to pass explicitly if needed?
         # For now, let's assume text extraction is handled or we rely on path if text is None
         pass

    # 3. Call LLM
    try:
        # llm_service.generate_metadata(file_path, content_text=..., content_bytes=...)
        # We should pass what we have.
        
        llm_metadata = await llm_service.generate_metadata(
            ctx.item.storage_path,
            content_text=content_text
        )
        
        ctx.logger.info(f"Generated metadata: {llm_metadata.keys()}")

        # 4. Return result
        return ctx.create_result(
            metadata=llm_metadata,
            events=["metadata_updated"]
        )
        
    except Exception as e:
        ctx.logger.error(f"LLM extraction failed: {e}")
        return ctx.fail(f"LLM Error: {e}")

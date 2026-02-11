
import asyncio
import logging
from app.services.llm import LLMService

# Configure basic logging to see script output
logging.basicConfig(level=logging.INFO)
logger = logging.getLogger("trigger_llm")

async def main():
    logger.info("Starting LLM validation...")
    
    try:
        service = LLMService()
        logger.info(f"Initialized LLMService with model: {service.model}")
        
        # Test align_tags as it's a simple, pure-logic LLM call
        existing = ["python", "coding"]
        new_tags = ["py", "programming"]
        logger.info(f"Calling align_tags with: {new_tags} against {existing}")
        
        result = await service.align_tags(new_tags, existing)
        logger.info(f"Result: {result}")
        logger.info("LLM call completed successfully.")
        
    except Exception as e:
        logger.error(f"LLM call failed: {e}", exc_info=True)

if __name__ == "__main__":
    asyncio.run(main())

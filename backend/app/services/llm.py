from litellm import acompletion, get_max_tokens, token_counter
import json
import os
import base64
from typing import Dict, Any, Optional
from pathlib import Path
import logging
from datetime import datetime

from app.exceptions import ServiceUnavailable
from app.config import settings

# Setup LLM Logger
log_dir = Path(__file__).parent.parent.parent / "logs"
log_dir.mkdir(exist_ok=True)
llm_logger = logging.getLogger("llm_interaction")
llm_logger.setLevel(logging.INFO)
file_handler = logging.FileHandler(log_dir / "llm.log")
file_handler.setFormatter(logging.Formatter('%(asctime)s - %(levelname)s - %(message)s'))
llm_logger.addHandler(file_handler)

class LLMService:
    def __init__(self, model: str = "zibaldone-model"):
        self.model = model
        self.prompts_dir = Path(__file__).parent.parent / "prompts"
        self.type_mapping = {
            ".txt": "text",
            ".md": "text",
            ".py": "text",
            ".js": "text",
            ".html": "text",
            ".css": "text",
            ".jpg": "image",
            ".jpeg": "image",
            ".png": "image",
            ".webp": "image",
        }

    def _get_type_for_extension(self, extension: str) -> str:
        return self.type_mapping.get(extension.lower(), "default")

    def _load_prompt_config(self, file_type: str) -> str:
        base_instr = (self.prompts_dir / "base_instructions.md").read_text()
        schema = (self.prompts_dir / "common_schema.json").read_text()
        
        type_file = self.prompts_dir / "types" / f"{file_type}.md"
        if not type_file.exists():
            type_file = self.prompts_dir / "types" / "default.md"
        
        type_instr = type_file.read_text()
        
        prompt = f"""
{base_instr}

Type-Specific Instructions:
{type_instr}

Required JSON Schema:
{schema}

JSON Result:
"""
        return prompt

    def _truncate_content(self, prompt: str, content: str, model: str) -> str:
        """
        Dynamically truncate content based on model context window and prompt size.
        """
        try:
            max_tokens = get_max_tokens(model) or 4096
        except Exception:
            max_tokens = 4096 # Fallback
            
        # Reserved for instructions and response (approx 1500 tokens)
        reserve_tokens = 1500
        available_tokens = max_tokens - reserve_tokens
        
        if available_tokens <= 0:
            return content[:1000] # Extreme fallback
            
        # Quick check: 1 token approx 4 chars
        if len(content) < available_tokens * 4:
            return content
            
        try:
            # Iterative truncation
            current_tokens = token_counter(model=model, text=f"{prompt}\n\n{content}")
            if current_tokens <= available_tokens:
                return content
            
            # Simple binary search or heuristic for truncation
            # For simplicity, we'll start with a safe multiplier
            char_limit = available_tokens * 3 
            return content[:char_limit]
        except Exception:
            # Fallback to character-based heuristic
            return content[: available_tokens * 2]

    async def generate_metadata(self, file_path: str, content_text: Optional[str] = None, content_bytes: Optional[bytes] = None) -> Dict[str, Any]:
        """
        Generates metadata for the given file, using vision for images if supported.
        Raises ServiceUnavailable or other exceptions on failure.
        """
        ext = Path(file_path).suffix
        file_type = self._get_type_for_extension(ext)
        prompt = self._load_prompt_config(file_type)
        
        api_base = settings.LITELLM_URL
        messages = []

        if file_type == "image":
            # Vision request
            try:
                if content_bytes:
                    base64_image = base64.b64encode(content_bytes).decode('utf-8')
                else:
                    with open(file_path, "rb") as image_file:
                        base64_image = base64.b64encode(image_file.read()).decode('utf-8')
                
                messages = [
                    {
                        "role": "user",
                        "content": [
                            {"type": "text", "text": prompt},
                            {
                                "type": "image_url",
                                "image_url": {
                                    "url": f"data:image/jpeg;base64,{base64_image}"
                                }
                            }
                        ]
                    }
                ]
            except Exception as e:
                print(f"Error reading image for vision: {e}")
                # Fallback to text prompt if image reading fails
                messages = [{"role": "user", "content": f"{prompt}\nFilename: {Path(file_path).name}"}]
        else:
            # Text request: if no content provided, try to read it
            if not content_text:
                try:
                    with open(file_path, "r", encoding="utf-8", errors="ignore") as f:
                        content_text = f.read()
                except Exception as e:
                    print(f"Error reading text file {file_path}: {e}")
            
            # Dynamic Truncation
            if content_text:
                content_text = self._truncate_content(prompt, content_text, self.model)
            
            full_content = f"Filename: {Path(file_path).name}"
            if content_text:
                full_content += f"\n\nContent:\n{content_text}"
            
            messages = [
                {"role": "user", "content": f"{prompt}\n\n{full_content}"}
            ]

        try:
            # Log Request
            if settings.ENABLE_LLM_LOGGING:
                llm_logger.info(f"--- LLM REQUEST: {Path(file_path).name} ---")
                llm_logger.info(f"Model: {self.model}")
                llm_logger.info(f"API Base: {api_base}")
                # Mask API Key
                masked_key = "sk-..." if "api_key" in locals() and locals().get("api_key") else "None"
                llm_logger.info(f"API Key Used: {masked_key}")
                llm_logger.info(f"Messages: {json.dumps(messages, indent=2)}")

            response = await acompletion(
                model=self.model,
                api_base=api_base,
                messages=messages,
                custom_llm_provider="openai",
                api_key="sk-1234" 
            )
        except Exception as e:
            # Fallback for vision failure (e.g. model doesn't support images)
            if file_type == "image":
                print(f"Vision processing failed: {e}. Falling back to text prompt.")
                
                # Create text-only fallback prompt
                fallback_prompt = f"{prompt}\nFilename: {Path(file_path).name}\n[Image content could not be processed, please infer metadata from filename]"
                
                messages = [
                    {"role": "user", "content": fallback_prompt}
                ]
                
                # Log Fallback Request
                if settings.ENABLE_LLM_LOGGING:
                    llm_logger.info(f"--- LLM FALLBACK REQUEST: {Path(file_path).name} ---")
                    llm_logger.info(f"Model: {self.model}")
                    llm_logger.info(f"Messages: {json.dumps(messages, indent=2)}")

                try:
                    response = await acompletion(
                        model=self.model,
                        api_base=api_base,
                        messages=messages,
                        custom_llm_provider="openai",
                        api_key="sk-1234"
                    )
                except Exception as ex:
                    raise ServiceUnavailable(f"LLM Service failed: {ex}")
            else:
                llm_logger.error(f"LLM Service Failed for {file_path}: {e}", exc_info=True)
                raise ServiceUnavailable(f"LLM Service failed: {e}")
        
        content = response.choices[0].message.content.strip()
        
        # Log Response
        if settings.ENABLE_LLM_LOGGING:
            llm_logger.info(f"--- LLM RESPONSE: {Path(file_path).name} ---")
            llm_logger.info(f"Raw Response: {content}")
        
        # Robust JSON extraction
        if "```json" in content:
            content = content.split("```json")[1].split("```")[0].strip()
        elif "```" in content:
            content = content.split("```")[1].split("```")[0].strip()
        
        if "{" in content and "}" in content:
            start_index = content.find("{")
            end_index = content.rfind("}")
            if start_index != -1 and end_index != -1:
                content = content[start_index:end_index+1]

        try:
            return json.loads(content)
        except json.JSONDecodeError:
            # Return partial result or fail?
            # Creating a fake dict might be better than failing task?
            # But let's stick to fail fast if LLM returns garbage
            raise ServiceUnavailable(f"LLM returned invalid JSON")

    async def align_tags(self, new_tags: list[str], existing_tags: list[str]) -> list[str]:
        """
        Aligns new tags with existing tags to reduce fragmentation.
        """
        if not new_tags:
            return []
        
        # If no existing tags, just return the new ones (cleaned)
        if not existing_tags:
            return new_tags

        prompt = f"""
You are a precise tag alignment tool.
Your goal is to decide if any NEW TAGS are strict synonyms for EXISTING TAGS.

Input Data:
Existing Tags: {existing_tags}
New Tags: {new_tags}

Task:
For each tag in "New Tags", determine if it maps to an "Existing Tag".
- If it is a STRICT SYNONYM (e.g. "bills" -> "receipts"), map it to the existing tag.
- If it is UNIQUE or DISTINCT, map it to null.
- DO NOT force relationships. When in doubt, map to null.

Output Format:
Return a JSON object with a single key "mapping" containing a dictionary where keys are new tags and values are the mapped existing tag or null.

Example:
Existing: ["receipts", "javascript"]
New: ["bills", "python", "js_code"]
Output:
{{
  "mapping": {{
    "bills": "receipts",
    "python": null,
    "js_code": "javascript"
  }}
}}

JSON Result:
"""
        messages = [{"role": "user", "content": prompt}]
        api_base = settings.LITELLM_URL
        
        try:
            if settings.ENABLE_LLM_LOGGING:
                llm_logger.info(f"--- LLM TAG ALIGNMENT REQUEST ---")
                llm_logger.info(f"Messages: {json.dumps(messages, indent=2)}")

            response = await acompletion(
                model=self.model,
                api_base=api_base,
                messages=messages,
                custom_llm_provider="openai",
                api_key="sk-1234"
            )
            
            content = response.choices[0].message.content.strip()

            if settings.ENABLE_LLM_LOGGING:
                llm_logger.info(f"--- LLM TAG ALIGNMENT RESPONSE ---")
                llm_logger.info(f"Raw Response: {content}")
            
            # Robust JSON extraction
            if "```json" in content:
                content = content.split("```json")[1].split("```")[0].strip()
            elif "```" in content:
                content = content.split("```")[1].split("```")[0].strip()
            
            result_json = json.loads(content)
            mapping = result_json.get("mapping", {})
            
            final_tags = []
            for tag in new_tags:
                # Get mapped value
                mapped_val = mapping.get(tag)
                
                # If mapped to a string that exists in existing_tags (sanity check), use it
                if isinstance(mapped_val, str) and mapped_val in existing_tags:
                    final_tags.append(mapped_val)
                else:
                    # Otherwise keep original
                    final_tags.append(tag)
            
            # Deduplicate while preserving order (roughly)
            seen = set()
            unique_ordered = []
            for t in final_tags:
                if t not in seen:
                    unique_ordered.append(t)
                    seen.add(t)
            
            return unique_ordered
            
        except Exception as e:
            print(f"LLM Tag Alignment Error: {e}")
            return new_tags

    async def chat_with_context(self, messages: list[dict], context_items: list[dict]) -> Dict[str, Any]:
        """
        Chat with the LLM using a list of files as context.
        context_items: List of dicts with 'storage_path' and 'original_filename' keys.
        messages: List of {"role": "...", "content": "..."}
        """
        from app.services.storage import get_storage
        storage = get_storage()
        api_base = settings.LITELLM_URL
        
        # 1. Prepare Context Message (System/User)
        context_parts = []
        image_contents = []

        for item in context_items:
            storage_path = item.get("storage_path")
            filename = item.get("original_filename", "unknown_file")
            
            if not storage_path:
                continue

            try:
                # Use storage service to get content (bytes)
                file_content_bytes = await storage.get_content(storage_path)
                
                path_obj = Path(filename)
                ext = path_obj.suffix
                file_type = self._get_type_for_extension(ext)
                
                if file_type == "image":
                    b64 = base64.b64encode(file_content_bytes).decode('utf-8')
                    image_contents.append({
                        "type": "image_url",
                        "image_url": {"url": f"data:image/{ext.lstrip('.')};base64,{b64}"}
                    })
                    context_parts.append(f"Image Attachment: {filename}")
                else:
                    # Assume text
                    text = file_content_bytes.decode('utf-8', errors='ignore')
                    # Truncate?
                    truncated_text = self._truncate_content("Context", text, self.model)
                    context_parts.append(f"Document: {filename}\nContent:\n{truncated_text}\n---")
            except Exception as e:
                print(f"Failed to read context file {filename}: {e}")
                context_parts.append(f"Document: {filename} (Read Error)")

        # 2. Construct Messages
        # We'll put context in the first user message or a system message if supported.
        
        system_instruction = "You are a helpful assistant. Use the provided documents/images as context to answer the user's request."
        
        context_text_block = "\n".join(context_parts)
        
        # Initial context message
        initial_content = [{"type": "text", "text": f"{system_instruction}\n\nCONTEXT:\n{context_text_block}"}]
        # Append images to the initial context message
        initial_content.extend(image_contents)
        
        final_messages = [
            {"role": "system", "content": system_instruction}, 
            {"role": "user", "content": initial_content}
        ]
        
        # Append conversation history
        for msg in messages:
             final_messages.append(msg)
             
        try:
            if settings.ENABLE_LLM_LOGGING:
                llm_logger.info(f"--- LLM CHAT REQUEST ---")
                llm_logger.info(f"Context Items: {len(context_items)}")

            response = await acompletion(
                model=self.model,
                api_base=api_base,
                messages=final_messages,
                custom_llm_provider="openai",
                api_key="sk-1234"
            )
            
            content = response.choices[0].message.content.strip()
            
            if settings.ENABLE_LLM_LOGGING:
                llm_logger.info(f"--- LLM CHAT RESPONSE ---")
                llm_logger.info(f"Response: {content[:200]}...")

            return {
                "content": content,
                "debug_info": {
                    "raw_prompt_messages": final_messages,
                    "raw_response": response.model_dump() if hasattr(response, 'model_dump') else str(response)
                }
            }
            
        except Exception as e:
            llm_logger.error(f"LLM Chat Error: {e}")
            raise ServiceUnavailable(f"LLM Chat failed: {e}")


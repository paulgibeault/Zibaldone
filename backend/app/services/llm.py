from litellm import acompletion, get_max_tokens, token_counter
import json
import os
import base64
from typing import Dict, Any, Optional
from pathlib import Path

class LLMService:
    def __init__(self, model: str = "gpt-3.5-turbo"):
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

    async def generate_metadata(self, file_path: str, content_text: Optional[str] = None) -> Dict[str, Any]:
        """
        Generates metadata for the given file, using vision for images if supported.
        """
        ext = Path(file_path).suffix
        file_type = self._get_type_for_extension(ext)
        prompt = self._load_prompt_config(file_type)
        
        api_base = os.getenv("LITELLM_URL")
        messages = []

        if file_type == "image":
            # Vision request
            try:
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
            response = await acompletion(
                model=self.model,
                api_base=api_base,
                messages=messages,
            )
            
            content = response.choices[0].message.content.strip()
            
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

            return json.loads(content)
        except Exception as e:
            print(f"LLM Error: {e}")
            return {
                "error": str(e),
                "tags": ["processing-failed"],
                "processing_notes": f"Attempted file: {Path(file_path).name}"
            }

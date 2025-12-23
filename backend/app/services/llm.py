from litellm import acompletion
import json
import os
from typing import Dict, Any

class LLMService:
    def __init__(self, model: str = "gpt-3.5-turbo"):
        # Default to gpt-3.5-turbo, but can be configured for local models like "ollama/llama2"
        self.model = model

    async def generate_metadata(self, content_text: str) -> Dict[str, Any]:
        """
        Generates metadata for the given content text.
        """
        prompt = f"""
        Analyze the following text and provide metadata in strict JSON format.
        Do not include any introductory or concluding text, only the JSON object.
        
        Required fields:
        - summary: A brief summary
        - tags: A list of relevant tags
        - sentiment: positive, negative, or neutral
        
        Text:
        {content_text[:1000]}... (truncated)
        
        JSON Result:
        """
        
        # Use LITELLM_URL from environment if available (for Docker networking)
        api_base = os.getenv("LITELLM_URL")
        
        try:
            response = await acompletion(
                model=self.model,
                api_base=api_base, # Route through the proxy
                messages=[{"role": "user", "content": prompt}],
                # response_format={ "type": "json_object" } # Optional: Some providers support this
            )
            
            content = response.choices[0].message.content.strip()
            
            # Robust JSON extraction
            # 1. Try to find content within markdown blocks
            if "```json" in content:
                content = content.split("```json")[1].split("```")[0].strip()
            elif "```" in content:
                content = content.split("```")[1].split("```")[0].strip()
            
            # 2. If it still looks like it has wrapping text, try to find the first '{' and last '}'
            if "{" in content and "}" in content:
                start_index = content.find("{")
                end_index = content.rfind("}")
                if start_index != -1 and end_index != -1:
                    content = content[start_index:end_index+1]

            return json.loads(content)
        except Exception as e:
            print(f"LLM Error: {e}")
            print(f"Raw Content attempted: {content if 'content' in locals() else 'None'}")
            return {
                "error": str(e),
                "tags": ["processing-failed"]
            }

from litellm import completion
import json
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
        Analyze the following text and provide metadata in JSON format.
        Include:
        - summary: A brief summary
        - tags: A list of relevant tags
        - sentiment: positive, negative, or neutral
        
        Text:
        {content_text[:1000]}... (truncated)
        """
        
        try:
            response = completion(
                model=self.model,
                messages=[{"role": "user", "content": prompt}],
                # mock_response="{'summary': 'Mock summary', 'tags': ['mock']}" # Uncomment for testing without API key
            )
            
            content = response.choices[0].message.content
            # Basic cleanup to ensure JSON
            # In a real app, use structured output or more robust parsing
            if "```json" in content:
                content = content.split("```json")[1].split("```")[0]
            elif "```" in content:
                content = content.split("```")[1].split("```")[0]
                
            return json.loads(content)
        except Exception as e:
            print(f"LLM Error: {e}")
            return {
                "error": str(e),
                "tags": ["processing-failed"]
            }

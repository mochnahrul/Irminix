import asyncio
import json
import logging
from typing import Any, Optional

from google import genai

from app.core.config import settings

logger = logging.getLogger(__name__)

GEMINI_MODEL_ID = "gemini-2.5-flash"


async def generate_gemini_json(
    prompt: str,
    timeout_seconds: float = 15.0,
) -> Optional[dict[str, Any]]:
    """Call Gemini asynchronously with a timeout and parse a JSON object response.

    Returns None when GEMINI_API_KEY is unset, the request fails/times out,
    or the response is not a valid JSON object.
    """
    if not settings.GEMINI_API_KEY:
        return None

    try:
        client = genai.Client(api_key=settings.GEMINI_API_KEY)
        response = await asyncio.wait_for(
            client.aio.models.generate_content(
                model=GEMINI_MODEL_ID,
                contents=prompt,
            ),
            timeout=timeout_seconds,
        )
        raw = (response.text or "").strip()
        if raw.startswith("```"):
            parts = raw.split("```")
            if len(parts) >= 2:
                raw = parts[1]
                if raw.startswith("json"):
                    raw = raw[4:]
            raw = raw.strip()

        parsed = json.loads(raw)
        if isinstance(parsed, dict):
            return parsed
        logger.warning("Gemini returned non-object JSON (%s)", type(parsed).__name__)
    except Exception as exc:
        logger.warning("Gemini JSON generation failed: %s", exc)

    return None

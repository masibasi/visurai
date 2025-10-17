"""Image OCR helpers using OpenAI Vision (gpt-4o-mini) to extract text from images.

Avoids native dependencies like Tesseract by leveraging existing OpenAI API usage.
"""

from __future__ import annotations

import base64
from typing import Optional

from openai import OpenAI

from .settings import get_settings


def _get_client() -> OpenAI:
    s = get_settings()
    if not s.openai_api_key:
        raise RuntimeError("OPENAI_API_KEY is not set for OCR")
    return OpenAI(api_key=s.openai_api_key)


def _data_url(content_type: str, data: bytes) -> str:
    b64 = base64.b64encode(data).decode("ascii")
    return f"data:{content_type};base64,{b64}"


def extract_text_from_image_url(
    image_url: str, prompt_hint: Optional[str] = None
) -> str:
    """Extract visible text from an image at a URL using OpenAI Vision."""
    client = _get_client()
    hint = (
        prompt_hint
        or "Extract all readable text from this image as plain text. Preserve line breaks."
    )
    # Use Chat Completions with multimodal content
    resp = client.chat.completions.create(
        model=get_settings().llm_model,
        messages=[
            {
                "role": "user",
                "content": [
                    {"type": "text", "text": hint},
                    {"type": "image_url", "image_url": {"url": image_url}},
                ],
            }
        ],
        temperature=0.0,
    )
    text = resp.choices[0].message.content or ""
    return text.strip()


def extract_text_from_image_bytes(
    content_type: str, data: bytes, prompt_hint: Optional[str] = None
) -> str:
    """Extract visible text from raw image bytes using OpenAI Vision via data URL."""
    image_url = _data_url(content_type, data)
    return extract_text_from_image_url(image_url, prompt_hint=prompt_hint)

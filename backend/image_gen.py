"""Replicate image generation using Flux 1.1 Pro.

Wraps the Replicate client and exposes an async-friendly function to generate a single image URL.
"""
from __future__ import annotations

import os
from typing import Optional

import replicate
from tenacity import retry, stop_after_attempt, wait_exponential

from .settings import get_settings


def _get_replicate_client() -> replicate.Client:
    s = get_settings()
    token = s.replicate_api_token or os.getenv("REPLICATE_API_TOKEN")
    if not token:
        raise RuntimeError("REPLICATE_API_TOKEN is not set in environment")
    return replicate.Client(api_token=token)


@retry(wait=wait_exponential(multiplier=1, min=2, max=20), stop=stop_after_attempt(3))
def generate_image_url(prompt: str, seed: Optional[int] = None) -> str:
    """Generate a single image from a prompt and return the image URL."""
    s = get_settings()
    client = _get_replicate_client()

    # The exact input schema can vary across model versions; we set minimal, robust fields.
    input_payload = {
        "prompt": prompt,
    }
    if seed is not None:
        input_payload["seed"] = seed

    output = client.run(
        s.replicate_model,
        input=input_payload,
        timeout=s.replicate_timeout_seconds,
    )

    # Replicate may return a list of URLs or an object; normalize.
    if isinstance(output, list) and output:
        return str(output[0])
    if isinstance(output, str):
        return output
    # Fallback: try to extract URL from dict
    if isinstance(output, dict):
        for v in output.values():
            if isinstance(v, str) and v.startswith("http"):
                return v
            if isinstance(v, list) and v and isinstance(v[0], str) and v[0].startswith("http"):
                return v[0]
    raise RuntimeError(f"Unexpected Replicate output format: {type(output)}")

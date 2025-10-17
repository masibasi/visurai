"""Replicate image generation using Flux 1.1 Pro.

Wraps the Replicate client and exposes an async-friendly function to generate a single image URL.
"""

from __future__ import annotations

import os
from typing import Optional

import replicate
from replicate.exceptions import ReplicateError
from replicate.helpers import FileOutput
from tenacity import retry, retry_if_exception, stop_after_attempt, wait_exponential

from .settings import get_settings


class BillingCreditError(RuntimeError):
    """Raised when Replicate returns a billing/credit error (402)."""


def _get_replicate_client() -> replicate.Client:
    s = get_settings()
    token = s.replicate_api_token or os.getenv("REPLICATE_API_TOKEN")
    if not token:
        raise RuntimeError("REPLICATE_API_TOKEN is not set in environment")
    return replicate.Client(api_token=token)


@retry(
    wait=wait_exponential(multiplier=1, min=2, max=20),
    stop=stop_after_attempt(3),
    retry=retry_if_exception(lambda e: not isinstance(e, BillingCreditError)),
)
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

    try:
        # Prefer URL results over local file outputs
        output = client.run(
            s.replicate_model,
            input=input_payload,
            timeout=s.replicate_timeout_seconds,
            use_file_output=False,
        )
    except ReplicateError as e:
        # Surface common billing/auth issues with clear messages
        msg = str(e)
        if "Insufficient credit" in msg or "status: 402" in msg:
            raise BillingCreditError(
                "Replicate billing: insufficient credit. Please add credit to your Replicate account."
            )
        raise

    # Replicate may return a list of URLs/FileOutputs or a single object; normalize.
    if isinstance(output, list) and output:
        first = output[0]
        if isinstance(first, str) and first.startswith("http"):
            return first
        if isinstance(first, FileOutput):
            if getattr(first, "url", None):
                return first.url  # type: ignore[attr-defined]
            if getattr(first, "path", None):
                # Fallback: local file path; not ideal for clients, but better than failing
                return f"file://{first.path}"
        # Try generic extraction from list
        for v in output:
            if isinstance(v, str) and v.startswith("http"):
                return v
            if isinstance(v, dict):
                for vv in v.values():
                    if isinstance(vv, str) and vv.startswith("http"):
                        return vv
    if isinstance(output, str):
        return output
    # Fallback: try to extract URL from dict
    if isinstance(output, dict):
        for v in output.values():
            if isinstance(v, str) and v.startswith("http"):
                return v
            if (
                isinstance(v, list)
                and v
                and (
                    (isinstance(v[0], str) and v[0].startswith("http"))
                    or (isinstance(v[0], FileOutput) and getattr(v[0], "url", None))
                )
            ):
                return v[0] if isinstance(v[0], str) else v[0].url  # type: ignore[attr-defined]
    # Single FileOutput
    if isinstance(output, FileOutput):
        if getattr(output, "url", None):
            return output.url  # type: ignore[attr-defined]
        if getattr(output, "path", None):
            return f"file://{output.path}"
    raise RuntimeError(f"Unexpected Replicate output format: {type(output)}")


def can_generate_images() -> bool:
    """Best-effort probe: checks whether Replicate client is configured.

    Does not run a paid prediction; only verifies token presence.
    """
    try:
        _ = _get_replicate_client()
        return True
    except Exception:
        return False

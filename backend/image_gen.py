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
    # Prefer aspect ratio when supported by the model
    if getattr(s, "replicate_aspect_ratio", None):
        input_payload["aspect_ratio"] = s.replicate_aspect_ratio
    elif s.replicate_width and s.replicate_height:
        input_payload["width"] = s.replicate_width
        input_payload["height"] = s.replicate_height
    if seed is not None:
        input_payload["seed"] = seed

    def _run_with_payload(payload: dict):
        return client.run(
            s.replicate_model,
            input=payload,
            timeout=s.replicate_timeout_seconds,
            use_file_output=False,
        )

    try:
        # Prefer URL results over local file outputs
        output = _run_with_payload(input_payload)
    except ReplicateError as e:
        # Surface common billing/auth issues with clear messages first
        msg = str(e)
        if "Insufficient credit" in msg or "status: 402" in msg:
            raise BillingCreditError(
                "Replicate billing: insufficient credit. Please add credit to your Replicate account."
            )
        # If the model doesn't support aspect_ratio, retry using width/height (1280x720)
        if "aspect_ratio" in msg:
            retry_payload = {
                k: v for k, v in input_payload.items() if k != "aspect_ratio"
            }
            retry_payload.setdefault("width", s.replicate_width or 1280)
            retry_payload.setdefault("height", s.replicate_height or 720)
            try:
                output = _run_with_payload(retry_payload)
            except ReplicateError as e2:
                msg2 = str(e2)
                # Last resort: drop explicit sizing and hint the ratio in the prompt
                if any(tok in msg2 for tok in ["width", "height"]):
                    hinted = dict(retry_payload)
                    hinted.pop("width", None)
                    hinted.pop("height", None)
                    hinted["prompt"] = f"{prompt}\n\n[Compose in a 16:9 aspect ratio]"
                    output = _run_with_payload(hinted)
                else:
                    raise
        else:
            # Unknown input error; attempt a prompt-hinted retry once
            hinted = dict(input_payload)
            hinted["prompt"] = f"{prompt}\n\n[Compose in a 16:9 aspect ratio]"
            output = _run_with_payload(hinted)

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

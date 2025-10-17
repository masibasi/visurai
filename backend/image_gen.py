"""Replicate image generation helper.

Generates a single image URL from a text prompt using the configured Replicate model.
Handles model-specific quirks (e.g., SD3 prefers aspect_ratio), 16:9 targeting,
size clamping to multiples of 64, and clear error propagation.
"""

from __future__ import annotations

import logging
import os
from typing import Optional

import replicate
from replicate.exceptions import ReplicateError
from replicate.helpers import FileOutput
from tenacity import retry, retry_if_exception, stop_after_attempt, wait_exponential

from .settings import get_settings

logger = logging.getLogger(__name__)


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

    def _run(payload: dict):
        return client.run(
            s.replicate_model,
            input=payload,
            timeout=s.replicate_timeout_seconds,
            use_file_output=False,
        )

    # Base payload
    payload: dict = {"prompt": prompt}

    # Detect SD3-like models that prefer aspect_ratio
    model_id = (s.replicate_model or "").lower()
    sd3_like = any(
        tok in model_id
        for tok in (
            "stability-ai/stable-diffusion-3",
            "stability-ai/sd3",
            "stable-diffusion-3",
            "sd3",
        )
    )

    if sd3_like:
        payload["aspect_ratio"] = getattr(s, "replicate_aspect_ratio", None) or "16:9"
    else:
        if s.replicate_width and s.replicate_height:

            def _clamp(v: int) -> int:
                v = max(64, v)
                return (v // 64) * 64

            cw, ch = _clamp(s.replicate_width), _clamp(s.replicate_height)
            if (cw, ch) != (s.replicate_width, s.replicate_height):
                logger.info(
                    "Adjusted requested size %sx%s -> %sx%s for model %s",
                    s.replicate_width,
                    s.replicate_height,
                    cw,
                    ch,
                    s.replicate_model,
                )
            payload["width"], payload["height"] = cw, ch
        elif getattr(s, "replicate_aspect_ratio", None):
            payload["aspect_ratio"] = s.replicate_aspect_ratio

    if seed is not None:
        payload["seed"] = seed

    try:
        output = _run(payload)
    except ReplicateError as e:
        msg = str(e)
        logger.warning("Replicate error (%s): %s", s.replicate_model, msg)
        if "Insufficient credit" in msg or "status: 402" in msg:
            raise BillingCreditError(
                "Replicate billing: insufficient credit. Please add credit to your Replicate account."
            )
        # Retry by toggling AR vs dims, else prompt hint
        if "aspect" in msg and "ratio" in msg:
            retry = {k: v for k, v in payload.items() if k != "aspect_ratio"}
            retry["width"], retry["height"] = 1280, 720
            output = _run(retry)
        elif any(tok in msg for tok in ("width", "height", "size", "dimension")):
            retry = {k: v for k, v in payload.items() if k not in ("width", "height")}
            retry["aspect_ratio"] = getattr(s, "replicate_aspect_ratio", None) or "16:9"
            output = _run(retry)
        else:
            hinted = dict(payload)
            hinted.pop("width", None)
            hinted.pop("height", None)
            hinted["prompt"] = f"{prompt}\n\n[Compose in a 16:9 aspect ratio]"
            output = _run(hinted)

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

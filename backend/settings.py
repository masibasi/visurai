"""
Application settings loaded from environment variables using dotenv + pydantic.
"""

from __future__ import annotations

import os
from functools import lru_cache
from typing import List, Optional

from dotenv import load_dotenv
from pydantic import BaseModel, Field


class Settings(BaseModel):
    # General
    environment: str = Field(default="local")
    api_prefix: str = Field(default="/api")
    cors_origins: List[str] = Field(default_factory=lambda: ["*"])
    cors_origin_regex: Optional[str] = Field(default=None)

    # LLM
    llm_provider: str = Field(default="openai")  # openai | anthropic (future)
    llm_model: str = Field(default="gpt-4o-mini")
    openai_api_key: Optional[str] = Field(default=None)

    # Replicate / Flux
    replicate_api_token: Optional[str] = Field(default=None)
    replicate_model: str = Field(default="black-forest-labs/flux-1.1-pro")
    replicate_timeout_seconds: int = Field(default=300)
    # Desired output shape for generated images
    replicate_aspect_ratio: Optional[str] = Field(
        default="16:9"
    )  # e.g., "1:1", "3:2", "16:9"
    replicate_width: Optional[int] = Field(
        default=None
    )  # only used if aspect ratio not provided
    replicate_height: Optional[int] = Field(default=None)

    # Performance
    max_concurrency: int = Field(default=4)

    # Visual style guide injected into every scene prompt for consistency
    style_guide: str = Field(
        default=(
            "Friendly illustrated style; kid- and dyslexia-friendly; gentle colors; clear primary subject; "
            "soft lighting; clean composition; avoid text overlays and watermarks; maintain consistent characters/props across scenes."
        )
    )

    # Pipeline engine: 'langgraph' (graph-based) or 'imperative' (existing flow)
    pipeline_engine: str = Field(default="langgraph")

    # TTS (Text-To-Speech)
    tts_provider: str = Field(default="openai")  # openai (default)
    tts_model: str = Field(default="gpt-4o-mini-tts")
    tts_voice: str = Field(default="alloy")
    tts_output_dir: str = Field(default="/tmp/seequence_audio")


def _parse_list(value: Optional[str]) -> List[str]:
    if not value:
        return ["*"]
    return [v.strip() for v in value.split(",") if v.strip()]


@lru_cache(maxsize=1)
def get_settings() -> Settings:
    # Load .env if present
    load_dotenv(dotenv_path=os.path.join(os.path.dirname(__file__), ".env"))

    # Base values
    env = os.getenv("ENVIRONMENT", "local")
    api_prefix = os.getenv("API_PREFIX", "/api")
    cors_origin_regex = os.getenv("CORS_ORIGIN_REGEX")
    cors_origins_list = _parse_list(os.getenv("CORS_ORIGINS"))
    # If a regex is provided, prefer it and avoid using '*' with credentials
    if cors_origin_regex:
        cors_origins_list = []

    settings = Settings(
        environment=env,
        api_prefix=api_prefix,
        cors_origins=cors_origins_list,
        cors_origin_regex=cors_origin_regex,
        llm_provider=os.getenv("LLM_PROVIDER", "openai"),
        llm_model=os.getenv("LLM_MODEL", "gpt-4o-mini"),
        openai_api_key=os.getenv("OPENAI_API_KEY"),
        replicate_api_token=os.getenv("REPLICATE_API_TOKEN"),
        replicate_model=os.getenv("REPLICATE_MODEL", "black-forest-labs/flux-1.1-pro"),
        replicate_timeout_seconds=int(os.getenv("REPLICATE_TIMEOUT_SECONDS", "300")),
        replicate_aspect_ratio=os.getenv("REPLICATE_ASPECT_RATIO", "16:9"),
        replicate_width=(
            int(os.getenv("REPLICATE_WIDTH")) if os.getenv("REPLICATE_WIDTH") else None
        ),
        replicate_height=(
            int(os.getenv("REPLICATE_HEIGHT"))
            if os.getenv("REPLICATE_HEIGHT")
            else None
        ),
        max_concurrency=int(os.getenv("MAX_CONCURRENCY", "4")),
        style_guide=os.getenv("STYLE_GUIDE", None)
        or (
            "Friendly illustrated style; kid- and dyslexia-friendly; gentle colors; clear primary subject; "
            "soft lighting; clean composition; avoid text overlays and watermarks; maintain consistent characters/props across scenes."
        ),
        pipeline_engine=os.getenv("PIPELINE_ENGINE", "langgraph"),
        tts_provider=os.getenv("TTS_PROVIDER", "openai"),
        tts_model=os.getenv("TTS_MODEL", "gpt-4o-mini-tts"),
        tts_voice=os.getenv("TTS_VOICE", "alloy"),
        tts_output_dir=os.getenv("TTS_OUTPUT_DIR", "/tmp/seequence_audio"),
    )
    # Ensure TTS output dir exists
    try:
        os.makedirs(settings.tts_output_dir, exist_ok=True)
    except Exception:
        pass
    return settings

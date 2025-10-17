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

    # LLM
    llm_provider: str = Field(default="openai")  # openai | anthropic (future)
    llm_model: str = Field(default="gpt-4o-mini")
    openai_api_key: Optional[str] = Field(default=None)

    # Replicate / Flux
    replicate_api_token: Optional[str] = Field(default=None)
    replicate_model: str = Field(default="black-forest-labs/flux-1.1-pro")
    replicate_timeout_seconds: int = Field(default=300)

    # Performance
    max_concurrency: int = Field(default=4)

    # Visual style guide injected into every scene prompt for consistency
    style_guide: str = Field(
        default=(
            "Friendly illustrated style; kid- and dyslexia-friendly; gentle colors; clear primary subject; "
            "soft lighting; clean composition; avoid text overlays and watermarks; maintain consistent characters/props across scenes."
        )
    )


def _parse_list(value: Optional[str]) -> List[str]:
    if not value:
        return ["*"]
    return [v.strip() for v in value.split(",") if v.strip()]


@lru_cache(maxsize=1)
def get_settings() -> Settings:
    # Load .env if present
    load_dotenv(dotenv_path=os.path.join(os.path.dirname(__file__), ".env"))

    return Settings(
        environment=os.getenv("ENVIRONMENT", "local"),
        api_prefix=os.getenv("API_PREFIX", "/api"),
        cors_origins=_parse_list(os.getenv("CORS_ORIGINS")),
        llm_provider=os.getenv("LLM_PROVIDER", "openai"),
        llm_model=os.getenv("LLM_MODEL", "gpt-4o-mini"),
        openai_api_key=os.getenv("OPENAI_API_KEY"),
        replicate_api_token=os.getenv("REPLICATE_API_TOKEN"),
        replicate_model=os.getenv("REPLICATE_MODEL", "black-forest-labs/flux-1.1-pro"),
        replicate_timeout_seconds=int(os.getenv("REPLICATE_TIMEOUT_SECONDS", "300")),
        max_concurrency=int(os.getenv("MAX_CONCURRENCY", "4")),
        style_guide=os.getenv("STYLE_GUIDE", None)
        or (
            "Friendly illustrated style; kid- and dyslexia-friendly; gentle colors; clear primary subject; "
            "soft lighting; clean composition; avoid text overlays and watermarks; maintain consistent characters/props across scenes."
        ),
    )

    

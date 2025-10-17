"""Pydantic request/response models for the Seequence backend."""

from __future__ import annotations

from typing import List, Optional

from pydantic import BaseModel, conint


class SegmentRequest(BaseModel):
    text: str
    max_scenes: conint(ge=1) = 8  # type: ignore[name-defined]


class Scene(BaseModel):
    scene_id: int
    scene_summary: str
    prompt: Optional[str] = None
    image_url: Optional[str] = None
    # References to the original input sentences that this scene is based on
    source_sentence_indices: Optional[List[int]] = None
    source_sentences: Optional[List[str]] = None


class SegmentResponse(BaseModel):
    scenes: List[Scene]


class GenerateImageRequest(BaseModel):
    prompt: str
    seed: Optional[int] = None


class GenerateImageResponse(BaseModel):
    image_url: str


class GenerateVisualsRequest(BaseModel):
    text: str
    max_scenes: int = 8


class GenerateVisualsResponse(BaseModel):
    scenes: List[Scene]


class SceneWithAudio(Scene):
    """Scene enriched with TTS narration metadata."""

    audio_url: Optional[str] = None
    audio_duration_seconds: Optional[float] = None


class GenerateVisualsWithAudioResponse(BaseModel):
    scenes: List[SceneWithAudio]


# OCR-driven flows
class VisualsFromImageURLRequest(BaseModel):
    image_url: str
    max_scenes: int = 8
    prompt_hint: Optional[str] = None  # optional OCR instruction


class VisualsFromImageUploadResponse(BaseModel):
    extracted_text: str
    result: GenerateVisualsResponse


# OCR-only flows
class OCRFromImageURLRequest(BaseModel):
    image_url: str
    prompt_hint: Optional[str] = None


class OCRTextResponse(BaseModel):
    extracted_text: str

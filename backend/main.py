from __future__ import annotations

"""FastAPI app for Seequence backend.

Endpoints:
- POST /segment: split text into story beats
- POST /generate_image: generate one image (test)
- POST /generate_visuals: full pipeline (LLM -> Flux)
"""

import asyncio
from typing import List

from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from tenacity import RetryError

from backend import chains
from backend.image_gen import BillingCreditError, generate_image_url
from backend.models import (
    GenerateImageRequest,
    GenerateImageResponse,
    GenerateVisualsRequest,
    GenerateVisualsResponse,
    Scene,
    SegmentRequest,
    SegmentResponse,
)
from backend.settings import get_settings

s = get_settings()
app = FastAPI(title="Seequence Backend", version="0.1.0")

app.add_middleware(
    CORSMiddleware,
    allow_origins=s.cors_origins,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


@app.get("/health")
def health() -> dict:
    """Simple health check endpoint."""
    return {"status": "ok"}


@app.post("/segment", response_model=SegmentResponse)
def segment(req: SegmentRequest) -> SegmentResponse:
    """Split input text into coherent scenes using the LLM."""
    raw_scenes = chains.segment_text_into_scenes(req.text, req.max_scenes)
    scenes: List[Scene] = [
        Scene(scene_id=s["scene_id"], scene_summary=s["scene_summary"])
        for s in raw_scenes
    ]
    return SegmentResponse(scenes=scenes)


@app.post("/generate_image", response_model=GenerateImageResponse)
def generate_image(req: GenerateImageRequest) -> GenerateImageResponse:
    """Generate one test image from a prompt via Replicate/Flux."""
    try:
        url = generate_image_url(req.prompt, seed=req.seed)
        return GenerateImageResponse(image_url=url)
    except BillingCreditError:
        raise HTTPException(
            status_code=402,
            detail="Replicate credit is insufficient. Please top up.",
        )
    except RetryError as e:
        cause = e.last_attempt.exception() if hasattr(e, "last_attempt") else None
        msg = str(cause or e)
        if msg and "insufficient credit" in msg.lower():
            raise HTTPException(
                status_code=402,
                detail="Replicate credit is insufficient. Please top up.",
            )
        raise HTTPException(status_code=502, detail=f"Image generation failed: {msg}")
    except RuntimeError as e:
        msg = str(e)
        if "insufficient credit" in msg.lower():
            raise HTTPException(
                status_code=402,
                detail="Replicate credit is insufficient. Please top up.",
            )
        raise HTTPException(status_code=502, detail=f"Image generation failed: {msg}")


@app.post("/generate_visuals", response_model=GenerateVisualsResponse)
async def generate_visuals(req: GenerateVisualsRequest) -> GenerateVisualsResponse:
    """Full pipeline: segment -> prompt -> parallel image generation."""
    raw_scenes = chains.segment_text_into_scenes(req.text, req.max_scenes)

    # Generate prompts sequentially (fast), then images in parallel (slower/io-bound)
    scenes_with_prompts: List[Scene] = []
    for sdict in raw_scenes:
        prompt = chains.generate_visual_prompt(sdict["scene_summary"])
        scenes_with_prompts.append(
            Scene(
                scene_id=sdict["scene_id"],
                scene_summary=sdict["scene_summary"],
                prompt=prompt,
            )
        )

    # Parallelize image generation using asyncio.to_thread for the sync Replicate call
    async def gen(scene: Scene) -> Scene:
        url = await asyncio.to_thread(generate_image_url, scene.prompt or "")
        scene.image_url = url
        return scene

    semaphore = asyncio.Semaphore(s.max_concurrency)

    async def guarded_gen(scene: Scene) -> Scene:
        async with semaphore:
            return await gen(scene)

    results = await asyncio.gather(*(guarded_gen(scn) for scn in scenes_with_prompts))
    return GenerateVisualsResponse(scenes=list(results))


# Run from repo root:
#   uv run uvicorn backend.main:app --reload --port 8000

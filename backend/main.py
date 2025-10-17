from __future__ import annotations

"""FastAPI app for Seequence backend.

Endpoints:
- POST /segment: split text into story beats
- POST /generate_image: generate one image (test)
- POST /generate_visuals: full pipeline (LLM -> Flux)
"""

import asyncio
import json
import logging
from typing import List

from fastapi import FastAPI, File, HTTPException, Query, UploadFile
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import StreamingResponse
from fastapi.staticfiles import StaticFiles
from tenacity import RetryError

from backend import chains
from backend.graph import run_visuals_graph
from backend.image_gen import BillingCreditError, generate_image_url
from backend.models import (
    GenerateImageRequest,
    GenerateImageResponse,
    GenerateVisualsRequest,
    GenerateVisualsResponse,
    GenerateVisualsWithAudioResponse,
    OCRFromImageURLRequest,
    OCRTextResponse,
    Scene,
    SceneWithAudio,
    SegmentRequest,
    SegmentResponse,
    VisualsFromImageUploadResponse,
    VisualsFromImageURLRequest,
)
from backend.settings import get_settings
from backend.tts import tts_scene_summary
from backend.vision import extract_text_from_image_bytes, extract_text_from_image_url

s = get_settings()
app = FastAPI(title="Seequence Backend", version="0.1.0")
logger = logging.getLogger(__name__)

app.add_middleware(
    CORSMiddleware,
    allow_origins=s.cors_origins,
    allow_origin_regex=s.cors_origin_regex,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Serve generated audio files under /static/audio
app.mount(
    "/static/audio",
    StaticFiles(directory=s.tts_output_dir),
    name="audio",
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
        Scene(
            scene_id=s["scene_id"],
            scene_summary=s["scene_summary"],
            source_sentence_indices=s.get("source_sentence_indices"),
            source_sentences=s.get("source_sentences"),
        )
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
    """Full pipeline, selectable engine: LangGraph (default) or imperative fallback."""
    if s.pipeline_engine == "langgraph":
        scenes = await asyncio.to_thread(run_visuals_graph, req.text, req.max_scenes)
        return GenerateVisualsResponse(scenes=scenes)
    # Imperative fallback: previous behavior
    raw_scenes = chains.segment_text_into_scenes(req.text, req.max_scenes)
    try:
        global_summary = chains.summarize_global_context(req.text)
    except Exception:
        global_summary = ""
    scenes_with_prompts: List[Scene] = []
    for sdict in raw_scenes:
        prompt = chains.generate_visual_prompt(
            sdict["scene_summary"], global_summary=global_summary
        )
        scenes_with_prompts.append(
            Scene(
                scene_id=sdict["scene_id"],
                scene_summary=sdict["scene_summary"],
                source_sentence_indices=sdict.get("source_sentence_indices"),
                source_sentences=sdict.get("source_sentences"),
                prompt=prompt,
            )
        )

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


@app.post(
    "/generate_visuals_with_audio", response_model=GenerateVisualsWithAudioResponse
)
async def generate_visuals_with_audio(
    req: GenerateVisualsRequest,
) -> GenerateVisualsWithAudioResponse:
    """Run visuals pipeline, then synthesize TTS narration per scene.

    Returns scenes containing image_url plus audio_url and audio_duration_seconds.
    """
    visuals = await generate_visuals(req)

    async def enrich(scene: Scene) -> SceneWithAudio:
        audio_url, duration = await tts_scene_summary(
            scene.scene_id, scene.scene_summary
        )
        return SceneWithAudio(
            scene_id=scene.scene_id,
            scene_summary=scene.scene_summary,
            prompt=scene.prompt,
            image_url=scene.image_url,
            source_sentence_indices=scene.source_sentence_indices,
            source_sentences=scene.source_sentences,
            audio_url=audio_url,
            audio_duration_seconds=duration,
        )

    enriched = await asyncio.gather(*(enrich(scn) for scn in visuals.scenes))
    return GenerateVisualsWithAudioResponse(scenes=list(enriched))


def _sse(event: str, data: dict) -> str:
    return f"event: {event}\n" f"data: {json.dumps(data, ensure_ascii=False)}\n\n"


@app.get("/generate_visuals_events")
async def generate_visuals_events(
    text: str = Query(..., description="Input text to turn into visuals"),
    max_scenes: int = Query(8, ge=1, description="Max scenes to generate"),
):
    """Stream progress updates for visuals generation via Server-Sent Events (SSE).

    Frontend usage:
      const es = new EventSource(`${API_BASE}/generate_visuals_events?text=...&max_scenes=...`)
      es.addEventListener('prompt', (e) => { ... })
      es.addEventListener('image:done', (e) => { ... })
      es.addEventListener('complete', (e) => { ... })
    """

    async def event_gen():
        try:
            logger.info("[SSE] started")
            yield _sse("started", {"message": "begin"})

            # Always run imperative steps here so we can stream progress
            raw_scenes = await asyncio.to_thread(
                chains.segment_text_into_scenes, text, max_scenes
            )
            yield _sse("segmented", {"count": len(raw_scenes)})

            try:
                global_summary = chains.summarize_global_context(text)
            except Exception:
                global_summary = ""
            yield _sse("summarized", {"has_summary": bool(global_summary)})

            # Build prompts (emit each)
            scenes: List[Scene] = []
            for sdict in raw_scenes:
                prompt = chains.generate_visual_prompt(
                    sdict["scene_summary"], global_summary=global_summary
                )
                scn = Scene(
                    scene_id=sdict["scene_id"],
                    scene_summary=sdict["scene_summary"],
                    prompt=prompt,
                    source_sentence_indices=sdict.get("source_sentence_indices"),
                    source_sentences=sdict.get("source_sentences"),
                )
                scenes.append(scn)
                logger.info("[SSE] prompt scene=%s", scn.scene_id)
                yield _sse("prompt", {"scene_id": scn.scene_id, "prompt": scn.prompt})

            # Generate images sequentially for ordered progress
            for scn in scenes:
                logger.info("[SSE] image start scene=%s", scn.scene_id)
                yield _sse("image:started", {"scene_id": scn.scene_id})
                try:
                    url = await asyncio.to_thread(generate_image_url, scn.prompt or "")
                    scn.image_url = url
                    logger.info("[SSE] image done scene=%s", scn.scene_id)
                    yield _sse(
                        "image:done",
                        {"scene_id": scn.scene_id, "image_url": scn.image_url},
                    )
                except BillingCreditError:
                    logger.warning("[SSE] credit error scene=%s", scn.scene_id)
                    yield _sse(
                        "error",
                        {
                            "scene_id": scn.scene_id,
                            "code": 402,
                            "message": "Replicate credit insufficient",
                        },
                    )
                    return
                except Exception as e:
                    logger.exception("[SSE] image error scene=%s", scn.scene_id)
                    yield _sse(
                        "error",
                        {
                            "scene_id": scn.scene_id,
                            "code": 502,
                            "message": f"Image generation failed: {e}",
                        },
                    )
                    return

            payload = [
                {
                    "scene_id": scn.scene_id,
                    "image_url": scn.image_url,
                    "prompt": scn.prompt,
                }
                for scn in scenes
            ]
            yield _sse("complete", {"scenes": payload})
        except Exception as e:
            logger.exception("[SSE] stream error")
            yield _sse("error", {"message": str(e)})

    headers = {"Cache-Control": "no-cache", "X-Accel-Buffering": "no"}
    return StreamingResponse(
        event_gen(), media_type="text/event-stream", headers=headers
    )


@app.post("/visuals_from_image_url", response_model=GenerateVisualsResponse)
async def visuals_from_image_url(
    req: VisualsFromImageURLRequest,
) -> GenerateVisualsResponse:
    """Extract text from image URL via Vision, then run generate_visuals on the extracted text."""
    text = await asyncio.to_thread(
        extract_text_from_image_url, req.image_url, req.prompt_hint
    )
    return await generate_visuals(
        GenerateVisualsRequest(text=text, max_scenes=req.max_scenes)
    )


@app.post("/visuals_from_image_upload", response_model=VisualsFromImageUploadResponse)
async def visuals_from_image_upload(
    file: UploadFile = File(...), max_scenes: int = 8
) -> VisualsFromImageUploadResponse:
    """Accept an uploaded image, OCR it, then run generate_visuals on the extracted text."""
    data = await file.read()
    content_type = file.content_type or "image/png"
    text = await asyncio.to_thread(extract_text_from_image_bytes, content_type, data)
    result = await generate_visuals(
        GenerateVisualsRequest(text=text, max_scenes=max_scenes)
    )
    return VisualsFromImageUploadResponse(extracted_text=text, result=result)


@app.post("/ocr_from_image_url", response_model=OCRTextResponse)
async def ocr_from_image_url(req: OCRFromImageURLRequest) -> OCRTextResponse:
    """Extract text only from a public image URL (no image generation)."""
    text = await asyncio.to_thread(
        extract_text_from_image_url, req.image_url, req.prompt_hint
    )
    return OCRTextResponse(extracted_text=text)


@app.post("/ocr_from_image_upload", response_model=OCRTextResponse)
async def ocr_from_image_upload(file: UploadFile = File(...)) -> OCRTextResponse:
    """Extract text only from an uploaded image file (no image generation)."""
    data = await file.read()
    content_type = file.content_type or "image/png"
    text = await asyncio.to_thread(extract_text_from_image_bytes, content_type, data)
    return OCRTextResponse(extracted_text=text)


# Run from repo root:
#   uv run uvicorn backend.main:app --reload --port 8000

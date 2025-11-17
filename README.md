# Visurai — Visual Learning Copilot

> Turn text into a narrated visual story: scenes, images, and audio — in seconds.

🏆 Built at the Good Vibes Only AI/ML Buildathon @ USC (2025)
🏆 1st place (Context Engineering), Software Engineering Award
---

## Service Link

https://visurai-story-maker.lovable.app/

## Overview

Project Demo : https://drive.google.com/file/d/16_YFVfVJoDPQqLkXXaRXSv_Dyr98bxey/view?usp=sharing

## <img width="1097" height="795" alt="image" src="https://github.com/user-attachments/assets/f395581c-5f30-4da4-bb15-2092082983a7" />

## <img width="1357" height="884" alt="image" src="https://github.com/user-attachments/assets/9aabb1a4-7c41-40da-902a-eb2e16879644" />

<img width="1661" height="737" alt="image" src="https://github.com/user-attachments/assets/b3e0a57f-4a57-4ed3-8f5b-dbcdfdbaebfc" />

Visurai helps dyslexic and visual learners comprehend material by converting text into a sequence of AI-generated images with optional narration.

Paste any text and get:

- A title and segmented scenes that preserve key facts and names
- High-quality images per scene (Flux via Replicate or OpenAI gpt-image-1)
- Per‑scene TTS audio and a single merged audio track with a timeline
- Optional OCR to start from an image instead of text

---

## Features

- Context‑aware scene segmentation and detail‑preserving visual prompts (GPT‑4o)
- Image generation providers:
  - Replicate: Flux 1.1 Pro (default), 16:9 targeting with AR/size fallbacks
  - OpenAI: gpt‑image‑1 with supported sizes and automatic fallback
- Narration:
  - Per‑scene TTS (OpenAI gpt‑4o‑mini‑tts)
  - Single merged MP3 with timestamps (ffmpeg concat demuxer)
- Live progress via SSE (/generate_visuals_events)
- OCR routes: generate from image URL or upload
- Absolute asset URLs using PUBLIC_BASE_URL (e.g., ngrok) for frontend access

---

## Architecture

<img width="1053" height="594" alt="image" src="https://github.com/user-attachments/assets/81160799-431f-4d89-91fb-d1dc3e644b7e" />

<img width="1050" height="587" alt="image" src="https://github.com/user-attachments/assets/5366b2f8-8c8e-459c-9d6b-52724f746053" />

```
Text / Image → OCR (optional)
				↓
Scene segmentation (GPT‑4o)
				↓
Detail‑preserving visual prompts
				↓
Image generation (Replicate Flux or OpenAI gpt‑image‑1)
				↓
TTS per scene → ffmpeg concat → single audio + timeline
				↓
Frontend (React) consumes JSON, images, audio, and SSE
```

---

## Repository Structure

```
good-vibes-only/
├── backend/
│   ├── main.py            # FastAPI app (SSE, OCR, TTS, visuals)
│   ├── image_gen.py       # Image provider adapters (Replicate/OpenAI)
│   ├── tts.py             # OpenAI TTS + ffmpeg merge
│   ├── settings.py        # Pydantic settings + .env loader
│   ├── pyproject.toml     # Backend deps (use uv/pip)
│   └── uv.lock
└── frontend/              # React app that calls the backend
```

---

## Prerequisites

- Python 3.10+ (tested up to 3.13)
- ffmpeg installed (required for merged audio)
  - macOS: `brew install ffmpeg`
- Provider keys as needed:
  - Replicate: `REPLICATE_API_TOKEN`
  - OpenAI: `OPENAI_API_KEY`

---

## Backend — Quick Start (run from repo root)

From the repo root:

```bash
# 1) Install deps (using uv)
uv sync && cd ..

# 2) Create backend/.env with your keys and config (see below)

# 3) Run the API from the repo root
uv run uvicorn backend.main:app --host 0.0.0.0 --port 8000 --reload
```

### backend/.env (example)

```
# LLM
OPENAI_API_KEY=sk-...
LLM_PROVIDER=openai
LLM_MODEL=gpt-4o-mini

# Image provider (replicate | openai)
IMAGE_PROVIDER=replicate
REPLICATE_API_TOKEN=r8_...
REPLICATE_MODEL=black-forest-labs/flux-1.1-pro
REPLICATE_ASPECT_RATIO=16:9

# OpenAI Images (if IMAGE_PROVIDER=openai)
OPENAI_IMAGE_MODEL=gpt-image-1
OPENAI_IMAGE_SIZE=1536x1024   # allowed: 1024x1024, 1024x1536, 1536x1024, auto

# TTS
TTS_PROVIDER=openai
TTS_MODEL=gpt-4o-mini-tts
TTS_VOICE=alloy
TTS_OUTPUT_DIR=/tmp/seequence_audio

# Absolute URLs for frontend (ngrok/domain)
PUBLIC_BASE_URL=https://<your-ngrok-subdomain>.ngrok-free.dev

# CORS (optional – include your frontend origin when using credentials)
CORS_ORIGINS=https://<your-ngrok-subdomain>.ngrok-free.dev
```

### Verify

```bash
# Health
curl -sS http://127.0.0.1:8000/health

# One image (provider-dependent)
curl -sS http://127.0.0.1:8000/generate_image \
	-H "Content-Type: application/json" \
	-d '{
		"prompt": "Clean educational infographic showing 1 AU ≈ 1.496e8 km. Label Earth and Sun. High contrast."
	}'

# Visuals + merged audio
curl -sS http://127.0.0.1:8000/generate_visuals_single_audio \
	-H "Content-Type: application/json" \
	-d '{ "text": "The Sun is a G-type star...", "max_scenes": 5 }'
```

---

## Frontend — Quick Start (pnpm)

Configure your frontend to call the backend base URL (e.g., `PUBLIC_BASE_URL`).

Typical React workflow:

```bash
cd frontend
pnpm install
pnpm dev
```

Ensure your frontend uses absolute URLs from the backend responses (e.g., `image_url`, `audio_url`), which already include the `PUBLIC_BASE_URL` when set.

If your frontend needs an explicit base URL, set it (e.g., Vite):

```bash
# .env.local in frontend (example)
VITE_API_BASE=https://<your-ngrok-subdomain>.ngrok-free.dev
```

---

## Engine Switch: LangGraph vs Imperative

The backend can run either:

- Imperative flow (default): sequential segmentation → prompts → images
- LangGraph flow: graph-based orchestration

Enable LangGraph by setting an env var and restarting the server:

```bash
export PIPELINE_ENGINE=langgraph
uv run uvicorn backend.main:app --host 0.0.0.0 --port 8000 --reload
```

Endpoints are the same (e.g., `POST /generate_visuals`), but execution uses the graph.

---

## API Highlights

- POST `/generate_visuals` → scenes with image URLs and a title
- POST `/generate_visuals_with_audio` → scenes + per‑scene audio URLs + durations
- POST `/generate_visuals_single_audio` → merged `audio_url`, total duration, timeline, scenes
- GET `/generate_visuals_events` → Server‑Sent Events stream for progress
- POST `/visuals_from_image_url` and `/visuals_from_image_upload` → OCR then visuals

---

## API Reference

Below is a concise reference of the backend API: inputs, outputs, and example usage. All JSON responses use UTF‑8 and stable keys. When `PUBLIC_BASE_URL` is configured, media paths (e.g., `/static/...`) are returned as absolute URLs.

### Health

- GET `/health`
  - Response: `{ "status": "ok" }`

### Segment text into scenes

- POST `/segment`
  - Body: `{ text: string, max_scenes?: number }`
  - Response: `{ scenes: Array<{ scene_id: number, scene_summary: string, source_sentence_indices?: number[], source_sentences?: string[] }> }`

### Generate one image (test)

- POST `/generate_image`
  - Body: `{ prompt: string, seed?: number }`
  - Response: `{ image_url: string }` (absolute if `PUBLIC_BASE_URL` set)

### Full pipeline: text → images

- POST `/generate_visuals`
  - Body: `{ text: string, max_scenes?: number }`
  - Response: `{ title?: string, scenes: Array<{ scene_id, scene_summary, prompt, image_url, source_sentence_indices?, source_sentences? }> }`

### Full pipeline + per‑scene TTS

- POST `/generate_visuals_with_audio`
  - Body: `{ text: string, max_scenes?: number }`
  - Response: `{ title?: string, scenes: Array<{ scene_id, scene_summary, prompt, image_url, source_sentence_indices?, source_sentences?, audio_url, audio_duration_seconds }> }`
  - Notes: `audio_url` points to `/static/audio/...`; duration is seconds (float).

### Full pipeline + single merged audio

- POST `/generate_visuals_single_audio`
  - Body: `{ text: string, max_scenes?: number }`
  - Response: `{ title?: string, scenes: Array<{ scene_id, scene_summary, prompt, image_url, source_sentence_indices?, source_sentences? }>, audio_url: string, duration_seconds: number, timeline: Array<{ scene_id: number, start_sec: number, duration_sec: number }> }`
  - Notes: merged MP3 generated with ffmpeg concat demuxer.

### Progress (SSE) — images only

- GET `/generate_visuals_events?text=...&max_scenes=8`
  - Event stream content‑type: `text/event-stream`
  - Events (event name → data JSON):
    - `started` → `{ message: "begin" }`
    - `segmented` → `{ count: number }`
    - `summarized` → `{ has_summary: boolean }`
    - `prompt` → `{ scene_id, prompt }`
    - `image:started` → `{ scene_id }`
    - `image:done` → `{ scene_id, image_url }`
    - `complete` → `{ title?: string, scenes: Array<{ scene_id, scene_summary, prompt, image_url, source_sentence_indices?, source_sentences? }> }`
  - Tip: With ngrok, append `?ngrok-skip-browser-warning=true` to the URL to avoid the interstitial for EventSource.

### Progress (SSE) — images + per‑scene TTS + merged audio

- GET `/generate_visuals_single_audio_events?text=...&max_scenes=8`
  - Events:
    - `started`, `segmented`, `summarized`, `prompt`, `image:started`, `image:done`
    - `tts:started` → `{ scene_id }`
    - `tts:done` → `{ scene_id, audio_url, duration_sec }`
    - `tts:merge_started` → `{ count }`
    - `tts:merge_done` → `{ audio_url, duration_seconds, timeline }`
    - `complete` → `{ title?: string, scenes: Array<{ scene_id, scene_summary, prompt, image_url, source_sentence_indices?, source_sentences? }>, audio_url, duration_seconds, timeline }`

### OCR only (image → text)

- POST `/ocr_from_image_url`
  - Body: `{ image_url: string, prompt_hint?: string }`
  - Response: `{ extracted_text: string }`
- POST `/ocr_from_image_upload` (multipart)
  - Form: `file=@path/to/img`, content‑type `multipart/form-data`
  - Response: `{ extracted_text: string }`

### One‑shot: image → OCR → visuals

- POST `/visuals_from_image_url`
  - Body: `{ image_url: string, max_scenes?: number, prompt_hint?: string }`
  - Response: `{ scenes: [...] }` (same shape as `/generate_visuals`)
- POST `/visuals_from_image_upload` (multipart)
  - Form: `file=@path`, `max_scenes?`
  - Response: `{ extracted_text: string, result: { title?: string, scenes: [...] } }`

### Debug utilities (optional)

- GET `/tts/diag` → `{ mutagen: boolean, tinytag: boolean, tts_output_dir: string }`
- GET `/tts/duration?file=<name>` → `{ file, exists, duration, size }`
- GET `/debug/audio_info?file=<name>` → `{ file, exists, size, mtime, path, public_url, public_base_url }`
- GET `/debug/audios` → `{ count, items: Array<{ file, size, mtime, url }> }` (latest first)
- GET `/debug/images` → `{ count, items: Array<{ file, size, mtime, url }> }` (latest first)
- GET `/debug/storage` → summary of media dirs, counts, and public mounts

---

## Examples

The snippets below assume the API is running at `http://127.0.0.1:8000`. If you exposed it via ngrok, replace with your `PUBLIC_BASE_URL`.

### 1) One image (curl)

```bash
curl -sS http://127.0.0.1:8000/generate_image \
  -H "Content-Type: application/json" \
  -d '{
    "prompt": "Clean educational infographic showing 1 AU ≈ 1.496e8 km. Label Earth and Sun. High contrast.",
    "seed": 42
  }'
```

### 2) Full pipeline (POST)

```bash
curl -sS http://127.0.0.1:8000/generate_visuals \
  -H "Content-Type: application/json" \
  -d '{ "text": "The Sun is a G-type star...", "max_scenes": 5 }'
```

### 3) Full pipeline + per‑scene TTS (POST)

```bash
curl -sS http://127.0.0.1:8000/generate_visuals_with_audio \
  -H "Content-Type: application/json" \
  -d '{ "text": "The Sun is a G-type star...", "max_scenes": 5 }'
```

### 4) Full pipeline + single merged audio (POST)

```bash
curl -sS http://127.0.0.1:8000/generate_visuals_single_audio \
  -H "Content-Type: application/json" \
  -d '{ "text": "The Sun is a G-type star...", "max_scenes": 5 }'
```

### 5) SSE: images only (curl)

```bash
# -N disables buffering to stream events as they arrive
curl -N "http://127.0.0.1:8000/generate_visuals_events?text=The%20Sun%20is%20a%20G-type%20star...&max_scenes=5"
```

### 6) SSE: images + per‑scene TTS + merged audio (curl)

```bash
curl -N "http://127.0.0.1:8000/generate_visuals_single_audio_events?text=The%20Sun%20is%20a%20G-type%20star...&max_scenes=5"
```

### 7) OCR (curl)

```bash
# From a public image URL
curl -sS http://127.0.0.1:8000/ocr_from_image_url \
  -H "Content-Type: application/json" \
  -d '{ "image_url": "https://example.com/page.png", "prompt_hint": "School lecture page" }'

# Upload a local image file
curl -sS -X POST http://127.0.0.1:8000/ocr_from_image_upload \
  -F file=@/path/to/page.png
```

### 8) One‑shot: image → OCR → visuals (curl)

```bash
curl -sS http://127.0.0.1:8000/visuals_from_image_url \
  -H "Content-Type: application/json" \
  -d '{ "image_url": "https://example.com/page.png", "max_scenes": 5 }'

curl -sS -X POST http://127.0.0.1:8000/visuals_from_image_upload \
  -F file=@/path/to/page.png \
  -F max_scenes=5
```

### 9) Debug helpers (curl)

```bash
curl -sS http://127.0.0.1:8000/tts/diag
curl -sS "http://127.0.0.1:8000/tts/duration?file=scene_1_alloy_xxx.mp3"
curl -sS "http://127.0.0.1:8000/debug/audio_info?file=scene_1_alloy_xxx.mp3"
curl -sS http://127.0.0.1:8000/debug/audios
curl -sS http://127.0.0.1:8000/debug/images
curl -sS http://127.0.0.1:8000/debug/storage
```

## Troubleshooting

- Audio fails to load after revisiting a story
  - Make sure `PUBLIC_BASE_URL` points to your current public URL (ngrok URL may change)
  - Store TTS files in a stable directory (`TTS_OUTPUT_DIR`); the backend serves it under `/static/audio`
- OpenAI Images error: invalid size
  - Use one of: `1024x1024`, `1024x1536`, `1536x1024`, or `auto` (see `OPENAI_IMAGE_SIZE`)
- Replicate credit errors
  - 402 Insufficient credit → top up your Replicate account
- Mixed content blocked
  - Use HTTPS for both frontend and backend (ngrok URL is HTTPS)
- CORS
  - Global CORS is enabled; if using credentials, set `CORS_ORIGINS` to your frontend origin

---

## License

MIT License © 2025 Visurai Team

---

Made with care for learners who think in pictures.

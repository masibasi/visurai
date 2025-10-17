# Seequence Backend (FastAPI)

FastAPI backend that turns text into a sequence of AI-generated images using GPT‑4o for scene segmentation/prompting and Flux 1.1 Pro (Replicate) for image generation.

## Quickstart

1. Copy `.env.example` to `.env` and set keys:
   - `OPENAI_API_KEY`
   - `REPLICATE_API_TOKEN`
2. Install deps with uv:
   - `uv sync` # ensures langgraph and other deps are installed
3. Run server:
   - `uv run uvicorn main:app --reload --port 8000`
4. (Optional) Expose via ngrok and configure CORS:
   - Run: `ngrok http 8000` then copy the HTTPS Forwarding URL
   - In `backend/.env` set either:
     - `CORS_ORIGINS=<your-ngrok-url>,http://localhost:5173` (specific URL)
     - or `CORS_ORIGIN_REGEX=^https://[a-z0-9-]+\.ngrok(-free)?\.app$` (any ngrok URL)

## API

- Health

  - `GET /health` → `{ "status": "ok" }`

- Text → Scenes

  - `POST /segment` → `{ scenes: [{ scene_id, scene_summary, source_sentence_indices, source_sentences }] }`
    - Example:
      ```bash
      curl -X POST http://127.0.0.1:8000/segment \
         -H "Content-Type: application/json" \
         -d '{"text":"The Earth orbits the Sun, and the Moon orbits the Earth. Day and night are caused by Earth\'s rotation.","max_scenes":3}'
      ```

- Single Image (test)

  - `POST /generate_image` → `{ image_url }`
    - Example:
      ```bash
      curl -X POST http://127.0.0.1:8000/generate_image \
         -H "Content-Type: application/json" \
         -d '{"prompt":"friendly illustrated earth orbiting sun","seed":42}'
      ```

- Full Pipeline: Text → Images

  - `POST /generate_visuals` → `{ scenes: [{ scene_id, scene_summary, prompt, image_url, source_* }] }`
    - Example:
      ```bash
      curl -X POST http://127.0.0.1:8000/generate_visuals \
         -H "Content-Type: application/json" \
         -d '{"text":"The Earth orbits the Sun, and the Moon orbits the Earth. Day and night are caused by Earth\'s rotation.","max_scenes":3}'
      ```
  - `POST /generate_visuals_with_audio` → same as above, but each scene also has `audio_url` and `audio_duration_seconds` for slide sync.
    - Example:
      ```bash
      curl -X POST http://127.0.0.1:8000/generate_visuals_with_audio \
         -H "Content-Type: application/json" \
         -d '{"text":"A happy cat plays with yarn in a sunny room.","max_scenes":2}'
      ```
      Response (excerpt):
      ```json
      {
        "scenes": [
          {
            "scene_id": 1,
            "scene_summary": "...",
            "prompt": "...",
            "image_url": "https://replicate.delivery/...jpg",
            "audio_url": "/static/audio/scene_1_alloy_1739746570123.wav",
            "audio_duration_seconds": 4.27
          },
          { "scene_id": 2, "audio_url": "/static/audio/...", "audio_duration_seconds": 3.91 }
        ]
      }
      ```
      - The `audio_url` is a path served by this backend. In the frontend, prefix it with your API base URL (e.g., `https://<your-ngrok-domain>`):
        - Browser example: `new Audio(`${API_BASE}${scene.audio_url}`)`
      - Use `audio_duration_seconds` to time each slide to the narration length.

- OCR only (Image → Text)

  - `POST /ocr_from_image_url` → `{ extracted_text }`
    - Body: `{ image_url, prompt_hint? }`
  - `POST /ocr_from_image_upload` (multipart) → `{ extracted_text }`
    - Form fields: `file=@path/to/image.jpg`

- One-shot: Image → Text → Images
  - `POST /visuals_from_image_url` → `{ scenes: [...] }`
    - Body: `{ image_url, max_scenes?, prompt_hint? }`
  - `POST /visuals_from_image_upload` (multipart) → `{ extracted_text, result: { scenes: [...] } }`
    - Form fields: `file=@path/to/image.jpg`, `max_scenes?`

Notes:

- If Replicate credits are insufficient, the API responds with HTTP 402.
- Output image URLs are normalized to publicly accessible delivery URLs from Replicate.

## Notes

- Concurrency for image generation is controlled by `MAX_CONCURRENCY`.
- LLM model defaults to `gpt-4o-mini` and can be changed via `LLM_MODEL`.
- Consistent visual style can be tuned via `STYLE_GUIDE` in `.env`.

## Pipeline engine

- This project can run the full pipeline using a LangGraph graph or the original imperative flow.
- By default, `PIPELINE_ENGINE=langgraph`. To switch back: set `PIPELINE_ENGINE=imperative` in `backend/.env` and restart the server.
- The LangGraph pipeline runs image generation serially for easier debugging. The imperative path uses asyncio to parallelize image generation.

## LangGraph Dev (graph UI)

- Ensure deps installed: `uv sync`
- We expose the compiled graph at `backend.graph:graph` and provide `langgraph.json`.
- Run Dev server:
  ```bash
  uv run langgraph dev --config langgraph.json --port 2024
  ```
- Then open the printed URL (e.g., http://127.0.0.1:2024) to inspect and run nodes:
  - segment → summarize → prompts → images

## Environment

- Required: `OPENAI_API_KEY`, `REPLICATE_API_TOKEN`
- Optional:
  - `STYLE_GUIDE` (global visual tone)
  - `PIPELINE_ENGINE=langgraph|imperative`
  - `CORS_ORIGINS` or `CORS_ORIGIN_REGEX` (use regex for dynamic ngrok URLs)
  - TTS: `TTS_PROVIDER` (default `openai`), `TTS_MODEL` (default `gpt-4o-mini-tts`), `TTS_VOICE` (default `alloy`), `TTS_OUTPUT_DIR` (default `/tmp/seequence_audio`)

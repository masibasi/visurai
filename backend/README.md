# Seequence Backend (FastAPI)

FastAPI backend that turns text into a sequence of AI-generated images using GPT‑4o for scene segmentation/prompting and Flux 1.1 Pro (Replicate) for image generation.

## Quickstart

1. Copy `.env.example` to `.env` and set keys:
   - `OPENAI_API_KEY`
   - `REPLICATE_API_TOKEN`
2. Install deps with uv:
   - `uv sync`
3. Run server:
   - `uv run uvicorn main:app --reload --port 8000`

## API

- `GET /health` → `{ "status": "ok" }`
- `POST /segment` → `{ scenes: [{ scene_id, scene_summary }] }`
- `POST /generate_image` → `{ image_url }`
- `POST /generate_visuals` → `{ scenes: [{ scene_id, scene_summary, prompt, image_url }] }`

## Notes

- Concurrency for image generation is controlled by `MAX_CONCURRENCY`.
- LLM model defaults to `gpt-4o-mini` and can be changed via `LLM_MODEL`.

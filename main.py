"""
Entrypoint for running the FastAPI app from the repository root.

This allows commands like:
  uv run uvicorn main:app --reload --port 8000

which import the app from `backend.main` without needing to `cd backend`.
"""

from backend.main import app  # re-export FastAPI app

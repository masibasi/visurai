"""TTS helpers to generate speech for scene summaries.

Currently uses OpenAI's TTS (gpt-4o-mini-tts) and writes WAV files locally,
returning file URLs the frontend can fetch via the backend's static mount.
"""

from __future__ import annotations

import asyncio
import base64
import logging
import os
import time
import uuid
import wave
from time import sleep
from typing import Optional, Tuple

from openai import OpenAI

from backend.settings import get_settings

_s = get_settings()
logger = logging.getLogger(__name__)


def _write_file(data: bytes, path: str) -> None:
    with open(path, "wb") as f:
        f.write(data)


def _get_audio_duration_seconds(
    path: str, attempts: int = 5, delay_s: float = 0.1
) -> float:
    """Compute audio duration for WAV/MP3 files.

    - For .wav, use the built-in wave module
    - For others (e.g., .mp3), try mutagen if available
    """
    for i in range(max(1, attempts)):
        try:
            if path.lower().endswith(".wav"):
                with wave.open(path, "rb") as w:
                    frames = w.getnframes()
                    rate = w.getframerate()
                    if rate:
                        return frames / float(rate)
            else:
                # Try mutagen first
                try:
                    from mutagen import File as MutagenFile  # type: ignore

                    mf = MutagenFile(path)
                    if mf and mf.info and getattr(mf.info, "length", None):
                        return float(mf.info.length)
                except Exception as e:
                    logger.debug(
                        "mutagen failed for %s (attempt %s): %s", path, i + 1, e
                    )
                # Fallback to tinytag
                try:
                    from tinytag import TinyTag  # type: ignore

                    tag = TinyTag.get(path)
                    if tag and getattr(tag, "duration", None):
                        return float(tag.duration)
                except Exception as e:
                    logger.debug(
                        "tinytag failed for %s (attempt %s): %s", path, i + 1, e
                    )
        except Exception as e:
            logger.debug("duration read error for %s (attempt %s): %s", path, i + 1, e)
        # brief backoff before next attempt
        if i < attempts - 1:
            sleep(delay_s)
    try:
        size = os.path.getsize(path)
    except Exception:
        size = -1
    logger.warning("duration fallback 0.0 for %s (size=%s bytes)", path, size)
    return 0.0


def _sanitize_filename(name: str) -> str:
    return "".join(c if c.isalnum() or c in ("-", "_") else "_" for c in name)[:80]


def _tts_sync(scene_id: int, text: str) -> Tuple[Optional[str], Optional[float]]:
    if not text:
        return None, None
    if _s.tts_provider != "openai":
        return None, None
    if not _s.openai_api_key:
        logger.error("TTS: OPENAI_API_KEY missing; cannot synthesize audio")
        return None, None
    client = OpenAI(api_key=_s.openai_api_key)

    # Prepare output target first (filename includes high-res timestamp + short uuid). Default to mp3.
    ts = time.time_ns()
    short = uuid.uuid4().hex[:6]
    fname = f"scene_{scene_id}_{_sanitize_filename(_s.tts_voice)}_{ts}_{short}.mp3"
    out_path = os.path.join(_s.tts_output_dir, fname)

    # Prefer streaming API to write bytes directly and avoid memory copies
    try:
        with client.audio.speech.with_streaming_response.create(
            model=_s.tts_model,
            voice=_s.tts_voice,
            input=text,
        ) as response:
            response.stream_to_file(out_path)
    except Exception as e:
        logger.warning("TTS streaming failed, falling back to non-streaming: %s", e)
        try:
            resp = client.audio.speech.create(
                model=_s.tts_model,
                voice=_s.tts_voice,
                input=text,
            )
            # Try to obtain raw bytes in a few common SDK shapes
            audio_bytes: Optional[bytes] = None
            if hasattr(resp, "read"):
                audio_bytes = resp.read()
            elif hasattr(resp, "content") and isinstance(
                resp.content, (bytes, bytearray)
            ):
                audio_bytes = bytes(resp.content)
            elif isinstance(resp, (bytes, bytearray)):
                audio_bytes = bytes(resp)
            else:
                content = (
                    getattr(resp, "audio", None) or getattr(resp, "data", None) or None
                )
                b64 = None
                if isinstance(content, dict):
                    b64 = content.get("data") or content.get("b64")
                if b64:
                    audio_bytes = base64.b64decode(b64)
            if not audio_bytes:
                raise RuntimeError("OpenAI TTS returned no audio bytes")
            _write_file(audio_bytes, out_path)
        except Exception as e2:
            logger.error("TTS non-streaming failed: %s", e2)
            return None, None

    duration = _get_audio_duration_seconds(out_path)

    audio_url = f"/static/audio/{fname}"
    return audio_url, duration


async def tts_scene_summary(
    scene_id: int, text: str
) -> Tuple[Optional[str], Optional[float]]:
    """Synthesize speech for a scene summary and return (audio_url, duration_seconds).

    Returns (None, None) on failure so caller can proceed.
    """
    try:
        return await asyncio.to_thread(_tts_sync, scene_id, text)
    except Exception:
        return None, None


def concat_audios_with_timeline(
    files: list[tuple[int, str]],
) -> tuple[str, float, list[dict]]:
    """Concatenate a list of (scene_id, path) mp3 files into one mp3 using ffmpeg.

    Returns (out_path, total_duration_sec, timeline), where timeline is a list of
    dicts: { scene_id, start_sec, duration_sec }.
    Requires ffmpeg available on PATH.
    """
    import shutil
    import subprocess

    if not files:
        raise RuntimeError("No input files to concatenate")

    # Build timeline from individual durations first
    timeline: list[dict] = []
    cursor = 0.0
    for scene_id, path in files:
        dur = _get_audio_duration_seconds(path)
        timeline.append(
            {
                "scene_id": scene_id,
                "start_sec": cursor,
                "duration_sec": dur,
            }
        )
        cursor += dur

    # Ensure ffmpeg is available
    if not shutil.which("ffmpeg"):
        raise RuntimeError(
            "ffmpeg not found on PATH. Install it (e.g., `brew install ffmpeg` on macOS)."
        )

    # Prepare concat list file
    ts = time.time_ns()
    short = uuid.uuid4().hex[:6]
    list_path = os.path.join(_s.tts_output_dir, f"concat_{ts}_{short}.txt")
    with open(list_path, "w", encoding="utf-8") as f:
        for _scene_id, path in files:
            # Safe since our generated paths have no quotes/spaces by design
            f.write(f"file '{path}'\n")

    # Output path
    fname = f"sequence_{ts}_{short}.mp3"
    out_path = os.path.join(_s.tts_output_dir, fname)

    # Run ffmpeg concat demuxer
    cmd = [
        "ffmpeg",
        "-y",
        "-f",
        "concat",
        "-safe",
        "0",
        "-i",
        list_path,
        "-c",
        "copy",
        out_path,
    ]
    proc = subprocess.run(cmd, stdout=subprocess.PIPE, stderr=subprocess.PIPE)
    if proc.returncode != 0:
        stderr = proc.stderr.decode(errors="ignore")
        raise RuntimeError(f"ffmpeg concat failed: {stderr[-4000:]}")

    total = _get_audio_duration_seconds(out_path)
    return out_path, total, timeline

"""LLM chains for scene segmentation and visual prompt generation.

Currently uses OpenAI GPT-4o via langchain-openai based on env settings.
"""
from __future__ import annotations

from typing import List

from langchain_core.output_parsers import StrOutputParser
from langchain_core.prompts import ChatPromptTemplate
from langchain_openai import ChatOpenAI

from .settings import get_settings


def _get_llm() -> ChatOpenAI:
    s = get_settings()
    if s.llm_provider != "openai":
        # For now, only OpenAI is implemented; others can be plugged in later.
        raise ValueError("Only OpenAI provider is supported at the moment")
    if not s.openai_api_key:
        raise RuntimeError("OPENAI_API_KEY is not set in environment")
    return ChatOpenAI(model=s.llm_model, api_key=s.openai_api_key, temperature=0.3)


def segment_text_into_scenes(text: str, max_scenes: int = 8) -> List[dict]:
    """Split the input text into coherent visual scenes.

    Returns a list of dicts with keys: scene_id, scene_summary, source_sentence_indices, source_sentences.
    """
    llm = _get_llm()
    prompt = ChatPromptTemplate.from_messages(
        [
            (
                "system",
                "You are a skilled story editor for visual learners. Split the user's text into at most {max_scenes} clear story beats. Each beat should be a short, concrete scene that is visually depictable. Also, for each scene, list which original sentences (by 1-based index) you used and include their exact text snippets.",
            ),
            (
                "user",
                "Text:\n\n{text}\n\nRespond as a JSON array of objects with fields: scene_id (1-based), scene_summary (<= 30 words), source_sentence_indices (array of 1-based integers), source_sentences (array of strings).",
            ),
        ]
    )
    chain = prompt | llm | StrOutputParser()
    raw = chain.invoke({"text": text, "max_scenes": max_scenes})

    # Be robust to minor formatting issues from the LLM.
    import json

    try:
        data = json.loads(raw)
    except Exception:
        # Try to extract JSON substring
        import re

        match = re.search(r"\[[\s\S]*\]", raw)
        if not match:
            raise ValueError(f"LLM returned non-JSON output: {raw[:200]}")
        data = json.loads(match.group(0))

    scenes: List[dict] = []
    for i, item in enumerate(data, start=1):
        summary = item.get("scene_summary") or item.get("summary") or str(item)
        indices = item.get("source_sentence_indices") or item.get("source_indices") or []
        sentences = item.get("source_sentences") or item.get("sources") or []
        scenes.append(
            {
                "scene_id": i,
                "scene_summary": summary,
                "source_sentence_indices": indices,
                "source_sentences": sentences,
            }
        )
    return scenes[:max_scenes]


def generate_visual_prompt(scene_summary: str) -> str:
    """Turn a scene summary into a detailed, style-consistent visual prompt for Flux."""
    llm = _get_llm()
    prompt = ChatPromptTemplate.from_messages(
        [
            (
                "system",
                "You are a prompt engineer creating concise, concrete prompts for an illustration model (Flux 1.1 Pro). Use a cohesive friendly illustrative style, gentle colors, clear subjects, and avoid text in images.",
            ),
            (
                "user",
                "Create a single-sentence image prompt for this scene, 30-50 words, present tense.\nScene: {scene}\nConstraints: kid-friendly, dyslexia-friendly visuals, consistent character tone; avoid text overlays; include composition cues.",
            ),
        ]
    )
    chain = prompt | llm | StrOutputParser()
    return chain.invoke({"scene": scene_summary}).strip()

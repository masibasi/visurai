"""LLM chains for scene segmentation and visual prompt generation.

Currently uses OpenAI GPT-4o via langchain-openai based on env settings.
"""

from __future__ import annotations

from typing import List, Optional

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


def _extract_key_facts(
    scene_summary: str, source_sentences: List[str], max_facts: int = 6
) -> str:
    """Derive a compact bullet list of key factual details to preserve visual fidelity."""
    llm = _get_llm()
    prompt = ChatPromptTemplate.from_messages(
        [
            (
                "system",
                "Extract the most important concrete facts to preserve in an illustration. Prefer names, dates, locations, quantities, colors, distinctive objects, and relationships.",
            ),
            (
                "user",
                "Scene summary: {scene}\n\nReference snippets (verbatim):\n{references}\n\nReturn {max_facts} bullets maximum. Keep each bullet under 12 words.",
            ),
        ]
    )
    chain = prompt | llm | StrOutputParser()
    refs = "\n".join(source_sentences)
    facts = chain.invoke(
        {"scene": scene_summary, "references": refs, "max_facts": max_facts}
    ).strip()
    return facts


def segment_text_into_scenes(text: str, max_scenes: int = 8) -> List[dict]:
    """Split the input text into coherent visual scenes.

    Returns a list of dicts with keys: scene_id, scene_summary, source_sentence_indices, source_sentences.
    """
    llm = _get_llm()
    prompt = ChatPromptTemplate.from_messages(
        [
            (
                "system",
                "You are a skilled story editor for visual learners. Split the user's text into at most {max_scenes} clear story beats. Each beat should be a short, concrete scene that is visually depictable. Preserve important factual details (names, dates, places, numbers, distinctive objects, colors, and actions). Avoid over-summarizing—retain concrete nouns and attributes that help the illustrator keep accuracy. Also, for each scene, list which original sentences (by 1-based index) you used and include their exact text snippets.",
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
        indices = (
            item.get("source_sentence_indices") or item.get("source_indices") or []
        )
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


def summarize_global_context(text: str, max_chars: int = 400) -> str:
    """Summarize the entire input into a short global context (1–2 sentences)."""
    llm = _get_llm()
    prompt = ChatPromptTemplate.from_messages(
        [
            (
                "system",
                "You write a single concise summary capturing overall narrative, recurring characters, setting, and tone for consistent visuals.",
            ),
            (
                "user",
                "Summarize the following text into 1-2 sentences (hard limit {max_chars} characters) for global visual context.\n\n{text}",
            ),
        ]
    )
    chain = prompt | llm | StrOutputParser()
    out = chain.invoke({"text": text, "max_chars": max_chars}).strip()
    if len(out) > max_chars:
        out = out[: max_chars - 1] + "…"
    return out


def generate_visual_prompt(
    scene_summary: str,
    global_summary: Optional[str] = None,
    style_guide: Optional[str] = None,
    source_sentences: Optional[List[str]] = None,
) -> str:
    """Turn a scene summary into a detailed, style-consistent visual prompt for Flux, with global context and style guide."""
    llm = _get_llm()
    # Pull default style guide from settings if not provided
    s = get_settings()
    effective_style = style_guide or s.style_guide

    prompt = ChatPromptTemplate.from_messages(
        [
            (
                "system",
                "You are a prompt engineer creating concise, concrete prompts for an illustration model (Flux 1.1 Pro). Avoid text in images and watermarks. Keep critical details from the scene summary—names, numbers, locations, distinctive items, colors, and relationships—so the image stays informative.",
            ),
            (
                "user",
                "Create a single-sentence image prompt for this scene (35-60 words, present tense).\n"
                "Global context (for consistency across scenes): {global_context}\n"
                "Style guide: {style_guide}\n"
                "Reference snippets from the original text (verbatim, for factual fidelity):\n{references}\n"
                "Scene: {scene}\n"
                "Constraints: kid-friendly, dyslexia-friendly visuals, consistent characters/props; avoid text overlays; include composition cues; preserve concrete facts and attributes from the scene.",
            ),
        ]
    )
    chain = prompt | llm | StrOutputParser()
    references = "\n".join(source_sentences or [])
    # Try to synthesize key facts to avoid detail loss
    key_facts = None
    if source_sentences:
        try:
            key_facts = _extract_key_facts(scene_summary, source_sentences)
        except Exception:
            key_facts = None
    return chain.invoke(
        {
            "scene": scene_summary,
            "global_context": global_summary or "",
            "style_guide": effective_style or "",
            "references": (
                "Key facts to preserve:\n" + key_facts + "\n\n" if key_facts else ""
            )
            + references,
        }
    ).strip()


def generate_title(text: str, max_chars: int = 80) -> str:
    """Generate a short, engaging textbook-style title for the entire input text.

    The title should be informative, specific, and kid-friendly. Avoid quotes.
    """
    llm = _get_llm()
    prompt = ChatPromptTemplate.from_messages(
        [
            (
                "system",
                "You craft concise, engaging educational titles that summarize the core topic precisely.",
            ),
            (
                "user",
                "Write a short textbook chapter title (max {max_chars} chars) for the following content. Avoid quotes.\n\n{text}",
            ),
        ]
    )
    chain = prompt | llm | StrOutputParser()
    title = chain.invoke({"text": text, "max_chars": max_chars}).strip()
    # sanitize length and remove leading/trailing quotes if any
    if len(title) > max_chars:
        title = title[: max_chars - 1] + "…"
    if title.startswith(('"', "'")) and title.endswith(('"', "'")):
        title = title[1:-1].strip()
    return title

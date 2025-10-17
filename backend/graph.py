"""LangGraph pipeline for Seequence: segment -> summarize -> prompts -> images.

This graph mirrors the imperative flow in main.py but gives us a composable,
observable structure we can extend (e.g., retries, branches, memory).
"""

from __future__ import annotations

from typing import Any, Dict, List

from langgraph.graph import END, StateGraph
from typing_extensions import TypedDict

from . import chains
from .image_gen import generate_image_url
from .models import Scene
from .settings import get_settings


class VisualsState(TypedDict, total=False):
    # Input
    text: str
    max_scenes: int

    # Working
    scenes: List[Dict[str, Any]]
    global_summary: str
    scene_prompts: List[str]

    # Output
    results: List[Scene]


def node_segment(state: VisualsState) -> VisualsState:
    scenes = chains.segment_text_into_scenes(state["text"], state.get("max_scenes", 8))
    state["scenes"] = scenes
    return state


def node_summarize(state: VisualsState) -> VisualsState:
    state["global_summary"] = chains.summarize_global_context(state["text"])
    return state


def node_prompts(state: VisualsState) -> VisualsState:
    scenes = state.get("scenes", [])
    global_summary = state.get("global_summary", "")
    prompts: List[str] = []
    for sdict in scenes:
        prompts.append(
            chains.generate_visual_prompt(
                sdict["scene_summary"], global_summary=global_summary
            )
        )
    state["scene_prompts"] = prompts
    return state


def node_images(state: VisualsState) -> VisualsState:
    scenes = state.get("scenes", [])
    prompts = state.get("scene_prompts", [])
    results: List[Scene] = []
    # Simple sequential loop; main.py uses asyncio for parallelism.
    for sdict, prompt in zip(scenes, prompts):
        try:
            url = generate_image_url(prompt)
        except Exception:
            url = None
        results.append(
            Scene(
                scene_id=sdict["scene_id"],
                scene_summary=sdict["scene_summary"],
                source_sentence_indices=sdict.get("source_sentence_indices"),
                source_sentences=sdict.get("source_sentences"),
                prompt=prompt,
                image_url=url,
            )
        )
    state["results"] = results
    return state


def build_graph() -> StateGraph:
    g = StateGraph(VisualsState)
    g.add_node("segment", node_segment)
    g.add_node("summarize", node_summarize)
    g.add_node("prompts", node_prompts)
    g.add_node("images", node_images)

    g.set_entry_point("segment")
    g.add_edge("segment", "summarize")
    g.add_edge("summarize", "prompts")
    g.add_edge("prompts", "images")
    g.add_edge("images", END)
    return g


def run_visuals_graph(text: str, max_scenes: int = 8) -> List[Scene]:
    graph = build_graph().compile()
    out: VisualsState = graph.invoke({"text": text, "max_scenes": max_scenes})
    return out.get("results", [])


# Expose a compiled graph for `langgraph dev` (module path: backend.graph:graph)
graph = build_graph().compile()

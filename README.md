# 🧩 Seequence
> *Transform text into understanding — one image at a time.*

### 🏆 Built at the **Good Vibes Only AI/ML Buildathon @ USC (2025)**

---

## 🎯 Overview

**Seequence** is an AI-powered web application that helps dyslexic and visual learners comprehend written material through **visual storytelling**.

Instead of reading long passages, users can paste text and instantly receive a sequence of AI-generated images that *illustrate the story or concept*.  
Each image is contextually linked — creating an **“image book”** that teaches through imagination rather than words.

---

## ✨ Key Features

- 🧠 **LLM-powered comprehension** — understands full context and breaks text into semantic “story beats”
- 🎨 **AI image generation** — visualizes each sentence or idea with consistent style and characters
- ⚡ **Instant visual notebook** — all images generated once and displayed seamlessly (no per-line lag)
- ♿ **Accessibility-first design** — supports dyslexic, ADHD, and ESL learners
- 🥽 **Future-ready** — concept extension to **Apple Vision Pro** for immersive learning

---

## 🧰 Tech Stack

| Layer | Technology |
|--------|-------------|
| **Frontend** | [Lovable](https://lovable.ai) (Context Engineering UI Framework) |
| **Backend** | FastAPI + LangChain |
| **LLM** | GPT-4o / Claude 3 (semantic segmentation + prompt generation) |
| **Image Generation** | Flux / NanoBanana / Hugging Face SDXL |
| **Orchestration** | LangChain (→ later A2A agent integration) |
| **Version Control** | GitHub (monorepo with FE + BE) |

---

## 🏗 Architecture

```
User Input (Text)
↓
LLM Context Parser
(Splits text into 5–10 semantic scenes)
↓
Prompt Generator
(Describes each scene visually)
↓
Image Model (Flux / SDXL)
(Creates visual frames)
↓
Lovable Frontend
(Displays “visual notebook”)
```

---

## 📁 Repository Structure

```
seequence/
├── frontend/       # Lovable / React frontend by Josh
├── backend/        # FastAPI + LangChain orchestration by Ji Min
├── docs/           # Pitch deck, screenshots, demo video
├── .gitignore
└── README.md
```

---

## 🚀 Getting Started

### 1️⃣ Clone & Setup
```bash
git clone https://github.com/masibasi/seequence.git
cd seequence/backend
python3 -m venv venv
source venv/bin/activate
pip install -r requirements.txt
```

### 2️⃣ Run Backend
```bash
uvicorn main:app --reload
```

### 3️⃣ Connect Frontend (Lovable)
- Set backend API endpoint in Lovable (e.g., `/generate_visuals`)
- Paste any text → click **Generate Visual Notebook**
- Enjoy your storybook 🎨

---

## 🧩 Team

| Name | Role | Focus |
|------|------|-------|
| Ji Min Lee | Backend / AI Orchestration | LLM pipeline, prompt generation, image synthesis |
| Josh [Last Name] | Frontend / UI | Lovable interface & visualization |
| [3rd Teammate] | XR Integration | Vision Pro immersive learning exploration |

---

## 🧠 Future Directions
- 🔁 Character & style consistency using reference embeddings  
- 🗣️ Text-to-speech narration for multimodal comprehension  
- 🥽 Vision Pro version with spatial story panels  
- 🌐 Chrome extension for real-time article visualization  

---

## 💬 1-Minute Pitch (for judges)
“Reading should be visual, not stressful.  
Seequence transforms any passage into a sequence of AI-generated images that tell the story visually — empowering dyslexic and visual learners to understand through imagination.  
Built with Lovable, LangChain, and Flux, Seequence turns text into understanding — one image at a time.”

---

## 📜 License
MIT License © 2025 Seequence Team

---

**Repo:** [github.com/masibasi/seequence](https://github.com/masibasi/seequence)  
**Demo:** Coming soon — Lovable link

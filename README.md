# Agent Platform

A minimal agent platform with React+Vite frontend and Bun+Hono backend.

## Prerequisites

- **Bun** >= 1.0 ([install](https://bun.sh/docs/installation))
- **Node.js** >= 18 (for frontend tooling)
- **ffmpeg** (optional, for audio transcription)

## Installation

```bash
# Clone the repository
git clone <repository-url>
cd agent-platform

# Install backend dependencies
cd backend
bun install

# Install frontend dependencies
cd ../frontend
npm install
```

## Quick Start

### 1. Configure Environment

```bash
# Backend
cp backend/.env.example backend/.env
# Edit backend/.env and set your API keys

# Frontend
cp frontend/.env.example frontend/.env
```

### 2. Start Backend

```bash
cd backend
bun run dev
```

Backend runs on http://localhost:3001

### 3. Start Frontend

```bash
cd frontend
npm run dev
```

Frontend runs on http://localhost:5173

## Features

- Chat interface with streaming responses
- Agent uses tools (file_read, file_write, file_list)
- Session memory within conversation
- Skills loaded based on keywords
- Conversations saved as Markdown files
- **Image Generation** (Text-to-Image & Image-to-Image)

## Project Structure

```
agent-platform/
├── backend/          # Bun + Hono API server
│   └── src/
│       ├── index.ts           # Entry point
│       ├── routes/chat.ts     # Chat API + SSE
│       ├── services/          # LLM, tools, skills, memory
│       └── agents/loop.ts     # Agentic loop
├── frontend/         # React + Vite
│   └── src/
│       ├── components/        # UI components
│       ├── hooks/             # useStreaming hook
│       └── pages/             # ChatPage
└── data/             # File-based persistence
    ├── config/       # Agent configuration
    ├── skills/       # Skill definitions
    ├── memory/       # Session data
    └── conversations/# Saved conversations
```

## Test Conversation

```
User: Hallo, wer bist du?
-> Agent introduces itself

User: Lies bitte die Datei config/settings.md
-> Agent uses file_read, displays content

User: Schreibe eine kurze E-Mail
-> Agent loads write skill, produces email

User: Generiere ein Bild von einem Sonnenuntergang
-> Agent uses generate_image tool, displays image in chat
```

---

## Image Generation

### Übersicht

Die Plattform unterstützt Bildgenerierung (Text-to-Image) und Bildbearbeitung (Image-to-Image) über konfigurierbare Provider.

### Konfiguration

API-Keys in `backend/.env` setzen:

```env
GOOGLE_AI_API_KEY=AIza...      # Für Google Gemini Imagen
NEBIUS_API_KEY=...             # Für Nebius Flux.1
```

### Unterstützte Provider

| Provider | API Mode | Capabilities | Konfiguriert in |
|----------|----------|--------------|-----------------|
| Google Gemini Imagen | `google_gemini` | text_to_image, image_to_image | `data/config/providers.yaml` |
| Nebius Flux.1 | `openai_images` | text_to_image | `data/config/providers.yaml` |

### Verwendung

**Per Command:**
```
/image Ein Sonnenuntergang über dem Meer
```

**Per Chat (Auto-Erkennung):**
```
Generiere mir ein Bild von einer Katze
Zeichne einen Roboter im Comic-Stil
```

**Bildbearbeitung (nur mit Google Gemini):**
1. Bild hochladen
2. "Verändere das Bild in einen Aquarell-Stil"

### Architektur & Erweiterbarkeit

```
backend/src/services/
├── imageGeneration.ts              # Haupt-Service
└── imageGeneration/adapters/
    ├── google.ts                   # Google Gemini Adapter
    └── openai.ts                   # OpenAI-kompatible APIs
```

**Wichtig:** Die Provider-Implementierung ist **nicht vollständig dynamisch**. Der `ImageGenerationService` enthält eine harte Kopplung an die `api_mode` Werte:

```typescript
// imageGeneration.ts - Switch-Logik
if (apiMode === 'google_gemini') {
  result = await generateWithGoogle(...)
} else if (apiMode === 'openai_images') {
  result = await generateWithOpenAI(...)
}
```

### Was ohne Code-Änderungen funktioniert

- Neue Provider mit **Google Gemini API** → `api_mode: google_gemini`
- Neue Provider mit **OpenAI Images API** (DALL-E, Nebius, etc.) → `api_mode: openai_images`

### Was Code-Änderungen erfordert

Neue Provider mit **anderem API-Format** (z.B. Stability AI, Midjourney) benötigen:

1. **Neuen Adapter** erstellen: `backend/src/services/imageGeneration/adapters/stability.ts`
2. **ApiMode erweitern** in `backend/src/types/providers.ts`:
   ```typescript
   export type ApiMode = 'openai' | 'ollama' | 'google_gemini' | 'openai_images' | 'stability_ai';
   ```
3. **Switch-Case erweitern** in `backend/src/services/imageGeneration.ts`:
   ```typescript
   else if (apiMode === 'stability_ai') {
     result = await generateWithStability(...)
   }
   ```

### Zukünftige Verbesserungen (optional)

- **Adapter-Registry**: Dynamische Registrierung von Adaptern (ähnlich Tool-Registry)
- **Generischer HTTP-Adapter**: Request/Response-Mapping per YAML konfigurierbar
- **Batch-Generierung**: Mehrere Bilder parallel generieren

### Dateien

| Datei | Beschreibung |
|-------|--------------|
| `backend/src/types/providers.ts` | Type-Definitionen (ApiMode, ModelType, etc.) |
| `backend/src/services/imageGeneration.ts` | Haupt-Service |
| `backend/src/services/imageStorage.ts` | Speicherung generierter Bilder |
| `backend/src/tools/api/image-generation.ts` | `generate_image` Tool |
| `backend/src/tools/api/image-edit.ts` | `edit_image` Tool |
| `backend/src/routes/images.ts` | REST API Endpoints |
| `backend/src/commands/handlers.ts` | `/image` Command |
| `data/skills/public/image-generation/` | Auto-Erkennungs-Skill |
| `data/skills/public/image-edit/` | Bildbearbeitungs-Skill |
| `data/config/providers.yaml` | Provider-Konfiguration |
| `data/generated-images/` | Gespeicherte Bilder |
| `frontend/src/components/GeneratedImage.jsx` | Bild-Anzeige im Chat |
| `frontend/src/components/ImageLightbox.jsx` | Vollbild-Ansicht |

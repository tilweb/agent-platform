# Provider-System

Adacor Workplace unterstuetzt die Integration mehrerer KI-Provider und Modelle. Diese Dokumentation beschreibt das Multi-Provider-System, Modell-Konfiguration und die Einrichtung eigener Provider.

## Ueberblick

Das Provider-System verwaltet LLM-Konfigurationen in `data/providers/` (pro Provider ein Verzeichnis mit `provider.yaml` + Logo-Datei, plus `active.yaml` fuer die Modell-Auswahl).

Unterstuetzte Provider: Adacor AI, OpenAI, Anthropic, Ollama, Nebius, Google Gemini und beliebige OpenAI-kompatible APIs.

## Voraussetzungen

Eigene Provider und Modelle sind nur verfuegbar, wenn das Feature-Flag `ALLOW_CUSTOM_PROVIDERS=true` in der `.env`-Datei gesetzt ist. Ohne dieses Flag werden ausschliesslich die geschuetzten Adacor-Modelle angezeigt.

> Adacor-Modelle werden automatisch ueber die Modell-Synchronisierung verwaltet und koennen nicht manuell bearbeitet oder geloescht werden.

## API-Modi

Jeder Provider wird mit einem `api_mode` konfiguriert, der bestimmt, welches API-Protokoll fuer die Kommunikation verwendet wird:

| API-Modus | Beschreibung | Beispiel-Provider |
|-----------|-------------|-------------------|
| `openai` | OpenAI-kompatible Chat Completions API | OpenAI, Adacor AI, Nebius, vLLM |
| `ollama` | Ollama-native API | Lokale Ollama-Instanzen |
| `google_gemini` | Google Generative AI API | Google Gemini |
| `openai_images` | OpenAI Images API (DALL-E) | OpenAI Images |

## Modell-Typen

| Typ | Beschreibung | Verwendung |
|-----|-------------|------------|
| `llm` | Standard-Sprachmodell | Chat, Textgenerierung |
| `vllm` | Vision-faehiges Sprachmodell | Chat mit Bildverstaendnis |
| `tts` | Text-to-Speech | Sprachausgabe |
| `stt` | Speech-to-Text | Transkription |
| `image_gen` | Bildgenerierung | Text-zu-Bild, Bild-zu-Bild |

## Capabilities

Jedes Modell deklariert seine Faehigkeiten ueber ein Array von Capabilities:

| Capability | Beschreibung |
|-----------|-------------|
| `chat` | Standard-Chat-Konversation |
| `function_calling` | Tool-/Funktionsaufrufe (erforderlich fuer Agenten mit Tools) |
| `vision` | Bildverstaendnis und -analyse |
| `speech` | Sprachausgabe (TTS) |
| `transcription` | Spracherkennung (STT) |
| `text_to_image` | Bildgenerierung aus Text |
| `image_to_image` | Bildbearbeitung/-variation |
| `embeddings` | Vektoreinbettungen |

### Erweiterte Capabilities

Zusaetzlich koennen Modelle erweiterte Capabilities definieren, die fuer das Agent-Modell-Matching verwendet werden:

```yaml
extended_capabilities:
  tool_use: true          # Unterstuetzt Tool-/Funktionsaufrufe
  vision: true            # Unterstuetzt Bildverstaendnis
  context_window: 128000  # Kontextfenster in Tokens
  streaming: true         # Unterstuetzt Streaming-Responses
  json_mode: true         # Unterstuetzt JSON-Modus
  max_output_tokens: 4096 # Maximale Ausgabe-Tokens
```

## Security Tiers

Das System berechnet automatisch einen Datensicherheits-Tier basierend auf dem Firmensitz und Standort des Rechenzentrums:

| Tier | Kriterien | Beispiel |
|------|----------|---------|
| **Tier 1** | Deutsches Unternehmen + Deutsches RZ | Adacor AI (Frankfurt) |
| **Tier 2** | EU-Unternehmen + EU-Rechenzentrum | EU-Cloud-Provider |
| **Tier 3** | Globales Unternehmen + EU-Rechenzentrum | OpenAI (EU-Region) |
| **Tier 4** | Globales Unternehmen + Nicht-EU-RZ | OpenAI (US) |

Die Tier-Berechnung basiert auf den Provider-Feldern `company_region` (`germany` | `eu` | `world`) und `datacenter_country` (ISO-Laendercode).

## Aktive Modelle

Fuer jeden Verwendungszweck kann genau ein aktives Modell gesetzt werden:

| Zweck | Beschreibung |
|-------|-------------|
| `chat` | Standard-Chat-Modell |
| `vision` | Modell fuer Bildverstaendnis |
| `tts` | Text-to-Speech-Modell |
| `stt` | Speech-to-Text-Modell |
| `text_to_image` | Modell fuer Bildgenerierung |
| `image_to_image` | Modell fuer Bildbearbeitung |

Die aktiven Modelle werden in `data/providers/active.yaml` gespeichert und koennen ueber die UI oder API geaendert werden.

## Datenmodell

### Provider-Verzeichnis

```
data/providers/
├── active.yaml               Aktive Modell-Auswahl
├── adacor/
│   ├── provider.yaml         Provider-Config + Modelle
│   └── logo.png              Provider-Logo
├── my-ollama/
│   ├── provider.yaml
│   └── logo.png
```

### provider.yaml Struktur

```yaml
id: my-ollama
name: Lokales Ollama
api_mode: ollama
base_url: http://localhost:11434
api_key_env: null
enabled: true
company_region: germany
datacenter_country: DE
models:
  - id: llama3.1:8b
    name: Llama 3.1 8B
    type: llm
    capabilities:
      - chat
      - function_calling
    default: true
    context_length: 128000
    max_tokens: 4096
```

### active.yaml Struktur

```yaml
chat:
  provider_id: adacor
  model_id: gpt-4o
vision:
  provider_id: adacor
  model_id: gpt-4o
tts:
  provider_id: null
  model_id: null
stt:
  provider_id: null
  model_id: null
text_to_image:
  provider_id: null
  model_id: null
image_to_image:
  provider_id: null
  model_id: null
```

---

## Provider einrichten

### Schritt 1: Provider anlegen

Navigiere zu **Einstellungen** > **KI-Modelle** und klicke auf **Provider hinzufuegen**.

| Feld | Beschreibung | Beispiel |
|------|-------------|---------|
| **Name** | Anzeigename des Providers | `Mein Ollama Server` |
| **API-Modus** | Kommunikationsprotokoll | `ollama` |
| **Base URL** | Basis-URL der API | `http://localhost:11434` |
| **API-Key Variable** | Umgebungsvariable fuer den API-Key | `MY_PROVIDER_API_KEY` |

> Der API-Key wird **nicht** direkt in der Konfiguration gespeichert, sondern als Referenz auf eine Umgebungsvariable. Setze den tatsaechlichen Key in deiner `.env`-Datei.

#### API-Modus waehlen

- **OpenAI**: Fuer alle OpenAI-kompatiblen APIs (OpenAI, vLLM, LiteLLM, Azure OpenAI, etc.)
- **Ollama**: Fuer lokale Ollama-Instanzen
- **Google Gemini**: Fuer Google Generative AI

#### Optionale Felder

| Feld | Beschreibung |
|------|-------------|
| **Firmensitz** | Region des Anbieters (`germany`, `eu`, `world`) — bestimmt den Security Tier |
| **Rechenzentrum** | ISO-Laendercode des RZ-Standorts (z.B. `DE`, `US`) |

### Schritt 2: Modelle hinzufuegen

Nach dem Erstellen des Providers koennen Modelle hinzugefuegt werden.

#### Pflichtfelder

| Feld | Beschreibung | Beispiel |
|------|-------------|---------|
| **ID** | Technische Modell-ID | `llama3.1:70b` |
| **Name** | Anzeigename | `Llama 3.1 70B` |
| **Typ** | Modell-Typ | `llm` |
| **Capabilities** | Faehigkeiten | `["chat", "function_calling"]` |

#### Optionale Felder

| Feld | Beschreibung |
|------|-------------|
| **Kontextlaenge** | Maximale Kontextlaenge in Tokens |
| **Max Tokens** | Maximale Ausgabe-Tokens |
| **Default** | Als Standard-Modell des Providers markieren |
| **Base URL** | Provider-Base-URL fuer dieses Modell ueberschreiben |

Alternativ kann ueber **Verfuegbare Modelle laden** die vom Provider angebotenen Modelle aufgelistet und ausgewaehlt werden (funktioniert fuer OpenAI- und Ollama-APIs).

### Schritt 3: Capabilities konfigurieren

```
Chat-Modell (z.B. GPT-4, Llama):
  chat, function_calling

Vision-Modell (z.B. GPT-4o, Llama 3.2 Vision):
  chat, function_calling, vision

TTS-Modell (z.B. OpenAI TTS):
  speech

STT-Modell (z.B. Whisper):
  transcription

Bild-Modell (z.B. DALL-E, Flux):
  text_to_image, image_to_image (optional)
```

> **Wichtig:** `function_calling` nur setzen, wenn das Modell dies tatsaechlich unterstuetzt. Agenten mit Tools benoetigen diese Capability und koennen mit Modellen ohne Tool-Unterstuetzung nicht korrekt arbeiten.

### Schritt 4: Aktives Modell setzen

1. **Einstellungen** > **KI-Modelle**
2. Unter **Aktive Modelle** den Zweck waehlen (Chat, Vision, TTS, etc.)
3. Provider und Modell auswaehlen
4. Speichern

> Beim Wechsel des Chat-Modells wird der LLM-Service automatisch neu geladen. Laufende Chats verwenden weiterhin das Modell, mit dem sie gestartet wurden.

### Schritt 5: Verbindung testen

Der **Verbindung testen**-Button prueft:

- Erreichbarkeit der API
- Gueltigkeit des API-Keys
- Verfuegbarkeit des Standard-Modells
- Antwortzeit (Latenz)

## Beispiel: Ollama lokal

```
Provider:
  Name:      Lokales Ollama
  API-Modus: ollama
  Base URL:  http://localhost:11434
  API-Key:   (leer)

Modell:
  ID:           llama3.1:8b
  Name:         Llama 3.1 8B
  Typ:          llm
  Capabilities: chat, function_calling
```

## Beispiel: OpenAI-kompatibler Server

```
Provider:
  Name:      vLLM Server
  API-Modus: openai
  Base URL:  https://my-vllm-server.example.com/v1
  API-Key:   VLLM_API_KEY  (Variable in .env)

Modell:
  ID:           meta-llama/Meta-Llama-3.1-70B-Instruct
  Name:         Llama 3.1 70B (vLLM)
  Typ:          llm
  Capabilities: chat, function_calling
```

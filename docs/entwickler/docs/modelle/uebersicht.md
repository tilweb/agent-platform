# Custom KI-Modelle

Adacor Workplace unterstützt die Integration eigener KI-Modelle und Provider neben den vorinstallierten Adacor-Modellen. Diese Dokumentation beschreibt das Provider-System, die unterstützten API-Modi und die Konfiguration eigener Modelle.

## Voraussetzungen

Eigene Provider und Modelle sind nur verfügbar, wenn das Feature-Flag `ALLOW_CUSTOM_PROVIDERS=true` in der `.env`-Datei gesetzt ist. Ohne dieses Flag werden ausschließlich die geschützten Adacor-Modelle angezeigt.

> [!info]
> Adacor-Modelle werden automatisch über die Modell-Synchronisierung verwaltet und können nicht manuell bearbeitet oder gelöscht werden.

## API-Modi

Jeder Provider wird mit einem `api_mode` konfiguriert, der bestimmt, welches API-Protokoll für die Kommunikation verwendet wird:

| API-Modus | Beschreibung | Beispiel-Provider |
|-----------|-------------|-------------------|
| `openai` | OpenAI-kompatible Chat Completions API | OpenAI, Adacor AI, Nebius, vLLM |
| `ollama` | Ollama-native API | Lokale Ollama-Instanzen |
| `google_gemini` | Google Generative AI API | Google Gemini |
| `openai_images` | OpenAI Images API (DALL-E) | OpenAI Images |

## Modell-Typen

Modelle werden nach ihrem Typ klassifiziert:

| Typ | Beschreibung | Verwendung |
|-----|-------------|------------|
| `llm` | Standard-Sprachmodell | Chat, Textgenerierung |
| `vllm` | Vision-fähiges Sprachmodell | Chat mit Bildverständnis |
| `tts` | Text-to-Speech | Sprachausgabe |
| `stt` | Speech-to-Text | Transkription |
| `image_gen` | Bildgenerierung | Text-zu-Bild, Bild-zu-Bild |

## Capabilities

Jedes Modell deklariert seine Fähigkeiten über ein Array von Capabilities:

| Capability | Beschreibung |
|-----------|-------------|
| `chat` | Standard-Chat-Konversation |
| `function_calling` | Tool-/Funktionsaufrufe (erforderlich für Agenten mit Tools) |
| `vision` | Bildverständnis und -analyse |
| `speech` | Sprachausgabe (TTS) |
| `transcription` | Spracherkennung (STT) |
| `text_to_image` | Bildgenerierung aus Text |
| `image_to_image` | Bildbearbeitung/-variation |
| `embeddings` | Vektoreinbettungen |

### Erweiterte Capabilities

Zusätzlich können Modelle erweiterte Capabilities definieren, die für das Agent-Modell-Matching verwendet werden:

```yaml
extended_capabilities:
  tool_use: true          # Unterstützt Tool-/Funktionsaufrufe
  vision: true            # Unterstützt Bildverständnis
  context_window: 128000  # Kontextfenster in Tokens
  streaming: true         # Unterstützt Streaming-Responses
  json_mode: true         # Unterstützt JSON-Modus
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

Die Tier-Berechnung basiert auf den Provider-Feldern `company_region` (`germany` | `eu` | `world`) und `datacenter_country` (ISO-Ländercode).

## Aktive Modelle

Für jeden Verwendungszweck kann genau ein aktives Modell gesetzt werden:

| Zweck | Beschreibung |
|-------|-------------|
| `chat` | Standard-Chat-Modell |
| `vision` | Modell für Bildverständnis |
| `tts` | Text-to-Speech-Modell |
| `stt` | Speech-to-Text-Modell |
| `text_to_image` | Modell für Bildgenerierung |
| `image_to_image` | Modell für Bildbearbeitung |

Die aktiven Modelle werden in der `providers.yaml` unter dem `active`-Schlüssel gespeichert und können über die UI oder API geändert werden.

# Provider einrichten

Diese Anleitung beschreibt Schritt für Schritt, wie Sie einen eigenen KI-Provider in Adacor Workplace einrichten.

## Voraussetzungen

- Admin-Rechte in der Plattform
- `ALLOW_CUSTOM_PROVIDERS=true` in der `.env`-Datei
- Zugang zur API des gewünschten Providers (URL + ggf. API-Key)

## Schritt 1: Provider anlegen

Navigieren Sie zu **Einstellungen** > **KI-Modelle** und klicken Sie auf **Provider hinzufügen**.

Geben Sie die folgenden Informationen ein:

| Feld | Beschreibung | Beispiel |
|------|-------------|---------|
| **Name** | Anzeigename des Providers | `Mein Ollama Server` |
| **API-Modus** | Kommunikationsprotokoll | `ollama` |
| **Base URL** | Basis-URL der API | `http://localhost:11434` |
| **API-Key Variable** | Umgebungsvariable für den API-Key | `MY_PROVIDER_API_KEY` |

> [!tip]
> Der API-Key wird **nicht** direkt in der Konfiguration gespeichert, sondern als Referenz auf eine Umgebungsvariable. Setzen Sie den tatsächlichen Key in Ihrer `.env`-Datei.

### API-Modus wählen

- **OpenAI**: Für alle OpenAI-kompatiblen APIs (OpenAI, vLLM, LiteLLM, Azure OpenAI, etc.)
- **Ollama**: Für lokale Ollama-Instanzen
- **Google Gemini**: Für Google Generative AI

### Optionale Felder

| Feld | Beschreibung |
|------|-------------|
| **Firmensitz** | Region des Anbieters (`germany`, `eu`, `world`) — bestimmt den Security Tier |
| **Rechenzentrum** | ISO-Ländercode des RZ-Standorts (z.B. `DE`, `US`) |

## Schritt 2: Modelle hinzufügen

Nach dem Erstellen des Providers können Sie Modelle hinzufügen. Klicken Sie auf **Modell hinzufügen** beim jeweiligen Provider.

### Pflichtfelder

| Feld | Beschreibung | Beispiel |
|------|-------------|---------|
| **ID** | Technische Modell-ID (wie vom Provider erwartet) | `llama3.1:70b` |
| **Name** | Anzeigename | `Llama 3.1 70B` |
| **Typ** | Modell-Typ | `llm` |
| **Capabilities** | Fähigkeiten des Modells | `["chat", "function_calling"]` |

### Optionale Felder

| Feld | Beschreibung |
|------|-------------|
| **Kontextlänge** | Maximale Kontextlänge in Tokens |
| **Max Tokens** | Maximale Ausgabe-Tokens |
| **Default** | Als Standard-Modell des Providers markieren |
| **Base URL** | Provider-Base-URL für dieses Modell überschreiben |

### Verfügbare Modelle abfragen

Alternativ können Sie über **Verfügbare Modelle laden** die vom Provider angebotenen Modelle auflisten und auswählen. Dies funktioniert für OpenAI- und Ollama-APIs.

## Schritt 3: Capabilities konfigurieren

Wählen Sie die Capabilities passend zum Modell:

```
Chat-Modell (z.B. GPT-4, Llama):
  ✓ chat
  ✓ function_calling  (wenn Tool-Unterstützung vorhanden)

Vision-Modell (z.B. GPT-4o, Llama 3.2 Vision):
  ✓ chat
  ✓ function_calling
  ✓ vision

TTS-Modell (z.B. OpenAI TTS):
  ✓ speech

STT-Modell (z.B. Whisper):
  ✓ transcription

Bild-Modell (z.B. DALL-E, Flux):
  ✓ text_to_image
  ✓ image_to_image  (optional)
```

> [!warning]
> Setzen Sie `function_calling` nur, wenn das Modell dies tatsächlich unterstützt. Agenten mit Tools benötigen diese Capability und können mit Modellen ohne Tool-Unterstützung nicht korrekt arbeiten.

## Schritt 4: Aktives Modell setzen

Nachdem der Provider und die Modelle eingerichtet sind, können Sie ein Modell als aktiv setzen:

1. Navigieren Sie zu **Einstellungen** > **KI-Modelle**
2. Wählen Sie unter **Aktive Modelle** den Zweck (Chat, Vision, TTS, etc.)
3. Wählen Sie Provider und Modell aus
4. Speichern Sie die Auswahl

> [!info]
> Beim Wechsel des Chat-Modells wird der LLM-Service automatisch neu geladen. Laufende Chats verwenden weiterhin das Modell, mit dem sie gestartet wurden.

## Schritt 5: Verbindung testen

Testen Sie die Verbindung zum Provider über den **Verbindung testen**-Button. Der Test prüft:

- Erreichbarkeit der API
- Gültigkeit des API-Keys
- Verfügbarkeit des Standard-Modells
- Antwortzeit (Latenz)

## Beispiel: Ollama lokal einrichten

```
Provider:
  Name:      Lokales Ollama
  API-Modus: ollama
  Base URL:  http://localhost:11434
  API-Key:   (leer — Ollama benötigt keinen Key)

Modell:
  ID:           llama3.1:8b
  Name:         Llama 3.1 8B
  Typ:          llm
  Capabilities: chat, function_calling
```

## Beispiel: OpenAI-kompatiblen Server einrichten

```
Provider:
  Name:      vLLM Server
  API-Modus: openai
  Base URL:  https://my-vllm-server.example.com/v1
  API-Key:   VLLM_API_KEY  (Variable in .env setzen)

Modell:
  ID:           meta-llama/Meta-Llama-3.1-70B-Instruct
  Name:         Llama 3.1 70B (vLLM)
  Typ:          llm
  Capabilities: chat, function_calling
```

# API-Referenz: Provider & Modelle

Alle Provider-Endpoints erfordern Authentifizierung. Management-Endpoints (POST, PUT, DELETE) erfordern zusätzlich Admin-Rechte.

## Provider-Endpoints

### Alle Provider auflisten

```
GET /api/providers
```

Gibt alle konfigurierten Provider zurück. Bei `ALLOW_CUSTOM_PROVIDERS=false` werden nur geschützte (Adacor-)Provider angezeigt.

**Response:**

```json
{
  "providers": [
    {
      "id": "adacor",
      "name": "Adacor AI",
      "api_mode": "openai",
      "base_url": "https://ai.adacor.com/v1",
      "api_key_env": "ADACOR_AI_API_KEY",
      "enabled": true,
      "protected": true,
      "company_region": "germany",
      "datacenter_country": "DE",
      "models": [...]
    }
  ]
}
```

### Provider erstellen

```
POST /api/providers
```

Erstellt einen neuen Provider. Blockiert wenn `ALLOW_CUSTOM_PROVIDERS=false`.

**Request Body:**

```json
{
  "name": "Mein Provider",
  "api_mode": "openai",
  "base_url": "https://api.example.com/v1",
  "api_key_env": "MY_API_KEY",
  "enabled": true,
  "company_region": "eu",
  "datacenter_country": "DE"
}
```

| Feld | Typ | Pflicht | Beschreibung |
|------|-----|---------|-------------|
| `name` | string | Ja | Anzeigename |
| `api_mode` | string | Ja | `openai`, `ollama`, `google_gemini`, `openai_images` |
| `base_url` | string | Ja | Basis-URL der API |
| `api_key_env` | string | Nein | Name der Umgebungsvariable für den API-Key |
| `enabled` | boolean | Nein | Provider aktiviert (Standard: `true`) |
| `company_region` | string | Nein | `germany`, `eu`, `world` |
| `datacenter_country` | string | Nein | ISO-Ländercode (z.B. `DE`, `US`) |

### Provider abrufen

```
GET /api/providers/:id
```

### Provider aktualisieren

```
PUT /api/providers/:id
```

**Request Body:** Beliebige Felder aus der Provider-Erstellung (alle optional).

### Provider löschen

```
DELETE /api/providers/:id
```

Löscht den Provider und alle zugehörigen Modelle. Der LLM-Service wird automatisch neu geladen.

> Geschützte Provider (`protected: true`) können nicht gelöscht werden.

---

## Modell-Endpoints

### Modell hinzufügen

```
POST /api/providers/:id/models
```

Fügt ein Modell zu einem Provider hinzu. Blockiert für Adacor-Provider (sync-only) und bei `ALLOW_CUSTOM_PROVIDERS=false`.

**Request Body:**

```json
{
  "id": "llama3.1:8b",
  "name": "Llama 3.1 8B",
  "type": "llm",
  "capabilities": ["chat", "function_calling"],
  "default": false,
  "context_length": 128000,
  "max_tokens": 4096
}
```

| Feld | Typ | Pflicht | Beschreibung |
|------|-----|---------|-------------|
| `id` | string | Ja | Technische Modell-ID |
| `name` | string | Ja | Anzeigename |
| `type` | string | Ja | `llm`, `vllm`, `tts`, `stt`, `image_gen` |
| `capabilities` | string[] | Ja | Array aus Capabilities |
| `default` | boolean | Nein | Als Standard-Modell markieren |
| `context_length` | number | Nein | Kontextfenster in Tokens |
| `max_tokens` | number | Nein | Max. Ausgabe-Tokens |
| `base_url` | string | Nein | Override der Provider-Base-URL |
| `extended_capabilities` | object | Nein | Erweiterte Capabilities |

### Modell aktualisieren

```
PUT /api/providers/:id/models/:modelId
```

> Das `enabled`-Feld wird bei Updates ignoriert — es wird ausschließlich über die Modell-Synchronisierung gesteuert.

### Modell löschen

```
DELETE /api/providers/:id/models/:modelId
```

### Verfügbare Modelle abfragen

```
GET /api/providers/:id/models/available
```

Listet alle vom Provider angebotenen Modell-IDs auf. Funktioniert für OpenAI- und Ollama-APIs.

**Response:**

```json
{
  "models": ["llama3.1:8b", "llama3.1:70b", "codellama:13b"]
}
```

---

## Aktive Modelle

### Aktive Auswahl abrufen

```
GET /api/providers/active
```

**Response:**

```json
{
  "active": {
    "chat": { "provider_id": "adacor", "model_id": "gpt-4o" },
    "vision": { "provider_id": "adacor", "model_id": "gpt-4o" },
    "tts": { "provider_id": null, "model_id": null },
    "stt": { "provider_id": null, "model_id": null },
    "text_to_image": { "provider_id": null, "model_id": null },
    "image_to_image": { "provider_id": null, "model_id": null }
  }
}
```

### Aktives Modell setzen

```
PUT /api/providers/active/:purpose
```

| Purpose | Beschreibung |
|---------|-------------|
| `chat` | Standard-Chat-Modell |
| `vision` | Bildverständnis |
| `tts` | Text-to-Speech |
| `stt` | Speech-to-Text |
| `text_to_image` | Bildgenerierung |
| `image_to_image` | Bildbearbeitung |

**Request Body:**

```json
{
  "provider_id": "my-provider",
  "model_id": "llama3.1:70b"
}
```

---

## Verbindungstest

### Provider-Verbindung testen

```
POST /api/providers/:id/test
```

Testet die Verbindung zum Provider mit dem Standard-Modell.

**Response:**

```json
{
  "success": true,
  "message": "Verbindung erfolgreich",
  "latency_ms": 145,
  "models_found": 12
}
```

---

## Konfiguration

### Provider-Config abrufen

```
GET /api/providers/config
```

Gibt die Feature-Flags für die Frontend-Konfiguration zurück.

**Response:**

```json
{
  "allowCustomProviders": true,
  "modelSyncConfigured": true
}
```

### Adacor-Modelle synchronisieren

```
POST /api/providers/adacor/sync
```

Löst eine manuelle Synchronisierung der Adacor-Modelle aus. Erfordert konfigurierte `ADACOR_AI_API_BASE` und `ADACOR_AI_MODELS_PATH`.

**Response:**

```json
{
  "result": {
    "added": 2,
    "updated": 5,
    "deactivated": 1,
    "reactivated": 0,
    "unchanged": 10,
    "timestamp": "2026-02-23T10:30:00.000Z"
  }
}
```

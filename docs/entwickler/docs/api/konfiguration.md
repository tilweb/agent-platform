# Plugin-Konfiguration & Secrets

Plugins benötigen Konfigurationswerte (z.B. OAuth Client ID/Secret), die von Admins über die UI eingegeben werden. Diese werden verschlüsselt gespeichert und über das SDK abgerufen.

## Konfigurationsfluss

```
Admin-UI → PUT /api/plugins/:id/config → configStorage.save()
  → data/connections/providers/{id}/credentials.yaml (verschlüsselt)

Plugin-Code → resolveOAuthConfig(id) → configStorage.load()
  → Credentials entschlüsselt zurückgeben
```

## resolveOAuthConfig

Die zentrale Funktion zum Abrufen der vollständigen OAuth-Konfiguration:

```typescript
import { resolveOAuthConfig } from '@platform/sdk';

const config = await resolveOAuthConfig('mein-connector');
// → { authorizationUrl, tokenUrl, clientId, clientSecret, scopes, ... }
```

### Was passiert intern?

1. Liest statische OAuth-URLs und Scopes aus `pluginRegistry.getManifest(pluginId).connector.oauth`
2. Liest dynamische Credentials (`clientId`, `clientSecret`) aus dem verschlüsselten Config-Store
3. Kombiniert beides zu einer vollständigen `OAuth2Config`
4. Wirft einen Fehler wenn Manifest oder Credentials fehlen

### OAuth2Config

```typescript
interface OAuth2Config {
  authorizationUrl: string;
  tokenUrl: string;
  clientId: string;
  clientSecret: string;
  scopes: string[];
  additionalAuthParams?: Record<string, string>;
  additionalTokenParams?: Record<string, string>;
}
```

### Fehler

| Fehler | Ursache |
|--------|---------|
| `Plugin manifest not loaded` | Plugin-ID ungültig oder Manifest fehlt |
| `OAuth credentials not configured` | Admin hat Client ID/Secret nicht eingetragen |
| `Encryption not configured` | `CONNECTION_ENCRYPTION_KEY` fehlt in `.env` |

## resolvePluginConfig

Für den Zugriff auf beliebige Plugin-Konfigurationswerte (nicht nur OAuth):

```typescript
import { resolvePluginConfig } from '@platform/sdk';

const config = await resolvePluginConfig('mein-connector');
// → { clientId: "abc123", clientSecret: "xyz789", ... }
```

Secrets werden automatisch entschlüsselt.

## Verschlüsselung

### Algorithmus

- **AES-256-GCM** (Authenticated Encryption)
- Jeder verschlüsselte Wert enthält: IV + Auth-Tag + Ciphertext
- Schlüssel: `CONNECTION_ENCRYPTION_KEY` Umgebungsvariable (64 hex chars = 256 bit)

### Welche Felder werden verschlüsselt?

Nur Felder mit `secret: true` im `configSchema` des Manifests:

```yaml
configSchema:
  - key: clientId
    type: string
    required: true        # → wird im Klartext gespeichert

  - key: clientSecret
    type: string
    secret: true          # → wird AES-256-GCM verschlüsselt
    required: true
```

### Schlüssel generieren

```bash
openssl rand -hex 32
```

Den generierten Wert als `CONNECTION_ENCRYPTION_KEY` in die `.env`-Datei eintragen.

## Credential-Modi

Im Manifest konfiguriert unter `connector.credentialMode`:

### company (Standard)

Ein Satz Credentials für alle User. Admin konfiguriert einmalig, alle User nutzen dieselben OAuth-Zugangsdaten.

```yaml
connector:
  credentialMode: company
```

### user

Jeder User hat eigene Credentials. Jeder User muss seine eigene OAuth-App registrieren.

```yaml
connector:
  credentialMode: user
```

### both

User-Credentials mit Fallback auf Company-Credentials:

```yaml
connector:
  credentialMode: both
```

Bei `both` wird zuerst nach User-spezifischen Credentials gesucht. Existieren keine, werden die Company-Credentials verwendet.

## Speicherort

Credentials werden pro Plugin in dessen Verzeichnis gespeichert:

```
data/connections/providers/
├── confluence/
│   └── credentials.yaml      ← Credentials für Confluence
├── google-drive/
│   └── credentials.yaml      ← Credentials für Google Drive
└── pipedrive/
    └── credentials.yaml       ← Credentials für Pipedrive
```

> [!warning] Backup
> Die `credentials.yaml`-Dateien unter `data/connections/providers/` enthalten verschlüsselte Secrets. Ohne den `CONNECTION_ENCRYPTION_KEY` sind sie nicht entschlüsselbar. Beides zusammen sichern.

## Migration

### ENV → Config-Store

Bestehende OAuth-Credentials aus Umgebungsvariablen (z.B. `CONFLUENCE_CLIENT_ID`) werden beim ersten Start automatisch in den Config-Store migriert. Die ENV-Variablen können danach entfernt werden.

### Alter Pfad → Neuer Pfad

Config-Dateien unter den alten Pfaden (`data/plugins/configs/` und `data/config/plugins/`) werden automatisch nach `data/connections/providers/{id}/credentials.yaml` migriert. Bestehende Dateien am neuen Ort werden nicht überschrieben.

## Fehlerbehebung

| Symptom | Ursache | Lösung |
|---------|---------|--------|
| "OAuth credentials not configured" | Admin hat Credentials nicht eingetragen | Admin-UI → Verbindungen → Konfigurieren |
| "Encryption not configured" | `CONNECTION_ENCRYPTION_KEY` fehlt | In `.env` setzen: `openssl rand -hex 32` |
| Credentials nach Neustart weg | `data/connections/providers/` nicht persistent | Docker: Volume mounten |
| "Cannot decrypt" | Anderer Encryption Key | Key muss identisch mit dem bei der Speicherung sein |

# Plugin-Registry API

Das Plugin-System stellt zwei Registries bereit: die `pluginRegistry` für Plugin-Manifeste und die `connectionRegistry` für Connection-Provider.

## Import

```typescript
import { connectionRegistry, pluginRegistry } from '@platform/sdk';
```

## connectionRegistry

Verwaltet alle registrierten Connection-Provider und deren Tokens.

### Methoden

| Methode | Return | Beschreibung |
|---------|--------|-------------|
| `.register(provider)` | `void` | Registriert Provider + Tools |
| `.get(id)` | `ConnectionProvider \| undefined` | Provider nach ID |
| `.has(id)` | `boolean` | Existiert der Provider? |
| `.getTokens(userId, providerId)` | `Promise<TokenSet \| null>` | Tokens holen (auto-refresh) |
| `.getAll()` | `ConnectionProvider[]` | Alle registrierten Provider |
| `.getIds()` | `string[]` | Alle registrierten IDs |

### getTokens — Auto-Refresh

`getTokens()` prüft automatisch ob der Token abgelaufen ist und refresht ihn bei Bedarf:

```typescript
const tokens = await connectionRegistry.getTokens(context.userId, providerId);
if (!tokens) {
  return 'Error: Nicht verbunden.';
}
// tokens.accessToken ist garantiert gültig (oder null wenn Refresh fehlschlug)
```

### register

Registriert einen Provider und alle seine Tools im globalen Tool-Registry:

```typescript
// Wird vom Plugin-Loader aufgerufen — normalerweise nicht manuell
connectionRegistry.register(provider);
```

Beim Registrieren werden:
1. Der Provider in der Registry gespeichert
2. Alle Tools aus `provider.getTools()` im globalen Tool-Registry registriert
3. Ein Log-Eintrag geschrieben: `Registered connection provider: <id>`

## pluginRegistry

Verwaltet Plugin-Manifeste und deren Aktivierungsstatus.

### Methoden

| Methode | Return | Beschreibung |
|---------|--------|-------------|
| `.getManifest(id)` | `PluginManifest \| undefined` | Manifest nach Plugin-ID |
| `.getAll()` | `PluginManifest[]` | Alle registrierten Manifeste |
| `.isEnabled(id)` | `boolean` | Plugin aktiviert? |

### Verwendung in Plugins

Die `pluginRegistry` wird hauptsächlich von `resolveOAuthConfig()` intern genutzt, um OAuth-URLs aus dem Manifest zu lesen:

```typescript
// Intern in resolveOAuthConfig():
const manifest = pluginRegistry.getManifest(pluginId);
const oauth = manifest.connector.oauth;
// → authorizationUrl, tokenUrl, scopes, etc.
```

## Plugin Admin-API (HTTP-Endpoints)

Die Admin-API ermöglicht die Verwaltung von Plugins über das Frontend:

| Endpoint | Methode | Auth | Beschreibung |
|----------|---------|------|-------------|
| `/api/plugins` | GET | User | Alle Plugins auflisten |
| `/api/plugins/:id` | GET | User | Plugin-Details |
| `/api/plugins/:id/config` | GET | Admin | Konfiguration lesen (Secrets maskiert) |
| `/api/plugins/:id/config` | PUT | Admin | Konfiguration speichern |
| `/api/plugins/:id/config` | DELETE | Admin | Konfiguration löschen |
| `/api/plugins/:id/enable` | POST | Admin | Plugin aktivieren |
| `/api/plugins/:id/disable` | POST | Admin | Plugin deaktivieren |

> [!info] Berechtigungen
> Nur Admins können Plugin-Konfigurationen ändern. Normale User können lediglich die Plugin-Liste und -Details lesen.

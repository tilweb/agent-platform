# Vorgangsmappe — Workplace-App (v1)

**Status**: Phase A–D umgesetzt, Demo-bereit. Cofermin-Rollout (Phase E)
braucht noch OAuth-Scope-Freischaltung beim Customer + echte Cabinet-UUID
in `config.yaml`.

## Kontext

Cofermin (Rohstoff-Trader) braucht eine schlanke App, mit der Mitarbeitende
schnell alle Dokumente eines Vorgangs (Auftragsbestaetigung, Format
`AB26-xxxxx`) sehen koennen — inklusive Pflicht-Doku-Check und freier
LLM-gestuetzter Suche. Die Doku liegt in DocuWare; die App ist eine reine
View — **keine eigene DB-Persistenz**.

## Architektur

```
Backend                                              Frontend
=======                                              ========
apps/vorgangsmappe/                                  apps/vorgangsmappe/
  index.ts        — AppConfig                          VorgangListPage.jsx
  routes.ts       — Hono-Router                        VorgangDetailPage.jsx
  service.ts      — Drilldown + Suche                  hooks/useVorgangsmappe.js
  nlu.ts          — LLM-FC fuer freie Suche            components/
  compliance.ts   — Pflicht-Doku-Matching                ReferenceInput.jsx
  config-loader.ts— YAML-Loader (60s Cache)              NluSearchBar.jsx
  reference-utils — AB-Normalisierung                    FilterChips.jsx
  types.ts                                               VorgangCard.jsx
                                                         DocumentList.jsx
data/apps/vorgangsmappe/                                 DocumentViewer.jsx
  config.yaml                                            ComplianceChecklist.jsx
  requirements/standard.yaml
```

### Wiederverwendung aus dem bestehenden Stack
- **DocuWare-Suche**: `executeStructuredSearch` aus
  `backend/src/connections/providers/docuware/search.ts`.
- **DocuWare-Tokens**: `connectionRegistry.getTokens(userId, 'docuware')`.
- **DocuWare-Viewer**: bestehende Routen `/api/connections/docuware/...`
  (Thumbnail/Page/File).
- **LLM Forced Function Call**: Pattern aus
  `apps/wzbar-matcher/classifier.ts` (Tool-Schema mit `toolChoice` forced).
- **App-Permissions**: `requireAppAccess` Middleware.

## Such-Eingaenge

### 1. AB-Nummer (Fast-Path)
- User tippt `AB26-12345` in das Referenz-Feld
- Frontend ruft `GET /vorgaenge/AB26-12345`
- Backend macht direkten `REFERENCE`-Filter (ohne LLM)
- Drilldown auf Detail-Page

### 2. Freie Suche (LLM-NLU)
- User tippt z.B. "Alle Rechnungen Mai an WIANCO"
- Optional: `POST /nlu/preview` — interpretiert ohne Suche, Frontend zeigt
  Filter-Pills
- `POST /search` mit `{ query }` — interpretiert + sucht
- Antwort: `documents[]` cross-vorgang + `vorgaenge[]` group-by REFERENCE

## Pflicht-Doku-Check

YAML-konfiguriert pro Vorgangstyp unter
`data/apps/vorgangsmappe/requirements/<id>.yaml`. Aktuell ein
`standard`-Profil mit Pflicht: Auftragsbestaetigung, Rechnung, Lieferschein;
Optional: Zollpapier.

Matching erfolgt case-insensitiv gegen das `document_type_field`
(default `ART_DES_DOKUMENTES`). Wildcards `*` werden zu Regex `.*` umgesetzt.

Auswahl des Requirement-Sets:
1. Wenn `config.vorgangstyp_field` gesetzt und mindestens ein Dokument
   dieses Feld traegt → Wert als Set-ID verwenden
2. Sonst `default_requirement_set` aus der Config

## API-Routen (alle unter `/api/apps/vorgangsmappe`, authMiddleware)

| Endpoint | Methode | Body / Query | Returns |
|---|---|---|---|
| `/config` | GET | — | App-Config inkl. Cabinet + Feld-Mapping |
| `/vorgaenge/:reference` | GET | — | VorgangDetail inkl. Compliance |
| `/vorgaenge/:reference/compliance` | GET | `?ruleSet=...` | nur ComplianceReport |
| `/search` | POST | `{ query }` ODER `{ filters }` | Treffer (Vorgaenge + Docs) |
| `/nlu/preview` | POST | `{ query }` | NluInterpretation ohne Suche |

## Konfiguration

`data/apps/vorgangsmappe/config.yaml`:
```yaml
cabinet:
  id: "<UUID-of-Cabinet>"   # zwingend zu setzen
  displayName: "Test Kaufmaennische Belege"
reference_field: REFERENCE
document_type_field: ART_DES_DOKUMENTES
vorgangstyp_field: null
default_requirement_set: standard
```

Cofermin-spezifisch (Dev): Cabinet `Test_Kaufmannische_Belege`,
Referenz-Feld `REFERENCE` (AB-Nummer).

## Verifikation

### Manuelle Akzeptanz-Tests
1. **Skeleton**: App in Sidebar mit Briefcase-Icon → Klick → Cabinet-Info
2. **AB-Drilldown**: Existierende AB eingeben → Detail-Page mit allen Docs +
   Pflicht-Doku-Status + PDF-Viewer
3. **Freie Suche**: "Alle Rechnungen Mai" → Pills mit
   `ART_DES_DOKUMENTES=*Rechnung*` + `DATUM=[2026-05-01, …]` → Treffer
4. **Unbekanntes Feld**: "Alle Bla im Quartal" → Validation-Fehler im UI
5. **Compliance**: Vorgang mit fehlendem Lieferschein → ⚠ Lieferschein fehlt;
   alle Docs vorhanden → ✓ complete-Badge

### Test-Skript
`tools/docuware-test/probe-vorgangsmappe.ts` mit:
```sh
cd backend && REFERENCE=AB26-12345 /Users/andreasbachmann/.bun/bin/bun run \
  ../tools/docuware-test/probe-vorgangsmappe.ts
```
Validiert Config-Loader, AB-Drilldown, Compliance, Freie Filter-Suche.

## Cofermin-Rollout-Checkliste (Phase E)

1. ☐ Customer-DocuWare-Admin schaltet OAuth-Scopes auf der App frei
   (`docuware.platform`, `openid`, `dwprofile`, `offline_access`)
2. ☐ Cabinet-UUID von `Test_Kaufmannische_Belege` → in `config.yaml` eintragen
3. ☐ App via `PUT /api/apps/vorgangsmappe/enable` aktivieren (Admin)
4. ☐ Berechtigungen setzen: Gruppe(n) mit Rolle `viewer` zuweisen
5. ☐ Akzeptanz-Test gegen den echten Tenant durchspielen
6. ☐ `requirements/<vorgangstyp>.yaml` ergaenzen, falls Cofermin Vorgangstypen
   pflegt

## Open Topics / Next Iterations

- **Multi-Tenant**: aktuell ein Cabinet pro Installation. Sobald mehrere
  Cofermin-Mandanten zugleich bedient werden sollen, muss `config.yaml`
  pro Connection-Domain matchbar sein.
- **NLU-Robustheit**: Wenn der LLM bei mehrdeutigen Anfragen Felder errat,
  sollte das UI mit einer hilfreichen Fehlermeldung antworten + Hint auf
  „Verstehen"-Button.
- **Compliance pro Vorgangstyp**: zusaetzliche YAMLs in `requirements/`
  anlegen, sobald Cofermin Vorgangstypen in DocuWare pflegt.
- **Incoterm-Matching**: nicht in v1; spaeter als wzbar-aehnlicher Matcher
  fuer Incoterms.
- **Notizen / Lesezeichen pro Vorgang**: braucht eigene DB-Tabelle, ist v1
  bewusst out-of-scope.

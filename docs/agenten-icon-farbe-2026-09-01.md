# Agenten: Icon & Farbe pflegbar — Konzept für das Produkt-Team

**Datum:** 2026-09-01 · **Quelle:** Piloten-Repo (Adacor Workplace-Lab) · **Zweck:** Vorlage zum Nachbau im echten Produkt

## Ziel

Agenten sollen ein **wiedererkennbares Avatar-Icon in einer wählbaren Farbe** haben, das der/die
Nutzer:in beim Anlegen und Bearbeiten selbst pflegt — ohne Technik-Wissen, per Klick. Vorher waren
Icons im Frontend hart pro Agent-ID verdrahtet; eigene Agenten sahen alle gleich (graues Default).

## UX-Konzept (das Wichtigste zum Nachbau)

Alles passiert **im Kopfbereich** der Add/Edit-Maske — keine separate Box:

1. **Avatar links im Header ist klickbar.** Er zeigt das aktuell gewählte Icon in der gewählten Farbe
   (getönte Fläche = `farbe` bei ~13 % Deckkraft, Icon in Vollfarbe). Ein kleines Stift-Overlay unten
   rechts signalisiert „bearbeitbar". Klick öffnet den Picker.
2. **Icon-Picker (Modal):** feste Auswahl aus einem **Icon-Katalog** (Raster) + einer **Farbpalette**
   (Swatches), oben eine **Live-Vorschau** des Avatars. Buttons „Abbrechen" / „Übernehmen" — Auswahl
   wird erst beim Übernehmen in den Formular-State übernommen.
3. **Name inline im Header editierbar.** Der große Titel *ist* das Eingabefeld (keine extra „Name"-Box).
   Editier-Affordanz: dauerhafte **Unterstreichung** (dunkler bei Hover, Primärfarbe bei Fokus) + kleines
   **Stift-Icon** daneben + Placeholder „Name des Agenten".
4. **Übersichts-Kacheln** rendern denselben Avatar (Icon + getönte Farbe). Agenten ohne Auswahl fallen
   auf ein sinnvolles Default zurück.

## Datenmodell

Zwei neue, optionale Felder am Agenten:

| Feld    | Typ    | Inhalt                                            | Default   |
|---------|--------|---------------------------------------------------|-----------|
| `icon`  | string | **ID aus dem festen Katalog** (z. B. `"robot"`)   | `"robot"` |
| `color` | string | **Hex-Farbe** aus der Palette (z. B. `"#8b5cf6"`) | `"#64748b"` (Slate/Grau) |

Wichtig: `icon` ist **keine** frei eingegebene Datei/URL, sondern eine Katalog-ID → stabil, versionierbar,
kein Upload/Storage nötig. `color` ist ein Hex-String aus einer **festen Palette** (kein Freiform-Colorpicker),
das hält die Optik konsistent.

Im Piloten liegen die Felder in der Agent-Frontmatter (Markdown) und werden mitpersistiert — **keine
DB-Migration** nötig. Im echten Produkt entsprechend zwei Spalten/Attribute am Agent-Objekt.

## API

- `GET /agents` (Liste) und `GET /agents/:id/full` liefern `icon` + `color` mit (einfach Teil des Agent-Objekts).
- `POST /agents` und `PUT /agents/:id` akzeptieren `icon` + `color` im Body und speichern sie.
- Keine weiteren Endpoints nötig.

## Fester Katalog (Vorschlag aus dem Piloten)

**Icons (24)** — als ID → Bedeutung: `robot`, `brain`, `sparkles`, `chat`, `pen`, `document`, `book`,
`folder`, `chart`, `target`, `briefcase`, `code`, `search`, `lightning`, `user`, `clipboard`, `calendar`,
`mail`, `image`, `plug`, `ticket`, `key`, `bell`, `table`.

**Farben (14, Hex):** `#14b8a6` `#06b6d4` `#3b82f6` `#6366f1` `#8b5cf6` `#a855f7` `#ec4899` `#f43f5e`
`#ef4444` `#f97316` `#f59e0b` `#22c55e` `#10b981` `#64748b`.

Im echten Produkt: Icon-Set an das eigene Design-System/Icon-Framework binden (gleiche IDs, eigene SVGs),
Farben als Design-Tokens statt roher Hex-Werte hinterlegen.

## Rendering & Fallback

- Avatar = quadratische Fläche, `background: farbe @ ~13 %`, Icon in `farbe`, Radius = „md/lg".
- **Fallback**, wenn ein Agent (noch) kein `icon` hat: bisheriges Default-Icon/-Farbe. So brechen bestehende
  (System-)Agenten nicht — sie bekommen die Auswahl erst, wenn sie gepflegt wird.
- Der Avatar wird an **allen** Stellen gleich gerendert (Übersichtskachel, Editor-Header). Empfehlung fürs
  echte Produkt: **auch im Chat** (Agent-Auswahl, Nachrichten-Avatar) dieselbe Komponente nutzen — im Piloten
  ist das noch offen.

## Referenz-Implementierung im Piloten (Dateien)

- Backend: `backend/src/services/agents.ts` (`icon`/`color` in `AgentConfig`, Frontmatter-Parse/Serialize,
  create/update), `backend/src/routes/agents.ts` (Body-Felder durchgereicht).
- Frontend:
  - `frontend/src/components/agentIcons.js` — Katalog + Palette + Defaults (reines Datenmodul).
  - `frontend/src/components/AgentAvatar.jsx` — `AgentAvatar` (Fläche) + `AgentGlyph` (nur Icon).
  - `frontend/src/components/AgentIconPicker.jsx` — das Auswahl-Modal.
  - `frontend/src/pages/AgentsPage.jsx` — klickbarer Header-Avatar, inline editierbarer Name, Übersichtskachel-Rendering.

## Hinweise / Empfehlungen fürs echte Produkt

- **A11y:** Picker-Buttons mit `aria-label` (Icon-Name/Farbe), Fokus-Reihenfolge, ESC schließt.
- **Konsistenz:** Icon-IDs stabil halten (Wert wird gespeichert). Neue Icons nur additiv.
- **Kontrast:** Palette so wählen, dass Icon auf getöntem Hintergrund und in hell/dunkel gut lesbar bleibt.
- **Chat-Integration** als Folgeschritt einplanen, damit das Icon überall konsistent erscheint.

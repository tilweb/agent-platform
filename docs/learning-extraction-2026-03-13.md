# Lernende Dokumenten-Extraktion — Redesign

**Datum:** 2026-03-13
**Status:** Implementiert

## Kontext

Das bestehende Profil-basierte Extraktionssystem war starr und strukturbasiert (ein Dokument-Typ = ein Profil mit verschachtelten Feldgruppen + Arrays). Dieses Redesign ersetzt es durch ein lernendes, intent-basiertes System, bei dem der User nur die gewuenschten Felder definiert und das System durch Korrekturen besser wird.

## Entscheidungen

1. **Altes Profil-System ersetzt** (nicht parallel betrieben)
2. **Nur flache Felder** — Text, Zahl, Datum, Boolean; keine Arrays/Gruppen
3. **Kein ML/Fine-Tuning** — reines Prompt Engineering mit Few-Shot Examples + auto-generierten Guidelines
4. **Manuelles Formular** fuer Projekterstellung (Felder einzeln hinzufuegen)
5. **Kein Batch-Processing** im initialen Scope

## Architektur

### 4-Schichten-Prompt

1. **Base**: Dokumenten-Extraktions-Experte Rolle + allgemeine Regeln
2. **Feld-Definitionen**: Aus project.fields — Label, Typ, Pflicht, Beschreibung
3. **Gelernte Regeln**: Aus project.guidelines — auto-generiert aus Korrekturen
4. **Few-Shot Beispiele**: 3-5 beste korrigierte Beispiele (Dokument-Auszug + korrekte Extraktion)

### Lernzyklus

```
Upload → Extraktion (mit aktuellem Wissen) → Ergebnis anzeigen
                                               ↓
                                 User korrigiert Fehler
                                               ↓
                                 Beispiel gespeichert
                                               ↓
                                 Ab 3 Beispielen: Guidelines auto-generieren
                                               ↓
                                 Naechstes Dokument profitiert
```

### Beispiel-Selektion (Few-Shot)

- Korrekturen priorisieren (informativer als confirmed-correct)
- Neuere Beispiele bevorzugen
- Max 5 Beispiele, max ~4000 Token Budget
- Dokument-Text auf 500 Zeichen gekuerzt

## Dateien

### Neue Dateien

| Datei | Zweck |
|-------|-------|
| `backend/src/extraction/learning/types.ts` | ExtractionProject, TrainingExample, ProjectField Typen |
| `backend/src/extraction/learning/projects.ts` | Projekt-CRUD (YAML in data/extraction-projects/) |
| `backend/src/extraction/learning/examples.ts` | Beispiel-CRUD + Few-Shot-Selektion |
| `backend/src/extraction/learning/prompt-builder.ts` | 4-Schichten-Prompt + flaches Function Schema |
| `backend/src/extraction/learning/guideline-generator.ts` | LLM-Call zur Regel-Ableitung |
| `backend/src/extraction/learning/service.ts` | Orchestrierung: extract, train, regenerate |
| `backend/src/extraction/learning/validators.ts` | correctNumber/correctDate Helpers |
| `backend/src/extraction/learning/index.ts` | Re-exports |
| `backend/src/routes/extraction-projects.ts` | REST API |
| `frontend/src/pages/ExtractionProjectsPage.jsx` | Komplette UI |

### Geaenderte Dateien

| Datei | Aenderung |
|-------|-----------|
| `backend/src/index.ts` | Route + Import auf extraction-projects umgestellt, loadProfiles() entfernt |
| `frontend/src/App.jsx` | Import ExtractionProjectsPage statt ExtractionProfilesPage |

### Datenstruktur

```
data/extraction-projects/
  {project-id}/
    project.yaml          # Projekt-Definition + Guidelines + Learning-Metadata
    examples/
      ex_{id}.yaml        # Training-Beispiel (initial + korrigiert + corrections)
```

## API Endpoints

```
GET    /api/extraction/projects
GET    /api/extraction/projects/:id
POST   /api/extraction/projects
PUT    /api/extraction/projects/:id
DELETE /api/extraction/projects/:id
POST   /api/extraction/projects/:id/extract
POST   /api/extraction/projects/:id/train
GET    /api/extraction/projects/:id/examples
DELETE /api/extraction/projects/:id/examples/:exId
POST   /api/extraction/projects/:id/regenerate
```

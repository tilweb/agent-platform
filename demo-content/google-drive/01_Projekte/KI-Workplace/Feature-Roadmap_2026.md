# Feature-Roadmap: KI-Workplace 2026

**Product Owner:** Thomas Weber
**Technische Leitung:** Michael Hoffmann
**Stand:** 25.03.2026

---

## Roadmap-Übersicht

```
Q1 2026          Q2 2026          Q3 2026          Q4 2026
┌──────────┐    ┌──────────┐    ┌──────────┐    ┌──────────┐
│ ALPHA    │    │ CLOSED   │    │ OPEN     │    │ GENERAL  │
│ Interner │    │ BETA     │    │ BETA     │    │ AVAIL.   │
│ Test     │    │ 10 Pilot-│    │ Öffent-  │    │ Markt-   │
│          │    │ kunden   │    │ lich     │    │ start    │
└──────────┘    └──────────┘    └──────────┘    └──────────┘
```

---

## Q1 2026: Alpha – Grundfunktionen

### Fertiggestellt ✅

**Chat & Agenten-System**
- [x] Multi-Agenten-Architektur mit Supervisor-Routing
- [x] Streaming-Chat mit SSE (Server-Sent Events)
- [x] 8 spezialisierte Agenten (General, Recherche, Dokumente, Daten, HR, Projekt, IT, Kreativ)
- [x] Delegationsmechanismus zwischen Agenten (max. Tiefe 2)
- [x] Kontextinjektion (Datum, Sprache, Projektwissen)

**Knowledge Base**
- [x] Dokumenten-Upload (PDF, DOCX, TXT, MD)
- [x] Chunking und Embedding-Erstellung
- [x] Semantische Suche mit Relevanz-Scoring
- [x] Collection-Management (Erstellen, Bearbeiten, Löschen)

**Benutzerverwaltung**
- [x] Cookie-basierte Authentifizierung
- [x] Argon2id Password-Hashing
- [x] Benutzerprofil mit Einstellungen
- [x] Rollensystem (Admin, User)

**Integrationen (Basis)**
- [x] Google Drive Verbindung (read-only)
- [x] Web-Suche (DuckDuckGo)
- [x] Bild-Generierung (Flux.1)

### In Arbeit 🔄

**Skill-System**
- [x] YAML-basierte Skill-Definitionen
- [x] Dynamisches Laden per `load_skill` Tool
- [ ] Skill-Marketplace (UI für Skill-Verwaltung) → verschoben auf Q2

---

## Q2 2026: Closed Beta – Enterprise-Features

### Geplant

**Google Workspace Integration (Deep)**
- [ ] Google Drive: Lesen UND Schreiben
- [ ] Gmail: E-Mails lesen, verfassen, senden
- [ ] Google Calendar: Termine lesen und erstellen
- [ ] Google Docs: Dokumente erstellen und bearbeiten
- **Verantwortlich:** Michael Hoffmann, Sprint 1–3

**Microsoft 365 Integration**
- [ ] OneDrive/SharePoint: Dokumente lesen
- [ ] Outlook: E-Mails lesen
- [ ] Teams: Nachrichten lesen (Webhook)
- **Verantwortlich:** Jan Peters, Sprint 2–4

**Erweiterte Agenten**
- [ ] Finanz-Agent mit Tabellenkalkulation
- [ ] Vertrags-Agent mit Klauselanalyse
- [ ] Onboarding-Agent für neue Mitarbeitende
- **Verantwortlich:** Nina Schulz, fortlaufend

**Aufgabenautomatisierung**
- [ ] Geplante Tasks (Cron-basiert)
- [ ] Automatische Statusberichte (wöchentlich)
- [ ] E-Mail-Zusammenfassungen (täglich)
- **Verantwortlich:** Tobias Richter, Sprint 2–5

**Multi-Tenancy**
- [ ] Mandantentrennung auf Datenebene
- [ ] Eigene Agent-Konfigurationen pro Mandant
- [ ] Nutzungslimits und Quotas
- **Verantwortlich:** Michael Hoffmann, Sprint 3–6

**Sicherheit & Compliance**
- [ ] SAML/OIDC Single Sign-On
- [ ] Audit-Log für alle KI-Interaktionen
- [ ] Datenklassifizierung (öffentlich, intern, vertraulich)
- [ ] Rollenbasierte Zugriffskontrolle (RBAC) auf Dokumente
- **Verantwortlich:** Claudia Braun, fortlaufend

---

## Q3 2026: Open Beta – Skalierung & UX

### Geplant

**Performance & Skalierung**
- [ ] Horizontale Skalierung des Backends (Load Balancer)
- [ ] Caching-Layer für häufige Anfragen
- [ ] Asynchrone Dokumentenverarbeitung (Job-Queue)
- [ ] CDN für statische Assets

**UX-Verbesserungen**
- [ ] Überarbeitetes Dashboard mit Widgets
- [ ] Mobile-optimierte Oberfläche (PWA)
- [ ] Tastenkürzel und Power-User-Features
- [ ] Onboarding-Tour für neue Nutzer
- [ ] Dark Mode

**Erweiterte KI-Funktionen**
- [ ] Bildanalyse in Dokumenten (OCR + Vision)
- [ ] Sprachsteuerung (Speech-to-Text → Action)
- [ ] Automatische Meeting-Transkription
- [ ] Proaktive Vorschläge basierend auf Nutzerkontext

**API & Entwickler**
- [ ] Öffentliche REST-API mit API-Keys
- [ ] Webhook-System für Ereignisse
- [ ] Custom Agent Builder (Low-Code)
- [ ] MCP-Server für Drittanbieter-Integrationen

---

## Q4 2026: GA – Marktstart

### Geplant

**On-Premise-Version**
- [ ] Docker-Compose-Deployment
- [ ] Kubernetes Helm Charts
- [ ] Offline-fähige LLM-Option (lokale Modelle)
- [ ] Installations- und Upgrade-Dokumentation

**Enterprise-Features**
- [ ] Abteilungs-Hierarchien und Berechtigungen
- [ ] Unternehmensweites Wissensmanagement
- [ ] Compliance-Dashboard
- [ ] SLA-Monitoring und Reporting

**Marketplace**
- [ ] Skill-Marketplace für Community-Skills
- [ ] Integration-Marketplace
- [ ] Template-Bibliothek (Agenten, Workflows)

**Monetarisierung**
- [ ] Stripe-Integration für Billing
- [ ] Nutzungsbasierte Abrechnung (Token-Verbrauch)
- [ ] Self-Service-Upgrade/Downgrade
- [ ] Rechnungsstellung und Buchhaltungsexport

---

## Priorisierungs-Framework

Wir priorisieren Features nach dem RICE-Score:

- **Reach:** Wie viele Nutzer profitieren?
- **Impact:** Wie stark verbessert es die Nutzererfahrung? (1–3)
- **Confidence:** Wie sicher sind wir in der Schätzung? (50–100 %)
- **Effort:** Wie viel Aufwand in Personenwochen?

**RICE = (Reach × Impact × Confidence) / Effort**

Die aktuellen RICE-Scores werden im Jira-Board `KI-WP` gepflegt.

---

## Abhängigkeiten

| Feature | Abhängigkeit |
|---------|-------------|
| Google Workspace Deep | OAuth2-Setup, Google API Freischaltung |
| Multi-Tenancy | Cloud-Migration muss abgeschlossen sein (PRJ-2026-001) |
| On-Premise-Version | Kubernetes-Expertise im Team |
| Meeting-Transkription | STT-Modell mit Deutsch-Optimierung |

---

*Dokument gepflegt von Michael Hoffmann*
*Nächstes Roadmap-Review: 15.04.2026 (Product Board Meeting)*

# TOM-Übersicht — Technische und organisatorische Maßnahmen (Wohngeld-Antragsassistent)

**Rechtsgrundlage:** Art. 32 DSGVO · **Referenzrahmen:** BSI IT-Grundschutz (OPS.1.1.5 Protokollierung,
DER.1 Detektion) · **App:** `wohngeld` · **Stand:** `[Datum einsetzen]`
**Status:** VORLAGE — Ist-Stand der App + Platzhalter für Infrastruktur-/Betreiberangaben.
**Grundlagen:** `docs/wohngeld-governance-recherche-2026-09-19.md`,
`docs/wohngeld-governance-spec-2026-09-19.md`.

> **Legende Status:** `[Ist-App]` = in der Anwendung bereits umgesetzt (laut Governance-Spec Abschnitt 2/4);
> `[Infra]` = von Betreiber/Hosting zu befüllen; `[org.]` = organisatorisch durch die Kommune zu regeln.
> Diese Übersicht ist die in Art. 30 Abs. 1 lit. g / VVT referenzierte TOM-Beschreibung.

---

## 1. Zutrittskontrolle (physisch)

`[Infra]` Rechenzentrum/Standort, Zutrittsschutz, Zertifizierungen des Hosters `[einsetzen —
z. B. Scalingo/Flow.swiss-Standort, ISO 27001, EU/EWR]`.

## 2. Zugangs-/Zugriffskontrolle (logisch)

| Maßnahme | Umsetzung | Status |
|---|---|---|
| Authentifizierung | Cookie-basierte Sessions, **Argon2id**-Passwort-Hashing; Session mit IP/User-Agent | `[Ist-App]` |
| Login-Sicherheit | Login/Logout/Passwort-Reset auditiert (pseudonymisiert, Retention 90 T) | `[Ist-App]` |
| Rollenmodell | **3 Rollen** owner/editor/viewer, **gruppenbasiert**; **`requireAppAccess`** je App | `[Ist-App]` |
| Least Privilege | Editor-Gate **`denyIfNotAppEditor`** auf Schreib-Routen; globale Admins **ohne** Auto-Zugriff auf Fachdaten (Admin ≠ Daten-Auditor) | `[Ist-App]` |
| Funktionstrennung | Optionales **Vier-Augen** (`WOHNGELD_VIERAUGEN`): finale Verfügung nur durch „Entscheider" (owner), Bearbeiter ≠ Entscheider | `[Ist-App / opt-in]` |
| Passwort-Policy / MFA | `[org./Infra — Vorgaben Länge/Komplexität, ggf. MFA]` | `[org.]` |
| Berechtigungsvergabe/-entzug | Prozess für On-/Offboarding, Rezertifizierung | `[org.]` |

## 3. Protokollierung / Nachvollziehbarkeit (BSI OPS.1.1.5, DER.1; § 35 SGB I; Art. 12 AI Act)

| Maßnahme | Umsetzung | Status |
|---|---|---|
| Fachliches Audit | **`wohngeld.audit_log`** (Postgres, **append-only**): Wer (Akteur-ID+Name+Rolle) / Was (Aktion) / Wann / Woran (Fallbezug) | `[Ist-App]` |
| **Lesezugriffe** auf Sozialdaten | `vorgang.geoeffnet` protokolliert (§ 35 SGB I — nachweisen, wer wann welchen Fall einsah) | `[Ist-App]` |
| Downloads/Exporte | Datei-/Export-GETs protokolliert (Dokument-Datei, Schreiben-Export, Verfügungs-Export) | `[Ist-App]` |
| Vorher/Nachher | **Diff** der Kernfelder bei Änderungen (`vorher`/`nachher` im Audit) | `[Ist-App]` |
| KI-Nutzung | **`audit.usage_log`**: Modell-ID, Provider, Prompt-/Regelkatalog-Version, Zweck, Nutzer, Fallbezug | `[Ist-App]` |
| Manipulationsschutz | Append-only (keine Update/Delete-API); **Hash-Kette** optional (Stufe 2) | `[Ist-App / opt.]` |
| Zweckbindung Protokolle | **Keine** Leistungs-/Verhaltenskontrolle der Beschäftigten | `[org. — Personalrat/Dienstvereinbarung]` |
| Auswertung | Fall-Protokoll-Tab + Admin/DSB-Protokoll-Ansicht (Suche/Filter/Export) | `[Ist-App]` |
| Zeitquelle | Synchronisierte, manipulationssichere Zeitstempel | `[Infra]` |

## 4. Vertraulichkeit / Verschlüsselung

| Maßnahme | Umsetzung | Status |
|---|---|---|
| Transportverschlüsselung | TLS/HTTPS für alle Verbindungen (Frontend↔Backend, Backend↔Storage/LLM) | `[Infra — bestätigen]` |
| Verschlüsselung at rest | Datenbank + **S3-Objektspeicher** verschlüsselt | `[Infra — bestätigen]` |
| Besondere Kategorien (Art. 9 / § 76 SGB X) | Keine Art-9-Daten in externe Klartext-Kontexte/Prompts; **kein** Prompt-/Antwort-Volltext im Audit (nur Metadaten) | `[Ist-App / org.]` |
| Secrets-Management | API-Keys/DB-Credentials sicher verwaltet (ENV/Secret-Store), nicht im Repo | `[Infra]` |

## 5. Verfügbarkeit / Belastbarkeit / Wiederherstellbarkeit (Art. 32 Abs. 1 lit. b/c)

| Maßnahme | Umsetzung | Status |
|---|---|---|
| Backup | Regelmäßige Sicherung DB + Objektspeicher, getestete Wiederherstellung | `[Infra]` |
| Aufbewahrung Backups | Frist/Rotation im Einklang mit Löschkonzept | `[Infra/org.]` |
| Redundanz/Monitoring | Verfügbarkeitsüberwachung, Alarmierung | `[Infra]` |
| Notfallkonzept | RTO/RPO, Wiederanlauf | `[Infra/org.]` |

## 6. Pseudonymisierung / Datenminimierung (Art. 32 Abs. 1 lit. a, Art. 5 Abs. 1 lit. c)

- Auth-Audit **pseudonymisiert**; kein Prompt-/Antwort-Volltext im fachlichen Audit `[Ist-App]`.
- Keine List-GET-Einzelprotokollierung (Datensparsamkeit); nur Detail-Öffnung als Lesezugriff `[Ist-App]`.
- `[org.]` Grundsatz Datensparsamkeit bei Erhebung/Upload; KI-Nebenartefakte (Caches/Embeddings)
  minimieren und fristgerecht löschen.

## 7. Eingabekontrolle

| Maßnahme | Umsetzung | Status |
|---|---|---|
| Nachvollziehbarkeit von Eingaben/Änderungen | **Vorher/Nachher-Diff** + Akteur im Audit; **KI-Provenienz** auf Feldebene (`feld_status`: quelle `llm`/`mensch`, `bestaetigt`, `confidence`) | `[Ist-App]` |
| Kein stilles Überschreiben | **Optimistic Locking** (`version`) auf Kern-Entitäten | `[Ist-App]` |
| Human-in-the-Loop | KI-Vorschläge **bestätigungspflichtig**; Verfügung nur durch Mensch | `[Ist-App]` |

## 8. Trennungskontrolle

| Maßnahme | Umsetzung | Status |
|---|---|---|
| Mandanten-/Falltrennung | Trennung je Instanz/Kommune; Fachdaten pro Vorgang isoliert | `[Ist-App / Infra]` |
| Storage-Trennung | Pro Instanz eigener Storage-Account + eindeutiger Bucket | `[Infra]` |
| Trennung Fach- vs. Protokolldaten | Audit getrennt persistiert; Log-Zugriff nur owner/DSB-Rolle | `[Ist-App]` |

## 9. Auftragskontrolle (Art. 28 DSGVO / § 80 SGB X)

- Auftragsverarbeiter (Betreiber, Hosting/S3, LLM-Provider) mit AV-Vertrag + SGB-X-Zusätzen —
  siehe `05-auftragsverarbeitung-av-bausteine.md`. `[org.]`

## 10. Überprüfung / Wirksamkeit (Art. 32 Abs. 1 lit. d)

- `[org.]` Regelmäßige Überprüfung der TOM (Turnus `[…]`), Pen-Test/Schwachstellenmanagement `[Infra]`,
  Anpassung bei Änderungen (Stand der Technik).

---

## Offene Infra-/Org-Angaben (zwingend zu befüllen)
Hosting-Standort & Zertifizierungen, TLS/at-rest-Verschlüsselung bestätigen, Backup-/Notfallkonzept,
Secrets-Management, Passwort-Policy/MFA, Zeitquelle, Turnus TOM-Überprüfung, Personalrat/
Dienstvereinbarung zur Protokoll-Zweckbindung.

## Quellen
`docs/wohngeld-governance-recherche-2026-09-19.md` (Art. 32, BSI OPS.1.1.5/DER.1 mit URLs) ·
`docs/wohngeld-governance-spec-2026-09-19.md` (Abschnitt 2/4, Ist-Stand).

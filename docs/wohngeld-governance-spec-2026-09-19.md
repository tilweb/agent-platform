# Governance-Spec: Wohngeld-Antragsassistent (Konzept, keine Umsetzung)

**Stand:** 2026-09-19 · **Status:** ENTWURF zur Abstimmung · **App:** `wohngeld`
**Grundlagen:** `docs/wohngeld-governance-recherche-2026-09-19.md` (Rechtsanker) + Code-Bestandsaufnahme
(dieser Session). **Scope:** Was das Tool an Governance leisten muss/soll, was es HEUTE schon kann,
was fehlt, und ein pragmatischer Umsetzungsplan. Leitlinie wie im Rest der App: intuitive UX,
klare Abläufe, **nicht overengineered** — aber revisionssicher, wo es das Recht verlangt.

> **Hinweis:** Dies ist eine *technische/organisatorische* Governance-Spec. Sie ersetzt nicht die
> **Datenschutz-Folgenabschätzung (Art. 35 DSGVO)**, das **Verfahrensverzeichnis (Art. 30)** und die
> Abstimmung mit **DSB / Kommune / Personalrat** — sie liefert dafür die technische Grundlage.

---

## 0. Leitprinzipien

1. **Assistenz, nicht Entscheidung.** Der Mensch entscheidet wirksam und ergebnisoffen (kein
   „Rubber-Stamping"). Das ist die Design-Weiche für Art. 22 DSGVO **und** das Argument gegen die
   AI-Act-Hochrisiko-Einstufung (Ausnahme Art. 6 Abs. 3) — muss aber **dokumentiert** und im Tool
   **erlebbar** sein (KI-Vorschläge sind gekennzeichnet + bestätigungspflichtig).
2. **Alles Fachhandeln ist nachvollziehbar.** Jede Aktion der Sachbearbeitung wird protokolliert —
   inklusive **Lesezugriffen** auf Sozialdaten (Sozialgeheimnis, § 35 SGB I) und **Downloads/Exporten**.
3. **Sozialdaten first.** Wohngelddaten sind Sozialdaten (§§ 67 ff. SGB X): strenge Zweckbindung,
   Zugriff nur für Befugte, besondere Kategorien (Behinderung/Pflege → Art. 9 DSGVO).
4. **Revisionssicher & manipulationsgeschützt.** Protokolle sind append-only, dauerhaft persistiert,
   und dienen **nicht** der Mitarbeiter-Leistungskontrolle (Personalrat einbinden).
5. **Datensparsamkeit & Aufbewahrung.** Nur was nötig ist; Löschung nach gesetzlicher Frist
   (Wohngeldakten ~10 Jahre), Legal Hold davor.

---

## 1. Regulatorischer Rahmen (kompakt — Details im Recherche-Dokument)

| Quelle | Kernpflicht fürs Tool |
|---|---|
| **§ 35 SGB I, §§ 67–85a SGB X** (Sozialdatenschutz) | Sozialgeheimnis, Zweckbindung (§§ 67c, 78), Zugriff nur Befugte, besondere Daten (§ 76), AV nur mit SGB-X-Zusätzen (§ 80) → **Protokollierung inkl. Lesezugriffen** |
| **Art. 5 DSGVO** | Rechenschaftspflicht → Nachweisbarkeit durch Protokolle/Doku |
| **Art. 6 Abs. 1 e / Abs. 3** | Rechtsgrundlage = öffentliche Aufgabe + WoGG/SGB (keine Einwilligung) |
| **Art. 9 Abs. 2 b/g** | Behinderung/Pflege/Gesundheit (Freibeträge) = besondere Kategorien → erhöhter Schutz |
| **Art. 22** | Keine automatisierte Einzelentscheidung → **menschliche Letztentscheidung** zwingend erlebbar machen |
| **Art. 30 / 32 / 35** | Verfahrensverzeichnis · TOM/Sicherheit · **DSFA voraussichtlich Pflicht** (öffentl. Stelle + neue Technik + Art-9-Daten) |
| **Art. 15–18, 21** | Betroffenenrechte: Auskunft/Berichtigung/Einschränkung/Löschung (nachrangig zur Aufbewahrungsfrist) |
| **EU AI Act** | Anhang III Nr. 5 a (Sozialleistungen) = grds. Hochrisiko; **echte Assistenz** kann über Art. 6 Abs. 3 herausfallen (dokumentierte Bewertung, **nie Profiling**). Hochrisiko-Pflichten (v. a. **Art. 12 Logging**, **Art. 14 Aufsicht**, Art. 13 Transparenz, Art. 15 Genauigkeit) vorsorglich als Best Practice. Frist ~Dez 2027 |
| **§§ 27 Abs. 4, 33 Abs. 2 WoGG; § 45 Abs. 3 SGB X** | Aufbewahrung Wohngeldakten **~10 Jahre** (final landesrechtlich — mit Kommune klären) |
| **OZG 2.0 · BSI IT-Grundschutz (OPS.1.1.5, DER.1) · BITV 2.0** | Verwaltungsstandards · Protokollierungsbausteine · Barrierefreiheit |

---

## 2. Was die App HEUTE schon kann (Governance-Substanz)

- **Fall-Historie append-only** (`wohngeld.aktivitaeten`) mit Akteur (userId) — Basis für das Audit.
- **KI-Provenienz auf Feldebene** (`feld_status`: quelle `llm`/`mensch`, `bestaetigt`, `confidence`,
  `quellDokumentId`) + **Bestätigungs-/Verwerfen-Workflow** → Human-in-the-Loop ist bereits sichtbar.
- **Prüfschritte** mit `automatisch`-Flag + Status offen/erledigt/verworfen → Trennung Maschine/Mensch.
- **Optimistic Locking** (`version`) auf allen Kern-Entitäten → kein stilles Überschreiben.
- **Append-only Chat** (`chat_messages`) + Chat-Guardrails (Belegpflicht, keine Rechtsauskunft),
  C4-Aktionen nur mit Bestätigung.
- **3-Rollen-Modell** owner/editor/viewer (gruppenbasiert) + `requireAppAccess`; globale Admins
  haben **keinen** Auto-Zugriff (Admin ≠ Daten-Auditor).
- **Auth/Session** mit IP/User-Agent; **Login/Logout/Passwort-Reset-Audit** (pseudonymisiert, Retention 90 T).
- **Zentrales LLM-Usage-Log** (`audit.usage_log`: User/Modell/Source) für Chat + Dokument-Extraktion.
- **Verfügung** mit menschlicher Entscheidung + Bemerkung.

→ Das Fundament ist gut. Die Lücken liegen in **Vollständigkeit, Persistenz und Auswertbarkeit**.

---

## 3. Gap-Analyse (Ist → Soll)

| # | Anforderung | Ist heute | Gap |
|---|---|---|---|
| G-A | **Jede Sachbearbeiter-Aktion geloggt** (Minimum!) | Aktivitäten-Log existiert, aber **lückenhaft** (Person/Dokument/Notiz/Akte/Textbaustein-CRUD, Vorgang-Update/Delete, Einzel-Feldbestätigung, Prüfschritt anlegen/löschen, Chat → **nicht** geloggt) | Flächendeckendes, semantisches Audit aller Schreib-Aktionen |
| G-B | **Lesezugriffe auf Sozialdaten** protokolliert (§ 35 SGB I) | Nein (nur Konsolen-Request-Logger, nicht persistiert) | Zugriffsprotokoll „Wer hat welchen Vorgang wann geöffnet" |
| G-C | **Downloads/Exporte** protokolliert | Nein (Verfügung-Export, Dokument-Datei, Schreiben-Export → kein Audit) | Export-/Weitergabe-Protokoll (Übermittlung §§ 67d ff. SGB X) |
| G-D | **Vorher/Nachher-Nachweis** bei Änderungen | Nein (nur Stichwort-Aktivität, kein Diff, kein `updated_by` auf Domänentabellen) | Feldgenaue Änderungshistorie (Diff) für Kernfelder |
| G-E | **Revisionssichere Persistenz** | File-Audit ist produktiv flüchtig (Scalingo); Aktivitäten in Postgres, aber ohne Manipulationsschutz | Audit in Postgres, append-only, optional Hash-Kette; Retention passend |
| G-F | **Identität im Protokoll** vollständig | Nur `userId` als Akteur | + Name + wirksame Rolle (+ ggf. IP) zum Zeitpunkt der Aktion |
| G-G | **Funktionstrennung/Least Privilege** | `denyIfNotAppEditor` nur in `feldstatus.ts`; andere Schreib-Routes ungeschützt; Admin-Enforcement an App-Verwaltung fehlt serverseitig | Editor-Gate konsistent; ggf. eigene Rolle „Entscheider" (Verfügung); Admin-Enforcement + Audit für Permission-/Enable-Änderungen |
| G-H | **KI-Transparenz/Aufsicht (AI Act 12/13/14)** | Feld-Provenienz gut; Usage-Log unvollständig (Tokens leer, nicht überall gesetzt); Modell/Prompt-Version nicht protokolliert | Usage-Log vervollständigen; Modell-/Prompt-Version + Fall-Bezug im Log; „KI-Nutzung"-Sicht |
| G-I | **Betroffenenrechte (Art. 15–18)** | Kein Auskunfts-/Export-/Löschmechanismus für Fachdaten | Personen-Auskunft (Export aller Daten), Berichtigung (=Edit+Audit), Löschung nach Frist |
| G-J | **Aufbewahrung & Löschung** | Nur Audit-File-Retention; Fachdaten nur Cascade-Delete | Retention-Konzept (10 J.), Legal Hold, automatisierte Fristen-Löschung |
| G-K | **DSFA / Verfahrensverzeichnis / AI-Act-Bewertung** | Nicht vorhanden | Als organisatorische Deliverables anstoßen (Vorlagen im Repo) |
| G-L | **Barrierefreiheit (BITV)** | Nicht systematisch geprüft | BITV-Check als Governance-Kriterium |

---

## 4. Spezifikationen je Domäne

### G-A + G-B + G-C + G-E + G-F — Audit-/Protokoll-Kern (Priorität 1)

**Ziel:** Ein **einheitliches, revisionssicheres Protokoll** aller fachlich relevanten Vorgänge —
das erfüllt die Nutzer-Mindestanforderung („jede Aktion geloggt") und §§ 35 SGB I / Art. 5, 30 DSGVO / AI Act Art. 12.

**Datenmodell (neu, Postgres, append-only):** `wohngeld.audit_log`
```
id · timestamp · akteur_id · akteur_name · akteur_rolle (owner|editor|viewer)
· aktion (enum, s.u.) · objekt_typ (vorgang|person|dokument|pruefschritt|schreiben|notiz|feldstatus|akte|verfuegung|chat|textbaustein|permission)
· objekt_id · vorgang_id (Fallbezug, für Filter) · ergebnis (ok|fehler)
· vorher (jsonb, optional) · nachher (jsonb, optional) · detail (text)
· ip · prev_hash · hash   (Hash-Kette für Manipulationsschutz, optional Stufe 2)
```
Aktions-Enum (Auszug): `vorgang.geoeffnet` (Lesezugriff), `vorgang.erstellt/geaendert/geloescht`,
`person.*`, `dokument.hochgeladen/geaendert/geloescht/abgelegt/heruntergeladen/vorschau`,
`feld.bestaetigt/verworfen`, `pruefung.ausgefuehrt`, `pruefschritt.angelegt/status_geaendert/geloescht`,
`schreiben.generiert/geaendert/versendet/exportiert`, `verfuegung.gespeichert/exportiert`,
`chat.frage/aktion_ausgefuehrt`, `notiz.*`, `textbaustein.*`, `permission.geaendert`, `app.aktiviert`.

**Erfassung (2 Ebenen, pragmatisch):**
1. **Semantisches Domain-Audit:** ein zentraler Helfer `audit(c, {aktion, objektTyp, objektId, vorgangId, vorher, nachher, detail})`, aufgerufen in **jeder** Schreib-Route der App (ersetzt/ergänzt `addAktivitaet`). Bei Updates die geänderten Kernfelder als `vorher/nachher`-Diff (G-D).
2. **Zugriffs-/Export-Audit:** Hono-Middleware auf den Wohngeld-Routen protokolliert **GET auf `/vorgaenge/:id/detail`** (= Fall geöffnet, Lesezugriff) sowie **Datei-/Export-GETs** (`/dokumente/:id/datei`, `/schreiben/:id/export`, `/verfuegung/export`). Reine List-GETs müssen nicht einzeln (Datensparsamkeit), Detail-Öffnung schon.

**Identität (G-F):** Helfer schreibt `akteur_id` + `akteur_name` + aufgelöste `akteur_rolle` (aus `appRole`
im Context) + optional `ip`. Dafür Nutzer-Name/Rolle im Request bereitstellen (Context erweitern).

**Persistenz/Revisionssicherheit (G-E):** Postgres (nicht das flüchtige File-Log). Append-only
(keine Update/Delete-API). **Stufe 2 optional:** Hash-Kette (`hash = H(prev_hash + row)`) für
Nachweis der Unverändertheit. Retention = Aufbewahrungsfrist des Falls (G-J), nicht 90 Tage.

**Anbindung an bestehende UX:**
- Der vorhandene **Details-Tab „Aktivitäten"** wird zum **fallbezogenen Protokoll** (chronologisch,
  mit Akteur/Zeit/Aktion; Diffs aufklappbar). Nutzt bereits das rechte Seitenleisten-Muster.
- Neue **Admin/DSB-Ansicht „Protokoll"** (eigener View wie „Wiedervorlage/Aufgaben" auf `WohngeldPage`
  oder Settings-Unterseite): Suche/Filter nach Nutzer, Vorgang, Zeitraum, Aktion; **inkl. Lesezugriffe**;
  Export (CSV/PDF) für Revision/Auskunft. Zugriff nur owner/DSB-Rolle.

**Nicht-Ziele:** kein Klick-für-Klick-UI-Tracking, keine Leistungskontrolle, kein Prompt-/Antwort-Volltext
im Audit (nur Metadaten), keine List-GET-Einzelprotokollierung.

### G-G — Rollen, Funktionstrennung, Least Privilege (Priorität 2)

**Spec:**
- **Editor-Gate konsistent** auf allen Schreib-Routes (`denyIfNotAppEditor`) — heute nur in `feldstatus.ts`.
- **Optionale 4. Rolle „Entscheider"** (oder Flag) für **Verfügung speichern/erzeugen** →
  ermöglicht **Vier-Augen** (Bearbeiter ≠ Entscheider). Pragmatisch: konfigurierbar pro Kommune,
  Default = editor darf entscheiden. Vier-Augen als opt-in.
- **Admin-Enforcement serverseitig** an App-Verwaltung (`/api/apps/:id/enable|disable|permissions`) +
  **Audit** jeder Permission-/Enable-Änderung (`permission.geaendert`).
**Nicht-Ziele:** keine feingranulare Feld-/Sektions-ACL, kein mandantenübergreifendes Rollen-Framework.

### G-H — KI-Governance & Aufsicht (AI Act 12/13/14, Art. 22) (Priorität 2)

**Spec:**
- **Menschliche Aufsicht erlebbar:** KI-Vorschläge bleiben gekennzeichnet (feld_status) + bestätigungspflichtig;
  Chat/Prüfschritte sind Vorschläge; Verfügung nur durch Mensch. **Dokumentierte Bewertung** „echte
  Assistenz, kein Profiling" als Repo-Dokument (Grundlage AI-Act-Ausnahme Art. 6 Abs. 3).
- **KI-Nutzungs-Protokoll vervollständigen:** `usageContext` bei **allen** LLM-Aufrufen der App setzen
  (auch Schreiben-Generator, falls LLM); **Modell-ID + Prompt-/Regelkatalog-Version + Fall-Bezug**
  mitschreiben; Token-Spalten befüllen. Sicht „KI-Nutzung je Vorgang".
- **Transparenz gegenüber Betroffenen (Art. 13/14):** Textbaustein/Hinweis, dass KI-Assistenz genutzt
  wurde und die Entscheidung ein Mensch getroffen hat (für Bescheid/Anschreiben).
**Nicht-Ziele:** kein Auto-Retraining auf Falldaten, keine Score-basierte Priorisierung von Personen (Profiling).

### G-I — Betroffenenrechte (Art. 15–18) (Priorität 3)

**Spec:** je Person/Akte:
- **Auskunft/Datenexport** (Art. 15/20): Ein-Klick-Export **aller** zu einer Person gespeicherten
  Daten (Stammdaten, Einkommen, Dokumente-Liste, Prüfschritte, Schreiben, Protokoll-Auszug) als PDF/JSON.
- **Berichtigung** (Art. 16): = bestehende Edit-Funktion, jede Korrektur landet im Audit (G-D).
- **Einschränkung** (Art. 18): Flag „Verarbeitung eingeschränkt" am Vorgang (nur noch lesend/gesperrt).
- **Löschung** (Art. 17): nachrangig zur Aufbewahrungsfrist → siehe G-J.
**Nicht-Ziele:** kein Self-Service-Portal für Bürger (interne Behörden-Funktion).

### G-J — Aufbewahrung & Löschung (Priorität 3)

**Spec:** `vorgang.data.aufbewahrung_bis` (bei Abschluss = Datum + Frist, Default 10 J. — konfigurierbar);
**Legal Hold**-Flag (verhindert Löschung); geplanter Job listet/löscht abgelaufene Fälle **nach
Bestätigung** (kein stilles Hard-Delete). Abgelehnte Anträge ohne Leistungsbezug kürzere Frist (~2 J.).
**Nicht-Ziele:** keine automatische unbeaufsichtigte Löschung; finale Fristen mit Kommune/Land klären.

### G-K — Organisatorische Deliverables (parallel, nicht Code)

Vorlagen/Dokumente im Repo anlegen (Ausfüllen mit Kommune/DSB): **DSFA (Art. 35)**,
**Verfahrensverzeichnis (Art. 30)**, **AI-Act-Assistenz-Bewertung (Art. 6 Abs. 3)**,
**TOM-Übersicht (Art. 32 / BSI)**, **Löschkonzept**, **AV-Vertrag-Bausteine (§ 80 SGB X)**.

### G-L — Barrierefreiheit (BITV) (Priorität 4)

**Spec:** BITV-2.0/EN-301549-Check der App-UI (Tastaturbedienung, Kontraste, Screenreader-Labels);
als Governance-Kriterium in die Abnahme aufnehmen. **Nicht-Ziel:** vollständiges Re-Design.

---

## 5. Umsetzungs-Wellen (Vorschlag)

| Welle | Inhalt | Deckt Gap |
|---|---|---|
| **GOV-1 (Minimum)** | `audit_log`-Tabelle + zentraler `audit()`-Helfer in allen Schreib-Routes + Zugriffs-/Export-Middleware + Akteur-Identität; Fall-Protokoll-Tab aufwerten | G-A, G-B, G-C, G-D, G-E, G-F |
| **GOV-2** | Editor-Gate konsistent + Admin-Enforcement + Permission-Änderungen auditiert + optional Rolle „Entscheider"/Vier-Augen | G-G |
| **GOV-3** | KI-Usage-Log vervollständigen (Modell/Version/Fallbezug/Tokens) + „KI-Nutzung"-Sicht + Transparenz-Hinweis + Assistenz-Bewertung dokumentieren | G-H |
| **GOV-4** | Admin/DSB-Protokoll-Ansicht (Suche/Export) + Betroffenen-Auskunftsexport | G-A(Sicht), G-I |
| **GOV-5** | Retention/Legal Hold/Fristen-Löschung + Einschränkungs-Flag | G-J, G-I |
| **GOV-6 (org.)** | DSFA/VVT/AI-Act/TOM/Löschkonzept-Vorlagen + BITV-Check | G-K, G-L |

**Empfehlung:** GOV-1 zuerst (erfüllt die Mindestanforderung und den Kern der Rechtspflichten),
danach GOV-2/GOV-3.

---

## 6. Offene Punkte (mit Kommune/DSB/Personalrat zu klären)

1. **Aufbewahrungsfrist** final (Landesrecht) — Annahme 10 J.
2. **DSFA** durchführen (Pflicht wahrscheinlich) + **Verfahrensverzeichnis**.
3. **AI-Act-Einstufung** final bewerten & dokumentieren (Assistenz/Ausnahme, kein Profiling).
4. **Personalrat/Mitbestimmung** wegen Protokollierung (Zweckbindung „keine Leistungskontrolle").
5. **Vier-Augen-Prinzip** gewünscht? (Rolle „Entscheider" opt-in).
6. **Manipulationsschutz-Tiefe:** append-only genügt, oder Hash-Kette/Export-Signatur nötig?
7. **Digital-Omnibus-Frist** (AI Act) beobachten (~Dez 2027).

---

## 7. Quellen
`docs/wohngeld-governance-recherche-2026-09-19.md` (alle §§/Artikel mit URLs) + Code-Bestandsaufnahme
(Datei:Zeile) dieser Session.

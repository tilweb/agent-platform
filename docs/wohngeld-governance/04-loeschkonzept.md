# Löschkonzept — Wohngeld-Antragsassistent

**Rechtsgrundlagen:** §§ 27 Abs. 4, 33 Abs. 2 WoGG · § 45 Abs. 3 SGB X · Art. 5 Abs. 1 lit. e,
Art. 17/18 DSGVO · §§ 83 ff. SGB X · **App:** `wohngeld` · **Stand:** `[Datum einsetzen]`
**Status:** VORLAGE — Fristen final mit Kommune/Land zu klären.
**Grundlagen:** `docs/wohngeld-governance-recherche-2026-09-19.md` (Abschnitt 4),
`docs/wohngeld-governance-spec-2026-09-19.md` (G-I/G-J), CHANGELOG GOV-5.

> **Grundsatz.** Innerhalb der gesetzlichen Aufbewahrungsfrist besteht **kein Löschanspruch** nach
> Art. 17 DSGVO (Art. 17 Abs. 3 lit. b — rechtliche Aufbewahrungspflicht). Nach Fristablauf ist zu
> löschen bzw. dem Archiv anzubieten (Landesrecht). Datenminimierung gilt fortlaufend für
> KI-Nebenartefakte.

---

## 1. Aufbewahrungsfristen (Datenarten)

| Datenkategorie | Frist (Vorschlag) | Rechtsgrundlage / Hinweis | Status |
|---|---|---|---|
| Wohngeldakte (bewilligt/mit Leistungsbezug) | **~10 Jahre** ab `[Fristbeginn, i. d. R. 01.01. nach letzter Buchung]` | §§ 27 Abs. 4, 33 Abs. 2 WoGG; § 45 Abs. 3 SGB X | `[mit Kommune/Land final klären]` |
| Abgelehnter Antrag ohne vorherigen Bezug | **~2 Jahre** | Praxis; landesrechtlich | `[mit Kommune/Land final klären]` |
| Hochgeladene Dokumente/Belege | analog zur zugehörigen Akte | Bestandteil der Akte | `[klären]` |
| Verfahrensmetadaten (Prüfschritte, Verfügung, Notizen) | analog zur Akte | — | `[klären]` |
| **Fachliches Audit-Log** (`wohngeld.audit_log`) | an Fall-Aufbewahrung gekoppelt | Nachweis/Revision; nicht kürzer als Falllaufzeit | `[klären]` |
| Auth-/Sicherheits-Audit | **90 Tage** (Ist) | Datenminimierung; Sicherheit | `[Ist-App / anpassbar]` |
| KI-Usage-Log (`audit.usage_log`) | `[definieren]` | Nachweis KI-Nutzung | `[klären]` |
| KI-Nebenartefakte (Caches/Embeddings/Zwischenstände) | **so früh wie möglich** | Datenminimierung (Art. 5 lit. c) | `[org.]` |
| Backups | Rotation im Einklang mit obigen Fristen | Art. 32 | `[Infra]` |

**Fristbeginn / Berechnung:** `[landesrechtliche Regel bestätigen — typ. 1. Januar des Folgejahres
nach letzter Wohngeldbuchung/Bestandskraft]`.

## 2. App-Mechanik (Ist-Stand, GOV-5)

Die Anwendung setzt die Löschsteuerung ausschließlich in `vorgang.data` um (rückwärtskompatibel,
keine Migration):

| Mechanismus | Feld / Route | Wirkung |
|---|---|---|
| **Automatische Fristsetzung** | `aufbewahrungBis` (Helfer `retention.ts` → `berechneAufbewahrungBis`) | Beim Wechsel in Abschluss-Status (`abgeschlossen`/`entscheidung`) wird die Frist automatisch gesetzt (Default 10 J. via `WOHNGELD_AUFBEWAHRUNG_JAHRE`, 2 J. für abgelehnt via `WOHNGELD_AUFBEWAHRUNG_ABGELEHNT_JAHRE`); **nie überschrieben**, wenn schon gesetzt. |
| **Legal Hold** | `legalHold`, Route `PUT /vorgaenge/:id/legal-hold` (Owner-Gate) | Löschsperre; `DELETE /vorgaenge/:id` blockiert bei gesetztem Hold (409). Auditiert (`vorgang.legal_hold_gesetzt`/`_aufgehoben`). |
| **Löschfällig-Ansicht** | `GET /loeschfaellig` (Owner-Gate) + View „Löschfällig" in `WohngeldPage.jsx` | Listet Vorgänge, deren Frist abgelaufen ist und die keinen Legal Hold haben; Löschung je Zeile mit **Bestätigungsdialog** (kein stilles Hard-Delete). |
| **Löschfällig-Prüfung** | `istLoeschfaellig(vorgang, heute)` | Frist strikt < heute UND kein Legal Hold. |
| **Verarbeitungs-Einschränkung (Art. 18)** | `eingeschraenkt` + `denyIfEingeschraenkt` / `denyIfVorgangEingeschraenkt` | Eingeschränkte Vorgänge sind nur lesend; mutierende Routen antworten 403 („Verarbeitung eingeschränkt (Art. 18 DSGVO) — nur lesend."). |

## 3. Löschverfahren

1. **Fristermittlung:** automatisch über `aufbewahrungBis` beim Abschluss des Vorgangs.
2. **Regelmäßige Sichtung:** Owner/DSB ruft die **Löschfällig-Ansicht** auf (Turnus `[z. B. quartalsweise]`).
3. **Prüfung vor Löschung:** kein Legal Hold, keine laufenden Rechtsbehelfe/Rückforderungen, keine
   Archivrelevanz (Landesarchivrecht) `[org. bestätigen]`.
4. **Ausführung:** Löschung je Vorgang **nach Bestätigung** (Dialog); Cascade-Delete der zugehörigen
   Fachdaten und Dokumente/Belege (Objektspeicher) `[Umfang bestätigen]`.
5. **Archivierung statt Löschung:** falls landesrechtlich vorgesehen, **Anbietung ans Archiv** vor
   Vernichtung `[Verfahren mit Kommune/Archiv festlegen]`.
6. **Protokollierung:** die Löschung wird im **`wohngeld.audit_log`** festgehalten (Akteur, Zeit,
   Vorgangsbezug); das Audit selbst bleibt gemäß seiner eigenen Frist erhalten.

## 4. Verantwortlichkeiten

| Aufgabe | Verantwortlich |
|---|---|
| Fristenfestlegung (landesrechtlich) | `[Kommune/Rechtsamt + DSB]` |
| Regelmäßige Löschfällig-Sichtung | `[Owner/Leitung Wohngeldstelle]` |
| Freigabe/Bestätigung Löschung | `[Rolle einsetzen]` |
| Legal Hold setzen/aufheben | `[Owner/Rechtsamt]` |
| Backup-Rotation/Vernichtung | `[Betreiber/Infra]` |
| Kontrolle/Nachweis | `[DSB]` |

## 5. Betroffenenrechte (Bezug)

- **Löschung (Art. 17):** nachrangig zur Aufbewahrungsfrist — während der Frist i. d. R. kein Anspruch.
- **Einschränkung (Art. 18):** über `eingeschraenkt`-Flag (nur lesend) abbildbar.
- **Auskunft/Berichtigung (Art. 15/16):** siehe Governance-Spec G-I (Auskunftsexport, Edit+Audit).

---

## Zwingend zu klären (Kommune/Land/DSB)
Finale Fristen (10 J. / 2 J.) und Fristbeginn nach WoGVwV + Landes-Durchführungsvorschrift;
Archivierungspflicht/-verfahren (Landesarchivrecht); Retention Audit-/Usage-Log; Cascade-Umfang;
Sichtungs-Turnus; Verantwortliche/Freigaberollen.

## Quellen
`docs/wohngeld-governance-recherche-2026-09-19.md` (Abschnitt 4, WoGVwV/Landes-VwV mit URLs) ·
`docs/wohngeld-governance-spec-2026-09-19.md` (G-I/G-J) · CHANGELOG (GOV-5, `retention.ts`).

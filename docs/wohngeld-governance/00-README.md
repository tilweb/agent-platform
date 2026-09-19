# Governance-Dokumentation Wohngeld-Antragsassistent — Übersicht

**Stand:** 2026-09-19 · **Status:** VORLAGEN zur Ausfüllung/Freigabe · **App:** `wohngeld`
**Bezug:** Welle GOV-6 (organisatorische Deliverables, deckt G-K / G-L der Governance-Spec)

> **Zweck dieses Ordners.** Hier liegen die **organisatorischen Governance-Vorlagen** für den
> KI-gestützten Wohngeld-Antragsassistenten. Es handelt sich um **ausfüllbare Muster** — keine
> fertigen, rechtsverbindlichen Dokumente. Alle mit `[…]` markierten Felder sind vor Freigabe von
> der **Kommune / dem behördlichen Datenschutzbeauftragten (DSB) / dem Rechtsamt** zu befüllen.
> Die Vorlagen verweisen jeweils auf die konkreten technischen Mechanismen der App (mit Modul-/
> Feature-Namen) sowie die einschlägigen §§/Artikel — sie sind damit behörden-tauglich, aber
> **nicht** juristisch abgenommen.

---

## Warum diese Dokumente?

Der Assistent verarbeitet **Sozialdaten** (§ 35 SGB I, §§ 67 ff. SGB X) einschließlich besonderer
Kategorien nach Art. 9 DSGVO (Behinderung/Pflege/Gesundheit für Freibeträge). Er setzt KI zur
Assistenz ein (nicht zur Entscheidung). Aus diesem Verarbeitungsprofil folgen mehrere organisatorische
Nachweis- und Dokumentationspflichten (DSGVO, SGB X, EU AI Act, BITV), die die technische Umsetzung
allein nicht erfüllen kann. Diese Vorlagen strukturieren die nötigen Nachweise.

## Grundlagendokumente (im Repo, nicht Teil dieses Ordners)

| Dokument | Inhalt |
|---|---|
| `docs/wohngeld-governance-recherche-2026-09-19.md` | **Rechtsanker** — alle §§/Artikel mit Primärquellen-URLs (SGB I/X, DSGVO, AI Act, WoGG-Aufbewahrung, BSI, BITV). |
| `docs/wohngeld-governance-spec-2026-09-19.md` | **Governance-Spec** — was das Tool leisten muss, was es heute kann, Gap-Analyse (G-A…G-L), Umsetzungswellen GOV-1…GOV-6. |
| `docs/wohngeld-ai-act-assistenz-bewertung-2026-09-19.md` | **AI-Act-Assistenz-Bewertung** (Art. 6 Abs. 3) — Begründung, warum echte Assistenz aus dem Hochrisiko-Regime fällt (aus GOV-3). |

## Dokumente in diesem Ordner

| Datei | Rechtsgrundlage | Inhalt (1 Satz) |
|---|---|---|
| `01-datenschutz-folgenabschaetzung-dsfa.md` | Art. 35 DSGVO | Datenschutz-Folgenabschätzung: systematische Beschreibung der Verarbeitung, Notwendigkeit/Verhältnismäßigkeit, Risiken für die Betroffenen, Abhilfemaßnahmen (Verweis App-Mechanik), Restrisiko + DSB-Freigabe. |
| `02-verzeichnis-verarbeitungstaetigkeiten-vvt.md` | Art. 30 DSGVO | Verzeichnis der Verarbeitungstätigkeiten: Verantwortlicher/DSB, Zwecke, Rechtsgrundlagen, Kategorien Betroffener/Daten (inkl. Art-9), Empfänger/Auftragsverarbeiter, Drittland, Löschfristen, TOM-Verweis. |
| `03-tom-uebersicht.md` | Art. 32 DSGVO / BSI IT-Grundschutz | Technische und organisatorische Maßnahmen: Zugriffs-/Eingabe-/Trennungskontrolle, Protokollierung, Verschlüsselung, Verfügbarkeit — Ist-Stand der App + Platzhalter für Infrastruktur. |
| `04-loeschkonzept.md` | §§ 27/33 WoGG, § 45 SGB X, Art. 17/18 DSGVO | Löschkonzept: Aufbewahrungsfristen, App-Mechanik (aufbewahrungBis/Legal-Hold/Löschfällig-Ansicht/Einschränkung), Löschverfahren + Verantwortliche + Protokollierung. |
| `05-auftragsverarbeitung-av-bausteine.md` | Art. 28 DSGVO + § 80 SGB X | AV-Bausteine/Checkliste für den Vertrag mit Betreiber + Unterauftragsverarbeitern (Hosting/S3/LLM), inkl. SGB-X-Besonderheiten für Sozialdaten. |
| `06-bitv-barrierefreiheit-checkliste.md` | BITV 2.0 / EN 301549 | Prüfbare Barrierefreiheits-Checkliste für die App-UI mit Status-Spalte zum Abhaken. |

## Pflegehinweis

- **Abstimmung zwingend** mit **DSB**, **Kommune/Amtsleitung**, **Rechtsamt** und — wegen der
  Protokollierung (Zweckbindung „keine Leistungs-/Verhaltenskontrolle") — dem **Personalrat**.
- Diese Vorlagen sind **lebende Dokumente**: bei Änderungen an Verarbeitungszwecken, Datenarten,
  eingesetzten Modellen/Providern, Unterauftragsverarbeitern oder Fristen zu aktualisieren.
- Reihenfolge der Bearbeitung empfohlen: **VVT (02) → DSFA (01) → TOM (03) → Löschkonzept (04) →
  AV-Bausteine (05) → BITV-Check (06)**. VVT und TOM liefern Bausteine, auf die die DSFA verweist.
- Die **finalen Aufbewahrungsfristen** sind landesrechtlich (WoGVwV + Landes-Durchführungsvorschriften)
  und mit Kommune/Land zu klären — in den Vorlagen als solche markiert.
- Die **finale AI-Act-Einstufung** (Art. 6 Abs. 3) erfolgt über das separate Dokument
  `docs/wohngeld-ai-act-assistenz-bewertung-2026-09-19.md`; DSFA (01) und VVT (02) verweisen darauf.

## Rechtlicher Vorbehalt

Diese Dokumente ersetzen keine juristische Beratung. Muss-Listen zur DSFA (Art. 35 Abs. 4 DSGVO),
Aufbewahrungsfristen und die sozialdatenschutzrechtlichen AV-Zusätze sind teils landesrechtlich bzw.
aufsichtsbehördlich geregelt und mit dem DSB der jeweiligen Kommune final abzustimmen.

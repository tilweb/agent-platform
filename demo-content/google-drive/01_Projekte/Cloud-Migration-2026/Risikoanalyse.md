# Risikoanalyse: Cloud-Migration 2026

**Projekt-ID:** PRJ-2026-001
**Erstellt von:** Sarah Klein, Michael Hoffmann
**Datum:** 20.01.2026
**Letzte Aktualisierung:** 22.03.2026
**Review-Zyklus:** Alle 2 Wochen im Steering Committee

---

## 1. Risikobewertungsmatrix

| Stufe | Wahrscheinlichkeit | Auswirkung |
|-------|---------------------|------------|
| 1 | Sehr gering (< 10 %) | Vernachlässigbar |
| 2 | Gering (10–25 %) | Gering – intern kompensierbar |
| 3 | Mittel (25–50 %) | Mittel – Zeitplan/Budget betroffen |
| 4 | Hoch (50–75 %) | Hoch – Projekterfolg gefährdet |
| 5 | Sehr hoch (> 75 %) | Kritisch – Projektabbruch möglich |

**Risiko-Score = Wahrscheinlichkeit × Auswirkung**
Rot: ≥ 12 | Gelb: 6–11 | Grün: ≤ 5

---

## 2. Risikoregister

### R-001: Undokumentierte Legacy-Schnittstellen
- **Kategorie:** Technisch
- **Wahrscheinlichkeit:** 4 (Eingetreten)
- **Auswirkung:** 3
- **Score:** 12 🔴
- **Beschreibung:** Das SAP R/3-System hat undokumentierte REST-Schnittstellen zu internen Diensten (Lagerverwaltung, Rechnungsstellung, Zeiterfassung). Bei der Migration müssen diese identifiziert und nachgebaut werden.
- **Maßnahme:** Markus Lang führt seit 15.03. eine Schnittstellenanalyse durch. Ergebnis erwartet bis 04.04.2026.
- **Verantwortlich:** Markus Lang
- **Status:** In Bearbeitung

### R-002: Datenverlust bei der Migration
- **Kategorie:** Technisch
- **Wahrscheinlichkeit:** 2
- **Auswirkung:** 5
- **Score:** 10 🟡
- **Beschreibung:** Bei der Migration großer Datenbanken (> 500 GB) besteht das Risiko von Dateninkonsistenzen oder -verlusten.
- **Maßnahme:** Doppelte Datenhaltung während der Migrationsphase. Automatisierte Checksummen-Vergleiche nach jedem Migrationsschritt. Rollback-Strategie für jeden Migrationsschritt definiert.
- **Verantwortlich:** Markus Lang
- **Status:** Präventivmaßnahmen implementiert

### R-003: Aurora-Datenbank-Limits
- **Kategorie:** Technisch
- **Wahrscheinlichkeit:** 2
- **Auswirkung:** 4
- **Score:** 8 🟡
- **Beschreibung:** Die aktuelle Produktionsdatenbank umfasst 1,2 TB. Aurora unterstützt bis 128 TB, aber die I/O-Performance könnte bei bestimmten Query-Patterns einbrechen.
- **Maßnahme:** Performance-Tests mit produktionsnahen Daten ab April. Bei Bedarf Sharding-Strategie oder Wechsel auf Aurora Serverless v2.
- **Verantwortlich:** Michael Hoffmann
- **Status:** Beobachtung

### R-004: Kostenüberschreitung Cloud-Infrastruktur
- **Kategorie:** Finanziell
- **Wahrscheinlichkeit:** 3
- **Auswirkung:** 3
- **Score:** 9 🟡
- **Beschreibung:** Ohne aktives Kostenmanagement können Cloud-Kosten schnell eskalieren, insbesondere in der Phase des Parallelbetriebs.
- **Maßnahme:** AWS Cost Explorer und Budget-Alerts eingerichtet. Monatliches Kosten-Review. Auto-Shutdown für Dev/Staging außerhalb der Geschäftszeiten. Tobias Richter verantwortet das FinOps-Dashboard.
- **Verantwortlich:** Tobias Richter
- **Status:** Aktive Überwachung

### R-005: Personalausfall im Kernteam
- **Kategorie:** Organisatorisch
- **Wahrscheinlichkeit:** 2
- **Auswirkung:** 4
- **Score:** 8 🟡
- **Beschreibung:** Das DevOps-Team besteht aus nur 3 Personen (Peters, Schulz, Richter). Ein längerer Ausfall könnte den Zeitplan gefährden.
- **Maßnahme:** Cross-Training durchgeführt. Jedes Kernthema wird von mindestens 2 Personen beherrscht. Notfall-Rahmenvertrag mit CloudBridge GmbH für kurzfristige Verstärkung.
- **Verantwortlich:** Sarah Klein
- **Status:** Präventiv umgesetzt

### R-006: Sicherheitslücken in der Cloud-Architektur
- **Kategorie:** Sicherheit
- **Wahrscheinlichkeit:** 2
- **Auswirkung:** 5
- **Score:** 10 🟡
- **Beschreibung:** Fehlkonfigurationen in AWS (offene S3-Buckets, zu weitreichende IAM-Policies) könnten zu Sicherheitsvorfällen führen.
- **Maßnahme:** AWS Security Hub und GuardDuty aktiviert. Terraform-Module enthalten Security-Baselines. Vierteljährlicher Penetrationstest durch externe Firma geplant (erster Test: Mai 2026).
- **Verantwortlich:** Claudia Braun
- **Status:** Aktive Überwachung

### R-007: AWS-Kostenexplosion in Entwicklungsumgebung
- **Kategorie:** Finanziell
- **Wahrscheinlichkeit:** 3
- **Auswirkung:** 2
- **Score:** 6 🟡
- **Beschreibung:** Entwickler lassen Ressourcen über Nacht und am Wochenende laufen. Im Februar lagen die Dev-Kosten 40 % über Plan.
- **Maßnahme:** Automatischer Shutdown von Dev-Instanzen um 20:00 Uhr. Budget-Alarm bei 80 % Auslastung. Sensibilisierung im Team-Meeting am 05.03.
- **Verantwortlich:** Nina Schulz
- **Status:** Maßnahme greift, Kosten im März im Plan

### R-008: Widerstand im Entwicklungsteam
- **Kategorie:** Organisatorisch
- **Wahrscheinlichkeit:** 2
- **Auswirkung:** 3
- **Score:** 6 🟡
- **Beschreibung:** Einige Senior-Entwickler bevorzugen die gewohnte On-Premise-Umgebung und stehen Kubernetes/Container kritisch gegenüber.
- **Maßnahme:** Schulungsprogramm mit Hands-on-Workshops. Einbeziehung der kritischen Stimmen als "Cloud Champions". Regelmäßige Q&A-Sessions.
- **Verantwortlich:** Lisa Berger (HR), Michael Hoffmann
- **Status:** Erste Schulung positiv aufgenommen (4,2/5)

### R-009: Vendor Lock-in
- **Kategorie:** Strategisch
- **Wahrscheinlichkeit:** 3
- **Auswirkung:** 3
- **Score:** 9 🟡
- **Beschreibung:** Starke Nutzung von AWS-nativen Services (Aurora, SQS, Lambda) erhöht die Abhängigkeit vom Provider.
- **Maßnahme:** Wo möglich, Open-Source-Alternativen nutzen (PostgreSQL statt DynamoDB, RabbitMQ statt SQS). Multi-Cloud-Strategie mit Azure als Backup.
- **Verantwortlich:** Michael Hoffmann
- **Status:** In Architektur berücksichtigt

### R-010: Compliance-Anforderungen (DSGVO)
- **Kategorie:** Rechtlich
- **Wahrscheinlichkeit:** 2
- **Auswirkung:** 4
- **Score:** 8 🟡
- **Beschreibung:** Personenbezogene Daten dürfen nur in EU-Regionen gespeichert werden. Bei Fehlkonfiguration drohen DSGVO-Verstöße.
- **Maßnahme:** AWS-Region auf eu-central-1 (Frankfurt) und eu-west-1 (Irland) beschränkt. SCP-Policies verhindern Ressourcenerstellung in Nicht-EU-Regionen. Datenschutzbeauftragter hat Konzept geprüft und freigegeben (14.02.2026).
- **Verantwortlich:** Claudia Braun
- **Status:** Umgesetzt

---

## 3. Risiko-Heatmap (Stand: 22.03.2026)

```
Auswirkung
    5 │        R-002   R-006
    4 │   R-003 R-005  R-010          R-001
    3 │        R-008   R-004  R-009
    2 │               R-007
    1 │
      └──────────────────────────────────
        1      2      3      4      5
                 Wahrscheinlichkeit
```

## 4. Geschlossene Risiken

Bisher keine Risiken geschlossen. R-001 wird voraussichtlich bis Ende April geschlossen, sobald alle Legacy-Schnittstellen dokumentiert sind.

---

*Nächstes Review: 03.04.2026 (Steering Committee)*
*Dokument-Owner: Sarah Klein*

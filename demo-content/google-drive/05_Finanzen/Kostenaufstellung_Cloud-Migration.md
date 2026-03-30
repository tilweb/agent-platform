# Kostenaufstellung: Cloud-Migration 2026

**Projekt-ID:** PRJ-2026-001
**Erstellt von:** Stefan Huber (Projektcontroller)
**Geprüft von:** Dr. Karin Müller (CFO)
**Stand:** 20.03.2026

---

## 1. Gesamtbudget und Verbrauch

| Kennzahl | Betrag (€) |
|----------|-----------|
| **Gesamtbudget (genehmigt)** | **418.000** |
| Verbraucht bis 20.03.2026 | 114.800 |
| Verbleibend | 303.200 |
| **Verbrauchsquote** | **27,5 %** |
| **Zeitfortschritt** | **33 %** (3 von 9 Monaten) |

**Ampelstatus Budget:** 🟢 Grün – Budget ist leicht unter Plan, Prognose für Gesamtprojekt: 412.000 € (-1,4 %)

---

## 2. Detailierte Kostenaufstellung

### 2.1 Cloud-Infrastruktur

| Position | Budget (€) | Ist Q1 (€) | Prognose Gesamt (€) |
|----------|-----------|-------------|---------------------|
| AWS EKS (Kubernetes) | 48.000 | 8.200 | 46.000 |
| AWS EC2 (Compute) | 36.000 | 9.100 | 38.000 |
| AWS RDS/Aurora (Datenbanken) | 30.000 | 5.800 | 29.000 |
| AWS S3 (Storage) | 12.000 | 2.400 | 11.000 |
| AWS CloudFront (CDN) | 6.000 | 800 | 5.500 |
| AWS Route 53 (DNS) | 1.200 | 300 | 1.200 |
| AWS VPN / Direct Connect | 8.400 | 2.100 | 8.400 |
| Azure (Disaster Recovery) | 18.000 | 3.200 | 17.000 |
| Datadog (Monitoring) | 14.400 | 3.600 | 14.400 |
| Sonstige AWS-Services | 6.000 | 6.800 | 9.500 |
| **Summe Infrastruktur** | **180.000** | **42.300** | **180.000** |

**Anmerkung:** Die Position "Sonstige AWS-Services" liegt über Plan, da zusätzliche Services für die SAP-Schnittstellenanalyse benötigt wurden (Lambda, Step Functions). Wird durch Einsparungen bei S3 und CDN kompensiert.

### 2.2 Externe Beratung

| Dienstleister | Leistung | Budget (€) | Ist Q1 (€) | Prognose (€) |
|---------------|----------|-----------|-------------|---------------|
| CloudBridge GmbH | Architektur-Beratung | 60.000 | 35.500 | 62.000 |
| CloudBridge GmbH | Architektur-Review (zusätzlich) | – | 8.000 | 8.000 |
| SecureIT AG | Penetrationstest (Q2) | 25.000 | – | 25.000 |
| SAP-Consulting Rhein-Main | SAP-Migrationsberatung (beantragt) | – | – | 25.000 |
| Schulungs-Partner TÜV Süd | Cloud-Zertifizierungen | 10.000 | – | 10.000 |
| **Summe externe Beratung** | **120.000** | **43.500** | **130.000** |

**Achtung:** Die Prognose für externe Beratung liegt 10.000 € über Budget. Grund: Zusätzliches Architektur-Review (8.000 €) war ungeplant aber notwendig. Der SAP-Migrationsberater (25.000 €) ist noch nicht genehmigt – Entscheidung steht bis 04.04. aus. Falls genehmigt, wird das Gesamtbudget um 25.000 € erhöht (Antrag bei GF gestellt).

### 2.3 Schulungen

| Schulung | Teilnehmer | Budget (€) | Ist Q1 (€) | Prognose (€) |
|----------|-----------|-----------|-------------|---------------|
| AWS Cloud Practitioner (Grundlagen) | 15 | 8.000 | 5.400 | 5.400 |
| AWS Solutions Architect (Advanced) | 5 | 12.000 | – | 10.000 |
| Kubernetes Administrator (CKA) | 4 | 8.000 | 4.200 | 8.000 |
| Interne Workshops (Michael Hoffmann) | 42 | 3.000 | 1.200 | 3.000 |
| Terraform-Schulung (Online) | 8 | 4.000 | 2.000 | 3.600 |
| **Summe Schulungen** | | **35.000** | **12.800** | **30.000** |

**Einsparung:** Die AWS-Grundlagenschulung war günstiger als geplant, da wir einen Gruppenrabatt ausgehandelt haben.

### 2.4 Tools & Lizenzen

| Tool/Lizenz | Laufzeit | Budget (€) | Ist Q1 (€) | Prognose (€) |
|-------------|----------|-----------|-------------|---------------|
| Terraform Cloud (Team-Plan) | 12 Monate | 12.000 | 3.000 | 12.000 |
| GitHub Enterprise (Migration) | 12 Monate | 8.400 | 2.100 | 8.400 |
| Datadog APM (erweitert) | 12 Monate | 9.600 | 4.800 | 9.600 |
| AWS Organizations (Management) | 12 Monate | 3.600 | 900 | 3.600 |
| Snyk (Security Scanning) | 12 Monate | 6.000 | 3.000 | 6.000 |
| Sonstige | | 5.400 | 2.400 | 5.400 |
| **Summe Tools & Lizenzen** | | **45.000** | **16.200** | **45.000** |

**Anmerkung:** Datadog APM wurde bereits für das gesamte Halbjahr vorausbezahlt (daher höherer Q1-Wert). Jahreskosten bleiben im Budget.

### 2.5 Puffer

| Position | Budget (€) | Verbraucht (€) | Verbleibend (€) |
|----------|-----------|----------------|-----------------|
| Projektpuffer (10 %) | 38.000 | 0 | 38.000 |

**Status:** Puffer noch nicht angetastet. Falls der SAP-Berater nicht separat genehmigt wird, kann er aus dem Puffer finanziert werden.

---

## 3. Kostenentwicklung über Zeit

```
Kosten (Tsd. €)
450 ┤                                          ╭── Budget: 418
400 ┤                                    ╭─────╯
350 ┤                              ╭─────╯
300 ┤                        ╭─────╯
250 ┤                  ╭─────╯
200 ┤            ╭─────╯
150 ┤      ╭─────╯
100 ┤ ╭────╯ ← Ist: 115 (20.03.)
 50 ┤─╯
  0 ┤
    └──┬──┬──┬──┬──┬──┬──┬──┬──
      Jan Feb Mär Apr Mai Jun Jul Aug Sep
```

---

## 4. Kostenrisiken

| Risiko | Wahrscheinlichkeit | Potentieller Mehrbedarf (€) |
|--------|---------------------|---------------------------|
| SAP-Migrationsberater benötigt | Hoch (80 %) | 25.000 |
| AWS-Kosten in Parallelphase steigen | Mittel (40 %) | 15.000 |
| Zusätzliche Schulungen nötig | Niedrig (20 %) | 5.000 |
| Verlängerung ext. Beratung | Niedrig (20 %) | 10.000 |
| **Worst Case Mehrbedarf** | | **55.000** |

**Mitigation:** 38.000 € Puffer + Einsparungen bei Schulungen (~5.000 €) = 43.000 € verfügbar. Im Worst Case wären 12.000 € zusätzliches Budget nötig.

---

## 5. Monatliche Ist-Kosten

| Monat | Infra (€) | Beratung (€) | Schulung (€) | Tools (€) | Gesamt (€) |
|-------|-----------|-------------|-------------|-----------|------------|
| Jan 2026 | 11.500 | 15.000 | 2.200 | 5.400 | 34.100 |
| Feb 2026 | 14.200 | 12.500 | 5.400 | 5.400 | 37.500 |
| Mär 2026 | 16.600 | 16.000 | 5.200 | 5.400 | 43.200 |
| **Q1 Gesamt** | **42.300** | **43.500** | **12.800** | **16.200** | **114.800** |

**Trend:** Monatliche Kosten steigen leicht an, was erwartet ist (mehr Ressourcen in AWS aktiv). Ab Q2 wird ein Plateau bei ca. 45.000 €/Monat erwartet. In der Parallelphase (Q3) temporärer Anstieg auf ca. 55.000 €/Monat.

---

*Nächstes Kosten-Review: 15.04.2026 (Q1 Closing)*
*Bei Rückfragen: stefan.huber@workplacedemo.de*

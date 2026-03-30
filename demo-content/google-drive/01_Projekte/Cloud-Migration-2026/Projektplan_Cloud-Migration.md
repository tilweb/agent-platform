# Projektplan: Cloud-Migration 2026

**Projekt-ID:** PRJ-2026-001
**Projektleitung:** Sarah Klein
**Sponsor:** Thomas Weber (Geschäftsführung)
**Status:** In Umsetzung
**Letzte Aktualisierung:** 15.03.2026

---

## 1. Projektziel

Die Workplace Demo AG migriert bis Q3 2026 ihre gesamte On-Premise-Infrastruktur in eine Multi-Cloud-Umgebung (primär AWS, sekundär Azure). Ziel ist die Reduktion der Betriebskosten um 30 %, die Verbesserung der Skalierbarkeit und die Erhöhung der Verfügbarkeit auf 99,95 %.

## 2. Projektumfang

### In Scope
- Migration aller Produktivsysteme (ERP, CRM, Intranet)
- Aufbau einer Container-Plattform (Kubernetes auf AWS EKS)
- Implementierung einer CI/CD-Pipeline für alle Microservices
- Schulung der Entwicklungsteams (insgesamt 42 Personen)
- Einrichtung von Monitoring und Alerting (Datadog)

### Out of Scope
- Migration der Archivdaten (separates Projekt PRJ-2026-009)
- Neuentwicklung bestehender Applikationen
- Hardware-Entsorgung der On-Premise-Server

## 3. Meilensteine

| Nr. | Meilenstein | Termin | Verantwortlich | Status |
|-----|-------------|--------|----------------|--------|
| M1 | Infrastruktur-Assessment abgeschlossen | 31.01.2026 | Michael Hoffmann | ✅ Erledigt |
| M2 | Cloud-Architektur finalisiert | 28.02.2026 | Michael Hoffmann | ✅ Erledigt |
| M3 | Entwicklungsumgebung migriert | 31.03.2026 | Jan Peters | 🔄 In Arbeit |
| M4 | Staging-Umgebung migriert | 30.04.2026 | Jan Peters | ⏳ Geplant |
| M5 | Erste Produktivsysteme migriert | 31.05.2026 | Sarah Klein | ⏳ Geplant |
| M6 | Vollständige Migration abgeschlossen | 31.07.2026 | Sarah Klein | ⏳ Geplant |
| M7 | Projektabschluss und Lessons Learned | 31.08.2026 | Sarah Klein | ⏳ Geplant |

## 4. Phasenplanung

### Phase 1: Assessment & Planung (Jan–Feb 2026)
- Bestandsaufnahme aller Systeme und Abhängigkeiten
- Auswahl der Cloud-Provider und Services
- Erstellung der Migrationsreihenfolge
- **Ergebnis:** Migrationsstrategie-Dokument (abgenommen am 25.02.2026)

### Phase 2: Aufbau Cloud-Infrastruktur (Feb–Mär 2026)
- Terraform-Module für Netzwerk, Compute, Storage
- Einrichtung von IAM-Rollen und Security Groups
- VPN-Verbindung zwischen On-Premise und AWS
- DNS-Konzept und Zertifikatsmanagement

### Phase 3: Migration Development & Staging (Mär–Apr 2026)
- Containerisierung der Applikationen
- Aufbau der Kubernetes-Cluster
- Datenbank-Migration (PostgreSQL → Aurora)
- Integrationstests in der Staging-Umgebung

### Phase 4: Produktivmigration (Mai–Jul 2026)
- Schrittweise Migration nach Kritikalität
- Parallelbetrieb mit automatischem Failback
- Performance-Tests unter Last
- Go-Live der einzelnen Services

### Phase 5: Optimierung & Abschluss (Jul–Aug 2026)
- Kosten-Optimierung (Reserved Instances, Spot)
- Abbau der On-Premise-Infrastruktur
- Dokumentation und Wissenstransfer
- Lessons Learned Workshop

## 5. Projektteam

| Rolle | Name | Verfügbarkeit |
|-------|------|---------------|
| Projektleiterin | Sarah Klein | 80 % |
| Technische Leitung | Michael Hoffmann | 60 % |
| Cloud Architect | Jan Peters | 100 % |
| DevOps Engineer | Nina Schulz | 100 % |
| DevOps Engineer | Tobias Richter | 100 % |
| Security Engineer | Claudia Braun | 40 % |
| Datenbank-Spezialist | Markus Lang | 50 % |
| Testmanager | Petra Fischer | 60 % |

## 6. Budget

| Position | Geplant (€) | Aktuell (€) | Abweichung |
|----------|-------------|-------------|------------|
| Cloud-Infrastruktur (12 Monate) | 180.000 | 175.000 | -2,8 % |
| Externe Beratung | 120.000 | 125.000 | +4,2 % |
| Schulungen | 35.000 | 30.000 | -14,3 % |
| Tools & Lizenzen | 45.000 | 48.000 | +6,7 % |
| Puffer (10 %) | 38.000 | 38.000 | 0 % |
| **Gesamt** | **418.000** | **416.000** | **-0,5 %** |

## 7. Risiken

Siehe separates Dokument: `Risikoanalyse.md`

## 8. Kommunikation

- **Wöchentliches Standup:** Dienstag, 10:00 Uhr (Teams)
- **Steering Committee:** Alle 2 Wochen, Donnerstag 14:00 Uhr
- **Statusbericht:** Monatlich an Geschäftsführung
- **Slack-Channel:** #proj-cloud-migration

---

*Dokument erstellt von Sarah Klein, 10.01.2026*
*Letzte Änderung: 15.03.2026*

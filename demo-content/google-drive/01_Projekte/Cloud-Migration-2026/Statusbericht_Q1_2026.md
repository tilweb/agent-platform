# Statusbericht Cloud-Migration – Q1 2026

**Berichtszeitraum:** 01.01.2026 – 31.03.2026
**Projektleiterin:** Sarah Klein
**Berichtsdatum:** 28.03.2026
**Ampelstatus:** 🟡 Gelb (leichte Verzögerung bei M3)

---

## 1. Management Summary

Das Projekt Cloud-Migration befindet sich insgesamt im Plan. Die Assessment-Phase (M1) und die Architektur-Finalisierung (M2) wurden termingerecht abgeschlossen. Bei der Migration der Entwicklungsumgebung (M3) gibt es eine Verzögerung von ca. einer Woche aufgrund unvorhergesehener Abhängigkeiten im Legacy-System. Die Verzögerung hat keinen Einfluss auf den Gesamtzeitplan, da Pufferzeit eingeplant war.

## 2. Fortschritt nach Meilensteinen

### M1 – Infrastruktur-Assessment ✅
- Abgeschlossen am 28.01.2026 (3 Tage vor Plan)
- 127 Systeme inventarisiert, davon 89 für Migration vorgesehen
- 38 Systeme werden stillgelegt oder konsolidiert

### M2 – Cloud-Architektur ✅
- Abgeschlossen am 26.02.2026 (2 Tage vor Plan)
- Multi-AZ-Architektur auf AWS mit Disaster Recovery in Azure
- Architektur-Review durch externes Beratungsunternehmen (CloudBridge GmbH) bestanden
- Sicherheitskonzept von Claudia Braun freigegeben

### M3 – Entwicklungsumgebung 🔄
- **Plantermin:** 31.03.2026
- **Prognose:** 07.04.2026 (1 Woche Verzögerung)
- **Grund:** Das Legacy-ERP-System (SAP R/3) hat undokumentierte Schnittstellen zu drei internen Microservices. Diese müssen vor der Migration gemappt und angepasst werden.
- **Maßnahme:** Markus Lang unterstützt seit 15.03. zusätzlich bei der Schnittstellenanalyse.

## 3. Highlights des Quartals

1. **Terraform-Module produktionsreif:** Jan Peters hat ein wiederverwendbares Terraform-Modul-Set erstellt, das unsere gesamte AWS-Infrastruktur als Code abbildet. Code-Review durch Michael Hoffmann am 12.03. erfolgreich.

2. **Kubernetes-Cluster aufgesetzt:** Der EKS-Cluster für die Entwicklungsumgebung läuft seit 01.03. stabil. Erste Applikationen (Intranet, Ticketsystem) sind bereits containerisiert.

3. **Schulungsprogramm gestartet:** Am 10.03. fand die erste von vier Cloud-Schulungen statt. 18 Entwickler:innen haben teilgenommen. Feedback-Score: 4,2/5.

4. **VPN-Tunnel aktiv:** Die Site-to-Site-VPN-Verbindung zwischen unserem Rechenzentrum und AWS eu-central-1 ist seit 20.02. produktiv.

## 4. Risiken & Issues

| ID | Beschreibung | Wahrscheinlichkeit | Auswirkung | Maßnahme | Status |
|----|-------------|---------------------|------------|----------|--------|
| R-001 | Undokumentierte SAP-Schnittstellen | Eingetreten | Mittel | Schnittstellenanalyse durch M. Lang | In Arbeit |
| R-003 | Datenbankgröße überschreitet Aurora-Limits | Niedrig | Hoch | Monitoring der DB-Größe, ggf. Sharding | Beobachtung |
| R-005 | Personalausfall im DevOps-Team | Niedrig | Hoch | Cross-Training zwischen Peters/Schulz/Richter | Präventiv |
| R-007 | AWS-Kostenexplosion in Dev-Umgebung | Mittel | Mittel | Budget-Alerts eingerichtet, Auto-Shutdown nachts | Aktiv |

## 5. Budgetübersicht Q1

| Position | Budget Q1 (€) | Ist Q1 (€) | Abweichung |
|----------|---------------|-------------|------------|
| Cloud-Infrastruktur | 45.000 | 42.300 | -6,0 % |
| Externe Beratung | 40.000 | 43.500 | +8,8 % |
| Schulungen | 15.000 | 12.800 | -14,7 % |
| Tools & Lizenzen | 15.000 | 16.200 | +8,0 % |
| **Gesamt Q1** | **115.000** | **114.800** | **-0,2 %** |

Die leichte Mehrausgabe bei externer Beratung resultiert aus dem zusätzlichen Architektur-Review durch CloudBridge. Dies wird durch Einsparungen bei den Schulungen kompensiert.

## 6. Nächste Schritte (Q2 2026)

1. Abschluss M3 (Entwicklungsumgebung) bis 07.04.2026
2. Start der Staging-Migration ab 14.04.2026
3. Containerisierung der verbleibenden 12 Applikationen
4. Zweite und dritte Schulungsrunde (April/Mai)
5. Datenbank-Migrationsstrategie für Aurora finalisieren
6. Performance-Baseline für Produktivsysteme erstellen

## 7. Entscheidungsbedarf

1. **Budget-Freigabe für zusätzlichen Cloud Architect:** Aufgrund der Komplexität der SAP-Migration empfiehlt das Projektteam die temporäre Beauftragung eines externen SAP-Cloud-Spezialisten (geschätzt: 25.000 €, Zeitraum: April–Mai). Entscheidung erbeten bis 04.04.2026.

2. **Zeitpunkt der DNS-Umstellung:** Soll die DNS-Umstellung für kundennahe Services am Wochenende oder in einem Wartungsfenster unter der Woche erfolgen? Abstimmung mit dem Vertrieb erforderlich.

---

*Erstellt von Sarah Klein, 28.03.2026*
*Verteiler: Thomas Weber, Michael Hoffmann, Steering Committee*

Document Grobkonzept.pdf: """Grobkonzept

Die 5 wertvollsten Szenarien für Adacor

Ich bewerte nach: Zeitersparnis × Häufigkeit × strategischer Hebel

🥇 Szenario 1: Intelligent Incident Context

Das Problem heute

Ein Ticket kommt rein: „Server reagiert nicht". Der Support-Mitarbeiter muss jetzt:

Im ERP nachschauen: Wer ist der Kunde, welcher Vertrag, welches SLA?

In Netbox: Welche Infrastruktur, welche Abhängigkeiten?

In Autodoc/Terraform: Aktuelle Konfiguration?

In Youtrack: Gab es das schon mal?

In Confluence: Gibt es ein Runbook?

Im Monitoring-Report: Was sagen die letzten 24h?

Im Servicekatalog: Was ist überhaupt beauftragt?

→ 10-20 Minuten Kontextaufbau, bevor die eigentliche Arbeit beginnt

Die Lösung

┌─────────────────────────────────────────────────────────────────┐
│  🎫  Ticket #4711: "Server reagiert nicht" – Kunde: MusterGmbH   │
├─────────────────────────────────────────────────────────────────┤

│                                                                  │

│  ⚡ SOFORT-KONTEXT (automatisch geladen)                        │
│  ├─ SLA: Premium 24/7 – Reaktionszeit 15 Min ⚠                  │
│  ├─ Betroffenes System: prod-web-01 (siehe Netbox)              │

│  ├─ Gebuchte Services: Managed Linux, Managed Backup            │

│  └─ Vertragsstatus: Aktiv bis 12/2025, Umsatz €4.200/Monat      │

│                                                                  │
│  📊  MONITORING LETZTE 24H                                        │
│  ├─ 03:42 – CPU Spike 98% (5 Min)                               │

│  ├─ 03:47 – Disk I/O Warning                                    │

│  └─ 04:12 – Service httpd: no response                          │
│                                                                  │
│  🔗  ABHÄNGIGKEITEN (aus Netbox)                                 │
│  ├─ DB: prod-db-01 (Status: OK)                                 │

│  ├─ LB: lb-cluster-a (Status: OK)                               │
│  └─ Storage: san-pool-3 (Status: ⚠  degraded)                   │
│                                                                  │

│  📜  HISTORIE                                                     │
│  ├─ Ähnliches Ticket 03/2024: Storage-Engpass → Lösung: ...     │
│  └─ Letzter Change: 2 Tage – Kernel Update                      │
│                                                                  │
│  📖  EMPFOHLENE RUNBOOKS                                          │
│  ├─ "Linux Server Troubleshooting" (87% Match)                  │
│  └─ "Storage Performance Debug" (72% Match)                     │
│                                                                  │
│  💬  AGENT FRAGEN                                                 │
│  ┌─────────────────────────────────────────────────────────┐    │
│  │ "Zeig mir die Storage-Auslastung der letzten Woche"     │    │
│  │ "Was wurde beim ähnlichen Incident 03/2024 gemacht?"    │    │
│  │ "Erstelle eine Kunden-Kommunikation für den Ausfall"    │    │
│  └─────────────────────────────────────────────────────────┘    │
└─────────────────────────────────────────────────────────────────┘

Business Value

Metrik

Heute

Mit Tool

Impact

Zeit bis Kontextverständnis

15 Min

30 Sek

-97%

Tickets pro Schicht

~12

~18

+50%

Eskalationen wg. SLA-Miss ~8/Monat ~2/Monat

-75%

Einarbeitungszeit neue MA 3 Monate 4 Wochen -70%

Geschätzter Wert: €150-250k/Jahr (Effizienz + weniger SLA-Penalties + schnelleres
Onboarding)

🥈 Szenario 2: Proactive Customer Health & Renewal
Intelligence

Das Problem heute

Kündigungen kommen "überraschend"

Renewal-Gespräche starten zu spät

Warnsignale (steigende Tickets, sinkende Nutzung, Zahlungsverzögerungen) werden
nicht systematisch erkannt

Account Manager haben keinen aggregierten Blick

Die Lösung

┌─────────────────────────────────────────────────────────────────┐
│  📊  CUSTOMER HEALTH DASHBOARD                                    │

├─────────────────────────────────────────────────────────────────┤
│                                                                  │
│  ⚠  ATTENTION REQUIRED (3 Kunden)                               │
│  ┌───────────────────────────────────────────────────────────┐  │
│  │ 🔴  TechStart GmbH              Health: 42/100 ↓           │  │
│  │    • Tickets +180% vs. Vormonat                           │  │
│  │    • Letzte Zahlung: 45 Tage überfällig                   │  │
│  │    • Kein Kontakt seit 67 Tagen                           │  │
│  │    • Vertrag endet: 45 Tage                               │  │
│  │    → Empfehlung: Sofortiges Gespräch, Eskalationsrisiko   │  │
│  │    [Termin buchen] [Analyse öffnen] [Historie]            │  │
│  ├───────────────────────────────────────────────────────────┤  │
│  │ 🟡  MedDevice AG                Health: 61/100 ↓           │  │
│  │    • Support-Zufriedenheit gesunken (aus Ticket-Feedback) │  │
│  │    • Ressourcennutzung -30% (Downsizing-Risiko?)          │  │
│  │    • Anfrage zu Mitbewerber-Feature (aus Confluence-Log)  │  │
│  │    → Empfehlung: Check-in Gespräch, Bedarfsanalyse        │  │
│  └───────────────────────────────────────────────────────────┘  │
│                                                                  │
│  📅  RENEWAL PIPELINE (nächste 90 Tage)                          │
│  ┌───────────────────────────────────────────────────────────┐  │

│  │ Kunde          │ Enddatum │ ARR     │ Health │ Status     │  │

│  │────────────────│──────────│─────────│────────│────────────│  │
│  │ LogistikPro    │ +32 Tage │ €86k    │ 89/100 │ ✅  Gespräch │  │
│  │ TechStart      │ +45 Tage │ €52k    │ 42/100 │ ⚠  Risiko  │  │
│  │ FinanceHub     │ +67 Tage │ €124k   │ 78/100 │ 📅  Planen  │  │
│  │ RetailNext     │ +81 Tage │ €38k    │ 91/100 │ –          │  │

│  └───────────────────────────────────────────────────────────┘  │

│                                                                  │
│  💬  AGENT FRAGEN                                                 │
│  "Warum ist der Health Score von TechStart gefallen?"           │

│  "Erstelle eine Renewal-Präsentation für FinanceHub"            │

│  "Welche Upsell-Möglichkeiten gibt es bei LogistikPro?"         │

└─────────────────────────────────────────────────────────────────┘

Health Score Komponenten

Signal

Quelle

Gewichtung

Ticket-Trend (Anzahl & Sentiment) Youtrack

Zahlungsverhalten

ERP

25%

20%

Ressourcennutzung vs. Vertrag

Netbox, Cloud-APIs

15%

Kommunikationsfrequenz

Pipedrive

Monitoring-Stabilität

Email-Reports

15%

15%

Feature-Anfragen / Beschwerden

Youtrack, Confluence 10%

Business Value

Metrik

Churn-Rate

Renewal-Gespräche rechtzeitig ~60%

~95%

"Überraschungs"-Kündigungen

~8/Jahr

~1/Jahr

Heute

Mit Tool

Impact

~12%/Jahr ~7%/Jahr

-40%

+58%

-87%

Upsell-Identifikation

Ad-hoc

Systematisch +30% Upsell

Geschätzter Wert: €200-400k/Jahr (bei €5M ARR: 5% weniger Churn = €250k)

🥉 Szenario 3: Smart Proposal & Service Configuration

Das Problem heute

Angebotserstellung dauert Stunden/Tage

Jeder macht es anders

Servicekatalog im Confluence ist schwer zu navigieren

Preisfindung inkonsistent

Technische Machbarkeit unklar bis zum Presales-Gespräch

Die Lösung

┌─────────────────────────────────────────────────────────────────┐
│  📝  PROPOSAL GENERATOR                                           │
├─────────────────────────────────────────────────────────────────┤

│                                                                  │

│  Kunde: NeuKunde AG (aus Pipedrive übernommen)                  │

│  Branche: E-Commerce │ Größe: Mittelstand │ Kontakt: M. Schmidt │

│                                                                  │
│  💬  "Erstelle ein Angebot für eine AWS-Migration mit            │
│      ca. 20 VMs, HA-Anforderung, und 24/7 Support"              │

│                                                                  │

│  ────────────────────────────────────────────────────────────── │

│                                                                  │
│  🤖 VORGESCHLAGENE KONFIGURATION                                │
│                                                                  │

│  Basierend auf: Servicekatalog + ähnliche Kunden + Best Practice│
│                                                                  │
│  ┌─ Infrastruktur ──────────────────────────────────────────┐   │
│  │ • AWS Multi-AZ Setup (eu-central-1)                      │   │

│  │ • 20x EC2 (Mix aus m5.large/xlarge empfohlen)            │   │

│  │ • RDS Multi-AZ für Datenbank                             │   │

│  │ • ALB + WAF                                              │   │
│  │ • S3 + CloudFront für Static Content                     │   │
│  │                                                          │   │
│  │ 💡  Ähnlicher Kunde "ShopDirect" nutzt dieses Setup       │   │
│  │    erfolgreich seit 2 Jahren                             │   │
│  └──────────────────────────────────────────────────────────┘   │
│                                                                  │
│  ┌─ Managed Services (aus Servicekatalog) ──────────────────┐   │
│  │ ✅  Managed AWS Infrastructure – Premium     €2.400/Monat │   │
│  │ ✅  Managed Linux – 20 Instanzen            €1.600/Monat │   │
│  │ ✅  24/7 Support – Premium SLA               €1.200/Monat │   │
│  │ ✅  Managed Backup – Standard                  €400/Monat │   │
│  │ ☐  Managed Security (empfohlen für E-Com)    €800/Monat │   │
│  │ ☐  Managed Kubernetes (Alternative zu VMs)      Anfrage │   │
│  └──────────────────────────────────────────────────────────┘   │
│                                                                  │
│  📊  KALKULATION                                                  │
│  │ Setup (einmalig):     €12.000 – €18.000                  │   │
│  │ MRR:                   €5.600 – €6.400                   │   │
│  │ Erwartete AWS-Kosten:  €3.000 – €4.500/Monat             │   │

│  │                                                          │   │

│  │ Vergleich: Ähnliche Deals lagen bei €5.200 MRR median    │   │

│                                                                  │

│  [Angebot in Pandadoc erstellen] [Anpassen] [Presales-Check]    │

└─────────────────────────────────────────────────────────────────┘

Business Value

Metrik

Heute

Mit Tool

Impact

Zeit für Angebotserstellung 4-8 Std

30-60 Min

-85%

Angebote pro Woche/MA

~3

~10

+230%

Preiskonsistenz

Variabel Standardisiert Weniger Margin-Verlust

Win-Rate

~25%

~35%

+40% (bessere Passgenauigkeit)

Geschätzter Wert: €100-200k/Jahr (mehr Deals + bessere Margen + Sales-Kapazität)

4️⃣ Szenario 4: Unified Customer Search & Knowledge
Assistant

Das Problem heute

Wissen ist über 7+ Systeme verteilt

"Wo steht nochmal...?" kostet täglich Zeit

Neuen Mitarbeitern fehlt der Überblick

Gleiche Fragen werden immer wieder gestellt

Die Lösung

┌─────────────────────────────────────────────────────────────────┐
│  🔍  UNIFIED SEARCH                                               │
├─────────────────────────────────────────────────────────────────┤
│                                                                  │
│  ┌─────────────────────────────────────────────────────────┐    │

│  │ "Kubernetes Setup MusterGmbH Netzwerk"                   │    │
│  └─────────────────────────────────────────────────────────┘    │

│                                                                  │
│  📄  ERGEBNISSE (0.3 Sek)                                        │
│                                                                  │
│  ┌─ Confluence ──────────────────────────────────────────────┐  │
│  │ 📖  "MusterGmbH – Kubernetes Architecture"                 │  │
│  │    Letzte Änderung: vor 12 Tagen                         │  │

│  │    "...3-Node Cluster mit Calico CNI, Ingress über..."   │  │
│  └───────────────────────────────────────────────────────────┘  │

│                                                                  │
│  ┌─ Netbox ──────────────────────────────────────────────────┐  │
│  │ 🖥  k8s-master-01, k8s-worker-01..03                       │  │
│  │    VLAN: 2847 │ Subnet: 10.42.17.0/24                    │  │

│  │    [Topologie anzeigen]                                   │  │
│  └───────────────────────────────────────────────────────────┘  │

│                                                                  │
│  ┌─ Youtrack ────────────────────────────────────────────────┐  │
│  │ 🎫  ADAC-2341: "K8s Network Policy Update"                 │  │
│  │    Status: Resolved │ vor 3 Wochen                       │  │
│  │ 🎫  ADAC-2187: "Calico Upgrade auf 3.26"                   │  │
│  │    Status: Resolved │ vor 2 Monaten                      │  │

│  └───────────────────────────────────────────────────────────┘  │
│                                                                  │

│  ┌─ Autodoc/Terraform ───────────────────────────────────────┐  │
│  │ ⚙  Aktuelle Config: terraform/customers/muster/k8s/       │  │
│  │    Letzter Apply: vor 3 Wochen                           │  │
│  └───────────────────────────────────────────────────────────┘  │

│                                                                  │
│  💬  FOLLOW-UP FRAGEN                                            │
│  "Erkläre mir die Netzwerk-Architektur"                         │
│  "Gab es Probleme mit diesem Setup?"                            │

│  "Wer war an der letzten Änderung beteiligt?"                   │
└─────────────────────────────────────────────────────────────────┘

Business Value

Metrik

Heute

Mit Tool

Impact

Zeit für Informationssuche

~45 Min/Tag/MA ~10 Min/Tag/MA -78%

Bei 30 MA:

22,5 Std/Tag

5 Std/Tag

17,5 Std/Tag gespart

Onboarding-Zeit

3 Monate

4-6 Wochen

-60%

Wissenstransfer bei Abgang Kritisch

Systematisch

Risikominimierung

Geschätzter Wert: €80-150k/Jahr (Zeitersparnis + Onboarding + Wissenserhalt)

5️⃣ Szenario 5: Automated Operations Intelligence
(Monitoring → Action)

Das Problem heute

Monitoring-Reports kommen als Email → werden oft nur überflogen

Muster über Zeit werden nicht erkannt

Proaktive Wartung passiert zu selten

Zusammenhang zwischen Monitoring-Events und Tickets ist manuell

Die Lösung

┌─────────────────────────────────────────────────────────────────┐
│  📊  OPERATIONS INTELLIGENCE                                      │
├─────────────────────────────────────────────────────────────────┤

│                                                                  │
│  🔴  KRITISCHE PATTERNS ERKANNT (letzte 7 Tage)                  │
│  ┌───────────────────────────────────────────────────────────┐  │
│  │ ⚠  Kunde: DataFlow GmbH                                   │  │
│  │                                                           │  │
│  │ Pattern: Disk-Warnungen steigend                         │  │

│  │ • Mo: 2 Warnings │ Di: 3 │ Mi: 5 │ Do: 8 │ Fr: 12        │  │
│  │ • Betroffene Systeme: db-prod-01, db-prod-02             │  │

│  │ • Projektion: Kritisch in ~5 Tagen                       │  │
│  │                                                           │  │
│  │ 💡  Empfehlung: Proaktive Disk-Erweiterung                │  │
│  │    Geschätzter Aufwand: 2h │ Vermiedener Incident: Hoch  │  │
│  │                                                           │  │

│  │ [Wartungsticket erstellen] [Kunden informieren] [Details]│  │
│  └───────────────────────────────────────────────────────────┘  │

│                                                                  │
│  🟡  ANOMALIEN                                                    │
│  ┌───────────────────────────────────────────────────────────┐  │
│  │ • WebShop AG: Ungewöhnlicher Traffic-Anstieg (+340%)      │  │

│  │   → Mögliche Ursachen: Marketing-Kampagne? DDoS?         │  │
│  │   → Letzte Kommunikation checken                         │  │

│  │                                                           │  │
│  │ • LogistikPro: Backup-Dauer +50% vs. Baseline            │  │

│  │   → Datenbank-Wachstum prüfen                            │  │
│  └───────────────────────────────────────────────────────────┘  │

│                                                                  │
│  📈  WEEKLY DIGEST (KI-generiert)                                │
│  ┌───────────────────────────────────────────────────────────┐  │
│  │ "Diese Woche gab es 23% weniger kritische Alerts als     │  │

│  │  in der Vorwoche. Die häufigsten Issues waren Disk-      │  │
│  │  Warnungen (34%) und Certificate-Expirations (21%).       │  │

│  │                                                           │  │
│  │  3 Kunden zeigen Patterns, die auf baldige Incidents     │  │

│  │  hindeuten könnten. Proaktive Maßnahmen empfohlen für:   │  │
│  │  DataFlow GmbH, RetailMax, TechStart GmbH"               │  │

│  └───────────────────────────────────────────────────────────┘  │
│                                                                  │
│  💬  AGENT FRAGEN                                                 │
│  "Zeig mir alle Kunden mit steigenden Memory-Warnungen"         │

│  "Korreliere die Alerts von WebShop mit deren Ticket-Historie"  │
│  "Erstelle einen proaktiven Wartungsplan für nächste Woche"     │

└─────────────────────────────────────────────────────────────────┘

Business Value

Metrik

Incidents durch proaktive Wartung
vermeidbar

Heute

~20%

Mit Tool

Impact

~60%

+200%

MTTR (Mean Time to Resolution)

2.5 Std

1.5 Std

-40%

Kunden-Kommunikation bei Issues

Reaktiv

Proaktiv

Zeit für Monitoring-Review

30
Min/Tag

5
Min/Tag

NPS +15
Punkte

-83%

Geschätzter Wert: €100-180k/Jahr (weniger Incidents + schnellere Resolution +
Kundenzufriedenheit)

Zusammenfassung: ROI-Ranking

Rang Szenario

Geschätzter
Wert/Jahr

€200-400k

Customer Health &
Renewal

Intelligent Incident Context

€150-250k

Smart Proposal Generator

€100-200k

Operations Intelligence

€100-180k

🥇

🥈

🥉

4️⃣

5️⃣

Komplexität Quick Win

Mittel

Mittel

Hoch

Mittel

⭐ ⭐

⭐ ⭐ ⭐

⭐ ⭐

⭐ ⭐ ⭐

Unified Search &
Knowledge

€80-150k

Niedrig

⭐ ⭐ ⭐ ⭐

Empfohlene Reihenfolge für MVP

Phase 1 (Proof of Value): → Unified Search als Fundament (niedrige Komplexität, sofort

sichtbarer Nutzen) → Incident Context als erster Agent (hoher täglicher Impact)

Phase 2 (Business Impact): → Customer Health Score + Renewal Alerts → Operations
Intelligence (baut auf Phase 1 Infrastruktur auf)

Phase 3 (Revenue Acceleration): → Smart Proposal Generator

Sollen wir eines dieser Szenarien technisch vertiefen? Ich würde vorschlagen, wir schauen
uns die API-Landschaft an und definieren einen konkreten MVP-Scope für Phase 1.


"""
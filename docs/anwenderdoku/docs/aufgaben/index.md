# Hintergrund-Aufgaben

Hintergrund-Aufgaben (Tasks) ermöglichen es, längerlaufende oder komplexe KI-Operationen asynchron auszuführen -- unabhängig von einem laufenden Chat. Während eine Aufgabe im Hintergrund arbeitet, können Sie die Plattform wie gewohnt weiternutzen.

## Was sind Hintergrund-Aufgaben?

Im Gegensatz zum Chat, bei dem Sie in Echtzeit mit einem Agenten kommunizieren, laufen Hintergrund-Aufgaben eigenständig ab. Sie definieren, was der Agent tun soll, und die Plattform führt die Aufgabe autonom aus. Das ist besonders nützlich für:

- Umfangreiche Recherchen, die viele Quellen durchsuchen müssen
- Mehrstufige Analysen mit mehreren Arbeitsschritten
- Zeitgesteuerte oder wiederkehrende Operationen
- Aufgaben, die längere Verarbeitungszeit benötigen

> [!info] Chat vs. Hintergrund-Aufgabe
> Nutzen Sie den **Chat** für schnelle Fragen und interaktive Gespräche. Verwenden Sie **Hintergrund-Aufgaben** für Arbeitsaufträge, die länger dauern oder keinen Dialog erfordern.

## Aufgabentypen

Es stehen vier verschiedene Aufgabentypen zur Verfügung:

| Typ | Beschreibung | Typische Anwendung |
|---|---|---|
| **Einfach (simple)** | Einzelne Operation ohne Zwischenschritte | Zusammenfassung eines Dokuments, einfache Analyse |
| **Tiefenrecherche (deep-research)** | Umfangreiche Recherche über mehrere Quellen | Marktanalyse, Wettbewerbsrecherche, Themenüberblick |
| **Mehrstufig (multi-step)** | Aufgabe mit definierten Arbeitsschritten | Projektplanung, mehrteilige Berichte, komplexe Workflows |
| **Geplant (scheduled)** | Zeitgesteuerte oder wiederkehrende Ausführung | Regelmäßige Reports, geplante Analysen |

## Prioritäten

Jeder Aufgabe kann eine Priorität zugewiesen werden, die bestimmt, in welcher Reihenfolge wartende Aufgaben abgearbeitet werden:

| Priorität | Beschreibung |
|---|---|
| **Dringend (urgent)** | Wird als nächstes ausgeführt, überspringt die Warteschlange |
| **Hoch (high)** | Wird bevorzugt behandelt |
| **Normal** | Standardpriorität |
| **Niedrig (low)** | Wird abgearbeitet, wenn keine höherprioren Aufgaben warten |

## Status einer Aufgabe

Während ihres Lebenszyklus durchläuft eine Aufgabe verschiedene Status:

| Status | Beschreibung |
|---|---|
| **Ausstehend (pending)** | Aufgabe wurde erstellt, wartet auf Einreihung in die Warteschlange |
| **Warteschlange (queued)** | Aufgabe ist in der Warteschlange und wartet auf einen freien Ausführungsplatz |
| **Läuft (running)** | Aufgabe wird gerade aktiv vom Agenten bearbeitet |
| **Pausiert (paused)** | Ausführung wurde manuell pausiert, kann fortgesetzt werden |
| **Abgeschlossen (completed)** | Aufgabe wurde erfolgreich beendet |
| **Fehlgeschlagen (failed)** | Aufgabe ist mit einem Fehler abgebrochen |
| **Abgebrochen (cancelled)** | Aufgabe wurde manuell abgebrochen |

```
pending --> queued --> running --> completed
                        |  |
                        |  +--> failed
                        |
                        +--> paused --> running
                        |
                        +--> cancelled
```

## Aufgaben erstellen

### Aus dem Chat heraus

Während eines Chats können Sie den Agenten bitten, eine Aufgabe im Hintergrund auszuführen. Der Agent erstellt dann automatisch eine Hintergrund-Aufgabe und reiht sie in die Warteschlange ein.

### Über die Aufgaben-Seite

1. Navigieren Sie zu **Aufgaben** im Hauptmenü
2. Klicken Sie auf **Neue Aufgabe**
3. Geben Sie einen **Titel** und eine **Beschreibung** ein
4. Wählen Sie den **Aufgabentyp** und die **Priorität**
5. Optional: Definieren Sie einzelne Arbeitsschritte (bei mehrstufigen Aufgaben)
6. Klicken Sie auf **Aufgabe erstellen**

> [!tip] Gute Aufgabenbeschreibungen
> Je präziser die Beschreibung, desto besser das Ergebnis. Beschreiben Sie klar das Ziel, den gewünschten Umfang und das erwartete Ausgabeformat.

## Warteschlangen-Verwaltung

Die Aufgaben-Warteschlange steuert, wie viele Aufgaben gleichzeitig ausgeführt werden und in welcher Reihenfolge.

### Gleichzeitige Ausführung

Es können standardmäßig bis zu **2 Aufgaben gleichzeitig** ausgeführt werden. Dieses Limit kann in den Warteschlangen-Einstellungen angepasst werden. Weitere Aufgaben warten in der Warteschlange und werden automatisch gestartet, sobald ein Platz frei wird.

### Warteschlange pausieren/fortsetzen

Sie können die gesamte Warteschlange pausieren. In diesem Fall werden keine neuen Aufgaben gestartet, bereits laufende Aufgaben werden aber zu Ende geführt. Beim Fortsetzen werden wartende Aufgaben automatisch abgearbeitet.

### Einzelne Aufgaben steuern

Für jede laufende oder wartende Aufgabe stehen folgende Aktionen zur Verfügung:

- **Pausieren** -- Hält eine laufende Aufgabe an
- **Fortsetzen** -- Setzt eine pausierte Aufgabe fort
- **Abbrechen** -- Bricht eine Aufgabe endgültig ab

## Fortschrittsanzeige

Für jede aktive Aufgabe wird der Fortschritt in Prozent angezeigt. Bei mehrstufigen Aufgaben sehen Sie zusätzlich:

- Den aktuellen Schritt und die Gesamtzahl der Schritte
- Den Status jedes einzelnen Schritts
- Die bisherige Laufzeit

> [!info] Echtzeit-Updates
> Der Fortschritt wird per Server-Sent Events (SSE) in Echtzeit aktualisiert. Sie müssen die Seite nicht manuell neu laden.

## Ergebnisse einsehen

Nach Abschluss einer Aufgabe werden die Ergebnisse gespeichert und können jederzeit eingesehen werden:

1. Öffnen Sie die **Aufgaben**-Seite
2. Klicken Sie auf eine abgeschlossene Aufgabe
3. Die Ergebniszusammenfassung und ggf. der vollständige Bericht werden angezeigt

Ergebnisse werden als Markdown gespeichert und können formatierte Texte, Tabellen und Aufzählungen enthalten.

## Aufgaben wiederholen

### Fehlgeschlagene Aufgaben

Wenn eine Aufgabe fehlschlägt, können Sie sie erneut starten:

1. Öffnen Sie die fehlgeschlagene Aufgabe
2. Klicken Sie auf **Wiederholen**
3. Die Aufgabe wird zurückgesetzt und erneut in die Warteschlange eingereiht

### Abgeschlossene Aufgaben

Auch erfolgreich abgeschlossene Aufgaben können erneut ausgeführt werden:

1. Klicken Sie bei der abgeschlossenen Aufgabe auf **Wiederholen**
2. Eine neue Aufgabe mit denselben Parametern wird erstellt und eingereiht

> [!info] Automatische Wiederholung
> Aufgaben können so konfiguriert werden, dass sie bei einem Fehler automatisch erneut gestartet werden. Die Wartezeit zwischen den Versuchen verdoppelt sich jeweils (30 Sekunden, 1 Minute, 2 Minuten, ...). Standardmäßig sind bis zu 3 Wiederholungsversuche möglich.

## Statistik-Übersicht

Am oberen Rand der Aufgaben-Seite finden Sie eine Statistik-Übersicht mit den wichtigsten Kennzahlen:

| Kennzahl | Beschreibung |
|---|---|
| **Gesamt** | Gesamtanzahl aller Aufgaben |
| **Ausstehend** | Aufgaben in der Warteschlange |
| **Laufend** | Aktuell in Bearbeitung |
| **Abgeschlossen** | Erfolgreich beendete Aufgaben |
| **Fehlgeschlagen** | Mit Fehler abgebrochene Aufgaben |

Diese Übersicht gibt Ihnen einen schnellen Überblick über den aktuellen Stand Ihrer Hintergrund-Aufgaben.

## Aufgaben filtern

Nutzen Sie die Filter-Optionen, um Aufgaben gezielt zu finden:

- **Status-Filter** -- Zeigt nur Aufgaben mit einem bestimmten Status (z.B. nur laufende Aufgaben)
- **Typ-Filter** -- Filtert nach Aufgabentyp (einfach, Tiefenrecherche, mehrstufig, geplant)
- **Prioritäts-Filter** -- Filtert nach Priorität

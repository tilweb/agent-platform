# Profil & Modelle

Die Seite **Profil & Modelle** ist der persönliche Einstellungsbereich für jeden Benutzer. Hier können Sie Ihre Profilinformationen einsehen und individuelle Modellpräferenzen festlegen.

---

## Profil

Im Tab **Profil** werden Ihre persönlichen Kontoinformationen angezeigt.

### Avatar

Ihr Avatar wird automatisch aus den Initialen Ihres Anzeigenamens generiert. Der Avatar erscheint in der Sidebar und in Chatverläufen.

### Angezeigte Informationen

| Feld | Beschreibung |
|------|-------------|
| **Benutzername** | Ihr eindeutiger Anmeldename (wird beim Login verwendet) |
| **Anzeigename** | Ihr vollständiger Name, wie er in der Oberfläche angezeigt wird |
| **E-Mail** | Ihre hinterlegte E-Mail-Adresse |
| **Rolle** | Ihre Berechtigung im System (`Admin` oder `User`) |
| **Erstellt am** | Datum, an dem Ihr Konto angelegt wurde |

> [!info] Profiländerungen
> Änderungen an Benutzername, Rolle und anderen Kernfeldern können nur durch einen Administrator vorgenommen werden. Wenden Sie sich an Ihren Admin, falls Anpassungen nötig sind.

---

## Meine Modelle

Im Tab **Meine Modelle** können Sie festlegen, welche KI-Modelle für Sie persönlich verwendet werden sollen. Diese Einstellungen überschreiben die systemweiten Standardmodelle.

### Verfügbare Kategorien

Sie können für folgende Einsatzzwecke ein bevorzugtes Modell wählen:

| Kategorie | Beschreibung |
|-----------|-------------|
| **Chat** | Modell für Standard-LLM-Konversationen und Textgenerierung |
| **Vision** | Modell für Bildanalyse und visuelle Aufgaben |

### Auswahl treffen

Für jede Kategorie stehen Ihnen zwei Optionen zur Verfügung:

- **System-Standard verwenden**: Das vom Administrator konfigurierte Standardmodell wird verwendet. Diese Option ist vorausgewählt.
- **Eigenes Modell wählen**: Wählen Sie einen Provider und ein spezifisches Modell aus der Liste der verfügbaren Optionen.

### Modellinformationen

Bei der Auswahl eines Modells werden Ihnen folgende Details angezeigt:

- **Provider-Name**: Der Anbieter des Modells (z.B. Adacor AI, Nebius Token Factory)
- **Modellname**: Die genaue Bezeichnung des Modells (z.B. Qwen 3 30B, Mistral 3 24B)
- **Fähigkeiten**: Symbole zeigen an, welche Funktionen das Modell unterstützt:
    - **Tool-Calling**: Das Modell kann Werkzeuge und Funktionen aufrufen
    - **Vision**: Das Modell kann Bilder analysieren und verarbeiten

> [!info] Nur aktivierte Modelle
> In der Auswahlliste erscheinen ausschließlich Modelle von Providern, die vom Administrator aktiviert wurden. Falls ein benötigtes Modell nicht verfügbar ist, wenden Sie sich an Ihren Administrator.

### Zurücksetzen auf Standard

Um Ihre individuelle Auswahl zu entfernen und zum System-Standard zurückzukehren, wählen Sie einfach die Option **System-Standard verwenden** für die jeweilige Kategorie. Ihre Einstellung wird sofort gespeichert.

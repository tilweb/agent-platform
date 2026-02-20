# Bildgenerierung

Der Adacor Workplace verfügt über eine integrierte Bildgenerierung, mit der Sie KI-generierte Bilder direkt auf der Plattform erstellen können. Beschreiben Sie, was Sie sehen möchten, und die KI erzeugt passende Bilder für Sie.

## Text-zu-Bild

Beim Text-zu-Bild-Modus beschreiben Sie das gewünschte Bild in einem Textprompt. Die KI interpretiert Ihre Beschreibung und generiert ein oder mehrere passende Bilder.

### So funktioniert es

1. Öffnen Sie die Bildgenerierung (über den **Bildgenerator-Agent** oder den **/image-generation** Skill)
2. Geben Sie eine **Bildbeschreibung** (Prompt) ein
3. Wählen Sie das gewünschte **Seitenverhältnis**
4. Wählen Sie die **Anzahl der Bilder** (1--4)
5. Klicken Sie auf **Generieren**

Die Generierung dauert in der Regel wenige Sekunden. Sobald die Bilder fertig sind, werden sie in der Galerie angezeigt.

> [!example] Beispiel-Prompts
> - "Ein modernes Bürogebäude bei Sonnenuntergang, fotorealistisch"
> - "Abstrakte Darstellung von Datenströmen in blau und türkis, minimalistisch"
> - "Illustration einer Teamarbeit am Whiteboard, flacher Illustrationsstil"

## Bild-zu-Bild

Im Bild-zu-Bild-Modus laden Sie ein bestehendes Bild hoch und beschreiben, wie es verändert werden soll. Die KI verwendet das hochgeladene Bild als Ausgangspunkt und erzeugt eine transformierte Version.

### So funktioniert es

1. Laden Sie ein **Ausgangsbild** hoch
2. Beschreiben Sie die gewünschte **Transformation** im Prompt
3. Klicken Sie auf **Generieren**

> [!example] Beispiel-Transformationen
> - Originalfoto + "Wandle in eine Bleistiftzeichnung um"
> - Produktfoto + "Platziere das Produkt in einer modernen Küche"
> - Logo + "Erstelle eine Winterversion mit Schnee und Eiskristallen"

> [!info] Verfügbarkeit
> Bild-zu-Bild ist nur verfügbar, wenn ein entsprechendes Modell konfiguriert ist. Ob die Funktion zur Verfügung steht, sehen Sie in der Bildgenerierungs-Oberfläche.

## Seitenverhältnisse

Sie können aus fünf vordefinierten Seitenverhältnissen wählen:

| Seitenverhältnis | Format | Typische Verwendung |
|---|---|---|
| **1:1** | Quadratisch (1024 x 1024) | Profilbilder, Social-Media-Posts, Icons |
| **16:9** | Querformat (1792 x 1024) | Präsentationen, Header-Bilder, Hintergründe |
| **9:16** | Hochformat (1024 x 1792) | Smartphone-Hintergründe, Stories, Poster |
| **4:3** | Leichtes Querformat (1366 x 1024) | Blog-Bilder, Dokumentationen |
| **3:4** | Leichtes Hochformat (1024 x 1366) | Buchcover, Porträts |

## Mehrere Bilder pro Anfrage

Pro Generierungsanfrage können Sie **1 bis 4 Bilder** gleichzeitig erstellen lassen. Jedes Bild wird individuell generiert, sodass Sie verschiedene Interpretationen Ihres Prompts erhalten und das beste Ergebnis auswählen können.

## Verfügbare Anbieter

Die Bildgenerierung unterstützt verschiedene KI-Modelle, die unter **Einstellungen > KI-Modelle** konfiguriert werden. Dort können separate Modelle für Text-zu-Bild und Bild-zu-Bild festgelegt werden.

> [!warning] Konfiguration erforderlich
> Die Bildgenerierung ist nur verfügbar, wenn ein entsprechender Provider mit einem Bildgenerierungsmodell konfiguriert und aktiviert ist. Ohne aktiven Provider für Text-zu-Bild bzw. Bild-zu-Bild steht die Funktion nicht zur Verfügung.

## Tipps für gute Prompts

Die Qualität der generierten Bilder hängt maßgeblich von der Qualität Ihres Prompts ab.

> [!tip] Prompt-Tipps
> **Seien Sie spezifisch:** Beschreiben Sie genau, was Sie sehen möchten. Statt "ein Hund" schreiben Sie "ein Golden Retriever, der im Park spielt, bei Sonnenlicht".
>
> **Beschreiben Sie den Stil:** Geben Sie an, welchen visuellen Stil Sie wünschen -- z.B. "fotorealistisch", "Aquarell", "minimalistisch", "Cartoon", "3D-Rendering".
>
> **Stimmung und Beleuchtung:** Wörter wie "warm", "dramatisch", "hell", "Dämmerung" oder "Neonlicht" beeinflussen die Atmosphäre.
>
> **Komposition erwähnen:** Beschreiben Sie die Perspektive -- z.B. "Vogelperspektive", "Nahaufnahme", "Weitwinkel", "zentrierte Komposition".
>
> **Negative Anweisungen:** Manche Modelle unterstützen negative Prompts -- also Beschreibungen von Elementen, die nicht im Bild erscheinen sollen.

### Beispiele für effektive Prompts

| Weniger effektiv | Effektiver |
|---|---|
| "Ein Berg" | "Ein schneebedeckter Berggipfel bei Sonnenaufgang, dramatisches orangefarbenes Licht, Panorama-Weitwinkel, fotorealistisch" |
| "Eine Stadt" | "Eine futuristische Stadt bei Nacht mit Neonlichtern und fliegenden Autos, Cyberpunk-Stil, Regen auf den Straßen" |
| "Ein Logo" | "Minimalistisches Logo für ein Technologie-Unternehmen, geometrische Formen in Blau und Weiß, flaches Design, weißer Hintergrund" |

## Bildgalerie

Alle generierten Bilder werden in einer Galerie gespeichert. Dort können Sie:

- **Bilder ansehen** -- Klicken Sie auf ein Bild für die Vollansicht
- **Bilder herunterladen** -- Speichern Sie ein Bild lokal auf Ihrem Gerät
- **Bilder löschen** -- Entfernen Sie nicht mehr benötigte Bilder

## Zugang zur Bildgenerierung

Es gibt zwei Wege, die Bildgenerierung zu nutzen:

### Bildgenerator-Agent

Der **Bildgenerator-Agent** ist ein spezialisierter KI-Agent, der für die Bildgenerierung optimiert ist. Wählen Sie ihn als Agenten in einem Chat aus und beschreiben Sie Ihre Bildwünsche in natürlicher Sprache.

### /image-generation Skill

Der Skill **/image-generation** kann in jedem Chat aufgerufen werden, unabhängig vom gewählten Agenten. Er bietet eine strukturierte Oberfläche mit allen Optionen (Seitenverhältnis, Anzahl, etc.).

> [!tip] Wann welchen Weg wählen?
> Nutzen Sie den **Bildgenerator-Agent**, wenn Sie im Dialog Bilder erstellen und iterativ verfeinern möchten. Verwenden Sie den **/image-generation Skill**, wenn Sie schnell ein Bild mit spezifischen Einstellungen generieren möchten.

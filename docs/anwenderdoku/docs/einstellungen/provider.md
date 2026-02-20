# KI-Modelle & Provider

> [!warning] Administratorbereich
> Die Provider-Verwaltung ist nur für Benutzer mit der Rolle **Admin** sichtbar und zugänglich.

Provider sind die Schnittstellen zu KI-Diensten, die dem Adacor Workplace seine Intelligenz verleihen. Jeder Provider stellt ein oder mehrere Modelle mit unterschiedlichen Fähigkeiten bereit.

---

## Was sind Provider?

Ein Provider ist ein externer KI-Dienst (z.B. Adacor AI, OpenAI, Anthropic), der über eine API angebunden wird. Jeder Provider bietet verschiedene Modelle an, die für unterschiedliche Aufgaben optimiert sind. Der Adacor Workplace unterstützt die gleichzeitige Anbindung mehrerer Provider.

---

## Standard-Provider

Die folgenden Provider sind vorkonfiguriert:

### Aktivierte Provider

| Provider | Region | Standort | Modelle | Einsatzbereich |
|----------|--------|----------|---------|----------------|
| **Adacor AI** | Deutschland | DE | Mistral 3 24B (128K), Qwen 3 30B (256K), Qwen 3 Thinking 30B (256K) | Chat, Vision (primär) |
| **Nebius Token Factory** | EU | FI | GPT-OSS 120B (131K) | Chat |
| **Adacor AI Audio** | Deutschland | DE | Whisper V3 Large (30s) | Sprache-zu-Text |
| **Google Gemini Imagen** | Welt | US | Gemini 2.5 Flash Image | Bildgenerierung (Text-zu-Bild, Bild-zu-Bild) |
| **Nebius Flux.1** | EU | FI | Flux.1 Schnell | Bildgenerierung (Text-zu-Bild) |

### Deaktivierte Provider (verfügbar zur Aktivierung)

| Provider | Region | Standort | Modelle |
|----------|--------|----------|---------|
| **OpenAI** | Welt | US | GPT-4o, GPT-4o Mini, Whisper, TTS-1, TTS-1 HD |
| **Anthropic** | Welt | US | Claude 3.5 Sonnet, Claude 3.5 Haiku |
| **Ollama (Lokal)** | Lokal | DE | Llama 3.2, Llama 3.2 70B, LLaVA, Mistral, Code Llama |

> [!info] Adacor AI als primärer Provider
> Adacor AI wird als primärer Provider empfohlen, da die Daten in Deutschland verarbeitet werden und die DSGVO-Konformität sichergestellt ist.

---

## Modellfähigkeiten

Jedes Modell deklariert bestimmte Fähigkeiten, die bestimmen, wofür es eingesetzt werden kann:

| Fähigkeit | Beschreibung |
|------------|-------------|
| **chat** | Textbasierte Konversationen und Antwortgenerierung |
| **vision** | Analyse und Verarbeitung von Bildern |
| **function_calling** | Aufruf von Tools und externen Funktionen (Tool-Calling) |
| **transcription** | Umwandlung von Sprache in Text (Speech-to-Text) |
| **speech** | Umwandlung von Text in Sprache (Text-to-Speech) |
| **text_to_image** | Generierung von Bildern aus Textbeschreibungen |
| **image_to_image** | Bearbeitung bestehender Bilder anhand von Anweisungen |

---

## Aktive Modellauswahl

Für jeden Einsatzzweck wird genau ein Modell als aktiv konfiguriert. Die aktive Auswahl bestimmt, welches Modell systemweit standardmäßig verwendet wird:

| Zweck | Beschreibung | Standard-Provider | Standard-Modell |
|-------|-------------|-------------------|-----------------|
| **Chat** | Standard-LLM für Konversationen | Adacor AI | Qwen 3 30B (256K) |
| **Vision** | Bildanalyse und visuelle Aufgaben | Adacor AI | Mistral 3 24B (128K) |
| **Speech-to-Text** | Spracherkennung und Transkription | Adacor AI Audio | Whisper V3 Large |
| **Text-zu-Bild** | Bildgenerierung aus Text | Nebius Flux.1 | Flux.1 Schnell |
| **Bild-zu-Bild** | Bildbearbeitung | Google Gemini Imagen | Gemini 2.5 Flash Image |

> [!info] Benutzer-Präferenzen
> Einzelne Benutzer können in ihrem Profil unter **Meine Modelle** eigene Modellpräferenzen festlegen, die die systemweiten Standards überschreiben.

---

## Provider verwalten

### Neuen Provider hinzufügen

1. Klicken Sie auf **Provider hinzufügen**.
2. Geben Sie die Konfiguration ein:
    - **Name**: Anzeigename des Providers
    - **API-Modus**: Kompatibles API-Format (z.B. OpenAI-kompatibel, Ollama)
    - **Basis-URL**: API-Endpunkt des Providers
    - **API-Schlüssel**: Authentifizierungsschlüssel (wird als Umgebungsvariable referenziert)
    - **Region / Standort**: Angaben zum Rechenzentrumsstandort
3. Fügen Sie die verfügbaren **Modelle** hinzu und definieren Sie deren Fähigkeiten.
4. **Aktivieren** Sie den Provider, wenn er einsatzbereit ist.

### Provider aktivieren / deaktivieren

Deaktivierte Provider und deren Modelle stehen nicht zur Auswahl. Sie können Provider jederzeit aktivieren oder deaktivieren, ohne die Konfiguration zu verlieren.

### Verbindung testen

Über die Testfunktion können Sie prüfen, ob die Verbindung zu einem Provider funktioniert. Der Test sendet eine einfache Anfrage an die API und meldet zurück, ob die Kommunikation erfolgreich ist.

> [!warning] API-Schlüssel
> API-Schlüssel werden als Umgebungsvariablen im Backend gespeichert und nicht in der Datenbank abgelegt. Stellen Sie sicher, dass die entsprechende Umgebungsvariable gesetzt ist, bevor Sie einen Provider aktivieren.

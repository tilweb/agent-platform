# KI-Modelle & Provider

> [!warning] Administratorbereich
> Die Provider-Verwaltung ist nur für Benutzer mit der Rolle **Admin** sichtbar und zugänglich.

Provider sind die Schnittstellen zu KI-Diensten, die dem KI-Workplace seine Intelligenz verleihen. Jeder Provider stellt ein oder mehrere Modelle mit unterschiedlichen Fähigkeiten bereit.

---

## Was sind Provider?

Ein Provider ist ein externer KI-Dienst, der über eine API angebunden wird. Jeder Provider bietet verschiedene Modelle an, die für unterschiedliche Aufgaben optimiert sind. Der KI-Workplace unterstützt die gleichzeitige Anbindung mehrerer Provider.

---

## Standard-Provider

Der folgende Provider ist vorkonfiguriert und als primärer Provider aktiv:

### Adacor AI

| Eigenschaft       | Wert                            |
| ----------------- | ------------------------------- |
| **Region**        | Deutschland                     |
| **Rechenzentrum** | DE                              |
| **API-Modus**     | OpenAI-kompatibel               |
| **Geschützt**     | Ja (kann nicht gelöscht werden) |

### Verfügbare Modelle

| Modell                           | Fähigkeiten                    | Kontextlänge  |
| -------------------------------- | ------------------------------ | ------------- |
| **Qwen3 A3bthinking 30B (256K)** | Chat, Vision, Function Calling | 256.000 Token |
| **Qwen3 A3b 30B (256K)**         | Chat, Vision, Function Calling | 256.000 Token |
| **Mistral 3 24B (128K)**         | Chat, Vision, Function Calling | 128.000 Token |
| **Gemma 3 27B (32K)**            | Chat, Vision                   | 32.000 Token  |
| **Llama 3 8B (32K)**             | Chat                           | 32.000 Token  |
| **Pixtral 12B (32K)**            | Vision                         | 32.000 Token  |
| **Multilingual E5 Large**        | Embeddings                     | —             |
| **Whisper V3 Large (30s)**       | Transkription (Speech-to-Text) | —             |

> [!info] Adacor AI als primärer Provider
> Adacor AI wird als primärer Provider empfohlen, da die Daten in Deutschland verarbeitet werden und die DSGVO-Konformität sichergestellt ist.

---

## Modellfähigkeiten

Jedes Modell deklariert bestimmte Fähigkeiten, die bestimmen, wofür es eingesetzt werden kann:

| Fähigkeit            | Beschreibung                                            |
| -------------------- | ------------------------------------------------------- |
| **chat**             | Textbasierte Konversationen und Antwortgenerierung      |
| **vision**           | Analyse und Verarbeitung von Bildern                    |
| **function_calling** | Aufruf von Tools und externen Funktionen (Tool-Calling) |
| **transcription**    | Umwandlung von Sprache in Text (Speech-to-Text)         |
| **embeddings**       | Vektorisierung von Texten für semantische Suche (RAG)   |
| **text_to_image**    | Generierung von Bildern aus Textbeschreibungen          |
| **image_to_image**   | Bearbeitung bestehender Bilder anhand von Anweisungen   |

---

## Aktive Modellauswahl

Für jeden Einsatzzweck wird genau ein Modell als aktiv konfiguriert. Die aktive Auswahl bestimmt, welches Modell systemweit standardmäßig verwendet wird:

| Zweck              | Standard-Modell              |
| ------------------ | ---------------------------- |
| **Chat**           | Qwen3 A3bthinking 30B (256K) |
| **Vision**         | Qwen3 A3bthinking 30B (256K) |
| **Speech-to-Text** | Whisper V3 Large (30s)       |
| **Text-zu-Bild**   | _Nicht konfiguriert_         |
| **Bild-zu-Bild**   | _Nicht konfiguriert_         |

> [!info] Benutzer-Präferenzen
> Einzelne Benutzer können in ihrem Profil unter **Meine Modelle** eigene Modellpräferenzen festlegen, die die systemweiten Standards überschreiben.

---

## Provider verwalten

> [!info] Custom Provider
> Eigene Provider können nur hinzugefügt werden, wenn die Umgebungsvariable `ALLOW_CUSTOM_PROVIDERS=true` gesetzt ist.

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

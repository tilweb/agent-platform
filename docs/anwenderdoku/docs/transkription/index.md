# Audio-Transkription

Agent Platform kann Audiodateien in Text umwandeln (Speech-to-Text). Die Transkription wird über eine Whisper-API durchgeführt und steht im Chat als Funktion zur Verfügung.

---

## Unterstützte Formate

| Format | MIME-Typ | Hinweis |
|--------|----------|---------|
| **MP3** | audio/mpeg | Nativ unterstützt |
| **WAV** | audio/wav | Nativ unterstützt |
| **FLAC** | audio/flac | Nativ unterstützt |
| **WebM** | audio/webm | Wird automatisch konvertiert |
| **OGG** | audio/ogg | Wird automatisch konvertiert |
| **M4A/MP4** | audio/mp4, audio/m4a | Wird automatisch konvertiert |

> [!info] Automatische Konvertierung
> Formate wie WebM, OGG und M4A werden vor der Transkription automatisch in MP3 konvertiert. Dafür muss `ffmpeg` auf dem Server installiert sein.

---

## Dateigrößen-Limit

Die maximale Dateigröße für Audio-Uploads beträgt **25 MB**.

---

## Sprache

Die Transkription erfolgt standardmäßig auf **Deutsch** (de). Die Sprache kann bei der Anfrage angepasst werden.

---

## Voraussetzungen

Damit die Audio-Transkription verfügbar ist, müssen folgende Bedingungen erfüllt sein:

1. Ein **STT-Provider** (Speech-to-Text) muss in der Provider-Konfiguration aktiviert sein
2. Ein **Whisper-Modell** muss beim Provider verfügbar und konfiguriert sein
3. Der zugehörige **API-Key** muss als Umgebungsvariable gesetzt sein
4. **ffmpeg** muss auf dem Server installiert sein (für Format-Konvertierung)

---

## Status prüfen

Administratoren können den Status der Transkriptions-Funktion prüfen. Die Plattform zeigt an, ob ein STT-Provider konfiguriert ist, welches Modell verwendet wird und ob der Dienst verfügbar ist.

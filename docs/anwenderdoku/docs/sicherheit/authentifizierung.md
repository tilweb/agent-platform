# Authentifizierung & Sicherheit

Die Agent Platform setzt mehrere Sicherheitsmechanismen ein, um Benutzerkonten, Daten und die Kommunikation zwischen Client und Server zu schützen.

---

## Sitzungsverwaltung

Die Authentifizierung basiert auf einem sitzungsbasierten System mit HTTP-Only-Cookies.

### Funktionsweise

1. Nach erfolgreicher Anmeldung wird eine Sitzung erstellt und ein Cookie an den Browser gesendet.
2. Bei jeder weiteren Anfrage wird das Cookie automatisch mitgesendet und die Sitzung validiert.
3. Die Sitzung wird bei Aktivität automatisch verlängert (Sliding Window).

### Sitzungsparameter

| Parameter | Wert | Beschreibung |
|-----------|------|-------------|
| **Inaktivitäts-Timeout** | 3 Tage | Die Sitzung läuft nach 3 Tagen ohne Aktivität ab |
| **Maximale Lebensdauer** | 30 Tage | Absolutes Maximum, auch bei ständiger Aktivität |
| **Cookie-Typ** | HTTP-Only | Cookie ist nicht per JavaScript auslesbar |
| **SameSite** | Lax | Cookie wird nur bei gleichem Ursprung gesendet |
| **Secure** | Ja (Produktion) | Cookie wird nur über HTTPS übertragen |

> [!info] Sliding Window
> Bei jeder authentifizierten Anfrage wird die Sitzung um weitere 3 Tage verlängert, solange die maximale Gesamtlebensdauer von 30 Tagen nicht überschritten ist. So müssen aktive Benutzer sich nicht ständig neu anmelden.

---

## Passwort-Hashing

> [!warning] Sicherheitshinweis
> Passwörter werden niemals im Klartext gespeichert.

Alle Passwörter werden mit dem **Argon2id**-Algorithmus gehasht. Argon2id ist der Gewinner des Password Hashing Competition und gilt als einer der sichersten Algorithmen für die Passwortspeicherung. Er ist speziell gegen Brute-Force-Angriffe mit spezialisierter Hardware (GPUs, ASICs) geschützt.

---

## CSRF-Schutz

Die Agent Platform schützt sich gegen Cross-Site Request Forgery (CSRF) durch die Validierung von Origin- und Referer-Headern:

- Bei jeder zustandsändernden Anfrage (POST, PUT, DELETE, PATCH) wird der **Origin-Header** geprüft.
- Falls kein Origin-Header vorhanden ist, wird der **Referer-Header** als Fallback verwendet.
- Nur Anfragen von erlaubten Ursprüngen werden akzeptiert.
- In Kombination mit **SameSite=Lax**-Cookies bietet dies einen umfassenden CSRF-Schutz.

---

## Rate Limiting

Um die Plattform vor Überlastung und Missbrauch zu schützen, sind für verschiedene Endpunkttypen individuelle Rate-Limits konfiguriert:

| Endpunkt | Limit | Zeitfenster | Beschreibung |
|----------|-------|-------------|-------------|
| **Authentifizierung** | 5 Anfragen | 1 Minute | Login, Registrierung |
| **Chat / LLM** | 30 Anfragen | 1 Minute | Chat-Nachrichten und KI-Anfragen |
| **API (allgemein)** | 100 Anfragen | 1 Minute | Alle übrigen API-Aufrufe |
| **Bildgenerierung** | 5 Anfragen | 1 Minute | Bilderzeugung (kostenintensiv) |
| **Uploads** | 10 Anfragen | 1 Minute | Datei-Uploads |
| **Sensible Aktionen** | 3 Anfragen | 5 Minuten | Passwortzurücksetzung u.a. |

Bei Überschreitung des Limits erhält der Benutzer eine Fehlermeldung mit der Angabe, wann die nächste Anfrage möglich ist.

> [!info] Rate Limiting pro IP
> Die Begrenzung erfolgt auf Basis der IP-Adresse. Alle Anfragen von derselben IP-Adresse teilen sich das jeweilige Limit.

---

## Sicherheits-Header

Alle Antworten des Servers enthalten die folgenden Sicherheits-Header:

| Header | Wert | Schutz gegen |
|--------|------|-------------|
| **Content-Security-Policy** | Restriktive Richtlinie | Cross-Site Scripting (XSS), Dateninjektionen |
| **X-Frame-Options** | `DENY` | Clickjacking |
| **X-Content-Type-Options** | `nosniff` | MIME-Type-Sniffing |
| **X-XSS-Protection** | `1; mode=block` | XSS (Legacy-Browser) |
| **Referrer-Policy** | `strict-origin-when-cross-origin` | Ungewollte Weitergabe von Referrer-Informationen |
| **Permissions-Policy** | Eingeschränkt | Missbrauch von Browser-APIs (Kamera, Geolocation) |

Zusätzlich werden API-Antworten mit `Cache-Control: no-store` versehen, um das Caching sensibler Daten zu verhindern.

---

## SSRF-Schutz

Bei benutzerdefinierten Tools, die externe URLs aufrufen, wird ein SSRF-Schutz (Server-Side Request Forgery) angewendet:

- Aufrufe an interne Netzwerkadressen (z.B. `localhost`, `127.0.0.1`, private IP-Bereiche) werden blockiert.
- Nur Anfragen an öffentlich erreichbare Adressen sind zugelassen.
- Verdächtige SSRF-Versuche werden im Audit Log protokolliert.

> [!warning] Benutzerdefinierte Tools
> Wenn Sie benutzerdefinierte Tools erstellen, die externe APIs aufrufen, stellen Sie sicher, dass die Ziel-URLs öffentlich zugänglich sind. Anfragen an interne Netzwerke werden aus Sicherheitsgründen automatisch blockiert.

---

## Verschlüsselte OAuth-Token-Speicherung

OAuth-Tokens für externe Verbindungen (z.B. Confluence, Google Drive) werden serverseitig verschlüsselt gespeichert:

- Die Verschlüsselung erfolgt mit einem dedizierten Schlüssel (`CONNECTION_ENCRYPTION_KEY`).
- Tokens werden vor dem Speichern verschlüsselt und erst bei Bedarf entschlüsselt.
- Ohne den Verschlüsselungsschlüssel sind die gespeicherten Tokens nicht lesbar.

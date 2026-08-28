# Chat-Anhänge: Persistenter Dokument-Kontext (2026-08-28)

## Kontext / Problem

Agenten (beobachtet bei „HR - Bewerbungsanalyse" mit Qwen 3 30B) „vergaßen" hochgeladene
Dokumente in Folge-Turns: Im Upload-Turn kannten sie die Dateien, eine Nachricht später
baten sie den User um erneuten Upload oder um die attachment_id. Tiefenanalyse ergab drei
strukturelle Ursachen — kein Modell-Problem:

1. **Ephemerer Dokument-Kontext**: Die Sektion „Hochgeladene Dokumente" (Volltexte kleiner
   Docs, Sub-Agent-Analysen großer Docs, attachment_ids) wurde nur aus den Attachments der
   *aktuellen* Nachricht gebaut (`pendingMessages` → `runAgentLoop(..., attachments)`), als
   Teil des pro Request neu erzeugten System-Prompts. Folge-Turn ohne neue Datei → Sektion
   komplett weg, inkl. der teuer erstellten Analysen (wurden verworfen).
2. **History ohne Anhang-Bezug**: Die User-Message wurde als reiner Text persistiert
   (`addMessage(sessionId, { role: 'user', content: userMessage })`). Die
   Attachment-Metadaten der Chat-History dienen nur dem Frontend-Rendering und erreichen
   das LLM nie.
3. **Keine Discovery**: `read_chat_attachment` verlangte eine exakte `attachment_id` als
   Pflichtparameter; einen Listen-Modus gab es nicht. Der Agent konnte die ID prinzipiell
   nicht ermitteln, obwohl die Datei vollständig im Session-Store lag.

Verstärker: Der Agent-eigene Workflow-Prompt („erst Stelle bestätigen") übersteuerte die
„Antworte DIREKT"-Anweisung der Injection und erzeugte so überhaupt erst den Folge-Turn;
die Turn-1-Antwort („…müssen hochgeladen werden") vergiftete anschließend die History.

## Entscheidungen

- **Ein Code-Pfad statt Sonderfall Upload-Turn**: Die Dokument-Sektion wird bei *jedem*
  Turn aus dem persistenten Attachment-Store der Session gebaut
  (`buildSessionDocumentsSection` in `agents/loop.ts`). Quelle ist die Disk
  (`data/chat-uploads/<sessionId>/`), nicht die Pending-Message — dadurch überlebt das
  Wissen auch Backend-Neustarts (die In-Memory-History tut das nicht).
- **Analysen werden persistiert**: Sub-Agent-Analysen großer Dokumente (≥15k Zeichen)
  werden einmalig erstellt und als `analysis`-Feld in der `metadata.json` des Attachments
  gespeichert (`attachmentsService.saveAttachmentAnalysis`). Folge-Turns nutzen die
  gespeicherte Analyse; Fehl-Analysen werden nicht persistiert (Retry im nächsten Turn).
  Alt-Sessions ohne Analyse werden beim nächsten Turn nachanalysiert (Cap 5/Request).
- **Content-Budget statt Context-Explosion**: 120k Zeichen Budget pro Turn für
  eingebettete Volltexte (<15k) und Analysen. Priorität: neue Uploads dieser Nachricht,
  dann neueste zuerst. Was nicht reinpasst, erscheint mit Metadaten + attachment_id +
  `read_chat_attachment`-Hinweis. Gerendert wird chronologisch (stabile Nummerierung).
- **Manifest für alle Dateitypen**: Bilder/Audio werden pro Turn mit ID + Typ gelistet
  (Inhalt weiterhin über Bildanalyse im Upload-Turn bzw. `read_chat_attachment`).
- **Discovery-Fallback**: `read_chat_attachment` hat einen `format: "list"`-Modus (auch
  Default bei fehlender `attachment_id`), der alle Session-Attachments mit IDs, Metadaten
  und `hasAnalysis` liefert. Funktioniert via `parentSessionId` auch aus Delegationen.
- **Bewusst KEIN History-Marker**: Statt „[Anhänge: …]" in die persistierte User-Message
  zu flechten (würde im UI erscheinen) oder als Mid-Conversation-System-Message (bricht
  bei manchen Chat-Templates, z.B. Mistral), trägt das Manifest den Upload-Zeitpunkt pro
  Datei. Das Manifest ist ohnehin die verlässlichere Quelle, da Neustart-fest.
- Die Prompt-Formulierung adressiert das beobachtete Fehlverhalten explizit: „Frage
  NIEMALS nach einem erneuten Upload … die attachment_ids stehen hier."

## Änderungen

- `backend/src/services/attachments.ts`: `AttachmentAnalysis`-Interface,
  `ChatAttachment.analysis`, `saveAttachmentAnalysis()` (roher metadata.json-Patch, ohne
  Content-Duplizierung).
- `backend/src/agents/loop.ts`: `analyzeDocumentsAutomatically` →
  `buildSessionDocumentsSection` (session-weit, Budget, Persistenz, Manifest); Aufrufstelle
  läuft jetzt in jedem Turn. Sektionstitel enthält weiterhin „Hochgeladene Dokumente"
  (Referenz im Supervisor-Prompt bleibt gültig).
- `backend/src/tools/special/read-chat-attachment.ts`: `format: "list"`,
  `attachment_id` optional.

## Messergebnisse / Verifikation

- Smoke-Test (synthetische Session): `getSessionAttachments` liefert Docs+Bilder inkl.
  Content-Reload; `saveAttachmentAnalysis` persistiert ohne Content-Verlust; Tool-`list`
  liefert beide Attachments mit `hasAnalysis`-Flag; Aufruf ohne ID fällt auf `list` zurück.
- `tsc --noEmit`: keine neuen Fehler (nur die drei bekannten Bestandsfehler in loop.ts).
- Kosten: Analysen werden pro Dokument nur noch einmal erstellt (vorher: pro Upload-Turn
  erstellt und verworfen); Folge-Turns kosten nur noch die eingebetteten Zeichen.

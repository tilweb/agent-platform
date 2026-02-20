/**
 * Tests fuer ReadChatAttachmentTool (backend/src/tools/special/read-chat-attachment.ts)
 *
 * Strategie:
 *  - mock.module() fuer '../../../services/attachments' damit getAttachment
 *    einen kontrollierten Wert zurueckgibt und kein Dateisystemzugriff stattfindet.
 *  - mock.module() fuer '../../../utils/paths' damit DATA_DIR auf einen
 *    harmlosen Pfad zeigt und LocalTool fehlerfrei initialisiert wird.
 *
 * Wichtig: Alle mock.module()-Aufrufe muessen VOR dem dynamischen Import des
 * Moduls unter Test stehen (Bun-Anforderung fuer isolierte Testlaeufe).
 *
 * Pfade sind relativ zur Testdatei (src/tools/special/__tests__/),
 * nicht zum Modul unter Test (src/tools/special/).
 */

import { test, expect, describe, beforeEach, mock } from "bun:test";

// ---------------------------------------------------------------------------
// Shared mutable mock state — wird in beforeEach zurueckgesetzt
// ---------------------------------------------------------------------------

const mockState: {
  attachment: any;
  getAttachmentError: Error | null;
  lastGetAttachmentId: string | null;
  lastGetAttachmentSessionId: string | undefined | null;
} = {
  attachment: null,
  getAttachmentError: null,
  lastGetAttachmentId: null,
  lastGetAttachmentSessionId: null,
};

// ---------------------------------------------------------------------------
// Module mock: attachmentsService
// Muss VOR dem Import des Moduls unter Test deklariert werden.
// ---------------------------------------------------------------------------

mock.module("../../../services/attachments", () => ({
  attachmentsService: {
    getAttachment: async (id: string, sessionId?: string) => {
      mockState.lastGetAttachmentId = id;
      mockState.lastGetAttachmentSessionId = sessionId;
      if (mockState.getAttachmentError) {
        throw mockState.getAttachmentError;
      }
      return mockState.attachment;
    },
  },
}));

// ---------------------------------------------------------------------------
// Module mock: paths — DATA_DIR auf /tmp setzen damit LocalTool ohne echtes
// data/-Verzeichnis initialisiert werden kann.
// ---------------------------------------------------------------------------

mock.module("../../../utils/paths", () => ({
  DATA_DIR: "/tmp/read-chat-attachment-test",
  CHAT_UPLOADS_DIR: "/tmp/read-chat-attachment-test/chat-uploads",
  MARKITDOWN_API_URL: "",
  MARKITDOWN_API_KEY: "",
}));

// ---------------------------------------------------------------------------
// Import des Moduls unter Test NACH den Mock-Registrierungen
// ---------------------------------------------------------------------------

const { ReadChatAttachmentTool } = await import("../read-chat-attachment");

// ---------------------------------------------------------------------------
// Hilfsfunktionen fuer Test-Fixtures
// ---------------------------------------------------------------------------

/** Erstellt ein minimales document-Attachment. */
function makeDocumentAttachment(overrides: Partial<any> = {}): any {
  return {
    id: "att-1234567890-abc123",
    sessionId: "session-test-001",
    filename: "dokument.pdf",
    mimeType: "application/pdf",
    type: "document",
    storagePath: "/tmp/uploads/session-test-001/att-1234567890-abc123",
    markdownContent: "# Testdokument\n\nDies ist der Inhalt.",
    metadata: {
      size: 1024,
      pages: 1,
      convertedAt: "2026-02-20T10:00:00.000Z",
      originalPath: "/tmp/uploads/session-test-001/att-1234567890-abc123/original.pdf",
    },
    ...overrides,
  };
}

/** Erstellt ein minimales image-Attachment. */
function makeImageAttachment(overrides: Partial<any> = {}): any {
  return {
    id: "att-9876543210-img456",
    sessionId: "session-test-001",
    filename: "bild.png",
    mimeType: "image/png",
    type: "image",
    storagePath: "/tmp/uploads/session-test-001/att-9876543210-img456",
    base64Data: "data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg==",
    metadata: {
      size: 512,
      convertedAt: "2026-02-20T10:00:00.000Z",
      originalPath: "/tmp/uploads/session-test-001/att-9876543210-img456/original.png",
    },
    ...overrides,
  };
}

/** Erstellt ein minimales audio-Attachment. */
function makeAudioAttachment(overrides: Partial<any> = {}): any {
  return {
    id: "att-1111111111-aud789",
    sessionId: "session-test-001",
    filename: "aufnahme.mp3",
    mimeType: "audio/mpeg",
    type: "audio",
    storagePath: "/tmp/uploads/session-test-001/att-1111111111-aud789",
    transcription: "Dies ist die Transkription der Audioaufnahme.",
    metadata: {
      size: 2048,
      duration: 30,
      convertedAt: "2026-02-20T10:00:00.000Z",
      originalPath: "/tmp/uploads/session-test-001/att-1111111111-aud789/original.mp3",
    },
    ...overrides,
  };
}

/** Setzt den mockState auf einen sicheren Standardwert zurueck. */
function resetMockState() {
  mockState.attachment = null;
  mockState.getAttachmentError = null;
  mockState.lastGetAttachmentId = null;
  mockState.lastGetAttachmentSessionId = null;
}

// ---------------------------------------------------------------------------
// Test-Suites
// ---------------------------------------------------------------------------

describe("ReadChatAttachmentTool", () => {
  let tool: InstanceType<typeof ReadChatAttachmentTool>;

  beforeEach(() => {
    resetMockState();
    tool = new ReadChatAttachmentTool();
  });

  // -------------------------------------------------------------------------
  // getDefinition()
  // -------------------------------------------------------------------------

  describe("getDefinition()", () => {
    test("sollte type als 'function' zurueckgeben", () => {
      const def = tool.getDefinition();
      expect(def.type).toBe("function");
    });

    test("sollte den Funktionsnamen 'read_chat_attachment' zurueckgeben", () => {
      const def = tool.getDefinition();
      expect(def.function.name).toBe("read_chat_attachment");
    });

    test("sollte 'attachment_id' als einziges required-Feld definieren", () => {
      const def = tool.getDefinition();
      const required = def.function.parameters.required;
      expect(required).toContain("attachment_id");
      expect(required).toHaveLength(1);
    });

    test("sollte das format-Property mit dem korrekten enum definieren", () => {
      const def = tool.getDefinition();
      const formatProp = def.function.parameters.properties["format"] as any;
      expect(formatProp).toBeDefined();
      expect(formatProp.enum).toContain("full");
      expect(formatProp.enum).toContain("summary");
      expect(formatProp.enum).toContain("metadata");
    });

    test("sollte eine nicht-leere Beschreibung enthalten", () => {
      const def = tool.getDefinition();
      expect(typeof def.function.description).toBe("string");
      expect(def.function.description.length).toBeGreaterThan(0);
    });
  });

  // -------------------------------------------------------------------------
  // getMetadata()
  // -------------------------------------------------------------------------

  describe("getMetadata()", () => {
    test("sollte den Namen 'read_chat_attachment' zurueckgeben", () => {
      const meta = tool.getMetadata();
      expect(meta.name).toBe("read_chat_attachment");
    });

    test("sollte den Typ 'local' zurueckgeben", () => {
      const meta = tool.getMetadata();
      expect(meta.type).toBe("local");
    });

    test("sollte die Kategorie 'attachments' zurueckgeben", () => {
      const meta = tool.getMetadata();
      expect(meta.category).toBe("attachments");
    });
  });

  // -------------------------------------------------------------------------
  // isAvailable()
  // -------------------------------------------------------------------------

  describe("isAvailable()", () => {
    test("sollte immer true zurueckgeben", async () => {
      const result = await tool.isAvailable();
      expect(result).toBe(true);
    });
  });

  // -------------------------------------------------------------------------
  // execute() — Validierung
  // -------------------------------------------------------------------------

  describe("execute() — Validierung", () => {
    test("sollte einen Fehler zurueckgeben, wenn attachment_id fehlt (undefined)", async () => {
      const result = await tool.execute({});
      const body = JSON.parse(result);
      expect(body.success).toBe(false);
      expect(typeof body.error).toBe("string");
      expect(body.error.length).toBeGreaterThan(0);
    });

    test("sollte einen Fehler zurueckgeben, wenn attachment_id ein leerer String ist", async () => {
      const result = await tool.execute({ attachment_id: "" });
      const body = JSON.parse(result);
      expect(body.success).toBe(false);
      expect(typeof body.error).toBe("string");
      expect(body.error.length).toBeGreaterThan(0);
    });
  });

  // -------------------------------------------------------------------------
  // execute() — Session-ID Aufloesung
  // -------------------------------------------------------------------------

  describe("execute() — Session-ID Aufloesung", () => {
    test("sollte parentSessionId bevorzugen, wenn beide gesetzt sind", async () => {
      mockState.attachment = makeDocumentAttachment();
      await tool.execute(
        { attachment_id: "att-123" },
        { sessionId: "session-current", parentSessionId: "session-parent" }
      );
      expect(mockState.lastGetAttachmentSessionId).toBe("session-parent");
    });

    test("sollte auf sessionId zurueckfallen, wenn parentSessionId nicht gesetzt ist", async () => {
      mockState.attachment = makeDocumentAttachment();
      await tool.execute(
        { attachment_id: "att-123" },
        { sessionId: "session-fallback" }
      );
      expect(mockState.lastGetAttachmentSessionId).toBe("session-fallback");
    });

    test("sollte die Session-ID korrekt an getAttachment weitergeben", async () => {
      mockState.attachment = makeDocumentAttachment();
      await tool.execute(
        { attachment_id: "att-abc-999" },
        { parentSessionId: "parent-session-xyz" }
      );
      expect(mockState.lastGetAttachmentId).toBe("att-abc-999");
      expect(mockState.lastGetAttachmentSessionId).toBe("parent-session-xyz");
    });
  });

  // -------------------------------------------------------------------------
  // execute() — Attachment nicht gefunden
  // -------------------------------------------------------------------------

  describe("execute() — Attachment nicht gefunden", () => {
    test("sollte success:false zurueckgeben, wenn getAttachment null liefert", async () => {
      mockState.attachment = null;
      const result = await tool.execute({ attachment_id: "att-unbekannt-001" });
      const body = JSON.parse(result);
      expect(body.success).toBe(false);
    });

    test("sollte die attachment_id im Fehlertext erwaehnen", async () => {
      mockState.attachment = null;
      const result = await tool.execute({ attachment_id: "att-nicht-da-999" });
      const body = JSON.parse(result);
      expect(body.error).toContain("att-nicht-da-999");
    });
  });

  // -------------------------------------------------------------------------
  // execute() — format='metadata'
  // -------------------------------------------------------------------------

  describe("execute() — format='metadata'", () => {
    test("sollte alle Metadatenfelder korrekt zurueckgeben", async () => {
      mockState.attachment = makeDocumentAttachment({
        id: "att-meta-001",
        filename: "bericht.pdf",
        type: "document",
        mimeType: "application/pdf",
        metadata: {
          size: 4096,
          pages: 5,
          convertedAt: "2026-02-20T12:00:00.000Z",
          originalPath: "/tmp/bericht.pdf",
        },
      });
      const result = await tool.execute({ attachment_id: "att-meta-001", format: "metadata" });
      const body = JSON.parse(result);
      expect(body.success).toBe(true);
      expect(body.attachment_id).toBe("att-meta-001");
      expect(body.filename).toBe("bericht.pdf");
      expect(body.type).toBe("document");
      expect(body.mimeType).toBe("application/pdf");
      expect(body.size).toBe(4096);
      expect(body.pages).toBe(5);
      expect(body.convertedAt).toBe("2026-02-20T12:00:00.000Z");
    });

    test("sollte die korrekte Struktur ohne content-Feld zurueckgeben", async () => {
      mockState.attachment = makeDocumentAttachment();
      const result = await tool.execute({ attachment_id: "att-1234567890-abc123", format: "metadata" });
      const body = JSON.parse(result);
      expect(body).not.toHaveProperty("content");
      expect(body).not.toHaveProperty("markdownContent");
      expect(body).not.toHaveProperty("transcription");
      expect(body).not.toHaveProperty("base64");
    });

    test("sollte auch fuer Audio-Attachments funktionieren (kein Inhalt, nur Metadaten)", async () => {
      mockState.attachment = makeAudioAttachment({
        id: "att-audio-meta",
        metadata: { size: 8192, duration: 60, convertedAt: "2026-02-20T13:00:00.000Z", originalPath: "/tmp/x.mp3" },
      });
      const result = await tool.execute({ attachment_id: "att-audio-meta", format: "metadata" });
      const body = JSON.parse(result);
      expect(body.success).toBe(true);
      expect(body.size).toBe(8192);
      expect(body).not.toHaveProperty("transcription");
    });
  });

  // -------------------------------------------------------------------------
  // execute() — type='document', format='full'
  // -------------------------------------------------------------------------

  describe("execute() — type='document', format='full'", () => {
    test("sollte den vollstaendigen Markdown-Inhalt zurueckgeben", async () => {
      const content = "# Vollstaendiges Dokument\n\nZeile 1\nZeile 2\nZeile 3";
      mockState.attachment = makeDocumentAttachment({ markdownContent: content });
      const result = await tool.execute({ attachment_id: "att-doc-full", format: "full" });
      const body = JSON.parse(result);
      expect(body.success).toBe(true);
      expect(body.type).toBe("document");
      expect(body.content).toBe(content);
    });

    test("sollte filename und totalLength korrekt setzen", async () => {
      const content = "Kurzer Inhalt";
      mockState.attachment = makeDocumentAttachment({
        filename: "kurztext.txt",
        markdownContent: content,
      });
      const result = await tool.execute({ attachment_id: "att-doc-full", format: "full" });
      const body = JSON.parse(result);
      expect(body.filename).toBe("kurztext.txt");
      expect(body.totalLength).toBe(content.length);
    });

    test("sollte leeres markdownContent als leeren String behandeln", async () => {
      mockState.attachment = makeDocumentAttachment({ markdownContent: undefined });
      const result = await tool.execute({ attachment_id: "att-doc-empty", format: "full" });
      const body = JSON.parse(result);
      expect(body.success).toBe(true);
      expect(body.content).toBe("");
      expect(body.totalLength).toBe(0);
    });
  });

  // -------------------------------------------------------------------------
  // execute() — type='document', format='summary'
  // -------------------------------------------------------------------------

  describe("execute() — type='document', format='summary'", () => {
    test("sollte langen Inhalt auf 2000 Zeichen kuerzen", async () => {
      const longContent = "A".repeat(5000);
      mockState.attachment = makeDocumentAttachment({ markdownContent: longContent });
      const result = await tool.execute({ attachment_id: "att-doc-summary", format: "summary" });
      const body = JSON.parse(result);
      expect(body.success).toBe(true);
      expect(body.content).toBe("A".repeat(2000));
      expect(body.content.length).toBe(2000);
    });

    test("sollte truncated=true setzen, wenn Inhalt laenger als 2000 Zeichen ist", async () => {
      mockState.attachment = makeDocumentAttachment({ markdownContent: "B".repeat(2001) });
      const result = await tool.execute({ attachment_id: "att-doc-trunc", format: "summary" });
      const body = JSON.parse(result);
      expect(body.truncated).toBe(true);
      expect(body.totalLength).toBe(2001);
    });

    test("sollte truncated=false setzen, wenn Inhalt maximal 2000 Zeichen lang ist", async () => {
      const shortContent = "Kurzer Text, der nicht gekuerzt werden muss.";
      mockState.attachment = makeDocumentAttachment({ markdownContent: shortContent });
      const result = await tool.execute({ attachment_id: "att-doc-short", format: "summary" });
      const body = JSON.parse(result);
      expect(body.truncated).toBe(false);
      expect(body.content).toBe(shortContent);
    });
  });

  // -------------------------------------------------------------------------
  // execute() — type='image'
  // -------------------------------------------------------------------------

  describe("execute() — type='image'", () => {
    test("sollte base64-Daten und mimeType zurueckgeben", async () => {
      const base64 = "data:image/png;base64,abc123def456";
      mockState.attachment = makeImageAttachment({ base64Data: base64, mimeType: "image/png" });
      const result = await tool.execute({ attachment_id: "att-img-001" });
      const body = JSON.parse(result);
      expect(body.success).toBe(true);
      expect(body.base64).toBe(base64);
      expect(body.mimeType).toBe("image/png");
    });

    test("sollte type='image' im Ergebnis setzen", async () => {
      mockState.attachment = makeImageAttachment();
      const result = await tool.execute({ attachment_id: "att-img-002" });
      const body = JSON.parse(result);
      expect(body.type).toBe("image");
    });

    test("sollte filename und attachment_id im Ergebnis enthalten", async () => {
      mockState.attachment = makeImageAttachment({ id: "att-img-003", filename: "foto.jpg" });
      const result = await tool.execute({ attachment_id: "att-img-003" });
      const body = JSON.parse(result);
      expect(body.attachment_id).toBe("att-img-003");
      expect(body.filename).toBe("foto.jpg");
    });
  });

  // -------------------------------------------------------------------------
  // execute() — type='audio', format='full'
  // -------------------------------------------------------------------------

  describe("execute() — type='audio', format='full'", () => {
    test("sollte die vollstaendige Transkription zurueckgeben", async () => {
      const transcription = "Hallo, dies ist eine vollstaendige Aufnahme, die transkribiert wurde.";
      mockState.attachment = makeAudioAttachment({ transcription });
      const result = await tool.execute({ attachment_id: "att-audio-full", format: "full" });
      const body = JSON.parse(result);
      expect(body.success).toBe(true);
      expect(body.transcription).toBe(transcription);
    });

    test("sollte filename und totalLength korrekt setzen", async () => {
      const transcription = "Kurze Aufnahme";
      mockState.attachment = makeAudioAttachment({
        filename: "aufnahme.wav",
        transcription,
      });
      const result = await tool.execute({ attachment_id: "att-audio-meta", format: "full" });
      const body = JSON.parse(result);
      expect(body.filename).toBe("aufnahme.wav");
      expect(body.totalLength).toBe(transcription.length);
    });

    test("sollte leere Transkription als leeren String behandeln", async () => {
      mockState.attachment = makeAudioAttachment({ transcription: undefined });
      const result = await tool.execute({ attachment_id: "att-audio-empty", format: "full" });
      const body = JSON.parse(result);
      expect(body.success).toBe(true);
      expect(body.transcription).toBe("");
      expect(body.totalLength).toBe(0);
    });
  });

  // -------------------------------------------------------------------------
  // execute() — type='audio', format='summary'
  // -------------------------------------------------------------------------

  describe("execute() — type='audio', format='summary'", () => {
    test("sollte lange Transkription auf 2000 Zeichen kuerzen", async () => {
      const longTranscription = "C".repeat(3000);
      mockState.attachment = makeAudioAttachment({ transcription: longTranscription });
      const result = await tool.execute({ attachment_id: "att-audio-sum", format: "summary" });
      const body = JSON.parse(result);
      expect(body.success).toBe(true);
      expect(body.transcription).toBe("C".repeat(2000));
    });

    test("sollte truncated=true setzen und totalLength korrekt angeben", async () => {
      mockState.attachment = makeAudioAttachment({ transcription: "D".repeat(2500) });
      const result = await tool.execute({ attachment_id: "att-audio-trunc", format: "summary" });
      const body = JSON.parse(result);
      expect(body.truncated).toBe(true);
      expect(body.totalLength).toBe(2500);
    });

    test("sollte truncated=false setzen, wenn Transkription kurz genug ist", async () => {
      const shortTranscription = "Eine kurze Aufnahme.";
      mockState.attachment = makeAudioAttachment({ transcription: shortTranscription });
      const result = await tool.execute({ attachment_id: "att-audio-short", format: "summary" });
      const body = JSON.parse(result);
      expect(body.truncated).toBe(false);
      expect(body.transcription).toBe(shortTranscription);
    });
  });

  // -------------------------------------------------------------------------
  // execute() — Unbekannter Typ
  // -------------------------------------------------------------------------

  describe("execute() — Unbekannter Typ", () => {
    test("sollte einen Fehler zurueckgeben, wenn der Attachment-Typ unbekannt ist", async () => {
      mockState.attachment = makeDocumentAttachment({ type: "video" as any });
      const result = await tool.execute({ attachment_id: "att-unknown-type" });
      const body = JSON.parse(result);
      expect(body.success).toBe(false);
      expect(body.error).toContain("video");
    });
  });

  // -------------------------------------------------------------------------
  // execute() — Fehlerbehandlung
  // -------------------------------------------------------------------------

  describe("execute() — Fehlerbehandlung", () => {
    test("sollte success:false zurueckgeben, wenn der Service einen Fehler wirft", async () => {
      mockState.getAttachmentError = new Error("Dateisystem nicht erreichbar");
      const result = await tool.execute({ attachment_id: "att-error-001" });
      const body = JSON.parse(result);
      expect(body.success).toBe(false);
    });

    test("sollte die Fehlermeldung aus dem geworfenen Fehler uebernehmen", async () => {
      mockState.getAttachmentError = new Error("Ungueltige Attachment-ID Format");
      const result = await tool.execute({ attachment_id: "att-error-002" });
      const body = JSON.parse(result);
      expect(body.error).toBe("Ungueltige Attachment-ID Format");
    });
  });
});

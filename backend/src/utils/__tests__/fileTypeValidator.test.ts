import { test, expect, describe } from "bun:test";
import {
  validateFileType,
  validateUpload,
  ALLOWED_UPLOAD_TYPES,
} from "../fileTypeValidator";

// ---------------------------------------------------------------------------
// Test buffers
// ---------------------------------------------------------------------------

// PNG magic bytes: 89 50 4E 47 0D 0A 1A 0A
const pngBuffer = Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, 0x00, 0x00]);

// JPEG magic bytes: FF D8 FF E0
const jpegBuffer = Buffer.from([0xff, 0xd8, 0xff, 0xe0, 0x00, 0x10, 0x4a, 0x46]);

// PDF magic bytes: %PDF-1.4
const pdfBuffer = Buffer.from([0x25, 0x50, 0x44, 0x46, 0x2d, 0x31, 0x2e, 0x34]);

// ZIP/Office PK magic bytes: 50 4B 03 04
const zipBuffer = Buffer.from([0x50, 0x4b, 0x03, 0x04, 0x00, 0x00, 0x00, 0x00]);

// RIFF header (bytes 0–3) + size (bytes 4–7) + "WEBP" at bytes 8–11
const webpBuffer = Buffer.alloc(16);
webpBuffer.write("RIFF", 0, "ascii");  // 52 49 46 46
webpBuffer.writeUInt32LE(8, 4);        // file size field
webpBuffer.write("WEBP", 8, "ascii");  // 57 45 42 50

// RIFF header + size + "WAVE" at bytes 8–11 (same 4-byte prefix as WEBP)
const wavBuffer = Buffer.alloc(16);
wavBuffer.write("RIFF", 0, "ascii");
wavBuffer.writeUInt32LE(8, 4);
wavBuffer.write("WAVE", 8, "ascii");

// Plain text — long enough to pass the 90 % printable-ASCII threshold
const textBuffer = Buffer.from(
  "Hello, this is a plain text file with enough content to pass the text check threshold " +
  "for validation purposes and more text here to be safe.",
  "utf-8"
);

// Unknown binary data — random non-printable, non-magic bytes
const unknownBuffer = Buffer.from([0x01, 0x02, 0x03, 0x04, 0x00, 0x00, 0x00, 0x00, 0x05]);

// ---------------------------------------------------------------------------
// validateFileType
// ---------------------------------------------------------------------------

describe("validateFileType", () => {
  describe("PNG-Erkennung", () => {
    test("sollte PNG anhand der Magic Bytes korrekt erkennen", () => {
      const result = validateFileType(pngBuffer, "image/png", "photo.png");
      expect(result.isValid).toBe(true);
      expect(result.detectedMimeType).toBe("image/png");
      expect(result.detectedExtension).toBe("png");
      expect(result.mismatch).toBe(false);
    });
  });

  describe("JPEG-Erkennung", () => {
    test("sollte JPEG anhand der Magic Bytes korrekt erkennen", () => {
      const result = validateFileType(jpegBuffer, "image/jpeg", "photo.jpg");
      expect(result.isValid).toBe(true);
      expect(result.detectedMimeType).toBe("image/jpeg");
      expect(result.detectedExtension).toBe("jpg");
      expect(result.mismatch).toBe(false);
    });
  });

  describe("PDF-Erkennung", () => {
    test("sollte PDF anhand der Magic Bytes korrekt erkennen", () => {
      const result = validateFileType(pdfBuffer, "application/pdf", "document.pdf");
      expect(result.isValid).toBe(true);
      expect(result.detectedMimeType).toBe("application/pdf");
      expect(result.detectedExtension).toBe("pdf");
      expect(result.mismatch).toBe(false);
    });
  });

  describe("ZIP-basierte Office-Dokumente", () => {
    test("sollte .docx als Word-MIME-Typ erkennen", () => {
      const result = validateFileType(
        zipBuffer,
        "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
        "report.docx"
      );
      expect(result.isValid).toBe(true);
      expect(result.detectedMimeType).toBe(
        "application/vnd.openxmlformats-officedocument.wordprocessingml.document"
      );
      expect(result.mismatch).toBe(false);
    });

    test("sollte .xlsx als Spreadsheet-MIME-Typ erkennen", () => {
      const result = validateFileType(
        zipBuffer,
        "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
        "data.xlsx"
      );
      expect(result.isValid).toBe(true);
      expect(result.detectedMimeType).toBe(
        "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"
      );
      expect(result.mismatch).toBe(false);
    });
  });

  describe("Textdateien", () => {
    test("sollte .txt-Datei als text/plain erkennen", () => {
      const result = validateFileType(textBuffer, "text/plain", "notes.txt");
      expect(result.isValid).toBe(true);
      expect(result.detectedMimeType).toBe("text/plain");
      expect(result.detectedExtension).toBe("txt");
      expect(result.mismatch).toBe(false);
    });

    test("sollte .md-Datei als text/markdown erkennen", () => {
      const result = validateFileType(textBuffer, "text/markdown", "readme.md");
      expect(result.isValid).toBe(true);
      expect(result.detectedMimeType).toBe("text/markdown");
      expect(result.detectedExtension).toBe("md");
      expect(result.mismatch).toBe(false);
    });
  });

  describe("RIFF/WEBP-Unterscheidung", () => {
    test("sollte RIFF-Header mit WEBP-Subtyp als image/webp erkennen", () => {
      const result = validateFileType(webpBuffer, "image/webp", "image.webp");
      expect(result.isValid).toBe(true);
      expect(result.detectedMimeType).toBe("image/webp");
      expect(result.detectedExtension).toBe("webp");
      expect(result.mismatch).toBe(false);
    });

    test("sollte RIFF-Header mit WAVE-Subtyp als audio/wav erkennen", () => {
      const result = validateFileType(wavBuffer, "audio/wav", "sound.wav");
      expect(result.isValid).toBe(true);
      expect(result.detectedMimeType).toBe("audio/wav");
      expect(result.detectedExtension).toBe("wav");
      expect(result.mismatch).toBe(false);
    });
  });

  describe("Unbekannte Dateitypen", () => {
    test("sollte isValid: false zurückgeben, wenn die Signatur nicht erkannt wird", () => {
      const result = validateFileType(unknownBuffer, "application/octet-stream", "file.bin");
      expect(result.isValid).toBe(false);
      expect(result.mismatch).toBe(true);
      expect(result.error).toBeDefined();
    });
  });

  describe("MIME-Typ-Abweichung", () => {
    test("sollte mismatch: true setzen, wenn behaupteter und erkannter Typ voneinander abweichen", () => {
      // Sends a JPEG buffer but claims it is a PNG
      const result = validateFileType(jpegBuffer, "image/png", "fake.png");
      expect(result.isValid).toBe(true);
      expect(result.detectedMimeType).toBe("image/jpeg");
      expect(result.mismatch).toBe(true);
    });
  });
});

// ---------------------------------------------------------------------------
// validateUpload
// ---------------------------------------------------------------------------

describe("validateUpload", () => {
  test("sollte erlaubte Dateitypen durchlassen", () => {
    const result = validateUpload(pngBuffer, "image/png", "image.png");
    expect(result.isValid).toBe(true);
    expect(result.detectedMimeType).toBe("image/png");
  });

  test("sollte nicht erlaubte Dateitypen blockieren", () => {
    // image/bmp is NOT in ALLOWED_UPLOAD_TYPES — use the BM magic bytes (42 4D)
    const bmpBuffer = Buffer.from([0x42, 0x4d, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00]);
    const result = validateUpload(bmpBuffer, "image/bmp", "image.bmp");
    expect(result.isValid).toBe(false);
    expect(result.error).toContain("nicht erlaubt");
  });
});

// ---------------------------------------------------------------------------
// ALLOWED_UPLOAD_TYPES
// ---------------------------------------------------------------------------

describe("ALLOWED_UPLOAD_TYPES", () => {
  test("sollte ein nicht-leeres Array von MIME-Typen exportieren", () => {
    expect(Array.isArray(ALLOWED_UPLOAD_TYPES)).toBe(true);
    expect(ALLOWED_UPLOAD_TYPES.length).toBeGreaterThan(0);
  });

  test("sollte gängige Dokumenten- und Bildformate enthalten", () => {
    expect(ALLOWED_UPLOAD_TYPES).toContain("application/pdf");
    expect(ALLOWED_UPLOAD_TYPES).toContain("image/png");
    expect(ALLOWED_UPLOAD_TYPES).toContain("image/jpeg");
    expect(ALLOWED_UPLOAD_TYPES).toContain("text/plain");
  });
});

/**
 * Tests for wordGenerator
 */

import { test, expect, describe } from "bun:test";
import { inflateRawSync } from "node:zlib";
import { generateWord } from "../wordGenerator";
import type { DocumentData } from "../types";

// Shared minimal fixture covering all four section types
const minimalDoc: DocumentData = {
  title: "Test Word Document",
  metadata: {
    Erstellt: "20.02.2026",
    Status: "Entwurf",
  },
  sections: [
    {
      title: "Text Section",
      type: "text",
      content: "First line of text\nSecond line of text",
    },
    {
      title: "Table Section",
      type: "table",
      content: {
        headers: ["Name", "Value", "Status"],
        rows: [
          ["Item A", "100", "active"],
          ["Item B", "200", "inactive"],
          ["Gesamtbetrag", "300", ""],
        ],
      },
    },
    {
      title: "List Section",
      type: "list",
      content: {
        items: ["First item", "Second item", "Third item"],
      },
    },
    {
      title: "Key-Value Section",
      type: "keyvalue",
      content: {
        items: [
          { key: "Projektleiter", value: "Max Mustermann" },
          { key: "Auftraggeber", value: "Acme Corp" },
        ],
      },
    },
  ],
};

/**
 * Extract and decompress a specific file entry from a ZIP-based buffer (XLSX/DOCX).
 * Returns the decompressed content as a UTF-8 string, or null if not found.
 */
function extractZipEntry(buf: Buffer, targetFilename: string): string | null {
  let pos = 0;
  while (pos < buf.length - 4) {
    // Local file header signature: PK\x03\x04
    if (
      buf[pos] === 0x50 &&
      buf[pos + 1] === 0x4b &&
      buf[pos + 2] === 0x03 &&
      buf[pos + 3] === 0x04
    ) {
      const compression = buf.readUInt16LE(pos + 8);
      const compressedSize = buf.readUInt32LE(pos + 18);
      const fnLen = buf.readUInt16LE(pos + 26);
      const extraLen = buf.readUInt16LE(pos + 28);
      const fn = buf.slice(pos + 30, pos + 30 + fnLen).toString("utf8");
      const dataStart = pos + 30 + fnLen + extraLen;

      if (fn === targetFilename) {
        const compData = buf.slice(dataStart, dataStart + compressedSize);
        if (compression === 0) {
          return compData.toString("utf8");
        } else if (compression === 8) {
          return inflateRawSync(compData).toString("utf8");
        }
        return null;
      }

      pos = dataStart + compressedSize;
    } else {
      pos++;
    }
  }
  return null;
}

describe("generateWord", () => {
  describe("basic output", () => {
    test("should return a Buffer", async () => {
      const result = await generateWord(minimalDoc);
      expect(result).toBeInstanceOf(Buffer);
    });

    test("should return a non-empty buffer", async () => {
      const result = await generateWord(minimalDoc);
      expect(result.length).toBeGreaterThan(0);
    });

    test("should produce a valid DOCX file (starts with PK magic bytes)", async () => {
      // DOCX is a ZIP-based format, so the first two bytes are always 'PK' (0x50 0x4B)
      const result = await generateWord(minimalDoc);
      expect(result[0]).toBe(0x50); // 'P'
      expect(result[1]).toBe(0x4b); // 'K'
    });
  });

  describe("document metadata", () => {
    test("should set creator to 'Adacor Workplace' in docProps/core.xml", async () => {
      const result = await generateWord(minimalDoc);
      const coreXml = extractZipEntry(result, "docProps/core.xml");
      expect(coreXml).not.toBeNull();
      expect(coreXml).toContain("<dc:creator>Adacor Workplace</dc:creator>");
    });

    test("should embed the document title in docProps/core.xml", async () => {
      const result = await generateWord(minimalDoc);
      const coreXml = extractZipEntry(result, "docProps/core.xml");
      expect(coreXml).not.toBeNull();
      expect(coreXml).toContain("Test Word Document");
    });
  });

  describe("section types", () => {
    test("should handle a text section", async () => {
      const doc: DocumentData = {
        title: "Text Only",
        metadata: {},
        sections: [
          { title: "Notes", type: "text", content: "Some text content" },
        ],
      };
      const result = await generateWord(doc);
      expect(result).toBeInstanceOf(Buffer);
      expect(result.length).toBeGreaterThan(0);
    });

    test("should handle a table section", async () => {
      const doc: DocumentData = {
        title: "Table Only",
        metadata: {},
        sections: [
          {
            title: "Data Table",
            type: "table",
            content: {
              headers: ["Col A", "Col B"],
              rows: [["r1c1", "r1c2"]],
            },
          },
        ],
      };
      const result = await generateWord(doc);
      expect(result).toBeInstanceOf(Buffer);
      expect(result.length).toBeGreaterThan(0);
    });

    test("should handle a list section", async () => {
      const doc: DocumentData = {
        title: "List Only",
        metadata: {},
        sections: [
          {
            title: "Items",
            type: "list",
            content: { items: ["alpha", "beta", "gamma"] },
          },
        ],
      };
      const result = await generateWord(doc);
      expect(result).toBeInstanceOf(Buffer);
      expect(result.length).toBeGreaterThan(0);
    });

    test("should handle a keyvalue section", async () => {
      const doc: DocumentData = {
        title: "KeyValue Only",
        metadata: {},
        sections: [
          {
            title: "Properties",
            type: "keyvalue",
            content: { items: [{ key: "Foo", value: "Bar" }] },
          },
        ],
      };
      const result = await generateWord(doc);
      expect(result).toBeInstanceOf(Buffer);
      expect(result.length).toBeGreaterThan(0);
    });
  });

  describe("edge cases", () => {
    test("should handle empty sections array", async () => {
      const doc: DocumentData = {
        title: "No Sections",
        metadata: { Info: "test" },
        sections: [],
      };
      const result = await generateWord(doc);
      expect(result).toBeInstanceOf(Buffer);
      expect(result.length).toBeGreaterThan(0);
    });

    test("should handle empty metadata", async () => {
      const doc: DocumentData = {
        title: "No Metadata",
        metadata: {},
        sections: [],
      };
      const result = await generateWord(doc);
      expect(result).toBeInstanceOf(Buffer);
      expect(result.length).toBeGreaterThan(0);
    });

    test("should handle a text section with empty string content", async () => {
      const doc: DocumentData = {
        title: "Empty Text",
        metadata: {},
        sections: [{ title: "Empty", type: "text", content: "" }],
      };
      const result = await generateWord(doc);
      expect(result).toBeInstanceOf(Buffer);
      expect(result.length).toBeGreaterThan(0);
    });

    test("should handle a text section with multi-line content", async () => {
      const doc: DocumentData = {
        title: "Multi-line",
        metadata: {},
        sections: [
          {
            title: "Lines",
            type: "text",
            content: "Line 1\nLine 2\nLine 3\nLine 4",
          },
        ],
      };
      const result = await generateWord(doc);
      expect(result).toBeInstanceOf(Buffer);
      expect(result.length).toBeGreaterThan(0);
    });

    test("should handle a list section with no items", async () => {
      const doc: DocumentData = {
        title: "Empty List",
        metadata: {},
        sections: [
          { title: "Empty List", type: "list", content: { items: [] } },
        ],
      };
      const result = await generateWord(doc);
      expect(result).toBeInstanceOf(Buffer);
      expect(result.length).toBeGreaterThan(0);
    });

    test("should handle a keyvalue section with no items", async () => {
      const doc: DocumentData = {
        title: "Empty KV",
        metadata: {},
        sections: [
          { title: "Empty KV", type: "keyvalue", content: { items: [] } },
        ],
      };
      const result = await generateWord(doc);
      expect(result).toBeInstanceOf(Buffer);
      expect(result.length).toBeGreaterThan(0);
    });

    test("should handle a table with a Gesamt total row (highlighted differently)", async () => {
      const doc: DocumentData = {
        title: "Budget",
        metadata: {},
        sections: [
          {
            title: "Budget",
            type: "table",
            content: {
              headers: ["Position", "Betrag"],
              rows: [
                ["Hardware", "1.000 EUR"],
                ["Gesamtbudget", "1.000 EUR"],
              ],
            },
          },
        ],
      };
      const result = await generateWord(doc);
      expect(result).toBeInstanceOf(Buffer);
      expect(result.length).toBeGreaterThan(0);
    });

    test("should handle a table with null/undefined cell values gracefully", async () => {
      const doc: DocumentData = {
        title: "Sparse Table",
        metadata: {},
        sections: [
          {
            title: "Sparse",
            type: "table",
            content: {
              headers: ["A", "B"],
              rows: [
                [null as unknown as string, "value"],
                ["key", undefined as unknown as string],
              ],
            },
          },
        ],
      };
      const result = await generateWord(doc);
      expect(result).toBeInstanceOf(Buffer);
      expect(result.length).toBeGreaterThan(0);
    });

    test("should handle all four section types in a single document", async () => {
      const result = await generateWord(minimalDoc);
      expect(result).toBeInstanceOf(Buffer);
      expect(result.length).toBeGreaterThan(0);
    });
  });
});

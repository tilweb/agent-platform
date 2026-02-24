/**
 * Tests for pdfGenerator
 */

import { test, expect, describe } from "bun:test";
import { generatePdf } from "../pdfGenerator";
import type { DocumentData } from "../types";

// Shared minimal fixture covering all four section types
const minimalDoc: DocumentData = {
  title: "Test PDF Document",
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

describe("generatePdf", () => {
  describe("basic output", () => {
    test("should return a Buffer", async () => {
      const result = await generatePdf(minimalDoc);
      expect(result).toBeInstanceOf(Buffer);
    });

    test("should return a non-empty buffer", async () => {
      const result = await generatePdf(minimalDoc);
      expect(result.length).toBeGreaterThan(0);
    });

    test("should produce a valid PDF file (starts with %PDF magic bytes)", async () => {
      const result = await generatePdf(minimalDoc);
      // PDF files always start with "%PDF"
      const header = result.slice(0, 4).toString("ascii");
      expect(header).toBe("%PDF");
    });
  });

  describe("document metadata", () => {
    test("should set author to 'KI-Workplace' in PDF info dictionary", async () => {
      const result = await generatePdf(minimalDoc);
      // The author string is embedded as plain text in the PDF content stream
      const content = result.toString("latin1");
      expect(content).toContain("KI-Workplace");
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
      const result = await generatePdf(doc);
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
      const result = await generatePdf(doc);
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
      const result = await generatePdf(doc);
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
      const result = await generatePdf(doc);
      expect(result).toBeInstanceOf(Buffer);
      expect(result.length).toBeGreaterThan(0);
    });

    test("should handle a table with 2 columns (uses '*' widths)", async () => {
      const doc: DocumentData = {
        title: "Two Col Table",
        metadata: {},
        sections: [
          {
            title: "Two Cols",
            type: "table",
            content: {
              headers: ["Key", "Value"],
              rows: [["a", "b"]],
            },
          },
        ],
      };
      const result = await generatePdf(doc);
      expect(result).toBeInstanceOf(Buffer);
      expect(result.length).toBeGreaterThan(0);
    });

    test("should handle a table with 5+ columns (uses '*' for all)", async () => {
      const doc: DocumentData = {
        title: "Wide Table",
        metadata: {},
        sections: [
          {
            title: "Wide",
            type: "table",
            content: {
              headers: ["A", "B", "C", "D", "E"],
              rows: [["1", "2", "3", "4", "5"]],
            },
          },
        ],
      };
      const result = await generatePdf(doc);
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
      const result = await generatePdf(doc);
      expect(result).toBeInstanceOf(Buffer);
      expect(result.length).toBeGreaterThan(0);
    });

    test("should handle empty metadata", async () => {
      const doc: DocumentData = {
        title: "No Metadata",
        metadata: {},
        sections: [],
      };
      const result = await generatePdf(doc);
      expect(result).toBeInstanceOf(Buffer);
      expect(result.length).toBeGreaterThan(0);
    });

    test("should handle a text section with empty string content", async () => {
      const doc: DocumentData = {
        title: "Empty Text",
        metadata: {},
        sections: [{ title: "Empty", type: "text", content: "" }],
      };
      const result = await generatePdf(doc);
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
      const result = await generatePdf(doc);
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
      const result = await generatePdf(doc);
      expect(result).toBeInstanceOf(Buffer);
      expect(result.length).toBeGreaterThan(0);
    });

    test("should handle a table row with a Gesamt total marker (highlighted differently)", async () => {
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
      const result = await generatePdf(doc);
      expect(result).toBeInstanceOf(Buffer);
      expect(result.length).toBeGreaterThan(0);
    });

    test("should handle all four section types in a single document", async () => {
      const result = await generatePdf(minimalDoc);
      expect(result).toBeInstanceOf(Buffer);
      expect(result.length).toBeGreaterThan(0);
    });
  });
});

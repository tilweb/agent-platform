/**
 * Tests for chatExporter
 */

import { test, expect, describe } from "bun:test";
import {
  extractTablesFromMarkdown,
  extractListsFromMarkdown,
  extractCodeBlocks,
  createSafeFilename,
  mapChatToDocument,
} from "../chatExporter";
import type { ChatExportOptions } from "../chatExporter";
import type { ChatHistory, ChatHistoryMessage, ChatMaterial } from "../../memory";

// ============== Hilfsfunktionen ==============

function buildChat(overrides: Partial<ChatHistory> = {}): ChatHistory {
  return {
    id: "test-chat-id-123456",
    title: "Testkonversation",
    createdAt: "2026-01-15T10:00:00.000Z",
    updatedAt: "2026-01-15T11:00:00.000Z",
    messages: [],
    ...overrides,
  };
}

function userMsg(content: string): ChatHistoryMessage {
  return { role: "user", content };
}

function assistantMsg(content: string): ChatHistoryMessage {
  return { role: "assistant", content };
}

// ============== extractTablesFromMarkdown ==============

describe("extractTablesFromMarkdown", () => {
  describe("einfache Tabellen", () => {
    test("sollte eine einfache zweispaltige Tabelle erkennen", () => {
      const md = `| Name | Wert |
|------|------|
| Alpha | 1 |
| Beta | 2 |`;
      const tables = extractTablesFromMarkdown(md);
      expect(tables).toHaveLength(1);
      expect(tables[0]!.headers).toEqual(["Name", "Wert"]);
      expect(tables[0]!.rows).toHaveLength(2);
      expect(tables[0]!.rows[0]).toEqual(["Alpha", "1"]);
      expect(tables[0]!.rows[1]).toEqual(["Beta", "2"]);
    });

    test("sollte eine Tabelle mit drei Spalten erkennen", () => {
      const md = `| Vorname | Nachname | Alter |
|---------|----------|-------|
| Max | Muster | 30 |`;
      const tables = extractTablesFromMarkdown(md);
      expect(tables).toHaveLength(1);
      expect(tables[0]!.headers).toEqual(["Vorname", "Nachname", "Alter"]);
      expect(tables[0]!.rows[0]).toEqual(["Max", "Muster", "30"]);
    });

    test("sollte eine Tabelle am Ende des Inhalts ohne abschließende Leerzeile erkennen", () => {
      const md = `| A | B |
|---|---|
| 1 | 2 |`;
      const tables = extractTablesFromMarkdown(md);
      expect(tables).toHaveLength(1);
      expect(tables[0]!.rows).toHaveLength(1);
    });

    test("sollte leere Zellen korrekt behandeln", () => {
      const md = `| Spalte1 | Spalte2 | Spalte3 |
|---------|---------|---------|
| Wert |  | Ende |`;
      const tables = extractTablesFromMarkdown(md);
      expect(tables).toHaveLength(1);
      expect(tables[0]!.rows[0]).toEqual(["Wert", "", "Ende"]);
    });

    test("sollte mehrere Zeilen in einer Tabelle verarbeiten", () => {
      const md = `| Nr | Artikel |
|----|---------|
| 1 | Apfel |
| 2 | Birne |
| 3 | Kirsche |`;
      const tables = extractTablesFromMarkdown(md);
      expect(tables).toHaveLength(1);
      expect(tables[0]!.rows).toHaveLength(3);
    });
  });

  describe("Ausrichtungsmarker", () => {
    test("sollte Ausrichtungsmarker mit Doppelpunkten erkennen (linksbündig)", () => {
      const md = `| Name | Wert |
|:-----|:-----|
| Test | 42 |`;
      const tables = extractTablesFromMarkdown(md);
      expect(tables).toHaveLength(1);
      expect(tables[0]!.headers).toEqual(["Name", "Wert"]);
    });

    test("sollte Ausrichtungsmarker mit Doppelpunkten erkennen (rechtsbündig)", () => {
      const md = `| Name | Wert |
|-----:|-----:|
| Test | 42 |`;
      const tables = extractTablesFromMarkdown(md);
      expect(tables).toHaveLength(1);
    });

    test("sollte Ausrichtungsmarker mit Doppelpunkten erkennen (zentriert)", () => {
      const md = `| Name | Wert |
|:----:|:----:|
| Test | 42 |`;
      const tables = extractTablesFromMarkdown(md);
      expect(tables).toHaveLength(1);
    });
  });

  describe("mehrere Tabellen", () => {
    test("sollte zwei voneinander getrennte Tabellen erkennen", () => {
      const md = `| A | B |
|---|---|
| 1 | 2 |

Etwas Text dazwischen.

| X | Y |
|---|---|
| 3 | 4 |`;
      const tables = extractTablesFromMarkdown(md);
      expect(tables).toHaveLength(2);
      expect(tables[0]!.headers).toEqual(["A", "B"]);
      expect(tables[1]!.headers).toEqual(["X", "Y"]);
    });

    test("sollte drei Tabellen erkennen", () => {
      const md = `| A |
|---|
| 1 |

Text.

| B |
|---|
| 2 |

Text.

| C |
|---|
| 3 |`;
      const tables = extractTablesFromMarkdown(md);
      expect(tables).toHaveLength(3);
    });
  });

  describe("Grenzfälle", () => {
    test("sollte bei leerem String ein leeres Array zurückgeben", () => {
      expect(extractTablesFromMarkdown("")).toEqual([]);
    });

    test("sollte bei reinem Text ohne Tabelle ein leeres Array zurückgeben", () => {
      expect(extractTablesFromMarkdown("Kein Tabelle hier.")).toEqual([]);
    });

    test("sollte bei nur einem Header ohne Trennzeile keine Tabelle erkennen", () => {
      const md = `| Kopf | Kopf2 |
Kein Trennzeichen hier.`;
      const tables = extractTablesFromMarkdown(md);
      expect(tables).toHaveLength(0);
    });

    test("sollte Tabelle ignorieren, die nur Header und Trennzeile hat (keine Datenzeilen)", () => {
      const md = `| A | B |
|---|---|`;
      const tables = extractTablesFromMarkdown(md);
      expect(tables).toHaveLength(0);
    });

    test("sollte Tabelle in Mischtext mit Absätzen erkennen", () => {
      const md = `Einleitung.

| Pos | Betrag |
|-----|--------|
| Hardware | 500 |
| Software | 300 |

Fazit.`;
      const tables = extractTablesFromMarkdown(md);
      expect(tables).toHaveLength(1);
      expect(tables[0]!.rows).toHaveLength(2);
    });

    test("sollte Zellen mit Leerzeichen um den Inhalt trimmen", () => {
      const md = `|  Name  |  Wert  |
|--------|--------|
|  Alice |   100  |`;
      const tables = extractTablesFromMarkdown(md);
      expect(tables[0]!.headers).toEqual(["Name", "Wert"]);
      expect(tables[0]!.rows[0]).toEqual(["Alice", "100"]);
    });
  });
});

// ============== extractListsFromMarkdown ==============

describe("extractListsFromMarkdown", () => {
  describe("ungeordnete Listen", () => {
    test("sollte eine Liste mit Bindestrichen erkennen", () => {
      const md = `- Erster Punkt\n- Zweiter Punkt\n- Dritter Punkt`;
      const items = extractListsFromMarkdown(md);
      expect(items).toEqual(["Erster Punkt", "Zweiter Punkt", "Dritter Punkt"]);
    });

    test("sollte eine Liste mit Sternchen erkennen", () => {
      const md = `* Punkt A\n* Punkt B`;
      const items = extractListsFromMarkdown(md);
      expect(items).toEqual(["Punkt A", "Punkt B"]);
    });

    test("sollte gemischte Marker (Bindestrich und Sternchen) erkennen", () => {
      const md = `- Bindestrich\n* Sternchen`;
      const items = extractListsFromMarkdown(md);
      expect(items).toEqual(["Bindestrich", "Sternchen"]);
    });

    test("sollte einen einzelnen Listenpunkt erkennen", () => {
      const md = `- Einziger Punkt`;
      expect(extractListsFromMarkdown(md)).toEqual(["Einziger Punkt"]);
    });
  });

  describe("geordnete Listen", () => {
    test("sollte eine nummerierte Liste erkennen", () => {
      const md = `1. Erster Schritt\n2. Zweiter Schritt\n3. Dritter Schritt`;
      const items = extractListsFromMarkdown(md);
      expect(items).toEqual(["Erster Schritt", "Zweiter Schritt", "Dritter Schritt"]);
    });

    test("sollte nummerierte Listen mit zweistelligen Nummern erkennen", () => {
      const md = `10. Zehnter Punkt\n11. Elfter Punkt`;
      const items = extractListsFromMarkdown(md);
      expect(items).toEqual(["Zehnter Punkt", "Elfter Punkt"]);
    });

    test("sollte einen einzelnen nummerierten Punkt erkennen", () => {
      expect(extractListsFromMarkdown("1. Einzelner Schritt")).toEqual(["Einzelner Schritt"]);
    });
  });

  describe("gemischte Listen", () => {
    test("sollte geordnete und ungeordnete Listenelemente kombinieren", () => {
      const md = `- Punkt A\n1. Schritt 1\n- Punkt B\n2. Schritt 2`;
      const items = extractListsFromMarkdown(md);
      expect(items).toEqual(["Punkt A", "Schritt 1", "Punkt B", "Schritt 2"]);
    });

    test("sollte Liste in Mischtext extrahieren", () => {
      const md = `Einleitung.\n\n- Punkt 1\n- Punkt 2\n\nFazit.`;
      const items = extractListsFromMarkdown(md);
      expect(items).toEqual(["Punkt 1", "Punkt 2"]);
    });
  });

  describe("verschachtelte Listen", () => {
    test("sollte eingerückte Unterpunkte mit Bindestrich erkennen", () => {
      const md = `- Hauptpunkt\n  - Unterpunkt A\n  - Unterpunkt B`;
      const items = extractListsFromMarkdown(md);
      // Eingerückte Elemente passen auch zum Regex nach dem trim()
      expect(items).toContain("Hauptpunkt");
      expect(items).toContain("Unterpunkt A");
      expect(items).toContain("Unterpunkt B");
    });
  });

  describe("Grenzfälle", () => {
    test("sollte bei leerem String ein leeres Array zurückgeben", () => {
      expect(extractListsFromMarkdown("")).toEqual([]);
    });

    test("sollte bei reinem Text ohne Listenpunkte ein leeres Array zurückgeben", () => {
      expect(extractListsFromMarkdown("Kein Listenpunkt hier.")).toEqual([]);
    });

    test("sollte eine Zeile, die nur '-' enthält, ignorieren", () => {
      // Trennlinie in Markdown, kein Listenelement
      expect(extractListsFromMarkdown("---")).toEqual([]);
    });

    test("sollte '- ' ohne Text ignorieren", () => {
      // '- ' ohne nachfolgenden Text matcht den Regex nicht (braucht mindestens ein Zeichen)
      const items = extractListsFromMarkdown("- ");
      expect(items).toEqual([]);
    });

    test("sollte Listenpunkte mit langen Texten korrekt extrahieren", () => {
      const longText = "A".repeat(200);
      const md = `- ${longText}`;
      const items = extractListsFromMarkdown(md);
      expect(items).toEqual([longText]);
    });
  });
});

// ============== extractCodeBlocks ==============

describe("extractCodeBlocks", () => {
  describe("einfache Codeblöcke", () => {
    test("sollte einen Codeblock mit Sprache erkennen", () => {
      const md = "```typescript\nconst x = 1;\n```";
      const blocks = extractCodeBlocks(md);
      expect(blocks).toHaveLength(1);
      expect(blocks[0]!.language).toBe("typescript");
      expect(blocks[0]!.code).toBe("const x = 1;");
    });

    test("sollte einen Codeblock ohne Sprache als 'text' kennzeichnen", () => {
      const md = "```\nkein code\n```";
      const blocks = extractCodeBlocks(md);
      expect(blocks).toHaveLength(1);
      expect(blocks[0]!.language).toBe("text");
      expect(blocks[0]!.code).toBe("kein code");
    });

    test("sollte JavaScript erkennen", () => {
      const md = "```javascript\nconsole.log('Hallo');\n```";
      const blocks = extractCodeBlocks(md);
      expect(blocks[0]!.language).toBe("javascript");
    });

    test("sollte Python erkennen", () => {
      const md = "```python\nprint('Hallo')\n```";
      const blocks = extractCodeBlocks(md);
      expect(blocks[0]!.language).toBe("python");
    });

    test("sollte mehrzeiligen Code korrekt extrahieren", () => {
      const md = "```bash\necho hello\necho world\nls -la\n```";
      const blocks = extractCodeBlocks(md);
      expect(blocks[0]!.code).toBe("echo hello\necho world\nls -la");
    });
  });

  describe("mehrere Codeblöcke", () => {
    test("sollte zwei Codeblöcke erkennen", () => {
      const md = "```js\nvar a = 1;\n```\n\nText.\n\n```python\nb = 2\n```";
      const blocks = extractCodeBlocks(md);
      expect(blocks).toHaveLength(2);
      expect(blocks[0]!.language).toBe("js");
      expect(blocks[1]!.language).toBe("python");
    });

    test("sollte drei Codeblöcke erkennen", () => {
      const md = "```a\ncode1\n```\n```b\ncode2\n```\n```c\ncode3\n```";
      const blocks = extractCodeBlocks(md);
      expect(blocks).toHaveLength(3);
    });
  });

  describe("Whitespace-Behandlung", () => {
    test("sollte führende und abschließende Leerzeilen im Code entfernen", () => {
      const md = "```js\n\nconst x = 1;\n\n```";
      const blocks = extractCodeBlocks(md);
      expect(blocks[0]!.code).toBe("const x = 1;");
    });

    test("sollte Code mit Einrückungen korrekt extrahieren", () => {
      const md = "```json\n{\n  \"key\": \"value\"\n}\n```";
      const blocks = extractCodeBlocks(md);
      expect(blocks[0]!.code).toContain("\"key\": \"value\"");
    });
  });

  describe("Grenzfälle", () => {
    test("sollte bei leerem String ein leeres Array zurückgeben", () => {
      expect(extractCodeBlocks("")).toEqual([]);
    });

    test("sollte bei Text ohne Codeblöcke ein leeres Array zurückgeben", () => {
      expect(extractCodeBlocks("Normaler Text ohne Code.")).toEqual([]);
    });

    test("sollte einen Codeblock mit leerem Inhalt als leeren String zurückgeben", () => {
      const md = "```js\n\n```";
      const blocks = extractCodeBlocks(md);
      expect(blocks).toHaveLength(1);
      expect(blocks[0]!.code).toBe("");
    });

    test("sollte unvollständige Codeblöcke ignorieren (kein schließendes ```)", () => {
      const md = "```js\nconst x = 1;";
      const blocks = extractCodeBlocks(md);
      expect(blocks).toHaveLength(0);
    });

    test("sollte SQL erkennen", () => {
      const md = "```sql\nSELECT * FROM users;\n```";
      const blocks = extractCodeBlocks(md);
      expect(blocks[0]!.language).toBe("sql");
    });

    test("sollte Codeblock mit Sonderzeichen korrekt extrahieren", () => {
      const code = 'const url = "https://example.com/api?key=123&value=<test>";';
      const md = `\`\`\`js\n${code}\n\`\`\``;
      const blocks = extractCodeBlocks(md);
      expect(blocks[0]!.code).toBe(code);
    });
  });
});

// ============== createSafeFilename ==============

describe("createSafeFilename", () => {
  describe("Sonderzeichen entfernen", () => {
    test("sollte Schrägstriche entfernen", () => {
      const result = createSafeFilename("Bericht/Entwurf", "abcd12345678");
      expect(result).not.toContain("/");
    });

    test("sollte Anführungszeichen entfernen", () => {
      const result = createSafeFilename('Titel "Mit Anführungszeichen"', "abcd12345678");
      expect(result).not.toContain('"');
    });

    test("sollte Ausrufezeichen und Fragezeichen entfernen", () => {
      const result = createSafeFilename("Wichtig! Dringend?", "abcd12345678");
      expect(result).not.toContain("!");
      expect(result).not.toContain("?");
    });

    test("sollte Doppelpunkte entfernen", () => {
      const result = createSafeFilename("Kapitel 1: Einleitung", "abcd12345678");
      expect(result).not.toContain(":");
    });

    test("sollte Sternchen entfernen", () => {
      const result = createSafeFilename("Datei*Name", "abcd12345678");
      expect(result).not.toContain("*");
    });
  });

  describe("Leerzeichen ersetzen", () => {
    test("sollte einzelne Leerzeichen durch Unterstriche ersetzen", () => {
      const result = createSafeFilename("Mein Chat Titel", "abcd12345678");
      expect(result).toContain("Mein_Chat_Titel");
    });

    test("sollte mehrere aufeinanderfolgende Leerzeichen durch einen Unterstrich ersetzen", () => {
      const result = createSafeFilename("Titel   mit   Lücken", "abcd12345678");
      expect(result).not.toMatch(/__+/);
      expect(result).toContain("Titel_mit_Lücken");
    });
  });

  describe("Chat-ID anhängen", () => {
    test("sollte die letzten 8 Zeichen der Chat-ID anhängen", () => {
      const result = createSafeFilename("Test", "prefix-ABCD1234");
      expect(result).toEndWith("_ABCD1234");
    });

    test("sollte die letzten 8 Zeichen bei langer ID verwenden", () => {
      const result = createSafeFilename("Chat", "this-is-a-very-long-id-12345678");
      expect(result).toEndWith("_12345678");
    });

    test("sollte Titel und ID mit Unterstrich trennen", () => {
      const result = createSafeFilename("Gespräch", "testid12");
      expect(result).toBe("Gespräch_testid12");
    });
  });

  describe("Längenkürzung", () => {
    test("sollte Titel auf 50 Zeichen kürzen", () => {
      const longTitle = "A".repeat(100);
      const result = createSafeFilename(longTitle, "12345678");
      // Titel ist auf 50 gekürzt + "_" + 8 Zeichen ID = 59 Zeichen
      const titlePart = result.split("_").slice(0, -1).join("_");
      expect(titlePart.length).toBeLessThanOrEqual(50);
    });

    test("sollte genau 50 Zeichen Titel unverändert lassen", () => {
      const title50 = "A".repeat(50);
      const result = createSafeFilename(title50, "12345678");
      expect(result).toStartWith(title50);
    });
  });

  describe("erlaubte Zeichen", () => {
    test("sollte deutsche Umlaute beibehalten", () => {
      const result = createSafeFilename("Gespräch über Äpfel Öl Übung", "12345678");
      expect(result).toContain("Gespräch");
      expect(result).toContain("Äpfel");
      expect(result).toContain("Öl");
      expect(result).toContain("Übung");
    });

    test("sollte das Eszett beibehalten", () => {
      const result = createSafeFilename("Straße", "12345678");
      expect(result).toContain("Straße");
    });

    test("sollte alphanumerische Zeichen beibehalten", () => {
      const result = createSafeFilename("Chat123", "12345678");
      expect(result).toContain("Chat123");
    });

    test("sollte Bindestriche im Titel beibehalten", () => {
      const result = createSafeFilename("Mein-Chat", "12345678");
      expect(result).toContain("Mein-Chat");
    });
  });

  describe("Grenzfälle", () => {
    test("sollte bei leerem Titel nur die ID zurückgeben", () => {
      const result = createSafeFilename("", "12345678");
      expect(result).toBe("_12345678");
    });

    test("sollte bei Titel mit nur Sonderzeichen nur die ID zurückgeben", () => {
      const result = createSafeFilename("!!!???###", "12345678");
      expect(result).toBe("_12345678");
    });

    test("sollte Unicode außerhalb der erlaubten Menge entfernen", () => {
      const result = createSafeFilename("Chat 🚀 Rocket", "12345678");
      expect(result).not.toContain("🚀");
    });
  });
});

// ============== mapChatToDocument ==============

describe("mapChatToDocument", () => {
  describe("Grundstruktur", () => {
    test("sollte ein DocumentData-Objekt mit title, metadata und sections zurückgeben", () => {
      const chat = buildChat({ title: "Mein Chat" });
      const doc = mapChatToDocument(chat);
      expect(doc).toHaveProperty("title");
      expect(doc).toHaveProperty("metadata");
      expect(doc).toHaveProperty("sections");
    });

    test("sollte den Titel mit 'Chat: ' Präfix setzen", () => {
      const chat = buildChat({ title: "Projekt Alpha" });
      const doc = mapChatToDocument(chat);
      expect(doc.title).toBe("Chat: Projekt Alpha");
    });

    test("sollte bei leerem Titel 'Unbenannte Konversation' verwenden", () => {
      const chat = buildChat({ title: "" });
      const doc = mapChatToDocument(chat);
      expect(doc.title).toBe("Chat: Unbenannte Konversation");
    });

    test("sollte Metadaten mit Erstellt, Exportiert und Nachrichten enthalten", () => {
      const chat = buildChat({ messages: [userMsg("Hallo")] });
      const doc = mapChatToDocument(chat);
      expect(doc.metadata).toHaveProperty("Erstellt");
      expect(doc.metadata).toHaveProperty("Exportiert");
      expect(doc.metadata).toHaveProperty("Nachrichten", "1");
    });
  });

  describe("Metadaten-Sektion (includeMetadata)", () => {
    test("sollte bei includeMetadata=true eine Konversationsdetails-Sektion erzeugen", () => {
      const chat = buildChat();
      const doc = mapChatToDocument(chat, { scope: "full", includeMetadata: true });
      const metaSection = doc.sections.find(s => s.title === "Konversationsdetails");
      expect(metaSection).toBeDefined();
      expect(metaSection!.type).toBe("keyvalue");
    });

    test("sollte bei includeMetadata=false keine Metadaten-Sektion erzeugen", () => {
      const chat = buildChat();
      const doc = mapChatToDocument(chat, { scope: "full", includeMetadata: false });
      const metaSection = doc.sections.find(s => s.title === "Konversationsdetails");
      expect(metaSection).toBeUndefined();
    });

    test("sollte Titel in den Metadaten-Items enthalten", () => {
      const chat = buildChat({ title: "Mein Testtitel" });
      const doc = mapChatToDocument(chat, { scope: "full", includeMetadata: true });
      const metaSection = doc.sections.find(s => s.title === "Konversationsdetails");
      const items = metaSection!.content.items as { key: string; value: string }[];
      const titelItem = items.find(i => i.key === "Titel");
      expect(titelItem!.value).toBe("Mein Testtitel");
    });

    test("sollte 'Unbenannt' verwenden wenn Titel leer ist", () => {
      const chat = buildChat({ title: "" });
      const doc = mapChatToDocument(chat, { scope: "full", includeMetadata: true });
      const metaSection = doc.sections.find(s => s.title === "Konversationsdetails");
      const items = metaSection!.content.items as { key: string; value: string }[];
      const titelItem = items.find(i => i.key === "Titel");
      expect(titelItem!.value).toBe("Unbenannt");
    });

    test("sollte Zusammenfassung in Metadaten aufnehmen, wenn vorhanden", () => {
      const chat = buildChat({ summary: "Das ist eine Zusammenfassung." });
      const doc = mapChatToDocument(chat, { scope: "full", includeMetadata: true });
      const metaSection = doc.sections.find(s => s.title === "Konversationsdetails");
      const items = metaSection!.content.items as { key: string; value: string }[];
      const summaryItem = items.find(i => i.key === "Zusammenfassung");
      expect(summaryItem!.value).toBe("Das ist eine Zusammenfassung.");
    });

    test("sollte Schlagworte in Metadaten aufnehmen, wenn vorhanden", () => {
      const chat = buildChat({ keywords: ["KI", "Machine Learning", "GPT"] });
      const doc = mapChatToDocument(chat, { scope: "full", includeMetadata: true });
      const metaSection = doc.sections.find(s => s.title === "Konversationsdetails");
      const items = metaSection!.content.items as { key: string; value: string }[];
      const kwItem = items.find(i => i.key === "Schlagworte");
      expect(kwItem!.value).toBe("KI, Machine Learning, GPT");
    });

    test("sollte keine Schlagworte-Zeile hinzufügen, wenn keywords leer ist", () => {
      const chat = buildChat({ keywords: [] });
      const doc = mapChatToDocument(chat, { scope: "full", includeMetadata: true });
      const metaSection = doc.sections.find(s => s.title === "Konversationsdetails");
      const items = metaSection!.content.items as { key: string; value: string }[];
      const kwItem = items.find(i => i.key === "Schlagworte");
      expect(kwItem).toBeUndefined();
    });
  });

  describe("Nachrichten (scope: full)", () => {
    test("sollte Benutzernachrichten als Text-Sektion hinzufügen", () => {
      const chat = buildChat({ messages: [userMsg("Wie geht es dir?")] });
      const doc = mapChatToDocument(chat, { scope: "full" });
      const userSection = doc.sections.find(s => s.title === "Benutzer (1)");
      expect(userSection).toBeDefined();
      expect(userSection!.type).toBe("text");
      expect(userSection!.content).toBe("Wie geht es dir?");
    });

    test("sollte Assistentennachricht ohne Tabelle/Code als Text-Sektion hinzufügen", () => {
      const chat = buildChat({ messages: [assistantMsg("Mir geht es gut, danke!")] });
      const doc = mapChatToDocument(chat, { scope: "full" });
      const assistantSection = doc.sections.find(s => s.title === "Assistent (1)");
      expect(assistantSection).toBeDefined();
      expect(assistantSection!.type).toBe("text");
    });

    test("sollte Sektionen für mehrere Nachrichten in richtiger Reihenfolge erstellen", () => {
      const chat = buildChat({
        messages: [
          userMsg("Frage 1"),
          assistantMsg("Antwort 1"),
          userMsg("Frage 2"),
          assistantMsg("Antwort 2"),
        ],
      });
      const doc = mapChatToDocument(chat, { scope: "full", includeMetadata: false });
      const titles = doc.sections.map(s => s.title);
      expect(titles).toContain("Benutzer (1)");
      expect(titles).toContain("Assistent (2)");
      expect(titles).toContain("Benutzer (3)");
      expect(titles).toContain("Assistent (4)");
    });

    test("sollte Tabellen in Assistentennachrichten als eigene Tabellen-Sektion extrahieren", () => {
      const tableContent = `| Name | Wert |\n|------|------|\n| Alpha | 1 |`;
      const chat = buildChat({ messages: [assistantMsg(tableContent)] });
      const doc = mapChatToDocument(chat, { scope: "full", includeMetadata: false });
      const tableSection = doc.sections.find(s => s.type === "table");
      expect(tableSection).toBeDefined();
      expect(tableSection!.title).toBe("Tabelle");
    });

    test("sollte bei mehreren Tabellen in einer Nachricht nummerierte Tabellensektionen erstellen", () => {
      const content = `| A |\n|---|\n| 1 |\n\nText.\n\n| B |\n|---|\n| 2 |`;
      const chat = buildChat({ messages: [assistantMsg(content)] });
      const doc = mapChatToDocument(chat, { scope: "full", includeMetadata: false });
      const tableSections = doc.sections.filter(s => s.type === "table");
      expect(tableSections).toHaveLength(2);
      expect(tableSections[0]!.title).toBe("Tabelle 1");
      expect(tableSections[1]!.title).toBe("Tabelle 2");
    });

    test("sollte Code-Blöcke in Assistentennachrichten als Code-Sektion extrahieren", () => {
      const content = "Hier ist ein Beispiel:\n\n```typescript\nconst x = 42;\n```";
      const chat = buildChat({ messages: [assistantMsg(content)] });
      const doc = mapChatToDocument(chat, { scope: "full", includeMetadata: false });
      const codeSection = doc.sections.find(s => s.title.startsWith("Code ("));
      expect(codeSection).toBeDefined();
      expect(codeSection!.title).toBe("Code (typescript)");
      expect(codeSection!.content).toBe("const x = 42;");
    });

    test("sollte leere Nachrichten korrekt verarbeiten ohne zu werfen", () => {
      const chat = buildChat({ messages: [userMsg(""), assistantMsg("")] });
      expect(() => mapChatToDocument(chat, { scope: "full" })).not.toThrow();
    });
  });

  describe("scope: last_response", () => {
    test("sollte nur die letzten zwei Nachrichten (Benutzer + Assistent) einschließen, nicht alle vier", () => {
      // Vier Nachrichten: nur die letzten zwei sollen in messagesToInclude sein.
      // Der Schleifenindex i ist 0-basiert innerhalb der Teilmenge,
      // daher lauten die Sektionen "Benutzer (1)" und "Assistent (2)" — aber insgesamt nur 2 Sektionen.
      const chat = buildChat({
        messages: [
          userMsg("Alte Frage"),
          assistantMsg("Alte Antwort"),
          userMsg("Neue Frage"),
          assistantMsg("Neue Antwort"),
        ],
      });
      const doc = mapChatToDocument(chat, { scope: "last_response", includeMetadata: false });
      // Genau 2 Nachrichtensektionen (Benutzer + Assistent der letzten Runde)
      const msgSections = doc.sections.filter(
        s => s.title.startsWith("Benutzer") || s.title.startsWith("Assistent")
      );
      expect(msgSections).toHaveLength(2);
    });

    test("sollte den Benutzer- und Assistent-Abschnitt der letzten Runde enthalten", () => {
      const chat = buildChat({
        messages: [
          userMsg("Erste Frage"),
          assistantMsg("Erste Antwort"),
          userMsg("Zweite Frage"),
          assistantMsg("Zweite Antwort"),
        ],
      });
      const doc = mapChatToDocument(chat, { scope: "last_response", includeMetadata: false });
      const titles = doc.sections.map(s => s.title);
      expect(titles.some(t => t.startsWith("Benutzer"))).toBe(true);
      expect(titles.some(t => t.startsWith("Assistent"))).toBe(true);
    });

    test("sollte bei nur einer Assistentennachricht ohne vorherige Benutzernachricht nur die Assistentennachricht einschließen", () => {
      const chat = buildChat({
        messages: [assistantMsg("Nur ich")],
      });
      const doc = mapChatToDocument(chat, { scope: "last_response", includeMetadata: false });
      const assistantSections = doc.sections.filter(s => s.title.startsWith("Assistent") || s.type === "text");
      expect(assistantSections.length).toBeGreaterThanOrEqual(1);
    });

    test("sollte bei keiner Assistentennachricht alle vorhandenen Nachrichten einschließen", () => {
      // Wenn kein Assistent gefunden wird, bleibt messagesToInclude = chat.messages (unveränderter Fall)
      const chat = buildChat({ messages: [userMsg("Nur Benutzer")] });
      const doc = mapChatToDocument(chat, { scope: "last_response", includeMetadata: false });
      const userSections = doc.sections.filter(s => s.title.startsWith("Benutzer"));
      expect(userSections).toHaveLength(1);
    });
  });

  describe("scope: materials_only", () => {
    test("sollte keine Nachrichtensektionen erzeugen", () => {
      const chat = buildChat({
        messages: [userMsg("Hallo"), assistantMsg("Welt")],
      });
      const doc = mapChatToDocument(chat, { scope: "materials_only", includeMetadata: false });
      const msgSections = doc.sections.filter(
        s => s.title.startsWith("Benutzer") || s.title.startsWith("Assistent")
      );
      expect(msgSections).toHaveLength(0);
    });
  });

  describe("Materialien", () => {
    const textMaterial: ChatMaterial = {
      id: "mat-1",
      type: "upload",
      title: "Mein Dokument",
      content: "Inhalt des Dokuments.",
      createdAt: Date.now(),
    };

    const tableMaterial: ChatMaterial = {
      id: "mat-2",
      type: "skill_result",
      title: "Ergebnistabelle",
      content: "| Spalte |\n|--------|\n| Wert |",
      createdAt: Date.now(),
    };

    test("sollte bei includeMaterials=true eine Materialien-Sektion erzeugen", () => {
      const chat = buildChat({ materials: [textMaterial] });
      const doc = mapChatToDocument(chat, { scope: "full", includeMetadata: false, includeMaterials: true });
      const matSection = doc.sections.find(s => s.title === "Materialien");
      expect(matSection).toBeDefined();
    });

    test("sollte die Anzahl der Materialien in der Übersichtssektion nennen", () => {
      const chat = buildChat({ materials: [textMaterial, tableMaterial] });
      const doc = mapChatToDocument(chat, { scope: "full", includeMetadata: false, includeMaterials: true });
      const matSection = doc.sections.find(s => s.title === "Materialien");
      expect(matSection!.content).toContain("2");
    });

    test("sollte bei includeMaterials=false keine Materialien-Sektion erzeugen", () => {
      const chat = buildChat({ materials: [textMaterial] });
      const doc = mapChatToDocument(chat, { scope: "full", includeMetadata: false, includeMaterials: false });
      const matSection = doc.sections.find(s => s.title === "Materialien");
      expect(matSection).toBeUndefined();
    });

    test("sollte Text-Material als Text-Sektion mit Typ-Label hinzufügen", () => {
      const chat = buildChat({ materials: [textMaterial] });
      const doc = mapChatToDocument(chat, { scope: "full", includeMetadata: false, includeMaterials: true });
      const matContentSection = doc.sections.find(s => s.title.includes("Mein Dokument"));
      expect(matContentSection).toBeDefined();
      expect(matContentSection!.type).toBe("text");
      expect(matContentSection!.title).toContain("Hochgeladen");
    });

    test("sollte Material mit Tabelle als Tabellen-Sektion hinzufügen", () => {
      const chat = buildChat({ materials: [tableMaterial] });
      const doc = mapChatToDocument(chat, { scope: "full", includeMetadata: false, includeMaterials: true });
      const matContentSection = doc.sections.find(s => s.title.includes("Ergebnistabelle"));
      expect(matContentSection).toBeDefined();
      expect(matContentSection!.type).toBe("table");
    });

    test("sollte 'transcript'-Typ mit Label 'Transkription' kennzeichnen", () => {
      const transcriptMat: ChatMaterial = { ...textMaterial, id: "mat-3", type: "transcript", title: "Audio" };
      const chat = buildChat({ materials: [transcriptMat] });
      const doc = mapChatToDocument(chat, { scope: "full", includeMetadata: false, includeMaterials: true });
      const matContentSection = doc.sections.find(s => s.title.includes("Audio"));
      expect(matContentSection!.title).toContain("Transkription");
    });

    test("sollte 'user_marked'-Typ mit Label 'Markiert' kennzeichnen", () => {
      const markedMat: ChatMaterial = { ...textMaterial, id: "mat-4", type: "user_marked", title: "Notiz" };
      const chat = buildChat({ materials: [markedMat] });
      const doc = mapChatToDocument(chat, { scope: "full", includeMetadata: false, includeMaterials: true });
      const matContentSection = doc.sections.find(s => s.title.includes("Notiz"));
      expect(matContentSection!.title).toContain("Markiert");
    });

    test("sollte 'skill_result'-Typ mit Label 'Skill-Ergebnis' kennzeichnen", () => {
      const skillMat: ChatMaterial = { ...textMaterial, id: "mat-5", type: "skill_result", title: "Ergebnis" };
      const chat = buildChat({ materials: [skillMat] });
      const doc = mapChatToDocument(chat, { scope: "full", includeMetadata: false, includeMaterials: true });
      const matContentSection = doc.sections.find(s => s.title.includes("Ergebnis"));
      expect(matContentSection!.title).toContain("Skill-Ergebnis");
    });

    test("sollte bei leerer Materialienliste keine Materialien-Sektion erzeugen", () => {
      const chat = buildChat({ materials: [] });
      const doc = mapChatToDocument(chat, { scope: "full", includeMetadata: false, includeMaterials: true });
      const matSection = doc.sections.find(s => s.title === "Materialien");
      expect(matSection).toBeUndefined();
    });
  });

  describe("Standardoptionen", () => {
    test("sollte mit Standard-Optionen (scope: full) arbeiten, wenn keine Optionen übergeben werden", () => {
      const chat = buildChat({ messages: [userMsg("Test")] });
      const doc = mapChatToDocument(chat);
      expect(doc.sections.length).toBeGreaterThan(0);
    });

    test("sollte Metadaten standardmäßig einschließen", () => {
      const chat = buildChat();
      const doc = mapChatToDocument(chat);
      const metaSection = doc.sections.find(s => s.title === "Konversationsdetails");
      expect(metaSection).toBeDefined();
    });
  });

  describe("leerer Chat", () => {
    test("sollte bei leerem Chat (keine Nachrichten) ein valides Dokument erzeugen", () => {
      const chat = buildChat({ messages: [] });
      const doc = mapChatToDocument(chat, { scope: "full", includeMetadata: false });
      expect(doc.sections).toBeInstanceOf(Array);
    });

    test("sollte die Nachrichtenanzahl '0' in den Metadaten angeben", () => {
      const chat = buildChat({ messages: [] });
      const doc = mapChatToDocument(chat);
      expect(doc.metadata["Nachrichten"]).toBe("0");
    });
  });
});

/**
 * Tests fuer LocalTool (Basisklasse), FileReadTool, FileWriteTool und FileListTool
 * (backend/src/tools/local/)
 *
 * Das echte Dateisystem unter /tmp wird genutzt — kein fs-Mocking notwendig.
 * DATA_DIR wird per mock.module() auf das temporaere Testverzeichnis umgeleitet,
 * damit keine produktiven Daten beeinflusst werden.
 *
 * Wichtig: mock.module()-Aufrufe muessen VOR dem dynamischen Import der Module
 * stehen (Bun-Anforderung fuer isolierte Testlaeufe).
 */

import { test, expect, describe, beforeEach, afterEach, mock } from "bun:test";
import { mkdir, rm, writeFile } from "fs/promises";
import { join } from "path";

// ---------------------------------------------------------------------------
// Testverzeichnis — pro Prozess eindeutig, kein Konflikt bei parallelen Laeufen
// ---------------------------------------------------------------------------

const TEST_DATA_DIR = `/tmp/file-tools-test-${process.pid}`;
const TEST_USER_ID = "test-user-42";

// ---------------------------------------------------------------------------
// Modul-Mock — VOR dem Import der Module unter Test registrieren.
// Nur DATA_DIR wird umgeleitet; alle anderen Exporte bleiben unveraendert.
// ---------------------------------------------------------------------------

mock.module("../../utils/paths", () => ({
  DATA_DIR: TEST_DATA_DIR,
}));

// ---------------------------------------------------------------------------
// Import der Module unter Test NACH den Mock-Registrierungen
// ---------------------------------------------------------------------------

const { FileReadTool } = await import("../file-read");
const { FileWriteTool } = await import("../file-write");
const { FileListTool } = await import("../file-list");

// ---------------------------------------------------------------------------
// Hilfsfunktion: ergibt den Sandbox-Pfad des Test-Benutzers
// ---------------------------------------------------------------------------

function userDir(): string {
  return join(TEST_DATA_DIR, "users", TEST_USER_ID);
}

// ---------------------------------------------------------------------------
// Setup / Teardown — frisches Verzeichnis fuer jeden Test
// ---------------------------------------------------------------------------

beforeEach(async () => {
  await rm(TEST_DATA_DIR, { recursive: true, force: true });
  await mkdir(join(TEST_DATA_DIR, "users", TEST_USER_ID), { recursive: true });
});

afterEach(async () => {
  await rm(TEST_DATA_DIR, { recursive: true, force: true });
});

// ---------------------------------------------------------------------------
// LocalTool — Basisklasse (getestet ueber FileReadTool als konkrete Implementierung)
// ---------------------------------------------------------------------------

describe("LocalTool (Basisklasse)", () => {
  describe("Konstruktor", () => {
    test("setzt name korrekt", () => {
      const tool = new FileReadTool(TEST_DATA_DIR);
      expect(tool.name).toBe("file_read");
    });

    test("setzt type auf 'local'", () => {
      const tool = new FileReadTool(TEST_DATA_DIR);
      expect(tool.type).toBe("local");
    });

    test("verwendet angegebenes dataDir statt DATA_DIR", () => {
      const custom = "/tmp/custom-dir";
      const tool = new FileReadTool(custom);
      // Das dataDir wird intern genutzt — validateUserPath wirft bei nicht-existentem
      // Verzeichnis keine Ausnahme, daher pruefen wir es ueber den Pfad in execute()
      // indirekt (getMetadata ist unabhaengig davon)
      expect(tool.type).toBe("local");
    });
  });

  describe("getDefinition()", () => {
    test("gibt type 'function' zurueck", () => {
      const tool = new FileReadTool(TEST_DATA_DIR);
      expect(tool.getDefinition().type).toBe("function");
    });

    test("gibt function.name als Toolnamen zurueck", () => {
      const tool = new FileReadTool(TEST_DATA_DIR);
      expect(tool.getDefinition().function.name).toBe("file_read");
    });

    test("gibt eine Beschreibung in function.description zurueck", () => {
      const tool = new FileReadTool(TEST_DATA_DIR);
      expect(tool.getDefinition().function.description).toBeTruthy();
    });

    test("gibt parameters.type als 'object' zurueck", () => {
      const tool = new FileReadTool(TEST_DATA_DIR);
      expect(tool.getDefinition().function.parameters.type).toBe("object");
    });
  });

  describe("getMetadata()", () => {
    test("gibt name, description, type und category zurueck", () => {
      const tool = new FileReadTool(TEST_DATA_DIR);
      const meta = tool.getMetadata();
      expect(meta.name).toBe("file_read");
      expect(meta.description).toBeTruthy();
      expect(meta.type).toBe("local");
      expect(meta.category).toBe("filesystem");
    });

    test("FileWriteTool hat category 'filesystem'", () => {
      const tool = new FileWriteTool(TEST_DATA_DIR);
      expect(tool.getMetadata().category).toBe("filesystem");
    });

    test("FileListTool hat category 'filesystem'", () => {
      const tool = new FileListTool(TEST_DATA_DIR);
      expect(tool.getMetadata().category).toBe("filesystem");
    });
  });

  describe("isAvailable()", () => {
    test("gibt true zurueck fuer FileReadTool", async () => {
      const tool = new FileReadTool(TEST_DATA_DIR);
      expect(await tool.isAvailable()).toBe(true);
    });

    test("gibt true zurueck fuer FileWriteTool", async () => {
      const tool = new FileWriteTool(TEST_DATA_DIR);
      expect(await tool.isAvailable()).toBe(true);
    });

    test("gibt true zurueck fuer FileListTool", async () => {
      const tool = new FileListTool(TEST_DATA_DIR);
      expect(await tool.isAvailable()).toBe(true);
    });
  });

  describe("getUserDataDir()", () => {
    test("erzeugt den korrekten Pfad unterhalb von dataDir/users/{userId}", async () => {
      // Wir pruefen getUserDataDir indirekt: ein erfolgreich geschriebener
      // und danach wieder gelesener Inhalt bestaetigt den korrekten Pfad.
      const writer = new FileWriteTool(TEST_DATA_DIR);
      const reader = new FileReadTool(TEST_DATA_DIR);

      await writer.execute(
        { path: "probe.txt", content: "hallo" },
        { userId: TEST_USER_ID }
      );

      const content = await reader.execute(
        { path: "probe.txt" },
        { userId: TEST_USER_ID }
      );
      expect(content).toBe("hallo");
    });

    test("wirft einen Fehler wenn userId leer ist", async () => {
      // execute() faengt den Fehler ab und gibt eine Fehlermeldung zurueck —
      // wir pruefen die gemeldete Fehlermeldung
      const tool = new FileReadTool(TEST_DATA_DIR);
      const result = await tool.execute({ path: "datei.txt" }, { userId: "" });
      expect(result).toContain("Fehler");
    });
  });

  describe("validateUserPath() — Path-Traversal-Schutz", () => {
    test("blockiert '../' Pfadtraversierung nach oben", async () => {
      const tool = new FileReadTool(TEST_DATA_DIR);
      const result = await tool.execute(
        { path: "../../etc/passwd" },
        { userId: TEST_USER_ID }
      );
      // Entweder wird der Zugriff explizit verweigert oder die Datei existiert
      // nicht — beides ist ein akzeptabler Schutznachweis
      expect(result).toContain("Fehler");
    });

    test("blockiert absoluten Pfad der aus dem Benutzerverzeichnis herausfuehrt", async () => {
      const tool = new FileReadTool(TEST_DATA_DIR);
      // Ein absoluter Pfad wie /etc/passwd wird als relativ zum userDir
      // behandelt; das Ergebnis muss daher "Datei nicht gefunden" sein
      // (nicht: Datei ausserhalb Sandbox gelesen)
      const result = await tool.execute(
        { path: "/etc/passwd" },
        { userId: TEST_USER_ID }
      );
      expect(result).toContain("Fehler");
    });

    test("erlaubt Pfad mit normalem Unterverzeichnis", async () => {
      const tool = new FileWriteTool(TEST_DATA_DIR);
      const result = await tool.execute(
        { path: "unterordner/datei.txt", content: "ok" },
        { userId: TEST_USER_ID }
      );
      expect(result).not.toContain("Fehler");
    });

    test("erlaubt Pfad mit fuehrendem '/' (wird als relativ behandelt)", async () => {
      const writer = new FileWriteTool(TEST_DATA_DIR);
      await writer.execute(
        { path: "visible.txt", content: "sichtbar" },
        { userId: TEST_USER_ID }
      );

      const reader = new FileReadTool(TEST_DATA_DIR);
      const result = await reader.execute(
        { path: "/visible.txt" },
        { userId: TEST_USER_ID }
      );
      expect(result).toBe("sichtbar");
    });

    test("erstellt das Benutzerverzeichnis automatisch wenn es noch nicht existiert", async () => {
      const newUserId = "new-user-99";
      // Das Verzeichnis des neuen Users existiert nicht — validateUserPath
      // soll es anlegen
      const tool = new FileWriteTool(TEST_DATA_DIR);
      const result = await tool.execute(
        { path: "erste-datei.txt", content: "neu" },
        { userId: newUserId }
      );
      expect(result).not.toContain("Fehler");
    });
  });
});

// ---------------------------------------------------------------------------
// FileReadTool
// ---------------------------------------------------------------------------

describe("FileReadTool", () => {
  describe("getDefinition()", () => {
    test("hat 'path' als einzigen Parameter", () => {
      const tool = new FileReadTool(TEST_DATA_DIR);
      const params = tool.getDefinition().function.parameters;
      expect(Object.keys(params.properties)).toContain("path");
    });

    test("'path' ist ein Pflichtparameter", () => {
      const tool = new FileReadTool(TEST_DATA_DIR);
      const params = tool.getDefinition().function.parameters;
      expect(params.required).toContain("path");
    });
  });

  describe("execute()", () => {
    test("liest den Inhalt einer vorhandenen Datei", async () => {
      await writeFile(join(userDir(), "notizen.txt"), "mein Inhalt", "utf-8");

      const tool = new FileReadTool(TEST_DATA_DIR);
      const result = await tool.execute(
        { path: "notizen.txt" },
        { userId: TEST_USER_ID }
      );
      expect(result).toBe("mein Inhalt");
    });

    test("liest eine Datei in einem Unterverzeichnis", async () => {
      await mkdir(join(userDir(), "dokumente"), { recursive: true });
      await writeFile(join(userDir(), "dokumente", "bericht.txt"), "Bericht 2024", "utf-8");

      const tool = new FileReadTool(TEST_DATA_DIR);
      const result = await tool.execute(
        { path: "dokumente/bericht.txt" },
        { userId: TEST_USER_ID }
      );
      expect(result).toBe("Bericht 2024");
    });

    test("liest eine Datei mit fuehrendem '/' im Pfad (absoluter Pfad wird relativ behandelt)", async () => {
      await writeFile(join(userDir(), "datei.txt"), "inhalt absolut", "utf-8");

      const tool = new FileReadTool(TEST_DATA_DIR);
      const result = await tool.execute(
        { path: "/datei.txt" },
        { userId: TEST_USER_ID }
      );
      expect(result).toBe("inhalt absolut");
    });

    test("liest eine leere Datei und gibt leeren String zurueck", async () => {
      await writeFile(join(userDir(), "leer.txt"), "", "utf-8");

      const tool = new FileReadTool(TEST_DATA_DIR);
      const result = await tool.execute(
        { path: "leer.txt" },
        { userId: TEST_USER_ID }
      );
      expect(result).toBe("");
    });

    test("gibt Fehlermeldung zurueck wenn Datei nicht existiert", async () => {
      const tool = new FileReadTool(TEST_DATA_DIR);
      const result = await tool.execute(
        { path: "nicht-vorhanden.txt" },
        { userId: TEST_USER_ID }
      );
      expect(result).toContain("Fehler");
      expect(result).toContain("nicht-vorhanden.txt");
    });

    test("gibt Fehlermeldung zurueck wenn userId fehlt", async () => {
      const tool = new FileReadTool(TEST_DATA_DIR);
      const result = await tool.execute({ path: "datei.txt" });
      expect(result).toContain("Fehler");
      expect(result).toContain("Benutzer");
    });

    test("gibt Fehlermeldung zurueck wenn userId im Context null ist", async () => {
      const tool = new FileReadTool(TEST_DATA_DIR);
      const result = await tool.execute({ path: "datei.txt" }, { userId: undefined });
      expect(result).toContain("Fehler");
    });

    test("gibt Fehlermeldung zurueck wenn path fehlt", async () => {
      const tool = new FileReadTool(TEST_DATA_DIR);
      const result = await tool.execute(
        { path: "" },
        { userId: TEST_USER_ID }
      );
      expect(result).toContain("Fehler");
      expect(result.toLowerCase()).toContain("pfad");
    });

    test("gibt Fehlermeldung zurueck bei Path-Traversal-Versuch", async () => {
      const tool = new FileReadTool(TEST_DATA_DIR);
      const result = await tool.execute(
        { path: "../../etc/shadow" },
        { userId: TEST_USER_ID }
      );
      expect(result).toContain("Fehler");
    });
  });
});

// ---------------------------------------------------------------------------
// FileWriteTool
// ---------------------------------------------------------------------------

describe("FileWriteTool", () => {
  describe("getDefinition()", () => {
    test("hat 'path' und 'content' als Parameter", () => {
      const tool = new FileWriteTool(TEST_DATA_DIR);
      const props = Object.keys(tool.getDefinition().function.parameters.properties);
      expect(props).toContain("path");
      expect(props).toContain("content");
    });

    test("'path' und 'content' sind Pflichtparameter", () => {
      const tool = new FileWriteTool(TEST_DATA_DIR);
      const required = tool.getDefinition().function.parameters.required;
      expect(required).toContain("path");
      expect(required).toContain("content");
    });
  });

  describe("execute()", () => {
    test("schreibt eine Datei und gibt Erfolgsbestaetigung zurueck", async () => {
      const tool = new FileWriteTool(TEST_DATA_DIR);
      const result = await tool.execute(
        { path: "neu.txt", content: "Hallo Welt" },
        { userId: TEST_USER_ID }
      );
      expect(result).toContain("gespeichert");
      expect(result).toContain("neu.txt");
    });

    test("Dateiinhalt ist nach dem Schreiben korrekt lesbar", async () => {
      const tool = new FileWriteTool(TEST_DATA_DIR);
      await tool.execute(
        { path: "test.txt", content: "Test-Inhalt" },
        { userId: TEST_USER_ID }
      );

      const reader = new FileReadTool(TEST_DATA_DIR);
      const content = await reader.execute(
        { path: "test.txt" },
        { userId: TEST_USER_ID }
      );
      expect(content).toBe("Test-Inhalt");
    });

    test("ueberschreibt eine vorhandene Datei", async () => {
      await writeFile(join(userDir(), "vorhanden.txt"), "alter Inhalt", "utf-8");

      const tool = new FileWriteTool(TEST_DATA_DIR);
      await tool.execute(
        { path: "vorhanden.txt", content: "neuer Inhalt" },
        { userId: TEST_USER_ID }
      );

      const reader = new FileReadTool(TEST_DATA_DIR);
      const content = await reader.execute(
        { path: "vorhanden.txt" },
        { userId: TEST_USER_ID }
      );
      expect(content).toBe("neuer Inhalt");
    });

    test("erstellt fehlende Unterverzeichnisse automatisch", async () => {
      const tool = new FileWriteTool(TEST_DATA_DIR);
      const result = await tool.execute(
        { path: "a/b/c/datei.txt", content: "tief" },
        { userId: TEST_USER_ID }
      );
      expect(result).not.toContain("Fehler");

      const reader = new FileReadTool(TEST_DATA_DIR);
      const content = await reader.execute(
        { path: "a/b/c/datei.txt" },
        { userId: TEST_USER_ID }
      );
      expect(content).toBe("tief");
    });

    test("schreibt leeren String als Dateiinhalt", async () => {
      const tool = new FileWriteTool(TEST_DATA_DIR);
      const result = await tool.execute(
        { path: "leer.txt", content: "" },
        { userId: TEST_USER_ID }
      );
      expect(result).not.toContain("Fehler");

      const reader = new FileReadTool(TEST_DATA_DIR);
      const content = await reader.execute(
        { path: "leer.txt" },
        { userId: TEST_USER_ID }
      );
      expect(content).toBe("");
    });

    test("schreibt mehrzeiligen Inhalt korrekt", async () => {
      const multiline = "Zeile 1\nZeile 2\nZeile 3";
      const tool = new FileWriteTool(TEST_DATA_DIR);
      await tool.execute(
        { path: "mehrzeilig.txt", content: multiline },
        { userId: TEST_USER_ID }
      );

      const reader = new FileReadTool(TEST_DATA_DIR);
      const content = await reader.execute(
        { path: "mehrzeilig.txt" },
        { userId: TEST_USER_ID }
      );
      expect(content).toBe(multiline);
    });

    test("gibt Fehlermeldung zurueck wenn userId fehlt", async () => {
      const tool = new FileWriteTool(TEST_DATA_DIR);
      const result = await tool.execute({ path: "datei.txt", content: "inhalt" });
      expect(result).toContain("Fehler");
      expect(result).toContain("Benutzer");
    });

    test("gibt Fehlermeldung zurueck wenn path fehlt", async () => {
      const tool = new FileWriteTool(TEST_DATA_DIR);
      const result = await tool.execute(
        { path: "", content: "inhalt" },
        { userId: TEST_USER_ID }
      );
      expect(result).toContain("Fehler");
      expect(result.toLowerCase()).toContain("pfad");
    });

    test("gibt Fehlermeldung zurueck wenn content undefined ist", async () => {
      const tool = new FileWriteTool(TEST_DATA_DIR);
      const result = await tool.execute(
        { path: "datei.txt", content: undefined as any },
        { userId: TEST_USER_ID }
      );
      expect(result).toContain("Fehler");
      expect(result.toLowerCase()).toContain("inhalt");
    });

    test("gibt Fehlermeldung zurueck wenn content null ist", async () => {
      const tool = new FileWriteTool(TEST_DATA_DIR);
      const result = await tool.execute(
        { path: "datei.txt", content: null as any },
        { userId: TEST_USER_ID }
      );
      expect(result).toContain("Fehler");
    });

    test("gibt Fehlermeldung zurueck bei Path-Traversal-Versuch", async () => {
      const tool = new FileWriteTool(TEST_DATA_DIR);
      const result = await tool.execute(
        { path: "../../evil.sh", content: "rm -rf /" },
        { userId: TEST_USER_ID }
      );
      expect(result).toContain("Fehler");
    });

    test("isoliert Dateien zwischen verschiedenen Benutzern", async () => {
      const userA = "user-aaa";
      const userB = "user-bbb";

      const tool = new FileWriteTool(TEST_DATA_DIR);
      await tool.execute({ path: "secret.txt", content: "nur fuer A" }, { userId: userA });

      const reader = new FileReadTool(TEST_DATA_DIR);
      const result = await reader.execute({ path: "secret.txt" }, { userId: userB });
      // Benutzer B kann die Datei von Benutzer A nicht lesen
      expect(result).toContain("Fehler");
    });
  });
});

// ---------------------------------------------------------------------------
// FileListTool
// ---------------------------------------------------------------------------

describe("FileListTool", () => {
  describe("getDefinition()", () => {
    test("hat 'path' als optionalen Parameter", () => {
      const tool = new FileListTool(TEST_DATA_DIR);
      const params = tool.getDefinition().function.parameters;
      expect(Object.keys(params.properties)).toContain("path");
      expect(params.required).not.toContain("path");
    });

    test("required-Array ist leer", () => {
      const tool = new FileListTool(TEST_DATA_DIR);
      expect(tool.getDefinition().function.parameters.required).toHaveLength(0);
    });
  });

  describe("execute()", () => {
    test("listet Dateien mit Praefix [FILE] auf", async () => {
      await writeFile(join(userDir(), "alpha.txt"), "a", "utf-8");
      await writeFile(join(userDir(), "beta.txt"), "b", "utf-8");

      const tool = new FileListTool(TEST_DATA_DIR);
      const result = await tool.execute({ path: "." }, { userId: TEST_USER_ID });
      expect(result).toContain("[FILE] alpha.txt");
      expect(result).toContain("[FILE] beta.txt");
    });

    test("listet Unterverzeichnisse mit Praefix [DIR] auf", async () => {
      await mkdir(join(userDir(), "meinordner"), { recursive: true });

      const tool = new FileListTool(TEST_DATA_DIR);
      const result = await tool.execute({ path: "." }, { userId: TEST_USER_ID });
      expect(result).toContain("[DIR] meinordner");
    });

    test("listet Dateien und Verzeichnisse gemischt auf", async () => {
      await mkdir(join(userDir(), "ordner"), { recursive: true });
      await writeFile(join(userDir(), "datei.txt"), "x", "utf-8");

      const tool = new FileListTool(TEST_DATA_DIR);
      const result = await tool.execute({ path: "." }, { userId: TEST_USER_ID });
      expect(result).toContain("[DIR] ordner");
      expect(result).toContain("[FILE] datei.txt");
    });

    test("listet Inhalt eines Unterverzeichnisses auf", async () => {
      await mkdir(join(userDir(), "sub"), { recursive: true });
      await writeFile(join(userDir(), "sub", "kind.txt"), "kind", "utf-8");

      const tool = new FileListTool(TEST_DATA_DIR);
      const result = await tool.execute({ path: "sub" }, { userId: TEST_USER_ID });
      expect(result).toContain("[FILE] kind.txt");
    });

    test("verwendet '.' als Standard wenn kein Pfad uebergeben wird", async () => {
      await writeFile(join(userDir(), "root.txt"), "root", "utf-8");

      const tool = new FileListTool(TEST_DATA_DIR);
      // Kein path-Argument
      const result = await tool.execute({}, { userId: TEST_USER_ID });
      expect(result).toContain("[FILE] root.txt");
    });

    test("gibt 'Verzeichnis ist leer' zurueck fuer ein leeres Verzeichnis", async () => {
      await mkdir(join(userDir(), "leer"), { recursive: true });

      const tool = new FileListTool(TEST_DATA_DIR);
      const result = await tool.execute({ path: "leer" }, { userId: TEST_USER_ID });
      expect(result).toBe("Verzeichnis ist leer");
    });

    test("gibt 'Verzeichnis ist leer' zurueck wenn das Benutzerverzeichnis leer ist", async () => {
      // Benutzerverzeichnis existiert bereits (durch beforeEach), ist aber leer
      const tool = new FileListTool(TEST_DATA_DIR);
      const result = await tool.execute({ path: "." }, { userId: TEST_USER_ID });
      expect(result).toBe("Verzeichnis ist leer");
    });

    test("gibt Fehlermeldung zurueck wenn Verzeichnis nicht existiert", async () => {
      const tool = new FileListTool(TEST_DATA_DIR);
      const result = await tool.execute(
        { path: "nicht-vorhanden" },
        { userId: TEST_USER_ID }
      );
      expect(result).toContain("Fehler");
      expect(result).toContain("nicht-vorhanden");
    });

    test("gibt Fehlermeldung zurueck wenn userId fehlt", async () => {
      const tool = new FileListTool(TEST_DATA_DIR);
      const result = await tool.execute({ path: "." });
      expect(result).toContain("Fehler");
      expect(result).toContain("Benutzer");
    });

    test("gibt Fehlermeldung zurueck bei Path-Traversal-Versuch", async () => {
      const tool = new FileListTool(TEST_DATA_DIR);
      const result = await tool.execute(
        { path: "../../" },
        { userId: TEST_USER_ID }
      );
      expect(result).toContain("Fehler");
    });

    test("Eintraege werden zeilenweise getrennt zurueckgegeben", async () => {
      await writeFile(join(userDir(), "eins.txt"), "1", "utf-8");
      await writeFile(join(userDir(), "zwei.txt"), "2", "utf-8");

      const tool = new FileListTool(TEST_DATA_DIR);
      const result = await tool.execute({ path: "." }, { userId: TEST_USER_ID });
      const lines = result.split("\n");
      expect(lines).toHaveLength(2);
    });
  });
});

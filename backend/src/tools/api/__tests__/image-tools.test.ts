/**
 * Tests fuer ImageGenerationTool und ImageEditTool
 * (backend/src/tools/api/image-generation.ts und backend/src/tools/api/image-edit.ts)
 *
 * Alle externen Abhaengigkeiten (imageGenerationService, saveGeneratedImage,
 * attachmentsService, Bun.file) werden per mock.module() bzw. direktem
 * Property-Ersatz abgefangen, damit kein Test echte Dateisystemzugriffe oder
 * Netzwerkaufrufe durchfuehrt.
 *
 * Die Module werden nach dem Mock-Setup per dynamischem import() geladen,
 * damit die Mocks bei der Modul-Initialisierung bereits wirksam sind.
 *
 * WICHTIG: mock.module() darf nur einmal pro Modul-Pfad aufgerufen werden
 * (ausserhalb von test()-Bloecken), da spaetere Aufrufe den gecachten Import
 * permanent ersetzen und Folgetests korrumpieren koennen.
 */

import { test, expect, describe, beforeEach, afterEach } from "bun:test";
import { mock } from "bun:test";
import type { ToolContext } from "../../types";

// ---------------------------------------------------------------------------
// Gemeinsamer Mock-Zustand
// ---------------------------------------------------------------------------

/**
 * Zentrales Zustandsobjekt fuer alle Mocks.
 * Wird in beforeEach auf Standardwerte zurueckgesetzt.
 */
const mockState = {
  reloadCalled: 0,
  currentModel: { id: "test-model", name: "Test Model" } as any,
  supportsI2I: true,
  generateResult: {
    success: true,
    images: [
      {
        id: "img1",
        base64Data: "base64encodeddata",
        mimeType: "image/png",
        width: 512,
        height: 512,
        revisedPrompt: "A revised prompt",
      },
    ],
    provider: "test-provider",
    model: "test-model",
    durationMs: 1000,
    error: undefined as string | undefined,
  } as any,
  savedImage: { id: "img1", url: "/images/img1.png" } as any,
  attachment: null as any,
  fileArrayBuffer: new ArrayBuffer(8),
  generateArgs: null as any,
  saveArgs: null as any,
  /** Wenn true, wirft generate() eine Exception statt ein Ergebnis zu liefern */
  generateShouldThrow: false,
  generateThrowMessage: "Generierungsfehler",
  /** Buffer fuer getGeneratedImage-Mock (null = nicht gefunden) */
  generatedImageBuffer: null as Buffer | null,
  /** Metadata fuer getImageMetadata-Mock (null = nicht gefunden) */
  generatedImageMetadata: null as any,
};

// ---------------------------------------------------------------------------
// Mocks (muessen VOR dem ersten import() der zu testenden Module stehen)
// ---------------------------------------------------------------------------

mock.module("../../../services/imageGeneration", () => ({
  imageGenerationService: {
    reload: async () => {
      mockState.reloadCalled++;
    },
    getCurrentModel: () => mockState.currentModel,
    supportsImageToImage: () => mockState.supportsI2I,
    generate: async (args: any) => {
      if (mockState.generateShouldThrow) {
        throw new Error(mockState.generateThrowMessage);
      }
      mockState.generateArgs = args;
      return mockState.generateResult;
    },
  },
}));

mock.module("../../../services/imageStorage", () => ({
  saveGeneratedImage: async (args: any) => {
    mockState.saveArgs = args;
    return mockState.savedImage;
  },
  getGeneratedImage: async (id: string) => {
    if (mockState.generatedImageBuffer) return mockState.generatedImageBuffer;
    return null;
  },
  getImageMetadata: async (id: string) => {
    if (mockState.generatedImageMetadata) return mockState.generatedImageMetadata;
    return null;
  },
}));

mock.module("../../../services/attachments", () => ({
  attachmentsService: {
    getAttachment: async (_id: string, _sid: string) => mockState.attachment,
  },
}));

// ---------------------------------------------------------------------------
// Dynamischer Import der zu testenden Module (nach den Mocks)
// ---------------------------------------------------------------------------

const { ImageGenerationTool, createImageGenerationTool } = await import(
  "../image-generation"
);
const { ImageEditTool, createImageEditTool } = await import("../image-edit");

// ---------------------------------------------------------------------------
// Bun.file-Mock fuer ImageEditTool
// ---------------------------------------------------------------------------

let originalBunFile: typeof Bun.file;

// ===========================================================================
// Setup / Teardown
// ===========================================================================

beforeEach(() => {
  // Mock-Zustand zuruecksetzen
  mockState.reloadCalled = 0;
  mockState.currentModel = { id: "test-model", name: "Test Model" };
  mockState.supportsI2I = true;
  mockState.generateResult = {
    success: true,
    images: [
      {
        id: "img1",
        base64Data: "base64encodeddata",
        mimeType: "image/png",
        width: 512,
        height: 512,
        revisedPrompt: "A revised prompt",
      },
    ],
    provider: "test-provider",
    model: "test-model",
    durationMs: 1000,
    error: undefined,
  };
  mockState.savedImage = { id: "img1", url: "/images/img1.png" };
  mockState.attachment = null;
  mockState.fileArrayBuffer = new ArrayBuffer(8);
  mockState.generateArgs = null;
  mockState.saveArgs = null;
  mockState.generateShouldThrow = false;
  mockState.generateThrowMessage = "Generierungsfehler";
  mockState.generatedImageBuffer = null;
  mockState.generatedImageMetadata = null;

  // Bun.file sichern und durch Mock ersetzen
  originalBunFile = Bun.file;
  (Bun as any).file = (_path: string) => ({
    arrayBuffer: async () => mockState.fileArrayBuffer,
  });
});

afterEach(() => {
  // Bun.file wiederherstellen
  (Bun as any).file = originalBunFile;
});

// ===========================================================================
// ImageGenerationTool
// ===========================================================================

describe("ImageGenerationTool", () => {
  // -------------------------------------------------------------------------
  // Konstruktor
  // -------------------------------------------------------------------------

  describe("Konstruktor", () => {
    test("setzt name auf 'generate_image'", () => {
      const tool = new ImageGenerationTool();
      expect(tool.name).toBe("generate_image");
    });

    test("setzt type auf 'api'", () => {
      const tool = new ImageGenerationTool();
      expect(tool.type).toBe("api");
    });

    test("kann ohne Argumente erstellt werden", () => {
      expect(() => new ImageGenerationTool()).not.toThrow();
    });
  });

  // -------------------------------------------------------------------------
  // getDefinition()
  // -------------------------------------------------------------------------

  describe("getDefinition()", () => {
    test("gibt type 'function' zurueck", () => {
      const tool = new ImageGenerationTool();
      expect(tool.getDefinition().type).toBe("function");
    });

    test("gibt 'generate_image' als function.name zurueck", () => {
      const tool = new ImageGenerationTool();
      expect(tool.getDefinition().function.name).toBe("generate_image");
    });

    test("listet 'prompt' als Pflichtparameter", () => {
      const tool = new ImageGenerationTool();
      expect(tool.getDefinition().function.parameters.required).toContain("prompt");
    });

    test("listet 'aspect_ratio' als optionalen Parameter", () => {
      const tool = new ImageGenerationTool();
      const params = tool.getDefinition().function.parameters;
      expect(params.properties["aspect_ratio"]).toBeDefined();
      expect(params.required).not.toContain("aspect_ratio");
    });

    test("listet 'style' als optionalen Parameter", () => {
      const tool = new ImageGenerationTool();
      const params = tool.getDefinition().function.parameters;
      expect(params.properties["style"]).toBeDefined();
      expect(params.required).not.toContain("style");
    });

    test("enthalt eine sinnvolle Beschreibung", () => {
      const tool = new ImageGenerationTool();
      expect(tool.getDefinition().function.description.length).toBeGreaterThan(10);
    });

    test("gibt Parameterstruktur mit type 'object' zurueck", () => {
      const tool = new ImageGenerationTool();
      expect(tool.getDefinition().function.parameters.type).toBe("object");
    });

    test("parameter 'prompt' hat type 'string'", () => {
      const tool = new ImageGenerationTool();
      expect(tool.getDefinition().function.parameters.properties["prompt"]!.type).toBe("string");
    });
  });

  // -------------------------------------------------------------------------
  // getMetadata()
  // -------------------------------------------------------------------------

  describe("getMetadata()", () => {
    test("gibt name 'generate_image' zurueck", () => {
      const tool = new ImageGenerationTool();
      expect(tool.getMetadata().name).toBe("generate_image");
    });

    test("gibt type 'api' zurueck", () => {
      const tool = new ImageGenerationTool();
      expect(tool.getMetadata().type).toBe("api");
    });

    test("gibt category 'image' zurueck", () => {
      const tool = new ImageGenerationTool();
      expect(tool.getMetadata().category).toBe("image");
    });

    test("gibt eine Beschreibung zurueck", () => {
      const tool = new ImageGenerationTool();
      expect(tool.getMetadata().description).toBeTruthy();
    });
  });

  // -------------------------------------------------------------------------
  // isAvailable()
  // -------------------------------------------------------------------------

  describe("isAvailable()", () => {
    test("gibt true zurueck wenn getCurrentModel() ein Modell liefert", async () => {
      mockState.currentModel = { id: "test-model", name: "Test" };
      const tool = new ImageGenerationTool();
      expect(await tool.isAvailable()).toBe(true);
    });

    test("gibt false zurueck wenn getCurrentModel() null liefert", async () => {
      mockState.currentModel = null;
      const tool = new ImageGenerationTool();
      expect(await tool.isAvailable()).toBe(false);
    });

    test("ruft reload() vor der Pruefung auf", async () => {
      const tool = new ImageGenerationTool();
      mockState.reloadCalled = 0;
      await tool.isAvailable();
      expect(mockState.reloadCalled).toBeGreaterThanOrEqual(1);
    });
  });

  // -------------------------------------------------------------------------
  // execute() — Eingabe-Validierung
  // -------------------------------------------------------------------------

  describe("execute() — Eingabe-Validierung", () => {
    test("gibt Fehler zurueck wenn prompt leer ist", async () => {
      const tool = new ImageGenerationTool();
      const result = JSON.parse(await tool.execute({ prompt: "" }));
      expect(result.success).toBe(false);
      expect(result.error).toContain("Prompt");
    });

    test("gibt Fehler zurueck wenn prompt fehlt (undefined via cast)", async () => {
      const tool = new ImageGenerationTool();
      const result = JSON.parse(
        await tool.execute({ prompt: undefined as unknown as string })
      );
      expect(result.success).toBe(false);
    });

    test("gibt Fehler zurueck wenn kein Modell konfiguriert ist", async () => {
      mockState.currentModel = null;
      const tool = new ImageGenerationTool();
      const result = JSON.parse(
        await tool.execute({ prompt: "Ein schoenes Bild" })
      );
      expect(result.success).toBe(false);
      expect(result.error).toContain("model");
    });

    test("Fehler bei kein Modell enthaelt Konfigurationshinweis", async () => {
      mockState.currentModel = null;
      const tool = new ImageGenerationTool();
      const result = JSON.parse(
        await tool.execute({ prompt: "Test" })
      );
      expect(result.error.toLowerCase()).toContain("configured");
    });
  });

  // -------------------------------------------------------------------------
  // execute() — Reload-Verhalten
  // -------------------------------------------------------------------------

  describe("execute() — Reload-Verhalten", () => {
    test("ruft reload() beim Ausfuehren auf", async () => {
      const tool = new ImageGenerationTool();
      mockState.reloadCalled = 0;
      await tool.execute({ prompt: "Ein Testbild" });
      expect(mockState.reloadCalled).toBeGreaterThanOrEqual(1);
    });
  });

  // -------------------------------------------------------------------------
  // execute() — Prompt-Erweiterung
  // -------------------------------------------------------------------------

  describe("execute() — Prompt-Erweiterung", () => {
    test("uebergibt den Prompt unveraendert an generate() wenn kein style angegeben ist", async () => {
      const tool = new ImageGenerationTool();
      await tool.execute({ prompt: "Ein Baum im Herbst" });
      expect(mockState.generateArgs.prompt).toBe("Ein Baum im Herbst");
    });

    test("haengt style als Suffix an den Prompt an", async () => {
      const tool = new ImageGenerationTool();
      await tool.execute({ prompt: "Ein Baum im Herbst", style: "watercolor" });
      expect(mockState.generateArgs.prompt).toBe("Ein Baum im Herbst, watercolor style");
    });

    test("uebergibt aspect_ratio an generate()", async () => {
      const tool = new ImageGenerationTool();
      await tool.execute({ prompt: "Test", aspect_ratio: "16:9" });
      expect(mockState.generateArgs.aspectRatio).toBe("16:9");
    });

    test("verwendet '1:1' als Standard-Seitenverhaeltnis", async () => {
      const tool = new ImageGenerationTool();
      await tool.execute({ prompt: "Test" });
      expect(mockState.generateArgs.aspectRatio).toBe("1:1");
    });

    test("uebergibt numberOfImages: 1 an generate()", async () => {
      const tool = new ImageGenerationTool();
      await tool.execute({ prompt: "Test" });
      expect(mockState.generateArgs.numberOfImages).toBe(1);
    });
  });

  // -------------------------------------------------------------------------
  // execute() — Erfolgsfall
  // -------------------------------------------------------------------------

  describe("execute() — Erfolgsfall", () => {
    test("gibt type 'generated_image' im Ergebnis zurueck", async () => {
      const tool = new ImageGenerationTool();
      const result = JSON.parse(await tool.execute({ prompt: "Ein Testbild" }));
      expect(result.type).toBe("generated_image");
    });

    test("gibt imageId aus dem gespeicherten Bild zurueck", async () => {
      const tool = new ImageGenerationTool();
      const result = JSON.parse(await tool.execute({ prompt: "Ein Testbild" }));
      expect(result.imageId).toBe("img1");
    });

    test("gibt url aus dem gespeicherten Bild zurueck", async () => {
      const tool = new ImageGenerationTool();
      const result = JSON.parse(await tool.execute({ prompt: "Ein Testbild" }));
      expect(result.url).toBe("/images/img1.png");
    });

    test("gibt den verwendeten Prompt zurueck", async () => {
      const tool = new ImageGenerationTool();
      const result = JSON.parse(await tool.execute({ prompt: "Ein Testbild" }));
      expect(result.prompt).toBe("Ein Testbild");
    });

    test("gibt den mit style erweiterten Prompt zurueck", async () => {
      const tool = new ImageGenerationTool();
      const result = JSON.parse(
        await tool.execute({ prompt: "Ein Testbild", style: "oil painting" })
      );
      expect(result.prompt).toBe("Ein Testbild, oil painting style");
    });

    test("gibt aspectRatio korrekt zurueck", async () => {
      const tool = new ImageGenerationTool();
      const result = JSON.parse(
        await tool.execute({ prompt: "Test", aspect_ratio: "9:16" })
      );
      expect(result.aspectRatio).toBe("9:16");
    });

    test("gibt provider aus dem Generierungsergebnis zurueck", async () => {
      const tool = new ImageGenerationTool();
      const result = JSON.parse(await tool.execute({ prompt: "Test" }));
      expect(result.provider).toBe("test-provider");
    });

    test("gibt model aus dem Generierungsergebnis zurueck", async () => {
      const tool = new ImageGenerationTool();
      const result = JSON.parse(await tool.execute({ prompt: "Test" }));
      expect(result.model).toBe("test-model");
    });

    test("gibt durationMs aus dem Generierungsergebnis zurueck", async () => {
      const tool = new ImageGenerationTool();
      const result = JSON.parse(await tool.execute({ prompt: "Test" }));
      expect(result.durationMs).toBe(1000);
    });

    test("gibt revisedPrompt des Bildes zurueck", async () => {
      const tool = new ImageGenerationTool();
      const result = JSON.parse(await tool.execute({ prompt: "Test" }));
      expect(result.revisedPrompt).toBe("A revised prompt");
    });

    test("uebergibt sessionId aus dem Kontext an saveGeneratedImage()", async () => {
      const tool = new ImageGenerationTool();
      const ctx: ToolContext = { sessionId: "session-abc" };
      await tool.execute({ prompt: "Test" }, ctx);
      expect(mockState.saveArgs.sessionId).toBe("session-abc");
    });

    test("uebergibt undefined als sessionId wenn kein Kontext vorhanden ist", async () => {
      const tool = new ImageGenerationTool();
      await tool.execute({ prompt: "Test" });
      expect(mockState.saveArgs.sessionId).toBeUndefined();
    });

    test("uebergibt base64Data und mimeType an saveGeneratedImage()", async () => {
      const tool = new ImageGenerationTool();
      await tool.execute({ prompt: "Test" });
      expect(mockState.saveArgs.base64Data).toBe("base64encodeddata");
      expect(mockState.saveArgs.mimeType).toBe("image/png");
    });

    test("uebergibt width und height an saveGeneratedImage()", async () => {
      const tool = new ImageGenerationTool();
      await tool.execute({ prompt: "Test" });
      expect(mockState.saveArgs.width).toBe(512);
      expect(mockState.saveArgs.height).toBe(512);
    });

    test("uebergibt provider und model an saveGeneratedImage()", async () => {
      const tool = new ImageGenerationTool();
      await tool.execute({ prompt: "Test" });
      expect(mockState.saveArgs.provider).toBe("test-provider");
      expect(mockState.saveArgs.model).toBe("test-model");
    });
  });

  // -------------------------------------------------------------------------
  // execute() — Fehlerbehandlung bei Generierung
  // -------------------------------------------------------------------------

  describe("execute() — Fehlerbehandlung bei Generierung", () => {
    test("gibt Fehler zurueck wenn generate() success: false liefert", async () => {
      mockState.generateResult = {
        success: false,
        images: [],
        provider: "test-provider",
        model: "test-model",
        durationMs: 500,
        error: "Provider unavailable",
      };
      const tool = new ImageGenerationTool();
      const result = JSON.parse(await tool.execute({ prompt: "Test" }));
      expect(result.success).toBe(false);
      expect(result.error).toBe("Provider unavailable");
    });

    test("gibt Fehler zurueck wenn generate() leeres images-Array liefert", async () => {
      mockState.generateResult = {
        success: true,
        images: [],
        provider: "test-provider",
        model: "test-model",
        durationMs: 500,
        error: undefined,
      };
      const tool = new ImageGenerationTool();
      const result = JSON.parse(await tool.execute({ prompt: "Test" }));
      expect(result.success).toBe(false);
      expect(result.error).toContain("Failed to generate");
    });

    test("verwendet Fallback-Fehlertext wenn error-Feld fehlt und success false ist", async () => {
      mockState.generateResult = {
        success: false,
        images: [],
        provider: "test-provider",
        model: "test-model",
        durationMs: 0,
        error: undefined,
      };
      const tool = new ImageGenerationTool();
      const result = JSON.parse(await tool.execute({ prompt: "Test" }));
      expect(result.success).toBe(false);
      expect(result.error).toBeTruthy();
    });

    test("faengt Ausnahmen aus generate() ab und gibt Fehlermeldung zurueck", async () => {
      mockState.generateShouldThrow = true;
      mockState.generateThrowMessage = "Netzwerkfehler beim Generieren";
      const tool = new ImageGenerationTool();
      const result = JSON.parse(await tool.execute({ prompt: "Test" }));
      expect(result.success).toBe(false);
      expect(result.error).toContain("Netzwerkfehler beim Generieren");
    });

    test("gibt success: false im Fehlerobjekt zurueck (kein Typ-Feld)", async () => {
      mockState.generateShouldThrow = true;
      const tool = new ImageGenerationTool();
      const result = JSON.parse(await tool.execute({ prompt: "Test" }));
      expect(result.success).toBe(false);
      expect(result.type).toBeUndefined();
    });
  });

  // -------------------------------------------------------------------------
  // createImageGenerationTool() — Factory-Funktion
  // -------------------------------------------------------------------------

  describe("createImageGenerationTool()", () => {
    test("erstellt eine ImageGenerationTool-Instanz", () => {
      const tool = createImageGenerationTool();
      expect(tool).toBeInstanceOf(ImageGenerationTool);
    });

    test("gibt eine neue, unabhaengige Instanz bei jedem Aufruf zurueck", () => {
      const tool1 = createImageGenerationTool();
      const tool2 = createImageGenerationTool();
      expect(tool1).not.toBe(tool2);
    });

    test("erstellte Instanz hat name 'generate_image'", () => {
      const tool = createImageGenerationTool();
      expect(tool.name).toBe("generate_image");
    });

    test("erstellte Instanz hat type 'api'", () => {
      const tool = createImageGenerationTool();
      expect(tool.type).toBe("api");
    });

    test("erstellte Instanz ist verfuegbar wenn getCurrentModel() ein Modell liefert", async () => {
      mockState.currentModel = { id: "model-x", name: "Model X" };
      const tool = createImageGenerationTool();
      expect(await tool.isAvailable()).toBe(true);
    });

    test("erstellte Instanz ist nicht verfuegbar wenn getCurrentModel() null liefert", async () => {
      mockState.currentModel = null;
      const tool = createImageGenerationTool();
      expect(await tool.isAvailable()).toBe(false);
    });
  });
});

// ===========================================================================
// ImageEditTool
// ===========================================================================

describe("ImageEditTool", () => {
  // -------------------------------------------------------------------------
  // Konstruktor
  // -------------------------------------------------------------------------

  describe("Konstruktor", () => {
    test("setzt name auf 'edit_image'", () => {
      const tool = new ImageEditTool();
      expect(tool.name).toBe("edit_image");
    });

    test("setzt type auf 'api'", () => {
      const tool = new ImageEditTool();
      expect(tool.type).toBe("api");
    });

    test("kann ohne Argumente erstellt werden", () => {
      expect(() => new ImageEditTool()).not.toThrow();
    });
  });

  // -------------------------------------------------------------------------
  // getDefinition()
  // -------------------------------------------------------------------------

  describe("getDefinition()", () => {
    test("gibt type 'function' zurueck", () => {
      const tool = new ImageEditTool();
      expect(tool.getDefinition().type).toBe("function");
    });

    test("gibt 'edit_image' als function.name zurueck", () => {
      const tool = new ImageEditTool();
      expect(tool.getDefinition().function.name).toBe("edit_image");
    });

    test("listet 'prompt' als einzigen Pflichtparameter", () => {
      const tool = new ImageEditTool();
      expect(tool.getDefinition().function.parameters.required).toEqual(["prompt"]);
    });

    test("listet drei Parameter-Properties (attachment_id, image_id, prompt)", () => {
      const tool = new ImageEditTool();
      const params = tool.getDefinition().function.parameters;
      expect(Object.keys(params.properties)).toHaveLength(3);
      expect(params.properties).toHaveProperty("attachment_id");
      expect(params.properties).toHaveProperty("image_id");
      expect(params.properties).toHaveProperty("prompt");
    });

    test("enthalt eine sinnvolle Beschreibung", () => {
      const tool = new ImageEditTool();
      expect(tool.getDefinition().function.description.length).toBeGreaterThan(10);
    });

    test("gibt Parameterstruktur mit type 'object' zurueck", () => {
      const tool = new ImageEditTool();
      expect(tool.getDefinition().function.parameters.type).toBe("object");
    });
  });

  // -------------------------------------------------------------------------
  // getMetadata()
  // -------------------------------------------------------------------------

  describe("getMetadata()", () => {
    test("gibt name 'edit_image' zurueck", () => {
      const tool = new ImageEditTool();
      expect(tool.getMetadata().name).toBe("edit_image");
    });

    test("gibt type 'api' zurueck", () => {
      const tool = new ImageEditTool();
      expect(tool.getMetadata().type).toBe("api");
    });

    test("gibt category 'image' zurueck", () => {
      const tool = new ImageEditTool();
      expect(tool.getMetadata().category).toBe("image");
    });

    test("gibt eine Beschreibung zurueck", () => {
      const tool = new ImageEditTool();
      expect(tool.getMetadata().description).toBeTruthy();
    });
  });

  // -------------------------------------------------------------------------
  // isAvailable()
  // -------------------------------------------------------------------------

  describe("isAvailable()", () => {
    test("gibt true zurueck wenn supportsImageToImage() true liefert", async () => {
      mockState.supportsI2I = true;
      const tool = new ImageEditTool();
      expect(await tool.isAvailable()).toBe(true);
    });

    test("gibt false zurueck wenn supportsImageToImage() false liefert", async () => {
      mockState.supportsI2I = false;
      const tool = new ImageEditTool();
      expect(await tool.isAvailable()).toBe(false);
    });

    test("ruft reload() vor der Pruefung auf", async () => {
      const tool = new ImageEditTool();
      mockState.reloadCalled = 0;
      await tool.isAvailable();
      expect(mockState.reloadCalled).toBeGreaterThanOrEqual(1);
    });
  });

  // -------------------------------------------------------------------------
  // execute() — Eingabe-Validierung
  // -------------------------------------------------------------------------

  describe("execute() — Eingabe-Validierung", () => {
    test("gibt Fehler zurueck wenn attachment_id leer ist", async () => {
      const tool = new ImageEditTool();
      const result = JSON.parse(
        await tool.execute({ attachment_id: "", prompt: "Bearbeite das Bild" })
      );
      expect(result.success).toBe(false);
      expect(result.error).toContain("attachment_id");
    });

    test("gibt Fehler zurueck wenn prompt leer ist", async () => {
      const tool = new ImageEditTool();
      const result = JSON.parse(
        await tool.execute({ attachment_id: "att-123", prompt: "" })
      );
      expect(result.success).toBe(false);
      expect(result.error).toContain("prompt");
    });

    test("gibt Fehler zurueck wenn beide Args fehlen (undefined)", async () => {
      const tool = new ImageEditTool();
      const result = JSON.parse(
        await tool.execute({
          attachment_id: undefined as unknown as string,
          prompt: undefined as unknown as string,
        })
      );
      expect(result.success).toBe(false);
    });

    test("gibt Fehler zurueck wenn attachment_id fehlt und prompt vorhanden ist", async () => {
      const tool = new ImageEditTool();
      const result = JSON.parse(
        await tool.execute({
          attachment_id: undefined as unknown as string,
          prompt: "Mache es blau",
        })
      );
      expect(result.success).toBe(false);
    });

    test("Fehlermeldung bei fehlenden Args enthaelt 'required' Hinweis", async () => {
      const tool = new ImageEditTool();
      const result = JSON.parse(
        await tool.execute({ attachment_id: "", prompt: "" })
      );
      expect(result.error.toLowerCase()).toMatch(/required|attachment_id|prompt/);
    });
  });

  // -------------------------------------------------------------------------
  // execute() — Image-to-Image-Pruefung
  // -------------------------------------------------------------------------

  describe("execute() — Pruefung auf Image-to-Image-Unterstuetzung", () => {
    test("gibt Fehler zurueck wenn supportsImageToImage() false liefert", async () => {
      mockState.supportsI2I = false;
      const tool = new ImageEditTool();
      const result = JSON.parse(
        await tool.execute({ attachment_id: "att-1", prompt: "Aendere die Farbe" })
      );
      expect(result.success).toBe(false);
      expect(result.error.toLowerCase()).toContain("image-to-image");
    });

    test("ruft reload() auf bevor supportsImageToImage() geprueft wird", async () => {
      mockState.supportsI2I = false;
      const tool = new ImageEditTool();
      mockState.reloadCalled = 0;
      await tool.execute({ attachment_id: "att-1", prompt: "Test" });
      expect(mockState.reloadCalled).toBeGreaterThanOrEqual(1);
    });

    test("Fehlermeldung bei fehlendem i2i-Modell enthaelt Konfigurationshinweis", async () => {
      mockState.supportsI2I = false;
      const tool = new ImageEditTool();
      const result = JSON.parse(
        await tool.execute({ attachment_id: "att-1", prompt: "Test" })
      );
      expect(result.error.toLowerCase()).toMatch(/configured|settings/i);
    });
  });

  // -------------------------------------------------------------------------
  // execute() — Session-Kontext-Pruefung
  // -------------------------------------------------------------------------

  describe("execute() — Session-Kontext-Pruefung", () => {
    test("gibt Fehler zurueck wenn kein Kontext vorhanden ist", async () => {
      const tool = new ImageEditTool();
      const result = JSON.parse(
        await tool.execute({ attachment_id: "att-1", prompt: "Test" })
      );
      expect(result.success).toBe(false);
      expect(result.error.toLowerCase()).toContain("session");
    });

    test("gibt Fehler zurueck wenn Kontext sessionId und parentSessionId fehlen", async () => {
      const tool = new ImageEditTool();
      const result = JSON.parse(
        await tool.execute({ attachment_id: "att-1", prompt: "Test" }, {})
      );
      expect(result.success).toBe(false);
      expect(result.error.toLowerCase()).toContain("session");
    });

    test("verwendet parentSessionId wenn vorhanden", async () => {
      mockState.attachment = {
        id: "att-1",
        sessionId: "parent-session",
        filename: "test.png",
        mimeType: "image/png",
        type: "image",
        storagePath: "/tmp/test.png",
        metadata: { size: 1024, originalPath: "/tmp/test.png" },
      };
      const tool = new ImageEditTool();
      const ctx: ToolContext = {
        sessionId: "child-session",
        parentSessionId: "parent-session",
      };
      const result = JSON.parse(
        await tool.execute({ attachment_id: "att-1", prompt: "Test" }, ctx)
      );
      // parentSessionId wird bevorzugt — kein Session-Fehler, type ist gesetzt
      expect(result.type).toBe("generated_image");
    });

    test("verwendet sessionId als Fallback wenn parentSessionId fehlt", async () => {
      mockState.attachment = {
        id: "att-1",
        sessionId: "session-xyz",
        filename: "test.png",
        mimeType: "image/png",
        type: "image",
        storagePath: "/tmp/test.png",
        metadata: { size: 1024, originalPath: "/tmp/test.png" },
      };
      const tool = new ImageEditTool();
      const ctx: ToolContext = { sessionId: "session-xyz" };
      const result = JSON.parse(
        await tool.execute({ attachment_id: "att-1", prompt: "Test" }, ctx)
      );
      expect(result.type).toBe("generated_image");
    });
  });

  // -------------------------------------------------------------------------
  // execute() — Attachment-Suche und Validierung
  // -------------------------------------------------------------------------

  describe("execute() — Attachment-Suche und Validierung", () => {
    const sessionCtx: ToolContext = { sessionId: "sess-1" };

    test("gibt Fehler zurueck wenn Attachment nicht gefunden wird (null)", async () => {
      mockState.attachment = null;
      const tool = new ImageEditTool();
      const result = JSON.parse(
        await tool.execute({ attachment_id: "unknown-att", prompt: "Test" }, sessionCtx)
      );
      expect(result.success).toBe(false);
      expect(result.error).toContain("unknown-att");
    });

    test("gibt Fehler zurueck wenn Attachment ein nicht-Bild-MimeType hat", async () => {
      mockState.attachment = {
        id: "att-doc",
        sessionId: "sess-1",
        filename: "document.pdf",
        mimeType: "application/pdf",
        type: "document",
        storagePath: "/tmp/document.pdf",
        metadata: { size: 2048, originalPath: "/tmp/document.pdf" },
      };
      const tool = new ImageEditTool();
      const result = JSON.parse(
        await tool.execute({ attachment_id: "att-doc", prompt: "Test" }, sessionCtx)
      );
      expect(result.success).toBe(false);
      expect(result.error.toLowerCase()).toContain("not an image");
    });

    test("Fehlermeldung bei falschen MimeType enthaelt den tatsaechlichen MimeType", async () => {
      mockState.attachment = {
        id: "att-doc",
        sessionId: "sess-1",
        filename: "document.pdf",
        mimeType: "application/pdf",
        type: "document",
        storagePath: "/tmp/document.pdf",
        metadata: { size: 2048, originalPath: "/tmp/document.pdf" },
      };
      const tool = new ImageEditTool();
      const result = JSON.parse(
        await tool.execute({ attachment_id: "att-doc", prompt: "Test" }, sessionCtx)
      );
      expect(result.error).toContain("application/pdf");
    });

    test("gibt Fehler zurueck wenn Attachment Audio-MimeType hat", async () => {
      mockState.attachment = {
        id: "att-audio",
        sessionId: "sess-1",
        filename: "audio.mp3",
        mimeType: "audio/mpeg",
        type: "audio",
        storagePath: "/tmp/audio.mp3",
        metadata: { size: 4096, originalPath: "/tmp/audio.mp3" },
      };
      const tool = new ImageEditTool();
      const result = JSON.parse(
        await tool.execute({ attachment_id: "att-audio", prompt: "Test" }, sessionCtx)
      );
      expect(result.success).toBe(false);
    });

    test("gibt Fehler zurueck wenn metadata.originalPath leer ist", async () => {
      mockState.attachment = {
        id: "att-npath",
        sessionId: "sess-1",
        filename: "image.png",
        mimeType: "image/png",
        type: "image",
        storagePath: "/tmp/image.png",
        metadata: { size: 1024, originalPath: "" },
      };
      const tool = new ImageEditTool();
      const result = JSON.parse(
        await tool.execute({ attachment_id: "att-npath", prompt: "Test" }, sessionCtx)
      );
      expect(result.success).toBe(false);
      expect(result.error.toLowerCase()).toContain("file path");
    });

    test("gibt Fehler zurueck wenn metadata.originalPath undefined ist", async () => {
      mockState.attachment = {
        id: "att-nopath",
        sessionId: "sess-1",
        filename: "image.png",
        mimeType: "image/png",
        type: "image",
        storagePath: "/tmp/image.png",
        metadata: { size: 1024, originalPath: undefined as any },
      };
      const tool = new ImageEditTool();
      const result = JSON.parse(
        await tool.execute({ attachment_id: "att-nopath", prompt: "Test" }, sessionCtx)
      );
      expect(result.success).toBe(false);
    });
  });

  // -------------------------------------------------------------------------
  // execute() — Erfolgspfad
  // -------------------------------------------------------------------------

  describe("execute() — Erfolgspfad", () => {
    const validAttachment = {
      id: "att-img",
      sessionId: "sess-1",
      filename: "photo.png",
      mimeType: "image/png",
      type: "image" as const,
      storagePath: "/tmp/photo.png",
      metadata: { size: 8192, originalPath: "/tmp/photo.png" },
    };
    const sessionCtx: ToolContext = { sessionId: "sess-1" };

    beforeEach(() => {
      mockState.attachment = { ...validAttachment };
    });

    test("gibt type 'generated_image' im Ergebnis zurueck", async () => {
      const tool = new ImageEditTool();
      const result = JSON.parse(
        await tool.execute({ attachment_id: "att-img", prompt: "Mache es bunter" }, sessionCtx)
      );
      expect(result.type).toBe("generated_image");
    });

    test("gibt imageId aus dem gespeicherten Bild zurueck", async () => {
      const tool = new ImageEditTool();
      const result = JSON.parse(
        await tool.execute({ attachment_id: "att-img", prompt: "Test" }, sessionCtx)
      );
      expect(result.imageId).toBe("img1");
    });

    test("gibt url aus dem gespeicherten Bild zurueck", async () => {
      const tool = new ImageEditTool();
      const result = JSON.parse(
        await tool.execute({ attachment_id: "att-img", prompt: "Test" }, sessionCtx)
      );
      expect(result.url).toBe("/images/img1.png");
    });

    test("gibt den Prompt unveraendert zurueck", async () => {
      const tool = new ImageEditTool();
      const result = JSON.parse(
        await tool.execute(
          { attachment_id: "att-img", prompt: "Entferne den Hintergrund" },
          sessionCtx
        )
      );
      expect(result.prompt).toBe("Entferne den Hintergrund");
    });

    test("gibt sourceImage als Dateinamen des Attachments zurueck", async () => {
      const tool = new ImageEditTool();
      const result = JSON.parse(
        await tool.execute({ attachment_id: "att-img", prompt: "Test" }, sessionCtx)
      );
      expect(result.sourceImage).toBe("photo.png");
    });

    test("gibt provider aus dem Generierungsergebnis zurueck", async () => {
      const tool = new ImageEditTool();
      const result = JSON.parse(
        await tool.execute({ attachment_id: "att-img", prompt: "Test" }, sessionCtx)
      );
      expect(result.provider).toBe("test-provider");
    });

    test("gibt model aus dem Generierungsergebnis zurueck", async () => {
      const tool = new ImageEditTool();
      const result = JSON.parse(
        await tool.execute({ attachment_id: "att-img", prompt: "Test" }, sessionCtx)
      );
      expect(result.model).toBe("test-model");
    });

    test("gibt durationMs aus dem Generierungsergebnis zurueck", async () => {
      const tool = new ImageEditTool();
      const result = JSON.parse(
        await tool.execute({ attachment_id: "att-img", prompt: "Test" }, sessionCtx)
      );
      expect(result.durationMs).toBe(1000);
    });

    test("gibt revisedPrompt des bearbeiteten Bildes zurueck", async () => {
      const tool = new ImageEditTool();
      const result = JSON.parse(
        await tool.execute({ attachment_id: "att-img", prompt: "Test" }, sessionCtx)
      );
      expect(result.revisedPrompt).toBe("A revised prompt");
    });

    test("uebergibt sourceImage mit base64 und mimeType an generate()", async () => {
      const tool = new ImageEditTool();
      await tool.execute({ attachment_id: "att-img", prompt: "Test" }, sessionCtx);
      expect(mockState.generateArgs.sourceImage).toBeDefined();
      expect(mockState.generateArgs.sourceImage.mimeType).toBe("image/png");
      expect(typeof mockState.generateArgs.sourceImage.base64).toBe("string");
    });

    test("uebergibt den Prompt an generate()", async () => {
      const tool = new ImageEditTool();
      await tool.execute(
        { attachment_id: "att-img", prompt: "Mache den Himmel lila" },
        sessionCtx
      );
      expect(mockState.generateArgs.prompt).toBe("Mache den Himmel lila");
    });

    test("speichert Bild mit Prompt-Prefix 'Edit:'", async () => {
      const tool = new ImageEditTool();
      await tool.execute(
        { attachment_id: "att-img", prompt: "Bearbeitung XY" },
        sessionCtx
      );
      expect(mockState.saveArgs.prompt).toContain("Edit:");
      expect(mockState.saveArgs.prompt).toContain("Bearbeitung XY");
    });

    test("speichert Bild mit dem Dateinamen des Quell-Attachments", async () => {
      const tool = new ImageEditTool();
      await tool.execute({ attachment_id: "att-img", prompt: "Test" }, sessionCtx);
      expect(mockState.saveArgs.prompt).toContain("photo.png");
    });

    test("uebergibt sessionId aus dem Kontext an saveGeneratedImage()", async () => {
      const tool = new ImageEditTool();
      const ctx: ToolContext = { sessionId: "speziell-session" };
      mockState.attachment = {
        ...validAttachment,
        sessionId: "speziell-session",
      };
      await tool.execute({ attachment_id: "att-img", prompt: "Test" }, ctx);
      expect(mockState.saveArgs.sessionId).toBe("speziell-session");
    });

    test("verwendet Bun.file mit dem originalPath des Attachments", async () => {
      const filePaths: string[] = [];
      (Bun as any).file = (path: string) => {
        filePaths.push(path);
        return {
          arrayBuffer: async () => mockState.fileArrayBuffer,
        };
      };

      const tool = new ImageEditTool();
      await tool.execute({ attachment_id: "att-img", prompt: "Test" }, sessionCtx);
      expect(filePaths).toContain("/tmp/photo.png");
    });

    test("akzeptiert Bild-Attachments mit mimeType 'image/jpeg'", async () => {
      mockState.attachment = {
        ...validAttachment,
        mimeType: "image/jpeg",
        filename: "photo.jpg",
      };
      const tool = new ImageEditTool();
      const result = JSON.parse(
        await tool.execute({ attachment_id: "att-img", prompt: "Test" }, sessionCtx)
      );
      expect(result.type).toBe("generated_image");
    });

    test("akzeptiert Bild-Attachments mit mimeType 'image/webp'", async () => {
      mockState.attachment = {
        ...validAttachment,
        mimeType: "image/webp",
        filename: "photo.webp",
      };
      const tool = new ImageEditTool();
      const result = JSON.parse(
        await tool.execute({ attachment_id: "att-img", prompt: "Test" }, sessionCtx)
      );
      expect(result.type).toBe("generated_image");
    });

    test("uebergibt revisedPrompt des Bildes an saveGeneratedImage()", async () => {
      const tool = new ImageEditTool();
      await tool.execute({ attachment_id: "att-img", prompt: "Test" }, sessionCtx);
      expect(mockState.saveArgs.revisedPrompt).toBe("A revised prompt");
    });
  });

  // -------------------------------------------------------------------------
  // execute() — Fehlerbehandlung bei Generierung
  // -------------------------------------------------------------------------

  describe("execute() — Fehlerbehandlung bei Generierung", () => {
    const validAttachment = {
      id: "att-img",
      sessionId: "sess-1",
      filename: "photo.png",
      mimeType: "image/png",
      type: "image" as const,
      storagePath: "/tmp/photo.png",
      metadata: { size: 8192, originalPath: "/tmp/photo.png" },
    };
    const sessionCtx: ToolContext = { sessionId: "sess-1" };

    beforeEach(() => {
      mockState.attachment = { ...validAttachment };
    });

    test("gibt Fehler zurueck wenn generate() success: false liefert", async () => {
      mockState.generateResult = {
        success: false,
        images: [],
        provider: "test-provider",
        model: "test-model",
        durationMs: 200,
        error: "Modell nicht erreichbar",
      };
      const tool = new ImageEditTool();
      const result = JSON.parse(
        await tool.execute({ attachment_id: "att-img", prompt: "Test" }, sessionCtx)
      );
      expect(result.success).toBe(false);
      expect(result.error).toBe("Modell nicht erreichbar");
    });

    test("gibt Fehler zurueck wenn generate() leeres images-Array liefert", async () => {
      mockState.generateResult = {
        success: true,
        images: [],
        provider: "test-provider",
        model: "test-model",
        durationMs: 200,
        error: undefined,
      };
      const tool = new ImageEditTool();
      const result = JSON.parse(
        await tool.execute({ attachment_id: "att-img", prompt: "Test" }, sessionCtx)
      );
      expect(result.success).toBe(false);
      expect(result.error).toContain("Failed to edit");
    });

    test("verwendet Fallback-Fehlertext wenn error-Feld fehlt und success false ist", async () => {
      mockState.generateResult = {
        success: false,
        images: [],
        provider: "test-provider",
        model: "test-model",
        durationMs: 0,
        error: undefined,
      };
      const tool = new ImageEditTool();
      const result = JSON.parse(
        await tool.execute({ attachment_id: "att-img", prompt: "Test" }, sessionCtx)
      );
      expect(result.success).toBe(false);
      expect(result.error).toBeTruthy();
    });

    test("faengt Ausnahmen aus generate() ab und gibt Fehlermeldung zurueck", async () => {
      mockState.generateShouldThrow = true;
      mockState.generateThrowMessage = "Verbindung zum Provider fehlgeschlagen";
      const tool = new ImageEditTool();
      const result = JSON.parse(
        await tool.execute({ attachment_id: "att-img", prompt: "Test" }, sessionCtx)
      );
      expect(result.success).toBe(false);
      expect(result.error).toContain("Verbindung zum Provider fehlgeschlagen");
    });

    test("gibt success: false im Fehlerobjekt zurueck (kein type-Feld bei Exception)", async () => {
      mockState.generateShouldThrow = true;
      const tool = new ImageEditTool();
      const result = JSON.parse(
        await tool.execute({ attachment_id: "att-img", prompt: "Test" }, sessionCtx)
      );
      expect(result.success).toBe(false);
      expect(result.type).toBeUndefined();
    });
  });

  // -------------------------------------------------------------------------
  // createImageEditTool() — Factory-Funktion
  // -------------------------------------------------------------------------

  describe("createImageEditTool()", () => {
    test("erstellt eine ImageEditTool-Instanz", () => {
      const tool = createImageEditTool();
      expect(tool).toBeInstanceOf(ImageEditTool);
    });

    test("gibt eine neue, unabhaengige Instanz bei jedem Aufruf zurueck", () => {
      const tool1 = createImageEditTool();
      const tool2 = createImageEditTool();
      expect(tool1).not.toBe(tool2);
    });

    test("erstellte Instanz hat name 'edit_image'", () => {
      const tool = createImageEditTool();
      expect(tool.name).toBe("edit_image");
    });

    test("erstellte Instanz hat type 'api'", () => {
      const tool = createImageEditTool();
      expect(tool.type).toBe("api");
    });

    test("erstellte Instanz ist verfuegbar wenn supportsImageToImage() true liefert", async () => {
      mockState.supportsI2I = true;
      const tool = createImageEditTool();
      expect(await tool.isAvailable()).toBe(true);
    });

    test("erstellte Instanz ist nicht verfuegbar wenn supportsImageToImage() false liefert", async () => {
      mockState.supportsI2I = false;
      const tool = createImageEditTool();
      expect(await tool.isAvailable()).toBe(false);
    });
  });
});

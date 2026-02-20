/**
 * Tests for Apps Registry Service (backend/src/apps/registry.ts)
 *
 * Nutzt ein echtes temporaeres Verzeichnis unter /tmp fuer die Dateipersistenz,
 * da das Modul Bun.file / Bun.write direkt verwendet. APPS_REGISTRY wird per
 * mock.module() auf eine temporaere Testdatei umgeleitet.
 * mock.module() muss VOR dem Import des Moduls unter Test deklariert sein.
 */

import { test, expect, describe, beforeEach, afterAll, mock } from "bun:test";
import { rm, mkdir } from "fs/promises";
import { join } from "path";
import { stringify } from "yaml";
import type { AppConfig, AppsRegistry } from "../types";

// ---------------------------------------------------------------------------
// Temporaeres Testverzeichnis
// ---------------------------------------------------------------------------

const TEST_DIR = `/tmp/apps-registry-test-${process.pid}`;
const TEST_REGISTRY_PATH = join(TEST_DIR, "registry.yaml");

// ---------------------------------------------------------------------------
// Modul-Mocks — muessen VOR dem Import des Moduls unter Test stehen
// ---------------------------------------------------------------------------

mock.module("../../utils/paths", () => ({
  APPS_REGISTRY: TEST_REGISTRY_PATH,
}));

// ---------------------------------------------------------------------------
// Import NACH den Mocks
// ---------------------------------------------------------------------------

const {
  loadRegistry,
  saveRegistry,
  getApps,
  getEnabledApps,
  getApp,
  enableApp,
  disableApp,
  reorderApps,
  registerApp,
  unregisterApp,
  clearCache,
} = await import("../registry");

// ---------------------------------------------------------------------------
// Setup / Teardown
// ---------------------------------------------------------------------------

async function setupTestDir(): Promise<void> {
  await mkdir(TEST_DIR, { recursive: true });
}

async function removeRegistryFile(): Promise<void> {
  try {
    await rm(TEST_REGISTRY_PATH, { force: true });
  } catch {
    // ignore
  }
}

afterAll(async () => {
  await rm(TEST_DIR, { recursive: true, force: true });
});

// ---------------------------------------------------------------------------
// Hilfsfunktionen
// ---------------------------------------------------------------------------

function makeAppConfig(overrides: Partial<AppConfig> = {}): AppConfig {
  return {
    id: "test-app",
    name: "Test App",
    description: "Eine Test-Applikation",
    icon: "test-icon",
    version: "1.0.0",
    enabled: true,
    routes: [{ path: "/apps/test-app", component: "TestPage" }],
    ...overrides,
  };
}

async function writeRegistryFile(registry: AppsRegistry): Promise<void> {
  await Bun.write(TEST_REGISTRY_PATH, stringify(registry));
}

// ---------------------------------------------------------------------------
// loadRegistry()
// ---------------------------------------------------------------------------

describe("Apps Registry", () => {
  describe("loadRegistry()", () => {
    beforeEach(async () => {
      clearCache();
      await setupTestDir();
      await removeRegistryFile();
    });

    test("erstellt Standard-Registry wenn keine Datei vorhanden ist", async () => {
      const registry = await loadRegistry();
      expect(registry).toBeDefined();
      expect(registry.apps).toBeDefined();
      expect(typeof registry.apps).toBe("object");
    });

    test("Standard-Registry enthaelt vertragsmanagement", async () => {
      const registry = await loadRegistry();
      expect(registry.apps["vertragsmanagement"]).toBeDefined();
      expect(registry.apps["vertragsmanagement"]!.id).toBe("vertragsmanagement");
    });

    test("Standard-Registry enthaelt projektmanagement", async () => {
      const registry = await loadRegistry();
      expect(registry.apps["projektmanagement"]).toBeDefined();
      expect(registry.apps["projektmanagement"]!.id).toBe("projektmanagement");
    });

    test("Standard-Registry hat appOrder mit beiden Standard-Apps", async () => {
      const registry = await loadRegistry();
      expect(registry.appOrder).toBeDefined();
      expect(registry.appOrder).toContain("vertragsmanagement");
      expect(registry.appOrder).toContain("projektmanagement");
    });

    test("speichert Standard-Registry in Datei beim ersten Laden", async () => {
      await loadRegistry();
      const file = Bun.file(TEST_REGISTRY_PATH);
      expect(await file.exists()).toBe(true);
    });

    test("laedt vorhandene Registry-Datei korrekt", async () => {
      const registry: AppsRegistry = {
        apps: {
          "meine-app": makeAppConfig({ id: "meine-app", name: "Meine App" }),
        },
        appOrder: ["meine-app"],
      };
      await writeRegistryFile(registry);

      const loaded = await loadRegistry();
      expect(loaded.apps["meine-app"]).toBeDefined();
      expect(loaded.apps["meine-app"]!.name).toBe("Meine App");
    });

    test("verwendet Cache beim zweiten Aufruf", async () => {
      const first = await loadRegistry();
      const second = await loadRegistry();
      expect(second).toBe(first);
    });

    test("clearCache() setzt den Cache zurueck", async () => {
      const first = await loadRegistry();
      clearCache();
      const second = await loadRegistry();
      expect(second).not.toBe(first);
    });

    test("initialisiert appOrder aus Keys wenn in Datei fehlend", async () => {
      const registryWithoutOrder = {
        apps: {
          "app-a": makeAppConfig({ id: "app-a" }),
          "app-b": makeAppConfig({ id: "app-b" }),
        },
      };
      await writeRegistryFile(registryWithoutOrder as AppsRegistry);

      const loaded = await loadRegistry();
      expect(loaded.appOrder).toBeDefined();
      expect(loaded.appOrder).toContain("app-a");
      expect(loaded.appOrder).toContain("app-b");
    });

    test("faellt bei ungueltiger YAML-Datei auf Standard-Registry zurueck", async () => {
      await Bun.write(TEST_REGISTRY_PATH, "{ das ist: ungueltig: yaml: [");

      const registry = await loadRegistry();
      expect(registry).toBeDefined();
      expect(registry.apps).toBeDefined();
      // Sollte Standard-Apps enthalten
      expect(Object.keys(registry.apps).length).toBeGreaterThan(0);
    });
  });

  // ---------------------------------------------------------------------------
  // saveRegistry()
  // ---------------------------------------------------------------------------

  describe("saveRegistry()", () => {
    beforeEach(async () => {
      clearCache();
      await setupTestDir();
      await removeRegistryFile();
    });

    test("schreibt Registry in Datei", async () => {
      const registry: AppsRegistry = {
        apps: {
          "saved-app": makeAppConfig({ id: "saved-app" }),
        },
        appOrder: ["saved-app"],
      };

      await saveRegistry(registry);

      const file = Bun.file(TEST_REGISTRY_PATH);
      expect(await file.exists()).toBe(true);
    });

    test("gespeicherte Registry kann zurueckgeladen werden (Round-Trip)", async () => {
      const registry: AppsRegistry = {
        apps: {
          "roundtrip-app": makeAppConfig({
            id: "roundtrip-app",
            name: "Roundtrip App",
            enabled: false,
          }),
        },
        appOrder: ["roundtrip-app"],
      };

      await saveRegistry(registry);
      clearCache();
      const loaded = await loadRegistry();

      expect(loaded.apps["roundtrip-app"]).toBeDefined();
      expect(loaded.apps["roundtrip-app"]!.name).toBe("Roundtrip App");
      expect(loaded.apps["roundtrip-app"]!.enabled).toBe(false);
    });

    test("aktualisiert den Cache nach dem Speichern", async () => {
      const registry: AppsRegistry = {
        apps: {
          "cache-app": makeAppConfig({ id: "cache-app" }),
        },
        appOrder: ["cache-app"],
      };

      await saveRegistry(registry);
      // Kein clearCache() — der Cache sollte mit dem gespeicherten Wert aktuell sein
      const loaded = await loadRegistry();
      expect(loaded.apps["cache-app"]).toBeDefined();
    });
  });

  // ---------------------------------------------------------------------------
  // getApps()
  // ---------------------------------------------------------------------------

  describe("getApps()", () => {
    beforeEach(async () => {
      clearCache();
      await setupTestDir();
      await removeRegistryFile();
    });

    test("gibt alle Apps als Array zurueck", async () => {
      const registry: AppsRegistry = {
        apps: {
          "app-1": makeAppConfig({ id: "app-1" }),
          "app-2": makeAppConfig({ id: "app-2" }),
        },
        appOrder: ["app-1", "app-2"],
      };
      await writeRegistryFile(registry);

      const apps = await getApps();
      expect(apps).toHaveLength(2);
    });

    test("gibt leeres Array zurueck wenn keine Apps vorhanden sind", async () => {
      const registry: AppsRegistry = { apps: {}, appOrder: [] };
      await writeRegistryFile(registry);

      const apps = await getApps();
      expect(apps).toEqual([]);
    });

    test("sortiert Apps gemaess appOrder", async () => {
      const registry: AppsRegistry = {
        apps: {
          "beta": makeAppConfig({ id: "beta", name: "Beta" }),
          "alpha": makeAppConfig({ id: "alpha", name: "Alpha" }),
          "gamma": makeAppConfig({ id: "gamma", name: "Gamma" }),
        },
        appOrder: ["gamma", "alpha", "beta"],
      };
      await writeRegistryFile(registry);

      const apps = await getApps();
      expect(apps[0]!.id).toBe("gamma");
      expect(apps[1]!.id).toBe("alpha");
      expect(apps[2]!.id).toBe("beta");
    });

    test("haengt Apps ohne Eintrag in appOrder ans Ende an", async () => {
      const registry: AppsRegistry = {
        apps: {
          "app-a": makeAppConfig({ id: "app-a" }),
          "app-b": makeAppConfig({ id: "app-b" }),
          "app-orphan": makeAppConfig({ id: "app-orphan" }),
        },
        appOrder: ["app-a", "app-b"],
        // app-orphan fehlt in appOrder
      };
      await writeRegistryFile(registry);

      const apps = await getApps();
      expect(apps).toHaveLength(3);
      expect(apps[0]!.id).toBe("app-a");
      expect(apps[1]!.id).toBe("app-b");
      expect(apps[2]!.id).toBe("app-orphan");
    });

    test("gibt sowohl aktivierte als auch deaktivierte Apps zurueck", async () => {
      const registry: AppsRegistry = {
        apps: {
          "enabled-app": makeAppConfig({ id: "enabled-app", enabled: true }),
          "disabled-app": makeAppConfig({ id: "disabled-app", enabled: false }),
        },
        appOrder: ["enabled-app", "disabled-app"],
      };
      await writeRegistryFile(registry);

      const apps = await getApps();
      expect(apps).toHaveLength(2);
    });
  });

  // ---------------------------------------------------------------------------
  // getEnabledApps()
  // ---------------------------------------------------------------------------

  describe("getEnabledApps()", () => {
    beforeEach(async () => {
      clearCache();
      await setupTestDir();
      await removeRegistryFile();
    });

    test("gibt nur aktivierte Apps zurueck", async () => {
      const registry: AppsRegistry = {
        apps: {
          "active": makeAppConfig({ id: "active", enabled: true }),
          "inactive": makeAppConfig({ id: "inactive", enabled: false }),
        },
        appOrder: ["active", "inactive"],
      };
      await writeRegistryFile(registry);

      const apps = await getEnabledApps();
      expect(apps).toHaveLength(1);
      expect(apps[0]!.id).toBe("active");
    });

    test("gibt leeres Array zurueck wenn alle Apps deaktiviert sind", async () => {
      const registry: AppsRegistry = {
        apps: {
          "app-1": makeAppConfig({ id: "app-1", enabled: false }),
          "app-2": makeAppConfig({ id: "app-2", enabled: false }),
        },
        appOrder: ["app-1", "app-2"],
      };
      await writeRegistryFile(registry);

      const apps = await getEnabledApps();
      expect(apps).toEqual([]);
    });

    test("gibt alle Apps zurueck wenn alle aktiviert sind", async () => {
      const registry: AppsRegistry = {
        apps: {
          "app-x": makeAppConfig({ id: "app-x", enabled: true }),
          "app-y": makeAppConfig({ id: "app-y", enabled: true }),
        },
        appOrder: ["app-x", "app-y"],
      };
      await writeRegistryFile(registry);

      const apps = await getEnabledApps();
      expect(apps).toHaveLength(2);
    });

    test("behaelt Sortierung gemaess appOrder bei", async () => {
      const registry: AppsRegistry = {
        apps: {
          "second": makeAppConfig({ id: "second", enabled: true }),
          "first": makeAppConfig({ id: "first", enabled: true }),
        },
        appOrder: ["first", "second"],
      };
      await writeRegistryFile(registry);

      const apps = await getEnabledApps();
      expect(apps[0]!.id).toBe("first");
      expect(apps[1]!.id).toBe("second");
    });
  });

  // ---------------------------------------------------------------------------
  // getApp()
  // ---------------------------------------------------------------------------

  describe("getApp()", () => {
    beforeEach(async () => {
      clearCache();
      await setupTestDir();
      await removeRegistryFile();
    });

    test("gibt die gesuchte App zurueck wenn sie existiert", async () => {
      const registry: AppsRegistry = {
        apps: {
          "findme": makeAppConfig({ id: "findme", name: "Finde Mich" }),
        },
        appOrder: ["findme"],
      };
      await writeRegistryFile(registry);

      const app = await getApp("findme");
      expect(app).not.toBeNull();
      expect(app!.id).toBe("findme");
      expect(app!.name).toBe("Finde Mich");
    });

    test("gibt null zurueck wenn App nicht existiert", async () => {
      const registry: AppsRegistry = { apps: {}, appOrder: [] };
      await writeRegistryFile(registry);

      const app = await getApp("unbekannt");
      expect(app).toBeNull();
    });

    test("gibt korrekte App-Details zurueck", async () => {
      const config = makeAppConfig({
        id: "detail-app",
        name: "Detail App",
        description: "Detaillierte Beschreibung",
        icon: "detail-icon",
        version: "2.3.4",
        enabled: false,
        routes: [
          { path: "/apps/detail-app", component: "DetailPage" },
          { path: "/apps/detail-app/:id", component: "DetailItemPage" },
        ],
      });
      const registry: AppsRegistry = {
        apps: { "detail-app": config },
        appOrder: ["detail-app"],
      };
      await writeRegistryFile(registry);

      const app = await getApp("detail-app");
      expect(app!.description).toBe("Detaillierte Beschreibung");
      expect(app!.icon).toBe("detail-icon");
      expect(app!.version).toBe("2.3.4");
      expect(app!.enabled).toBe(false);
      expect(app!.routes).toHaveLength(2);
    });
  });

  // ---------------------------------------------------------------------------
  // enableApp()
  // ---------------------------------------------------------------------------

  describe("enableApp()", () => {
    beforeEach(async () => {
      clearCache();
      await setupTestDir();
      await removeRegistryFile();
    });

    test("aktiviert eine deaktivierte App und gibt sie zurueck", async () => {
      const registry: AppsRegistry = {
        apps: {
          "toggle-app": makeAppConfig({ id: "toggle-app", enabled: false }),
        },
        appOrder: ["toggle-app"],
      };
      await writeRegistryFile(registry);

      const result = await enableApp("toggle-app");
      expect(result).not.toBeNull();
      expect(result!.enabled).toBe(true);
    });

    test("aendert enabled-Status einer bereits aktiven App nicht", async () => {
      const registry: AppsRegistry = {
        apps: {
          "already-on": makeAppConfig({ id: "already-on", enabled: true }),
        },
        appOrder: ["already-on"],
      };
      await writeRegistryFile(registry);

      const result = await enableApp("already-on");
      expect(result!.enabled).toBe(true);
    });

    test("gibt null zurueck wenn App nicht existiert", async () => {
      const registry: AppsRegistry = { apps: {}, appOrder: [] };
      await writeRegistryFile(registry);

      const result = await enableApp("nicht-vorhanden");
      expect(result).toBeNull();
    });

    test("persistiert Aenderung in Datei", async () => {
      const registry: AppsRegistry = {
        apps: {
          "persist-test": makeAppConfig({ id: "persist-test", enabled: false }),
        },
        appOrder: ["persist-test"],
      };
      await writeRegistryFile(registry);

      await enableApp("persist-test");
      clearCache();
      const loaded = await loadRegistry();
      expect(loaded.apps["persist-test"]!.enabled).toBe(true);
    });

    test("gibt AppConfig-Objekt zurueck (mit id, name, routes)", async () => {
      const registry: AppsRegistry = {
        apps: {
          "full-app": makeAppConfig({
            id: "full-app",
            name: "Vollstaendige App",
            enabled: false,
          }),
        },
        appOrder: ["full-app"],
      };
      await writeRegistryFile(registry);

      const result = await enableApp("full-app");
      expect(result!.id).toBe("full-app");
      expect(result!.name).toBe("Vollstaendige App");
      expect(result!.routes).toBeDefined();
    });
  });

  // ---------------------------------------------------------------------------
  // disableApp()
  // ---------------------------------------------------------------------------

  describe("disableApp()", () => {
    beforeEach(async () => {
      clearCache();
      await setupTestDir();
      await removeRegistryFile();
    });

    test("deaktiviert eine aktive App und gibt sie zurueck", async () => {
      const registry: AppsRegistry = {
        apps: {
          "active-app": makeAppConfig({ id: "active-app", enabled: true }),
        },
        appOrder: ["active-app"],
      };
      await writeRegistryFile(registry);

      const result = await disableApp("active-app");
      expect(result).not.toBeNull();
      expect(result!.enabled).toBe(false);
    });

    test("aendert enabled-Status einer bereits deaktivierten App nicht", async () => {
      const registry: AppsRegistry = {
        apps: {
          "already-off": makeAppConfig({ id: "already-off", enabled: false }),
        },
        appOrder: ["already-off"],
      };
      await writeRegistryFile(registry);

      const result = await disableApp("already-off");
      expect(result!.enabled).toBe(false);
    });

    test("gibt null zurueck wenn App nicht existiert", async () => {
      const registry: AppsRegistry = { apps: {}, appOrder: [] };
      await writeRegistryFile(registry);

      const result = await disableApp("ghost-app");
      expect(result).toBeNull();
    });

    test("persistiert Aenderung in Datei", async () => {
      const registry: AppsRegistry = {
        apps: {
          "save-on-disable": makeAppConfig({ id: "save-on-disable", enabled: true }),
        },
        appOrder: ["save-on-disable"],
      };
      await writeRegistryFile(registry);

      await disableApp("save-on-disable");
      clearCache();
      const loaded = await loadRegistry();
      expect(loaded.apps["save-on-disable"]!.enabled).toBe(false);
    });

    test("enable gefolgt von disable fuehrt zum korrekten Endzustand", async () => {
      const registry: AppsRegistry = {
        apps: {
          "toggle-twice": makeAppConfig({ id: "toggle-twice", enabled: false }),
        },
        appOrder: ["toggle-twice"],
      };
      await writeRegistryFile(registry);

      await enableApp("toggle-twice");
      await disableApp("toggle-twice");
      clearCache();

      const loaded = await loadRegistry();
      expect(loaded.apps["toggle-twice"]!.enabled).toBe(false);
    });

    test("disable gefolgt von enable fuehrt zum korrekten Endzustand", async () => {
      const registry: AppsRegistry = {
        apps: {
          "toggle-back": makeAppConfig({ id: "toggle-back", enabled: true }),
        },
        appOrder: ["toggle-back"],
      };
      await writeRegistryFile(registry);

      await disableApp("toggle-back");
      await enableApp("toggle-back");
      clearCache();

      const loaded = await loadRegistry();
      expect(loaded.apps["toggle-back"]!.enabled).toBe(true);
    });
  });

  // ---------------------------------------------------------------------------
  // reorderApps()
  // ---------------------------------------------------------------------------

  describe("reorderApps()", () => {
    beforeEach(async () => {
      clearCache();
      await setupTestDir();
      await removeRegistryFile();
    });

    test("sortiert Apps in der angegebenen Reihenfolge", async () => {
      const registry: AppsRegistry = {
        apps: {
          "a": makeAppConfig({ id: "a" }),
          "b": makeAppConfig({ id: "b" }),
          "c": makeAppConfig({ id: "c" }),
        },
        appOrder: ["a", "b", "c"],
      };
      await writeRegistryFile(registry);

      const result = await reorderApps(["c", "a", "b"]);
      expect(result[0]!.id).toBe("c");
      expect(result[1]!.id).toBe("a");
      expect(result[2]!.id).toBe("b");
    });

    test("gibt alle Apps als sortierten Array zurueck", async () => {
      const registry: AppsRegistry = {
        apps: {
          "x": makeAppConfig({ id: "x" }),
          "y": makeAppConfig({ id: "y" }),
        },
        appOrder: ["x", "y"],
      };
      await writeRegistryFile(registry);

      const result = await reorderApps(["y", "x"]);
      expect(result).toHaveLength(2);
    });

    test("persistiert neue appOrder in Datei", async () => {
      const registry: AppsRegistry = {
        apps: {
          "p": makeAppConfig({ id: "p" }),
          "q": makeAppConfig({ id: "q" }),
        },
        appOrder: ["p", "q"],
      };
      await writeRegistryFile(registry);

      await reorderApps(["q", "p"]);
      clearCache();
      const loaded = await loadRegistry();
      expect(loaded.appOrder![0]).toBe("q");
      expect(loaded.appOrder![1]).toBe("p");
    });

    test("ignoriert unbekannte IDs in der Eingabeliste", async () => {
      const registry: AppsRegistry = {
        apps: {
          "real-1": makeAppConfig({ id: "real-1" }),
          "real-2": makeAppConfig({ id: "real-2" }),
        },
        appOrder: ["real-1", "real-2"],
      };
      await writeRegistryFile(registry);

      const result = await reorderApps(["ghost", "real-1", "real-2"]);
      expect(result).toHaveLength(2);
      expect(result[0]!.id).toBe("real-1");
    });

    test("haengt fehlende Apps ans Ende an", async () => {
      const registry: AppsRegistry = {
        apps: {
          "first": makeAppConfig({ id: "first" }),
          "second": makeAppConfig({ id: "second" }),
          "third": makeAppConfig({ id: "third" }),
        },
        appOrder: ["first", "second", "third"],
      };
      await writeRegistryFile(registry);

      // third wird nicht in der Reihenfolge angegeben
      const result = await reorderApps(["second", "first"]);
      expect(result).toHaveLength(3);
      expect(result[0]!.id).toBe("second");
      expect(result[1]!.id).toBe("first");
      expect(result[2]!.id).toBe("third");
    });

    test("leere Eingabeliste haengt alle Apps in beliebiger Reihenfolge an", async () => {
      const registry: AppsRegistry = {
        apps: {
          "m": makeAppConfig({ id: "m" }),
          "n": makeAppConfig({ id: "n" }),
        },
        appOrder: ["m", "n"],
      };
      await writeRegistryFile(registry);

      const result = await reorderApps([]);
      expect(result).toHaveLength(2);
    });

    test("getApps() spiegelt nach reorderApps() die neue Reihenfolge wider", async () => {
      const registry: AppsRegistry = {
        apps: {
          "eins": makeAppConfig({ id: "eins" }),
          "zwei": makeAppConfig({ id: "zwei" }),
          "drei": makeAppConfig({ id: "drei" }),
        },
        appOrder: ["eins", "zwei", "drei"],
      };
      await writeRegistryFile(registry);

      await reorderApps(["drei", "eins", "zwei"]);
      // Kein clearCache() — Aenderung sollte im Cache sein
      const apps = await getApps();
      expect(apps[0]!.id).toBe("drei");
      expect(apps[1]!.id).toBe("eins");
      expect(apps[2]!.id).toBe("zwei");
    });
  });

  // ---------------------------------------------------------------------------
  // registerApp()
  // ---------------------------------------------------------------------------

  describe("registerApp()", () => {
    beforeEach(async () => {
      clearCache();
      await setupTestDir();
      await removeRegistryFile();
    });

    test("registriert eine neue App und gibt sie zurueck", async () => {
      const registry: AppsRegistry = { apps: {}, appOrder: [] };
      await writeRegistryFile(registry);

      const config = makeAppConfig({ id: "neue-app", name: "Neue App" });
      const result = await registerApp(config);
      expect(result.id).toBe("neue-app");
      expect(result.name).toBe("Neue App");
    });

    test("neu registrierte App ist danach abrufbar per getApp()", async () => {
      const registry: AppsRegistry = { apps: {}, appOrder: [] };
      await writeRegistryFile(registry);

      const config = makeAppConfig({ id: "abrufbar" });
      await registerApp(config);
      const found = await getApp("abrufbar");
      expect(found).not.toBeNull();
      expect(found!.id).toBe("abrufbar");
    });

    test("fuegt ID am Ende von appOrder hinzu", async () => {
      const registry: AppsRegistry = {
        apps: {
          "bestehend": makeAppConfig({ id: "bestehend" }),
        },
        appOrder: ["bestehend"],
      };
      await writeRegistryFile(registry);

      const config = makeAppConfig({ id: "neu-in-order" });
      await registerApp(config);
      clearCache();
      const loaded = await loadRegistry();
      expect(loaded.appOrder).toContain("neu-in-order");
      expect(loaded.appOrder![loaded.appOrder!.length - 1]).toBe("neu-in-order");
    });

    test("wirft Fehler wenn App-ID bereits existiert", async () => {
      const registry: AppsRegistry = {
        apps: {
          "existiert": makeAppConfig({ id: "existiert" }),
        },
        appOrder: ["existiert"],
      };
      await writeRegistryFile(registry);

      const config = makeAppConfig({ id: "existiert" });
      await expect(registerApp(config)).rejects.toThrow();
    });

    test("Fehlermeldung bei Duplikat enthaelt die App-ID", async () => {
      const registry: AppsRegistry = {
        apps: {
          "duplikat": makeAppConfig({ id: "duplikat" }),
        },
        appOrder: ["duplikat"],
      };
      await writeRegistryFile(registry);

      const config = makeAppConfig({ id: "duplikat" });
      await expect(registerApp(config)).rejects.toThrow("duplikat");
    });

    test("persistiert die neue App in Datei", async () => {
      const registry: AppsRegistry = { apps: {}, appOrder: [] };
      await writeRegistryFile(registry);

      const config = makeAppConfig({ id: "persistent-app" });
      await registerApp(config);
      clearCache();
      const loaded = await loadRegistry();
      expect(loaded.apps["persistent-app"]).toBeDefined();
    });

    test("kann mehrere Apps nacheinander registrieren", async () => {
      const registry: AppsRegistry = { apps: {}, appOrder: [] };
      await writeRegistryFile(registry);

      await registerApp(makeAppConfig({ id: "sequenz-1" }));
      await registerApp(makeAppConfig({ id: "sequenz-2" }));
      await registerApp(makeAppConfig({ id: "sequenz-3" }));

      const apps = await getApps();
      const ids = apps.map(a => a.id);
      expect(ids).toContain("sequenz-1");
      expect(ids).toContain("sequenz-2");
      expect(ids).toContain("sequenz-3");
    });
  });

  // ---------------------------------------------------------------------------
  // unregisterApp()
  // ---------------------------------------------------------------------------

  describe("unregisterApp()", () => {
    beforeEach(async () => {
      clearCache();
      await setupTestDir();
      await removeRegistryFile();
    });

    test("entfernt eine vorhandene App und gibt true zurueck", async () => {
      const registry: AppsRegistry = {
        apps: {
          "zu-loeschen": makeAppConfig({ id: "zu-loeschen" }),
        },
        appOrder: ["zu-loeschen"],
      };
      await writeRegistryFile(registry);

      const result = await unregisterApp("zu-loeschen");
      expect(result).toBe(true);
    });

    test("gibt false zurueck wenn App nicht existiert", async () => {
      const registry: AppsRegistry = { apps: {}, appOrder: [] };
      await writeRegistryFile(registry);

      const result = await unregisterApp("unbekannt");
      expect(result).toBe(false);
    });

    test("entfernte App ist danach nicht mehr per getApp() abrufbar", async () => {
      const registry: AppsRegistry = {
        apps: {
          "weg-damit": makeAppConfig({ id: "weg-damit" }),
        },
        appOrder: ["weg-damit"],
      };
      await writeRegistryFile(registry);

      await unregisterApp("weg-damit");
      const found = await getApp("weg-damit");
      expect(found).toBeNull();
    });

    test("entfernt ID aus appOrder", async () => {
      const registry: AppsRegistry = {
        apps: {
          "keep": makeAppConfig({ id: "keep" }),
          "remove": makeAppConfig({ id: "remove" }),
        },
        appOrder: ["keep", "remove"],
      };
      await writeRegistryFile(registry);

      await unregisterApp("remove");
      clearCache();
      const loaded = await loadRegistry();
      expect(loaded.appOrder).not.toContain("remove");
      expect(loaded.appOrder).toContain("keep");
    });

    test("persistiert Entfernung in Datei", async () => {
      const registry: AppsRegistry = {
        apps: {
          "geloescht": makeAppConfig({ id: "geloescht" }),
        },
        appOrder: ["geloescht"],
      };
      await writeRegistryFile(registry);

      await unregisterApp("geloescht");
      clearCache();
      const loaded = await loadRegistry();
      expect(loaded.apps["geloescht"]).toBeUndefined();
    });

    test("andere Apps bleiben nach Entfernen unveraendert", async () => {
      const registry: AppsRegistry = {
        apps: {
          "bleib": makeAppConfig({ id: "bleib", name: "Bleibt" }),
          "geh": makeAppConfig({ id: "geh", name: "Geht" }),
        },
        appOrder: ["bleib", "geh"],
      };
      await writeRegistryFile(registry);

      await unregisterApp("geh");
      const remaining = await getApps();
      expect(remaining).toHaveLength(1);
      expect(remaining[0]!.id).toBe("bleib");
    });
  });

  // ---------------------------------------------------------------------------
  // clearCache()
  // ---------------------------------------------------------------------------

  describe("clearCache()", () => {
    beforeEach(async () => {
      clearCache();
      await setupTestDir();
      await removeRegistryFile();
    });

    test("erzwingt Neuladen aus Datei beim naechsten Aufruf", async () => {
      const initial: AppsRegistry = {
        apps: {
          "original": makeAppConfig({ id: "original" }),
        },
        appOrder: ["original"],
      };
      await writeRegistryFile(initial);
      await loadRegistry(); // fuellt den Cache

      // Datei direkt aendern (ohne Cache)
      const updated: AppsRegistry = {
        apps: {
          "original": makeAppConfig({ id: "original" }),
          "hinzugefuegt": makeAppConfig({ id: "hinzugefuegt" }),
        },
        appOrder: ["original", "hinzugefuegt"],
      };
      await Bun.write(TEST_REGISTRY_PATH, stringify(updated));

      clearCache();
      const reloaded = await loadRegistry();
      expect(reloaded.apps["hinzugefuegt"]).toBeDefined();
    });

    test("mehrfaches clearCache() ohne Zugriff wirft keinen Fehler", () => {
      expect(() => {
        clearCache();
        clearCache();
        clearCache();
      }).not.toThrow();
    });

    test("nach clearCache() wird Standard-Registry geliefert wenn Datei fehlt", async () => {
      // Zuerst normales Laden ausfuehren
      await loadRegistry();
      await removeRegistryFile();

      clearCache();
      const registry = await loadRegistry();
      // Sollte Default-Registry mit vertragsmanagement und projektmanagement sein
      expect(registry.apps["vertragsmanagement"]).toBeDefined();
      expect(registry.apps["projektmanagement"]).toBeDefined();
    });
  });

  // ---------------------------------------------------------------------------
  // Integrationstest: CRUD-Workflow
  // ---------------------------------------------------------------------------

  describe("Integrationstest: vollstaendiger CRUD-Workflow", () => {
    beforeEach(async () => {
      clearCache();
      await setupTestDir();
      await removeRegistryFile();
    });

    test("registrieren, aktivieren, deaktivieren, sortieren, entfernen", async () => {
      // Start mit leerer Registry
      const emptyRegistry: AppsRegistry = { apps: {}, appOrder: [] };
      await writeRegistryFile(emptyRegistry);

      // 1. Drei Apps registrieren
      await registerApp(makeAppConfig({ id: "app-eins", enabled: false }));
      await registerApp(makeAppConfig({ id: "app-zwei", enabled: true }));
      await registerApp(makeAppConfig({ id: "app-drei", enabled: false }));

      // 2. Alle Apps pruefen
      let all = await getApps();
      expect(all).toHaveLength(3);

      // 3. Nur aktivierte pruefen
      let enabled = await getEnabledApps();
      expect(enabled).toHaveLength(1);
      expect(enabled[0]!.id).toBe("app-zwei");

      // 4. Erste App aktivieren
      await enableApp("app-eins");
      enabled = await getEnabledApps();
      expect(enabled).toHaveLength(2);

      // 5. Zweite App deaktivieren
      await disableApp("app-zwei");
      enabled = await getEnabledApps();
      expect(enabled).toHaveLength(1);
      expect(enabled[0]!.id).toBe("app-eins");

      // 6. Umsortieren
      await reorderApps(["app-drei", "app-zwei", "app-eins"]);
      all = await getApps();
      expect(all[0]!.id).toBe("app-drei");

      // 7. Eine App entfernen
      const removed = await unregisterApp("app-zwei");
      expect(removed).toBe(true);
      all = await getApps();
      expect(all).toHaveLength(2);
      expect(all.find(a => a.id === "app-zwei")).toBeUndefined();

      // 8. Persistenz pruefen
      clearCache();
      const finalRegistry = await loadRegistry();
      expect(Object.keys(finalRegistry.apps)).toHaveLength(2);
      expect(finalRegistry.apps["app-eins"]!.enabled).toBe(true);
      expect(finalRegistry.apps["app-drei"]!.enabled).toBe(false);
    });
  });
});

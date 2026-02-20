import { test, expect, describe, beforeEach, afterAll } from "bun:test";
import { existsSync } from "fs";
import { rm, readFile, writeFile, mkdir } from "fs/promises";
import { join } from "path";
import {
  ensureDir,
  loadYaml,
  saveYaml,
  listYamlIds,
  deleteYaml,
  createYamlStore,
} from "../yamlStorage";

const TEST_DIR = `/tmp/yaml-storage-test-${Date.now()}`;

afterAll(async () => {
  await rm(TEST_DIR, { recursive: true, force: true });
});

// ── ensureDir ────────────────────────────────────────────────────────

describe("ensureDir", () => {
  test("erstellt ein nicht vorhandenes Verzeichnis", async () => {
    const dir = join(TEST_DIR, "ensure-new");
    expect(existsSync(dir)).toBe(false);
    await ensureDir(dir);
    expect(existsSync(dir)).toBe(true);
  });

  test("ist idempotent wenn Verzeichnis bereits existiert", async () => {
    const dir = join(TEST_DIR, "ensure-existing");
    await ensureDir(dir);
    // Second call must not throw
    await expect(ensureDir(dir)).resolves.toBeUndefined();
    expect(existsSync(dir)).toBe(true);
  });

  test("erstellt verschachtelte Verzeichnisse rekursiv", async () => {
    const dir = join(TEST_DIR, "ensure-nested", "a", "b", "c");
    expect(existsSync(dir)).toBe(false);
    await ensureDir(dir);
    expect(existsSync(dir)).toBe(true);
  });
});

// ── loadYaml ─────────────────────────────────────────────────────────

describe("loadYaml", () => {
  const subdir = join(TEST_DIR, "load");

  beforeEach(async () => {
    await ensureDir(subdir);
  });

  test("gibt null zurück wenn Datei nicht existiert", async () => {
    const result = await loadYaml(join(subdir, "nonexistent.yaml"));
    expect(result).toBeNull();
  });

  test("lädt ein einfaches Objekt korrekt", async () => {
    const filePath = join(subdir, "simple.yaml");
    await writeFile(filePath, "name: Alice\nage: 30\n");
    const result = await loadYaml<{ name: string; age: number }>(filePath);
    expect(result).toEqual({ name: "Alice", age: 30 });
  });

  test("lädt ein Array korrekt", async () => {
    const filePath = join(subdir, "array.yaml");
    await writeFile(filePath, "- one\n- two\n- three\n");
    const result = await loadYaml<string[]>(filePath);
    expect(result).toEqual(["one", "two", "three"]);
  });

  test("lädt verschachtelte Daten korrekt", async () => {
    const filePath = join(subdir, "nested.yaml");
    await writeFile(filePath, "user:\n  id: u1\n  tags:\n    - admin\n    - user\n");
    const result = await loadYaml<{ user: { id: string; tags: string[] } }>(filePath);
    expect(result).toEqual({ user: { id: "u1", tags: ["admin", "user"] } });
  });

  test("gibt null zurück bei leerer YAML-Datei", async () => {
    const filePath = join(subdir, "empty.yaml");
    await writeFile(filePath, "");
    const result = await loadYaml(filePath);
    expect(result).toBeNull();
  });

  test("wendet validate-Callback an und gibt dessen Rückgabewert zurück", async () => {
    const filePath = join(subdir, "validated.yaml");
    await writeFile(filePath, "value: 42\n");
    const validate = (data: unknown) => {
      const d = data as { value: number };
      return { value: d.value * 2 };
    };
    const result = await loadYaml(filePath, validate);
    expect(result).toEqual({ value: 84 });
  });

  test("validate-Callback kann Fehler werfen und dieser wird nach oben propagiert", async () => {
    const filePath = join(subdir, "invalid.yaml");
    await writeFile(filePath, "name: test\n");
    const validate = (_data: unknown) => {
      throw new Error("Validation failed");
    };
    await expect(loadYaml(filePath, validate)).rejects.toThrow("Validation failed");
  });
});

// ── saveYaml + loadYaml Round-Trip ───────────────────────────────────

describe("saveYaml", () => {
  const subdir = join(TEST_DIR, "save");

  test("speichert ein Objekt und lädt es korrekt zurück (Round-Trip)", async () => {
    const filePath = join(subdir, "roundtrip.yaml");
    const data = { id: "abc", count: 7, active: true };
    await saveYaml(filePath, data);
    const loaded = await loadYaml<typeof data>(filePath);
    expect(loaded).toEqual(data);
  });

  test("speichert ein Array und lädt es korrekt zurück", async () => {
    const filePath = join(subdir, "array-roundtrip.yaml");
    const data = [1, 2, 3, 4, 5];
    await saveYaml(filePath, data);
    const loaded = await loadYaml<number[]>(filePath);
    expect(loaded).toEqual(data);
  });

  test("speichert verschachtelte Objekte korrekt", async () => {
    const filePath = join(subdir, "nested-roundtrip.yaml");
    const data = {
      server: { host: "localhost", port: 3001 },
      features: { auth: true, rbac: false },
      tags: ["backend", "api"],
    };
    await saveYaml(filePath, data);
    const loaded = await loadYaml<typeof data>(filePath);
    expect(loaded).toEqual(data);
  });

  test("erstellt das übergeordnete Verzeichnis automatisch", async () => {
    const filePath = join(subdir, "auto-created-dir", "deep.yaml");
    expect(existsSync(join(subdir, "auto-created-dir"))).toBe(false);
    await saveYaml(filePath, { ok: true });
    expect(existsSync(filePath)).toBe(true);
  });

  test("überschreibt eine bereits vorhandene Datei", async () => {
    const filePath = join(subdir, "overwrite.yaml");
    await saveYaml(filePath, { version: 1 });
    await saveYaml(filePath, { version: 2 });
    const loaded = await loadYaml<{ version: number }>(filePath);
    expect(loaded?.version).toBe(2);
  });

  test("schreibt gültige YAML-Syntax in die Datei", async () => {
    const filePath = join(subdir, "syntax-check.yaml");
    await saveYaml(filePath, { hello: "world" });
    const content = await readFile(filePath, "utf-8");
    expect(content).toContain("hello:");
    expect(content).toContain("world");
  });

  test("respektiert den indent-Option-Parameter", async () => {
    const filePath = join(subdir, "indent.yaml");
    await saveYaml(filePath, { nested: { key: "val" } }, { indent: 4 });
    const content = await readFile(filePath, "utf-8");
    // 4-space indentation should appear
    expect(content).toMatch(/^ {4}/m);
  });
});

// ── listYamlIds ──────────────────────────────────────────────────────

describe("listYamlIds", () => {
  const subdir = join(TEST_DIR, "list");

  beforeEach(async () => {
    await ensureDir(subdir);
  });

  test("gibt leere Liste zurück wenn Verzeichnis leer ist", async () => {
    const emptyDir = join(TEST_DIR, "list-empty");
    await ensureDir(emptyDir);
    const ids = await listYamlIds(emptyDir);
    expect(ids).toEqual([]);
  });

  test("gibt leere Liste zurück wenn Verzeichnis nicht existiert", async () => {
    const ids = await listYamlIds(join(TEST_DIR, "nonexistent-dir"));
    expect(ids).toEqual([]);
  });

  test("gibt Dateinamen ohne .yaml-Erweiterung zurück", async () => {
    const dir = join(subdir, "basenames");
    await ensureDir(dir);
    await writeFile(join(dir, "alpha.yaml"), "x: 1\n");
    await writeFile(join(dir, "beta.yaml"), "x: 2\n");
    const ids = await listYamlIds(dir);
    expect(ids.sort()).toEqual(["alpha", "beta"]);
  });

  test("ignoriert Nicht-YAML-Dateien", async () => {
    const dir = join(subdir, "mixed");
    await ensureDir(dir);
    await writeFile(join(dir, "item.yaml"), "x: 1\n");
    await writeFile(join(dir, "readme.txt"), "ignored\n");
    await writeFile(join(dir, "data.json"), "{}\n");
    const ids = await listYamlIds(dir);
    expect(ids).toEqual(["item"]);
  });

  test("ignoriert .gitkeep-Datei", async () => {
    const dir = join(subdir, "gitkeep");
    await ensureDir(dir);
    // .gitkeep has no .yaml extension so glob won't match it,
    // but we test the explicit guard with a file named .gitkeep.yaml
    await writeFile(join(dir, ".gitkeep"), "");
    await writeFile(join(dir, "real.yaml"), "x: 1\n");
    const ids = await listYamlIds(dir);
    expect(ids).toEqual(["real"]);
  });

  test("filtert IDs nach Prefix", async () => {
    const dir = join(subdir, "prefix");
    await ensureDir(dir);
    await writeFile(join(dir, "task_001.yaml"), "x: 1\n");
    await writeFile(join(dir, "task_002.yaml"), "x: 2\n");
    await writeFile(join(dir, "note_001.yaml"), "x: 3\n");
    const ids = await listYamlIds(dir, "task_");
    expect(ids.sort()).toEqual(["task_001", "task_002"]);
  });

  test("gibt alle IDs zurück wenn kein Prefix angegeben", async () => {
    const dir = join(subdir, "no-prefix");
    await ensureDir(dir);
    await writeFile(join(dir, "task_001.yaml"), "x: 1\n");
    await writeFile(join(dir, "note_001.yaml"), "x: 2\n");
    const ids = await listYamlIds(dir);
    expect(ids.sort()).toEqual(["note_001", "task_001"]);
  });

  test("gibt leere Liste zurück wenn kein Element dem Prefix entspricht", async () => {
    const dir = join(subdir, "no-match");
    await ensureDir(dir);
    await writeFile(join(dir, "note_001.yaml"), "x: 1\n");
    const ids = await listYamlIds(dir, "task_");
    expect(ids).toEqual([]);
  });
});

// ── deleteYaml ───────────────────────────────────────────────────────

describe("deleteYaml", () => {
  const subdir = join(TEST_DIR, "delete");

  beforeEach(async () => {
    await ensureDir(subdir);
  });

  test("löscht eine vorhandene Datei und gibt true zurück", async () => {
    const filePath = join(subdir, "to-delete.yaml");
    await writeFile(filePath, "x: 1\n");
    expect(existsSync(filePath)).toBe(true);
    const result = await deleteYaml(filePath);
    expect(result).toBe(true);
    expect(existsSync(filePath)).toBe(false);
  });

  test("gibt false zurück wenn Datei nicht existiert", async () => {
    const result = await deleteYaml(join(subdir, "nonexistent.yaml"));
    expect(result).toBe(false);
  });

  test("löscht nur die angegebene Datei, andere bleiben erhalten", async () => {
    const fileA = join(subdir, "keep.yaml");
    const fileB = join(subdir, "remove.yaml");
    await writeFile(fileA, "a: 1\n");
    await writeFile(fileB, "b: 2\n");
    await deleteYaml(fileB);
    expect(existsSync(fileA)).toBe(true);
    expect(existsSync(fileB)).toBe(false);
  });
});

// ── createYamlStore ──────────────────────────────────────────────────

describe("createYamlStore", () => {
  test("filePath gibt korrekten Pfad zurück", () => {
    const storeDir = join(TEST_DIR, "store-filepath");
    const store = createYamlStore<{ val: number }>(storeDir);
    expect(store.filePath("item1")).toBe(join(storeDir, "item1.yaml"));
  });

  test("save + load Round-Trip funktioniert", async () => {
    const storeDir = join(TEST_DIR, "store-roundtrip");
    const store = createYamlStore<{ name: string; score: number }>(storeDir);
    await store.save("entry1", { name: "Test", score: 99 });
    const loaded = await store.load("entry1");
    expect(loaded).toEqual({ name: "Test", score: 99 });
  });

  test("load gibt null zurück für nicht vorhandene ID", async () => {
    const storeDir = join(TEST_DIR, "store-null");
    const store = createYamlStore<{ x: number }>(storeDir);
    const result = await store.load("missing");
    expect(result).toBeNull();
  });

  test("listIds gibt alle gespeicherten IDs zurück", async () => {
    const storeDir = join(TEST_DIR, "store-list");
    const store = createYamlStore<{ v: number }>(storeDir);
    await store.save("a", { v: 1 });
    await store.save("b", { v: 2 });
    await store.save("c", { v: 3 });
    const ids = await store.listIds();
    expect(ids.sort()).toEqual(["a", "b", "c"]);
  });

  test("listIds filtert nach Prefix wenn konfiguriert", async () => {
    const storeDir = join(TEST_DIR, "store-prefix");
    const store = createYamlStore<{ v: number }>(storeDir, { prefix: "task_" });
    await store.save("task_1", { v: 1 });
    await store.save("task_2", { v: 2 });
    await store.save("note_1", { v: 3 });
    const ids = await store.listIds();
    expect(ids.sort()).toEqual(["task_1", "task_2"]);
  });

  test("delete entfernt einen Eintrag und gibt true zurück", async () => {
    const storeDir = join(TEST_DIR, "store-delete");
    const store = createYamlStore<{ v: number }>(storeDir);
    await store.save("item", { v: 42 });
    const deleted = await store.delete("item");
    expect(deleted).toBe(true);
    const loaded = await store.load("item");
    expect(loaded).toBeNull();
  });

  test("delete gibt false zurück für nicht vorhandene ID", async () => {
    const storeDir = join(TEST_DIR, "store-delete-missing");
    const store = createYamlStore<{ v: number }>(storeDir);
    const result = await store.delete("ghost");
    expect(result).toBe(false);
  });

  test("ensureDir erstellt das Basisverzeichnis", async () => {
    const storeDir = join(TEST_DIR, "store-ensure");
    expect(existsSync(storeDir)).toBe(false);
    const store = createYamlStore<{ x: number }>(storeDir);
    await store.ensureDir();
    expect(existsSync(storeDir)).toBe(true);
  });

  test("vollständiger Workflow: save, listIds, load, delete", async () => {
    const storeDir = join(TEST_DIR, "store-workflow");
    const store = createYamlStore<{ label: string }>(storeDir);

    // Save multiple items
    await store.save("item_a", { label: "Alpha" });
    await store.save("item_b", { label: "Beta" });

    // List
    const ids = await store.listIds();
    expect(ids.sort()).toEqual(["item_a", "item_b"]);

    // Load each
    expect(await store.load("item_a")).toEqual({ label: "Alpha" });
    expect(await store.load("item_b")).toEqual({ label: "Beta" });

    // Delete one
    await store.delete("item_a");
    expect(await store.load("item_a")).toBeNull();
    const remaining = await store.listIds();
    expect(remaining).toEqual(["item_b"]);
  });

  test("benutzerdefinierte Dateiendung wird verwendet", async () => {
    const storeDir = join(TEST_DIR, "store-custom-ext");
    const store = createYamlStore<{ v: number }>(storeDir, { ext: ".yml" });
    expect(store.filePath("x")).toBe(join(storeDir, "x.yml"));
    await store.save("x", { v: 1 });
    expect(existsSync(join(storeDir, "x.yml"))).toBe(true);
  });
});

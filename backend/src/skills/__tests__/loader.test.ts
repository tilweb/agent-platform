/**
 * Tests for skills/loader.ts
 *
 * Covers:
 *  - loadSkills: loads from custom/ and system/ dirs, caches, handles missing dirs
 *  - getSkillById: returns skill or null
 *  - getEnabledSkills: filters disabled skills
 *  - clearSkillsCache / reloadSkills: cache invalidation and reload
 *  - YAML loading: full skill YAML with all fields (triggers, tools, metadata, knowledge, workflow)
 *  - Markdown loading: frontmatter parsing (name, keywords), instructions without frontmatter
 *  - normalizeTriigers: null, partial, complete trigger objects
 *  - normalizeTools: null, array, object with required/optional
 *  - normalizeAllowedTools: prefers allowed_tools, falls back to legacy tools
 *  - normalizeKnowledge: null, partial, complete knowledge objects
 *  - normalizeMetadata: null and populated metadata
 *  - createSkill: writes YAML to custom/ dir, validates required fields, rejects duplicate IDs
 *  - updateSkill: merges updates, rejects system skill modification, rejects unknown skills
 *  - deleteSkill: removes directory, rejects system skill deletion, rejects unknown skills
 *  - getSkillSummaries: returns summaries, filters by agentSkills/skillMode, generates use_when
 *  - loadSkillKnowledgeFiles: loads files relative to skill path, returns errors for missing files
 *
 * Run this file in isolation for reliable results:
 *   bun test src/skills/__tests__/loader.test.ts
 *
 * When run together with matcher.test.ts via `bun test src/skills/`, bun 1.x shares the
 * mock registry across files. matcher.test.ts partially mocks `../loader` (only getEnabledSkills),
 * causing 9 tests here to fail. This is a known bun 1.x cross-file mock isolation limitation.
 */

import { test, expect, describe, beforeEach, afterEach, mock } from "bun:test";
import { mkdir, writeFile, rm } from "fs/promises";
import { join } from "path";
import { existsSync } from "fs";

// ---------------------------------------------------------------------------
// Set up a temp SKILLS_DIR before importing the module under test.
// mock.module is hoisted by bun:test and runs before any imports.
// ---------------------------------------------------------------------------

const tmpBase = `/tmp/skills-loader-test-${process.pid}`;
const testSkillsDir = join(tmpBase, "skills");

mock.module("../../utils/paths", () => ({
  SKILLS_DIR: testSkillsDir,
}));

import {
  loadSkills,
  getSkillById,
  getEnabledSkills,
  clearSkillsCache,
  reloadSkills,
  createSkill,
  updateSkill,
  deleteSkill,
  getSkillSummaries,
  loadSkillKnowledgeFiles,
} from "../loader";

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

async function createSkillYaml(
  visibility: "custom" | "system",
  skillId: string,
  content: string
): Promise<string> {
  const skillDir = join(testSkillsDir, visibility, skillId);
  await mkdir(skillDir, { recursive: true });
  const yamlPath = join(skillDir, "SKILL.yaml");
  await writeFile(yamlPath, content, "utf-8");
  return yamlPath;
}

async function createSkillMd(
  visibility: "custom" | "system",
  skillId: string,
  content: string
): Promise<string> {
  const skillDir = join(testSkillsDir, visibility, skillId);
  await mkdir(skillDir, { recursive: true });
  const mdPath = join(skillDir, "SKILL.md");
  await writeFile(mdPath, content, "utf-8");
  return mdPath;
}

/**
 * Produces a minimal valid SKILL.yaml string.
 * The extra parameter is appended AFTER all base fields — do not use it to
 * override existing keys (id, name, version, description, instructions).
 */
function minimalYaml(id: string, name: string, extra = ""): string {
  return `id: ${id}\nname: "${name}"\nversion: "1.0"\ndescription: "Beschreibung"\ninstructions: "Tue Dinge"\n${extra}`;
}

// ---------------------------------------------------------------------------
// Lifecycle
// ---------------------------------------------------------------------------

beforeEach(async () => {
  await mkdir(join(testSkillsDir, "custom"), { recursive: true });
  await mkdir(join(testSkillsDir, "system"), { recursive: true });
  clearSkillsCache();
});

afterEach(async () => {
  clearSkillsCache();
  if (existsSync(testSkillsDir)) {
    await rm(testSkillsDir, { recursive: true, force: true });
  }
});

// ---------------------------------------------------------------------------
// loadSkills
// ---------------------------------------------------------------------------

describe("loadSkills", () => {
  test("sollte leere Liste zurückgeben wenn keine Skills-Verzeichnisse existieren", async () => {
    await rm(testSkillsDir, { recursive: true, force: true });
    clearSkillsCache();

    const skills = await loadSkills();

    expect(skills).toEqual([]);
  });

  test("sollte Skills aus custom/ laden", async () => {
    await createSkillYaml("custom", "mein-skill", minimalYaml("mein-skill", "Mein Skill"));

    const skills = await loadSkills();

    expect(skills).toHaveLength(1);
    expect(skills[0].id).toBe("mein-skill");
  });

  test("sollte Skills aus system/ laden", async () => {
    await createSkillYaml("system", "system-skill", minimalYaml("system-skill", "System Skill"));

    const skills = await loadSkills();

    expect(skills).toHaveLength(1);
    expect(skills[0].id).toBe("system-skill");
  });

  test("sollte Skills aus custom/ und system/ kombinieren", async () => {
    await createSkillYaml("custom", "custom-a", minimalYaml("custom-a", "Custom A"));
    await createSkillYaml("system", "system-b", minimalYaml("system-b", "System B"));

    const skills = await loadSkills();

    expect(skills).toHaveLength(2);
    const ids = skills.map(s => s.id);
    expect(ids).toContain("custom-a");
    expect(ids).toContain("system-b");
  });

  test("sollte system-Flag für Skills aus system/ setzen", async () => {
    await createSkillYaml("system", "sys-skill", minimalYaml("sys-skill", "Sys Skill"));

    const skills = await loadSkills();

    expect(skills[0].system).toBe(true);
  });

  test("sollte kein system-Flag für Skills aus custom/ setzen", async () => {
    await createSkillYaml("custom", "custom-skill", minimalYaml("custom-skill", "Custom Skill"));

    const skills = await loadSkills();

    expect(skills[0].system).toBe(false);
  });

  test("sollte das Ergebnis cachen und beim zweiten Aufruf nicht neu laden", async () => {
    await createSkillYaml("custom", "cached-skill", minimalYaml("cached-skill", "Cached Skill"));

    const first = await loadSkills();
    // Neuen Skill hinzufügen — sollte nicht im Cache sichtbar sein
    await createSkillYaml("custom", "neu-skill", minimalYaml("neu-skill", "Neu Skill"));
    const second = await loadSkills();

    expect(second).toBe(first); // Selbe Referenz = Cache
  });

  test("sollte ungültige YAML-Dateien ohne id oder name überspringen", async () => {
    await createSkillYaml("custom", "invalid-skill", "description: Nur Beschreibung");

    const skills = await loadSkills();

    expect(skills).toHaveLength(0);
  });

  test("sollte Markdown-Skills als Fallback laden wenn kein YAML vorhanden", async () => {
    await createSkillMd(
      "custom",
      "md-skill",
      `---\nname: Markdown Skill\nkeywords: [recherche, suche]\n---\n\nHier stehen Anweisungen.`
    );

    const skills = await loadSkills();

    expect(skills).toHaveLength(1);
    expect(skills[0].name).toBe("Markdown Skill");
  });

  test("sollte Nicht-Verzeichnis-Einträge in skills/ überspringen", async () => {
    // Datei direkt im custom/-Verzeichnis (kein Unterordner)
    await writeFile(
      join(testSkillsDir, "custom", "loose-file.yaml"),
      minimalYaml("loose", "Loose"),
      "utf-8"
    );

    const skills = await loadSkills();

    expect(skills).toHaveLength(0);
  });
});

// ---------------------------------------------------------------------------
// getSkillById
// ---------------------------------------------------------------------------

describe("getSkillById", () => {
  test("sollte den korrekten Skill per ID zurückgeben", async () => {
    await createSkillYaml("custom", "find-me", minimalYaml("find-me", "Find Me"));

    const skill = await getSkillById("find-me");

    expect(skill).not.toBeNull();
    expect(skill!.id).toBe("find-me");
    expect(skill!.name).toBe("Find Me");
  });

  test("sollte null zurückgeben wenn die ID nicht existiert", async () => {
    await createSkillYaml("custom", "existing", minimalYaml("existing", "Existing"));

    const skill = await getSkillById("nicht-vorhanden");

    expect(skill).toBeNull();
  });

  test("sollte null zurückgeben wenn keine Skills geladen sind", async () => {
    const skill = await getSkillById("anything");

    expect(skill).toBeNull();
  });
});

// ---------------------------------------------------------------------------
// getEnabledSkills
// ---------------------------------------------------------------------------

describe("getEnabledSkills", () => {
  test("sollte nur aktivierte Skills zurückgeben", async () => {
    await createSkillYaml("custom", "aktiv", minimalYaml("aktiv", "Aktiv", "enabled: true"));
    await createSkillYaml(
      "custom",
      "deaktiviert",
      minimalYaml("deaktiviert", "Deaktiviert", "enabled: false")
    );

    const skills = await getEnabledSkills();

    expect(skills).toHaveLength(1);
    expect(skills[0].id).toBe("aktiv");
  });

  test("sollte Skills ohne enabled-Feld als aktiviert behandeln", async () => {
    await createSkillYaml("custom", "kein-flag", minimalYaml("kein-flag", "Kein Flag"));

    const skills = await getEnabledSkills();

    expect(skills).toHaveLength(1);
  });

  test("sollte leere Liste zurückgeben wenn alle Skills deaktiviert sind", async () => {
    await createSkillYaml(
      "custom",
      "aus1",
      minimalYaml("aus1", "Aus Eins", "enabled: false")
    );
    await createSkillYaml(
      "custom",
      "aus2",
      minimalYaml("aus2", "Aus Zwei", "enabled: false")
    );

    const skills = await getEnabledSkills();

    expect(skills).toHaveLength(0);
  });
});

// ---------------------------------------------------------------------------
// clearSkillsCache / reloadSkills
// ---------------------------------------------------------------------------

describe("clearSkillsCache", () => {
  test("sollte den Cache leeren sodass loadSkills neu lädt", async () => {
    await createSkillYaml("custom", "skill-a", minimalYaml("skill-a", "Skill A"));
    const first = await loadSkills();

    await createSkillYaml("custom", "skill-b", minimalYaml("skill-b", "Skill B"));
    clearSkillsCache();
    const second = await loadSkills();

    expect(first).not.toBe(second);
    expect(second.length).toBeGreaterThan(first.length);
  });
});

describe("reloadSkills", () => {
  test("sollte den Cache leeren und alle Skills neu laden", async () => {
    await createSkillYaml("custom", "skill-x", minimalYaml("skill-x", "Skill X"));
    await loadSkills(); // Erst cachen

    await createSkillYaml("custom", "skill-y", minimalYaml("skill-y", "Skill Y"));
    const skills = await reloadSkills();

    expect(skills).toHaveLength(2);
    const ids = skills.map(s => s.id);
    expect(ids).toContain("skill-x");
    expect(ids).toContain("skill-y");
  });
});

// ---------------------------------------------------------------------------
// YAML-Parsing: vollständige Skill-Struktur
// ---------------------------------------------------------------------------

describe("YAML-Skill-Parsing", () => {
  test("sollte vollständige Trigger-Felder laden", async () => {
    const yaml = `
id: trigger-skill
name: "Trigger Skill"
version: "1.0"
description: "Test"
instructions: "Anweisungen"
triggers:
  keywords: [recherche, analyse]
  patterns: ["\\\\banalys"]
  intent: research
  explicit: true
`;
    await createSkillYaml("custom", "trigger-skill", yaml);

    const skill = await getSkillById("trigger-skill");

    expect(skill!.triggers.keywords).toEqual(["recherche", "analyse"]);
    expect(skill!.triggers.patterns).toEqual(["\\banalys"]);
    expect(skill!.triggers.intent).toBe("research");
    expect(skill!.triggers.explicit).toBe(true);
  });

  test("sollte allowed_tools als Array laden", async () => {
    const yaml = `
id: tools-skill
name: "Tools Skill"
version: "1.0"
description: "Test"
instructions: "Anweisungen"
allowed_tools: [web_search, file_read]
`;
    await createSkillYaml("custom", "tools-skill", yaml);

    const skill = await getSkillById("tools-skill");

    expect(skill!.allowed_tools).toEqual(["web_search", "file_read"]);
  });

  test("sollte metadata-Felder laden", async () => {
    const yaml = `
id: meta-skill
name: "Meta Skill"
version: "1.0"
description: "Test"
instructions: "Anweisungen"
metadata:
  use_when: "Wenn der Nutzer Hilfe braucht"
  estimated_effort: "5-10 Minuten"
  output_type: "Strukturierter Bericht"
`;
    await createSkillYaml("custom", "meta-skill", yaml);

    const skill = await getSkillById("meta-skill");

    expect(skill!.metadata!.use_when).toBe("Wenn der Nutzer Hilfe braucht");
    expect(skill!.metadata!.estimated_effort).toBe("5-10 Minuten");
    expect(skill!.metadata!.output_type).toBe("Strukturierter Bericht");
  });

  test("sollte knowledge-Felder laden", async () => {
    const yaml = `
id: know-skill
name: "Knowledge Skill"
version: "1.0"
description: "Test"
instructions: "Anweisungen"
knowledge:
  files: [methodik.md, kriterien.md]
  collections: [compliance/dsgvo]
  inject_manifests: true
`;
    await createSkillYaml("custom", "know-skill", yaml);

    const skill = await getSkillById("know-skill");

    expect(skill!.knowledge!.files).toEqual(["methodik.md", "kriterien.md"]);
    expect(skill!.knowledge!.collections).toEqual(["compliance/dsgvo"]);
    expect(skill!.knowledge!.inject_manifests).toBe(true);
  });

  test("sollte workflow-Schritte laden", async () => {
    const yaml = `
id: workflow-skill
name: "Workflow Skill"
version: "1.0"
description: "Test"
instructions: "Anweisungen"
workflow:
  steps:
    - id: s1
      action: think
      description: "Problem analysieren"
    - id: s2
      action: tool
      tool: web_search
      description: "Suchen"
`;
    await createSkillYaml("custom", "workflow-skill", yaml);

    const skill = await getSkillById("workflow-skill");

    expect(skill!.workflow!.steps).toHaveLength(2);
    expect(skill!.workflow!.steps[0].id).toBe("s1");
    expect(skill!.workflow!.steps[1].tool).toBe("web_search");
  });

  test("sollte enabled=false korrekt laden", async () => {
    await createSkillYaml(
      "custom",
      "disabled-skill",
      minimalYaml("disabled-skill", "Disabled", "enabled: false")
    );

    const skill = await getSkillById("disabled-skill");

    expect(skill!.enabled).toBe(false);
  });

  test("sollte den Pfad zur YAML-Datei speichern", async () => {
    const path = await createSkillYaml("custom", "path-skill", minimalYaml("path-skill", "Path"));

    const skill = await getSkillById("path-skill");

    expect(skill!.path).toBe(path);
  });
});

// ---------------------------------------------------------------------------
// Markdown-Parsing (Legacy-Format)
// ---------------------------------------------------------------------------

describe("Markdown-Skill-Parsing", () => {
  test("sollte name aus Frontmatter extrahieren", async () => {
    await createSkillMd(
      "custom",
      "md-name",
      `---\nname: Mein MD Skill\n---\n\nAnweisungen hier.`
    );

    const skill = await getSkillById("md-name");

    expect(skill!.name).toBe("Mein MD Skill");
  });

  test("sollte keywords aus Frontmatter als Array extrahieren (Inline-Format)", async () => {
    await createSkillMd(
      "custom",
      "md-kw",
      `---\nname: KW Skill\nkeywords: [recherche, suche, analyse]\n---\n\nAnweisungen.`
    );

    const skill = await getSkillById("md-kw");

    expect(skill!.triggers.keywords).toEqual(["recherche", "suche", "analyse"]);
  });

  test("sollte keywords aus Frontmatter als Liste extrahieren (Block-Format)", async () => {
    await createSkillMd(
      "custom",
      "md-kw-block",
      `---\nname: Block KW Skill\nkeywords:\n  - recherche\n  - analyse\n---\n\nAnweisungen.`
    );

    const skill = await getSkillById("md-kw-block");

    expect(skill!.triggers.keywords).toContain("recherche");
    expect(skill!.triggers.keywords).toContain("analyse");
  });

  test("sollte Frontmatter aus den Anweisungen entfernen", async () => {
    await createSkillMd(
      "custom",
      "md-strip",
      `---\nname: Strip Skill\n---\n\nNur diese Anweisungen bleiben.`
    );

    const skill = await getSkillById("md-strip");

    expect(skill!.instructions).toBe("Nur diese Anweisungen bleiben.");
    expect(skill!.instructions).not.toContain("---");
  });

  test("sollte Markdown-Skill ohne name ignorieren", async () => {
    await createSkillMd(
      "custom",
      "no-name-md",
      `---\nkeywords: [test]\n---\n\nAnweisungen.`
    );

    const skill = await getSkillById("no-name-md");

    expect(skill).toBeNull();
  });

  test("sollte die Skill-ID aus dem Verzeichnisnamen verwenden", async () => {
    await createSkillMd(
      "custom",
      "dir-id-skill",
      `---\nname: Dir ID Skill\n---\n\nAnweisungen.`
    );

    const skill = await getSkillById("dir-id-skill");

    expect(skill!.id).toBe("dir-id-skill");
  });

  test("sollte version auf '1.0' setzen für Legacy-Markdown-Skills", async () => {
    await createSkillMd(
      "custom",
      "legacy-v",
      `---\nname: Legacy Version\n---\n\nAnweisungen.`
    );

    const skill = await getSkillById("legacy-v");

    expect(skill!.version).toBe("1.0");
  });
});

// ---------------------------------------------------------------------------
// normalizeTriigers (via YAML-Parsing)
// ---------------------------------------------------------------------------

describe("normalizeTriigers", () => {
  test("sollte leere Keywords-Liste zurückgeben wenn triggers null ist", async () => {
    await createSkillYaml("custom", "no-triggers", minimalYaml("no-triggers", "No Triggers"));

    const skill = await getSkillById("no-triggers");

    expect(skill!.triggers).toEqual({ keywords: [] });
  });

  test("sollte fehlende keywords auf [] normalisieren", async () => {
    const yaml = `
id: partial-triggers
name: "Partial Triggers"
version: "1.0"
description: "Test"
instructions: "Anweisungen"
triggers:
  intent: research
`;
    await createSkillYaml("custom", "partial-triggers", yaml);

    const skill = await getSkillById("partial-triggers");

    expect(skill!.triggers.keywords).toEqual([]);
    expect(skill!.triggers.intent).toBe("research");
  });

  test("sollte patterns als undefined belassen wenn nicht als Array angegeben", async () => {
    const yaml = `
id: no-patterns
name: "No Patterns"
version: "1.0"
description: "Test"
instructions: "Anweisungen"
triggers:
  keywords: [test]
`;
    await createSkillYaml("custom", "no-patterns", yaml);

    const skill = await getSkillById("no-patterns");

    expect(skill!.triggers.patterns).toBeUndefined();
  });

  test("sollte vollständige Trigger-Struktur erhalten", async () => {
    const yaml = `
id: full-triggers
name: "Full Triggers"
version: "1.0"
description: "Test"
instructions: "Anweisungen"
triggers:
  keywords: [a, b]
  patterns: ["\\\\btest\\\\b"]
  intent: testing
  explicit: false
`;
    await createSkillYaml("custom", "full-triggers", yaml);

    const skill = await getSkillById("full-triggers");

    expect(skill!.triggers.keywords).toEqual(["a", "b"]);
    expect(skill!.triggers.explicit).toBe(false);
  });
});

// ---------------------------------------------------------------------------
// normalizeTools (via YAML-Parsing)
// ---------------------------------------------------------------------------

describe("normalizeTools", () => {
  test("sollte leeres tools-Objekt zurückgeben wenn tools null ist", async () => {
    await createSkillYaml("custom", "no-tools", minimalYaml("no-tools", "No Tools"));

    const skill = await getSkillById("no-tools");

    expect(skill!.tools).toEqual({ required: [], optional: [] });
  });

  test("sollte Array-Format als required-Tools behandeln", async () => {
    const yaml = `
id: array-tools
name: "Array Tools"
version: "1.0"
description: "Test"
instructions: "Anweisungen"
tools: [web_search, file_read]
`;
    await createSkillYaml("custom", "array-tools", yaml);

    const skill = await getSkillById("array-tools");

    expect(skill!.tools.required).toEqual(["web_search", "file_read"]);
    expect(skill!.tools.optional).toEqual([]);
  });

  test("sollte Objekt-Format mit required und optional laden", async () => {
    const yaml = `
id: obj-tools
name: "Obj Tools"
version: "1.0"
description: "Test"
instructions: "Anweisungen"
tools:
  required: [web_search]
  optional: [kb_search]
`;
    await createSkillYaml("custom", "obj-tools", yaml);

    const skill = await getSkillById("obj-tools");

    expect(skill!.tools.required).toEqual(["web_search"]);
    expect(skill!.tools.optional).toEqual(["kb_search"]);
  });
});

// ---------------------------------------------------------------------------
// normalizeAllowedTools (via YAML-Parsing)
// ---------------------------------------------------------------------------

describe("normalizeAllowedTools", () => {
  test("sollte allowed_tools bevorzugen wenn vorhanden", async () => {
    const yaml = `
id: prefer-allowed
name: "Prefer Allowed"
version: "1.0"
description: "Test"
instructions: "Anweisungen"
allowed_tools: [web_search]
tools:
  required: [file_read]
`;
    await createSkillYaml("custom", "prefer-allowed", yaml);

    const skill = await getSkillById("prefer-allowed");

    expect(skill!.allowed_tools).toEqual(["web_search"]);
  });

  test("sollte auf legacy tools zurückfallen wenn allowed_tools fehlt", async () => {
    const yaml = `
id: fallback-tools
name: "Fallback Tools"
version: "1.0"
description: "Test"
instructions: "Anweisungen"
tools:
  required: [web_search]
  optional: [kb_search]
`;
    await createSkillYaml("custom", "fallback-tools", yaml);

    const skill = await getSkillById("fallback-tools");

    expect(skill!.allowed_tools).toContain("web_search");
    expect(skill!.allowed_tools).toContain("kb_search");
  });

  test("sollte undefined zurückgeben wenn weder allowed_tools noch legacy tools gesetzt sind", async () => {
    await createSkillYaml("custom", "no-allowed", minimalYaml("no-allowed", "No Allowed"));

    const skill = await getSkillById("no-allowed");

    expect(skill!.allowed_tools).toBeUndefined();
  });

  test("sollte Duplikate in allowed_tools deduplizieren", async () => {
    const yaml = `
id: dedup-tools
name: "Dedup Tools"
version: "1.0"
description: "Test"
instructions: "Anweisungen"
tools:
  required: [web_search, kb_search]
  optional: [web_search]
`;
    await createSkillYaml("custom", "dedup-tools", yaml);

    const skill = await getSkillById("dedup-tools");
    const tools = skill!.allowed_tools!;

    const webSearchCount = tools.filter(t => t === "web_search").length;
    expect(webSearchCount).toBe(1);
  });
});

// ---------------------------------------------------------------------------
// normalizeKnowledge (via YAML-Parsing)
// ---------------------------------------------------------------------------

describe("normalizeKnowledge", () => {
  test("sollte undefined zurückgeben wenn knowledge null ist", async () => {
    await createSkillYaml("custom", "no-know", minimalYaml("no-know", "No Knowledge"));

    const skill = await getSkillById("no-know");

    expect(skill!.knowledge).toBeUndefined();
  });

  test("sollte files als undefined behandeln wenn kein Array angegeben", async () => {
    const yaml = `
id: partial-know
name: "Partial Knowledge"
version: "1.0"
description: "Test"
instructions: "Anweisungen"
knowledge:
  collections: [my-collection]
`;
    await createSkillYaml("custom", "partial-know", yaml);

    const skill = await getSkillById("partial-know");

    expect(skill!.knowledge!.files).toBeUndefined();
    expect(skill!.knowledge!.collections).toEqual(["my-collection"]);
  });

  test("sollte vollständige Knowledge-Struktur laden", async () => {
    const yaml = `
id: full-know
name: "Full Knowledge"
version: "1.0"
description: "Test"
instructions: "Anweisungen"
knowledge:
  files: [a.md, b.md]
  collections: [col-a]
  inject_manifests: true
`;
    await createSkillYaml("custom", "full-know", yaml);

    const skill = await getSkillById("full-know");

    expect(skill!.knowledge!.files).toEqual(["a.md", "b.md"]);
    expect(skill!.knowledge!.inject_manifests).toBe(true);
  });
});

// ---------------------------------------------------------------------------
// normalizeMetadata (via YAML-Parsing)
// ---------------------------------------------------------------------------

describe("normalizeMetadata", () => {
  test("sollte undefined zurückgeben wenn metadata nicht gesetzt ist", async () => {
    await createSkillYaml("custom", "no-meta", minimalYaml("no-meta", "No Meta"));

    const skill = await getSkillById("no-meta");

    expect(skill!.metadata).toBeUndefined();
  });

  test("sollte nur string-Felder in metadata übernehmen", async () => {
    const yaml = `
id: meta-types
name: "Meta Types"
version: "1.0"
description: "Test"
instructions: "Anweisungen"
metadata:
  use_when: "Bei Bedarf"
  estimated_effort: 42
  output_type: "Bericht"
`;
    await createSkillYaml("custom", "meta-types", yaml);

    const skill = await getSkillById("meta-types");

    expect(skill!.metadata!.use_when).toBe("Bei Bedarf");
    // estimated_effort ist eine Zahl — soll als undefined normalisiert werden
    expect(skill!.metadata!.estimated_effort).toBeUndefined();
    expect(skill!.metadata!.output_type).toBe("Bericht");
  });
});

// ---------------------------------------------------------------------------
// createSkill
// ---------------------------------------------------------------------------

describe("createSkill", () => {
  test("sollte einen neuen Skill im custom/-Verzeichnis erstellen", async () => {
    const skill = await createSkill({
      id: "neuer-skill",
      name: "Neuer Skill",
      version: "1.0",
      description: "Eine Beschreibung",
      instructions: "Tue etwas",
      triggers: { keywords: [] },
      tools: { required: [], optional: [] },
      enabled: true,
    });

    expect(skill.id).toBe("neuer-skill");
    expect(skill.name).toBe("Neuer Skill");

    const yamlPath = join(testSkillsDir, "custom", "neuer-skill", "SKILL.yaml");
    expect(existsSync(yamlPath)).toBe(true);
  });

  test("sollte Fehler werfen wenn id fehlt", async () => {
    expect(
      createSkill({
        id: "",
        name: "Ohne ID",
        version: "1.0",
        description: "",
        instructions: "",
        triggers: { keywords: [] },
        tools: { required: [], optional: [] },
      })
    ).rejects.toThrow();
  });

  test("sollte Fehler werfen wenn name fehlt", async () => {
    expect(
      createSkill({
        id: "ohne-name",
        name: "",
        version: "1.0",
        description: "",
        instructions: "",
        triggers: { keywords: [] },
        tools: { required: [], optional: [] },
      })
    ).rejects.toThrow();
  });

  test("sollte Fehler werfen wenn ein Skill mit dieser ID bereits existiert", async () => {
    await createSkillYaml("custom", "duplikat", minimalYaml("duplikat", "Original"));

    expect(
      createSkill({
        id: "duplikat",
        name: "Duplikat",
        version: "1.0",
        description: "",
        instructions: "",
        triggers: { keywords: [] },
        tools: { required: [], optional: [] },
      })
    ).rejects.toThrow(/already exists/i);
  });

  test("sollte den erstellten Skill mit dem korrekten Pfad zurückgeben", async () => {
    const skill = await createSkill({
      id: "path-check",
      name: "Path Check",
      version: "1.0",
      description: "",
      instructions: "",
      triggers: { keywords: [] },
      tools: { required: [], optional: [] },
    });

    expect(skill.path).toContain("path-check");
    expect(skill.path).toContain("SKILL.yaml");
  });

  test("sollte den Cache nach dem Erstellen leeren", async () => {
    await loadSkills(); // Cache befüllen

    await createSkill({
      id: "cache-clear",
      name: "Cache Clear",
      version: "1.0",
      description: "",
      instructions: "",
      triggers: { keywords: [] },
      tools: { required: [], optional: [] },
    });

    clearSkillsCache(); // Manuell leeren um sicherzugehen
    const skills = await loadSkills();
    const ids = skills.map(s => s.id);
    expect(ids).toContain("cache-clear");
  });
});

// ---------------------------------------------------------------------------
// updateSkill
// ---------------------------------------------------------------------------

describe("updateSkill", () => {
  test("sollte einen bestehenden Custom-Skill aktualisieren", async () => {
    await createSkillYaml("custom", "zu-updaten", minimalYaml("zu-updaten", "Alt"));

    const updated = await updateSkill("zu-updaten", { name: "Neu" });

    expect(updated.name).toBe("Neu");
    expect(updated.id).toBe("zu-updaten"); // ID unveränderlich
  });

  test("sollte Fehler werfen wenn der Skill nicht existiert", async () => {
    expect(updateSkill("nicht-vorhanden", { name: "X" })).rejects.toThrow(/not found/i);
  });

  test("sollte System-Skills nicht änderbar machen", async () => {
    await createSkillYaml("system", "sys-update", minimalYaml("sys-update", "System"));

    expect(updateSkill("sys-update", { name: "Geändert" })).rejects.toThrow(
      /system skills cannot be modified/i
    );
  });

  test("sollte die Skill-ID nicht überschreiben", async () => {
    await createSkillYaml("custom", "fixed-id", minimalYaml("fixed-id", "Original"));

    const updated = await updateSkill("fixed-id", { id: "neue-id", name: "Updated" } as any);

    expect(updated.id).toBe("fixed-id");
  });

  test("sollte existierende Felder erhalten wenn sie nicht im Update enthalten sind", async () => {
    // Use a standalone YAML string to avoid duplicate keys from minimalYaml + extra
    const yaml = `id: partial-update
name: "Partial"
version: "1.0"
description: "Wichtige Beschreibung"
instructions: "Tue Dinge"
`;
    await createSkillYaml("custom", "partial-update", yaml);

    const updated = await updateSkill("partial-update", { name: "Aktualisiert" });

    expect(updated.description).toBe("Wichtige Beschreibung");
  });

  test("sollte die YAML-Datei nach dem Update schreiben", async () => {
    await createSkillYaml("custom", "write-check", minimalYaml("write-check", "Original"));

    await updateSkill("write-check", { name: "Geschrieben" });

    clearSkillsCache();
    const skill = await getSkillById("write-check");
    expect(skill!.name).toBe("Geschrieben");
  });
});

// ---------------------------------------------------------------------------
// deleteSkill
// ---------------------------------------------------------------------------

describe("deleteSkill", () => {
  test("sollte das Verzeichnis eines Custom-Skills löschen", async () => {
    await createSkillYaml("custom", "zu-loeschen", minimalYaml("zu-loeschen", "Löschen"));
    const skillDir = join(testSkillsDir, "custom", "zu-loeschen");

    await deleteSkill("zu-loeschen");

    expect(existsSync(skillDir)).toBe(false);
  });

  test("sollte Fehler werfen wenn der Skill nicht existiert", async () => {
    expect(deleteSkill("nicht-vorhanden")).rejects.toThrow(/not found/i);
  });

  test("sollte System-Skills nicht löschbar machen", async () => {
    await createSkillYaml("system", "sys-delete", minimalYaml("sys-delete", "System"));

    expect(deleteSkill("sys-delete")).rejects.toThrow(/system skills cannot be deleted/i);
  });

  test("sollte den Cache nach dem Löschen leeren", async () => {
    await createSkillYaml("custom", "cache-del", minimalYaml("cache-del", "Cache Del"));
    await loadSkills(); // Befüllen

    await deleteSkill("cache-del");

    const skill = await getSkillById("cache-del");
    expect(skill).toBeNull();
  });
});

// ---------------------------------------------------------------------------
// getSkillSummaries
// ---------------------------------------------------------------------------

describe("getSkillSummaries", () => {
  test("sollte Zusammenfassungen aller aktivierten Skills zurückgeben", async () => {
    await createSkillYaml("custom", "sum-a", minimalYaml("sum-a", "Summary A"));
    await createSkillYaml("custom", "sum-b", minimalYaml("sum-b", "Summary B"));

    const summaries = await getSkillSummaries();

    expect(summaries).toHaveLength(2);
    const ids = summaries.map(s => s.id);
    expect(ids).toContain("sum-a");
    expect(ids).toContain("sum-b");
  });

  test("sollte deaktivierte Skills aus den Zusammenfassungen ausschließen", async () => {
    await createSkillYaml("custom", "aktiv-sum", minimalYaml("aktiv-sum", "Aktiv"));
    await createSkillYaml(
      "custom",
      "inaktiv-sum",
      minimalYaml("inaktiv-sum", "Inaktiv", "enabled: false")
    );

    const summaries = await getSkillSummaries();

    expect(summaries).toHaveLength(1);
    expect(summaries[0].id).toBe("aktiv-sum");
  });

  test("sollte mit skillMode 'allow' nur angegebene Skills einschließen", async () => {
    await createSkillYaml("custom", "erlaubt", minimalYaml("erlaubt", "Erlaubt"));
    await createSkillYaml("custom", "gesperrt", minimalYaml("gesperrt", "Gesperrt"));

    const summaries = await getSkillSummaries({ skillMode: "allow", agentSkills: ["erlaubt"] });

    expect(summaries).toHaveLength(1);
    expect(summaries[0].id).toBe("erlaubt");
  });

  test("sollte mit skillMode 'allow' und leerer agentSkills-Liste leere Zusammenfassung liefern", async () => {
    await createSkillYaml("custom", "sk1", minimalYaml("sk1", "SK1"));

    const summaries = await getSkillSummaries({ skillMode: "allow", agentSkills: [] });

    expect(summaries).toHaveLength(0);
  });

  test("sollte mit skillMode 'all' alle Skills einschließen", async () => {
    await createSkillYaml("custom", "all-a", minimalYaml("all-a", "All A"));
    await createSkillYaml("custom", "all-b", minimalYaml("all-b", "All B"));

    const summaries = await getSkillSummaries({ skillMode: "all" });

    expect(summaries).toHaveLength(2);
  });

  test("sollte use_when aus metadata.use_when bevorzugen", async () => {
    const yaml = `
id: use-when-meta
name: "Use When Meta"
version: "1.0"
description: "Test"
instructions: "Anweisungen"
metadata:
  use_when: "Wenn Zusammenfassung benötigt wird"
triggers:
  keywords: [zusammenfassung]
`;
    await createSkillYaml("custom", "use-when-meta", yaml);

    const summaries = await getSkillSummaries();

    const summary = summaries.find(s => s.id === "use-when-meta")!;
    expect(summary.use_when).toBe("Wenn Zusammenfassung benötigt wird");
  });

  test("sollte use_when aus triggers.keywords generieren wenn metadata.use_when fehlt", async () => {
    const yaml = `
id: use-when-kw
name: "Use When KW"
version: "1.0"
description: "Test"
instructions: "Anweisungen"
triggers:
  keywords: [recherche, analyse]
`;
    await createSkillYaml("custom", "use-when-kw", yaml);

    const summaries = await getSkillSummaries();

    const summary = summaries.find(s => s.id === "use-when-kw")!;
    expect(summary.use_when).toContain("recherche");
  });

  test("sollte output_type aus metadata.output_type übernehmen", async () => {
    const yaml = `
id: output-type
name: "Output Type"
version: "1.0"
description: "Test"
instructions: "Anweisungen"
metadata:
  output_type: "Strukturierter Bericht"
`;
    await createSkillYaml("custom", "output-type", yaml);

    const summaries = await getSkillSummaries();

    const summary = summaries.find(s => s.id === "output-type")!;
    expect(summary.output_type).toBe("Strukturierter Bericht");
  });

  test("sollte die korrekten Summary-Felder zurückgeben", async () => {
    await createSkillYaml("custom", "fields-check", minimalYaml("fields-check", "Fields Check"));

    const summaries = await getSkillSummaries();
    const summary = summaries[0];

    expect(summary).toHaveProperty("id");
    expect(summary).toHaveProperty("name");
    expect(summary).toHaveProperty("description");
  });
});

// ---------------------------------------------------------------------------
// loadSkillKnowledgeFiles
// ---------------------------------------------------------------------------

describe("loadSkillKnowledgeFiles", () => {
  test("sollte Wissens-Dateien relativ zum Skill-Verzeichnis laden", async () => {
    const yamlPath = await createSkillYaml(
      "custom",
      "wissen-skill",
      minimalYaml("wissen-skill", "Wissen")
    );
    const skillDir = join(testSkillsDir, "custom", "wissen-skill");
    await writeFile(join(skillDir, "methodik.md"), "# Methodik\nDetails hier.", "utf-8");

    const skill = {
      id: "wissen-skill",
      name: "Wissen",
      version: "1.0",
      description: "",
      instructions: "",
      triggers: { keywords: [] },
      tools: { required: [], optional: [] },
      knowledge: { files: ["methodik.md"] },
      path: yamlPath,
    };

    const result = await loadSkillKnowledgeFiles(skill);

    expect(result.files).toHaveLength(1);
    expect(result.files[0].path).toBe("methodik.md");
    expect(result.files[0].content).toContain("Methodik");
    expect(result.errors).toHaveLength(0);
  });

  test("sollte Fehler für fehlende Wissens-Dateien sammeln", async () => {
    const yamlPath = await createSkillYaml(
      "custom",
      "missing-files",
      minimalYaml("missing-files", "Missing Files")
    );

    const skill = {
      id: "missing-files",
      name: "Missing Files",
      version: "1.0",
      description: "",
      instructions: "",
      triggers: { keywords: [] },
      tools: { required: [], optional: [] },
      knowledge: { files: ["nicht-vorhanden.md"] },
      path: yamlPath,
    };

    const result = await loadSkillKnowledgeFiles(skill);

    expect(result.files).toHaveLength(0);
    expect(result.errors).toHaveLength(1);
    expect(result.errors[0]).toContain("nicht-vorhanden.md");
  });

  test("sollte leere Listen zurückgeben wenn knowledge nicht definiert ist", async () => {
    const skill = {
      id: "no-knowledge",
      name: "No Knowledge",
      version: "1.0",
      description: "",
      instructions: "",
      triggers: { keywords: [] },
      tools: { required: [], optional: [] },
      path: "/tmp/some/SKILL.yaml",
    };

    const result = await loadSkillKnowledgeFiles(skill);

    expect(result.files).toHaveLength(0);
    expect(result.errors).toHaveLength(0);
  });

  test("sollte leere Listen zurückgeben wenn path nicht gesetzt ist", async () => {
    const skill = {
      id: "no-path",
      name: "No Path",
      version: "1.0",
      description: "",
      instructions: "",
      triggers: { keywords: [] },
      tools: { required: [], optional: [] },
      knowledge: { files: ["methodik.md"] },
    };

    const result = await loadSkillKnowledgeFiles(skill);

    expect(result.files).toHaveLength(0);
    expect(result.errors).toHaveLength(0);
  });

  test("sollte mehrere Wissens-Dateien laden", async () => {
    const yamlPath = await createSkillYaml(
      "custom",
      "multi-know",
      minimalYaml("multi-know", "Multi Know")
    );
    const skillDir = join(testSkillsDir, "custom", "multi-know");
    await writeFile(join(skillDir, "datei-a.md"), "Inhalt A", "utf-8");
    await writeFile(join(skillDir, "datei-b.md"), "Inhalt B", "utf-8");

    const skill = {
      id: "multi-know",
      name: "Multi Know",
      version: "1.0",
      description: "",
      instructions: "",
      triggers: { keywords: [] },
      tools: { required: [], optional: [] },
      knowledge: { files: ["datei-a.md", "datei-b.md"] },
      path: yamlPath,
    };

    const result = await loadSkillKnowledgeFiles(skill);

    expect(result.files).toHaveLength(2);
    const paths = result.files.map(f => f.path);
    expect(paths).toContain("datei-a.md");
    expect(paths).toContain("datei-b.md");
  });

  test("sollte vorhandene Dateien laden und fehlende als Fehler melden", async () => {
    const yamlPath = await createSkillYaml(
      "custom",
      "mixed-know",
      minimalYaml("mixed-know", "Mixed Know")
    );
    const skillDir = join(testSkillsDir, "custom", "mixed-know");
    await writeFile(join(skillDir, "vorhanden.md"), "Vorhanden", "utf-8");

    const skill = {
      id: "mixed-know",
      name: "Mixed Know",
      version: "1.0",
      description: "",
      instructions: "",
      triggers: { keywords: [] },
      tools: { required: [], optional: [] },
      knowledge: { files: ["vorhanden.md", "fehlt.md"] },
      path: yamlPath,
    };

    const result = await loadSkillKnowledgeFiles(skill);

    expect(result.files).toHaveLength(1);
    expect(result.files[0].path).toBe("vorhanden.md");
    expect(result.errors).toHaveLength(1);
    expect(result.errors[0]).toContain("fehlt.md");
  });
});

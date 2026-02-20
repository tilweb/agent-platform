/**
 * Tests for skills/matcher.ts
 *
 * Covers:
 *  - matchSkills: explicit command, keyword, pattern, no match, sort order,
 *                 explicit-only skills, multiple matches, filterOptions
 *  - matchBestSkill: highest confidence, null when no match
 *  - skillMatchesMessage: boolean result
 *  - calculateKeywordConfidence (indirectly): short, long, multi-word keywords
 *  - matchKeywords word-boundary behaviour
 */

import { test, expect, describe, beforeEach, mock } from "bun:test";

// ---------------------------------------------------------------------------
// Mock the loader so tests don't touch the filesystem
// ---------------------------------------------------------------------------

const testSkills: any[] = [];

mock.module("../loader", () => ({
  getEnabledSkills: async () => [...testSkills],
}));

import {
  matchSkills,
  matchBestSkill,
  skillMatchesMessage,
} from "../matcher";

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function makeSkill(overrides: any = {}): any {
  return {
    id: overrides.id ?? "test-skill",
    name: overrides.name ?? "Test Skill",
    version: "1.0",
    description: "A test skill",
    triggers: {
      keywords: [],
      patterns: [],
      ...overrides.triggers,
    },
    tools: { required: [], optional: [] },
    instructions: "Test instructions",
    enabled: true,
    ...overrides,
  };
}

// Reset shared skill list before every test
beforeEach(() => {
  testSkills.length = 0;
});

// ---------------------------------------------------------------------------
// matchSkills — explicit command
// ---------------------------------------------------------------------------

describe("matchSkills", () => {
  describe("Expliziter Befehl (/skill-id)", () => {
    test("sollte bei /skill-id ein Match mit confidence 1.0 und matchedBy 'explicit' zurückgeben", async () => {
      testSkills.push(makeSkill({ id: "recherche" }));

      const matches = await matchSkills("/recherche Bitte hilf mir.");

      expect(matches).toHaveLength(1);
      expect(matches[0].confidence).toBe(1.0);
      expect(matches[0].matchedBy).toBe("explicit");
      expect(matches[0].matchedTrigger).toBe("/recherche");
    });

    test("sollte den expliziten Befehl case-insensitiv erkennen", async () => {
      testSkills.push(makeSkill({ id: "recherche" }));

      const matches = await matchSkills("/RECHERCHE Aufgabe");

      expect(matches).toHaveLength(1);
      expect(matches[0].matchedBy).toBe("explicit");
    });

    test("sollte mehrere führende Slashes tolerieren", async () => {
      testSkills.push(makeSkill({ id: "recherche" }));

      const matches = await matchSkills("///recherche Aufgabe");

      expect(matches).toHaveLength(1);
      expect(matches[0].matchedBy).toBe("explicit");
    });

    test("sollte das richtige skill-Objekt im Match-Ergebnis enthalten", async () => {
      const skill = makeSkill({ id: "code-review", name: "Code Review" });
      testSkills.push(skill);

      const matches = await matchSkills("/code-review Prüfe meinen Code");

      expect(matches[0].skill.id).toBe("code-review");
      expect(matches[0].skill.name).toBe("Code Review");
    });
  });

  // ---------------------------------------------------------------------------
  // matchSkills — keyword matching
  // ---------------------------------------------------------------------------

  describe("Keyword-Matching", () => {
    test("sollte bei einem Keyword-Treffer matchedBy 'keyword' zurückgeben", async () => {
      testSkills.push(makeSkill({ id: "search-skill", triggers: { keywords: ["web search"] } }));

      const matches = await matchSkills("Please do a web search for me.");

      expect(matches).toHaveLength(1);
      expect(matches[0].matchedBy).toBe("keyword");
      expect(matches[0].matchedTrigger).toBe("web search");
    });

    test("sollte confidence zwischen 0.7 und 0.95 für Keyword-Matches liefern", async () => {
      testSkills.push(makeSkill({ id: "s1", triggers: { keywords: ["search"] } }));

      const matches = await matchSkills("Please search for something.");

      expect(matches[0].confidence).toBeGreaterThanOrEqual(0.7);
      expect(matches[0].confidence).toBeLessThanOrEqual(0.95);
    });

    test("sollte case-insensitiv nach Keywords suchen", async () => {
      testSkills.push(makeSkill({ id: "s1", triggers: { keywords: ["Recherche"] } }));

      // Use "Recherche" as a standalone word (not embedded in "recherchiere")
      const matches = await matchSkills("Bitte starte die Recherche.");

      expect(matches).toHaveLength(1);
      expect(matches[0].matchedBy).toBe("keyword");
    });

    test("sollte kein Match zurückgeben wenn kein Keyword passt", async () => {
      testSkills.push(makeSkill({ id: "s1", triggers: { keywords: ["image generation"] } }));

      const matches = await matchSkills("Ich brauche Hilfe bei der Suche.");

      expect(matches).toHaveLength(0);
    });

    test("sollte kein Match zurückgeben wenn die Keyword-Liste leer ist", async () => {
      testSkills.push(makeSkill({ id: "s1", triggers: { keywords: [] } }));

      const matches = await matchSkills("anything at all");

      expect(matches).toHaveLength(0);
    });
  });

  // ---------------------------------------------------------------------------
  // matchSkills — pattern matching
  // ---------------------------------------------------------------------------

  describe("Pattern-Matching", () => {
    test("sollte bei einem Regex-Pattern-Treffer matchedBy 'pattern' zurückgeben", async () => {
      testSkills.push(
        makeSkill({ id: "s1", triggers: { patterns: ["generate.*image"] } })
      );

      const matches = await matchSkills("Please generate a large image for me.");

      expect(matches).toHaveLength(1);
      expect(matches[0].matchedBy).toBe("pattern");
      expect(matches[0].confidence).toBe(0.9);
    });

    test("sollte Pattern-Treffer mit confidence 0.9 zurückgeben", async () => {
      testSkills.push(
        makeSkill({ id: "s1", triggers: { patterns: ["\\d{4}-\\d{2}-\\d{2}"] } })
      );

      const matches = await matchSkills("Zeige mir Daten vom 2024-01-15.");

      expect(matches[0].confidence).toBe(0.9);
    });

    test("sollte keinen Match liefern wenn kein Pattern passt", async () => {
      testSkills.push(
        makeSkill({ id: "s1", triggers: { patterns: ["^create image"] } })
      );

      const matches = await matchSkills("Do something completely different.");

      expect(matches).toHaveLength(0);
    });

    test("sollte ungültige Regex-Patterns ohne Absturz ignorieren", async () => {
      testSkills.push(
        makeSkill({ id: "s1", triggers: { patterns: ["[invalid(regex"] } })
      );

      const matches = await matchSkills("any message");

      expect(matches).toHaveLength(0);
    });

    test("sollte Patterns case-insensitiv auswerten", async () => {
      testSkills.push(
        makeSkill({ id: "s1", triggers: { patterns: ["generate image"] } })
      );

      const matches = await matchSkills("GENERATE IMAGE please");

      expect(matches).toHaveLength(1);
      expect(matches[0].matchedBy).toBe("pattern");
    });
  });

  // ---------------------------------------------------------------------------
  // matchSkills — no match
  // ---------------------------------------------------------------------------

  describe("Kein Match", () => {
    test("sollte ein leeres Array zurückgeben wenn keine Skills registriert sind", async () => {
      const matches = await matchSkills("Hallo Welt");

      expect(matches).toHaveLength(0);
    });

    test("sollte ein leeres Array zurückgeben wenn kein Skill zur Nachricht passt", async () => {
      testSkills.push(makeSkill({ id: "s1", triggers: { keywords: ["generate image"] } }));

      const matches = await matchSkills("Bitte hilf mir bei etwas anderem.");

      expect(matches).toHaveLength(0);
    });
  });

  // ---------------------------------------------------------------------------
  // matchSkills — sort order
  // ---------------------------------------------------------------------------

  describe("Sortierung nach Confidence", () => {
    test("sollte Ergebnisse absteigend nach Confidence sortieren", async () => {
      // skill-a: pattern match → 0.9
      // skill-b: short keyword match → 0.7
      testSkills.push(
        makeSkill({ id: "skill-a", triggers: { patterns: ["web search"] } }),
        makeSkill({ id: "skill-b", triggers: { keywords: ["web"] } })
      );

      const matches = await matchSkills("web search for something");

      expect(matches.length).toBeGreaterThanOrEqual(2);
      for (let i = 1; i < matches.length; i++) {
        expect(matches[i - 1].confidence).toBeGreaterThanOrEqual(matches[i].confidence);
      }
    });

    test("sollte explizite Matches (confidence 1.0) immer an erster Stelle stehen", async () => {
      testSkills.push(
        makeSkill({ id: "keyword-skill", triggers: { keywords: ["web search"] } }),
        makeSkill({ id: "explicit-skill" })
      );

      const matches = await matchSkills("/explicit-skill do a web search");

      expect(matches[0].matchedBy).toBe("explicit");
      expect(matches[0].confidence).toBe(1.0);
    });
  });

  // ---------------------------------------------------------------------------
  // matchSkills — explicit-only skills
  // ---------------------------------------------------------------------------

  describe("Explicit-only Skills (triggers.explicit = true)", () => {
    test("sollte einen explicit-only Skill nur bei /skill-id Befehl matchen", async () => {
      testSkills.push(
        makeSkill({
          id: "secret",
          triggers: { keywords: ["secret"], explicit: true },
        })
      );

      const matchesWithoutCommand = await matchSkills("I have a secret message.");
      expect(matchesWithoutCommand).toHaveLength(0);

      const matchesWithCommand = await matchSkills("/secret do it");
      expect(matchesWithCommand).toHaveLength(1);
      expect(matchesWithCommand[0].matchedBy).toBe("explicit");
    });

    test("sollte expliziten Skill nicht über Keywords erreichbar machen", async () => {
      testSkills.push(
        makeSkill({
          id: "admin",
          triggers: { keywords: ["admin", "administration"], explicit: true },
        })
      );

      const matches = await matchSkills("Run the admin task please.");

      expect(matches).toHaveLength(0);
    });

    test("sollte expliziten Skill nicht über Patterns erreichbar machen", async () => {
      testSkills.push(
        makeSkill({
          id: "admin",
          triggers: { patterns: ["admin.*task"], explicit: true },
        })
      );

      const matches = await matchSkills("Run the admin task please.");

      expect(matches).toHaveLength(0);
    });
  });

  // ---------------------------------------------------------------------------
  // matchSkills — multiple skills match same message
  // ---------------------------------------------------------------------------

  describe("Mehrere Skills matchen dieselbe Nachricht", () => {
    test("sollte mehrere Matches zurückgeben wenn verschiedene Skills passen", async () => {
      testSkills.push(
        makeSkill({ id: "skill-a", triggers: { keywords: ["search"] } }),
        makeSkill({ id: "skill-b", triggers: { keywords: ["web"] } })
      );

      const matches = await matchSkills("Please do a web search.");

      expect(matches.length).toBe(2);
      const ids = matches.map(m => m.skill.id);
      expect(ids).toContain("skill-a");
      expect(ids).toContain("skill-b");
    });
  });

  // ---------------------------------------------------------------------------
  // matchSkills — filterOptions
  // ---------------------------------------------------------------------------

  describe("filterOptions", () => {
    test("sollte mit skillMode 'all' alle Skills berücksichtigen", async () => {
      testSkills.push(
        makeSkill({ id: "skill-a", triggers: { keywords: ["search"] } }),
        makeSkill({ id: "skill-b", triggers: { keywords: ["search"] } })
      );

      const matches = await matchSkills("please search now", { skillMode: "all" });

      expect(matches.length).toBe(2);
    });

    test("sollte ohne filterOptions alle Skills berücksichtigen", async () => {
      testSkills.push(
        makeSkill({ id: "skill-a", triggers: { keywords: ["search"] } }),
        makeSkill({ id: "skill-b", triggers: { keywords: ["search"] } })
      );

      const matches = await matchSkills("please search now");

      expect(matches.length).toBe(2);
    });

    test("sollte mit skillMode 'allow' nur gelistete Skills berücksichtigen", async () => {
      testSkills.push(
        makeSkill({ id: "skill-a", triggers: { keywords: ["search"] } }),
        makeSkill({ id: "skill-b", triggers: { keywords: ["search"] } })
      );

      const matches = await matchSkills("please search now", {
        skillMode: "allow",
        agentSkills: ["skill-a"],
      });

      expect(matches.length).toBe(1);
      expect(matches[0].skill.id).toBe("skill-a");
    });

    test("sollte mit skillMode 'allow' und leerer agentSkills-Liste keine Matches liefern", async () => {
      testSkills.push(makeSkill({ id: "skill-a", triggers: { keywords: ["search"] } }));

      const matches = await matchSkills("please search now", {
        skillMode: "allow",
        agentSkills: [],
      });

      expect(matches).toHaveLength(0);
    });

    test("sollte mit skillMode 'allow' und undefined agentSkills keine Matches liefern", async () => {
      testSkills.push(makeSkill({ id: "skill-a", triggers: { keywords: ["search"] } }));

      const matches = await matchSkills("please search now", {
        skillMode: "allow",
      });

      expect(matches).toHaveLength(0);
    });

    test("sollte mit skillMode 'allow' explizite Befehle auf erlaubte Skills einschränken", async () => {
      testSkills.push(
        makeSkill({ id: "skill-a" }),
        makeSkill({ id: "skill-b" })
      );

      const matches = await matchSkills("/skill-b do it", {
        skillMode: "allow",
        agentSkills: ["skill-a"],
      });

      expect(matches).toHaveLength(0);
    });
  });
});

// ---------------------------------------------------------------------------
// matchBestSkill
// ---------------------------------------------------------------------------

describe("matchBestSkill", () => {
  test("sollte das Match mit der höchsten Confidence zurückgeben", async () => {
    // skill-a: short keyword → 0.7
    // skill-b: pattern → 0.9
    testSkills.push(
      makeSkill({ id: "skill-a", triggers: { keywords: ["search"] } }),
      makeSkill({ id: "skill-b", triggers: { patterns: ["web search"] } })
    );

    const best = await matchBestSkill("Please do a web search.");

    expect(best).not.toBeNull();
    expect(best!.skill.id).toBe("skill-b");
    expect(best!.confidence).toBe(0.9);
  });

  test("sollte null zurückgeben wenn kein Skill passt", async () => {
    testSkills.push(makeSkill({ id: "s1", triggers: { keywords: ["image"] } }));

    const best = await matchBestSkill("Something completely unrelated.");

    expect(best).toBeNull();
  });

  test("sollte null zurückgeben wenn keine Skills registriert sind", async () => {
    const best = await matchBestSkill("Any message");

    expect(best).toBeNull();
  });

  test("sollte bei mehreren Matches den expliziten Befehl bevorzugen", async () => {
    testSkills.push(
      makeSkill({ id: "skill-a", triggers: { keywords: ["search"] } }),
      makeSkill({ id: "skill-b" })
    );

    const best = await matchBestSkill("/skill-b do a search please");

    expect(best!.skill.id).toBe("skill-b");
    expect(best!.confidence).toBe(1.0);
  });
});

// ---------------------------------------------------------------------------
// skillMatchesMessage
// ---------------------------------------------------------------------------

describe("skillMatchesMessage", () => {
  test("sollte true zurückgeben wenn der Skill zur Nachricht passt", async () => {
    testSkills.push(makeSkill({ id: "search-skill", triggers: { keywords: ["search"] } }));

    // "search" is a standalone word here, word-boundary matches correctly
    const result = await skillMatchesMessage("search-skill", "Please search the web.");

    expect(result).toBe(true);
  });

  test("sollte false zurückgeben wenn der Skill nicht passt", async () => {
    testSkills.push(makeSkill({ id: "search-skill", triggers: { keywords: ["search"] } }));

    const result = await skillMatchesMessage("search-skill", "Erstelle ein Bild.");

    expect(result).toBe(false);
  });

  test("sollte false zurückgeben wenn die skillId nicht existiert", async () => {
    testSkills.push(makeSkill({ id: "search-skill", triggers: { keywords: ["search"] } }));

    const result = await skillMatchesMessage("nonexistent-skill", "please search now");

    expect(result).toBe(false);
  });

  test("sollte true zurückgeben wenn der Skill über expliziten Befehl angesprochen wird", async () => {
    testSkills.push(makeSkill({ id: "code-review" }));

    const result = await skillMatchesMessage("code-review", "/code-review Prüfe meinen Code");

    expect(result).toBe(true);
  });
});

// ---------------------------------------------------------------------------
// calculateKeywordConfidence (indirekt über matchSkills)
// ---------------------------------------------------------------------------

describe("calculateKeywordConfidence (indirekt)", () => {
  test("kurzes Keyword (<=10 Zeichen) sollte Basis-Confidence 0.7 haben", async () => {
    // "search" is 6 characters → base 0.7, no bonus
    testSkills.push(makeSkill({ id: "s1", triggers: { keywords: ["search"] } }));

    const matches = await matchSkills("please search now");

    expect(matches[0].confidence).toBe(0.7);
  });

  test("langes Keyword (>10 Zeichen) sollte höhere Confidence als 0.7 haben", async () => {
    // "transcription" is 13 characters → 0.7 + 0.1 = 0.8
    testSkills.push(makeSkill({ id: "s1", triggers: { keywords: ["transcription"] } }));

    const matches = await matchSkills("Please start the transcription now.");

    expect(matches[0].confidence).toBeGreaterThan(0.7);
  });

  test("sehr langes Keyword (>20 Zeichen) sollte noch höhere Confidence haben", async () => {
    // "automatic transcription" is 23 characters (multi-word AND >20) → 0.7 + 0.1 + 0.1 + 0.1 = 1.0, capped at 0.95
    testSkills.push(
      makeSkill({ id: "s1", triggers: { keywords: ["automatic transcription"] } })
    );

    const matches = await matchSkills("Please do automatic transcription of the audio.");

    expect(matches[0].confidence).toBeGreaterThan(0.8);
    expect(matches[0].confidence).toBeLessThanOrEqual(0.95);
  });

  test("mehrwörtiges Keyword sollte höhere Confidence als einwörtiges haben", async () => {
    testSkills.push(
      makeSkill({ id: "single", triggers: { keywords: ["search"] } }),
      makeSkill({ id: "multi", triggers: { keywords: ["web search"] } })
    );

    const matches = await matchSkills("do a web search");

    const singleMatch = matches.find(m => m.skill.id === "single")!;
    const multiMatch = matches.find(m => m.skill.id === "multi")!;

    expect(multiMatch.confidence).toBeGreaterThan(singleMatch.confidence);
  });

  test("Confidence sollte maximal 0.95 betragen (nie höher als pattern oder explicit)", async () => {
    // Keyword with all bonuses: >20 chars + multi-word → 0.7+0.1+0.1+0.1 = 1.0, capped at 0.95
    testSkills.push(
      makeSkill({ id: "s1", triggers: { keywords: ["very long keyword phrase"] } })
    );

    const matches = await matchSkills("use very long keyword phrase now");

    expect(matches[0].confidence).toBeLessThanOrEqual(0.95);
  });
});

// ---------------------------------------------------------------------------
// Word-boundary matching
// ---------------------------------------------------------------------------

describe("Wortgrenzen-Matching", () => {
  test("'search' sollte 'web search' matchen", async () => {
    testSkills.push(makeSkill({ id: "s1", triggers: { keywords: ["search"] } }));

    const matches = await matchSkills("please do a web search for me");

    expect(matches).toHaveLength(1);
  });

  test("'search' sollte NICHT 'researching' matchen (kein Wortgrenz-Treffer)", async () => {
    testSkills.push(makeSkill({ id: "s1", triggers: { keywords: ["search"] } }));

    const matches = await matchSkills("I am researching the topic.");

    expect(matches).toHaveLength(0);
  });

  test("'search' sollte NICHT 'searches' matchen wegen fehlender Wortgrenze am Ende", async () => {
    testSkills.push(makeSkill({ id: "s1", triggers: { keywords: ["search"] } }));

    // "searches" contains "search" but \bsearch\b does not match inside "searches"
    const matches = await matchSkills("He searches for answers.");

    expect(matches).toHaveLength(0);
  });

  test("'web search' sollte nur als vollständige Wortfolge matchen", async () => {
    testSkills.push(makeSkill({ id: "s1", triggers: { keywords: ["web search"] } }));

    const withMatch = await matchSkills("do a web search please");
    expect(withMatch).toHaveLength(1);

    const withoutMatch = await matchSkills("do a websearch please");
    expect(withoutMatch).toHaveLength(0);
  });
});

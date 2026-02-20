import { test, expect, describe } from "bun:test";
import {
  hashPassword,
  verifyPassword,
  needsRehash,
  verifyAndRehash,
  validatePassword,
  validateUsername,
} from "../password";
import { sanitizeUser } from "../types";
import type { User } from "../types";

// ---------------------------------------------------------------------------
// hashPassword
// ---------------------------------------------------------------------------

describe("hashPassword", () => {
  test("erzeugt einen argon2id-Hash", async () => {
    const hash = await hashPassword("SecurePass1");
    expect(hash.startsWith("$argon2id$")).toBe(true);
  });

  test("erzeugt beim gleichen Passwort unterschiedliche Salts", async () => {
    const hash1 = await hashPassword("SecurePass1");
    const hash2 = await hashPassword("SecurePass1");
    expect(hash1).not.toBe(hash2);
  });

  test("enthält die konfigurierten Parameter m=65536 und t=3", async () => {
    const hash = await hashPassword("SecurePass1");
    expect(hash).toContain("m=65536");
    expect(hash).toContain("t=3");
  });
});

// ---------------------------------------------------------------------------
// verifyPassword
// ---------------------------------------------------------------------------

describe("verifyPassword", () => {
  test("gibt true zurück bei korrektem Passwort", async () => {
    const hash = await hashPassword("KorrektesPW9!");
    const result = await verifyPassword("KorrektesPW9!", hash);
    expect(result).toBe(true);
  });

  test("gibt false zurück bei falschem Passwort", async () => {
    const hash = await hashPassword("KorrektesPW9!");
    const result = await verifyPassword("FalschesPasswort1", hash);
    expect(result).toBe(false);
  });

  test("gibt false zurück bei ungültigem Hash-String", async () => {
    const result = await verifyPassword("IrgendeinPasswort1", "kein-gueltiger-hash");
    expect(result).toBe(false);
  });

  test("gibt false zurück bei leerem Hash", async () => {
    const result = await verifyPassword("IrgendeinPasswort1", "");
    expect(result).toBe(false);
  });
});

// ---------------------------------------------------------------------------
// needsRehash
// ---------------------------------------------------------------------------

describe("needsRehash", () => {
  test("gibt false zurück für aktuellen argon2id-Hash mit korrekten Parametern", async () => {
    const hash = await hashPassword("TestPasswort1");
    expect(needsRehash(hash)).toBe(false);
  });

  test("gibt true zurück wenn Hash nicht mit $argon2id$ beginnt", () => {
    const bcryptHash = "$2b$12$abcdefghijklmnopqrstuvuuuuuuuuuuuuuuuuuuuuuuuuuuuuuuuu";
    expect(needsRehash(bcryptHash)).toBe(true);
  });

  test("gibt true zurück bei leerer Zeichenkette", () => {
    expect(needsRehash("")).toBe(true);
  });

  test("gibt true zurück wenn memoryCost unterhalb von 90% des Zielwerts liegt", () => {
    // targetMemoryCost * 0.9 = 58982.4 — alles darunter muss rehashed werden
    const lowMemoryHash = "$argon2id$v=19$m=32768,t=3,p=1$somesalt$somehash";
    expect(needsRehash(lowMemoryHash)).toBe(true);
  });

  test("gibt true zurück wenn timeCost kleiner als Zielwert ist", () => {
    const lowTimeCostHash = "$argon2id$v=19$m=65536,t=2,p=1$somesalt$somehash";
    expect(needsRehash(lowTimeCostHash)).toBe(true);
  });

  test("gibt false zurück wenn Parameter exakt dem Zielwert entsprechen", () => {
    const currentHash = "$argon2id$v=19$m=65536,t=3,p=1$somesalt$somehash";
    expect(needsRehash(currentHash)).toBe(false);
  });

  test("gibt false zurück wenn memoryCost oberhalb des Zielwerts liegt", () => {
    const higherMemoryHash = "$argon2id$v=19$m=131072,t=3,p=1$somesalt$somehash";
    expect(needsRehash(higherMemoryHash)).toBe(false);
  });

  test("gibt true zurück wenn Parameter-Block fehlt", () => {
    const malformedHash = "$argon2id$v=19$somesalt$somehash";
    expect(needsRehash(malformedHash)).toBe(true);
  });
});

// ---------------------------------------------------------------------------
// verifyAndRehash
// ---------------------------------------------------------------------------

describe("verifyAndRehash", () => {
  test("gibt [true, null] zurück für gültiges Passwort mit aktuellem Hash", async () => {
    const hash = await hashPassword("GueltigesPasswort1");
    const [isValid, newHash] = await verifyAndRehash("GueltigesPasswort1", hash);
    expect(isValid).toBe(true);
    expect(newHash).toBeNull();
  });

  test("gibt [false, null] zurück bei falschem Passwort", async () => {
    const hash = await hashPassword("GueltigesPasswort1");
    const [isValid, newHash] = await verifyAndRehash("FalschesPasswort1", hash);
    expect(isValid).toBe(false);
    expect(newHash).toBeNull();
  });

  test("gibt [true, neuerHash] zurück wenn Hash veraltet ist (niedrige Parameter)", async () => {
    // Einen Hash mit zu niedrigem memoryCost simulieren — wir nutzen bcrypt-artigen Präfix
    // sodass needsRehash(hash)=true und verifyPassword zuerst prüft.
    // Dafür erstellen wir einen echten argon2id-Hash mit niedrigem memoryCost über Bun direkt.
    const lowCostHash = await Bun.password.hash("GueltigesPasswort1", {
      algorithm: "argon2id",
      memoryCost: 16384, // < 58982 → needsRehash gibt true
      timeCost: 3,
    });
    const [isValid, newHash] = await verifyAndRehash("GueltigesPasswort1", lowCostHash);
    expect(isValid).toBe(true);
    expect(newHash).not.toBeNull();
    expect(newHash!.startsWith("$argon2id$")).toBe(true);
    expect(newHash).toContain("m=65536");
  });

  test("gibt [false, null] zurück bei ungültigem Hash", async () => {
    const [isValid, newHash] = await verifyAndRehash("IrgendeinPasswort1", "kein-gueltiger-hash");
    expect(isValid).toBe(false);
    expect(newHash).toBeNull();
  });
});

// ---------------------------------------------------------------------------
// validatePassword
// ---------------------------------------------------------------------------

describe("validatePassword", () => {
  test("gibt valid=true zurück für ein starkes Passwort", () => {
    const result = validatePassword("Sicher123");
    expect(result.valid).toBe(true);
    expect(result.errors).toHaveLength(0);
  });

  test("akzeptiert Passwörter mit Sonderzeichen", () => {
    const result = validatePassword("Secure!1Pass");
    expect(result.valid).toBe(true);
    expect(result.errors).toHaveLength(0);
  });

  test("lehnt Passwörter mit weniger als 8 Zeichen ab", () => {
    const result = validatePassword("Ab1");
    expect(result.valid).toBe(false);
    expect(result.errors).toContain("Passwort muss mindestens 8 Zeichen lang sein");
  });

  test("lehnt Passwörter mit mehr als 128 Zeichen ab", () => {
    const longPassword = "Aa1" + "x".repeat(126); // 129 Zeichen
    const result = validatePassword(longPassword);
    expect(result.valid).toBe(false);
    expect(result.errors).toContain("Passwort darf maximal 128 Zeichen lang sein");
  });

  test("akzeptiert ein Passwort mit genau 128 Zeichen", () => {
    const exactPassword = "Aa1" + "x".repeat(125); // 128 Zeichen
    const result = validatePassword(exactPassword);
    expect(result.valid).toBe(true);
    expect(result.errors).toHaveLength(0);
  });

  test("lehnt Passwörter ohne Kleinbuchstaben ab", () => {
    const result = validatePassword("GROSSBUCHSTABEN1");
    expect(result.valid).toBe(false);
    expect(result.errors).toContain("Passwort muss mindestens einen Kleinbuchstaben enthalten");
  });

  test("lehnt Passwörter ohne Großbuchstaben ab", () => {
    const result = validatePassword("kleinbuchstaben1");
    expect(result.valid).toBe(false);
    expect(result.errors).toContain("Passwort muss mindestens einen Großbuchstaben enthalten");
  });

  test("lehnt Passwörter ohne Zahl ab", () => {
    const result = validatePassword("KeinZahlDrin");
    expect(result.valid).toBe(false);
    expect(result.errors).toContain("Passwort muss mindestens eine Zahl enthalten");
  });

  test("lehnt häufig verwendete Passwörter ab", () => {
    const result = validatePassword("Password1");
    expect(result.valid).toBe(false);
    expect(result.errors).toContain("Dieses Passwort ist zu häufig und unsicher");
  });

  test("Vergleich mit häufigem Passwort ist Groß-/Kleinschreibungs-unabhängig", () => {
    const result = validatePassword("PASSWORD1");
    // "password1" ist in der Liste → Vergleich mit toLowerCase()
    expect(result.errors).toContain("Dieses Passwort ist zu häufig und unsicher");
  });

  test("Komplexitätsprüfung wird bei zu kurzem Passwort übersprungen", () => {
    // Passwort kürzer als 8 Zeichen → keine Komplexitätsfehler, nur Längenfehler
    const result = validatePassword("short");
    expect(result.errors).toContain("Passwort muss mindestens 8 Zeichen lang sein");
    expect(result.errors).not.toContain("Passwort muss mindestens einen Kleinbuchstaben enthalten");
  });

  test("gibt mehrere Fehler gleichzeitig zurück", () => {
    const result = validatePassword("nozahlen"); // kein Großbuchstabe, keine Zahl
    expect(result.valid).toBe(false);
    expect(result.errors.length).toBeGreaterThanOrEqual(2);
  });
});

// ---------------------------------------------------------------------------
// validateUsername
// ---------------------------------------------------------------------------

describe("validateUsername", () => {
  test("gibt valid=true zurück für einen gültigen Benutzernamen", () => {
    const result = validateUsername("max_mustermann");
    expect(result.valid).toBe(true);
    expect(result.errors).toHaveLength(0);
  });

  test("akzeptiert alphanumerische Benutzernamen mit Bindestrich und Unterstrich", () => {
    const result = validateUsername("User-123_Test");
    expect(result.valid).toBe(true);
    expect(result.errors).toHaveLength(0);
  });

  test("lehnt Benutzernamen mit weniger als 3 Zeichen ab", () => {
    const result = validateUsername("ab");
    expect(result.valid).toBe(false);
    expect(result.errors).toContain("Username must be at least 3 characters long");
  });

  test("akzeptiert Benutzernamen mit genau 3 Zeichen", () => {
    const result = validateUsername("abc");
    expect(result.valid).toBe(true);
    expect(result.errors).toHaveLength(0);
  });

  test("lehnt Benutzernamen mit mehr als 32 Zeichen ab", () => {
    const result = validateUsername("a".repeat(33));
    expect(result.valid).toBe(false);
    expect(result.errors).toContain("Username must be at most 32 characters long");
  });

  test("akzeptiert Benutzernamen mit genau 32 Zeichen", () => {
    const result = validateUsername("a".repeat(32));
    expect(result.valid).toBe(true);
    expect(result.errors).toHaveLength(0);
  });

  test("lehnt Benutzernamen mit Leerzeichen ab", () => {
    const result = validateUsername("kein leerzeichen");
    expect(result.valid).toBe(false);
    expect(result.errors).toContain(
      "Username can only contain letters, numbers, underscores, and hyphens"
    );
  });

  test("lehnt Benutzernamen mit Sonderzeichen ab", () => {
    const result = validateUsername("user@domain");
    expect(result.valid).toBe(false);
    expect(result.errors).toContain(
      "Username can only contain letters, numbers, underscores, and hyphens"
    );
  });

  test("lehnt leere Zeichenkette ab", () => {
    const result = validateUsername("");
    expect(result.valid).toBe(false);
    expect(result.errors).toContain("Username must be at least 3 characters long");
  });
});

// ---------------------------------------------------------------------------
// sanitizeUser
// ---------------------------------------------------------------------------

describe("sanitizeUser", () => {
  const baseUser: User = {
    id: "user_001",
    username: "max",
    email: "max@example.com",
    displayName: "Max Mustermann",
    passwordHash: "$argon2id$v=19$m=65536,t=3,p=1$salt$hash",
    role: "user",
    createdAt: "2024-01-01T00:00:00.000Z",
    updatedAt: "2024-01-02T00:00:00.000Z",
    isActive: true,
  };

  test("entfernt passwordHash aus dem User-Objekt", () => {
    const safe = sanitizeUser(baseUser);
    expect(safe).not.toHaveProperty("passwordHash");
  });

  test("behält alle anderen Felder bei", () => {
    const safe = sanitizeUser(baseUser);
    expect(safe.id).toBe(baseUser.id);
    expect(safe.username).toBe(baseUser.username);
    expect(safe.email).toBe(baseUser.email);
    expect(safe.displayName).toBe(baseUser.displayName);
    expect(safe.role).toBe(baseUser.role);
    expect(safe.createdAt).toBe(baseUser.createdAt);
    expect(safe.updatedAt).toBe(baseUser.updatedAt);
    expect(safe.isActive).toBe(baseUser.isActive);
  });

  test("gibt ein neues Objekt zurück ohne das Original zu verändern", () => {
    const safe = sanitizeUser(baseUser);
    expect(safe).not.toBe(baseUser);
    expect((baseUser as Record<string, unknown>).passwordHash).toBeDefined();
  });

  test("behält optionale Felder bei wenn vorhanden", () => {
    const userWithPrefs: User = {
      ...baseUser,
      preferences: {
        models: {
          chat: { provider_id: "openai", model_id: "gpt-4o" },
        },
      },
    };
    const safe = sanitizeUser(userWithPrefs);
    expect(safe.preferences).toEqual(userWithPrefs.preferences);
  });

  test("funktioniert auch wenn optionale Felder fehlen", () => {
    const minimalUser: User = {
      id: "user_002",
      username: "erika",
      passwordHash: "$argon2id$v=19$m=65536,t=3,p=1$salt$hash",
      role: "admin",
      createdAt: "2024-01-01T00:00:00.000Z",
      updatedAt: "2024-01-01T00:00:00.000Z",
      isActive: true,
    };
    const safe = sanitizeUser(minimalUser);
    expect(safe).not.toHaveProperty("passwordHash");
    expect(safe.id).toBe("user_002");
    expect(safe.email).toBeUndefined();
    expect(safe.displayName).toBeUndefined();
  });
});

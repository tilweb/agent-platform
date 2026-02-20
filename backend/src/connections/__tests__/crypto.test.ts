/**
 * Tests for connections/crypto.ts
 *
 * AES-256-GCM Verschluesselung und Entschluesselung fuer Token-Speicherung.
 * Keine Mocks noetig — die Web Crypto API ist in Bun nativ verfuegbar.
 * Der Verschluesselungsschluessel wird per Umgebungsvariable gesetzt und
 * nach jedem Testblock wiederhergestellt.
 */

import { test, expect, describe, beforeAll, afterAll } from "bun:test";
import {
  encryptTokens,
  decryptTokens,
  encryptData,
  decryptData,
  isEncryptionConfigured,
  generateEncryptionKey,
} from "../crypto";
import type { TokenSet, EncryptedTokenSet } from "../types";

// ---------------------------------------------------------------------------
// Testkonstanten
// ---------------------------------------------------------------------------

/** Gueltige 256-Bit-Schluessel als 64-stelliger Hex-String */
const VALID_KEY = "a".repeat(32) + "b".repeat(32); // 64 Zeichen hex

const SAMPLE_TOKENS: TokenSet = {
  accessToken: "eyJhbGciOiJSUzI1NiJ9.access",
  refreshToken: "eyJhbGciOiJSUzI1NiJ9.refresh",
  expiresAt: "2026-12-31T23:59:59.000Z",
  tokenType: "Bearer",
  scope: "read write",
};

const TOKENS_MINIMAL: TokenSet = {
  accessToken: "tok_minimal",
  tokenType: "Bearer",
};

// ---------------------------------------------------------------------------
// Setup / Teardown
// ---------------------------------------------------------------------------

let originalKey: string | undefined;

beforeAll(() => {
  originalKey = process.env.CONNECTION_ENCRYPTION_KEY;
  process.env.CONNECTION_ENCRYPTION_KEY = VALID_KEY;
});

afterAll(() => {
  if (originalKey === undefined) {
    delete process.env.CONNECTION_ENCRYPTION_KEY;
  } else {
    process.env.CONNECTION_ENCRYPTION_KEY = originalKey;
  }
});

// ---------------------------------------------------------------------------
// encryptTokens / decryptTokens
// ---------------------------------------------------------------------------

describe("encryptTokens", () => {
  test("gibt EncryptedTokenSet mit encrypted, iv, tag und version zurueck", async () => {
    const result = await encryptTokens(SAMPLE_TOKENS);

    expect(result).toHaveProperty("encrypted");
    expect(result).toHaveProperty("iv");
    expect(result).toHaveProperty("tag");
    expect(result).toHaveProperty("version");
    expect(typeof result.encrypted).toBe("string");
    expect(typeof result.iv).toBe("string");
    expect(typeof result.tag).toBe("string");
    expect(typeof result.version).toBe("number");
  });

  test("verschluesselt zu gueltigem Hex-String (nur [0-9a-f])", async () => {
    const result = await encryptTokens(SAMPLE_TOKENS);

    expect(result.encrypted).toMatch(/^[0-9a-f]+$/);
    expect(result.iv).toMatch(/^[0-9a-f]+$/);
    expect(result.tag).toMatch(/^[0-9a-f]+$/);
  });

  test("iv hat 24 Zeichen (12 Bytes als Hex)", async () => {
    const result = await encryptTokens(SAMPLE_TOKENS);
    expect(result.iv).toHaveLength(24);
  });

  test("tag hat 32 Zeichen (16 Bytes als Hex)", async () => {
    const result = await encryptTokens(SAMPLE_TOKENS);
    expect(result.tag).toHaveLength(32);
  });

  test("setzt version auf 1", async () => {
    const result = await encryptTokens(SAMPLE_TOKENS);
    expect(result.version).toBe(1);
  });

  test("jede Verschluesselung erzeugt einen anderen iv", async () => {
    const r1 = await encryptTokens(SAMPLE_TOKENS);
    const r2 = await encryptTokens(SAMPLE_TOKENS);
    expect(r1.iv).not.toBe(r2.iv);
  });

  test("gleiche Eingabe liefert unterschiedlichen Ciphertext wegen zufaelligem iv", async () => {
    const r1 = await encryptTokens(SAMPLE_TOKENS);
    const r2 = await encryptTokens(SAMPLE_TOKENS);
    expect(r1.encrypted).not.toBe(r2.encrypted);
  });

  test("funktioniert auch bei minimalem TokenSet ohne optionale Felder", async () => {
    const result = await encryptTokens(TOKENS_MINIMAL);
    expect(result).toHaveProperty("encrypted");
  });
});

describe("decryptTokens", () => {
  test("Round-Trip gibt identisches TokenSet zurueck", async () => {
    const encrypted = await encryptTokens(SAMPLE_TOKENS);
    const decrypted = await decryptTokens(encrypted);

    expect(decrypted.accessToken).toBe(SAMPLE_TOKENS.accessToken);
    expect(decrypted.refreshToken).toBe(SAMPLE_TOKENS.refreshToken);
    expect(decrypted.expiresAt).toBe(SAMPLE_TOKENS.expiresAt);
    expect(decrypted.tokenType).toBe(SAMPLE_TOKENS.tokenType);
    expect(decrypted.scope).toBe(SAMPLE_TOKENS.scope);
  });

  test("Round-Trip mit minimalem TokenSet", async () => {
    const encrypted = await encryptTokens(TOKENS_MINIMAL);
    const decrypted = await decryptTokens(encrypted);

    expect(decrypted.accessToken).toBe(TOKENS_MINIMAL.accessToken);
    expect(decrypted.tokenType).toBe(TOKENS_MINIMAL.tokenType);
    expect(decrypted.refreshToken).toBeUndefined();
  });

  test("wirft Fehler bei unbekannter version", async () => {
    const encrypted = await encryptTokens(SAMPLE_TOKENS);
    const tampered: EncryptedTokenSet = { ...encrypted, version: 99 };

    await expect(decryptTokens(tampered)).rejects.toThrow("Unsupported encryption version: 99");
  });

  test("wirft Fehler bei manipuliertem Ciphertext (authentication tag mismatch)", async () => {
    const encrypted = await encryptTokens(SAMPLE_TOKENS);
    // Erstes Byte des Ciphertexts umkehren
    const corruptedHex = encrypted.encrypted.startsWith("00")
      ? "ff" + encrypted.encrypted.slice(2)
      : "00" + encrypted.encrypted.slice(2);
    const tampered: EncryptedTokenSet = { ...encrypted, encrypted: corruptedHex };

    await expect(decryptTokens(tampered)).rejects.toThrow();
  });
});

// ---------------------------------------------------------------------------
// encryptData / decryptData
// ---------------------------------------------------------------------------

describe("encryptData / decryptData", () => {
  test("Round-Trip fuer beliebiges Objekt", async () => {
    const payload = { userId: "u123", role: "admin", active: true, count: 42 };
    const encrypted = await encryptData(payload);
    const decrypted = await decryptData<typeof payload>(encrypted);

    expect(decrypted).toEqual(payload);
  });

  test("Round-Trip fuer String-Wert", async () => {
    const payload = "hallo welt";
    const encrypted = await encryptData(payload);
    const decrypted = await decryptData<string>(encrypted);

    expect(decrypted).toBe(payload);
  });

  test("Round-Trip fuer Array", async () => {
    const payload = [1, 2, 3, "vier", true];
    const encrypted = await encryptData(payload);
    const decrypted = await decryptData<typeof payload>(encrypted);

    expect(decrypted).toEqual(payload);
  });

  test("Round-Trip fuer verschachteltes Objekt", async () => {
    const payload = { a: { b: { c: "tief" } }, list: [10, 20] };
    const encrypted = await encryptData(payload);
    const decrypted = await decryptData<typeof payload>(encrypted);

    expect(decrypted).toEqual(payload);
  });

  test("gibt EncryptedTokenSet-Umschlag mit korrekten Feldern zurueck", async () => {
    const result = await encryptData({ x: 1 });
    expect(result).toHaveProperty("encrypted");
    expect(result).toHaveProperty("iv");
    expect(result).toHaveProperty("tag");
    expect(result.version).toBe(1);
  });

  test("validate-Callback wird aufgerufen und gibt transformierten Wert zurueck", async () => {
    const payload = { score: 100 };
    const encrypted = await encryptData(payload);

    const decrypted = await decryptData<{ score: number; bonus: number }>(
      encrypted,
      (parsed) => {
        const p = parsed as typeof payload;
        return { score: p.score, bonus: p.score * 2 };
      }
    );

    expect(decrypted.score).toBe(100);
    expect(decrypted.bonus).toBe(200);
  });

  test("validate-Callback kann Fehler werfen bei ungueltigen Daten", async () => {
    const payload = { value: "nicht-eine-zahl" };
    const encrypted = await encryptData(payload);

    await expect(
      decryptData(encrypted, (parsed) => {
        const p = parsed as { value: unknown };
        if (typeof p.value !== "number") throw new Error("value muss eine Zahl sein");
        return p;
      })
    ).rejects.toThrow("value muss eine Zahl sein");
  });

  test("wirft Fehler bei unbekannter version", async () => {
    const encrypted = await encryptData({ x: 1 });
    const tampered: EncryptedTokenSet = { ...encrypted, version: 2 };

    await expect(decryptData(tampered)).rejects.toThrow("Unsupported encryption version: 2");
  });
});

// ---------------------------------------------------------------------------
// isEncryptionConfigured
// ---------------------------------------------------------------------------

describe("isEncryptionConfigured", () => {
  test("gibt true zurueck wenn der Schluessel gesetzt ist", () => {
    // beforeAll hat den Schluessel auf VALID_KEY gesetzt
    expect(isEncryptionConfigured()).toBe(true);
  });

  test("gibt false zurueck wenn die Umgebungsvariable nicht gesetzt ist", () => {
    const saved = process.env.CONNECTION_ENCRYPTION_KEY;
    delete process.env.CONNECTION_ENCRYPTION_KEY;

    expect(isEncryptionConfigured()).toBe(false);

    // Wiederherstellen
    process.env.CONNECTION_ENCRYPTION_KEY = saved;
  });

  test("gibt false zurueck wenn der Schluessel zu kurz ist", () => {
    const saved = process.env.CONNECTION_ENCRYPTION_KEY;
    process.env.CONNECTION_ENCRYPTION_KEY = "zurzku";

    expect(isEncryptionConfigured()).toBe(false);

    process.env.CONNECTION_ENCRYPTION_KEY = saved;
  });
});

// ---------------------------------------------------------------------------
// generateEncryptionKey
// ---------------------------------------------------------------------------

describe("generateEncryptionKey", () => {
  test("gibt einen 64-stelligen String zurueck", () => {
    const key = generateEncryptionKey();
    expect(key).toHaveLength(64);
  });

  test("gibt nur Hex-Zeichen zurueck ([0-9a-f])", () => {
    const key = generateEncryptionKey();
    expect(key).toMatch(/^[0-9a-f]{64}$/);
  });

  test("jeder Aufruf erzeugt einen anderen Schluessel", () => {
    const k1 = generateEncryptionKey();
    const k2 = generateEncryptionKey();
    expect(k1).not.toBe(k2);
  });

  test("erzeugter Schluessel kann direkt fuer Verschluesselung verwendet werden", async () => {
    const newKey = generateEncryptionKey();
    const saved = process.env.CONNECTION_ENCRYPTION_KEY;
    process.env.CONNECTION_ENCRYPTION_KEY = newKey;

    const encrypted = await encryptTokens(SAMPLE_TOKENS);
    const decrypted = await decryptTokens(encrypted);
    expect(decrypted.accessToken).toBe(SAMPLE_TOKENS.accessToken);

    process.env.CONNECTION_ENCRYPTION_KEY = saved;
  });
});

// ---------------------------------------------------------------------------
// Fehlerfaelle: fehlende oder ungueltige Umgebungsvariable
// ---------------------------------------------------------------------------

describe("Fehlerfaelle der Umgebungsvariable", () => {
  test("encryptTokens wirft wenn CONNECTION_ENCRYPTION_KEY nicht gesetzt ist", async () => {
    const saved = process.env.CONNECTION_ENCRYPTION_KEY;
    delete process.env.CONNECTION_ENCRYPTION_KEY;

    await expect(encryptTokens(SAMPLE_TOKENS)).rejects.toThrow(
      "CONNECTION_ENCRYPTION_KEY environment variable is required"
    );

    process.env.CONNECTION_ENCRYPTION_KEY = saved;
  });

  test("encryptTokens wirft bei Schluessel mit falscher Laenge (< 64 Zeichen)", async () => {
    const saved = process.env.CONNECTION_ENCRYPTION_KEY;
    process.env.CONNECTION_ENCRYPTION_KEY = "deadbeef"; // nur 8 Zeichen

    await expect(encryptTokens(SAMPLE_TOKENS)).rejects.toThrow(
      "CONNECTION_ENCRYPTION_KEY must be a 64-character hex string"
    );

    process.env.CONNECTION_ENCRYPTION_KEY = saved;
  });

  test("encryptTokens wirft bei Schluessel mit 65 Zeichen (ungerade Laenge)", async () => {
    const saved = process.env.CONNECTION_ENCRYPTION_KEY;
    process.env.CONNECTION_ENCRYPTION_KEY = "a".repeat(65);

    await expect(encryptTokens(SAMPLE_TOKENS)).rejects.toThrow(
      "CONNECTION_ENCRYPTION_KEY must be a 64-character hex string"
    );

    process.env.CONNECTION_ENCRYPTION_KEY = saved;
  });

  test("decryptTokens wirft wenn CONNECTION_ENCRYPTION_KEY fehlt", async () => {
    // Zuerst mit gueltigem Schluessel verschluesseln
    const encrypted = await encryptTokens(SAMPLE_TOKENS);

    const saved = process.env.CONNECTION_ENCRYPTION_KEY;
    delete process.env.CONNECTION_ENCRYPTION_KEY;

    await expect(decryptTokens(encrypted)).rejects.toThrow(
      "CONNECTION_ENCRYPTION_KEY environment variable is required"
    );

    process.env.CONNECTION_ENCRYPTION_KEY = saved;
  });

  test("decryptTokens wirft bei falschem Schluessel (authentication failure)", async () => {
    const encrypted = await encryptTokens(SAMPLE_TOKENS);

    const saved = process.env.CONNECTION_ENCRYPTION_KEY;
    // Anderen gueltigen 64-stelligen Schluessel setzen
    process.env.CONNECTION_ENCRYPTION_KEY = "c".repeat(64);

    await expect(decryptTokens(encrypted)).rejects.toThrow();

    process.env.CONNECTION_ENCRYPTION_KEY = saved;
  });
});

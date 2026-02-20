import { test, expect, describe } from "bun:test";
import { parseIntSafe } from "../parseIntSafe";

describe("parseIntSafe", () => {
  test("gültige Zahl wird korrekt geparst", () => {
    const result = parseIntSafe("42", 0);
    expect(result).toBe(42);
  });

  test("ungültiger String gibt Default zurück", () => {
    const result = parseIntSafe("abc", 99);
    expect(result).toBe(99);
  });

  test("null gibt Default zurück", () => {
    const result = parseIntSafe(null, 7);
    expect(result).toBe(7);
  });

  test("undefined gibt Default zurück", () => {
    const result = parseIntSafe(undefined, 7);
    expect(result).toBe(7);
  });

  test("leerer String gibt Default zurück", () => {
    const result = parseIntSafe("", 5);
    expect(result).toBe(5);
  });

  test("negative Zahlen werden korrekt geparst", () => {
    const result = parseIntSafe("-5", 0);
    expect(result).toBe(-5);
  });

  test("Float-String wird auf Ganzzahl abgeschnitten", () => {
    const result = parseIntSafe("3.7", 0);
    expect(result).toBe(3);
  });
});

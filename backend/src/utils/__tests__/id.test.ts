import { test, expect, describe } from "bun:test";
import { generateId } from "../id";

describe("generateId", () => {
  test("generierte ID beginnt mit dem angegebenen Prefix", () => {
    const id = generateId("chat");
    expect(id.startsWith("chat_")).toBe(true);
  });

  test("ID besteht aus genau drei Teilen getrennt durch Unterstriche", () => {
    const id = generateId("msg");
    const parts = id.split("_");
    expect(parts).toHaveLength(3);
  });

  test("zwei aufeinanderfolgende IDs sind unterschiedlich", () => {
    const first = generateId("item");
    const second = generateId("item");
    expect(first).not.toBe(second);
  });

  test("Random-Teil ist genau 8 Zeichen Hexadezimal", () => {
    const id = generateId("test");
    const parts = id.split("_");
    const randomPart = parts[2];
    expect(randomPart).toHaveLength(8);
    expect(/^[0-9a-f]{8}$/.test(randomPart)).toBe(true);
  });

  test("verschiedene Prefixe erzeugen IDs mit unterschiedlichem Anfang", () => {
    const idA = generateId("alpha");
    const idB = generateId("beta");
    expect(idA.startsWith("alpha_")).toBe(true);
    expect(idB.startsWith("beta_")).toBe(true);
    expect(idA).not.toBe(idB);
  });
});

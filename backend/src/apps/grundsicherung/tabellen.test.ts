/**
 * Grundsicherung — Tabellen: eigenes Schema `grundsicherung`, erwartete Tabellen-/Indexnamen
 * (Präfix gs), FKs mit cascade; und Abgleich gegen die handgeschriebene Migration 0048
 * (jede Drizzle-Tabelle, -Spalte und jeder Index kommt im SQL vor und umgekehrt).
 */
import { describe, test, expect } from 'bun:test';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { getTableConfig, type PgTable } from 'drizzle-orm/pg-core';
import * as schema from '../../db/schema/grundsicherung';

const TABELLEN = Object.entries(schema)
  .filter(([k]) => k.startsWith('gs'))
  .map(([, t]) => getTableConfig(t as PgTable));

const DRIZZLE_DIR = join(import.meta.dir, '../../../drizzle');
const SQL = readFileSync(join(DRIZZLE_DIR, '0048_grundsicherung.sql'), 'utf8');

/** CREATE TABLE-Blöcke der Migration → Tabellenname → Spaltennamen. */
function sqlTabellen(sql: string): Map<string, string[]> {
  const out = new Map<string, string[]>();
  const re = /CREATE TABLE IF NOT EXISTS "grundsicherung"\."(\w+)" \(([\s\S]*?)\n\);/g;
  for (const m of sql.matchAll(re)) {
    const spalten = m[2]!.split('\n').map((z) => z.trim().match(/^"(\w+)"/)?.[1]).filter((x): x is string => !!x);
    out.set(m[1]!, spalten);
  }
  return out;
}

function sqlIndizes(sql: string): Map<string, { tabelle: string; spalte: string }> {
  const out = new Map<string, { tabelle: string; spalte: string }>();
  const re = /CREATE INDEX IF NOT EXISTS "(\w+)"\s+ON "grundsicherung"\."(\w+)" \("(\w+)"\);/g;
  for (const m of sql.matchAll(re)) out.set(m[1]!, { tabelle: m[2]!, spalte: m[3]! });
  return out;
}

describe('Drizzle-Tabellen', () => {
  test('alle Tabellen im Schema grundsicherung mit erwarteten Namen', () => {
    expect(TABELLEN.every((t) => t.schema === 'grundsicherung')).toBe(true);
    expect(TABELLEN.map((t) => t.name).sort()).toEqual([
      'akten', 'aktivitaeten', 'audit_log', 'chat_messages', 'dokumente', 'feld_status', 'ki_verbrauch',
      'notizen', 'personen', 'posteingang', 'pruefschritte', 'schreiben', 'textbausteine', 'vorgaenge',
    ]);
  });

  test('alle Indizes tragen das Präfix gs_', () => {
    const namen = TABELLEN.flatMap((t) => t.indexes.map((i) => i.config.name!));
    expect(namen.length).toBe(21);
    expect(namen.every((n) => n.startsWith('gs_'))).toBe(true);
    expect(namen).toContain('gs_vorgang_nummer_idx');
    expect(namen).toContain('gs_feldstatus_vorgang_idx');
    expect(namen).toContain('gs_audit_vorgang_idx');
  });

  test('Kind-Tabellen hängen per FK (cascade) am Vorgang; Audit/KI-Verbrauch/Posteingang ohne FK', () => {
    const fk = (name: string) => TABELLEN.find((t) => t.name === name)!.foreignKeys.map((f) => {
      const r = f.reference();
      return `${r.columns[0]!.name}→${getTableConfig(r.foreignTable).name}.${r.foreignColumns[0]!.name}:${f.onDelete}`;
    });
    expect(fk('vorgaenge')).toEqual(['akte_id→akten.id:cascade']);
    for (const t of ['personen', 'dokumente', 'pruefschritte', 'schreiben', 'chat_messages', 'aktivitaeten', 'feld_status', 'notizen']) {
      expect(fk(t)).toEqual(['vorgang_id→vorgaenge.id:cascade']);
    }
    for (const t of ['audit_log', 'ki_verbrauch', 'posteingang', 'akten', 'textbausteine']) expect(fk(t)).toEqual([]);
  });
});

describe('Migration 0048 passt zum Drizzle-Schema', () => {
  const sqlT = sqlTabellen(SQL);
  const sqlI = sqlIndizes(SQL);

  test('gleiche Tabellen und Spalten (Reihenfolge egal)', () => {
    expect([...sqlT.keys()].sort()).toEqual(TABELLEN.map((t) => t.name).sort());
    for (const t of TABELLEN) {
      expect({ t: t.name, s: [...(sqlT.get(t.name) ?? [])].sort() }).toEqual({ t: t.name, s: t.columns.map((c) => c.name).sort() });
    }
  });

  test('gleiche Indizes auf gleicher Tabelle/Spalte', () => {
    const erwartet = new Map(TABELLEN.flatMap((t) => t.indexes.map((i) => [i.config.name!, {
      tabelle: t.name, spalte: (i.config.columns[0] as { name: string }).name,
    }] as const)));
    expect(Object.fromEntries(sqlI)).toEqual(Object.fromEntries(erwartet));
  });

  test('NOT NULL im SQL entspricht notNull in Drizzle', () => {
    for (const t of TABELLEN) {
      const block = SQL.match(new RegExp(`CREATE TABLE IF NOT EXISTS "grundsicherung"\\."${t.name}" \\(([\\s\\S]*?)\\n\\);`))![1]!;
      for (const c of t.columns) {
        const zeile = block.split('\n').find((z) => z.trim().startsWith(`"${c.name}"`))!;
        expect({ spalte: `${t.name}.${c.name}`, notNull: /NOT NULL/.test(zeile) }).toEqual({ spalte: `${t.name}.${c.name}`, notNull: c.notNull });
      }
    }
  });

  test('idempotent und mit KI-Transparenzhinweis', () => {
    expect(SQL).toContain('CREATE SCHEMA IF NOT EXISTS "grundsicherung"');
    expect(SQL).not.toMatch(/CREATE TABLE (?!IF NOT EXISTS)/);
    expect(SQL).not.toMatch(/CREATE INDEX (?!IF NOT EXISTS)/);
    expect(SQL).toContain("'tb-seed-ki-transparenz'");
    expect(SQL).toContain('ON CONFLICT ("id") DO NOTHING');
  });

  test('Journal-Eintrag 48 vorhanden, zeitlich nach 0047', () => {
    const journal = JSON.parse(readFileSync(join(DRIZZLE_DIR, 'meta/_journal.json'), 'utf8')) as { entries: Array<{ idx: number; when: number; tag: string }> };
    const e48 = journal.entries.find((e) => e.tag === '0048_grundsicherung');
    const e47 = journal.entries.find((e) => e.idx === 47);
    expect(e48?.idx).toBe(48);
    expect(e48!.when).toBeGreaterThan(e47!.when);
  });
});

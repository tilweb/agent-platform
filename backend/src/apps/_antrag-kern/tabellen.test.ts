/**
 * Antrag-Kern — Fabrik-Gleichheit: Die Tabellen-Fabriken erzeugen für die erste App
 * exakt die bisherigen Tabellen (Schema, Name, Spalten, Typen, notNull, Defaults,
 * Indizes). Erwartung = Stand VOR dem Umbau (per getTableConfig ausgelesen) → keine Migration.
 *
 * Bewusst app-bezogen (einzige Stelle im Kern mit App-Namen, im Fachfrei-Wächter ausgenommen).
 */
import { test, expect } from 'bun:test';
import { is, SQL } from 'drizzle-orm';
import { getTableConfig, pgSchema, type PgTable } from 'drizzle-orm/pg-core';
import { wgAuditLog, wgKiVerbrauch, wgPosteingang } from '../../db/schema/wohngeld';
import { auditLogTabelle, kiVerbrauchTabelle, posteingangTabelle } from './tabellen';

type Spalte = [name: string, typ: string, notNull: boolean, primaerschluessel: boolean, standard: unknown];

/** SQL-Defaults (defaultNow) als Text, sonst Rohwert; kein Default → null. */
function defaultWert(d: unknown): unknown {
  if (d === undefined) return null;
  if (is(d, SQL)) {
    return 'sql:' + (d as SQL).queryChunks.map((c) => {
      const v = (c as { value?: unknown }).value;
      return Array.isArray(v) ? v.join('') : String(v ?? '');
    }).join('');
  }
  return d;
}

function beschreibe(t: PgTable) {
  const c = getTableConfig(t);
  return {
    schema: c.schema,
    name: c.name,
    spalten: c.columns.map((s): Spalte => [s.name, s.getSQLType(), s.notNull, s.primary, defaultWert(s.default)]),
    indizes: c.indexes.map((i) => ({
      name: i.config.name,
      spalten: i.config.columns.map((x) => (x as { name: string }).name),
      unique: i.config.unique,
    })),
    fks: c.foreignKeys.length,
  };
}

const NOW = 'sql:now()';

test('audit_log: identisch zum Stand vor dem Umbau', () => {
  expect(beschreibe(wgAuditLog)).toEqual({
    schema: 'wohngeld',
    name: 'audit_log',
    spalten: [
      ['id', 'text', true, true, null],
      ['timestamp', 'timestamp with time zone', true, false, NOW],
      ['akteur_id', 'text', false, false, null],
      ['akteur_name', 'text', false, false, null],
      ['akteur_rolle', 'text', false, false, null],
      ['aktion', 'text', true, false, null],
      ['objekt_typ', 'text', true, false, null],
      ['objekt_id', 'text', false, false, null],
      ['vorgang_id', 'text', false, false, null],
      ['ergebnis', 'text', true, false, 'ok'],
      ['vorher', 'jsonb', false, false, null],
      ['nachher', 'jsonb', false, false, null],
      ['detail', 'text', false, false, null],
      ['ip', 'text', false, false, null],
    ],
    indizes: [
      { name: 'wg_audit_vorgang_idx', spalten: ['vorgang_id'], unique: false },
      { name: 'wg_audit_timestamp_idx', spalten: ['timestamp'], unique: false },
    ],
    fks: 0,
  });
});

test('ki_verbrauch: identisch zum Stand vor dem Umbau', () => {
  expect(beschreibe(wgKiVerbrauch)).toEqual({
    schema: 'wohngeld',
    name: 'ki_verbrauch',
    spalten: [
      ['id', 'text', true, true, null],
      ['zeitpunkt', 'timestamp with time zone', true, false, NOW],
      ['vorgang_id', 'text', false, false, null],
      ['posteingang_id', 'text', false, false, null],
      ['aktion', 'text', true, false, null],
      ['phase', 'text', true, false, 'bearbeitung'],
      ['akteur_id', 'text', false, false, null],
      ['aufrufe', 'integer', true, false, 0],
      ['prompt_tokens', 'integer', true, false, 0],
      ['completion_tokens', 'integer', true, false, 0],
      ['ohne_angabe', 'integer', true, false, 0],
      ['modelle', 'jsonb', true, false, {}],
      ['dauer_ms', 'integer', false, false, null],
      ['detail', 'text', false, false, null],
    ],
    indizes: [
      { name: 'wg_ki_verbrauch_vorgang_idx', spalten: ['vorgang_id'], unique: false },
      { name: 'wg_ki_verbrauch_posteingang_idx', spalten: ['posteingang_id'], unique: false },
    ],
    fks: 0,
  });
});

test('posteingang: identisch zum Stand vor dem Umbau', () => {
  expect(beschreibe(wgPosteingang)).toEqual({
    schema: 'wohngeld',
    name: 'posteingang',
    spalten: [
      ['id', 'text', true, true, null],
      ['quelle', 'text', true, false, 'manuell'],
      ['eingegangen_am', 'timestamp with time zone', true, false, NOW],
      ['betreff', 'text', false, false, null],
      ['status', 'text', true, false, 'eingegangen'],
      ['dateien', 'jsonb', true, false, []],
      ['match_vorschlag', 'jsonb', false, false, null],
      ['zugeordneter_vorgang_id', 'text', false, false, null],
      ['zugeordnete_akte_id', 'text', false, false, null],
      ['bearbeiter_id', 'text', false, false, null],
      ['verworfen_grund', 'text', false, false, null],
      ['hash', 'text', false, false, null],
      ['data', 'jsonb', true, false, {}],
      ['version', 'integer', true, false, 1],
      ['created_at', 'timestamp with time zone', true, false, NOW],
      ['updated_at', 'timestamp with time zone', true, false, NOW],
    ],
    indizes: [
      { name: 'wg_posteingang_status_idx', spalten: ['status'], unique: false },
      { name: 'wg_posteingang_eingegangen_idx', spalten: ['eingegangen_am'], unique: false },
    ],
    fks: 0,
  });
});

test('Fabriken: Schema und Index-Präfix kommen von der App', () => {
  const s = pgSchema('beispiel');
  const a = beschreibe(auditLogTabelle(s, 'bx'));
  expect([a.schema, a.name, a.indizes.map((i) => i.name)]).toEqual(['beispiel', 'audit_log', ['bx_audit_vorgang_idx', 'bx_audit_timestamp_idx']]);
  const k = beschreibe(kiVerbrauchTabelle(s, 'bx'));
  expect([k.schema, k.name, k.indizes.map((i) => i.name)]).toEqual(['beispiel', 'ki_verbrauch', ['bx_ki_verbrauch_vorgang_idx', 'bx_ki_verbrauch_posteingang_idx']]);
  const p = beschreibe(posteingangTabelle(s, 'bx'));
  expect([p.schema, p.name, p.indizes.map((i) => i.name)]).toEqual(['beispiel', 'posteingang', ['bx_posteingang_status_idx', 'bx_posteingang_eingegangen_idx']]);
});

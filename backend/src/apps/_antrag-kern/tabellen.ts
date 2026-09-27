/**
 * Antrag-Kern — Tabellen-Fabriken (Drizzle).
 *
 * Jede App behält ihr eigenes pgSchema und ruft die Fabriken darin auf. Tabellennamen
 * sind fest, Indexnamen tragen das App-Präfix (`<praefix>_audit_vorgang_idx` …).
 *
 * Bewusst eigene Datei, die NUR `drizzle-orm/pg-core` importiert: die Schema-Dateien
 * unter `db/schema/` werden von drizzle-kit (Node) geladen und dürfen keine
 * Laufzeit-Abhängigkeiten (DB-Handle, Auth, Hono) mitziehen.
 */
import { text, integer, jsonb, timestamp, index, type PgSchema } from 'drizzle-orm/pg-core';

/**
 * Audit-/Protokoll-Log (append-only, revisionssicher). Kein FK auf vorgang_id —
 * der Eintrag muss die Löschung des Vorgangs überdauern.
 */
export function auditLogTabelle(schema: PgSchema<string>, praefix: string) {
  return schema.table('audit_log', {
    id: text('id').primaryKey(),
    timestamp: timestamp('timestamp', { withTimezone: true, mode: 'string' }).notNull().defaultNow(),
    akteurId: text('akteur_id'),
    akteurName: text('akteur_name'),
    akteurRolle: text('akteur_rolle'),
    aktion: text('aktion').notNull(),
    objektTyp: text('objekt_typ').notNull(),
    objektId: text('objekt_id'),
    vorgangId: text('vorgang_id'),
    ergebnis: text('ergebnis').notNull().default('ok'),
    vorher: jsonb('vorher'),
    nachher: jsonb('nachher'),
    detail: text('detail'),
    ip: text('ip'),
  }, (t) => ({
    vorgangIdx: index(`${praefix}_audit_vorgang_idx`).on(t.vorgangId),
    timestampIdx: index(`${praefix}_audit_timestamp_idx`).on(t.timestamp),
  }));
}

export type AuditLogTabelle = ReturnType<typeof auditLogTabelle>;

/**
 * KI-Verbrauch (Tokens) je fachlicher Aktion. Ein Datensatz = eine Aktion mit der
 * Summe aller darin ausgelösten LLM-Aufrufe. Posteingang-Datensätze erhalten
 * `vorgang_id` erst bei der Zuordnung. Kein FK; keine Inhalte, nur Zahlen.
 */
export function kiVerbrauchTabelle(schema: PgSchema<string>, praefix: string) {
  return schema.table('ki_verbrauch', {
    id: text('id').primaryKey(),
    zeitpunkt: timestamp('zeitpunkt', { withTimezone: true, mode: 'string' }).notNull().defaultNow(),
    vorgangId: text('vorgang_id'),
    posteingangId: text('posteingang_id'),
    aktion: text('aktion').notNull(),
    phase: text('phase').notNull().default('bearbeitung'),
    akteurId: text('akteur_id'),
    aufrufe: integer('aufrufe').notNull().default(0),
    promptTokens: integer('prompt_tokens').notNull().default(0),
    completionTokens: integer('completion_tokens').notNull().default(0),
    ohneAngabe: integer('ohne_angabe').notNull().default(0),
    modelle: jsonb('modelle').notNull().default({}),
    dauerMs: integer('dauer_ms'),
    detail: text('detail'),
  }, (t) => ({
    vorgangIdx: index(`${praefix}_ki_verbrauch_vorgang_idx`).on(t.vorgangId),
    posteingangIdx: index(`${praefix}_ki_verbrauch_posteingang_idx`).on(t.posteingangId),
  }));
}

export type KiVerbrauchTabelle = ReturnType<typeof kiVerbrauchTabelle>;

/**
 * Persistente Posteingang-Warteschlange — jeder Eintrag ist ein Umschlag/Batch
 * (1..n Dateien), neuer Antrag ODER Nachreichung. `dateien` (jsonb) hält den
 * Umschlag-Inhalt inkl. Analyseergebnissen; die rohen Bytes liegen in der
 * Dateiablage (referenziert je Datei). KEIN FK auf `zugeordneter_vorgang_id`/
 * `zugeordnete_akte_id`: der Eingang muss die Löschung des Vorgangs überdauern.
 */
export function posteingangTabelle(schema: PgSchema<string>, praefix: string) {
  return schema.table('posteingang', {
    id: text('id').primaryKey(),
    quelle: text('quelle').notNull().default('manuell'),
    eingegangenAm: timestamp('eingegangen_am', { withTimezone: true, mode: 'string' }).notNull().defaultNow(),
    betreff: text('betreff'),
    status: text('status').notNull().default('eingegangen'),
    dateien: jsonb('dateien').notNull().default([]),
    matchVorschlag: jsonb('match_vorschlag'),
    zugeordneterVorgangId: text('zugeordneter_vorgang_id'),
    zugeordneteAkteId: text('zugeordnete_akte_id'),
    bearbeiterId: text('bearbeiter_id'),
    verworfenGrund: text('verworfen_grund'),
    hash: text('hash'),
    data: jsonb('data').notNull().default({}),
    version: integer('version').notNull().default(1),
    createdAt: timestamp('created_at', { withTimezone: true, mode: 'string' }).notNull().defaultNow(),
    updatedAt: timestamp('updated_at', { withTimezone: true, mode: 'string' }).notNull().defaultNow(),
  }, (t) => ({
    statusIdx: index(`${praefix}_posteingang_status_idx`).on(t.status),
    eingegangenIdx: index(`${praefix}_posteingang_eingegangen_idx`).on(t.eingegangenAm),
  }));
}

export type PosteingangTabelle = ReturnType<typeof posteingangTabelle>;

/**
 * Grundsicherung (SGB XII, 4. Kapitel) — Antragsprüfung, Drizzle-Schema (pgSchema 'grundsicherung').
 * Spec: docs/grundsicherung-app-spec-2026-09-27.md · Muster: docs/antragspruefung-muster.md
 *
 * Konvention wie Wohngeld: strukturierte Identitäts-/Filterspalten + `data` jsonb für den
 * Domänenrest + `permissions` (nur Top-Ebenen) + `version` (Optimistic Locking)
 * + created_at/updated_at. Hierarchie via FK mit onDelete: 'cascade'. Tabellen-Präfix `gs`.
 *
 * Akte → Vorgang → { Personen, Dokumente, Prüfschritte, Schreiben, Chat, Aktivitäten }
 * Aus dem Antrag-Kern (Fabriken): audit_log, ki_verbrauch, posteingang, feld_status, notizen.
 */
import { pgSchema, text, integer, boolean, jsonb, timestamp, index } from 'drizzle-orm/pg-core';
import {
  auditLogTabelle, kiVerbrauchTabelle, posteingangTabelle, feldStatusTabelle, notizenTabelle,
} from '../../apps/antragspruefung/kern/tabellen';

export const grundsicherungSchema = pgSchema('grundsicherung');

/** Ebene 1 — Akte (E-Akte, personen-/adressbezogen). */
export const gsAkten = grundsicherungSchema.table('akten', {
  id: text('id').primaryKey(),
  ownerId: text('owner_id'),
  name: text('name').notNull(),
  data: jsonb('data').notNull().default({}),
  permissions: jsonb('permissions'),
  version: integer('version').notNull().default(1),
  createdAt: timestamp('created_at', { withTimezone: true, mode: 'string' }).notNull().defaultNow(),
  updatedAt: timestamp('updated_at', { withTimezone: true, mode: 'string' }).notNull().defaultNow(),
}, (t) => ({
  ownerIdx: index('gs_akte_owner_idx').on(t.ownerId),
}));

/**
 * Ebene 2 — Vorgang (= ein Antrag). `vorgangsnummer` ist die interne Nummer der App,
 * NICHT das Aktenzeichen des Fachverfahrens (`data.aktenzeichen`).
 * `anspruchsgrund` (alter | erwerbsminderung) ist Filterspalte, bis zur Erfassung leer.
 */
export const gsVorgaenge = grundsicherungSchema.table('vorgaenge', {
  id: text('id').primaryKey(),
  akteId: text('akte_id').notNull().references(() => gsAkten.id, { onDelete: 'cascade' }),
  vorgangsnummer: text('vorgangsnummer').notNull(),
  antragsart: text('antragsart').notNull().default('erstantrag'),
  anspruchsgrund: text('anspruchsgrund'),
  status: text('status').notNull().default('posteingang'),
  sachbearbeiter: text('sachbearbeiter'),
  prioritaet: text('prioritaet').notNull().default('normal'),
  ownerId: text('owner_id'),
  data: jsonb('data').notNull().default({}),
  permissions: jsonb('permissions'),
  version: integer('version').notNull().default(1),
  createdAt: timestamp('created_at', { withTimezone: true, mode: 'string' }).notNull().defaultNow(),
  updatedAt: timestamp('updated_at', { withTimezone: true, mode: 'string' }).notNull().defaultNow(),
}, (t) => ({
  akteIdx: index('gs_vorgang_akte_idx').on(t.akteId),
  nummerIdx: index('gs_vorgang_nummer_idx').on(t.vorgangsnummer),
  statusIdx: index('gs_vorgang_status_idx').on(t.status),
}));

/** Person (Einsatzgemeinschaft: Antragsteller + Partner; Haushaltsangehörige nur für den Kopfteil). */
export const gsPersonen = grundsicherungSchema.table('personen', {
  id: text('id').primaryKey(),
  vorgangId: text('vorgang_id').notNull().references(() => gsVorgaenge.id, { onDelete: 'cascade' }),
  rolle: text('rolle').notNull().default('haushaltsangehoerig'),
  nachname: text('nachname').notNull().default(''),
  vorname: text('vorname').notNull().default(''),
  data: jsonb('data').notNull().default({}),
  version: integer('version').notNull().default(1),
  createdAt: timestamp('created_at', { withTimezone: true, mode: 'string' }).notNull().defaultNow(),
  updatedAt: timestamp('updated_at', { withTimezone: true, mode: 'string' }).notNull().defaultNow(),
}, (t) => ({
  vorgangIdx: index('gs_person_vorgang_idx').on(t.vorgangId),
}));

/** Dokument / Nachweis (Eingang). */
export const gsDokumente = grundsicherungSchema.table('dokumente', {
  id: text('id').primaryKey(),
  vorgangId: text('vorgang_id').notNull().references(() => gsVorgaenge.id, { onDelete: 'cascade' }),
  personId: text('person_id'),
  typ: text('typ').notNull().default('sonstiges'),
  istOriginal: boolean('ist_original').notNull().default(false),
  data: jsonb('data').notNull().default({}),
  version: integer('version').notNull().default(1),
  createdAt: timestamp('created_at', { withTimezone: true, mode: 'string' }).notNull().defaultNow(),
  updatedAt: timestamp('updated_at', { withTimezone: true, mode: 'string' }).notNull().defaultNow(),
}, (t) => ({
  vorgangIdx: index('gs_dokument_vorgang_idx').on(t.vorgangId),
  typIdx: index('gs_dokument_typ_idx').on(t.typ),
}));

/** Prüfschritt (Vollständigkeit oder Plausibilität; Semantik laut Muster). */
export const gsPruefschritte = grundsicherungSchema.table('pruefschritte', {
  id: text('id').primaryKey(),
  vorgangId: text('vorgang_id').notNull().references(() => gsVorgaenge.id, { onDelete: 'cascade' }),
  personId: text('person_id'),
  regelId: text('regel_id').notNull().default(''),
  kategorie: text('kategorie').notNull().default('vollstaendigkeit'),
  typ: text('typ').notNull().default('anforderung'),
  status: text('status').notNull().default('offen'),
  titel: text('titel').notNull().default(''),
  data: jsonb('data').notNull().default({}),
  version: integer('version').notNull().default(1),
  createdAt: timestamp('created_at', { withTimezone: true, mode: 'string' }).notNull().defaultNow(),
  updatedAt: timestamp('updated_at', { withTimezone: true, mode: 'string' }).notNull().defaultNow(),
}, (t) => ({
  vorgangIdx: index('gs_pruef_vorgang_idx').on(t.vorgangId),
  statusIdx: index('gs_pruef_status_idx').on(t.status),
}));

/** Nachforderungsschreiben (§ 60 SGB I, Frist + Rechtsfolgenbelehrung § 66 SGB I). */
export const gsSchreiben = grundsicherungSchema.table('schreiben', {
  id: text('id').primaryKey(),
  vorgangId: text('vorgang_id').notNull().references(() => gsVorgaenge.id, { onDelete: 'cascade' }),
  art: text('art').notNull().default('erstanforderung'),
  data: jsonb('data').notNull().default({}),
  version: integer('version').notNull().default(1),
  createdAt: timestamp('created_at', { withTimezone: true, mode: 'string' }).notNull().defaultNow(),
  updatedAt: timestamp('updated_at', { withTimezone: true, mode: 'string' }).notNull().defaultNow(),
}, (t) => ({
  vorgangIdx: index('gs_schreiben_vorgang_idx').on(t.vorgangId),
}));

/** Fall-Chat — Nachrichten (append-only), für später vorgesehen. */
export const gsChatMessages = grundsicherungSchema.table('chat_messages', {
  id: text('id').primaryKey(),
  vorgangId: text('vorgang_id').notNull().references(() => gsVorgaenge.id, { onDelete: 'cascade' }),
  rolle: text('rolle').notNull().default('user'),
  data: jsonb('data').notNull().default({}),
  createdAt: timestamp('created_at', { withTimezone: true, mode: 'string' }).notNull().defaultNow(),
}, (t) => ({
  vorgangIdx: index('gs_chat_vorgang_idx').on(t.vorgangId),
}));

/** Pflegbare Textbausteine für Schreiben. */
export const gsTextbausteine = grundsicherungSchema.table('textbausteine', {
  id: text('id').primaryKey(),
  kategorie: text('kategorie').notNull().default('Allgemein'),
  titel: text('titel').notNull().default(''),
  text: text('text').notNull().default(''),
  createdAt: timestamp('created_at', { withTimezone: true, mode: 'string' }).notNull().defaultNow(),
  updatedAt: timestamp('updated_at', { withTimezone: true, mode: 'string' }).notNull().defaultNow(),
}, (t) => ({
  kategorieIdx: index('gs_textbaustein_kategorie_idx').on(t.kategorie),
}));

/** Aktivität / Verlauf (append-only). Fachliches Protokoll läuft über audit_log. */
export const gsAktivitaeten = grundsicherungSchema.table('aktivitaeten', {
  id: text('id').primaryKey(),
  vorgangId: text('vorgang_id').notNull().references(() => gsVorgaenge.id, { onDelete: 'cascade' }),
  typ: text('typ').notNull().default('info'),
  akteur: text('akteur'),
  data: jsonb('data').notNull().default({}),
  createdAt: timestamp('created_at', { withTimezone: true, mode: 'string' }).notNull().defaultNow(),
}, (t) => ({
  vorgangIdx: index('gs_aktivitaet_vorgang_idx').on(t.vorgangId),
}));

// ── Antrag-Kern-Fabriken ────────────────────────────────────────────────────

/** Feld-Provenienz (KI-Vorschläge auf Feldebene); FK auf den Vorgang mit cascade. */
export const gsFeldStatus = feldStatusTabelle(grundsicherungSchema, 'gs', () => gsVorgaenge.id);

/** Notizen je Sektion/Person (append-only); FK auf den Vorgang mit cascade. */
export const gsNotizen = notizenTabelle(grundsicherungSchema, 'gs', () => gsVorgaenge.id);

/** Posteingang-Warteschlange (Umschlag/Batch). Kein FK — überdauert die Löschung des Vorgangs. */
export const gsPosteingang = posteingangTabelle(grundsicherungSchema, 'gs');

/** Audit-/Protokoll-Log (append-only). Kein FK — überdauert die Löschung des Vorgangs. */
export const gsAuditLog = auditLogTabelle(grundsicherungSchema, 'gs');

/** KI-Verbrauch (Tokens) je fachlicher Aktion. Kein FK; nur Zahlen, keine Inhalte. */
export const gsKiVerbrauch = kiVerbrauchTabelle(grundsicherungSchema, 'gs');

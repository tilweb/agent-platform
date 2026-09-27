/**
 * Wohngeld-Antragsassistent — Drizzle-Schema (pgSchema 'wohngeld').
 *
 * Konvention (wie echoloop): strukturierte Identitäts-/Filterspalten + `data` jsonb
 * für den Domänenrest + `permissions` (nur Top-Ebenen) + `version` (Optimistic Locking)
 * + created_at/updated_at. Hierarchie via FK mit onDelete: 'cascade'.
 *
 * Akte → Vorgang → { Personen, Dokumente, Prüfschritte, Schreiben, Aktivitäten }
 */
import { pgSchema, text, integer, boolean, jsonb, timestamp, index } from 'drizzle-orm/pg-core';
import {
  auditLogTabelle, kiVerbrauchTabelle, posteingangTabelle, feldStatusTabelle, notizenTabelle,
} from '../../apps/_antrag-kern/tabellen';

export const wohngeldSchema = pgSchema('wohngeld');

/** Ebene 1 — Akte (E-Akte). */
export const wgAkten = wohngeldSchema.table('akten', {
  id: text('id').primaryKey(),
  ownerId: text('owner_id'),
  name: text('name').notNull(),
  data: jsonb('data').notNull().default({}),
  permissions: jsonb('permissions'),
  version: integer('version').notNull().default(1),
  createdAt: timestamp('created_at', { withTimezone: true, mode: 'string' }).notNull().defaultNow(),
  updatedAt: timestamp('updated_at', { withTimezone: true, mode: 'string' }).notNull().defaultNow(),
}, (t) => ({
  ownerIdx: index('wg_akte_owner_idx').on(t.ownerId),
}));

/** Ebene 2 — Vorgang (= „Antrag", eigene Antrags-ID). */
export const wgVorgaenge = wohngeldSchema.table('vorgaenge', {
  id: text('id').primaryKey(),
  akteId: text('akte_id').notNull().references(() => wgAkten.id, { onDelete: 'cascade' }),
  antragsId: text('antrags_id').notNull(),
  wohngeldart: text('wohngeldart').notNull().default('mietzuschuss'),
  antragsart: text('antragsart').notNull().default('erstantrag'),
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
  akteIdx: index('wg_vorgang_akte_idx').on(t.akteId),
  antragsIdx: index('wg_vorgang_antrags_idx').on(t.antragsId),
  statusIdx: index('wg_vorgang_status_idx').on(t.status),
}));

/** Person (Antragsteller / Haushaltsmitglied). */
export const wgPersonen = wohngeldSchema.table('personen', {
  id: text('id').primaryKey(),
  vorgangId: text('vorgang_id').notNull().references(() => wgVorgaenge.id, { onDelete: 'cascade' }),
  rolle: text('rolle').notNull().default('haushaltsmitglied'),
  nachname: text('nachname').notNull().default(''),
  vorname: text('vorname').notNull().default(''),
  data: jsonb('data').notNull().default({}),
  version: integer('version').notNull().default(1),
  createdAt: timestamp('created_at', { withTimezone: true, mode: 'string' }).notNull().defaultNow(),
  updatedAt: timestamp('updated_at', { withTimezone: true, mode: 'string' }).notNull().defaultNow(),
}, (t) => ({
  vorgangIdx: index('wg_person_vorgang_idx').on(t.vorgangId),
}));

/** Dokument / Nachweis (Eingang). */
export const wgDokumente = wohngeldSchema.table('dokumente', {
  id: text('id').primaryKey(),
  vorgangId: text('vorgang_id').notNull().references(() => wgVorgaenge.id, { onDelete: 'cascade' }),
  personId: text('person_id'),
  typ: text('typ').notNull().default('sonstiges'),
  istOriginal: boolean('ist_original').notNull().default(false),
  data: jsonb('data').notNull().default({}),
  version: integer('version').notNull().default(1),
  createdAt: timestamp('created_at', { withTimezone: true, mode: 'string' }).notNull().defaultNow(),
  updatedAt: timestamp('updated_at', { withTimezone: true, mode: 'string' }).notNull().defaultNow(),
}, (t) => ({
  vorgangIdx: index('wg_dokument_vorgang_idx').on(t.vorgangId),
  typIdx: index('wg_dokument_typ_idx').on(t.typ),
}));

/** Prüfschritt (Vollständigkeit oder Plausibilität). */
export const wgPruefschritte = wohngeldSchema.table('pruefschritte', {
  id: text('id').primaryKey(),
  vorgangId: text('vorgang_id').notNull().references(() => wgVorgaenge.id, { onDelete: 'cascade' }),
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
  vorgangIdx: index('wg_pruef_vorgang_idx').on(t.vorgangId),
  statusIdx: index('wg_pruef_status_idx').on(t.status),
}));

/** Nachforderungsschreiben. */
export const wgSchreiben = wohngeldSchema.table('schreiben', {
  id: text('id').primaryKey(),
  vorgangId: text('vorgang_id').notNull().references(() => wgVorgaenge.id, { onDelete: 'cascade' }),
  art: text('art').notNull().default('erstanforderung'),
  data: jsonb('data').notNull().default({}),
  version: integer('version').notNull().default(1),
  createdAt: timestamp('created_at', { withTimezone: true, mode: 'string' }).notNull().defaultNow(),
  updatedAt: timestamp('updated_at', { withTimezone: true, mode: 'string' }).notNull().defaultNow(),
}, (t) => ({
  vorgangIdx: index('wg_schreiben_vorgang_idx').on(t.vorgangId),
}));

/** Fall-Chat — Nachrichten (append-only). Verlauf pro Vorgang (grounded Fall-Q&A). */
export const wgChatMessages = wohngeldSchema.table('chat_messages', {
  id: text('id').primaryKey(),
  vorgangId: text('vorgang_id').notNull().references(() => wgVorgaenge.id, { onDelete: 'cascade' }),
  rolle: text('rolle').notNull().default('user'),
  data: jsonb('data').notNull().default({}),
  createdAt: timestamp('created_at', { withTimezone: true, mode: 'string' }).notNull().defaultNow(),
}, (t) => ({
  vorgangIdx: index('wg_chat_vorgang_idx').on(t.vorgangId),
}));

/**
 * Feld-Provenienz (Welle 2, WP3) — generisch statt Umbau jedes Feldes.
 * Jeder aus Dokumenten extrahierte Wert ist ein Vorschlag (`quelle='llm', bestaetigt=false`),
 * den die Sachbearbeitung bestätigt oder verwirft. Schlüssel: (vorgang_id, ziel_typ, ziel_id, feld_pfad).
 */
export const wgFeldStatus = feldStatusTabelle(wohngeldSchema, 'wg', () => wgVorgaenge.id); // Antrag-Kern-Fabrik (Tabelle, Index + FK/cascade unverändert)

/** Kommentare/Notizen je Sektion oder Person (Welle 2, WP4, append-only). */
export const wgNotizen = notizenTabelle(wohngeldSchema, 'wg', () => wgVorgaenge.id); // Antrag-Kern-Fabrik (Tabelle, Index + FK/cascade unverändert)

/** Pflegbare Textbausteine für Anforderungsschreiben (Welle 3, WP6). */
export const wgTextbausteine = wohngeldSchema.table('textbausteine', {
  id: text('id').primaryKey(),
  kategorie: text('kategorie').notNull().default('Allgemein'),
  titel: text('titel').notNull().default(''),
  text: text('text').notNull().default(''),
  createdAt: timestamp('created_at', { withTimezone: true, mode: 'string' }).notNull().defaultNow(),
  updatedAt: timestamp('updated_at', { withTimezone: true, mode: 'string' }).notNull().defaultNow(),
}, (t) => ({
  kategorieIdx: index('wg_textbaustein_kategorie_idx').on(t.kategorie),
}));

/** Aktivität / Legacy-Verlauf (append-only). Rückwärtskompatibel — neue Einträge laufen über audit_log. */
export const wgAktivitaeten = wohngeldSchema.table('aktivitaeten', {
  id: text('id').primaryKey(),
  vorgangId: text('vorgang_id').notNull().references(() => wgVorgaenge.id, { onDelete: 'cascade' }),
  typ: text('typ').notNull().default('info'),
  akteur: text('akteur'),
  data: jsonb('data').notNull().default({}),
  createdAt: timestamp('created_at', { withTimezone: true, mode: 'string' }).notNull().defaultNow(),
}, (t) => ({
  vorgangIdx: index('wg_aktivitaet_vorgang_idx').on(t.vorgangId),
}));

/**
 * Persistente Posteingang-Warteschlange (S1–S4) — jeder Eintrag ist ein
 * Umschlag/Batch (1..n Dateien) und kann ein neuer Antrag ODER eine Nachreichung
 * sein. `dateien` (jsonb) hält den Umschlag-Inhalt inkl. Analyseergebnissen; die
 * rohen Bytes liegen weiterhin im Filestore (referenziert je Datei). KEIN FK auf
 * `zugeordneter_vorgang_id`/`zugeordnete_akte_id`: der Eingang muss die Löschung
 * des Vorgangs überdauern (wie audit_log).
 */
export const wgPosteingang = posteingangTabelle(wohngeldSchema, 'wg'); // Antrag-Kern-Fabrik (Tabelle + Indizes unverändert)

/**
 * GOV-1 — Audit-/Protokoll-Log (append-only, revisionssicher).
 * Erfasst JEDE fachlich relevante Aktion der Sachbearbeitung inkl. Lesezugriff
 * auf einen Fall und Downloads/Exporte. Akteur mit id+name+rolle+ip, bei
 * Änderungen Vorher/Nachher-Diff. KEINE Update-/Delete-API (nur INSERT).
 * KEINE Hash-Kette (Nicht-Ziel für GOV-1). Kein FK auf vorgang_id — der
 * Eintrag muss die Löschung des Vorgangs überdauern.
 */
export const wgAuditLog = auditLogTabelle(wohngeldSchema, 'wg'); // Antrag-Kern-Fabrik (Tabelle + Indizes unverändert)

/**
 * KI-Verbrauch (Tokens) je fachlicher Aktion — Spec docs/wohngeld-token-verbrauch-spec-2026-09-27.md.
 * Ein Datensatz = eine Aktion (Posteingang-Auswertung, Upload, Fall-Chat …) mit der Summe
 * aller darin ausgelösten LLM-Aufrufe. Posteingang-Datensätze erhalten `vorgang_id` erst bei
 * der Zuordnung. Kein FK (überdauert Löschung, wie audit_log); keine Inhalte, nur Zahlen.
 */
export const wgKiVerbrauch = kiVerbrauchTabelle(wohngeldSchema, 'wg'); // Antrag-Kern-Fabrik (Tabelle + Indizes unverändert)

/**
 * Wohngeld — KI-Verbrauch (Tokens) je Antrag.
 * Spec: docs/wohngeld-token-verbrauch-spec-2026-09-27.md
 *
 * `messeKiVerbrauch(aktion, bezug, fn)` legt einen Token-Messbereich um eine fachliche
 * Aktion und speichert danach EINEN Datensatz mit der Summe aller darin ausgelösten
 * LLM-Aufrufe (auch in Plattform-Pipelines). Fehler beim Speichern brechen die
 * Fach-Aktion nie ab.
 */
import { and, desc, eq, isNull } from 'drizzle-orm';
import { getDb } from '../../db';
import { wgKiVerbrauch } from '../../db/schema/wohngeld';
import { mitTokenMessung, type ModellVerbrauch, type TokenMessung } from '../../services/llm/token-meter';

export type KiAktion =
  | 'posteingang_auswertung' | 'posteingang_trennung' | 'dokument_upload'
  | 'fall_chat' | 'gesetz_nachschlagen';

export type KiPhase = 'ersterfassung' | 'bearbeitung';

export const KI_AKTION_LABEL: Record<KiAktion, string> = {
  posteingang_auswertung: 'Posteingang: Erkennung & Auslesen',
  posteingang_trennung: 'Posteingang: Neuauswertung nach Trennungskorrektur',
  dokument_upload: 'Nachreichung am Vorgang: Erkennung & Auslesen',
  fall_chat: 'Assistent: Frage zum Fall',
  gesetz_nachschlagen: 'Assistent: Gesetz nachschlagen',
};

export interface KiVerbrauchEintrag {
  id: string;
  zeitpunkt: string;
  vorgangId?: string;
  posteingangId?: string;
  aktion: string;
  label: string;
  phase: KiPhase;
  akteurId?: string;
  aufrufe: number;
  promptTokens: number;
  completionTokens: number;
  totalTokens: number;
  ohneAngabe: number;
  modelle: Record<string, ModellVerbrauch>;
  dauerMs?: number;
  detail?: string;
}

export interface KiVerbrauchSumme {
  anzahl: number;
  aufrufe: number;
  promptTokens: number;
  completionTokens: number;
  totalTokens: number;
  ohneAngabe: number;
}

export interface KiVerbrauchUebersicht {
  summe: KiVerbrauchSumme;
  jePhase: Record<KiPhase, KiVerbrauchSumme>;
  jeAktion: Array<KiVerbrauchSumme & { aktion: string; label: string }>;
  jeModell: Array<ModellVerbrauch & { modell: string; totalTokens: number }>;
  eintraege: KiVerbrauchEintrag[];
}

// ── Reine Helfer ────────────────────────────────────────────────────────────

function leereSumme(): KiVerbrauchSumme {
  return { anzahl: 0, aufrufe: 0, promptTokens: 0, completionTokens: 0, totalTokens: 0, ohneAngabe: 0 };
}

function addiere(s: KiVerbrauchSumme, e: KiVerbrauchEintrag): void {
  s.anzahl++;
  s.aufrufe += e.aufrufe;
  s.promptTokens += e.promptTokens;
  s.completionTokens += e.completionTokens;
  s.totalTokens += e.totalTokens;
  s.ohneAngabe += e.ohneAngabe;
}

export function labelFuer(aktion: string): string {
  return KI_AKTION_LABEL[aktion as KiAktion] ?? aktion;
}

/** Aggregiert Einträge zu Summe, je Phase, je Aktion (absteigend nach Tokens) und je Modell. */
export function fasseZusammen(eintraege: KiVerbrauchEintrag[]): KiVerbrauchUebersicht {
  const summe = leereSumme();
  const jePhase: Record<KiPhase, KiVerbrauchSumme> = { ersterfassung: leereSumme(), bearbeitung: leereSumme() };
  const aktionen = new Map<string, KiVerbrauchSumme & { aktion: string; label: string }>();
  const modelle = new Map<string, ModellVerbrauch & { modell: string; totalTokens: number }>();
  for (const e of eintraege) {
    addiere(summe, e);
    addiere(jePhase[e.phase] ?? jePhase.bearbeitung, e);
    let a = aktionen.get(e.aktion);
    if (!a) { a = { ...leereSumme(), aktion: e.aktion, label: labelFuer(e.aktion) }; aktionen.set(e.aktion, a); }
    addiere(a, e);
    for (const [modell, m] of Object.entries(e.modelle ?? {})) {
      let x = modelle.get(modell);
      if (!x) { x = { modell, aufrufe: 0, promptTokens: 0, completionTokens: 0, ohneAngabe: 0, totalTokens: 0 }; modelle.set(modell, x); }
      x.aufrufe += m.aufrufe; x.promptTokens += m.promptTokens; x.completionTokens += m.completionTokens;
      x.ohneAngabe += m.ohneAngabe; x.totalTokens += m.promptTokens + m.completionTokens;
    }
  }
  return {
    summe,
    jePhase,
    jeAktion: [...aktionen.values()].sort((x, y) => y.totalTokens - x.totalTokens),
    jeModell: [...modelle.values()].sort((x, y) => y.totalTokens - x.totalTokens),
    eintraege,
  };
}

// ── Speicher ────────────────────────────────────────────────────────────────

function rowToEintrag(r: typeof wgKiVerbrauch.$inferSelect): KiVerbrauchEintrag {
  return {
    id: r.id,
    zeitpunkt: r.zeitpunkt,
    vorgangId: r.vorgangId ?? undefined,
    posteingangId: r.posteingangId ?? undefined,
    aktion: r.aktion,
    label: labelFuer(r.aktion),
    phase: r.phase === 'ersterfassung' ? 'ersterfassung' : 'bearbeitung',
    akteurId: r.akteurId ?? undefined,
    aufrufe: r.aufrufe,
    promptTokens: r.promptTokens,
    completionTokens: r.completionTokens,
    totalTokens: r.promptTokens + r.completionTokens,
    ohneAngabe: r.ohneAngabe,
    modelle: (r.modelle ?? {}) as Record<string, ModellVerbrauch>,
    dauerMs: r.dauerMs ?? undefined,
    detail: r.detail ?? undefined,
  };
}

export interface KiBezug {
  vorgangId?: string;
  posteingangId?: string;
  phase?: KiPhase;
  akteurId?: string | null;
  detail?: string;
}

export async function speichereKiVerbrauch(aktion: KiAktion, bezug: KiBezug, m: TokenMessung, dauerMs?: number): Promise<void> {
  if (m.aufrufe === 0) return; // kein LLM-Aufruf → nichts zu protokollieren
  const db = getDb();
  await db.insert(wgKiVerbrauch).values({
    id: `kv-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`,
    vorgangId: bezug.vorgangId ?? null,
    posteingangId: bezug.posteingangId ?? null,
    aktion,
    phase: bezug.phase ?? (bezug.posteingangId && !bezug.vorgangId ? 'ersterfassung' : 'bearbeitung'),
    akteurId: bezug.akteurId ?? null,
    aufrufe: m.aufrufe,
    promptTokens: m.promptTokens,
    completionTokens: m.completionTokens,
    ohneAngabe: m.ohneAngabe,
    modelle: m.modelle as never,
    dauerMs: dauerMs ?? null,
    detail: bezug.detail ?? null,
  });
}

/**
 * Führt `fn` gemessen aus und speichert den Verbrauch (auch wenn `fn` wirft).
 * `bezug` darf eine Funktion sein, falls sich Details erst nach `fn` ergeben.
 */
export async function messeKiVerbrauch<T>(aktion: KiAktion, bezug: KiBezug | (() => KiBezug), fn: () => Promise<T>): Promise<T> {
  const { ergebnis } = await mitTokenMessung(fn, async (m, dauerMs) => {
    try {
      await speichereKiVerbrauch(aktion, typeof bezug === 'function' ? bezug() : bezug, m, dauerMs);
    } catch (err) {
      console.error('[wohngeld] KI-Verbrauch nicht gespeichert:', err);
    }
  });
  return ergebnis;
}

/**
 * Bei Zuordnung eines Eingangs: bisher nur dem Eingang zugeschriebene Datensätze gehen an
 * den Vorgang. Neuer Vorgang ⇒ Ersterfassung, Nachreichung ⇒ Bearbeitung.
 */
export async function ordneKiVerbrauchZu(posteingangId: string, vorgangId: string, istNeuerVorgang: boolean): Promise<void> {
  const db = getDb();
  await db.update(wgKiVerbrauch)
    .set({ vorgangId, phase: istNeuerVorgang ? 'ersterfassung' : 'bearbeitung' })
    .where(and(eq(wgKiVerbrauch.posteingangId, posteingangId), isNull(wgKiVerbrauch.vorgangId)));
}

export async function kiVerbrauchFuerVorgang(vorgangId: string): Promise<KiVerbrauchUebersicht> {
  const rows = await getDb().select().from(wgKiVerbrauch)
    .where(eq(wgKiVerbrauch.vorgangId, vorgangId)).orderBy(desc(wgKiVerbrauch.zeitpunkt));
  return fasseZusammen(rows.map(rowToEintrag));
}

export async function kiVerbrauchFuerPosteingang(posteingangId: string): Promise<KiVerbrauchUebersicht> {
  const rows = await getDb().select().from(wgKiVerbrauch)
    .where(eq(wgKiVerbrauch.posteingangId, posteingangId)).orderBy(desc(wgKiVerbrauch.zeitpunkt));
  return fasseZusammen(rows.map(rowToEintrag));
}

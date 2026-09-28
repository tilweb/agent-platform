/**
 * Antrag-Kern — KI-Verbrauch (Tokens) je Antrag.
 *
 * `messeKiVerbrauch(aktion, bezug, fn)` legt einen Token-Messbereich um eine fachliche
 * Aktion und speichert danach EINEN Datensatz mit der Summe aller darin ausgelösten
 * LLM-Aufrufe (auch in Plattform-Pipelines). Fehler beim Speichern brechen die
 * Fach-Aktion nie ab. Aktionen + Labels liefert die App.
 */
import { and, desc, eq, isNull } from 'drizzle-orm';
import { getDb } from '../../../db';
import { mitTokenMessung, type ModellVerbrauch, type TokenMessung } from '../../../services/llm/token-meter';
import { genId } from './ids';
import type { KiVerbrauchTabelle } from './tabellen';

export { kiVerbrauchTabelle, type KiVerbrauchTabelle } from './tabellen';

export type KiPhase = 'ersterfassung' | 'bearbeitung';

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

export interface KiBezug {
  vorgangId?: string;
  posteingangId?: string;
  phase?: KiPhase;
  akteurId?: string | null;
  detail?: string;
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

/** Label-Auflösung aus einer Label-Tabelle; unbekannte Aktion behält ihren Schlüssel. */
export function labelAus(labels: Record<string, string>, aktion: string): string {
  return labels[aktion] ?? aktion;
}

/**
 * Aggregiert Einträge zu Summe, je Phase, je Aktion (absteigend nach Tokens) und je Modell.
 * `labelFuer` benennt die Aktionen (Default: Schlüssel selbst).
 */
export function fasseZusammen(
  eintraege: KiVerbrauchEintrag[],
  labelFuer: (aktion: string) => string = (a) => a,
): KiVerbrauchUebersicht {
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

/**
 * KI-Verbrauch einer App: Aktionen (`TAktion`) mit Labels, Tabelle aus
 * `kiVerbrauchTabelle(...)`, Log-Präfix für Fehlermeldungen, ID-Präfix der Datensätze.
 */
export function createKiVerbrauch<TAktion extends string>(opts: {
  tabelle: KiVerbrauchTabelle;
  labels: Record<TAktion, string>;
  logPraefix: string;
  idPraefix?: string;
}) {
  const { tabelle } = opts;
  const idPraefix = opts.idPraefix ?? 'kv';

  function labelFuer(aktion: string): string {
    return labelAus(opts.labels, aktion);
  }

  function rowToEintrag(r: KiVerbrauchTabelle['$inferSelect']): KiVerbrauchEintrag {
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

  async function speichereKiVerbrauch(aktion: TAktion, bezug: KiBezug, m: TokenMessung, dauerMs?: number): Promise<void> {
    if (m.aufrufe === 0) return; // kein LLM-Aufruf → nichts zu protokollieren
    const db = getDb();
    await db.insert(tabelle).values({
      id: genId(idPraefix),
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
  async function messeKiVerbrauch<T>(aktion: TAktion, bezug: KiBezug | (() => KiBezug), fn: () => Promise<T>): Promise<T> {
    const { ergebnis } = await mitTokenMessung(fn, async (m, dauerMs) => {
      try {
        await speichereKiVerbrauch(aktion, typeof bezug === 'function' ? bezug() : bezug, m, dauerMs);
      } catch (err) {
        console.error(`${opts.logPraefix} KI-Verbrauch nicht gespeichert:`, err);
      }
    });
    return ergebnis;
  }

  /**
   * Bei Zuordnung eines Eingangs: bisher nur dem Eingang zugeschriebene Datensätze gehen an
   * den Vorgang. Neuer Vorgang ⇒ Ersterfassung, Nachreichung ⇒ Bearbeitung.
   */
  async function ordneKiVerbrauchZu(posteingangId: string, vorgangId: string, istNeuerVorgang: boolean): Promise<void> {
    const db = getDb();
    await db.update(tabelle)
      .set({ vorgangId, phase: istNeuerVorgang ? 'ersterfassung' : 'bearbeitung' })
      .where(and(eq(tabelle.posteingangId, posteingangId), isNull(tabelle.vorgangId)));
  }

  async function kiVerbrauchFuerVorgang(vorgangId: string): Promise<KiVerbrauchUebersicht> {
    const rows = await getDb().select().from(tabelle)
      .where(eq(tabelle.vorgangId, vorgangId)).orderBy(desc(tabelle.zeitpunkt));
    return fasseZusammen(rows.map(rowToEintrag), labelFuer);
  }

  async function kiVerbrauchFuerPosteingang(posteingangId: string): Promise<KiVerbrauchUebersicht> {
    const rows = await getDb().select().from(tabelle)
      .where(eq(tabelle.posteingangId, posteingangId)).orderBy(desc(tabelle.zeitpunkt));
    return fasseZusammen(rows.map(rowToEintrag), labelFuer);
  }

  return {
    labelFuer,
    fasseZusammen: (eintraege: KiVerbrauchEintrag[]) => fasseZusammen(eintraege, labelFuer),
    speichereKiVerbrauch,
    messeKiVerbrauch,
    ordneKiVerbrauchZu,
    kiVerbrauchFuerVorgang,
    kiVerbrauchFuerPosteingang,
  };
}

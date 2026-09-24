/**
 * Golden-Dataset-Messung — reine Vergleichslogik (ohne IO, ohne LLM).
 * Spec: docs/wohngeld-golden-messwerkzeug-spec-2026-09-24.md
 */

export type Bereich = { von: number; bis: number };

// ── Werte vergleichen ────────────────────────────────────────────────────────

const leer = (v: unknown) => v === null || v === undefined || (typeof v === 'string' && v.trim() === '');

/** Text normalisieren: Kleinbuchstaben, ohne Diakritika, ß→ss, Leerraum zusammengefasst. */
export function textNorm(s: string): string {
  return s.toLowerCase().replace(/ß/g, 'ss').normalize('NFD').replace(/[̀-ͯ]/g, '')
    .replace(/[ı]/g, 'i').replace(/\s+/g, ' ').trim();
}

/** Zahl aus Zahl oder deutschem/englischem Zahlentext („1.234,50", „1234.5 €"). */
export function zahl(v: unknown): number | null {
  if (typeof v === 'number') return Number.isFinite(v) ? v : null;
  if (typeof v !== 'string') return null;
  let s = v.replace(/[^\d,.\-]/g, '');
  if (!s) return null;
  if (s.includes(',')) s = s.replace(/\./g, '').replace(',', '.');
  const n = Number(s);
  return Number.isFinite(n) ? n : null;
}

/** Datum → ISO (akzeptiert ISO und TT.MM.JJJJ). */
export function isoDatum(v: unknown): string | null {
  if (typeof v !== 'string') return null;
  const t = v.trim();
  let m = t.match(/^(\d{4})-(\d{2})-(\d{2})/);
  if (m) return `${m[1]}-${m[2]}-${m[3]}`;
  m = t.match(/^(\d{1,2})\.(\d{1,2})\.(\d{4})$/);
  if (m) return `${m[3]}-${m[2]!.padStart(2, '0')}-${m[1]!.padStart(2, '0')}`;
  return null;
}

export type Urteil = 'richtig' | 'falsch' | 'fehlt' | 'zuviel';

/** Vergleicht einen erwarteten mit einem extrahierten Wert. */
export function urteile(erwartet: unknown, ist: unknown): Urteil {
  if (leer(erwartet)) return leer(ist) ? 'richtig' : 'zuviel';
  if (leer(ist)) return 'fehlt';
  if (typeof erwartet === 'number') {
    const n = zahl(ist);
    return n !== null && Math.abs(n - erwartet) <= 0.011 ? 'richtig' : 'falsch';
  }
  if (typeof erwartet === 'boolean') {
    const b = typeof ist === 'boolean' ? ist : typeof ist === 'string' ? /^(true|ja|yes)$/i.test(ist.trim()) : null;
    return b === erwartet ? 'richtig' : 'falsch';
  }
  if (typeof erwartet === 'string') {
    const eDatum = /^\d{4}-\d{2}-\d{2}$/.test(erwartet) ? erwartet : null;
    if (eDatum) return isoDatum(ist) === eDatum ? 'richtig' : 'falsch';
    return textNorm(String(ist)) === textNorm(erwartet) ? 'richtig' : 'falsch';
  }
  return JSON.stringify(erwartet) === JSON.stringify(ist) ? 'richtig' : 'falsch';
}

/** Wert per Punktpfad aus einem verschachtelten Objekt lesen. */
export function lies(obj: unknown, pfad: string): unknown {
  let cur: unknown = obj;
  for (const teil of pfad.split('.')) {
    if (cur === null || typeof cur !== 'object') return undefined;
    cur = (cur as Record<string, unknown>)[teil];
  }
  return cur;
}

export interface FeldErgebnis { gruppe: string; pfad: string; erwartet: unknown; ist: unknown; urteil: Urteil }

/**
 * Vergleicht die erwarteten Felder eines Dokuments (Gruppen stammdaten/analyse/identitaet
 * mit Punktpfaden) mit dem Extraktionsergebnis gleicher Gruppen.
 */
export function vergleicheFelder(
  erwartet: Partial<Record<'stammdaten' | 'analyse' | 'identitaet', Record<string, unknown>>> | undefined,
  ist: Partial<Record<'stammdaten' | 'analyse' | 'identitaet', unknown>>,
): FeldErgebnis[] {
  const out: FeldErgebnis[] = [];
  for (const gruppe of ['stammdaten', 'analyse', 'identitaet'] as const) {
    for (const [pfad, wert] of Object.entries(erwartet?.[gruppe] ?? {})) {
      const istWert = lies(ist[gruppe], pfad);
      out.push({ gruppe, pfad, erwartet: wert, ist: istWert ?? null, urteil: urteile(wert, istWert) });
    }
  }
  return out;
}

// ── Split ────────────────────────────────────────────────────────────────────

export interface ErwartetesDok { nr: number; seiteVon: number; seiteBis: number; typ: string; leerseite?: boolean }

/** Schnitte = erste Seiten aller Dokumente außer dem ersten. */
export function schnitte(bereiche: Bereich[]): Set<number> {
  return new Set(bereiche.slice(1).map((b) => b.von));
}

export interface SplitMetrik {
  erwarteteSchnitte: number; gefundeneSchnitte: number;
  treffer: number; fehlalarme: number; verfehlt: number;
  praezision: number | null; trefferquote: number | null;
  dokumenteExakt: number; dokumenteGesamt: number;
  fehlalarmSeiten: number[]; verfehltSeiten: number[];
}

/**
 * Bewertet gefundene Seitenbereiche gegen die erwarteten. Schnitte direkt vor oder
 * nach einer Leerseite sind optional (die Leerseite darf am Nachbardokument hängen).
 */
export function splitMetrik(erwartet: ErwartetesDok[], gefunden: Bereich[]): SplitMetrik {
  const E = schnitte(erwartet.map((d) => ({ von: d.seiteVon, bis: d.seiteBis })));
  const optional = new Set<number>();
  for (const d of erwartet) if (d.leerseite) { optional.add(d.seiteVon); optional.add(d.seiteBis + 1); }
  const G = schnitte(gefunden);
  const pflicht = [...E].filter((s) => !optional.has(s));
  const treffer = pflicht.filter((s) => G.has(s)).length + [...E].filter((s) => optional.has(s) && G.has(s)).length;
  const fehlalarmSeiten = [...G].filter((s) => !E.has(s) && !optional.has(s)).sort((a, b) => a - b);
  const verfehltSeiten = pflicht.filter((s) => !G.has(s)).sort((a, b) => a - b);
  const zaehlbar = erwartet.filter((d) => !d.leerseite);
  const exakt = zaehlbar.filter((d) => gefunden.some((g) => g.von === d.seiteVon && g.bis === d.seiteBis)).length;
  const tpGesamt = treffer;
  return {
    erwarteteSchnitte: pflicht.length, gefundeneSchnitte: G.size,
    treffer: tpGesamt, fehlalarme: fehlalarmSeiten.length, verfehlt: verfehltSeiten.length,
    praezision: tpGesamt + fehlalarmSeiten.length ? tpGesamt / (tpGesamt + fehlalarmSeiten.length) : null,
    trefferquote: pflicht.length ? pflicht.filter((s) => G.has(s)).length / pflicht.length : null,
    dokumenteExakt: exakt, dokumenteGesamt: zaehlbar.length, fehlalarmSeiten, verfehltSeiten,
  };
}

/** Ordnet jedem erwarteten Dokument den gefundenen Teil mit der größten Seitenüberlappung zu (-1 = keiner). */
export function ordneZu(erwartet: ErwartetesDok[], gefunden: Bereich[]): number[] {
  return erwartet.map((d) => {
    let best = -1;
    let bestUeber = 0;
    gefunden.forEach((g, i) => {
      const ueber = Math.min(d.seiteBis, g.bis) - Math.max(d.seiteVon, g.von) + 1;
      if (ueber > bestUeber) { bestUeber = ueber; best = i; }
    });
    return best;
  });
}

// ── Prüfbefunde ──────────────────────────────────────────────────────────────

export interface PruefErwartung {
  befunde: string[];
  standardbefunde: string[];
  appVermutlichZusaetzlich: Array<{ regelId: string }>;
}

export interface BefundAuswertung { treffer: string[]; verfehlt: string[]; bekannt: string[]; fehlalarm: string[] }

/** Vergleicht die von der App gemeldeten regelIds (Mehrfachmeldungen je Person zusammengefasst). */
export function werteBefundeAus(appRegelIds: string[], e: PruefErwartung): BefundAuswertung {
  const app = new Set(appRegelIds.map((r) => r.split(':')[0]!));
  const erwartet = new Set([...e.befunde, ...e.standardbefunde]);
  const bekannteIds = new Set(e.appVermutlichZusaetzlich.map((x) => x.regelId));
  return {
    treffer: [...erwartet].filter((r) => app.has(r)).sort(),
    verfehlt: e.befunde.filter((r) => !app.has(r)).sort(),
    bekannt: [...app].filter((r) => !erwartet.has(r) && bekannteIds.has(r)).sort(),
    fehlalarm: [...app].filter((r) => !erwartet.has(r) && !bekannteIds.has(r)).sort(),
  };
}

export const quote = (a: number, b: number) => (b ? Math.round((a / b) * 1000) / 10 : null);

// ── Haushalt und Zuordnung (Posteingang-Stand) ───────────────────────────────

/** Erwartete Person (aus dem Fallmodell, in App-Begriffen). */
export interface ErwartetePerson {
  id: string; vorname: string; nachname: string;
  rolle: string; erwerbsstatus?: string; einkommensarten: string[];
}
/** Angelegte Person (Posteingang-Stand). */
export interface AngelegtePerson {
  id: string; vorname: string; nachname: string;
  rolle: string; erwerbsstatus?: string; einkommen?: Array<{ art: string }>;
}

export interface HaushaltMetrik {
  erwartet: number;
  angelegt: number;
  /** Erwartete Personen mit genau einer passenden angelegten Person. */
  gefunden: number;
  rolleRichtig: number;
  erwerbRichtig: number;
  einkommenRichtig: number;
  /** angelegte ID → erwartete ID */
  abbildung: Record<string, string>;
}

export function haushaltMetrik(
  erwartet: ErwartetePerson[],
  angelegt: AngelegtePerson[],
  gleich: (a: { vorname?: string; nachname?: string }, b: { vorname?: string; nachname?: string }) => boolean,
): HaushaltMetrik {
  const m: HaushaltMetrik = { erwartet: erwartet.length, angelegt: angelegt.length, gefunden: 0, rolleRichtig: 0, erwerbRichtig: 0, einkommenRichtig: 0, abbildung: {} };
  const set = (xs: string[]) => [...new Set(xs)].sort().join(',');
  for (const e of erwartet) {
    const treffer = angelegt.filter((a) => gleich(a, e));
    if (treffer.length !== 1) continue;
    const a = treffer[0]!;
    m.gefunden++;
    m.abbildung[a.id] = e.id;
    if (a.rolle === e.rolle) m.rolleRichtig++;
    if ((a.erwerbsstatus ?? '') === (e.erwerbsstatus ?? '')) m.erwerbRichtig++;
    if (set((a.einkommen ?? []).map((x) => x.art)) === set(e.einkommensarten)) m.einkommenRichtig++;
  }
  return m;
}

export interface ZuordnungMetrik { geprueft: number; richtig: number; falsch: number; offen: number; beispiele: string[] }

/**
 * Nachweise mit erwarteter Person: richtig zugeordnet / falscher Person / ohne Person.
 * `zuordnung[i]` = Index des gefundenen Teils für das erwartete Dokument i (−1 = keiner),
 * `personJeTeil[j]` = angelegte Personen-ID des Teils j (undefined = keine).
 */
export function zuordnungMetrik(
  erwartet: Array<{ nr: number; typ: string; person?: string }>,
  zuordnung: number[],
  personJeTeil: Array<string | undefined>,
  abbildung: Record<string, string>,
  personenTypen: ReadonlySet<string>,
): ZuordnungMetrik {
  const m: ZuordnungMetrik = { geprueft: 0, richtig: 0, falsch: 0, offen: 0, beispiele: [] };
  erwartet.forEach((d, i) => {
    if (!d.person || !personenTypen.has(d.typ) || zuordnung[i]! < 0) return;
    m.geprueft++;
    const ist = personJeTeil[zuordnung[i]!];
    if (!ist) { m.offen++; return; }
    if (abbildung[ist] === d.person) { m.richtig++; return; }
    m.falsch++;
    if (m.beispiele.length < 3) m.beispiele.push(`Dok. ${d.nr} (${d.typ}): ${d.person} ≠ ${abbildung[ist] ?? ist}`);
  });
  return m;
}

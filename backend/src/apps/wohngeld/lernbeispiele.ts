/**
 * Wohngeld — Lernbeispiele für das DP-Profil „Wohngeld-Eingang" aus den Entscheidungen
 * der Sachbearbeitung (KI-Vorschlag bestätigt/verworfen).
 *
 * Opt-in über `WOHNGELD_LERNBEISPIELE=true` (Standard aus): Ein Lernbeispiel speichert
 * den Antragstext im DP-Bestand — bei Sozialdaten nur nach Freigabe (DSFA-Ergänzung).
 *
 * Ablauf: Jede Entscheidung wird am Antragsdokument vermerkt (`profil.entscheidungen`).
 * Sind alle KI-Vorschläge dieses Dokuments entschieden, entsteht GENAU EIN Lernbeispiel
 * für den Abschnitt `wohngeldantrag` (Status „candidate" — aktiv erst nach bestandenem
 * DP-Testlauf). Beim Löschen von Dokument/Vorgang wird es mitgelöscht.
 *
 * Spec: docs/wohngeld-dp-segmentprofil-spec-2026-09-24.md (Punkt 3)
 */
import { WOHNGELD_PROFIL_ID } from '../../extraction/templates/wohngeld-eingang';
import { getDokument, listDokumente, listFeldStatus, listPersonen, getVorgang, updateDokument } from './storage';
import type { Dokument, FeldStatus, Person, Vorgang } from './types';

export const lernbeispieleAktiv = () => (process.env.WOHNGELD_LERNBEISPIELE ?? '').toLowerCase() === 'true';

/** Feld-Status-Pfad (Vorgang/Person) → Profilfeld im Abschnitt `wohngeldantrag`. */
export const PFAD_ZU_PROFILFELD: Record<string, string> = {
  antragsdatum: 'antragsdatum',
  wohngeldart: 'wohngeldart',
  antragsart: 'antragsart',
  'wohnung.strasse': 'strasse',
  'wohnung.hausnummer': 'hausnummer',
  'wohnung.plz': 'plz',
  'wohnung.ort': 'ort',
  'wohnung.wohnflaeche_qm': 'wohnflaeche_qm',
  'wohnung.miete': 'gesamtmiete',
  vorname: 'antragsteller_vorname',
  nachname: 'antragsteller_nachname',
  geburtsdatum: 'antragsteller_geburtsdatum',
};

const leer = (v: unknown) => v === undefined || v === null || v === '';

/**
 * Reine Funktion: baut die korrigierte Extraktion aus Rohwerten + Entscheidungen.
 * Bestätigt ⇒ Rohwert bleibt. Verworfen ⇒ aktueller Wert aus Vorgang/Person (oder null).
 * Die Miete wird im Vorgang als Bruttokaltmiete geführt; das Profil liest die
 * Gesamtmiete — zurückgerechnet mit den gelesenen Heiz-/Warmwasser-/Nebenposten.
 */
export function korrigierteWerte(
  rohwerte: Record<string, unknown>,
  entscheidungen: Record<string, 'bestaetigt' | 'verworfen'>,
  vorgang: Pick<Vorgang, 'antragsdatum' | 'wohngeldart' | 'antragsart' | 'wohnung'>,
  antragsteller?: Pick<Person, 'vorname' | 'nachname' | 'geburtsdatum'>,
): Record<string, unknown> {
  const out = { ...rohwerte };
  for (const [pfad, e] of Object.entries(entscheidungen)) {
    const feld = PFAD_ZU_PROFILFELD[pfad];
    if (!feld || e !== 'verworfen') continue;
    let wert: unknown;
    if (pfad === 'wohnung.miete') {
      const kalt = vorgang.wohnung?.miete;
      const zusatz = ['heizkosten', 'warmwasser', 'garage', 'haushaltsenergie'].reduce((s, k) => s + (Number(rohwerte[k]) || 0), 0);
      wert = typeof kalt === 'number' ? Math.round((kalt + zusatz) * 100) / 100 : null;
    } else if (pfad.startsWith('wohnung.')) {
      wert = (vorgang.wohnung as Record<string, unknown> | undefined)?.[pfad.slice(8)];
    } else if (['vorname', 'nachname', 'geburtsdatum'].includes(pfad)) {
      wert = antragsteller?.[pfad as 'vorname'];
    } else {
      wert = (vorgang as Record<string, unknown>)[pfad];
    }
    out[feld] = leer(wert) ? null : wert;
  }
  return out;
}

/** Vermerkt Entscheidungen am Quelldokument und legt ggf. das Lernbeispiel an. Fehler sind nicht fatal. */
export async function vermerkeEntscheidungen(vorgangId: string, eintraege: Array<Pick<FeldStatus, 'feldPfad' | 'quellDokumentId'>>, entscheidung: 'bestaetigt' | 'verworfen'): Promise<void> {
  if (!lernbeispieleAktiv()) return;
  try {
    const nachDok = new Map<string, string[]>();
    for (const e of eintraege) if (e.quellDokumentId) nachDok.set(e.quellDokumentId, [...(nachDok.get(e.quellDokumentId) ?? []), e.feldPfad]);
    for (const [dokId, pfade] of nachDok) {
      const dok = await getDokument(dokId);
      if (!dok?.profil || dok.typ !== 'wohngeldantrag') continue;
      const entscheidungen = { ...(dok.profil.entscheidungen ?? {}) };
      for (const p of pfade) entscheidungen[p] = entscheidung;
      const aktualisiert = await updateDokument(dok.id, { profil: { ...dok.profil, entscheidungen } }, { force: true });
      if (aktualisiert) await legeLernbeispielAnWennEntschieden(vorgangId, aktualisiert);
    }
  } catch (err) {
    console.warn('[wohngeld] Lernsignal nicht gespeichert:', err instanceof Error ? err.message : err);
  }
}

async function legeLernbeispielAnWennEntschieden(vorgangId: string, dok: Dokument): Promise<void> {
  const p = dok.profil!;
  if (p.lernbeispielId || !Object.keys(p.entscheidungen ?? {}).length) return;
  const offen = (await listFeldStatus(vorgangId)).some((f) => f.quellDokumentId === dok.id && f.quelle === 'llm' && !f.bestaetigt);
  if (offen) return;
  const vorgang = await getVorgang(vorgangId);
  if (!vorgang) return;
  const antragsteller = (await listPersonen(vorgangId)).find((x) => x.rolle === 'antragsteller');
  const korrigiert = korrigierteWerte(p.rohwerte, p.entscheidungen!, vorgang, antragsteller);
  const text = dok.extrahierterText ?? '';
  const { saveExample } = await import('../../extraction/learning/examples');
  const beispiel = await saveExample(WOHNGELD_PROFIL_ID, {
    source_filename: dok.quelle ?? `${dok.id}.pdf`,
    document_text: text,
    initial_extraction: { wohngeldantrag: p.rohwerte },
    corrected_extraction: { wohngeldantrag: korrigiert },
    dataset: { purpose: 'train', activation: 'candidate', segment_contexts: { wohngeldantrag: text } },
  });
  await updateDokument(dok.id, { profil: { ...p, lernbeispielId: beispiel.id } }, { force: true });
  console.log(`[wohngeld] Lernbeispiel ${beispiel.id} aus Vorgang ${vorgangId} angelegt (Kandidat)`);
}

/** Löscht die Lernbeispiele der übergebenen Dokumente (vor dem Löschen von Dokument/Vorgang). */
export async function loescheLernbeispiele(dokumente: Dokument[]): Promise<void> {
  const ids = dokumente.map((d) => d.profil?.lernbeispielId).filter((x): x is string => !!x);
  if (!ids.length) return;
  try {
    const { deleteExample } = await import('../../extraction/learning/examples');
    for (const id of ids) await deleteExample(WOHNGELD_PROFIL_ID, id);
  } catch (err) {
    console.warn('[wohngeld] Lernbeispiel nicht gelöscht:', err instanceof Error ? err.message : err);
  }
}

/** Lernbeispiele aller Dokumente eines Vorgangs löschen. */
export async function loescheLernbeispieleVorgang(vorgangId: string): Promise<void> {
  await loescheLernbeispiele(await listDokumente(vorgangId));
}

/**
 * Setzt die Unterlagen eines Falls zu EINER Sammel-PDF zusammen (Reihenfolge laut
 * Fall), wendet Störungen an (fehlende/doppelte Seiten, quer eingescannt) und
 * protokolliert die Seitenbereiche je Dokument für die Erwartungsdatei.
 */
import { PDFDocument, degrees } from 'pdf-lib';
import { erzeugeAntrag } from './formulare/antrag';
import { erzeugeVermieterbescheinigung } from './formulare/vermieterbescheinigung';
import { erzeugeGehaltsabrechnung } from './nachweise/gehaltsabrechnung';
import { erzeugeKontoauszug } from './nachweise/kontoauszug';
import { erzeugeMietvertrag } from './nachweise/mietvertrag';
import { erzeugePersonalausweis } from './nachweise/personalausweis';
import { erzeugeRentenbescheid } from './nachweise/rentenbescheid';
import { erzeugeHinweisblatt, erzeugeLeerseite, erzeugeMieterhoehung, erzeugeStromrechnung } from './nachweise/sonstige';
import type { DokArt, DokSpec, ErzeugtesDokument, Fall, Generator, Person } from './types';
import { ERWEITERUNGEN } from './nachweise/registry';

export function person(fall: Fall, id?: string): Person {
  const p = fall.personen.find((x) => x.id === (id ?? 'P1'));
  if (!p) throw new Error(`${fall.id}: Person ${id} unbekannt`);
  return p;
}

/** Basis-Generatoren (Pilot). Weitere Familien melden sich über eigene Tabellen an. */
const BASIS: Partial<Record<DokArt, Generator>> = {
  antrag: (f) => erzeugeAntrag(f),
  vermieterbescheinigung: (f) => erzeugeVermieterbescheinigung(f),
  personalausweis: (f, s) => erzeugePersonalausweis(f, person(f, s.person)),
  rentenbescheid: (f, s) => erzeugeRentenbescheid(f, person(f, s.person)),
  mietvertrag: (f) => erzeugeMietvertrag(f),
  kontoauszug: (f, s) => erzeugeKontoauszug(f, s),
  gehaltsabrechnung: (f, s) => erzeugeGehaltsabrechnung(f, person(f, s.person), s),
  mieterhoehung: (f) => erzeugeMieterhoehung(f),
  stromrechnung: (f) => erzeugeStromrechnung(f),
  hinweisblatt: () => erzeugeHinweisblatt(),
  leerseite: () => erzeugeLeerseite(),
};

const GENERATOREN: Partial<Record<DokArt, Generator>> = { ...BASIS, ...ERWEITERUNGEN };

export async function erzeugeDokument(fall: Fall, spec: DokSpec): Promise<ErzeugtesDokument> {
  const g = GENERATOREN[spec.art];
  if (!g) throw new Error(`${fall.id}: kein Generator für Dokumentart „${spec.art}"`);
  return g(fall, spec);
}

export interface DokumentEintrag {
  nr: number;
  seiteVon: number;
  seiteBis: number;
  typ: ErzeugtesDokument['typ'];
  art: ErzeugtesDokument['art'];
  titel: string;
  person?: string;
  monat?: string;
  erwartet?: ErzeugtesDokument['erwartet'];
  leerseite?: boolean;
  /** Seiten des Originaldokuments in Sendungsreihenfolge (Störungen sichtbar). */
  originalSeiten: number[];
  stoerungen: string[];
}

export async function setzeZusammen(fall: Fall): Promise<{ pdf: Uint8Array; dokumente: DokumentEintrag[] }> {
  const out = await PDFDocument.create();
  const dokumente: DokumentEintrag[] = [];

  for (const spec of fall.dokumente) {
    const d = await erzeugeDokument(fall, spec);
    const src = await PDFDocument.load(d.pdf);
    const n = src.getPageCount();
    let seiten = Array.from({ length: n }, (_, i) => i + 1);
    const stoerungen: string[] = [];
    if (spec.seitenFehlen?.length) {
      seiten = seiten.filter((s) => !spec.seitenFehlen!.includes(s));
      stoerungen.push(`Seite(n) ${spec.seitenFehlen.join(', ')} fehlen`);
    }
    if (spec.seitenDoppelt?.length) {
      seiten = seiten.flatMap((s) => (spec.seitenDoppelt!.includes(s) ? [s, s] : [s]));
      stoerungen.push(`Seite(n) ${spec.seitenDoppelt.join(', ')} doppelt eingescannt`);
    }
    if (spec.quer) stoerungen.push('quer eingescannt (90° gedreht)');

    const kopien = await out.copyPages(src, seiten.map((s) => s - 1));
    const von = out.getPageCount() + 1;
    for (const k of kopien) {
      if (spec.quer) k.setRotation(degrees(90));
      out.addPage(k);
    }
    dokumente.push({
      nr: dokumente.length + 1, seiteVon: von, seiteBis: out.getPageCount(),
      typ: d.typ, art: d.art, titel: d.titel, person: d.person ?? spec.person, monat: spec.monat,
      erwartet: d.erwartet, leerseite: d.leerseite, originalSeiten: seiten, stoerungen,
    });
  }

  out.setTitle(`Wohngeld Golden Dataset ${fall.id} — ${fall.titel}`);
  out.setSubject('SYNTHETISCH — Testdaten Wohngeld Golden Dataset, keine echten Personen');
  out.setProducer('wohngeld-golden');
  out.setCreator('wohngeld-golden');
  out.setKeywords(['synthetisch', 'golden-dataset', fall.id]);
  return { pdf: await out.save(), dokumente };
}

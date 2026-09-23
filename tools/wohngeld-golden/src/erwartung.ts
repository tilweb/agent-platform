/**
 * Erwartungsdatei („richtige Antwort") je Fall. Gilt für beide Varianten (digital
 * und scan haben identische Seitenbereiche).
 *
 * Prüfbefunde sind FACHLICH gemeint. Zusätzlich wird ausgewiesen, welche Befunde
 * die App nach heutiger Regel vermutlich zusätzlich meldet (bekannte Abweichungen,
 * siehe Katalog §7) — damit das Messwerkzeug diese nicht als Treffer/Fehler verwechselt.
 */
import type { DokumentEintrag } from './zusammensetzen';
import type { Fall } from './types';

export const SCHEMA = 'wohngeld-golden/expected@1';

function mitAntragFeldern(e: NonNullable<DokumentEintrag['erwartet']>, fall: Fall) {
  const ueber = fall.erwartung.antragFelder;
  if (!ueber) return e;
  return { ...e, stammdaten: { ...(e.stammdaten ?? {}), ...ueber } };
}

export function baueErwartung(fall: Fall, dokumente: DokumentEintrag[], seiten: number) {
  const hatDok = (typ: string, person: string) => dokumente.some((d) => d.typ === typ && d.person === person);
  const vermutlichZusaetzlich: Array<{ regelId: string; person: string; grund: string }> = [];
  for (const p of fall.personen) {
    if (!hatDok('kv_pv_nachweis', p.id)) {
      vermutlichZusaetzlich.push({ regelId: 'krankenversicherung-nachweis', person: p.id, grund: 'App verlangt KV/PV-Nachweis für jede Person; fachlich meist über Gehaltsabrechnung/Rentenbescheid belegt' });
    }
    const erwachsen = Number(fall.antragsdatum.slice(0, 4)) - Number(p.geburtsdatum.slice(0, 4)) >= 18;
    if (!erwachsen && !hatDok('personalausweis', p.id)) {
      vermutlichZusaetzlich.push({ regelId: 'identitaet-jede-person', person: p.id, grund: 'App verlangt Ausweis auch für Kinder' });
    }
  }

  return {
    schema: SCHEMA,
    fall: fall.id,
    titel: fall.titel,
    gruppe: fall.gruppe,
    varianten: {
      digital: `${fall.id}-digital.pdf`,
      scan: `${fall.id}-scan.pdf`,
    },
    seiten,
    personen: fall.personen.map((p) => ({ id: p.id, vorname: p.vorname, nachname: p.nachname, geburtsdatum: p.geburtsdatum, rolle: p.id === 'P1' ? 'antragsteller' : p.verhaeltnis })),
    dokumente: dokumente.map((d) => ({
      nr: d.nr,
      seiteVon: d.seiteVon,
      seiteBis: d.seiteBis,
      typ: d.typ,
      art: d.art,
      titel: d.titel,
      ...(d.person ? { person: d.person } : {}),
      ...(d.monat ? { monat: d.monat } : {}),
      ...(d.leerseite ? { leerseite: true, hinweis: 'Leere Rückseite — darf beim Split auch dem Nachbardokument zugeschlagen werden' } : {}),
      ...(d.stoerungen.length ? { stoerungen: d.stoerungen, originalSeiten: d.originalSeiten } : {}),
      ...(d.erwartet ? { erwartet: d.art === 'antrag' ? mitAntragFeldern(d.erwartet, fall) : d.erwartet } : {}),
    })),
    pruefung: {
      befunde: fall.erwartung.befunde,
      befundeOhneAppRegel: fall.erwartung.befundeOhneAppRegel,
      standardbefunde: fall.unterschrift.antragDatum ? ['bwz-vorschlag-pruefen'] : [],
      appVermutlichZusaetzlich: vermutlichZusaetzlich,
    },
    ...(fall.erwartung.hinweise?.length ? { hinweise: fall.erwartung.hinweise } : {}),
  };
}

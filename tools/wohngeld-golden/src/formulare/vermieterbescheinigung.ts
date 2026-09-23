/**
 * Vermieterbescheinigung (amtliche Vorlage, 2 Seiten), vom Vermieter ausgefüllt.
 * Enthält immer die TATSÄCHLICHEN Mietwerte (nicht die ggf. abweichenden Antragsangaben).
 */
import { join } from 'node:path';
import { VORLAGEN, datum, eur } from '../lib';
import type { ErzeugtesDokument, Fall } from '../types';
import { Formular } from './pdfform';

/** Datum der Bescheinigung: 6 Tage vor dem Antrag. */
function bescheinigungsDatum(fall: Fall): string {
  const d = new Date(`${fall.antragsdatum}T00:00:00Z`);
  d.setUTCDate(d.getUTCDate() - 6);
  return d.toISOString().slice(0, 10);
}

export async function erzeugeVermieterbescheinigung(fall: Fall): Promise<ErzeugtesDokument> {
  const f = await Formular.laden(join(VORLAGEN, '2024_vermieterbescheinigung.pdf'));
  f.schriftgroesse = 9;
  const w = fall.wohnung;
  const erwachsene = fall.personen.filter((p) => p.id === 'P1' || /(ehe|partner)/i.test(p.verhaeltnis ?? ''));
  const mieter = erwachsene.map((p) => `${p.nachname}, ${p.vorname}`).join(' und ');
  const gesamt = w.grundmiete + w.nebenkosten + w.heizkosten + w.warmwasser;
  const p1 = fall.personen[0]!;

  f.text('Auskunftsersuchen Name', `${p1.nachname}, ${p1.vorname}`);
  f.text('Auskunftsersuchen Anschrift', `${w.plz} ${w.ort}, ${w.strasse} ${w.hausnummer}`);
  f.text('Mietpartei Name', mieter);
  f.text('Beginn Mietverhältnis', datum(w.mietbeginn));
  f.text('Wohnfläche', String(w.flaeche).replace('.', ','));
  f.text('Miete', eur(gesamt));
  f.text('Datum Mietzahlung', datum(w.mieteSeit));

  if (w.heizkosten > 0) { f.radio('Heizkosten', 1); f.text('Betrag Heizkosten', eur(w.heizkosten)); } else f.radio('Heizkosten', 0);
  if (w.warmwasser > 0) { f.radio('Warmwasser', 1); f.text('Betrag Warmwasser', eur(w.warmwasser)); } else f.radio('Warmwasser', 0);
  for (const rg of ['Garage', 'Stellplatz', 'Strom', 'Pflegeleistung', 'Sonstiges']) f.radio(rg, 0);
  f.radio('Förderung', w.gefoerdert ? 1 : 0);
  if (w.gefoerdert) f.text('Jahr Förderung', '1994');
  f.text('Mietschulden', 'keine');
  const ort = fall.vermieter.plzOrt.replace(/^\d+\s*/, '');
  const am = bescheinigungsDatum(fall);
  f.text('Ort, Datum', `${ort}, ${datum(am)}`);
  f.unterschrift(1, 305, 34, fall.vermieter.vertreter ?? fall.vermieter.name, 110);

  const pdf = await f.flach({ titel: `Vermieterbescheinigung ${p1.nachname}` });
  return {
    art: 'vermieterbescheinigung', typ: 'mietbescheinigung', titel: 'Vermieterbescheinigung', pdf,
    erwartet: {
      analyse: {
        miete: Math.round((gesamt - w.heizkosten - w.warmwasser) * 100) / 100,
        wohnflaeche_qm: w.flaeche,
        unterschrift_vorhanden: true,
      },
      identitaet: { nachname: p1.nachname, vorname: p1.vorname },
    },
  };
}

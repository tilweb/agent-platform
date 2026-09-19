/**
 * Vollständigkeitsprüfung — welche erforderlichen Nachweise fehlen?
 * Reine Funktionen, Input = VorgangSnapshot. Regel-IDs & Recht siehe
 * docs/wohngeld-regelkatalog-2026-09-18.md (Abschnitt 1).
 */
import type { VorgangSnapshot, Person, Dokument, DokumentTyp, PruefBefund } from '../types';

function hasDocForPerson(dokumente: Dokument[], typ: DokumentTyp, personId: string): boolean {
  return dokumente.some(d => d.typ === typ && d.personId === personId);
}
function hasDocHousehold(dokumente: Dokument[], ...typen: DokumentTyp[]): boolean {
  return dokumente.some(d => typen.includes(d.typ));
}
function hasDocForPersonAny(dokumente: Dokument[], personId: string, ...typen: DokumentTyp[]): boolean {
  return dokumente.some(d => d.personId === personId && typen.includes(d.typ));
}
function incomeArten(person: Person): Set<string> {
  return new Set((person.einkommen ?? []).map(p => p.art));
}
function personLabel(p: Person): string {
  return `${p.vorname} ${p.nachname}`.trim() || 'Person';
}

export function pruefeNachweise(snapshot: VorgangSnapshot): PruefBefund[] {
  const { vorgang, personen, dokumente } = snapshot;
  const befunde: PruefBefund[] = [];

  // ── Essenzielle Kernangaben (Erfassungs-Vollständigkeit, fallübergreifend) ──
  // Prüft, ob die Basis-Stammdaten überhaupt erfasst sind — unabhängig von Nachweisen.
  const hatAntragstellerName = personen.some(p => `${p.vorname} ${p.nachname}`.trim().length > 0);
  const w = vorgang.wohnung ?? {};
  const hatAdresse = (!!w.plz && !!w.ort) || !!w.strasse;
  const hatMiete = vorgang.wohngeldart !== 'mietzuschuss' || (w.miete ?? 0) > 0;
  const fehlend: string[] = [];
  if (!hatAntragstellerName) fehlend.push('Name des Antragstellers');
  if (!vorgang.antragsdatum) fehlend.push('Antragsdatum');
  if (!hatAdresse) fehlend.push('Adresse (PLZ/Ort oder Straße)');
  if (!hatMiete) fehlend.push('Miethöhe (Mietzuschuss)');
  if (personen.length === 0) fehlend.push('mindestens eine Person im Haushalt');
  if (fehlend.length > 0) {
    befunde.push({
      regelId: 'essenzielle-angaben', kategorie: 'vollstaendigkeit', typ: 'anforderung',
      titel: 'Essenzielle Angaben fehlen',
      belegtext: `Folgende Kernangaben zum Vorgang fehlen und sollten vor der Prüfung erfasst werden: ${fehlend.join(', ')}.`,
    });
  }

  // ── Haushalt / Antrag ────────────────────────────────────────────────
  if (!hasDocHousehold(dokumente, 'wohngeldantrag')) {
    befunde.push({
      regelId: 'antrag-vollstaendig-unterschrieben', kategorie: 'vollstaendigkeit', typ: 'anforderung',
      titel: 'Vollständiger, unterschriebener Antrag',
      belegtext: 'Es liegt kein ausgefüllter und unterschriebener Wohngeldantrag vor (§ 22 WoGG; §§ 60 ff. SGB I).',
    });
  }

  // ── Mietzuschuss-spezifische Wohnraumnachweise ───────────────────────
  if (vorgang.wohngeldart === 'mietzuschuss') {
    if (!hasDocHousehold(dokumente, 'mietvertrag')) {
      befunde.push({
        regelId: 'mietvertrag', kategorie: 'vollstaendigkeit', typ: 'anforderung',
        titel: 'Aktueller Mietvertrag',
        belegtext: 'Für den Mietzuschuss ist ein aktueller Mietvertrag erforderlich (§ 3 Abs. 1 WoGG).',
      });
    }
    if (!hasDocHousehold(dokumente, 'mietbescheinigung')) {
      befunde.push({
        regelId: 'vermieterbescheinigung', kategorie: 'vollstaendigkeit', typ: 'anforderung',
        titel: 'Vermieterbescheinigung',
        belegtext: 'Angaben des Vermieters zum Wohnraum (Miethöhe, Wohnfläche, Bezugsdatum) fehlen (§§ 9, 11 WoGG).',
      });
    }
    if (!hasDocHousehold(dokumente, 'kontoauszug')) {
      befunde.push({
        regelId: 'mietzahlungsnachweis', kategorie: 'vollstaendigkeit', typ: 'anforderung',
        titel: 'Nachweis der Mietzahlung',
        belegtext: 'Nachweis der aktuellen Mietzahlung (Kontoauszug) fehlt (§ 9 WoGG).',
      });
    }
  }

  // ── Personenbezogene Nachweise ───────────────────────────────────────
  for (const p of personen) {
    const arten = incomeArten(p);
    const label = personLabel(p);

    // Identität — immer je Person
    if (!hasDocForPerson(dokumente, 'personalausweis', p.id)) {
      befunde.push({
        regelId: 'identitaet-jede-person', personId: p.id, kategorie: 'vollstaendigkeit', typ: 'anforderung',
        titel: 'Personalausweis',
        belegtext: `Identitätsnachweis (Personalausweis/Reisepass) für ${label} fehlt (§ 5 WoGG).`,
      });
    }

    // Kranken-/Pflegeversicherung — immer je Person (relevant für § 16)
    if (!hasDocForPerson(dokumente, 'kv_pv_nachweis', p.id)) {
      befunde.push({
        regelId: 'krankenversicherung-nachweis', personId: p.id, kategorie: 'vollstaendigkeit', typ: 'anforderung',
        titel: 'Nachweis Kranken-/Pflegeversicherung',
        belegtext: `Nachweis der Kranken-/Pflegeversicherung für ${label} fehlt (§ 16 WoGG).`,
      });
    }

    // Rente
    if (arten.has('rente') || p.erwerbsstatus === 'rente_pension') {
      if (!hasDocForPerson(dokumente, 'rentenbescheid', p.id)) {
        befunde.push({
          regelId: 'rentenbescheid', personId: p.id, kategorie: 'vollstaendigkeit', typ: 'anforderung',
          titel: 'Aktueller Rentenbescheid',
          belegtext: `Aktueller Rentenbescheid/Rentenanpassungsmitteilung für ${label} fehlt (§ 14 Abs. 2 WoGG).`,
        });
      }
    }

    // Abhängige Beschäftigung / Lohn
    if (arten.has('lohn_gehalt') || p.erwerbsstatus === 'angestellt') {
      if (!hasDocForPersonAny(dokumente, p.id, 'verdienstbescheinigung', 'gehaltsabrechnung')) {
        befunde.push({
          regelId: 'verdienstbescheinigung', personId: p.id, kategorie: 'vollstaendigkeit', typ: 'anforderung',
          titel: 'Verdienstbescheinigung / Gehaltsabrechnungen',
          belegtext: `Einkommensnachweis (Verdienstbescheinigung oder Gehaltsabrechnungen) für ${label} fehlt (§§ 14, 15 WoGG).`,
        });
      }
    }

    // Vermögen
    if ((p.vermoegen ?? 0) > 0) {
      if (!hasDocForPerson(dokumente, 'vermoegensnachweis', p.id)) {
        befunde.push({
          regelId: 'vermoegensnachweise', personId: p.id, kategorie: 'vollstaendigkeit', typ: 'anforderung',
          titel: 'Vermögensnachweise',
          belegtext: `Belege zum angegebenen Vermögen für ${label} fehlen (§ 21 Nr. 3 WoGG).`,
        });
      }
    }

    // Kindergeld
    if (p.erhaelt_kindergeld) {
      if (!hasDocForPerson(dokumente, 'kindergeldnachweis', p.id)) {
        befunde.push({
          regelId: 'kindergeld-nachweis', personId: p.id, kategorie: 'vollstaendigkeit', typ: 'anforderung',
          titel: 'Nachweis Kindergeld',
          belegtext: `Kindergeldbescheid/Nachweis für ${label} fehlt (§ 5, § 17 WoGG).`,
        });
      }
    }

    // Schwerbehinderung (Freibetrag § 17)
    if ((p.pflege_behinderung?.schwerbehinderungsgrad ?? 0) > 0) {
      if (!hasDocForPerson(dokumente, 'schwerbehindertenausweis', p.id)) {
        befunde.push({
          regelId: 'schwerbehinderung-nachweis', personId: p.id, kategorie: 'vollstaendigkeit', typ: 'anforderung',
          titel: 'Nachweis Schwerbehinderung',
          belegtext: `Schwerbehindertenausweis/Feststellungsbescheid (GdB) für ${label} fehlt (§ 17 Nr. 1 WoGG).`,
        });
      }
    }

    // Pflege (Freibetrag § 17)
    if ((p.pflege_behinderung?.pflegegrad ?? 0) > 0 || p.pflege_behinderung?.pflegebeduerftig) {
      if (!hasDocForPerson(dokumente, 'pflegenachweis', p.id)) {
        befunde.push({
          regelId: 'pflegegrad-nachweis', personId: p.id, kategorie: 'vollstaendigkeit', typ: 'anforderung',
          titel: 'Nachweis Pflegebedürftigkeit',
          belegtext: `Nachweis Pflegegrad/Pflegebedürftigkeit für ${label} fehlt (§ 17 Nr. 1 WoGG).`,
        });
      }
    }
  }

  return befunde;
}

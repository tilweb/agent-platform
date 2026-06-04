/**
 * Setup-Skript: Extraktions-Projekt "Sanitätshaus-Rezepte".
 *
 * Legt das Projekt (Felder + Strategie + stabile Domänen-Anweisungen) idempotent
 * an — bei erneutem Lauf wird das bestehende Projekt aktualisiert (Felder,
 * instructions, extraction-Config), gelernte Guidelines + Examples bleiben unberührt.
 *
 * Lauf:
 *   - Lokal/Scalingo (DB):   bun run scripts/create-sani-rezepte-project.ts
 *     (im backend/, mit DB-Env; auf Scalingo via `scalingo run`)
 *   - Railway (YAML):        bun run scripts/create-sani-rezepte-project.ts
 *     (schreibt data/extraction-projects/<id>/project.yaml)
 *
 * Danach: Beispiel-Rezepte im UI hochladen (Training-Tab), extrahieren,
 * korrigieren + trainieren.
 */

import { getAllProjects, createProject, updateProject } from '../src/extraction/learning';
import type { ProjectField } from '../src/extraction/learning/types';

const NAME = 'Sanitätshaus-Rezepte';

const FIELDS: Record<string, ProjectField> = {
  // --- Patient / Versicherter ---
  patient_nachname: { type: 'text', required: true, label: 'Nachname Patient', description: 'Nachname des Versicherten/Patienten' },
  patient_vorname: { type: 'text', required: true, label: 'Vorname Patient', description: 'Vorname des Versicherten/Patienten' },
  patient_geburtsdatum: { type: 'date', required: true, label: 'Geburtsdatum', description: 'Geburtsdatum, Format YYYY-MM-DD (auf dem Rezept meist DD.MM.YY)' },
  patient_adresse: { type: 'text', required: false, label: 'Adresse Patient', description: 'Straße, PLZ und Ort des Versicherten' },

  // --- Kostenträger / Versicherung ---
  rezept_typ: { type: 'text', required: false, label: 'Rezepttyp', description: 'GKV (Muster 16, rosa) oder Privat' },
  krankenkasse: { type: 'text', required: false, label: 'Krankenkasse / Kostenträger', description: 'Name der Kasse, z.B. AOK NordWest, DAK-Gesundheit, IKK classic' },
  kostentraeger_ik: { type: 'text', required: false, label: 'Kostenträgerkennung (IK)', description: '9-stellige Ziffernfolge, beginnt oft mit 10…' },
  versicherten_nr: { type: 'text', required: false, label: 'Versicherten-Nr.', description: '1 Buchstabe gefolgt von 9 Ziffern, z.B. A916455635' },
  versicherten_status: { type: 'text', required: false, label: 'Status', description: '7-stellige Statuskennung, z.B. 5000000' },

  // --- Arzt ---
  bsnr: { type: 'text', required: false, label: 'Betriebsstätten-Nr. (BSNR)', description: '9-stellige Ziffer; steht auch im Arztstempel und in der Ziffernzeile unten' },
  lanr: { type: 'text', required: false, label: 'Arzt-Nr. (LANR)', description: '9-stellige Ziffer' },
  arzt_name: { type: 'text', required: false, label: 'Arzt/Ärztin', description: 'Name aus dem Vertragsarztstempel' },
  arzt_fachrichtung: { type: 'text', required: false, label: 'Fachrichtung', description: 'z.B. Facharzt für Chirurgie, Allgemeinmedizin, Neurologie' },

  // --- Verordnung ---
  ausstellungsdatum: { type: 'date', required: true, label: 'Ausstellungsdatum', description: 'Datum der Verordnung, Format YYYY-MM-DD' },
  verordnung_text: { type: 'text', required: true, label: 'Verordnung (Rp.)', description: 'Vollständiger Verordnungstext des Hilfsmittels' },
  hilfsmittel_nummer: { type: 'text', required: false, label: 'Hilfsmittel-Nr. (HMV)', description: 'Hilfsmittelverzeichnis-Positionsnummer, Format NN.NN.NN.NNNN, oft mit Präfix "HM:"' },
  menge: { type: 'text', required: false, label: 'Menge', description: 'z.B. "1x", "2 Paar"' },
  diagnose_icd: { type: 'text', required: false, label: 'Diagnose (ICD-10)', description: 'ICD-10-Code(s), z.B. L98.4, R60.0, G35.20' },
  diagnose_text: { type: 'text', required: false, label: 'Diagnose (Klartext)', description: 'Freitext-Diagnose, z.B. "Z.n. Amputation li Bein"' },
  gebuehr_frei: { type: 'boolean', required: false, label: 'Gebührenbefreit', description: 'true, wenn das Feld "Gebühr frei" angekreuzt ist' },
  hinweis: { type: 'text', required: false, label: 'Hinweise', description: 'Zusatznotizen, z.B. "Genehmigung der KK nötig", "Wechselversorgung", "nach Maß"' },
};

const INSTRUCTIONS = `Du extrahierst Daten aus deutschen Hilfsmittel-Rezepten für ein Sanitätshaus.
Es handelt sich um gescannte Kassenrezepte (Muster 16, rosa) oder Privatrezepte (anderes Layout).

WICHTIG — typische Scan-Probleme:
- VERSATZ: Der gedruckte Inhalt ist oft gegen die Formular-Felder verschoben (Papiereinzug/Druckeinstellung).
  Ordne Werte NICHT nach Position zu, sondern nach Inhalt und Format:
  • Kostenträgerkennung (IK): 9 Ziffern, beginnt oft mit 10…
  • Versicherten-Nr.: 1 Buchstabe + 9 Ziffern
  • Status: 7 Ziffern
  • Betriebsstätten-Nr. (BSNR) und Arzt-Nr. (LANR): je 9 Ziffern
  • Datum: DD.MM.YY → als YYYY-MM-DD zurückgeben
- UNTERSCHRIFT: Die Arzt-Unterschrift überschreibt häufig BSNR, Stempel oder Datum.
  Lies den darunterliegenden Druck so gut wie möglich. Die BSNR steht meist zusätzlich
  im Arztstempel UND in der Ziffernzeile unten rechts — nutze diese zum Quer-Prüfen.
  Wenn ein Zeichen durch die Unterschrift verdeckt und unsicher ist: bestes Lesen mit
  niedriger Confidence, im Zweifel null statt geraten.
- BLASSER DRUCK / DURCHSCHEINEN: Lies auch kontrastarmen Text sorgfältig. Ignoriere
  gespiegelten/durchscheinenden Text (Sanitätshaus-Stempel von der Rückseite).
- MEHRSEITIG: Seiten, die nur einen Sanitätshaus-Stempel/Quittung enthalten (kein
  Rezept), liefern keine Felder — ignoriere sie.

Felder:
- Diagnose: ICD-10-Code(s) in "diagnose_icd", Klartext in "diagnose_text". Beides kann vorkommen.
- HMV-Nummer (z.B. 24.00.05.0002) in "hilfsmittel_nummer"; den vollen Rp-Text in "verordnung_text".
- Nichts erfinden. Felder, die nicht lesbar/vorhanden sind, als null zurückgeben.`;

const EXTRACTION = {
  strategy: 'vision-per-page' as const,
  vision_detail: 'high' as const,
  max_pages: 5,
  validation_repair: true,
};

async function main() {
  const existing = (await getAllProjects()).find((p) => p.name === NAME);

  if (existing) {
    await updateProject(existing.id, {
      fields: FIELDS,
      instructions: INSTRUCTIONS,
      extraction: EXTRACTION,
    });
    console.log(`[sani-rezepte] Projekt aktualisiert: ${existing.id} (${Object.keys(FIELDS).length} Felder)`);
  } else {
    const project = await createProject({
      name: NAME,
      description: 'Extraktion aus Sanitätshaus-Rezepten (Muster 16 / Privat)',
      fields: FIELDS,
      instructions: INSTRUCTIONS,
      extraction: EXTRACTION,
    });
    console.log(`[sani-rezepte] Projekt angelegt: ${project.id} (${Object.keys(FIELDS).length} Felder, Strategie ${EXTRACTION.strategy})`);
  }
}

main().then(() => process.exit(0)).catch((err) => {
  console.error('[sani-rezepte] Fehler:', err);
  process.exit(1);
});

import { test, expect, describe } from 'bun:test';
import { parseExtraktion } from './extraction';
import { mapPipelineToErgebnis, mapPipelineToAnalyse, schemaFuerTyp } from './extraction-schema';

// ── Klassifikator (parseExtraktion) — nur noch typ + titel ────────────────────

describe('parseExtraktion — Klassifikator (typ/titel)', () => {
  test('valides JSON mit typ + titel', () => {
    const r = parseExtraktion('{"typ":"wohngeldantrag","titel":"Antrag auf Wohngeld"}');
    expect(r.typ).toBe('wohngeldantrag');
    expect(r.titel).toBe('Antrag auf Wohngeld');
    expect(r.analyse).toEqual({});
    expect(r.stammdaten).toBeUndefined();
  });

  test('analyse/stammdaten im Klassifikator-JSON werden ignoriert', () => {
    const raw = JSON.stringify({
      typ: 'wohngeldantrag',
      titel: 'Antrag',
      analyse: { unterschrift_vorhanden: true, miete: 620.5 },
      stammdaten: { wohngeldart: 'mietzuschuss' },
    });
    const r = parseExtraktion(raw);
    expect(r.typ).toBe('wohngeldantrag');
    expect(r.analyse).toEqual({});
    expect(r.stammdaten).toBeUndefined();
  });

  test('extrahiert das JSON aus umgebendem Fließtext / Codefence', () => {
    const raw = 'Ergebnis:\n```json\n{"typ":"rentenbescheid","titel":"Rentenbescheid 2026"}\n```\nDanke.';
    const r = parseExtraktion(raw);
    expect(r.typ).toBe('rentenbescheid');
    expect(r.titel).toBe('Rentenbescheid 2026');
  });
});

describe('parseExtraktion — Fallback', () => {
  test('kaputtes JSON → sonstiges + leere Analyse', () => {
    const r = parseExtraktion('{ typ: kontoauszug, das ist kein json ');
    expect(r.typ).toBe('sonstiges');
    expect(r.analyse).toEqual({});
    expect(r.stammdaten).toBeUndefined();
  });

  test('leerer String → Fallback', () => {
    const r = parseExtraktion('');
    expect(r.typ).toBe('sonstiges');
    expect(r.analyse).toEqual({});
  });

  test('kein JSON-Objekt im Text → Fallback', () => {
    const r = parseExtraktion('Ich konnte das Dokument nicht klassifizieren.');
    expect(r.typ).toBe('sonstiges');
  });
});

describe('parseExtraktion — unbekannter typ', () => {
  test('unbekannter typ → sonstiges', () => {
    const r = parseExtraktion('{"typ":"steuerbescheid","titel":"X"}');
    expect(r.typ).toBe('sonstiges');
    expect(r.titel).toBe('X');
  });

  test('fehlender typ → sonstiges', () => {
    const r = parseExtraktion('{"titel":"ohne Typ"}');
    expect(r.typ).toBe('sonstiges');
  });
});

// ── Mapping Pipeline-Ergebnis → Wohngeld-Typen (rein, ohne LLM/DB) ────────────

describe('mapPipelineToErgebnis', () => {
  test('bildet Gruppen auf Stammdaten/Analyse + Confidence-Pfade ab', () => {
    const extracted = {
      antragsteller: { vorname: 'Erika', nachname: 'Mustermann', geburtsdatum: '1960-05-12' },
      adresse: { strasse: 'Hauptstr.', hausnummer: '5', plz: '12345', ort: 'Musterstadt' },
      wohnung: { miete: 620.5, wohnflaeche_qm: 55 },
      antrag: { antragsdatum: '2026-09-01', wohngeldart: 'mietzuschuss', antragsart: 'erstantrag' },
      analyse: { unterschrift_vorhanden: true, datum_vorhanden: true },
    };
    const fieldConfidences = {
      'antrag.antragsdatum': 0.95,
      'antrag.wohngeldart': 0.9,
      'adresse.strasse': 0.8,
      'wohnung.miete': 0.7,
      'antragsteller.nachname': 0.85,
      'antragsteller.vorname': 0.85,
      'analyse.unterschrift_vorhanden': 0.6, // kein feld_status-Pfad → verworfen
    };

    const r = mapPipelineToErgebnis(extracted, fieldConfidences);

    // Stammdaten
    expect(r.stammdaten.antragsdatum).toBe('2026-09-01');
    expect(r.stammdaten.wohngeldart).toBe('mietzuschuss');
    expect(r.stammdaten.antragsart).toBe('erstantrag');
    expect(r.stammdaten.antragsteller?.nachname).toBe('Mustermann');
    expect(r.stammdaten.adresse?.ort).toBe('Musterstadt');
    expect(r.stammdaten.wohnung?.miete).toBe(620.5);
    expect(r.stammdaten.wohnung?.wohnflaeche_qm).toBe(55);

    // Analyse
    expect(r.analyse.unterschrift_vorhanden).toBe(true);
    expect(r.analyse.datum_vorhanden).toBe(true);

    // Confidence: Pipeline-Pfad → feld_status-Pfad übersetzt
    expect(r.confidenceByPfad['antragsdatum']).toBe(0.95);
    expect(r.confidenceByPfad['wohngeldart']).toBe(0.9);
    expect(r.confidenceByPfad['wohnung.strasse']).toBe(0.8);
    expect(r.confidenceByPfad['wohnung.miete']).toBe(0.7);
    expect(r.confidenceByPfad['nachname']).toBe(0.85);
    expect(r.confidenceByPfad['vorname']).toBe(0.85);
    // Nicht-gemappte Pfade tauchen nicht auf
    expect(r.confidenceByPfad['analyse.unterschrift_vorhanden']).toBeUndefined();
    expect(r.confidenceByPfad['unterschrift_vorhanden']).toBeUndefined();
  });

  test('Enum-Guard: ungültige wohngeldart wird verworfen, gültige antragsart bleibt', () => {
    const r = mapPipelineToErgebnis(
      { antrag: { wohngeldart: 'quatsch', antragsart: 'erstantrag' } },
      {},
    );
    expect(r.stammdaten.wohngeldart).toBeUndefined();
    expect(r.stammdaten.antragsart).toBe('erstantrag');
  });

  test('deutsche Zahlenformate in wohnung werden normalisiert', () => {
    const r = mapPipelineToErgebnis(
      { wohnung: { miete: '1.234,56', wohnflaeche_qm: '72,5' } },
      {},
    );
    expect(r.stammdaten.wohnung?.miete).toBeCloseTo(1234.56, 2);
    expect(r.stammdaten.wohnung?.wohnflaeche_qm).toBeCloseTo(72.5, 2);
  });

  test('leeres Pipeline-Ergebnis → leere Stammdaten/Analyse/Confidence', () => {
    const r = mapPipelineToErgebnis({}, {});
    expect(r.stammdaten).toEqual({});
    expect(r.analyse).toEqual({});
    expect(r.confidenceByPfad).toEqual({});
  });
});

// ── Pro-Typ-Analyse (Nachweis-Dokumente, rein) ────────────────────────────────

describe('mapPipelineToAnalyse — je Dokumenttyp', () => {
  test('mietvertrag: miete/wohnflaeche/unterschrift', () => {
    const r = mapPipelineToAnalyse(
      'mietvertrag',
      { analyse: { miete: 620.5, wohnflaeche_qm: 55, unterschrift_vorhanden: false } },
      { 'analyse.miete': 0.9, 'analyse.wohnflaeche_qm': 0.8, 'analyse.unterschrift_vorhanden': 0.7 },
    );
    expect(r.analyse.miete).toBe(620.5);
    expect(r.analyse.wohnflaeche_qm).toBe(55);
    expect(r.analyse.unterschrift_vorhanden).toBe(false);
    expect(r.confidenceByPfad['miete']).toBe(0.9);
    expect(r.confidenceByPfad['unterschrift_vorhanden']).toBe(0.7);
  });

  test('mietbescheinigung: deutsche Zahlenformate werden normalisiert', () => {
    const r = mapPipelineToAnalyse(
      'mietbescheinigung',
      { analyse: { miete: '1.234,56', wohnflaeche_qm: '72,5' } },
      {},
    );
    expect(r.analyse.miete).toBeCloseTo(1234.56, 2);
    expect(r.analyse.wohnflaeche_qm).toBeCloseTo(72.5, 2);
  });

  test('kontoauszug: kapitalertraege_erkannt:true → erkannte_einkuenfte:[kapitalertraege]', () => {
    const r = mapPipelineToAnalyse(
      'kontoauszug',
      { analyse: { mietzahlung_erkannt: false, kapitalertraege_erkannt: true } },
      { 'analyse.kapitalertraege_erkannt': 0.75 },
    );
    expect(r.analyse.mietzahlung_erkannt).toBe(false);
    expect(r.analyse.erkannte_einkuenfte).toEqual(['kapitalertraege']);
    // Flag-Confidence zaehlt auf erkannte_einkuenfte
    expect(r.confidenceByPfad['erkannte_einkuenfte']).toBe(0.75);
  });

  test('kontoauszug: mieteinnahmen_erkannt:true → v_und_v, beide Flags kombiniert', () => {
    const r = mapPipelineToAnalyse(
      'kontoauszug',
      { analyse: { kapitalertraege_erkannt: true, mieteinnahmen_erkannt: true } },
      {},
    );
    expect(r.analyse.erkannte_einkuenfte).toEqual(['kapitalertraege', 'v_und_v']);
  });

  test('kontoauszug: keine Flags → kein erkannte_einkuenfte', () => {
    const r = mapPipelineToAnalyse(
      'kontoauszug',
      { analyse: { mietzahlung_erkannt: true } },
      {},
    );
    expect(r.analyse.mietzahlung_erkannt).toBe(true);
    expect(r.analyse.erkannte_einkuenfte).toBeUndefined();
  });

  test('rentenbescheid: rentenart/grundrentenzeiten/betrag', () => {
    const r = mapPipelineToAnalyse(
      'rentenbescheid',
      { analyse: { rentenart_vorhanden: true, grundrentenzeiten_vorhanden: false, betrag: 1450 } },
      { 'analyse.grundrentenzeiten_vorhanden': 0.65 },
    );
    expect(r.analyse.rentenart_vorhanden).toBe(true);
    expect(r.analyse.grundrentenzeiten_vorhanden).toBe(false);
    expect(r.analyse.betrag).toBe(1450);
    expect(r.confidenceByPfad['grundrentenzeiten_vorhanden']).toBe(0.65);
  });

  test('leeres Ergebnis → leere Analyse', () => {
    const r = mapPipelineToAnalyse('kontoauszug', {}, {});
    expect(r.analyse).toEqual({});
    expect(r.confidenceByPfad).toEqual({});
  });
});

describe('schemaFuerTyp — Selektor', () => {
  test('bekannte Typen liefern ein Schema', () => {
    // personalausweis liefert (nur) ein Identitäts-Schema fürs Zuordnungs-Matching.
    for (const typ of ['wohngeldantrag', 'personalausweis', 'mietvertrag', 'mietbescheinigung', 'kontoauszug', 'rentenbescheid'] as const) {
      expect(schemaFuerTyp(typ, 'single-pass')).not.toBeNull();
    }
  });

  test('beliebige/nicht fachspezifische Typen → generisches Identitäts-Schema (kein null)', () => {
    // Nachreichungen können alles sein: jeder Typ bekommt mind. ein Identitäts-Schema als Match-Signal.
    for (const typ of ['sonstiges', 'kindergeldnachweis', 'schwerbehindertenausweis', 'unterhaltsnachweis'] as const) {
      const schema = schemaFuerTyp(typ, 'single-pass');
      expect(schema).not.toBeNull();
      expect(schema.profile.fields.identitaet).toBeDefined();
    }
  });

  test('Strategy wird in die Config uebernommen', () => {
    expect(schemaFuerTyp('kontoauszug', 'hybrid')?.config.strategy).toBe('hybrid');
  });
});

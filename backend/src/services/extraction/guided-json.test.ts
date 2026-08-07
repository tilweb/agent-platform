import { describe, expect, test, afterEach } from 'bun:test';
import { buildGuidedJsonSchema, guidedJsonBody } from './extract-call';
import type { ExtractionProfile } from '../../extraction/types';

const profile: ExtractionProfile = {
  fields: {
    felder: {
      lieferscheinnummer: { type: 'text', required: true, label: 'Lieferscheinnummer' },
      lieferdatum: { type: 'date', required: true, label: 'Lieferdatum' },
      anzahl: { type: 'number', required: false, label: 'Anzahl' },
      handschrift: { type: 'boolean', required: false, label: 'Handschrift' },
    },
    positionen: {
      _array: true,
      _label: 'Positionen',
      _item_fields: {
        artikelnummer: { type: 'text', label: 'Artikelnummer' },
        menge: { type: 'number', label: 'Menge' },
      },
    },
  },
} as unknown as ExtractionProfile;

describe('buildGuidedJsonSchema', () => {
  const schema = buildGuidedJsonSchema(profile) as any;

  test('jedes Skalarfeld ist nullbar — sonst erzwingt der Guided Decode erfundene Werte', () => {
    const felder = schema.properties.felder;
    expect(felder.properties.lieferscheinnummer.type).toEqual(['string', 'null']);
    expect(felder.properties.lieferdatum.type).toEqual(['string', 'null']);
    expect(felder.properties.anzahl.type).toEqual(['number', 'null']);
    expect(felder.properties.handschrift.type).toEqual(['boolean', 'null']);
  });

  test('Struktur ist erzwungen: alle Schluessel required, keine erfundenen erlaubt', () => {
    expect(schema.required).toEqual(['felder', 'positionen']);
    expect(schema.additionalProperties).toBe(false);
    const felder = schema.properties.felder;
    expect(felder.required).toEqual(['lieferscheinnummer', 'lieferdatum', 'anzahl', 'handschrift']);
    expect(felder.additionalProperties).toBe(false);
  });

  test('Listen-Gruppen werden zu Arrays mit vollstaendigem Item-Schema', () => {
    const pos = schema.properties.positionen;
    expect(pos.type).toBe('array');
    expect(pos.items.properties.artikelnummer.type).toEqual(['string', 'null']);
    expect(pos.items.properties.menge.type).toEqual(['number', 'null']);
    expect(pos.items.required).toEqual(['artikelnummer', 'menge']);
    expect(pos.items.additionalProperties).toBe(false);
  });
});

describe('guidedJsonBody', () => {
  afterEach(() => { delete process.env.EXTRACTION_GUIDED_JSON; });

  test('liefert response_format mit dem Profil-Schema', () => {
    const body = guidedJsonBody(profile) as any;
    expect(body.response_format.type).toBe('json_schema');
    expect(body.response_format.json_schema.name).toBe('extraktion');
    expect(body.response_format.json_schema.schema.properties.felder).toBeDefined();
  });

  test('Kill-Switch EXTRACTION_GUIDED_JSON=0 schaltet ab', () => {
    process.env.EXTRACTION_GUIDED_JSON = '0';
    expect(guidedJsonBody(profile)).toBeNull();
  });
});

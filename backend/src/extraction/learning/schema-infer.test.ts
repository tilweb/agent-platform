import { describe, expect, test } from 'bun:test';
import { parseInferredFields, slugifyFieldId } from './schema-infer';

const GOOD = JSON.stringify({
  name: 'Eingangsrechnungen',
  description: 'Rechnungen von Lieferanten',
  fields: [
    { id: 'rechnungsnummer', label: 'Rechnungsnummer', type: 'text', required: true },
    { label: 'Rechnungsdatum', type: 'date' },
    { id: 'gesamtbetrag', label: 'Gesamtbetrag', type: 'number', description: 'Bruttobetrag' },
    {
      id: 'positionen',
      label: 'Positionen',
      type: 'list',
      item_fields: [
        { id: 'bezeichnung', label: 'Bezeichnung', type: 'text' },
        { id: 'betrag', label: 'Betrag', type: 'number' },
      ],
    },
  ],
});

describe('parseInferredFields', () => {
  test('sauberes JSON wird uebernommen', () => {
    const r = parseInferredFields(GOOD)!;
    expect(r.name).toBe('Eingangsrechnungen');
    expect(Object.keys(r.fields)).toEqual(['rechnungsnummer', 'rechnungsdatum', 'gesamtbetrag', 'positionen']);
    expect(r.fields.rechnungsnummer!.required).toBe(true);
    expect(r.fields.gesamtbetrag!.description).toBe('Bruttobetrag');
    expect(Object.keys(r.fields.positionen!.item_fields!)).toEqual(['bezeichnung', 'betrag']);
  });

  test('fehlende Id wird aus dem Label abgeleitet', () => {
    const r = parseInferredFields(JSON.stringify({ fields: [{ label: 'Lieferant Straße', type: 'text' }] }))!;
    expect(Object.keys(r.fields)).toEqual(['lieferant_strasse']);
  });

  test('JSON in Prosa und Codefence wird gefunden', () => {
    expect(parseInferredFields('Hier mein Vorschlag:\n```json\n' + GOOD + '\n```\nViel Erfolg!')).not.toBeNull();
    expect(parseInferredFields('<think>Ich ueberlege…</think>\n' + GOOD)).not.toBeNull();
  });

  test('doppelte Ids werden entdoppelt statt ueberschrieben', () => {
    const r = parseInferredFields(JSON.stringify({
      fields: [
        { id: 'betrag', label: 'Nettobetrag', type: 'number' },
        { id: 'betrag', label: 'Bruttobetrag', type: 'number' },
      ],
    }))!;
    expect(Object.keys(r.fields)).toEqual(['betrag', 'betrag_2']);
    expect(r.fields.betrag_2!.label).toBe('Bruttobetrag');
  });

  test('reservierter Gruppenname kollidiert nicht', () => {
    const r = parseInferredFields(JSON.stringify({ fields: [{ id: 'felder', label: 'Felder', type: 'text' }] }))!;
    expect(Object.keys(r.fields)).toEqual(['felder_2']);
  });

  test('ungueltige Typen und labellose Felder werden verworfen', () => {
    const r = parseInferredFields(JSON.stringify({
      fields: [
        { id: 'a', label: 'Gut', type: 'text' },
        { id: 'b', label: 'Kaputt', type: 'money' },
        { id: 'c', type: 'text' },
        'quatsch',
      ],
    }))!;
    expect(Object.keys(r.fields)).toEqual(['a']);
  });

  test('Listen ohne Spalten und mit verschachtelten Listen werden bereinigt', () => {
    expect(parseInferredFields(JSON.stringify({ fields: [{ id: 'p', label: 'Positionen', type: 'list' }] }))).toBeNull();
    const r = parseInferredFields(JSON.stringify({
      fields: [{
        id: 'p', label: 'Positionen', type: 'list',
        item_fields: [
          { id: 'unter', label: 'Unterliste', type: 'list' },
          { id: 'menge', label: 'Menge', type: 'number' },
        ],
      }],
    }))!;
    expect(Object.keys(r.fields.p!.item_fields!)).toEqual(['menge']);
  });

  test('Listen-Felder werden nie als Pflichtfeld vorgeschlagen', () => {
    const r = parseInferredFields(JSON.stringify({
      fields: [{ id: 'p', label: 'Positionen', type: 'list', required: true, item_fields: [{ id: 'x', label: 'X', type: 'text' }] }],
    }))!;
    expect(r.fields.p!.required).toBe(false);
  });

  test('Feld-Obergrenze wird eingehalten', () => {
    const many = Array.from({ length: 40 }, (_, i) => ({ id: `f${i}`, label: `Feld ${i}`, type: 'text' }));
    const r = parseInferredFields(JSON.stringify({ fields: many }))!;
    expect(Object.keys(r.fields)).toHaveLength(30);
  });

  test('Muell liefert null statt halbgarem Schema', () => {
    expect(parseInferredFields('kein json')).toBeNull();
    expect(parseInferredFields('')).toBeNull();
    expect(parseInferredFields(null)).toBeNull();
    expect(parseInferredFields(JSON.stringify({ fields: [] }))).toBeNull();
    expect(parseInferredFields(JSON.stringify({ name: 'Ohne Felder' }))).toBeNull();
  });
});

describe('slugifyFieldId', () => {
  test('normalisiert Umlaute, Sonderzeichen und Laenge', () => {
    expect(slugifyFieldId('Rechnungs-Nr.')).toBe('rechnungs_nr');
    expect(slugifyFieldId('Größe/Maß')).toBe('groesse_mass');
    expect(slugifyFieldId('  ')).toBe('');
    expect(slugifyFieldId('x'.repeat(80))).toHaveLength(60);
  });
});

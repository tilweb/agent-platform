import { expect, test } from 'bun:test';
import { abrechnungsPosten, fasseAbrechnungZusammen, produktFuerStrategie } from './produkte';

test('Strategie → Produkt', () => {
  expect(produktFuerStrategie('template-labelmap').id).toBe('formular');
  expect(produktFuerStrategie('long-text-chunked').id).toBe('text');
  expect(produktFuerStrategie('hybrid').id).toBe('standard');
  expect(produktFuerStrategie('general-document').id).toBe('standard');
  expect(produktFuerStrategie('segmented').id).toBe('vorgang');
  expect(produktFuerStrategie('contract-structured')).toEqual({ id: 'vertrag', label: 'Vertrag', kostenfaktor: 3 });
});

test('Abrechnung: mindestens eine Seite, gleiche Produkte zusammengefasst', () => {
  expect(abrechnungsPosten('hybrid', 0)).toEqual({ produkt: 'standard', seiten: 1, kostenfaktor: 1 });
  expect(fasseAbrechnungZusammen([abrechnungsPosten('hybrid', 3), abrechnungsPosten('vision-per-page', 2), abrechnungsPosten('contract-structured', 7)]))
    .toEqual([{ produkt: 'standard', seiten: 5, kostenfaktor: 1 }, { produkt: 'vertrag', seiten: 7, kostenfaktor: 3 }]);
});

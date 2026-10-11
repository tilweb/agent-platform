import { expect, test } from 'bun:test';
import { abrechnungsPosten, fasseAbrechnungZusammen, produktFuerStrategie, transkriptPosten } from './produkte';
import { hatTextDetail } from './learning/batch-runs';

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

test('Zusatz Transkript: Posten und Detail-Erkennung', () => {
  expect(transkriptPosten(0)).toEqual({ produkt: 'transkript', seiten: 1, kostenfaktor: 1 });
  expect(hatTextDetail({ strategy: 'hybrid', audit: null })).toBe(false);
  expect(hatTextDetail({ strategy: 'general-document', audit: null })).toBe(true);
  expect(hatTextDetail({ strategy: 'segmented', audit: { guideline_version: 1, model: 'm', zusatz: [transkriptPosten(3)] } })).toBe(true);
});

import { describe, expect, test } from 'bun:test';
import { baueUmschlag, type TeilErgebnis } from './umschlag';
import { eingangsModus, planeTeile } from './service';
import type { InboxPart, InboxUploadWithParts } from './store';

const upload = (teile: Partial<InboxPart>[], extra: Partial<InboxUploadWithParts> = {}): InboxUploadWithParts => ({
  id: 'inb_1', filename: 'vertrag.pdf', mimeType: 'application/pdf', pageCount: 7, status: 'ready', error: null, note: null,
  modus: 'vorgang', profilId: null, quelle: 'api', callbackUrl: null, webhookStatus: null, webhookError: null, abrechnung: null,
  createdAt: '', updatedAt: '',
  parts: teile.map((t, i) => ({ id: `t${i + 1}`, index: i, pageFrom: 1, pageTo: 7, filename: `teil-${i + 1}.pdf`, status: 'auto_routed', classification: { project_id: 'vertrag', confidence: 0.97, alternatives: [{ project_id: 'lieferschein', confidence: 0.1 }] }, targetProjectId: 'vertrag', batchRunId: 'run1', previewDataUri: null, ...t })),
  ...extra,
});
const datei = (x: Partial<TeilErgebnis['datei']> = {}): TeilErgebnis => ({
  datei: { status: 'completed', data: { a: 1 }, fieldConfidences: {}, reviewStatus: 'auto_ok', validations: [], strategy: 'contract-structured', error: null,
    audit: { guideline_version: 1, model: 'm', abrechnung: { produkt: 'vertrag', seiten: 7, kostenfaktor: 3 }, verbrauch: { aufrufe: 12, promptTokens: 50000, completionTokens: 9000, ohneAngabe: 0, modelle: {} } }, ...x },
});

describe('baueUmschlag', () => {
  test('Vorgang: ein Teil, fertig, Abrechnung Vertrag 7 Seiten, Verbrauch summiert', () => {
    const u = baueUmschlag(upload([{}]), { t1: datei() });
    expect(u.status).toBe('fertig');
    expect(u.teile).toHaveLength(1);
    expect(u.teile[0]).toMatchObject({ seiten: '1–7', seiten_anzahl: 7, profil: 'vertrag', status: 'fertig', zuordnung: { sicherheit: 0.97, kandidaten: [{ profil: 'lieferschein', sicherheit: 0.1 }], vorgegeben: false } });
    expect(u.abrechnung).toEqual([{ produkt: 'vertrag', seiten: 7, kostenfaktor: 3 }]);
    expect(u.verbrauch).toEqual({ aufrufe: 12, prompt_tokens: 50000, completion_tokens: 9000, ohne_angabe: 0 });
  });

  test('in Arbeit, solange ein Teil laeuft; abgebrochener Lauf ist Fehler', () => {
    expect(baueUmschlag(upload([{}]), { t1: datei({ status: 'processing' }) }).status).toBe('verarbeitung');
    const u = baueUmschlag(upload([{}]), { t1: { ...datei({ status: 'pending' }), laufAbgebrochen: true } });
    expect(u.status).toBe('fertig');
    expect(u.teile[0]).toMatchObject({ status: 'fehler', fehler: 'Verarbeitungslauf abgebrochen' });
  });

  test('Stapel: Basisprofil = kein_profil, zu pruefen, Stapel-Trennung abgerechnet', () => {
    const u = baueUmschlag(upload([
      { pageFrom: 1, pageTo: 3, targetProjectId: 'rechnung' },
      { pageFrom: 4, pageTo: 5, status: 'kein_profil', targetProjectId: 'allgemein', classification: { project_id: null, confidence: 0.3, alternatives: [] } },
    ], { modus: 'stapel', pageCount: 5 }), {
      t1: datei({ strategy: 'hybrid', reviewStatus: 'needs_review', audit: null }),
      t2: datei({ strategy: 'general-document', audit: null }),
    });
    expect(u.teile.map((t) => t.status)).toEqual(['zu_pruefen', 'kein_profil']);
    expect(u.abrechnung).toEqual([{ produkt: 'standard', seiten: 5, kostenfaktor: 1 }, { produkt: 'stapel-trennung', seiten: 5, kostenfaktor: 1 }]);
  });

  test('gescheiterter Upload', () => {
    expect(baueUmschlag(upload([], { status: 'failed', error: 'PDF kaputt' }), {})).toMatchObject({ status: 'fehler', fehler: 'PDF kaputt', teile: [] });
  });
});

describe('Eingangsmodus und Teile-Plan', () => {
  test('eingangsModus: Standard Vorgang, split rueckwaertskompatibel, modus hat Vorrang', () => {
    expect(eingangsModus(undefined, undefined)).toBe('vorgang');
    expect(eingangsModus(undefined, 'false')).toBe('vorgang');
    expect(eingangsModus(undefined, 'true')).toBe('stapel');
    expect(eingangsModus('vorgang', 'true')).toBe('vorgang');
    expect(eingangsModus('stapel', undefined)).toBe('stapel');
  });

  test('planeTeile: Vorgang = ein Teil; Stapel schneidet; unbeantwortete Grenze = kein Schnitt + gemeldet', () => {
    expect(planeTeile('vorgang', 7, [true, true])).toEqual({ ranges: [{ from: 1, to: 7 }], offeneGrenzen: [] });
    expect(planeTeile('stapel', 4, [false, true, false])).toEqual({ ranges: [{ from: 1, to: 2 }, { from: 3, to: 4 }], offeneGrenzen: [] });
    expect(planeTeile('stapel', 4, [true, null, false])).toEqual({ ranges: [{ from: 1, to: 1 }, { from: 2, to: 4 }], offeneGrenzen: [2] });
  });
});

import { test, expect, describe } from 'bun:test';
import { matchVorgaenge, normText, normDate, normId, type ScoredKandidat, type MatchKandidat } from './matching';

const KANDIDAT: MatchKandidat = {
  vorgangId: 'vorgang-1',
  antragsId: '123-456-789',
  akteName: 'Müller, Erika',
  antragstellerName: 'Müller, Erika',
  nachname: 'Müller',
  vorname: 'Erika',
  geburtsdatum: '1960-05-12',
  plz: '12345',
  ort: 'Musterstadt',
  strasse: 'Hauptstraße',
  hausnummer: '5',
};

function zeile(res: ScoredKandidat, feld: string) {
  return res.vergleich.find((v) => v.feld === feld);
}

describe('Normalisierung', () => {
  test('normText: lowercase, Umlaute, Whitespace', () => {
    expect(normText('Müßig  Straße')).toBe('muessig strasse');
    expect(normText('  Öl Ähre Über ')).toBe('oel aehre ueber');
  });
  test('normDate: TT.MM.JJJJ und JJJJ-MM-TT → ISO', () => {
    expect(normDate('12.05.1960')).toBe('1960-05-12');
    expect(normDate('1960-5-12')).toBe('1960-05-12');
  });
  test('normId: Trennzeichen ignorieren', () => {
    expect(normId('123-456-789')).toBe('123456789');
    expect(normId('AZ 12/34')).toBe('az1234');
  });
});

describe('matchVorgaenge', () => {
  test('klarer Treffer → level hoch, alle Signale gleich', () => {
    const res = matchVorgaenge(
      { nachname: 'Müller', vorname: 'Erika', geburtsdatum: '12.05.1960' },
      [KANDIDAT],
    );
    expect(res).toHaveLength(1);
    const top = res[0]!;
    expect(top.level).toBe('hoch');
    expect(top.vorgangId).toBe('vorgang-1');
    expect(zeile(top, 'nachname')?.status).toBe('gleich');
    expect(zeile(top, 'geburtsdatum')?.status).toBe('gleich');
  });

  test('Antrags-ID im Dokument → sehr starkes Signal, hoch', () => {
    const res = matchVorgaenge({ antragsId: '123 456 789' }, [KANDIDAT]);
    const top = res[0]!;
    expect(top.level).toBe('hoch');
    expect(zeile(top, 'antragsId')?.status).toBe('gleich');
  });

  test('Name gleich, Geburtsdatum abweichend → Abweichung markiert, Level gedämpft', () => {
    const res = matchVorgaenge(
      {
        nachname: 'Müller', vorname: 'Erika', geburtsdatum: '01.01.1975',
        plz: '12345', ort: 'Musterstadt', strasse: 'Hauptstraße', hausnummer: '5',
      },
      [KANDIDAT],
    );
    expect(res).toHaveLength(1);
    const top = res[0]!;
    // Rohscore läge (ohne Geburtsdatum) über der Hoch-Schwelle …
    expect(top.score).toBeGreaterThanOrEqual(55);
    // … die starke Abweichung dämpft aber auf „mittel".
    expect(top.level).toBe('mittel');
    expect(zeile(top, 'geburtsdatum')?.status).toBe('abweichung');
    expect(zeile(top, 'geburtsdatum')?.ausDokument).toBe('01.01.1975');
    expect(zeile(top, 'geburtsdatum')?.imVorgang).toBe('1960-05-12');
  });

  test('mehrere ähnliche Kandidaten → mehrere Vorschläge, absteigend sortiert', () => {
    const zweiterMueller: MatchKandidat = {
      vorgangId: 'vorgang-2', antragsId: '999-888-777',
      akteName: 'Müller, Hans', antragstellerName: 'Müller, Hans',
      nachname: 'Müller', vorname: 'Hans', geburtsdatum: '1955-03-03',
    };
    const res = matchVorgaenge(
      { nachname: 'Müller', vorname: 'Erika', geburtsdatum: '1960-05-12' },
      [zweiterMueller, KANDIDAT],
    );
    expect(res.length).toBeGreaterThanOrEqual(2);
    const [erster, zweiter] = [res[0]!, res[1]!];
    // Exakter Treffer (KANDIDAT) muss vor dem nur-Nachname-Treffer stehen.
    expect(erster.vorgangId).toBe('vorgang-1');
    expect(erster.score).toBeGreaterThan(zweiter.score);
    // Zweiter: nur Nachname gleich, Vorname/Geburtsdatum abweichend.
    expect(zeile(zweiter, 'nachname')?.status).toBe('gleich');
    expect(zeile(zweiter, 'vorname')?.status).toBe('abweichung');
  });

  test('keine identifizierenden Daten → leeres Ergebnis (kein Vorschlag)', () => {
    expect(matchVorgaenge({}, [KANDIDAT])).toEqual([]);
    expect(matchVorgaenge({ nachname: '   ' }, [KANDIDAT])).toEqual([]);
  });

  test('kein Signal-Überlapp → Kandidat mit score 0 wird ausgefiltert', () => {
    const res = matchVorgaenge({ nachname: 'Schmidt', geburtsdatum: '2000-01-01' }, [KANDIDAT]);
    expect(res).toEqual([]);
  });

  test('nur schwaches Signal (PLZ+Ort) → level gering', () => {
    const res = matchVorgaenge({ plz: '12345', ort: 'Musterstadt' }, [KANDIDAT]);
    expect(res).toHaveLength(1);
    const top = res[0]!;
    expect(top.level).toBe('gering');
    expect(zeile(top, 'plz')?.status).toBe('gleich');
  });

  test('fehlendes Feld im Vorgang → status fehlt', () => {
    const ohneGeburt: MatchKandidat = { ...KANDIDAT, geburtsdatum: undefined };
    const res = matchVorgaenge({ nachname: 'Müller', geburtsdatum: '1960-05-12' }, [ohneGeburt]);
    expect(zeile(res[0]!, 'geburtsdatum')?.status).toBe('fehlt');
  });
});

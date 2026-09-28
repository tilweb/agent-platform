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

  test('Name + Adresse gleich, Geburtsdatum abweichend → andere Person, kein Vorschlag (gering)', () => {
    const res = matchVorgaenge(
      {
        nachname: 'Müller', vorname: 'Erika', geburtsdatum: '01.01.1975',
        plz: '12345', ort: 'Musterstadt', strasse: 'Hauptstraße', hausnummer: '5',
      },
      [KANDIDAT],
    );
    expect(res).toHaveLength(1);
    const top = res[0]!;
    expect(top.level).toBe('gering');
    expect(zeile(top, 'geburtsdatum')?.status).toBe('abweichung');
    expect(zeile(top, 'geburtsdatum')?.ausDokument).toBe('01.01.1975');
    expect(zeile(top, 'geburtsdatum')?.imVorgang).toBe('1960-05-12');
  });

  test('nur Nachname gleich, sonst alles abweichend → kein Kandidat (Rückmeldung aus dem Test)', () => {
    const reinhardt: MatchKandidat = {
      vorgangId: 'vorgang-r', antragsId: '832-458-318', nachname: 'Reinhardt', vorname: 'Werner', geburtsdatum: '1958-08-22',
      plz: '79104', ort: 'Freiburg', strasse: 'Höhenweg', hausnummer: '4',
    };
    const res = matchVorgaenge(
      { nachname: 'Reinhardt', vorname: 'Tobias', geburtsdatum: '1985-12-03', plz: '69124', ort: 'Heidelberg', strasse: 'Kirchheimer Feldweg', hausnummer: '42' },
      [reinhardt],
    );
    expect(res).toEqual([]);
  });

  test('nur Nachname gleich, übrige Angaben fehlen → gering, kein Vorschlag', () => {
    const res = matchVorgaenge({ nachname: 'Müller' }, [KANDIDAT]);
    expect(res[0]!.level).toBe('gering');
  });

  test('Nachname + Geburtsdatum gleich (Vorname fehlt) → hoch', () => {
    const res = matchVorgaenge({ nachname: 'Müller', geburtsdatum: '1960-05-12' }, [KANDIDAT]);
    expect(res[0]!.level).toBe('hoch');
  });

  test('Nachname + Adresse gleich, Rest fehlt → mittel', () => {
    const res = matchVorgaenge({ nachname: 'Müller', strasse: 'Hauptstraße', hausnummer: '5' }, [KANDIDAT]);
    expect(res[0]!.level).toBe('mittel');
  });

  test('Wohngeldnummer gleich, Geburtsdatum vertippt → bleibt Vorschlag (mittel)', () => {
    const res = matchVorgaenge({ aktenzeichen: '123-456-789', nachname: 'Müller', geburtsdatum: '12.05.1961' }, [KANDIDAT]);
    expect(res[0]!.level).toBe('mittel');
    expect(zeile(res[0]!, 'antragsId')?.label).toBe('Wohngeldnummer');
  });

  test('Namensvetter wird aussortiert, der echte Treffer bleibt', () => {
    const zweiterMueller: MatchKandidat = {
      vorgangId: 'vorgang-2', antragsId: '999-888-777',
      akteName: 'Müller, Hans', antragstellerName: 'Müller, Hans',
      nachname: 'Müller', vorname: 'Hans', geburtsdatum: '1955-03-03',
    };
    const res = matchVorgaenge(
      { nachname: 'Müller', vorname: 'Erika', geburtsdatum: '1960-05-12' },
      [zweiterMueller, KANDIDAT],
    );
    expect(res.map((r) => r.vorgangId)).toEqual(['vorgang-1']);
    expect(res[0]!.level).toBe('hoch');
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

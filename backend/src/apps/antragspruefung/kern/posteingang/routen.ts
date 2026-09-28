/**
 * Antrag-Kern — Posteingang: Routen-Fabrik der persistenten Warteschlange.
 *
 * Intake (`ingest`) ≠ Auswertung (`analysieren`) ≠ Zuordnung (`zuordnen`). Der Intake
 * speichert NUR (Dateien + Metadaten); die Auswertung startet die Sachbearbeitung manuell
 * und läuft im Hintergrund (Fortschritt am Eingang); die Zuordnung übernimmt die App.
 *
 * Fachliches kommt über Hooks der App:
 *  - `analysiere(dateien, { userId, melder })`     Erkennung/Trennung/Auslesen je Umschlag
 *  - `werteNeueDateienAus(dateien, { userId })`    Auslesen neu gebildeter Dateien nach manueller Trennung
 *  - `werteUmschlagAus(dateien, betreffAlt)`       Zuordnungs-Vorschlag + Betreff
 *  - `zuordnen(c, eingang, body)`                  fachliche Zuordnung an Akte/Vorgang
 *
 * `einliefern(dateien, meta)` ist die programmatische Einlieferung (Naht für einen späteren
 * gemeinsamen Eingang); die ingest-Route nutzt sie selbst.
 */
import { Hono, type Context } from 'hono';
import type { ContentfulStatusCode } from 'hono/utils/http-status';
import { getCurrentUserId } from '../../../../auth/middleware';
import type { Dateiablage } from '../dateiablage';
import type { KiBezug, KiVerbrauchUebersicht } from '../ki-verbrauch';
import { FortschrittMelder, istHaengend, type PosteingangFortschritt } from './fortschritt';
import {
  alleSpeicherRefs, bereicheText, ersetzeGruppe, findeOriginal, istPdf,
  type SeitenBereich, type Split,
} from './split';
import type { PosteingangStore } from './store';
import type { Posteingang, PosteingangDateiBasis, PosteingangQuelle } from './typen';
import { POSTEINGANG_QUELLEN } from './typen';
import { darfAuswerten, darfZuordnen, envelopeHash, istTerminal, sha256Hex, sha256HexString } from './zustand';

/** Audit-Ereignis des Posteingangs (Objekttyp immer `posteingang`). */
export interface PosteingangAuditEvent {
  aktion: string;
  objektTyp: 'posteingang';
  objektId?: string;
  vorgangId?: string;
  ergebnis?: 'ok' | 'fehler';
  detail?: string;
}

/** KI-Aktionen, die der Posteingang misst. */
export type PosteingangKiAktion = 'posteingang_auswertung' | 'posteingang_trennung';

/** Protokolleintrag einer automatischen Trennung (fürs Audit). */
export interface TrennProtokoll {
  dateiname: string;
  bereiche?: SeitenBereich[];
  modell?: string;
}

/** Ergebnis des fachlichen Zuordnungs-Hooks. */
export type ZuordnungErgebnis =
  | { ok: false; error: string; status: ContentfulStatusCode }
  | {
    ok: true;
    vorgangId: string;
    akteId: string;
    istNeuerVorgang: boolean;
    /** Audit-Detail, z. B. „Eingang dem Vorgang X zugeordnet (neuer Vorgang)". */
    detail: string;
    /** Weitere Felder der Antwort nach `posteingang` (z. B. vorgang, akte). */
    antwort: Record<string, unknown>;
  };

/** Eine einzuliefernde Datei (Bytes + Metadaten). */
export interface EinzulieferndeDatei {
  bytes: Uint8Array;
  dateiname: string;
  contentType?: string;
}

/** Metadaten einer Einlieferung. */
export interface EinlieferungMeta {
  /** Hono-Context des Aufrufers — Akteur (id, name, Rolle, IP) fürs Protokoll. */
  kontext: Context;
  quelle?: PosteingangQuelle;
  /** ISO — Default: jetzt. */
  eingegangenAm?: string;
  betreff?: string;
  idempotencyKey?: string;
  bearbeiterId?: string;
}

export type EinlieferungErgebnis<TEingang> =
  | { art: 'neu'; posteingang: TEingang }
  | { art: 'dublette'; posteingang: TEingang }
  | { art: 'zu_gross'; error: string };

export interface PosteingangRoutenOptionen<
  TDatei extends PosteingangDateiBasis,
  TMatch,
  TEingang extends Posteingang<TDatei, TMatch>,
> {
  store: PosteingangStore<TEingang>;
  ablage: Pick<Dateiablage, 'storeUpload' | 'resolveStorageRef' | 'loadDokumentDatei' | 'removeStoredFile'>;
  split: Pick<Split, 'trenneManuell'>;
  audit: (c: Context, e: PosteingangAuditEvent) => Promise<void>;
  kiVerbrauch: {
    messeKiVerbrauch: <T>(aktion: PosteingangKiAktion, bezug: KiBezug, fn: () => Promise<T>) => Promise<T>;
    ordneKiVerbrauchZu: (posteingangId: string, vorgangId: string, istNeuerVorgang: boolean) => Promise<void>;
    kiVerbrauchFuerPosteingang: (posteingangId: string) => Promise<KiVerbrauchUebersicht>;
  };
  guards: {
    denyIfNotAppEditor: (c: Context) => { error: string } | null;
    /** Art. 18: keine Nachreichung an einen eingeschränkten Vorgang (Body-Feld `vorgangId`). */
    denyIfVorgangEingeschraenkt?: (vorgangId: string) => Promise<{ error: string } | null>;
  };
  /** Seitenvorschau: Info (Art + Seitenzahl) und Seitenbild als HTTP-Antwort. */
  vorschau: {
    info: (bytes: Uint8Array, contentType?: string) => Promise<unknown>;
    seitenAntwort: (bytes: Uint8Array, contentType: string | undefined, seite: number) => Promise<Response>;
  };
  /** Auswertung eines Umschlags (Kopien der Dateien). Liefert die neue Dateiliste + Trennprotokoll. */
  analysiere: (dateien: TDatei[], ctx: { userId: string | null | undefined; melder: FortschrittMelder }) =>
    Promise<{ dateien: TDatei[]; protokoll: TrennProtokoll[] }>;
  /** Wertet neu gebildete Dateien nach manueller Trennung aus (mutiert die Dateien). */
  werteNeueDateienAus: (dateien: TDatei[], ctx: { userId: string | null | undefined }) => Promise<void>;
  /** Umschlag-Ebene nach der Auswertung: Zuordnungs-Vorschlag + Betreff. */
  werteUmschlagAus: (dateien: TDatei[], betreffAlt?: string) => Promise<{ matchVorschlag: TMatch[]; betreff?: string }>;
  /** Fachliche Zuordnung. Status-Gates (Terminal, ausgewertet) prüft der Kern vorher. */
  zuordnen: (c: Context, eingang: TEingang, body: Record<string, unknown>) => Promise<ZuordnungErgebnis>;
  /** Zulässige Kanäle der ingest-Route (unbekannt ⇒ 'manuell'). Default: alle. */
  quellen?: readonly PosteingangQuelle[];
  /** Obergrenze je Einlieferung (Summe aller Dateien). */
  maxGesamtBytes: number;
  logPraefix: string;
}

/** Sanitisierter Dateiname für Content-Disposition. */
function safeDispositionName(name: string): string {
  return (name || 'datei').replace(/[^a-zA-Z0-9_.\- ]/g, '_').slice(0, 200) || 'datei';
}

export function createPosteingangRoutes<
  TDatei extends PosteingangDateiBasis,
  TMatch,
  TEingang extends Posteingang<TDatei, TMatch>,
>(opts: PosteingangRoutenOptionen<TDatei, TMatch, TEingang>) {
  const { store, ablage, audit, kiVerbrauch, guards } = opts;
  const quellen = opts.quellen ?? POSTEINGANG_QUELLEN;
  const zuGross = `Upload zu groß (max. ${Math.round(opts.maxGesamtBytes / (1024 * 1024))} MB gesamt)`;
  const laufend = new Set<Promise<void>>();
  const routes = new Hono();

  // ── Einlieferung (nur speichern) ──────────────────────────────────────────

  /**
   * Speichert 1..n Dateien + Metadaten als Eingang. KEINE Analyse. Dedupe per
   * Umschlag-Hash (idempotencyKey bevorzugt, sonst über die Datei-Hashes).
   */
  async function einliefern(dateienIn: EinzulieferndeDatei[], meta: EinlieferungMeta): Promise<EinlieferungErgebnis<TEingang>> {
    const quelle: PosteingangQuelle = meta.quelle ?? 'manuell';
    const eingegangenAm = meta.eingegangenAm ?? new Date().toISOString();
    const dateien: TDatei[] = [];
    let total = 0;

    for (const f of dateienIn) {
      const bytes = f.bytes;
      total += bytes.length;
      if (total > opts.maxGesamtBytes) return { art: 'zu_gross', error: zuGross };
      const contentType = f.contentType || 'application/octet-stream';
      const stored = await ablage.storeUpload(bytes, f.dateiname, contentType);
      const ref = ablage.resolveStorageRef(stored.storageRef);
      dateien.push({
        dateiname: stored.filename,
        s3Key: ref.s3Key,
        pfad: ref.pfad,
        contentType,
        groesse: bytes.length,
        hash: sha256Hex(bytes),
      } as TDatei);
    }

    // Umschlag-Hash: bevorzugt idempotencyKey (Scan-Kanal), sonst über die Datei-Hashes.
    const hash = meta.idempotencyKey ? sha256HexString(meta.idempotencyKey) : envelopeHash(dateien.map((d) => d.hash));

    // Dedupe: existiert bereits ein nicht-verworfener Eingang mit gleichem Hash?
    const dup = await store.findePosteingangNachHash(hash);
    if (dup) {
      await audit(meta.kontext, {
        aktion: 'posteingang.dublette_ignoriert', objektTyp: 'posteingang', objektId: dup.id,
        detail: `Doppel-Einlieferung über ${quelle} anhand Umschlag-Hash erkannt`,
      });
      return { art: 'dublette', posteingang: dup };
    }

    const eingang = await store.createPosteingang({
      quelle, eingegangenAm, betreff: meta.betreff, hash, dateien,
      bearbeiterId: meta.bearbeiterId, status: 'eingegangen',
    } as Partial<TEingang>);
    await audit(meta.kontext, {
      aktion: 'posteingang.eingegangen', objektTyp: 'posteingang', objektId: eingang.id,
      detail: `${dateien.length} Datei(en) über „${quelle}" eingeliefert`,
    });
    return { art: 'neu', posteingang: eingang };
  }

  /**
   * POST /posteingang/ingest — Dieselbe Naht für Browser (manuell) und Scan-Pipeline.
   * Speichert 1..n Dateien (multipart) + optional quelle/eingegangenAm/betreff/
   * idempotencyKey. KEINE Analyse. Dedupe per Umschlag-Hash.
   */
  routes.post('/posteingang/ingest', async (c) => {
    const denied = guards.denyIfNotAppEditor(c);
    if (denied) return c.json(denied, 403);
    // TODO(S4/Service-Auth): Für die headless Scan-Pipeline Token-/mTLS-basierter
    // Zugang statt Session/Editor.

    const form = await c.req.formData();
    const files = form.getAll('files').filter((e): e is File => e instanceof File);
    const single = form.get('file');
    if (single instanceof File) files.push(single);
    if (!files.length) return c.json({ error: 'Keine Datei(en) im Feld "files" gefunden' }, 400);

    const quelleRaw = String(form.get('quelle') ?? 'manuell');
    const quelle: PosteingangQuelle = quellen.includes(quelleRaw as PosteingangQuelle) ? (quelleRaw as PosteingangQuelle) : 'manuell';
    const eingegangenAmRaw = form.get('eingegangenAm');
    const eingegangenAm = typeof eingegangenAmRaw === 'string' && eingegangenAmRaw.trim() ? eingegangenAmRaw.trim() : new Date().toISOString();
    const betreff = typeof form.get('betreff') === 'string' && String(form.get('betreff')).trim() ? String(form.get('betreff')).trim() : undefined;
    const idempotencyKey = typeof form.get('idempotencyKey') === 'string' ? String(form.get('idempotencyKey')).trim() : '';

    const dateien: EinzulieferndeDatei[] = [];
    for (const file of files) {
      dateien.push({ bytes: new Uint8Array(await file.arrayBuffer()), dateiname: file.name, contentType: file.type });
    }

    const r = await einliefern(dateien, {
      kontext: c, quelle, eingegangenAm, betreff,
      idempotencyKey: idempotencyKey || undefined,
      bearbeiterId: getCurrentUserId(c) ?? undefined,
    });
    if (r.art === 'zu_gross') return c.json({ error: r.error }, 413);
    if (r.art === 'dublette') return c.json({ duplicate: true, id: r.posteingang.id, posteingang: r.posteingang });
    return c.json({ id: r.posteingang.id, posteingang: r.posteingang }, 201);
  });

  // ── Liste / Detail / Datei ────────────────────────────────────────────────

  /** GET /posteingang — Queue (Filter status/quelle; Sortierung Eingangsdatum desc). */
  routes.get('/posteingang', async (c) => {
    const status = c.req.query('status') || undefined;
    const quelle = c.req.query('quelle') || undefined;
    const posteingang = await store.listPosteingang({ status, quelle });
    return c.json({ posteingang });
  });

  /** GET /posteingang/:id — Detail inkl. Dateien + Analyse + Match-Vorschlag. */
  routes.get('/posteingang/:id', async (c) => {
    const eingang = await store.getPosteingang(c.req.param('id'));
    if (!eingang) return c.json({ error: 'Eingang nicht gefunden' }, 404);
    return c.json({ posteingang: eingang });
  });

  /** GET /posteingang/:id/ki-verbrauch — Token-Verbrauch der Auswertungen dieses Eingangs. */
  routes.get('/posteingang/:id/ki-verbrauch', async (c) => {
    const id = c.req.param('id');
    if (!(await store.getPosteingang(id))) return c.json({ error: 'Eingang nicht gefunden' }, 404);
    return c.json(await kiVerbrauch.kiVerbrauchFuerPosteingang(id));
  });

  /** Datei eines Eingangs laden (gemeinsam für Vorschau-Info und Seitenbild). */
  async function ladeEingangsDatei(id: string, idxRaw: string) {
    const eingang = await store.getPosteingang(id);
    if (!eingang) return { fehler: 'Eingang nicht gefunden' as const };
    const idx = Number(idxRaw);
    const datei = Number.isInteger(idx) ? eingang.dateien[idx] : undefined;
    if (!datei) return { fehler: 'Datei nicht gefunden' as const };
    const bytes = await ablage.loadDokumentDatei({ s3Key: datei.s3Key, pfad: datei.pfad }).catch(() => null);
    if (!bytes) return { fehler: 'Keine Datei hinterlegt' as const };
    return { eingang, datei, bytes };
  }

  /** GET /posteingang/:id/datei/:idx/vorschau — { art: pdf|bild|keine, seiten } (Lesezugriff wird protokolliert). */
  routes.get('/posteingang/:id/datei/:idx/vorschau', async (c) => {
    const r = await ladeEingangsDatei(c.req.param('id'), c.req.param('idx'));
    if ('fehler' in r) return c.json({ error: r.fehler }, 404);
    await audit(c, { aktion: 'posteingang.datei_gelesen', objektTyp: 'posteingang', objektId: r.eingang.id, detail: `${r.datei.dateiname} (Vorschau)` });
    try {
      return c.json(await opts.vorschau.info(r.bytes, r.datei.contentType));
    } catch (err) {
      return c.json({ error: `Vorschau nicht möglich: ${err instanceof Error ? err.message : err}` }, 500);
    }
  });

  /** GET /posteingang/:id/datei/:idx/seite/:n — Seite n als PNG (Bilder: das Bild selbst). */
  routes.get('/posteingang/:id/datei/:idx/seite/:n', async (c) => {
    const r = await ladeEingangsDatei(c.req.param('id'), c.req.param('idx'));
    if ('fehler' in r) return c.json({ error: r.fehler }, 404);
    return opts.vorschau.seitenAntwort(r.bytes, r.datei.contentType, Number(c.req.param('n')));
  });

  /** GET /posteingang/:id/datei/:idx — Bytes einer Umschlag-Datei (inline). */
  routes.get('/posteingang/:id/datei/:idx', async (c) => {
    const eingang = await store.getPosteingang(c.req.param('id'));
    if (!eingang) return c.json({ error: 'Eingang nicht gefunden' }, 404);
    const idx = Number(c.req.param('idx'));
    const datei = Number.isInteger(idx) ? eingang.dateien[idx] : undefined;
    if (!datei) return c.json({ error: 'Datei nicht gefunden' }, 404);

    let bytes: Uint8Array | null;
    try {
      bytes = await ablage.loadDokumentDatei({ s3Key: datei.s3Key, pfad: datei.pfad });
    } catch {
      return c.json({ error: 'Datei konnte nicht geladen werden' }, 404);
    }
    if (!bytes) return c.json({ error: 'Keine Datei hinterlegt' }, 404);

    // Lesezugriff protokollieren (non-fatal — audit() schluckt Fehler selbst).
    await audit(c, { aktion: 'posteingang.datei_gelesen', objektTyp: 'posteingang', objektId: eingang.id, detail: datei.dateiname });

    const body = new Uint8Array(bytes);
    return new Response(body, {
      headers: {
        'Content-Type': datei.contentType || 'application/octet-stream',
        'Content-Disposition': `inline; filename="${safeDispositionName(datei.dateiname)}"`,
        'Content-Length': String(body.byteLength),
      },
    });
  });

  // ── Auswertung (manuell, einzeln + Sammel, im Hintergrund) ────────────────

  /**
   * POST /posteingang/analysieren — { ids: [...] }. Nimmt die Eingänge an (in_analyse,
   * Fortschritt „wartet") und wertet sie danach nacheinander im Hintergrund aus.
   * Hängende Auswertungen (ohne Fortschritt seit 10 Min.) dürfen neu gestartet werden.
   */
  routes.post('/posteingang/analysieren', async (c) => {
    const denied = guards.denyIfNotAppEditor(c);
    if (denied) return c.json(denied, 403);

    const body = await c.req.json<{ ids?: string[] }>().catch(() => null);
    const ids = Array.isArray(body?.ids) ? body!.ids.filter((x): x is string => typeof x === 'string') : [];
    if (!ids.length) return c.json({ error: 'Keine ids übergeben' }, 400);

    const userId = getCurrentUserId(c);
    const gestartet: string[] = [];
    const abgelehnt: Array<{ id: string; error: string }> = [];

    // Annehmen: Status „in_analyse", Fortschritt „wartet". Die Arbeit läuft danach im Hintergrund.
    for (const id of ids) {
      const eingang = await store.getPosteingang(id);
      if (!eingang) { abgelehnt.push({ id, error: 'Eingang nicht gefunden' }); continue; }
      const haengt = eingang.status === 'in_analyse' && istHaengend(eingang.data?.fortschritt as PosteingangFortschritt | undefined);
      if (!darfAuswerten(eingang.status) && !haengt) {
        abgelehnt.push({ id, error: `Status „${eingang.status}" ist nicht auswertbar` });
        continue;
      }
      await store.updatePosteingang(id, { status: 'in_analyse', bearbeiterId: userId ?? undefined } as Partial<TEingang>);
      const jetzt = new Date().toISOString();
      await store.setzePosteingangFortschritt(id, { phase: 'wartet', text: gestartet.length ? `Wartet (Position ${gestartet.length + 1})` : 'Startet …', gestartet: jetzt, aktualisiert: jetzt } satisfies PosteingangFortschritt);
      gestartet.push(id);
    }

    const arbeit = werteImHintergrundAus(c, gestartet, userId);
    laufend.add(arbeit);
    void arbeit.finally(() => laufend.delete(arbeit));
    return c.json({ gestartet, abgelehnt }, 202);
  });

  /** Umschlag-Ebene nach der Datei-Auswertung: Vorschlag, Betreff, Status. */
  async function umschlagAuswerten(dateien: TDatei[], betreffAlt?: string) {
    const { matchVorschlag, betreff } = await opts.werteUmschlagAus(dateien, betreffAlt);
    const alleFehler = dateien.length > 0 && dateien.every((d) => d.analyseFehler);
    return { matchVorschlag, betreff, alleFehler, status: (alleFehler ? 'fehler' : 'analysiert') as TEingang['status'] };
  }

  /** Wertet angenommene Eingänge nacheinander aus; Fehler je Eingang isoliert. */
  async function werteImHintergrundAus(c: Context, ids: string[], userId: string | null | undefined): Promise<void> {
    for (const id of ids) {
      const eingang = await store.getPosteingang(id);
      if (!eingang) continue;
      const melder = new FortschrittMelder(id, store.setzePosteingangFortschritt);
      try {
        // Token-Verbrauch der Auswertung dem Eingang zuschreiben (bei Zuordnung → Vorgang).
        const split = await kiVerbrauch.messeKiVerbrauch('posteingang_auswertung', {
          posteingangId: id, akteurId: userId, detail: `${eingang.dateien.length} Datei(en)`,
        }, () => opts.analysiere(eingang.dateien.map((d) => ({ ...d })), { userId, melder }));
        const dateien = split.dateien;
        for (const t of split.protokoll) {
          await audit(c, {
            aktion: 'posteingang.getrennt', objektTyp: 'posteingang', objektId: id,
            detail: `„${t.dateiname}" automatisch in ${t.bereiche?.length ?? 0} Dokumente getrennt (${bereicheText(t.bereiche)})${t.modell ? ` · Modell ${t.modell}` : ''}`,
          });
        }

        melder.setze({ phase: 'abschluss', text: 'Zuordnung zu bestehenden Vorgängen wird geprüft' });
        const { matchVorschlag, betreff, alleFehler, status } = await umschlagAuswerten(dateien, eingang.betreff);
        await store.updatePosteingang(id, { dateien, matchVorschlag, betreff, status } as Partial<TEingang>);

        await audit(c, {
          aktion: alleFehler ? 'posteingang.analyse_fehler' : 'posteingang.analysiert',
          objektTyp: 'posteingang', objektId: id, ergebnis: alleFehler ? 'fehler' : 'ok',
          detail: `${dateien.length} Datei(en) ausgewertet${matchVorschlag.length ? `, ${matchVorschlag.length} Vorschlag/Vorschläge` : ''}`,
        });
      } catch (err) {
        console.warn(`${opts.logPraefix} Auswertung fehlgeschlagen:`, id, err instanceof Error ? err.message : err);
        await store.updatePosteingang(id, { status: 'fehler' } as Partial<TEingang>).catch(() => null);
        await audit(c, {
          aktion: 'posteingang.analyse_fehler', objektTyp: 'posteingang', objektId: id, ergebnis: 'fehler',
          detail: err instanceof Error ? err.message : String(err),
        }).catch(() => {});
      } finally {
        await melder.ende();
      }
    }
  }

  /**
   * POST /posteingang/:id/trennung — { hash, startSeiten? }. Manuelle Korrektur des
   * Mehrdokument-Splits: `hash` = Hash des Originals (bzw. der ungetrennten Datei),
   * `startSeiten` = Seiten, auf denen ein neues Dokument beginnt. Leer/[1] ⇒ als ein
   * Dokument behandeln. War der Eingang schon ausgewertet, werden die neuen Dateien
   * sofort ausgewertet und der Vorschlag neu berechnet.
   */
  routes.post('/posteingang/:id/trennung', async (c) => {
    const denied = guards.denyIfNotAppEditor(c);
    if (denied) return c.json(denied, 403);

    const id = c.req.param('id');
    const eingang = await store.getPosteingang(id);
    if (!eingang) return c.json({ error: 'Eingang nicht gefunden' }, 404);
    if (istTerminal(eingang.status)) return c.json({ error: `Eingang ist bereits ${eingang.status}` }, 409);
    if (eingang.status === 'in_analyse') return c.json({ error: 'Auswertung läuft gerade — bitte kurz warten' }, 409);

    const body = await c.req.json<{ hash?: string; startSeiten?: unknown }>().catch(() => null);
    const hash = typeof body?.hash === 'string' ? body.hash : '';
    const startSeiten = Array.isArray(body?.startSeiten) ? body!.startSeiten.map((n) => Number(n)) : [];
    const gefunden = hash ? findeOriginal(eingang.dateien, hash) : null;
    if (!gefunden) return c.json({ error: 'Datei nicht gefunden' }, 404);
    if (!istPdf(gefunden.original)) return c.json({ error: 'Nur PDF-Dateien können getrennt werden' }, 400);

    let ergebnis: Awaited<ReturnType<typeof opts.split.trenneManuell<TDatei>>>;
    try {
      ergebnis = await opts.split.trenneManuell(gefunden.original, startSeiten);
    } catch (err) {
      return c.json({ error: err instanceof Error ? err.message : 'Trennung fehlgeschlagen' }, 400);
    }

    // Bytes der bisherigen Teile entfernen (best-effort) — das Original bleibt.
    const alteTeile = eingang.dateien.filter((d) => d.teilVon?.hash === hash);
    for (const t of alteTeile) await ablage.removeStoredFile({ s3Key: t.s3Key, pfad: t.pfad });

    const dateien = ersetzeGruppe(eingang.dateien, hash, ergebnis.dateien).map((d) => ({ ...d }));
    const userId = getCurrentUserId(c);
    let updates: Partial<TEingang> = { dateien } as Partial<TEingang>;
    if (eingang.status === 'analysiert' || eingang.status === 'fehler') {
      const neu = dateien.filter((d) => !d.typ && !d.analyseFehler);
      await kiVerbrauch.messeKiVerbrauch('posteingang_trennung', {
        posteingangId: id, akteurId: userId, detail: `${neu.length} Datei(en) neu ausgewertet`,
      }, () => opts.werteNeueDateienAus(neu, { userId }));
      const { matchVorschlag, betreff, status } = await umschlagAuswerten(dateien, eingang.betreff);
      updates = { dateien, matchVorschlag, betreff, status } as Partial<TEingang>;
    }
    const updated = await store.updatePosteingang(id, updates);

    await audit(c, {
      aktion: ergebnis.getrennt ? 'posteingang.getrennt' : 'posteingang.trennung_aufgehoben',
      objektTyp: 'posteingang', objektId: id,
      detail: ergebnis.getrennt
        ? `„${gefunden.original.dateiname}" manuell in ${ergebnis.bereiche?.length ?? 0} Dokumente getrennt (${bereicheText(ergebnis.bereiche)})`
        : `„${gefunden.original.dateiname}" manuell als ein Dokument (${ergebnis.seitenGesamt} Seiten) festgelegt`,
    });
    return c.json({ posteingang: updated });
  });

  // ── Zuordnung / Verwerfen / Patch / Löschen ───────────────────────────────

  /** POST /posteingang/:id/zuordnen — Body fachlich (Hook `zuordnen`). */
  routes.post('/posteingang/:id/zuordnen', async (c) => {
    const denied = guards.denyIfNotAppEditor(c);
    if (denied) return c.json(denied, 403);

    const id = c.req.param('id');
    const eingang = await store.getPosteingang(id);
    if (!eingang) return c.json({ error: 'Eingang nicht gefunden' }, 404);
    if (istTerminal(eingang.status)) return c.json({ error: `Eingang ist bereits ${eingang.status}` }, 409);
    if (!darfZuordnen(eingang.status)) return c.json({ error: 'Eingang muss zuerst ausgewertet werden' }, 409);

    const body = (await c.req.json<Record<string, unknown>>().catch(() => null)) ?? {};
    if (typeof body.vorgangId === 'string' && body.vorgangId) {
      const eingeschr = await guards.denyIfVorgangEingeschraenkt?.(body.vorgangId);
      if (eingeschr) return c.json(eingeschr, 403);
    }
    const result = await opts.zuordnen(c, eingang, body);
    if (!result.ok) return c.json({ error: result.error }, result.status);

    try {
      await kiVerbrauch.ordneKiVerbrauchZu(id, result.vorgangId, result.istNeuerVorgang);
    } catch (err) {
      console.error(`${opts.logPraefix} KI-Verbrauch nicht zugeordnet:`, err);
    }

    const updated = await store.updatePosteingang(id, {
      status: 'zugeordnet',
      zugeordneterVorgangId: result.vorgangId,
      zugeordneteAkteId: result.akteId,
      bearbeiterId: getCurrentUserId(c) ?? undefined,
    } as Partial<TEingang>);
    await audit(c, {
      aktion: 'posteingang.zugeordnet', objektTyp: 'posteingang', objektId: id, vorgangId: result.vorgangId,
      detail: result.detail,
    });

    return c.json({ posteingang: updated, ...result.antwort });
  });

  /** POST /posteingang/:id/verwerfen — { grund }. Setzt verworfen. */
  routes.post('/posteingang/:id/verwerfen', async (c) => {
    const denied = guards.denyIfNotAppEditor(c);
    if (denied) return c.json(denied, 403);

    const id = c.req.param('id');
    const eingang = await store.getPosteingang(id);
    if (!eingang) return c.json({ error: 'Eingang nicht gefunden' }, 404);
    if (istTerminal(eingang.status)) return c.json({ error: `Eingang ist bereits ${eingang.status}` }, 409);

    const body = await c.req.json<{ grund?: string }>().catch(() => null);
    const grund = typeof body?.grund === 'string' && body.grund.trim() ? body.grund.trim() : undefined;

    const updated = await store.updatePosteingang(id, { status: 'verworfen', verworfenGrund: grund, bearbeiterId: getCurrentUserId(c) ?? undefined } as Partial<TEingang>);
    await audit(c, { aktion: 'posteingang.verworfen', objektTyp: 'posteingang', objektId: id, detail: grund ?? 'ohne Grund' });
    return c.json({ posteingang: updated });
  });

  /** PATCH /posteingang/:id — Kleinkorrekturen: betreff, eingegangenAm, dateien[i].typ. */
  routes.patch('/posteingang/:id', async (c) => {
    const denied = guards.denyIfNotAppEditor(c);
    if (denied) return c.json(denied, 403);

    const id = c.req.param('id');
    const eingang = await store.getPosteingang(id);
    if (!eingang) return c.json({ error: 'Eingang nicht gefunden' }, 404);
    if (istTerminal(eingang.status)) return c.json({ error: `Eingang ist ${eingang.status} — keine Korrektur möglich` }, 409);

    const body = await c.req.json<{
      betreff?: string; eingegangenAm?: string;
      dateiTypen?: Array<{ index: number; typ: NonNullable<TDatei['typ']> }>;
    }>().catch(() => null);

    const updates: Partial<TEingang> = {};
    if (typeof body?.betreff === 'string') updates.betreff = body.betreff.trim() || undefined;
    if (typeof body?.eingegangenAm === 'string' && body.eingegangenAm.trim()) updates.eingegangenAm = body.eingegangenAm.trim();
    if (Array.isArray(body?.dateiTypen) && body.dateiTypen.length) {
      const dateien = eingang.dateien.map((d) => ({ ...d }));
      for (const u of body.dateiTypen) {
        if (Number.isInteger(u.index) && dateien[u.index]) dateien[u.index]!.typ = u.typ;
      }
      updates.dateien = dateien;
    }
    if (!Object.keys(updates).length) return c.json({ posteingang: eingang });

    const updated = await store.updatePosteingang(id, updates);
    await audit(c, { aktion: 'posteingang.geaendert', objektTyp: 'posteingang', objektId: id, detail: Object.keys(updates).join(', ') });
    return c.json({ posteingang: updated });
  });

  /** DELETE /posteingang/:id — Row löschen + lokale Bytes best-effort entfernen (DSGVO/Retention). */
  routes.delete('/posteingang/:id', async (c) => {
    const denied = guards.denyIfNotAppEditor(c);
    if (denied) return c.json(denied, 403);

    const id = c.req.param('id');
    const eingang = await store.getPosteingang(id);
    if (!eingang) return c.json({ error: 'Eingang nicht gefunden' }, 404);

    // Teile UND Originale getrennter Sammel-PDFs entfernen.
    for (const ref of alleSpeicherRefs(eingang.dateien)) {
      await ablage.removeStoredFile(ref);
    }
    const geloescht = await store.deletePosteingang(id);
    await audit(c, { aktion: 'posteingang.geloescht', objektTyp: 'posteingang', objektId: id, detail: `${eingang.dateien.length} Datei(en) entfernt` });
    return c.json({ ok: geloescht });
  });

  /** Wartet, bis alle laufenden Hintergrund-Auswertungen fertig sind (Tests, geordnetes Herunterfahren). */
  async function hintergrund(): Promise<void> {
    while (laufend.size) await Promise.allSettled([...laufend]);
  }

  return { routes, einliefern, hintergrund };
}

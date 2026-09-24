import { useEffect, useRef, useState } from 'react';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import { markdownZuText } from '../markdownText';
import { theme } from '../../../config/theme';
import {
  ChatIcon, SendIcon, XIcon, DocumentIcon, ScaleIcon,
  PenIcon, ClipboardIcon, LightningIcon, CheckIcon, RefreshIcon,
} from '../../../components/Icons';
import { wohngeldApi, ACCENT, ACCENT_LIGHT } from '../api';
import GesetzAntwort from './GesetzAntwort';

/** Akzent des Gesetz-Modus (Teal) — sichtbar anders als der Antrags-Modus (Blau). */
const GESETZ_ACCENT = theme.colors.primaryDark;
const GESETZ_LIGHT = theme.colors.primaryLight;

/** Startfragen im Gesetz-Modus. */
const GESETZ_VORSCHLAEGE = [
  'Was zählt zum Jahreseinkommen?',
  'Wer ist vom Wohngeld ausgeschlossen?',
  'Folgen fehlender Mitwirkung',
  '§ 5 WoGG',
];

/** Kontextuelle Startfragen (grounded Fall-Q&A). */
const VORSCHLAEGE = [
  'Was fehlt noch?',
  'Wie hoch ist das anrechenbare Einkommen?',
  'Ist die Miethöhe plausibel?',
  'Zählt Elterngeld zum Einkommen?',
];

/**
 * Fall-gebundenes Chat-Panel (schwebend, andockbar unten rechts).
 * Antworten kommen ausschließlich aus Vorgangsdaten (C1) und Rechts-Chunks (C2).
 * C3: Assistenz-Antworten in Schreiben/Textbaustein/Notiz übernehmen.
 * C4: vom Modell vorgeschlagene Aktionen — nur nach Klick + Bestätigung ausführen.
 *
 * Props:
 *  - vorgang: { id, antragsId }
 *  - onClose: () => void
 *  - onOpenDokument?: (dokumentId) => void  (optional, springt zum Dokumente-Tab)
 *  - canEdit?: boolean                       (nur dann Übernahme-/Aktions-Bedienung)
 *  - onDidMutate?: () => void                (nach Mutationen → Detail-Reload)
 */
// Markdown-Darstellung der Assistenten-Antworten (kompakt, im Stil der Chat-Blase).
const mdH = { fontWeight: 600, fontSize: theme.typography.sizes.sm, margin: '0.6em 0 0.25em' };
const mdZelle = { border: `1px solid ${theme.colors.border}`, padding: '0.25em 0.5em', textAlign: 'left', verticalAlign: 'top' };
const md = {
  p: ({ children }) => <p style={{ margin: '0 0 0.5em' }}>{children}</p>,
  ul: ({ children }) => <ul style={{ margin: '0.25em 0 0.5em', paddingLeft: '1.2em' }}>{children}</ul>,
  ol: ({ children }) => <ol style={{ margin: '0.25em 0 0.5em', paddingLeft: '1.2em' }}>{children}</ol>,
  li: ({ children }) => <li style={{ margin: '0.1em 0' }}>{children}</li>,
  h1: ({ children }) => <div style={mdH}>{children}</div>,
  h2: ({ children }) => <div style={mdH}>{children}</div>,
  h3: ({ children }) => <div style={mdH}>{children}</div>,
  h4: ({ children }) => <div style={mdH}>{children}</div>,
  strong: ({ children }) => <strong style={{ fontWeight: 600 }}>{children}</strong>,
  blockquote: ({ children }) => <blockquote style={{ margin: '0.3em 0', paddingLeft: '0.7em', borderLeft: `3px solid ${theme.colors.border}`, color: theme.colors.textSecondary }}>{children}</blockquote>,
  code: ({ children }) => <code style={{ background: theme.colors.surface, padding: '0.1em 0.3em', borderRadius: 4, fontSize: '0.9em' }}>{children}</code>,
  pre: ({ children }) => <pre style={{ margin: '0.3em 0', whiteSpace: 'pre-wrap', overflowX: 'auto' }}>{children}</pre>,
  a: ({ children, href }) => <a href={href} target="_blank" rel="noopener noreferrer" style={{ color: ACCENT }}>{children}</a>,
  table: ({ children }) => <div style={{ overflowX: 'auto', margin: '0.3em 0 0.5em' }}><table style={{ borderCollapse: 'collapse', fontSize: '0.95em' }}>{children}</table></div>,
  th: ({ children }) => <th style={{ ...mdZelle, fontWeight: 600, background: theme.colors.surface }}>{children}</th>,
  td: ({ children }) => <td style={mdZelle}>{children}</td>,
  hr: () => <hr style={{ border: 'none', borderTop: `1px solid ${theme.colors.border}`, margin: '0.5em 0' }} />,
};

function Markdown({ text }) {
  return <ReactMarkdown remarkPlugins={[remarkGfm]} components={md}>{text || ''}</ReactMarkdown>;
}

export default function FallChat({ vorgang, onClose, onOpenDokument, canEdit = false, onDidMutate }) {
  const [minimized, setMinimized] = useState(false);
  // Modus wählt nur der Mensch: 'antrag' (Fall-Chat) oder 'gesetz' (Wortlaut nachschlagen).
  const [modus, setModus] = useState('antrag');
  const [resetFrage, setResetFrage] = useState(false);
  const [messages, setMessages] = useState([]);
  const [input, setInput] = useState('');
  const [busy, setBusy] = useState(false);
  const [streamingText, setStreamingText] = useState('');
  const [error, setError] = useState('');
  // C3: Dialog „Als Textbaustein speichern".
  const [tbDialog, setTbDialog] = useState(null); // { text, kategorie, titel }
  // C4: Bestätigungsdialog vor Aktionsausführung.
  const [confirmAction, setConfirmAction] = useState(null); // { action }
  const [actionBusy, setActionBusy] = useState(false);
  const listRef = useRef(null);

  // Verlauf laden.
  useEffect(() => {
    let cancelled = false;
    wohngeldApi.getChat(vorgang.id)
      .then((msgs) => { if (!cancelled) setMessages(msgs || []); })
      .catch(() => { /* leerer Verlauf ist ok */ });
    return () => { cancelled = true; };
  }, [vorgang.id]);

  // Autoscroll ans Ende.
  useEffect(() => {
    if (listRef.current) listRef.current.scrollTop = listRef.current.scrollHeight;
  }, [messages, streamingText, minimized, modus]);

  /** Kurze, nicht-persistente Bestätigung inline im Verlauf. */
  function pushInfo(text) {
    setMessages((prev) => [...prev, { id: `info-${Date.now()}`, rolle: 'info', content: text, modus }]);
  }

  async function send(text) {
    const frage = (text ?? input).trim();
    if (!frage || busy) return;
    setError('');
    setInput('');
    setBusy(true);
    setStreamingText('');
    if (modus === 'gesetz') {
      const lokal = { id: `local-${Date.now()}`, rolle: 'user', content: frage, modus: 'gesetz' };
      setMessages((prev) => [...prev, lokal]);
      try {
        const { antwort } = await wohngeldApi.gesetzFrage(vorgang.id, frage);
        setMessages((prev) => [...prev, antwort]);
      } catch (e) {
        setError(e.message || 'Nachschlagen fehlgeschlagen');
      }
      setBusy(false);
      return;
    }
    // Optimistisch die Nutzerfrage anzeigen.
    setMessages((prev) => [...prev, { id: `local-${Date.now()}`, rolle: 'user', content: frage, modus: 'antrag' }]);

    let acc = '';
    await wohngeldApi.streamChat(vorgang.id, frage, {
      onDelta: (chunk) => { acc += chunk; setStreamingText(acc); },
      onDone: (msg, actions) => {
        setMessages((prev) => [...prev, msg || { id: `a-${Date.now()}`, rolle: 'assistant', content: acc, actions, modus: 'antrag' }]);
        setStreamingText('');
      },
      onError: (msg) => { setError(msg || 'Antwort fehlgeschlagen'); setStreamingText(''); },
    });
    setBusy(false);
  }

  // Verlauf des aktuellen Modus zurücksetzen (nach Bestätigung).
  async function resetVerlauf() {
    setBusy(true); setError('');
    try {
      await wohngeldApi.resetChat(vorgang.id, modus);
      setMessages((prev) => prev.filter((m) => (m.modus || 'antrag') !== modus));
      setStreamingText('');
    } catch (e) {
      setError(e.message || 'Zurücksetzen fehlgeschlagen');
    } finally {
      setResetFrage(false);
      setBusy(false);
    }
  }

  function onKeyDown(e) {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      send();
    }
  }

  // ── C3: Übernahme-Handler ──────────────────────────────────────────────────
  async function uebernehmenInSchreiben(text) {
    setError('');
    try {
      await wohngeldApi.anhaengenSchreibenText(vorgang.id, text);
      pushInfo('In das Anforderungsschreiben übernommen.');
      onDidMutate?.();
    } catch (e) { setError(e.message || 'Übernehmen fehlgeschlagen'); }
  }

  async function speichereTextbaustein() {
    if (!tbDialog) return;
    const titel = (tbDialog.titel || '').trim();
    if (!titel) return;
    setError('');
    try {
      await wohngeldApi.createTextbaustein({
        kategorie: (tbDialog.kategorie || '').trim() || 'Allgemein',
        titel,
        text: tbDialog.text,
      });
      setTbDialog(null);
      pushInfo('Als Textbaustein gespeichert.');
      onDidMutate?.();
    } catch (e) { setError(e.message || 'Speichern fehlgeschlagen'); }
  }

  async function speichereNotiz(text) {
    setError('');
    try {
      await wohngeldApi.addNotiz(vorgang.id, { anker: 'chat', text });
      pushInfo('Als Notiz gespeichert.');
      onDidMutate?.();
    } catch (e) { setError(e.message || 'Speichern fehlgeschlagen'); }
  }

  // ── C4: Aktions-Ausführung (nur nach Bestätigung) ──────────────────────────
  async function fuehreAktionAus(action) {
    setActionBusy(true);
    setError('');
    try {
      if (action.id === 'pruefen') await wohngeldApi.pruefen(vorgang.id);
      else if (action.id === 'schreiben_generieren') await wohngeldApi.generiereSchreiben(vorgang.id, {});
      else if (action.id === 'bwz_uebernehmen') await wohngeldApi.bwzVorschlagUebernehmen(vorgang.id);
      else { setConfirmAction(null); setActionBusy(false); return; }
      setConfirmAction(null);
      pushInfo(`Ausgeführt: ${action.label}.`);
      onDidMutate?.();
    } catch (e) {
      setConfirmAction(null);
      setError(e.message || 'Aktion fehlgeschlagen');
    } finally {
      setActionBusy(false);
    }
  }

  const gesetz = modus === 'gesetz';
  const sichtbar = messages.filter((m) => (m.modus || 'antrag') === modus);
  const hasMessages = sichtbar.length > 0 || (!gesetz && streamingText);
  const akzent = gesetz ? GESETZ_ACCENT : ACCENT;
  const vorschlaege = gesetz ? GESETZ_VORSCHLAEGE : VORSCHLAEGE;

  return (
    <div style={{ ...styles.panel, ...(gesetz ? styles.panelGesetz : {}), ...(minimized ? styles.panelMin : {}) }}>
      {/* Kopf */}
      <div style={{ ...styles.header, backgroundColor: akzent }}>
        <div style={styles.headerTitle}>
          {gesetz ? <ScaleIcon size={16} color="#fff" /> : <ChatIcon size={16} color="#fff" />}
          <span>{gesetz ? 'Gesetz nachschlagen' : `Vorgang ${vorgang.wohngeldnummer || vorgang.antragsId}`}</span>
        </div>
        <div style={styles.headerActions}>
          {canEdit && !minimized && sichtbar.length > 0 && (
            <button
              style={styles.headerBtn}
              onClick={() => setResetFrage(true)}
              disabled={busy}
              title="Verlauf zurücksetzen"
              aria-label="Verlauf zurücksetzen"
            >
              <RefreshIcon size={16} color="#fff" />
            </button>
          )}
          <button
            style={styles.headerBtn}
            onClick={() => setMinimized((m) => !m)}
            title={minimized ? 'Öffnen' : 'Minimieren'}
            aria-label={minimized ? 'Öffnen' : 'Minimieren'}
          >
            {minimized
              ? <ChatIcon size={16} color="#fff" />
              : <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#fff" strokeWidth="2"><line x1="5" y1="12" x2="19" y2="12" /></svg>}
          </button>
          <button style={styles.headerBtn} onClick={onClose} title="Schließen" aria-label="Schließen">
            <XIcon size={16} color="#fff" />
          </button>
        </div>
      </div>

      {!minimized && (
        <>
          {/* Moduswahl: nur durch den Menschen */}
          <div style={styles.modusLeiste} role="tablist" aria-label="Art der Frage">
            <button
              role="tab"
              aria-selected={!gesetz}
              style={{ ...styles.modusBtn, ...(!gesetz ? { ...styles.modusAktiv, color: ACCENT, borderColor: ACCENT } : {}) }}
              onClick={() => { setModus('antrag'); setResetFrage(false); }}
              disabled={busy}
            >
              <ChatIcon size={14} color={!gesetz ? ACCENT : theme.colors.textMuted} />
              Zum Antrag
            </button>
            <button
              role="tab"
              aria-selected={gesetz}
              style={{ ...styles.modusBtn, ...(gesetz ? { ...styles.modusAktiv, color: GESETZ_ACCENT, borderColor: GESETZ_ACCENT } : {}) }}
              onClick={() => { setModus('gesetz'); setResetFrage(false); }}
              disabled={busy}
            >
              <ScaleIcon size={14} color={gesetz ? GESETZ_ACCENT : theme.colors.textMuted} />
              Gesetz nachschlagen
            </button>
          </div>

          {resetFrage && (
            <div style={styles.resetLeiste} role="alertdialog" aria-label="Verlauf zurücksetzen">
              <span>Verlauf „{gesetz ? 'Gesetz nachschlagen' : 'Zum Antrag'}" für diesen Vorgang löschen?</span>
              <div style={{ display: 'flex', gap: theme.spacing.xs }}>
                <button style={styles.resetAbbrechen} onClick={() => setResetFrage(false)} disabled={busy}>Abbrechen</button>
                <button style={styles.resetLoeschen} onClick={resetVerlauf} disabled={busy}>Löschen</button>
              </div>
            </div>
          )}

          {/* Nachrichten */}
          <div style={{ ...styles.list, ...(gesetz ? { backgroundColor: theme.colors.background } : {}) }} ref={listRef}>
            {!hasMessages && (
              <div style={styles.empty}>
                {gesetz
                  ? 'Stellen Sie eine Frage zu WoGG, WoGV oder den Mitwirkungspflichten (§§ 60–67 SGB I). Angezeigt wird ausschließlich die passende Stelle im amtlichen Wortlaut — ohne Auslegung und ohne Bezug auf diesen Vorgang.'
                  : 'Fragen Sie zum Vorgang — die Antworten stützen sich ausschließlich auf die erfassten Vorgangsdaten und Nachweise.'}
              </div>
            )}

            {sichtbar.map((m) => (
              <MessageBubble
                key={m.id}
                message={m}
                canEdit={canEdit}
                onOpenDokument={onOpenDokument}
                onUebernehmen={uebernehmenInSchreiben}
                onTextbaustein={(text) => setTbDialog({ text, kategorie: 'Allgemein', titel: '' })}
                onNotiz={speichereNotiz}
                onAction={(action) => setConfirmAction({ action })}
              />
            ))}

            {!gesetz && streamingText && (
              <div style={styles.assistantRow}>
                <div style={styles.assistantBubble}><Markdown text={streamingText} /></div>
              </div>
            )}

            {busy && !streamingText && (
              <div style={styles.assistantRow}>
                <div style={{ ...styles.assistantBubble, color: theme.colors.textMuted }}>{gesetz ? 'Suche im Gesetz …' : 'Suche im Fall …'}</div>
              </div>
            )}

            {error && <div style={styles.error}>{error}</div>}
          </div>

          {/* Vorschlags-Chips */}
          <div style={styles.chips}>
            {vorschlaege.map((v) => (
              <button
                key={v}
                style={styles.chip}
                disabled={busy}
                onClick={() => send(v)}
                onMouseEnter={(e) => { if (!busy) e.currentTarget.style.backgroundColor = gesetz ? GESETZ_LIGHT : ACCENT_LIGHT; }}
                onMouseLeave={(e) => { e.currentTarget.style.backgroundColor = theme.colors.surface; }}
              >
                {v}
              </button>
            ))}
          </div>

          {/* Eingabe */}
          <div style={styles.inputRow}>
            <textarea
              style={styles.input}
              value={input}
              onChange={(e) => setInput(e.target.value)}
              onKeyDown={onKeyDown}
              placeholder={gesetz ? 'Frage zu WoGG, WoGV oder SGB I … oder z. B. „§ 14 WoGG"' : 'Frage zum Vorgang …'}
              rows={1}
              disabled={busy}
            />
            <button
              style={{ ...styles.sendBtn, backgroundColor: akzent, ...(busy || !input.trim() ? styles.sendBtnDisabled : {}) }}
              onClick={() => send()}
              disabled={busy || !input.trim()}
              title="Senden"
              aria-label="Senden"
            >
              <SendIcon size={16} color="#fff" />
            </button>
          </div>

          {/* Vertraulichkeitshinweis */}
          <div style={styles.hint}>
            {gesetz
              ? 'Zeigt ausschließlich den Gesetzeswortlaut — keine Auslegung, keine Anwendung auf den Fall. Quelle: gesetze-im-internet.de.'
              : 'Nachrichten werden vertraulich behandelt und nicht weitergegeben. Die Entscheidung im Einzelfall treffen Sie.'}
          </div>
        </>
      )}

      {/* C3: Dialog „Als Textbaustein speichern" */}
      {tbDialog && (
        <div style={styles.dialogOverlay} onClick={() => setTbDialog(null)}>
          <div style={styles.dialog} onClick={(e) => e.stopPropagation()}>
            <div style={styles.dialogTitle}>Als Textbaustein speichern</div>
            <label style={styles.dialogLabel}>Kategorie</label>
            <input
              style={styles.dialogInput}
              value={tbDialog.kategorie}
              onChange={(e) => setTbDialog((d) => ({ ...d, kategorie: e.target.value }))}
              placeholder="z. B. Miete, Einkommen, Allgemein"
            />
            <label style={styles.dialogLabel}>Titel</label>
            <input
              style={styles.dialogInput}
              value={tbDialog.titel}
              onChange={(e) => setTbDialog((d) => ({ ...d, titel: e.target.value }))}
              placeholder="Kurzer, wiedererkennbarer Titel"
              autoFocus
            />
            <div style={styles.dialogPreview}>{tbDialog.text}</div>
            <div style={styles.dialogActions}>
              <button style={styles.dialogCancel} onClick={() => setTbDialog(null)}>Abbrechen</button>
              <button
                style={{ ...styles.dialogConfirm, ...(tbDialog.titel.trim() ? {} : styles.sendBtnDisabled) }}
                onClick={speichereTextbaustein}
                disabled={!tbDialog.titel.trim()}
              >
                Speichern
              </button>
            </div>
          </div>
        </div>
      )}

      {/* C4: Bestätigungsdialog vor Aktionsausführung */}
      {confirmAction && (
        <div style={styles.dialogOverlay} onClick={() => !actionBusy && setConfirmAction(null)}>
          <div style={styles.dialog} onClick={(e) => e.stopPropagation()}>
            <div style={styles.dialogTitle}>Aktion ausführen?</div>
            <div style={styles.dialogText}>
              Die folgende Aktion wird jetzt im Vorgang ausgeführt:
              <div style={styles.dialogActionName}>{confirmAction.action.label}</div>
            </div>
            <div style={styles.dialogActions}>
              <button style={styles.dialogCancel} onClick={() => setConfirmAction(null)} disabled={actionBusy}>Abbrechen</button>
              <button
                style={{ ...styles.dialogConfirm, ...(actionBusy ? styles.sendBtnDisabled : {}) }}
                onClick={() => fuehreAktionAus(confirmAction.action)}
                disabled={actionBusy}
              >
                {actionBusy ? 'Führe aus …' : 'Ausführen'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

function MessageBubble({ message, canEdit, onOpenDokument, onUebernehmen, onTextbaustein, onNotiz, onAction }) {
  if (message.rolle === 'user') {
    return (
      <div style={styles.userRow}>
        <div style={styles.userBubble}>{message.content}</div>
      </div>
    );
  }

  if (message.modus === 'gesetz' && message.rolle === 'assistant') {
    return (
      <div style={styles.assistantRow}>
        <GesetzAntwort message={message} />
      </div>
    );
  }

  if (message.rolle === 'info') {
    return (
      <div style={styles.infoRow}>
        <CheckIcon size={13} color={theme.colors.success} />
        <span>{message.content}</span>
      </div>
    );
  }

  const actions = message.actions || [];
  return (
    <div style={styles.assistantRow}>
      <div style={styles.assistantBubble}><Markdown text={message.content} /></div>

      {message.sources && message.sources.length > 0 && (
        <div style={styles.sourceRow}>
          {message.sources.map((s) =>
            s.art === 'recht' ? (
              <button
                key={`recht-${s.ref}`}
                style={styles.sourceChip}
                onClick={() => { if (s.url) window.open(s.url, '_blank', 'noopener,noreferrer'); }}
                title={s.url ? `${s.label} – Gesetzestext öffnen` : s.label}
                disabled={!s.url}
              >
                <ScaleIcon size={12} color={ACCENT} />
                <span style={styles.sourceLabel}>{s.label}</span>
              </button>
            ) : (
              <button
                key={`dok-${s.dokumentId}`}
                style={styles.sourceChip}
                onClick={() => onOpenDokument?.(s.dokumentId)}
                title={s.label}
              >
                <DocumentIcon size={12} color={ACCENT} />
                <span style={styles.sourceLabel}>{s.label}</span>
              </button>
            ),
          )}
        </div>
      )}

      {/* C4: vorgeschlagene Aktionen (nur canEdit) */}
      {canEdit && actions.length > 0 && (
        <div style={styles.actionRow}>
          {actions.map((a) => (
            <button key={a.id} style={styles.actionBtn} onClick={() => onAction?.(a)} title={a.label}>
              <LightningIcon size={13} color="#fff" />
              <span>{a.label}</span>
            </button>
          ))}
        </div>
      )}

      {/* C3: dezentes Übernahme-Menü (nur canEdit, nur mit Inhalt) */}
      {canEdit && message.content && (
        <div style={styles.menuRow}>
          <button style={styles.menuBtn} onClick={() => onUebernehmen?.(markdownZuText(message.content))}>
            <PenIcon size={12} color={theme.colors.textMuted} />
            <span>In Anforderungsschreiben übernehmen</span>
          </button>
          <button style={styles.menuBtn} onClick={() => onTextbaustein?.(markdownZuText(message.content))}>
            <ClipboardIcon size={12} color={theme.colors.textMuted} />
            <span>Als Textbaustein speichern</span>
          </button>
          <button style={styles.menuBtn} onClick={() => onNotiz?.(markdownZuText(message.content))}>
            <DocumentIcon size={12} color={theme.colors.textMuted} />
            <span>Als Notiz speichern</span>
          </button>
        </div>
      )}
    </div>
  );
}

const styles = {
  panel: {
    position: 'fixed',
    bottom: theme.spacing.xl,
    right: theme.spacing.xl,
    width: '380px',
    maxWidth: 'calc(100vw - 32px)',
    maxHeight: 'calc(100vh - 96px)',
    display: 'flex',
    flexDirection: 'column',
    backgroundColor: theme.colors.surface,
    borderRadius: theme.borderRadius.xl,
    border: `1px solid ${theme.colors.border}`,
    boxShadow: '0 12px 32px rgba(0, 0, 0, 0.18)',
    zIndex: 1200,
    overflow: 'hidden',
  },
  resetLeiste: {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: theme.spacing.sm,
    flexWrap: 'wrap',
    padding: `${theme.spacing.sm} ${theme.spacing.md}`,
    fontSize: theme.typography.sizes.xs,
    color: theme.colors.text,
    backgroundColor: theme.colors.warningLight,
    borderBottom: `1px solid ${theme.colors.border}`,
  },
  resetAbbrechen: {
    padding: '3px 8px',
    fontSize: theme.typography.sizes.xs,
    color: theme.colors.text,
    backgroundColor: theme.colors.surface,
    border: `1px solid ${theme.colors.border}`,
    borderRadius: theme.borderRadius.sm,
    cursor: 'pointer',
  },
  resetLoeschen: {
    padding: '3px 8px',
    fontSize: theme.typography.sizes.xs,
    color: theme.colors.error,
    backgroundColor: theme.colors.surface,
    border: `1px solid ${theme.colors.error}30`,
    borderRadius: theme.borderRadius.sm,
    cursor: 'pointer',
  },
  panelGesetz: {
    width: '560px',
  },
  modusLeiste: {
    display: 'flex',
    gap: theme.spacing.xs,
    padding: `${theme.spacing.sm} ${theme.spacing.md}`,
    borderBottom: `1px solid ${theme.colors.border}`,
    backgroundColor: theme.colors.surface,
  },
  modusBtn: {
    flex: 1,
    display: 'inline-flex',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    padding: `6px ${theme.spacing.sm}`,
    fontSize: theme.typography.sizes.xs,
    fontWeight: theme.typography.weights.medium,
    color: theme.colors.textMuted,
    backgroundColor: 'transparent',
    border: `1px solid ${theme.colors.border}`,
    borderRadius: theme.borderRadius.md,
    cursor: 'pointer',
  },
  modusAktiv: {
    backgroundColor: theme.colors.surface,
    fontWeight: theme.typography.weights.semibold,
    boxShadow: '0 1px 2px rgba(0, 0, 0, 0.06)',
  },
  panelMin: {
    maxHeight: 'none',
  },
  header: {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: `${theme.spacing.md} ${theme.spacing.lg}`,
    backgroundColor: ACCENT,
    color: '#fff',
  },
  headerTitle: {
    display: 'flex',
    alignItems: 'center',
    gap: theme.spacing.sm,
    fontSize: theme.typography.sizes.sm,
    fontWeight: theme.typography.weights.semibold,
  },
  headerActions: {
    display: 'flex',
    gap: theme.spacing.xs,
  },
  headerBtn: {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    width: 26,
    height: 26,
    padding: 0,
    background: 'rgba(255, 255, 255, 0.15)',
    border: 'none',
    borderRadius: theme.borderRadius.md,
    cursor: 'pointer',
  },
  list: {
    flex: 1,
    overflowY: 'auto',
    padding: theme.spacing.lg,
    display: 'flex',
    flexDirection: 'column',
    gap: theme.spacing.md,
    minHeight: '200px',
  },
  empty: {
    fontSize: theme.typography.sizes.sm,
    color: theme.colors.textMuted,
    lineHeight: 1.5,
  },
  userRow: {
    display: 'flex',
    justifyContent: 'flex-end',
  },
  userBubble: {
    maxWidth: '85%',
    padding: `${theme.spacing.sm} ${theme.spacing.md}`,
    backgroundColor: ACCENT,
    color: '#fff',
    borderRadius: theme.borderRadius.lg,
    fontSize: theme.typography.sizes.sm,
    lineHeight: 1.5,
    whiteSpace: 'pre-wrap',
  },
  assistantRow: {
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'flex-start',
    gap: theme.spacing.xs,
  },
  assistantBubble: {
    maxWidth: '90%',
    padding: `${theme.spacing.sm} ${theme.spacing.md}`,
    backgroundColor: theme.colors.surfaceHover,
    color: theme.colors.text,
    borderRadius: theme.borderRadius.lg,
    fontSize: theme.typography.sizes.sm,
    lineHeight: 1.5,
    overflowWrap: 'anywhere',
  },
  infoRow: {
    display: 'flex',
    alignItems: 'center',
    gap: theme.spacing.xs,
    fontSize: theme.typography.sizes.xs,
    color: theme.colors.textMuted,
    fontStyle: 'italic',
  },
  sourceRow: {
    display: 'flex',
    flexWrap: 'wrap',
    gap: theme.spacing.xs,
  },
  sourceChip: {
    display: 'inline-flex',
    alignItems: 'center',
    gap: theme.spacing.xs,
    maxWidth: '100%',
    padding: `2px ${theme.spacing.sm}`,
    backgroundColor: ACCENT_LIGHT,
    color: ACCENT,
    border: 'none',
    borderRadius: theme.borderRadius.full,
    fontSize: theme.typography.sizes.xs,
    cursor: 'pointer',
  },
  sourceLabel: {
    overflow: 'hidden',
    textOverflow: 'ellipsis',
    whiteSpace: 'nowrap',
    maxWidth: '240px',
  },
  actionRow: {
    display: 'flex',
    flexWrap: 'wrap',
    gap: theme.spacing.xs,
    marginTop: theme.spacing.xs,
  },
  actionBtn: {
    display: 'inline-flex',
    alignItems: 'center',
    gap: theme.spacing.xs,
    padding: `${theme.spacing.xs} ${theme.spacing.md}`,
    backgroundColor: ACCENT,
    color: '#fff',
    border: 'none',
    borderRadius: theme.borderRadius.full,
    fontSize: theme.typography.sizes.xs,
    fontWeight: theme.typography.weights.medium,
    cursor: 'pointer',
  },
  menuRow: {
    display: 'flex',
    flexWrap: 'wrap',
    gap: theme.spacing.sm,
    marginTop: 2,
  },
  menuBtn: {
    display: 'inline-flex',
    alignItems: 'center',
    gap: theme.spacing.xs,
    padding: 0,
    background: 'none',
    border: 'none',
    color: theme.colors.textMuted,
    fontSize: theme.typography.sizes.xs,
    cursor: 'pointer',
  },
  chips: {
    display: 'flex',
    flexWrap: 'wrap',
    gap: theme.spacing.xs,
    padding: `0 ${theme.spacing.lg} ${theme.spacing.sm}`,
  },
  chip: {
    padding: `${theme.spacing.xs} ${theme.spacing.md}`,
    backgroundColor: theme.colors.surface,
    color: theme.colors.text,
    border: `1px solid ${theme.colors.border}`,
    borderRadius: theme.borderRadius.full,
    fontSize: theme.typography.sizes.xs,
    cursor: 'pointer',
    transition: `background-color ${theme.transitions.fast}`,
  },
  inputRow: {
    display: 'flex',
    alignItems: 'flex-end',
    gap: theme.spacing.sm,
    padding: `${theme.spacing.sm} ${theme.spacing.lg}`,
    borderTop: `1px solid ${theme.colors.border}`,
  },
  input: {
    flex: 1,
    resize: 'none',
    maxHeight: '96px',
    padding: theme.spacing.sm,
    border: `1px solid ${theme.colors.border}`,
    borderRadius: theme.borderRadius.lg,
    fontSize: theme.typography.sizes.sm,
    fontFamily: 'inherit',
    backgroundColor: theme.colors.surface,
    color: theme.colors.text,
    outline: 'none',
    lineHeight: 1.4,
  },
  sendBtn: {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    width: 36,
    height: 36,
    flexShrink: 0,
    backgroundColor: ACCENT,
    border: 'none',
    borderRadius: theme.borderRadius.lg,
    cursor: 'pointer',
  },
  sendBtnDisabled: {
    opacity: 0.5,
    cursor: 'not-allowed',
  },
  hint: {
    padding: `0 ${theme.spacing.lg} ${theme.spacing.md}`,
    fontSize: theme.typography.sizes.xs,
    color: theme.colors.textMuted,
    lineHeight: 1.4,
  },
  error: {
    fontSize: theme.typography.sizes.sm,
    color: theme.colors.error,
  },
  // Dialoge (C3 Textbaustein, C4 Aktions-Bestätigung)
  dialogOverlay: {
    position: 'fixed',
    top: 0, left: 0, right: 0, bottom: 0,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    zIndex: 1300,
  },
  dialog: {
    backgroundColor: theme.colors.surface,
    borderRadius: theme.borderRadius.xl,
    border: `1px solid ${theme.colors.border}`,
    padding: theme.spacing.xl,
    width: '90%',
    maxWidth: '420px',
    display: 'flex',
    flexDirection: 'column',
    gap: theme.spacing.sm,
    boxShadow: '0 12px 32px rgba(0, 0, 0, 0.24)',
  },
  dialogTitle: {
    fontSize: theme.typography.sizes.base,
    fontWeight: theme.typography.weights.semibold,
    color: theme.colors.text,
    marginBottom: theme.spacing.xs,
  },
  dialogLabel: {
    fontSize: theme.typography.sizes.xs,
    color: theme.colors.textMuted,
    fontWeight: theme.typography.weights.medium,
  },
  dialogInput: {
    width: '100%',
    padding: theme.spacing.sm,
    border: `1px solid ${theme.colors.border}`,
    borderRadius: theme.borderRadius.lg,
    fontSize: theme.typography.sizes.sm,
    fontFamily: 'inherit',
    backgroundColor: theme.colors.surface,
    color: theme.colors.text,
    outline: 'none',
  },
  dialogPreview: {
    maxHeight: '120px',
    overflowY: 'auto',
    padding: theme.spacing.sm,
    marginTop: theme.spacing.xs,
    backgroundColor: theme.colors.surfaceHover,
    borderRadius: theme.borderRadius.lg,
    fontSize: theme.typography.sizes.xs,
    color: theme.colors.textMuted,
    whiteSpace: 'pre-wrap',
    lineHeight: 1.5,
  },
  dialogText: {
    fontSize: theme.typography.sizes.sm,
    color: theme.colors.text,
    lineHeight: 1.5,
  },
  dialogActionName: {
    marginTop: theme.spacing.sm,
    padding: `${theme.spacing.sm} ${theme.spacing.md}`,
    backgroundColor: ACCENT_LIGHT,
    color: ACCENT,
    borderRadius: theme.borderRadius.lg,
    fontSize: theme.typography.sizes.sm,
    fontWeight: theme.typography.weights.medium,
  },
  dialogActions: {
    display: 'flex',
    justifyContent: 'flex-end',
    gap: theme.spacing.sm,
    marginTop: theme.spacing.md,
  },
  dialogCancel: {
    padding: `${theme.spacing.sm} ${theme.spacing.lg}`,
    backgroundColor: 'transparent',
    color: theme.colors.text,
    border: `1px solid ${theme.colors.border}`,
    borderRadius: theme.borderRadius.lg,
    fontSize: theme.typography.sizes.sm,
    fontWeight: theme.typography.weights.medium,
    cursor: 'pointer',
  },
  dialogConfirm: {
    padding: `${theme.spacing.sm} ${theme.spacing.lg}`,
    backgroundColor: ACCENT,
    color: '#fff',
    border: 'none',
    borderRadius: theme.borderRadius.lg,
    fontSize: theme.typography.sizes.sm,
    fontWeight: theme.typography.weights.medium,
    cursor: 'pointer',
  },
};

/**
 * LessonsLearnedView — Phase E
 *
 * Blade-Layout (analog Statusberichte):
 *   - Linke Spalte: Liste vorhandener Lessons Learned + "+ Neu"-Button
 *   - Rechte Spalte:
 *       - Wenn keine LL ausgewaehlt und nicht im Create-Mode:
 *         Default-Ansicht mit "KI-Vorschlaege"-Button. Nach Klick werden
 *         3-7 Vorschlaege aus den letzten Statusberichten generiert (LLM-
 *         Coach). User kann pro Vorschlag "Uebernehmen" druecken.
 *       - Wenn LL ausgewaehlt oder neu angelegt:
 *         Edit-Form (Titel + Themengebiet + Kategorie + 3 Textareas).
 *
 * SWOT-Kategorien werden farblich differenziert. Selectbox-Optionen kommen
 * aus der App-Config (lesson_themengebiet / lesson_kategorie), damit Admins
 * sie in den Einstellungen anpassen koennen.
 */

import { useEffect, useState, useCallback } from 'react';
import { theme } from '../../../config/theme';
import { useProjektmanagement, VersionConflictError } from '../../../hooks/useProjektmanagement';
import { TrashIcon, SparklesIcon } from '../../../components/Icons';

const KATEGORIE_STYLE = {
  strength: { bg: theme.colors.successLight, fg: theme.colors.success, label: 'Strength' },
  weakness: { bg: theme.colors.warningLight, fg: theme.colors.warning, label: 'Weakness' },
  opportunity: { bg: theme.colors.primaryLight, fg: theme.colors.primary, label: 'Opportunity' },
  threat: { bg: theme.colors.errorLight, fg: theme.colors.error, label: 'Threat' },
};

const styles = {
  container: {
    flex: 1,
    display: 'flex',
    overflow: 'hidden',
    height: '100%',
  },
  blade: {
    width: '260px',
    minWidth: '260px',
    borderRight: `1px solid ${theme.colors.border}`,
    display: 'flex',
    flexDirection: 'column',
    backgroundColor: theme.colors.surface,
    overflow: 'hidden',
  },
  bladeHeader: {
    padding: `${theme.spacing.md} ${theme.spacing.lg}`,
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
    borderBottom: `1px solid ${theme.colors.border}`,
  },
  bladeHeaderTitle: {
    fontSize: theme.typography.sizes.xs,
    fontWeight: theme.typography.weights.semibold,
    color: theme.colors.textMuted,
    textTransform: 'uppercase',
    letterSpacing: '0.05em',
  },
  bladeAddBtn: {
    border: 'none',
    background: theme.colors.primary,
    color: '#fff',
    borderRadius: theme.borderRadius.md,
    padding: `${theme.spacing.xs} ${theme.spacing.md}`,
    fontSize: theme.typography.sizes.xs,
    fontWeight: theme.typography.weights.medium,
    cursor: 'pointer',
  },
  list: {
    flex: 1,
    overflowY: 'auto',
    display: 'flex',
    flexDirection: 'column',
  },
  listItem: {
    display: 'flex',
    flexDirection: 'column',
    gap: theme.spacing.xs,
    padding: `${theme.spacing.md} ${theme.spacing.lg}`,
    cursor: 'pointer',
    transition: `background ${theme.transitions.fast}`,
    border: 'none',
    background: 'transparent',
    width: '100%',
    textAlign: 'left',
    borderBottom: `1px solid ${theme.colors.border}`,
  },
  listItemActive: {
    backgroundColor: theme.colors.primaryLight,
  },
  listItemTitle: {
    fontSize: theme.typography.sizes.sm,
    fontWeight: theme.typography.weights.medium,
    color: theme.colors.text,
    overflow: 'hidden',
    textOverflow: 'ellipsis',
    whiteSpace: 'nowrap',
  },
  listItemMeta: {
    display: 'flex',
    alignItems: 'center',
    gap: theme.spacing.sm,
    fontSize: theme.typography.sizes.xs,
    color: theme.colors.textMuted,
  },
  kategorieBadge: {
    fontSize: '10px',
    fontWeight: theme.typography.weights.semibold,
    padding: `2px ${theme.spacing.xs}`,
    borderRadius: theme.borderRadius.full,
    textTransform: 'uppercase',
    letterSpacing: '0.04em',
  },
  emptyList: {
    padding: theme.spacing.xl,
    fontSize: theme.typography.sizes.sm,
    color: theme.colors.textMuted,
    fontStyle: 'italic',
    textAlign: 'center',
  },
  // Right pane
  pane: {
    flex: 1,
    display: 'flex',
    flexDirection: 'column',
    overflow: 'auto',
    padding: theme.spacing['2xl'],
  },
  // Default (suggest)
  suggestHero: {
    maxWidth: 720,
    margin: '0 auto',
    textAlign: 'center',
    padding: theme.spacing['2xl'],
  },
  suggestTitle: {
    fontSize: theme.typography.sizes.xl,
    fontWeight: theme.typography.weights.semibold,
    color: theme.colors.text,
    marginBottom: theme.spacing.md,
  },
  suggestSubtitle: {
    fontSize: theme.typography.sizes.sm,
    color: theme.colors.textMuted,
    marginBottom: theme.spacing.xl,
    lineHeight: 1.6,
  },
  suggestButton: {
    display: 'inline-flex',
    alignItems: 'center',
    gap: theme.spacing.sm,
    padding: `${theme.spacing.md} ${theme.spacing.xl}`,
    backgroundColor: theme.colors.primary,
    color: '#fff',
    border: 'none',
    borderRadius: theme.borderRadius.lg,
    fontSize: theme.typography.sizes.base,
    fontWeight: theme.typography.weights.medium,
    cursor: 'pointer',
  },
  suggestButtonDisabled: {
    opacity: 0.6,
    cursor: 'wait',
  },
  // Suggestion cards
  suggestionList: {
    display: 'flex',
    flexDirection: 'column',
    gap: theme.spacing.lg,
    marginTop: theme.spacing.xl,
  },
  suggestionCard: {
    backgroundColor: theme.colors.surface,
    border: `1px solid ${theme.colors.border}`,
    borderRadius: theme.borderRadius.xl,
    padding: theme.spacing.xl,
    textAlign: 'left',
  },
  suggestionHeader: {
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    gap: theme.spacing.md,
    marginBottom: theme.spacing.md,
  },
  suggestionTitle: {
    fontSize: theme.typography.sizes.base,
    fontWeight: theme.typography.weights.semibold,
    color: theme.colors.text,
    flex: 1,
  },
  suggestionMeta: {
    fontSize: theme.typography.sizes.xs,
    color: theme.colors.textMuted,
    marginBottom: theme.spacing.md,
    display: 'flex',
    alignItems: 'center',
    gap: theme.spacing.sm,
  },
  suggestionField: {
    fontSize: theme.typography.sizes.sm,
    color: theme.colors.text,
    marginBottom: theme.spacing.md,
  },
  suggestionFieldLabel: {
    fontSize: theme.typography.sizes.xs,
    fontWeight: theme.typography.weights.semibold,
    color: theme.colors.textMuted,
    textTransform: 'uppercase',
    letterSpacing: '0.05em',
    marginBottom: theme.spacing.xs,
  },
  suggestionActions: {
    display: 'flex',
    gap: theme.spacing.md,
    marginTop: theme.spacing.lg,
    justifyContent: 'flex-end',
  },
  acceptBtn: {
    padding: `${theme.spacing.sm} ${theme.spacing.lg}`,
    backgroundColor: theme.colors.primary,
    color: '#fff',
    border: 'none',
    borderRadius: theme.borderRadius.lg,
    fontSize: theme.typography.sizes.sm,
    fontWeight: theme.typography.weights.medium,
    cursor: 'pointer',
  },
  dismissBtn: {
    padding: `${theme.spacing.sm} ${theme.spacing.lg}`,
    backgroundColor: 'transparent',
    color: theme.colors.textMuted,
    border: `1px solid ${theme.colors.border}`,
    borderRadius: theme.borderRadius.lg,
    fontSize: theme.typography.sizes.sm,
    cursor: 'pointer',
  },
  // Edit form
  form: {
    maxWidth: 880,
    margin: '0 auto',
    width: '100%',
    display: 'flex',
    flexDirection: 'column',
    gap: theme.spacing.lg,
  },
  formRow: {
    display: 'grid',
    gridTemplateColumns: '1fr 1fr',
    gap: theme.spacing.lg,
  },
  field: {
    display: 'flex',
    flexDirection: 'column',
    gap: theme.spacing.xs,
  },
  fieldLabel: {
    fontSize: theme.typography.sizes.sm,
    fontWeight: theme.typography.weights.medium,
    color: theme.colors.text,
  },
  fieldHint: {
    fontSize: theme.typography.sizes.xs,
    color: theme.colors.textMuted,
  },
  input: {
    width: '100%',
    padding: theme.spacing.md,
    border: `1px solid ${theme.colors.border}`,
    borderRadius: theme.borderRadius.lg,
    fontSize: theme.typography.sizes.sm,
    backgroundColor: theme.colors.surface,
    color: theme.colors.text,
    outline: 'none',
  },
  select: {
    width: '100%',
    padding: theme.spacing.md,
    border: `1px solid ${theme.colors.border}`,
    borderRadius: theme.borderRadius.lg,
    fontSize: theme.typography.sizes.sm,
    backgroundColor: theme.colors.surface,
    color: theme.colors.text,
    cursor: 'pointer',
    outline: 'none',
  },
  textarea: {
    width: '100%',
    padding: theme.spacing.md,
    border: `1px solid ${theme.colors.border}`,
    borderRadius: theme.borderRadius.lg,
    fontSize: theme.typography.sizes.sm,
    backgroundColor: theme.colors.surface,
    color: theme.colors.text,
    outline: 'none',
    minHeight: 96,
    resize: 'vertical',
    fontFamily: 'inherit',
  },
  formActions: {
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginTop: theme.spacing.lg,
  },
  formActionsRight: {
    display: 'flex',
    gap: theme.spacing.md,
  },
  primaryBtn: {
    padding: `${theme.spacing.sm} ${theme.spacing.lg}`,
    backgroundColor: theme.colors.primary,
    color: '#fff',
    border: 'none',
    borderRadius: theme.borderRadius.lg,
    fontSize: theme.typography.sizes.sm,
    fontWeight: theme.typography.weights.medium,
    cursor: 'pointer',
  },
  cancelBtn: {
    padding: `${theme.spacing.sm} ${theme.spacing.lg}`,
    backgroundColor: 'transparent',
    color: theme.colors.text,
    border: `1px solid ${theme.colors.border}`,
    borderRadius: theme.borderRadius.lg,
    fontSize: theme.typography.sizes.sm,
    cursor: 'pointer',
  },
  deleteBtn: {
    padding: `${theme.spacing.sm} ${theme.spacing.lg}`,
    backgroundColor: 'transparent',
    color: theme.colors.error,
    border: `1px solid ${theme.colors.error}30`,
    borderRadius: theme.borderRadius.lg,
    fontSize: theme.typography.sizes.sm,
    cursor: 'pointer',
    display: 'inline-flex',
    alignItems: 'center',
    gap: theme.spacing.xs,
  },
  errorBanner: {
    padding: theme.spacing.md,
    backgroundColor: theme.colors.errorLight,
    color: theme.colors.error,
    borderRadius: theme.borderRadius.md,
    fontSize: theme.typography.sizes.sm,
  },
};

const EMPTY_LESSON = {
  title: '',
  themengebiet: 'basis',
  kategorie: 'strength',
  beschreibung: '',
  auswirkung: '',
  empfehlung: '',
};

function kategorieBadge(value) {
  return KATEGORIE_STYLE[value] || { bg: theme.colors.surfaceHover, fg: theme.colors.textMuted, label: value };
}

export default function LessonsLearnedView({ projektId, canEdit, appConfig }) {
  const {
    getLessonsLearned,
    createLessonLearned,
    updateLessonLearned,
    deleteLessonLearned,
    suggestLessonsLearned,
  } = useProjektmanagement();

  const themengebietOptions = appConfig?.lesson_themengebiet || [];
  const kategorieOptions = appConfig?.lesson_kategorie || [];
  const themengebietLabel = useCallback(
    (value) => themengebietOptions.find((o) => o.value === value)?.label || value,
    [themengebietOptions],
  );

  const [lessons, setLessons] = useState([]);
  const [selectedId, setSelectedId] = useState(null);
  const [draft, setDraft] = useState(null); // {...EMPTY_LESSON, _isNew: true} or {...existing}
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [isSuggesting, setIsSuggesting] = useState(false);
  const [suggestions, setSuggestions] = useState(null); // null = noch nicht gefragt, [] = leer
  const [error, setError] = useState(null);

  // Initial load
  const reload = useCallback(async () => {
    if (!projektId) return;
    setIsLoading(true);
    try {
      const data = await getLessonsLearned(projektId);
      setLessons(data);
    } catch (err) {
      setError(err.message);
    } finally {
      setIsLoading(false);
    }
  }, [projektId, getLessonsLearned]);

  useEffect(() => {
    reload();
  }, [reload]);

  // Selection → load draft
  useEffect(() => {
    if (!selectedId) {
      setDraft(null);
      return;
    }
    const found = lessons.find((l) => l.id === selectedId);
    if (found) setDraft({ ...found });
  }, [selectedId, lessons]);

  const startNew = () => {
    setSelectedId(null);
    setSuggestions(null);
    setDraft({ ...EMPTY_LESSON, _isNew: true });
  };

  const cancelEdit = () => {
    setDraft(null);
    setSelectedId(null);
  };

  const handleSave = async () => {
    if (!draft?.title?.trim()) {
      setError('Titel ist erforderlich.');
      return;
    }
    setIsSaving(true);
    setError(null);
    try {
      const payload = {
        title: draft.title,
        themengebiet: draft.themengebiet,
        kategorie: draft.kategorie,
        beschreibung: draft.beschreibung,
        auswirkung: draft.auswirkung,
        empfehlung: draft.empfehlung,
      };
      let saved;
      if (draft._isNew) {
        saved = await createLessonLearned(projektId, payload);
      } else {
        saved = await updateLessonLearned(projektId, draft.id, payload, { expectedVersion: draft.version });
      }
      await reload();
      setSelectedId(saved.id);
    } catch (err) {
      if (err instanceof VersionConflictError) {
        setError('Die Lesson Learned wurde von jemand anderem geaendert. Bitte neu laden.');
      } else {
        setError(err.message);
      }
    } finally {
      setIsSaving(false);
    }
  };

  const handleDelete = async () => {
    if (!draft || draft._isNew) return;
    if (!confirm(`Lesson Learned "${draft.title}" loeschen?`)) return;
    try {
      await deleteLessonLearned(projektId, draft.id);
      setSelectedId(null);
      setDraft(null);
      await reload();
    } catch (err) {
      setError(err.message);
    }
  };

  const handleSuggest = async () => {
    setIsSuggesting(true);
    setError(null);
    try {
      const result = await suggestLessonsLearned(projektId);
      setSuggestions(result);
    } catch (err) {
      setError(err.message || 'KI-Vorschlaege fehlgeschlagen.');
      setSuggestions([]);
    } finally {
      setIsSuggesting(false);
    }
  };

  const acceptSuggestion = (s) => {
    setSuggestions((prev) => (prev || []).filter((x) => x !== s));
    setSelectedId(null);
    setDraft({ ...EMPTY_LESSON, ...s, _isNew: true });
  };

  const dismissSuggestion = (s) => {
    setSuggestions((prev) => (prev || []).filter((x) => x !== s));
  };

  // ============== Render ==============

  return (
    <div style={styles.container}>
      <div style={styles.blade}>
        <div style={styles.bladeHeader}>
          <span style={styles.bladeHeaderTitle}>Lessons Learned</span>
          {canEdit && (
            <button type="button" style={styles.bladeAddBtn} onClick={startNew}>+ Neu</button>
          )}
        </div>
        <div style={styles.list}>
          {isLoading ? (
            <div style={styles.emptyList}>Lade…</div>
          ) : lessons.length === 0 ? (
            <div style={styles.emptyList}>Noch keine Lessons Learned.</div>
          ) : (
            lessons.map((l) => {
              const cat = kategorieBadge(l.kategorie);
              const isActive = selectedId === l.id;
              return (
                <button
                  key={l.id}
                  type="button"
                  style={{ ...styles.listItem, ...(isActive ? styles.listItemActive : {}) }}
                  onClick={() => setSelectedId(l.id)}
                >
                  <div style={styles.listItemTitle}>{l.title}</div>
                  <div style={styles.listItemMeta}>
                    <span style={{ ...styles.kategorieBadge, backgroundColor: cat.bg, color: cat.fg }}>
                      {cat.label}
                    </span>
                    <span>{themengebietLabel(l.themengebiet)}</span>
                  </div>
                </button>
              );
            })
          )}
        </div>
      </div>

      <div style={styles.pane}>
        {error && <div style={styles.errorBanner}>{error}</div>}

        {!draft ? (
          <DefaultPane
            isSuggesting={isSuggesting}
            suggestions={suggestions}
            onSuggest={handleSuggest}
            onAccept={acceptSuggestion}
            onDismiss={dismissSuggestion}
            canEdit={canEdit}
            themengebietLabel={themengebietLabel}
          />
        ) : (
          <EditForm
            draft={draft}
            setDraft={setDraft}
            isSaving={isSaving}
            canEdit={canEdit}
            themengebietOptions={themengebietOptions}
            kategorieOptions={kategorieOptions}
            onSave={handleSave}
            onCancel={cancelEdit}
            onDelete={handleDelete}
          />
        )}
      </div>
    </div>
  );
}

function DefaultPane({ isSuggesting, suggestions, onSuggest, onAccept, onDismiss, canEdit, themengebietLabel }) {
  return (
    <div style={styles.suggestHero}>
      <div style={styles.suggestTitle}>Lessons Learned</div>
      <div style={styles.suggestSubtitle}>
        Halte Erkenntnisse aus dem Projekt strukturiert fest. Lass die KI die letzten
        Statusberichte durchgehen und Vorschlaege ableiten, oder leg eine Lesson
        Learned direkt manuell an.
      </div>
      {canEdit && (
        <button
          type="button"
          style={{ ...styles.suggestButton, ...(isSuggesting ? styles.suggestButtonDisabled : {}) }}
          onClick={onSuggest}
          disabled={isSuggesting}
        >
          <SparklesIcon size={18} />
          {isSuggesting ? 'KI analysiert Statusberichte…' : 'KI-Vorschlaege aus Statusberichten'}
        </button>
      )}

      {suggestions !== null && (
        <div style={styles.suggestionList}>
          {suggestions.length === 0 ? (
            <div style={{ color: theme.colors.textMuted, fontSize: theme.typography.sizes.sm }}>
              {isSuggesting ? '' : 'Keine Vorschlaege — es gibt noch keine Statusberichte, aus denen sich Lessons Learned ableiten lassen, oder die KI hat keine relevanten Punkte gefunden.'}
            </div>
          ) : (
            suggestions.map((s, idx) => {
              const cat = kategorieBadge(s.kategorie);
              return (
                <div key={idx} style={styles.suggestionCard}>
                  <div style={styles.suggestionHeader}>
                    <div style={styles.suggestionTitle}>{s.title}</div>
                    <span style={{ ...styles.kategorieBadge, backgroundColor: cat.bg, color: cat.fg }}>
                      {cat.label}
                    </span>
                  </div>
                  <div style={styles.suggestionMeta}>
                    <span>Themengebiet: <strong>{themengebietLabel(s.themengebiet)}</strong></span>
                    {s.source && <><span>•</span><span>{s.source}</span></>}
                  </div>
                  {s.beschreibung && (
                    <div style={styles.suggestionField}>
                      <div style={styles.suggestionFieldLabel}>Beschreibung</div>
                      <div>{s.beschreibung}</div>
                    </div>
                  )}
                  {s.auswirkung && (
                    <div style={styles.suggestionField}>
                      <div style={styles.suggestionFieldLabel}>Auswirkung</div>
                      <div>{s.auswirkung}</div>
                    </div>
                  )}
                  {s.empfehlung && (
                    <div style={styles.suggestionField}>
                      <div style={styles.suggestionFieldLabel}>Empfehlung</div>
                      <div>{s.empfehlung}</div>
                    </div>
                  )}
                  <div style={styles.suggestionActions}>
                    <button type="button" style={styles.dismissBtn} onClick={() => onDismiss(s)}>
                      Verwerfen
                    </button>
                    {canEdit && (
                      <button type="button" style={styles.acceptBtn} onClick={() => onAccept(s)}>
                        Uebernehmen
                      </button>
                    )}
                  </div>
                </div>
              );
            })
          )}
        </div>
      )}
    </div>
  );
}

function EditForm({ draft, setDraft, isSaving, canEdit, themengebietOptions, kategorieOptions, onSave, onCancel, onDelete }) {
  const set = (key, value) => setDraft((prev) => ({ ...prev, [key]: value }));
  const readOnly = !canEdit;

  return (
    <div style={styles.form}>
      <div style={styles.field}>
        <label style={styles.fieldLabel}>Titel</label>
        <input
          style={styles.input}
          value={draft.title}
          onChange={(e) => set('title', e.target.value)}
          readOnly={readOnly}
          placeholder="Kurzer Titel der Lesson Learned"
        />
      </div>

      <div style={styles.formRow}>
        <div style={styles.field}>
          <label style={styles.fieldLabel}>Themengebiet</label>
          <select
            style={styles.select}
            value={draft.themengebiet}
            onChange={(e) => set('themengebiet', e.target.value)}
            disabled={readOnly}
          >
            {themengebietOptions.map((o) => (
              <option key={o.value} value={o.value}>{o.label}</option>
            ))}
          </select>
        </div>
        <div style={styles.field}>
          <label style={styles.fieldLabel}>Kategorie (SWOT)</label>
          <select
            style={styles.select}
            value={draft.kategorie}
            onChange={(e) => set('kategorie', e.target.value)}
            disabled={readOnly}
          >
            {kategorieOptions.map((o) => (
              <option key={o.value} value={o.value}>{o.label}</option>
            ))}
          </select>
        </div>
      </div>

      <div style={styles.field}>
        <label style={styles.fieldLabel}>Beschreibung</label>
        <div style={styles.fieldHint}>Worum geht es?</div>
        <textarea
          style={styles.textarea}
          value={draft.beschreibung}
          onChange={(e) => set('beschreibung', e.target.value)}
          readOnly={readOnly}
        />
      </div>

      <div style={styles.field}>
        <label style={styles.fieldLabel}>Auswirkung</label>
        <div style={styles.fieldHint}>Was ist die Folge?</div>
        <textarea
          style={styles.textarea}
          value={draft.auswirkung}
          onChange={(e) => set('auswirkung', e.target.value)}
          readOnly={readOnly}
        />
      </div>

      <div style={styles.field}>
        <label style={styles.fieldLabel}>Empfehlung</label>
        <div style={styles.fieldHint}>Was geben wir an andere weiter?</div>
        <textarea
          style={styles.textarea}
          value={draft.empfehlung}
          onChange={(e) => set('empfehlung', e.target.value)}
          readOnly={readOnly}
        />
      </div>

      {canEdit && (
        <div style={styles.formActions}>
          <div>
            {!draft._isNew && (
              <button type="button" style={styles.deleteBtn} onClick={onDelete}>
                <TrashIcon size={14} /> Loeschen
              </button>
            )}
          </div>
          <div style={styles.formActionsRight}>
            <button type="button" style={styles.cancelBtn} onClick={onCancel}>
              Abbrechen
            </button>
            <button type="button" style={styles.primaryBtn} onClick={onSave} disabled={isSaving}>
              {isSaving ? 'Speichern…' : draft._isNew ? 'Anlegen' : 'Speichern'}
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

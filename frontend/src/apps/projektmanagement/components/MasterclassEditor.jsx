/**
 * MasterclassEditor — Strukturierter Editor fuer PM-Masterclass-Wissen
 *
 * Zeigt pro Wizard-Step ein aufklappbares Panel mit farbigen Sektionen:
 *   - Meta (Titel + Beschreibung)
 *   - Pruefkriterien (Kategorien mit Listen)
 *   - Typische Fehler (String-Liste)
 *   - Kernkonzepte (rekursiver Baum-Editor)
 *   - Verbesserungsvorschlaege (rekursiver Baum-Editor)
 *   - Custom Sektionen (rekursiver Baum-Editor)
 *
 * Kein YAML-Wissen noetig — Struktur wird durch Formulare erzwungen.
 */

import { useState } from 'react';
import { theme } from '../../../config/theme';
import { useProjektmanagement } from '../../../hooks/useProjektmanagement';

const STEP_LABELS = [
  { step: 1, title: 'Basis-Informationen' },
  { step: 2, title: 'Ziele & Erfolgskriterien' },
  { step: 3, title: 'Inhalt & Umfang' },
  { step: 4, title: 'Hauptaufgaben' },
  { step: 5, title: 'Meilensteine' },
  { step: 6, title: 'Budget & Risiken' },
  { step: 7, title: 'Organisation & Stakeholder' },
];

const KNOWN_KEYS = ['meta', 'kernkonzepte', 'pruefkriterien', 'typische_fehler', 'verbesserungsvorschlaege'];

// Section definitions with colors and icons
const SECTIONS = [
  { key: 'meta', label: 'Titel & Beschreibung', color: theme.colors.textSecondary, type: 'meta', icon: 'info' },
  { key: 'pruefkriterien', label: 'Prüfkriterien', color: theme.colors.primary, type: 'criteria', icon: 'checklist' },
  { key: 'typische_fehler', label: 'Typische Fehler', color: theme.colors.error, type: 'errorlist', icon: 'warning' },
  { key: 'verbesserungsvorschlaege', label: 'Tipps & Beispiele', color: theme.colors.success, type: 'tree', icon: 'lightbulb' },
  { key: 'kernkonzepte', label: 'Kernkonzepte', color: '#6366f1', type: 'tree', icon: 'book' },
];

// ============================================================
//  Styles
// ============================================================

const s = {
  // Step accordion
  stepCard: {
    backgroundColor: theme.colors.surface,
    border: `1px solid ${theme.colors.border}`,
    borderRadius: theme.borderRadius.lg,
    overflow: 'hidden',
  },
  stepHeader: {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: theme.spacing.lg,
    cursor: 'pointer',
    border: 'none',
    backgroundColor: theme.colors.surface,
    width: '100%',
    textAlign: 'left',
    transition: `background ${theme.transitions.fast}`,
  },
  stepHeaderLeft: { display: 'flex', alignItems: 'center', gap: theme.spacing.md },
  stepNumber: {
    width: '28px',
    height: '28px',
    borderRadius: theme.borderRadius.full,
    backgroundColor: theme.colors.primaryLight,
    color: theme.colors.primary,
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    fontSize: theme.typography.sizes.sm,
    fontWeight: theme.typography.weights.semibold,
    flexShrink: 0,
  },
  stepTitle: {
    fontSize: theme.typography.sizes.sm,
    fontWeight: theme.typography.weights.semibold,
    color: theme.colors.text,
  },
  stepBody: { paddingTop: theme.spacing.xl, paddingLeft: theme.spacing.lg, paddingRight: theme.spacing.lg, paddingBottom: theme.spacing.lg, display: 'flex', flexDirection: 'column', gap: theme.spacing.lg },

  // Section card (matches platform accordion pattern from KnowledgePanel)
  section: {
    marginBottom: theme.spacing.sm,
    border: `1px solid ${theme.colors.border}`,
    borderRadius: theme.borderRadius.lg,
    overflow: 'hidden',
  },
  sectionHeader: {
    width: '100%',
    padding: theme.spacing.md,
    backgroundColor: theme.colors.surface,
    border: 'none',
    borderRadius: 0,
    fontSize: theme.typography.sizes.sm,
    fontWeight: theme.typography.weights.medium,
    color: theme.colors.text,
    cursor: 'pointer',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'space-between',
    transition: `all ${theme.transitions.fast}`,
  },
  sectionHeaderActive: {
    backgroundColor: theme.colors.background,
  },
  sectionHeaderLeft: {
    display: 'flex',
    alignItems: 'center',
    gap: theme.spacing.sm,
  },
  sectionChevron: {
    color: theme.colors.textMuted,
    transition: `transform ${theme.transitions.fast}`,
  },
  sectionChevronOpen: {
    transform: 'rotate(180deg)',
  },
  sectionContent: {
    padding: theme.spacing.md,
    backgroundColor: theme.colors.surface,
  },

  // Form elements
  input: {
    width: '100%',
    padding: `${theme.spacing.sm} ${theme.spacing.md}`,
    border: `1px solid ${theme.colors.border}`,
    borderRadius: theme.borderRadius.md,
    fontSize: theme.typography.sizes.sm,
    backgroundColor: theme.colors.surface,
    color: theme.colors.text,
    outline: 'none',
    fontFamily: 'inherit',
  },
  textarea: {
    width: '100%',
    padding: `${theme.spacing.sm} ${theme.spacing.md}`,
    border: `1px solid ${theme.colors.border}`,
    borderRadius: theme.borderRadius.md,
    fontSize: theme.typography.sizes.sm,
    backgroundColor: theme.colors.surface,
    color: theme.colors.text,
    outline: 'none',
    fontFamily: 'inherit',
    minHeight: '60px',
    resize: 'vertical',
    lineHeight: 1.5,
  },
  label: {
    fontSize: theme.typography.sizes.xs,
    fontWeight: theme.typography.weights.medium,
    color: theme.colors.textSecondary,
    marginBottom: theme.spacing.xs,
    display: 'block',
  },
  row: { display: 'flex', gap: theme.spacing.sm, alignItems: 'center' },
  flexGrow: { flex: 1 },

  // List items
  listItem: {
    display: 'flex',
    gap: theme.spacing.sm,
    alignItems: 'flex-start',
    marginBottom: theme.spacing.sm,
  },
  bullet: (color) => ({
    width: '6px',
    height: '6px',
    borderRadius: '50%',
    backgroundColor: color,
    flexShrink: 0,
    marginTop: '9px',
  }),

  // Category card (for pruefkriterien)
  categoryCard: {
    border: `1px solid ${theme.colors.border}`,
    borderRadius: theme.borderRadius.md,
    padding: theme.spacing.md,
    marginBottom: theme.spacing.md,
    backgroundColor: theme.colors.surface,
  },
  categoryTitle: {
    fontSize: theme.typography.sizes.sm,
    fontWeight: theme.typography.weights.semibold,
    color: theme.colors.text,
    marginBottom: theme.spacing.md,
  },

  // Tree
  treeNode: {
    marginBottom: theme.spacing.sm,
  },
  treeKey: {
    display: 'flex',
    alignItems: 'center',
    gap: theme.spacing.sm,
    padding: `${theme.spacing.xs} 0`,
    cursor: 'pointer',
  },
  treeKeyLabel: {
    fontSize: theme.typography.sizes.sm,
    fontWeight: theme.typography.weights.medium,
    color: theme.colors.text,
  },
  treeChildren: (level) => ({
    paddingLeft: level > 0 ? '16px' : '0',
    borderLeft: level > 0 ? `1px solid ${theme.colors.border}` : 'none',
    marginLeft: level > 0 ? '6px' : '0',
  }),

  // Buttons
  addBtn: {
    padding: `${theme.spacing.xs} ${theme.spacing.md}`,
    backgroundColor: 'transparent',
    border: `1px dashed ${theme.colors.border}`,
    borderRadius: theme.borderRadius.md,
    fontSize: theme.typography.sizes.xs,
    color: theme.colors.textMuted,
    cursor: 'pointer',
    display: 'inline-flex',
    alignItems: 'center',
    gap: theme.spacing.xs,
    marginTop: theme.spacing.xs,
  },
  removeBtn: {
    padding: '2px',
    backgroundColor: 'transparent',
    border: 'none',
    color: theme.colors.textMuted,
    cursor: 'pointer',
    borderRadius: theme.borderRadius.sm,
    display: 'flex',
    alignItems: 'center',
    flexShrink: 0,
    opacity: 0.5,
  },
  saveRow: {
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingTop: theme.spacing.md,
    borderTop: `1px solid ${theme.colors.border}`,
  },
  saveBtn: {
    padding: `${theme.spacing.sm} ${theme.spacing.lg}`,
    backgroundColor: theme.colors.primary,
    color: '#fff',
    border: 'none',
    borderRadius: theme.borderRadius.md,
    fontSize: theme.typography.sizes.sm,
    fontWeight: theme.typography.weights.medium,
    cursor: 'pointer',
    display: 'flex',
    alignItems: 'center',
    gap: theme.spacing.sm,
  },
  statusText: {
    fontSize: theme.typography.sizes.xs,
    color: theme.colors.textMuted,
  },

  // Add-key dialog
  addKeyDialog: {
    display: 'flex',
    gap: theme.spacing.sm,
    alignItems: 'center',
    marginTop: theme.spacing.sm,
    padding: theme.spacing.sm,
    backgroundColor: theme.colors.surface,
    borderRadius: theme.borderRadius.md,
    border: `1px solid ${theme.colors.border}`,
  },
  addKeyInput: {
    flex: 1,
    padding: `${theme.spacing.xs} ${theme.spacing.sm}`,
    border: `1px solid ${theme.colors.border}`,
    borderRadius: theme.borderRadius.sm,
    fontSize: theme.typography.sizes.xs,
    outline: 'none',
    backgroundColor: theme.colors.background,
    color: theme.colors.text,
  },
  addKeySelect: {
    padding: `${theme.spacing.xs} ${theme.spacing.sm}`,
    border: `1px solid ${theme.colors.border}`,
    borderRadius: theme.borderRadius.sm,
    fontSize: theme.typography.sizes.xs,
    backgroundColor: theme.colors.background,
    color: theme.colors.text,
    cursor: 'pointer',
  },
  miniBtn: {
    padding: `${theme.spacing.xs} ${theme.spacing.sm}`,
    border: 'none',
    borderRadius: theme.borderRadius.sm,
    fontSize: theme.typography.sizes.xs,
    fontWeight: theme.typography.weights.medium,
    cursor: 'pointer',
  },
};

// ============================================================
//  Helper: format snake_case keys
// ============================================================

function formatKey(name) {
  return name.split('_').map((w) => w.charAt(0).toUpperCase() + w.slice(1)).join(' ');
}

// ============================================================
//  Icons
// ============================================================

function PlusIcon({ size = 12 }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
      <line x1="12" y1="5" x2="12" y2="19" /><line x1="5" y1="12" x2="19" y2="12" />
    </svg>
  );
}
function XIcon({ size = 12 }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
      <line x1="18" y1="6" x2="6" y2="18" /><line x1="6" y1="6" x2="18" y2="18" />
    </svg>
  );
}
function ChevronIcon({ open }) {
  return (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"
      style={{ transition: `transform ${theme.transitions.fast}`, transform: open ? 'rotate(90deg)' : 'rotate(0deg)' }}>
      <polyline points="9 6 15 12 9 18" />
    </svg>
  );
}
function SaveIcon() {
  return (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
      <path d="M19 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11l5 5v11a2 2 0 0 1-2 2z" />
      <polyline points="17 21 17 13 7 13 7 21" /><polyline points="7 3 7 8 15 8" />
    </svg>
  );
}
function ChevronDownIcon() {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
      <polyline points="6 9 12 15 18 9" />
    </svg>
  );
}
function SectionIcon({ type }) {
  switch (type) {
    case 'checklist':
      return (
        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
          <path d="M9 11l3 3L22 4" />
          <path d="M21 12v7a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11" />
        </svg>
      );
    case 'warning':
      return (
        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
          <path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z" />
          <line x1="12" y1="9" x2="12" y2="13" />
          <line x1="12" y1="17" x2="12.01" y2="17" />
        </svg>
      );
    case 'lightbulb':
      return (
        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
          <path d="M9 18h6" />
          <path d="M10 22h4" />
          <path d="M15.09 14c.18-.98.65-1.74 1.41-2.5A4.65 4.65 0 0 0 18 8 6 6 0 0 0 6 8c0 1 .23 2.23 1.5 3.5A4.61 4.61 0 0 1 8.91 14" />
        </svg>
      );
    case 'book':
      return (
        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
          <path d="M4 19.5A2.5 2.5 0 0 1 6.5 17H20" />
          <path d="M6.5 2H20v20H6.5A2.5 2.5 0 0 1 4 19.5v-15A2.5 2.5 0 0 1 6.5 2z" />
        </svg>
      );
    case 'info':
    default:
      return (
        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
          <circle cx="12" cy="12" r="10" />
          <line x1="12" y1="16" x2="12" y2="12" />
          <line x1="12" y1="8" x2="12.01" y2="8" />
        </svg>
      );
  }
}

// ============================================================
//  RemoveButton (with hover)
// ============================================================

function RemoveButton({ onClick }) {
  return (
    <button
      style={s.removeBtn}
      onClick={onClick}
      onMouseEnter={(e) => { e.currentTarget.style.opacity = '1'; e.currentTarget.style.color = theme.colors.error; }}
      onMouseLeave={(e) => { e.currentTarget.style.opacity = '0.5'; e.currentTarget.style.color = theme.colors.textMuted; }}
    >
      <XIcon />
    </button>
  );
}

// ============================================================
//  AddButton (dashed, with hover)
// ============================================================

function AddButton({ label, onClick }) {
  return (
    <button
      style={s.addBtn}
      onClick={onClick}
      onMouseEnter={(e) => { e.currentTarget.style.borderColor = theme.colors.primary; e.currentTarget.style.color = theme.colors.primary; }}
      onMouseLeave={(e) => { e.currentTarget.style.borderColor = theme.colors.border; e.currentTarget.style.color = theme.colors.textMuted; }}
    >
      <PlusIcon /> {label}
    </button>
  );
}

// ============================================================
//  MetaEditor
// ============================================================

function MetaEditor({ meta, onChange }) {
  const update = (key, value) => onChange({ ...meta, [key]: value });

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: theme.spacing.md }}>
      <div>
        <label style={s.label}>Titel</label>
        <input
          style={s.input}
          value={meta?.title || ''}
          onChange={(e) => update('title', e.target.value)}
          placeholder="z.B. Basis-Informationen"
          onFocus={(e) => { e.target.style.borderColor = theme.colors.primary; }}
          onBlur={(e) => { e.target.style.borderColor = theme.colors.border; }}
        />
      </div>
      <div>
        <label style={s.label}>Beschreibung</label>
        <textarea
          style={s.textarea}
          value={meta?.description || ''}
          onChange={(e) => update('description', e.target.value)}
          placeholder="Kurzbeschreibung für diesen Schritt..."
          onFocus={(e) => { e.target.style.borderColor = theme.colors.primary; }}
          onBlur={(e) => { e.target.style.borderColor = theme.colors.border; }}
        />
      </div>
    </div>
  );
}

// ============================================================
//  CriteriaEditor (pruefkriterien: { category: string[] })
// ============================================================

function CriteriaEditor({ data, onChange, color }) {
  const entries = data && typeof data === 'object' && !Array.isArray(data)
    ? Object.entries(data)
    : [];

  const updateCategory = (oldKey, newKey, items) => {
    const result = {};
    for (const [k, v] of entries) {
      if (k === oldKey) result[newKey] = items;
      else result[k] = v;
    }
    onChange(result);
  };

  const updateItem = (catKey, index, value) => {
    const items = [...(data[catKey] || [])];
    items[index] = value;
    updateCategory(catKey, catKey, items);
  };

  const removeItem = (catKey, index) => {
    const items = (data[catKey] || []).filter((_, i) => i !== index);
    updateCategory(catKey, catKey, items);
  };

  const addItem = (catKey) => {
    const items = [...(data[catKey] || []), ''];
    updateCategory(catKey, catKey, items);
  };

  return (
    <div>
      {entries.map(([catKey, items]) => (
        <div key={catKey} style={s.categoryCard}>
          <div style={s.categoryTitle}>{formatKey(catKey)}</div>
          {Array.isArray(items) && items.map((item, idx) => (
            <div key={idx} style={s.listItem}>
              <div style={s.bullet(color)} />
              <input
                style={{ ...s.input, flex: 1 }}
                value={item}
                onChange={(e) => updateItem(catKey, idx, e.target.value)}
                placeholder="Kriterium..."
                onFocus={(e) => { e.target.style.borderColor = color; }}
                onBlur={(e) => { e.target.style.borderColor = theme.colors.border; }}
              />
              <RemoveButton onClick={() => removeItem(catKey, idx)} />
            </div>
          ))}
          <AddButton label="Kriterium" onClick={() => addItem(catKey)} />
        </div>
      ))}
    </div>
  );
}

// ============================================================
//  ErrorListEditor (typische_fehler: string[] | { cat: string[] })
// ============================================================

function ErrorListEditor({ data, onChange, color }) {
  // Normalize to always work with a flat array
  const items = Array.isArray(data) ? data : [];
  const isObject = data && typeof data === 'object' && !Array.isArray(data);

  // If it's an object with categories, flatten for editing
  // On save it stays as the format it was
  if (isObject) {
    return <CriteriaEditor data={data} onChange={onChange} color={color} />;
  }

  const updateItem = (index, value) => {
    const newItems = [...items];
    newItems[index] = value;
    onChange(newItems);
  };

  const removeItem = (index) => {
    onChange(items.filter((_, i) => i !== index));
  };

  const addItem = () => {
    onChange([...items, '']);
  };

  return (
    <div>
      {items.map((item, idx) => (
        <div key={idx} style={s.listItem}>
          <div style={s.bullet(color)} />
          <input
            style={{ ...s.input, flex: 1 }}
            value={typeof item === 'string' ? item : JSON.stringify(item)}
            onChange={(e) => updateItem(idx, e.target.value)}
            placeholder="Typischer Fehler..."
            onFocus={(e) => { e.target.style.borderColor = color; }}
            onBlur={(e) => { e.target.style.borderColor = theme.colors.border; }}
          />
          <RemoveButton onClick={() => removeItem(idx)} />
        </div>
      ))}
      <AddButton label="Fehler" onClick={addItem} />
    </div>
  );
}

// ============================================================
//  TreeEditor (recursive for kernkonzepte, verbesserungsvorschlaege, custom)
// ============================================================

function TreeEditor({ data, onChange, color, level = 0 }) {
  const [openNodes, setOpenNodes] = useState(() => {
    // Auto-expand first 2 levels
    if (!data || typeof data !== 'object') return {};
    const open = {};
    Object.keys(data).forEach((k) => { open[k] = level < 1; });
    return open;
  });
  const [addingKey, setAddingKey] = useState(false);
  const [newKeyName, setNewKeyName] = useState('');
  const [newKeyType, setNewKeyType] = useState('text');

  if (!data || typeof data !== 'object' || Array.isArray(data)) {
    return null;
  }

  const entries = Object.entries(data);

  const toggle = (key) => setOpenNodes((prev) => ({ ...prev, [key]: !prev[key] }));

  const updateKey = (oldKey, newValue) => {
    onChange({ ...data, [oldKey]: newValue });
  };

  const removeKey = (key) => {
    const copy = { ...data };
    delete copy[key];
    onChange(copy);
  };

  const renameKey = (oldKey, newKey) => {
    if (!newKey || newKey === oldKey || data[newKey] !== undefined) return;
    // Preserve order
    const result = {};
    for (const [k, v] of entries) {
      result[k === oldKey ? newKey : k] = v;
    }
    onChange(result);
  };

  const addKey = () => {
    if (!newKeyName.trim()) return;
    const key = newKeyName.trim().toLowerCase().replace(/\s+/g, '_').replace(/[^a-z0-9_äöüß]/g, '');
    if (!key || data[key] !== undefined) return;
    const defaultValue = newKeyType === 'text' ? '' : newKeyType === 'list' ? [''] : {};
    onChange({ ...data, [key]: defaultValue });
    setOpenNodes((prev) => ({ ...prev, [key]: true }));
    setAddingKey(false);
    setNewKeyName('');
  };

  return (
    <div style={s.treeChildren(level)}>
      {entries.map(([key, value]) => (
        <TreeNode
          key={key}
          keyName={key}
          value={value}
          onChange={(v) => updateKey(key, v)}
          onRemove={() => removeKey(key)}
          onRename={(newKey) => renameKey(key, newKey)}
          isOpen={!!openNodes[key]}
          onToggle={() => toggle(key)}
          color={color}
          level={level}
        />
      ))}

      {addingKey ? (
        <div style={s.addKeyDialog}>
          <input
            style={s.addKeyInput}
            value={newKeyName}
            onChange={(e) => setNewKeyName(e.target.value)}
            placeholder="Schlüsselname..."
            autoFocus
            onKeyDown={(e) => {
              if (e.key === 'Enter') addKey();
              if (e.key === 'Escape') setAddingKey(false);
            }}
          />
          <select style={s.addKeySelect} value={newKeyType} onChange={(e) => setNewKeyType(e.target.value)}>
            <option value="text">Text</option>
            <option value="list">Liste</option>
            <option value="section">Abschnitt</option>
          </select>
          <button
            style={{ ...s.miniBtn, backgroundColor: theme.colors.primary, color: '#fff' }}
            onClick={addKey}
          >OK</button>
          <button
            style={{ ...s.miniBtn, backgroundColor: theme.colors.surfaceHover, color: theme.colors.text }}
            onClick={() => setAddingKey(false)}
          >Abb.</button>
        </div>
      ) : (
        <AddButton label="Schlüssel" onClick={() => setAddingKey(true)} />
      )}
    </div>
  );
}

function TreeNode({ keyName, value, onChange, onRemove, onRename, isOpen, onToggle, color, level }) {
  const [editingName, setEditingName] = useState(false);
  const [tempName, setTempName] = useState(keyName);

  const isLeaf = typeof value === 'string' || typeof value === 'number';
  const isArray = Array.isArray(value);
  const isObject = typeof value === 'object' && value !== null && !isArray;

  // String value — inline editable
  if (isLeaf) {
    const isLong = typeof value === 'string' && (value.length > 100 || value.includes('\n'));
    return (
      <div style={{ ...s.treeNode, display: 'flex', gap: theme.spacing.sm, alignItems: 'flex-start' }}>
        <span style={{ fontSize: theme.typography.sizes.xs, color: theme.colors.textSecondary, fontWeight: theme.typography.weights.medium, minWidth: '80px', paddingTop: '6px', flexShrink: 0 }}>
          {formatKey(keyName)}:
        </span>
        {isLong ? (
          <textarea
            style={{ ...s.textarea, flex: 1, minHeight: '50px', fontSize: theme.typography.sizes.xs }}
            value={String(value)}
            onChange={(e) => onChange(e.target.value)}
            onFocus={(e) => { e.target.style.borderColor = color; }}
            onBlur={(e) => { e.target.style.borderColor = theme.colors.border; }}
          />
        ) : (
          <input
            style={{ ...s.input, flex: 1, fontSize: theme.typography.sizes.xs }}
            value={String(value)}
            onChange={(e) => onChange(e.target.value)}
            onFocus={(e) => { e.target.style.borderColor = color; }}
            onBlur={(e) => { e.target.style.borderColor = theme.colors.border; }}
          />
        )}
        <RemoveButton onClick={onRemove} />
      </div>
    );
  }

  // Array — list of items
  if (isArray) {
    return (
      <div style={s.treeNode}>
        <div style={s.treeKey} onClick={onToggle}>
          <ChevronIcon open={isOpen} />
          {editingName ? (
            <input
              style={{ ...s.addKeyInput, fontWeight: theme.typography.weights.medium }}
              value={tempName}
              onChange={(e) => setTempName(e.target.value)}
              onBlur={() => { onRename(tempName.toLowerCase().replace(/\s+/g, '_')); setEditingName(false); }}
              onKeyDown={(e) => { if (e.key === 'Enter') { onRename(tempName.toLowerCase().replace(/\s+/g, '_')); setEditingName(false); } }}
              onClick={(e) => e.stopPropagation()}
              autoFocus
            />
          ) : (
            <span
              style={s.treeKeyLabel}
              onDoubleClick={(e) => { e.stopPropagation(); setTempName(formatKey(keyName)); setEditingName(true); }}
            >
              {formatKey(keyName)}
              <span style={{ color: theme.colors.textMuted, fontWeight: 'normal', fontSize: theme.typography.sizes.xs, marginLeft: theme.spacing.xs }}>
                ({value.length})
              </span>
            </span>
          )}
          <RemoveButton onClick={(e) => { e.stopPropagation(); onRemove(); }} />
        </div>
        {isOpen && (
          <div style={s.treeChildren(level + 1)}>
            {value.map((item, idx) => {
              // Array item is string
              if (typeof item === 'string' || typeof item === 'number') {
                return (
                  <div key={idx} style={s.listItem}>
                    <div style={s.bullet(color)} />
                    <input
                      style={{ ...s.input, flex: 1, fontSize: theme.typography.sizes.xs }}
                      value={String(item)}
                      onChange={(e) => {
                        const arr = [...value];
                        arr[idx] = e.target.value;
                        onChange(arr);
                      }}
                      onFocus={(e) => { e.target.style.borderColor = color; }}
                      onBlur={(e) => { e.target.style.borderColor = theme.colors.border; }}
                    />
                    <RemoveButton onClick={() => onChange(value.filter((_, i) => i !== idx))} />
                  </div>
                );
              }
              // Array item is object
              if (typeof item === 'object' && item !== null) {
                return (
                  <div key={idx} style={{ marginBottom: theme.spacing.sm, paddingLeft: theme.spacing.sm, borderLeft: `1px solid ${theme.colors.border}` }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: theme.spacing.xs }}>
                      <span style={{ fontSize: theme.typography.sizes.xs, color: theme.colors.textMuted }}>Eintrag {idx + 1}</span>
                      <RemoveButton onClick={() => onChange(value.filter((_, i) => i !== idx))} />
                    </div>
                    <TreeEditor
                      data={item}
                      onChange={(newItem) => {
                        const arr = [...value];
                        arr[idx] = newItem;
                        onChange(arr);
                      }}
                      color={color}
                      level={level + 2}
                    />
                  </div>
                );
              }
              return null;
            })}
            <AddButton label="Eintrag" onClick={() => onChange([...value, ''])} />
          </div>
        )}
      </div>
    );
  }

  // Object — expandable with children
  if (isObject) {
    return (
      <div style={s.treeNode}>
        <div style={s.treeKey} onClick={onToggle}>
          <ChevronIcon open={isOpen} />
          {editingName ? (
            <input
              style={{ ...s.addKeyInput, fontWeight: theme.typography.weights.medium }}
              value={tempName}
              onChange={(e) => setTempName(e.target.value)}
              onBlur={() => { onRename(tempName.toLowerCase().replace(/\s+/g, '_')); setEditingName(false); }}
              onKeyDown={(e) => { if (e.key === 'Enter') { onRename(tempName.toLowerCase().replace(/\s+/g, '_')); setEditingName(false); } }}
              onClick={(e) => e.stopPropagation()}
              autoFocus
            />
          ) : (
            <span
              style={s.treeKeyLabel}
              onDoubleClick={(e) => { e.stopPropagation(); setTempName(formatKey(keyName)); setEditingName(true); }}
            >
              {formatKey(keyName)}
            </span>
          )}
          <RemoveButton onClick={(e) => { e.stopPropagation(); onRemove(); }} />
        </div>
        {isOpen && (
          <TreeEditor
            data={value}
            onChange={onChange}
            color={color}
            level={level + 1}
          />
        )}
      </div>
    );
  }

  return null;
}

// ============================================================
//  SectionCard (collapsible section with colored accent)
// ============================================================

function SectionCard({ label, color, icon, defaultOpen = true, children }) {
  const [open, setOpen] = useState(defaultOpen);

  return (
    <div style={s.section}>
      <button
        style={{
          ...s.sectionHeader,
          ...(open ? s.sectionHeaderActive : {}),
        }}
        onClick={() => setOpen(!open)}
        onMouseEnter={(e) => {
          e.currentTarget.style.backgroundColor = theme.colors.surfaceHover;
        }}
        onMouseLeave={(e) => {
          e.currentTarget.style.backgroundColor = open
            ? theme.colors.background
            : theme.colors.surface;
        }}
      >
        <div style={s.sectionHeaderLeft}>
          <span style={{ color }}>
            <SectionIcon type={icon} />
          </span>
          <span>{label}</span>
        </div>
        <span style={{
          ...s.sectionChevron,
          ...(open ? s.sectionChevronOpen : {}),
        }}>
          <ChevronDownIcon />
        </span>
      </button>
      {open && <div style={s.sectionContent}>{children}</div>}
    </div>
  );
}

// ============================================================
//  StepEditor (all sections for one step)
// ============================================================

function StepEditor({ knowledge, onChange, onSave, isSaving, status }) {
  const update = (key, value) => {
    onChange({ ...knowledge, [key]: value });
  };

  // Find custom sections (not in KNOWN_KEYS)
  const customKeys = Object.keys(knowledge).filter((k) => !KNOWN_KEYS.includes(k));

  return (
    <div style={s.stepBody}>
      {/* Known sections */}
      {SECTIONS.map((sec) => {
        const data = knowledge[sec.key];
        return (
          <SectionCard key={sec.key} label={sec.label} color={sec.color} icon={sec.icon} defaultOpen={sec.key === 'meta'}>
            {sec.type === 'meta' && (
              <MetaEditor meta={data} onChange={(v) => update(sec.key, v)} />
            )}
            {sec.type === 'criteria' && (
              <CriteriaEditor data={data || {}} onChange={(v) => update(sec.key, v)} color={sec.color} />
            )}
            {sec.type === 'errorlist' && (
              <ErrorListEditor data={data || []} onChange={(v) => update(sec.key, v)} color={sec.color} />
            )}
            {sec.type === 'tree' && (
              <TreeEditor data={data || {}} onChange={(v) => update(sec.key, v)} color={sec.color} />
            )}
          </SectionCard>
        );
      })}

      {/* Custom sections */}
      {customKeys.map((key) => (
        <SectionCard key={key} label={formatKey(key)} color={theme.colors.info} icon="book" defaultOpen={false}>
          <TreeEditor data={knowledge[key] || {}} onChange={(v) => update(key, v)} color={theme.colors.info} />
        </SectionCard>
      ))}

      {/* Save row */}
      <div style={{
        ...s.saveRow,
        ...(status?.type === 'dirty' ? {
          backgroundColor: theme.colors.primaryLight,
          borderTop: 'none',
          borderRadius: theme.borderRadius.lg,
          padding: theme.spacing.md,
        } : {}),
      }}>
        <span style={{
          ...s.statusText,
          ...(status?.type === 'saved' ? { color: theme.colors.success } : {}),
          ...(status?.type === 'error' ? { color: theme.colors.error } : {}),
          ...(status?.type === 'dirty' ? { color: theme.colors.primary } : {}),
        }}>
          {status?.type === 'saved' && <>&check; Gespeichert</>}
          {status?.type === 'error' && <>Fehler: {status.message}</>}
          {status?.type === 'dirty' && <>Ungespeicherte Änderungen</>}
        </span>
        <button
          style={{ ...s.saveBtn, opacity: isSaving ? 0.7 : 1 }}
          onClick={onSave}
          disabled={isSaving}
          onMouseEnter={(e) => { if (!isSaving) e.currentTarget.style.backgroundColor = theme.colors.primaryHover; }}
          onMouseLeave={(e) => { e.currentTarget.style.backgroundColor = theme.colors.primary; }}
        >
          <SaveIcon />
          {isSaving ? 'Speichere...' : 'Speichern'}
        </button>
      </div>
    </div>
  );
}

// ============================================================
//  MasterclassEditor (main export)
// ============================================================

export default function MasterclassEditor() {
  const { getStepKnowledge, saveKnowledge } = useProjektmanagement();
  const [expandedStep, setExpandedStep] = useState(null);
  const [stepData, setStepData] = useState({});
  const [stepStatuses, setStepStatuses] = useState({});
  const [loadingStep, setLoadingStep] = useState(null);
  const [savingStep, setSavingStep] = useState(null);

  const toggleStep = async (step) => {
    if (expandedStep === step) {
      setExpandedStep(null);
      return;
    }
    setExpandedStep(step);

    // Load if not cached
    if (!stepData[step]) {
      try {
        setLoadingStep(step);
        const knowledge = await getStepKnowledge(step);
        setStepData((prev) => ({ ...prev, [step]: knowledge }));
      } catch (err) {
        console.error('Error loading step', step, err);
        setStepStatuses((prev) => ({ ...prev, [step]: { type: 'error', message: 'Laden fehlgeschlagen' } }));
      } finally {
        setLoadingStep(null);
      }
    }
  };

  const handleChange = (step, knowledge) => {
    setStepData((prev) => ({ ...prev, [step]: knowledge }));
    setStepStatuses((prev) => ({ ...prev, [step]: { type: 'dirty' } }));
  };

  const handleSave = async (step) => {
    const knowledge = stepData[step];
    if (!knowledge) return;
    try {
      setSavingStep(step);
      await saveKnowledge(step, knowledge);
      setStepStatuses((prev) => ({ ...prev, [step]: { type: 'saved' } }));
    } catch (err) {
      setStepStatuses((prev) => ({ ...prev, [step]: { type: 'error', message: err.message } }));
    } finally {
      setSavingStep(null);
    }
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: theme.spacing.md }}>
      <p style={{ fontSize: theme.typography.sizes.sm, color: theme.colors.textSecondary, marginBottom: theme.spacing.sm }}>
        Bearbeiten Sie das PM-Masterclass-Wissen, das im Wizard-Sidebar pro Schritt angezeigt wird.
      </p>

      {STEP_LABELS.map(({ step, title }) => {
        const isExpanded = expandedStep === step;
        const isLoading = loadingStep === step;

        return (
          <div key={step} style={s.stepCard}>
            <button
              style={s.stepHeader}
              onClick={() => toggleStep(step)}
              onMouseEnter={(e) => { e.currentTarget.style.backgroundColor = theme.colors.surfaceHover; }}
              onMouseLeave={(e) => { e.currentTarget.style.backgroundColor = theme.colors.surface; }}
            >
              <div style={s.stepHeaderLeft}>
                <div style={s.stepNumber}>{step}</div>
                <span style={s.stepTitle}>{title}</span>
              </div>
              <span style={{
                ...s.sectionChevron,
                ...(isExpanded ? s.sectionChevronOpen : {}),
              }}>
                <ChevronDownIcon />
              </span>
            </button>

            {isExpanded && (
              isLoading ? (
                <div style={{ padding: theme.spacing.xl, textAlign: 'center', color: theme.colors.textMuted, fontSize: theme.typography.sizes.sm }}>
                  Lade Wissen...
                </div>
              ) : stepData[step] ? (
                <StepEditor
                  knowledge={stepData[step]}
                  onChange={(k) => handleChange(step, k)}
                  onSave={() => handleSave(step)}
                  isSaving={savingStep === step}
                  status={stepStatuses[step]}
                />
              ) : null
            )}
          </div>
        );
      })}
    </div>
  );
}

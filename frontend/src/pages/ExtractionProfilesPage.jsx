import { useState, useEffect, useRef } from 'react';
import { theme } from '../config/theme';
import { apiGet, apiPost, apiPut, apiDelete, apiPostForm } from '../utils/apiFetch';

const styles = {
  container: {
    height: '100%',
    display: 'flex',
    flexDirection: 'column',
  },
  header: {
    padding: `${theme.spacing.xl} ${theme.spacing['2xl']}`,
    borderBottom: `1px solid ${theme.colors.border}`,
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
  },
  title: {
    fontSize: theme.typography.sizes['2xl'],
    fontWeight: theme.typography.weights.bold,
    color: theme.colors.text,
    marginBottom: theme.spacing.sm,
  },
  subtitle: {
    fontSize: theme.typography.sizes.base,
    color: theme.colors.textSecondary,
  },
  content: {
    flex: 1,
    overflow: 'auto',
    backgroundColor: theme.colors.background,
  },
  tabs: {
    display: 'flex',
    gap: theme.spacing.sm,
    padding: `${theme.spacing.lg} ${theme.spacing['2xl']} 0`,
  },
  tab: {
    padding: `${theme.spacing.sm} ${theme.spacing.lg}`,
    backgroundColor: 'transparent',
    border: 'none',
    borderRadius: theme.borderRadius.md,
    fontSize: theme.typography.sizes.sm,
    fontWeight: theme.typography.weights.medium,
    color: theme.colors.textMuted,
    cursor: 'pointer',
    transition: `all ${theme.transitions.fast}`,
  },
  tabActive: {
    backgroundColor: theme.colors.primaryLight,
    color: theme.colors.primary,
  },
  section: {
    padding: theme.spacing['2xl'],
  },

  // Profile list
  profileGrid: {
    display: 'grid',
    gridTemplateColumns: 'repeat(auto-fill, minmax(320px, 1fr))',
    gap: theme.spacing.lg,
  },
  profileCard: {
    backgroundColor: theme.colors.surface,
    borderRadius: theme.borderRadius.xl,
    border: `1px solid ${theme.colors.border}`,
    padding: theme.spacing.xl,
    cursor: 'pointer',
    transition: `all ${theme.transitions.fast}`,
  },
  profileName: {
    fontSize: theme.typography.sizes.md,
    fontWeight: theme.typography.weights.semibold,
    color: theme.colors.text,
    marginBottom: theme.spacing.xs,
  },
  profileDesc: {
    fontSize: theme.typography.sizes.sm,
    color: theme.colors.textSecondary,
    marginBottom: theme.spacing.md,
  },
  profileMeta: {
    display: 'flex',
    gap: theme.spacing.md,
    fontSize: theme.typography.sizes.xs,
    color: theme.colors.textMuted,
  },
  badge: {
    fontSize: theme.typography.sizes.xs,
    padding: `${theme.spacing.xs} ${theme.spacing.md}`,
    borderRadius: theme.borderRadius.full,
    fontWeight: theme.typography.weights.medium,
    backgroundColor: theme.colors.surfaceHover,
    color: theme.colors.textMuted,
  },

  // Editor
  editorContainer: {
    display: 'flex',
    gap: theme.spacing['2xl'],
    padding: theme.spacing['2xl'],
    height: 'calc(100% - 60px)',
  },
  editorLeft: {
    flex: 1,
    display: 'flex',
    flexDirection: 'column',
    minWidth: 0,
  },
  editorRight: {
    width: '350px',
    display: 'flex',
    flexDirection: 'column',
    gap: theme.spacing.lg,
  },
  editorHeader: {
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: theme.spacing.lg,
  },
  textarea: {
    flex: 1,
    width: '100%',
    padding: theme.spacing.lg,
    border: `1px solid ${theme.colors.border}`,
    borderRadius: theme.borderRadius.lg,
    fontSize: theme.typography.sizes.sm,
    fontFamily: theme.typography.fontMono,
    backgroundColor: theme.colors.surface,
    color: theme.colors.text,
    outline: 'none',
    resize: 'none',
    lineHeight: theme.typography.lineHeight.relaxed,
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
  label: {
    fontSize: theme.typography.sizes.sm,
    fontWeight: theme.typography.weights.medium,
    color: theme.colors.text,
    marginBottom: theme.spacing.xs,
    display: 'block',
  },
  fieldGroup: {
    marginBottom: theme.spacing.lg,
  },

  // Buttons
  btnPrimary: {
    padding: `${theme.spacing.sm} ${theme.spacing.lg}`,
    backgroundColor: theme.colors.primary,
    color: '#fff',
    border: 'none',
    borderRadius: theme.borderRadius.lg,
    fontSize: theme.typography.sizes.sm,
    fontWeight: theme.typography.weights.medium,
    cursor: 'pointer',
    transition: `all ${theme.transitions.fast}`,
  },
  btnSecondary: {
    padding: `${theme.spacing.sm} ${theme.spacing.lg}`,
    backgroundColor: 'transparent',
    color: theme.colors.text,
    border: `1px solid ${theme.colors.border}`,
    borderRadius: theme.borderRadius.lg,
    fontSize: theme.typography.sizes.sm,
    fontWeight: theme.typography.weights.medium,
    cursor: 'pointer',
    transition: `all ${theme.transitions.fast}`,
  },
  btnDanger: {
    padding: `${theme.spacing.sm} ${theme.spacing.lg}`,
    backgroundColor: 'transparent',
    color: theme.colors.error,
    border: `1px solid ${theme.colors.error}30`,
    borderRadius: theme.borderRadius.lg,
    fontSize: theme.typography.sizes.sm,
    fontWeight: theme.typography.weights.medium,
    cursor: 'pointer',
  },
  btnGroup: {
    display: 'flex',
    gap: theme.spacing.sm,
  },

  // Test workbench
  testArea: {
    backgroundColor: theme.colors.surface,
    borderRadius: theme.borderRadius.xl,
    border: `1px solid ${theme.colors.border}`,
    padding: theme.spacing.xl,
    display: 'flex',
    flexDirection: 'column',
    gap: theme.spacing.lg,
  },
  testTitle: {
    fontSize: theme.typography.sizes.md,
    fontWeight: theme.typography.weights.semibold,
    color: theme.colors.text,
  },
  testTextarea: {
    width: '100%',
    minHeight: '150px',
    padding: theme.spacing.md,
    border: `1px solid ${theme.colors.border}`,
    borderRadius: theme.borderRadius.lg,
    fontSize: theme.typography.sizes.sm,
    fontFamily: theme.typography.fontMono,
    backgroundColor: theme.colors.background,
    color: theme.colors.text,
    outline: 'none',
    resize: 'vertical',
  },
  resultBox: {
    backgroundColor: theme.colors.background,
    borderRadius: theme.borderRadius.lg,
    padding: theme.spacing.lg,
    fontSize: theme.typography.sizes.sm,
    fontFamily: theme.typography.fontMono,
    whiteSpace: 'pre-wrap',
    wordBreak: 'break-word',
    maxHeight: '400px',
    overflow: 'auto',
    border: `1px solid ${theme.colors.border}`,
    color: theme.colors.text,
  },
  statusSuccess: {
    backgroundColor: theme.colors.successLight,
    color: theme.colors.success,
  },
  statusError: {
    backgroundColor: theme.colors.errorLight,
    color: theme.colors.error,
  },
  uploadArea: {
    border: `2px dashed ${theme.colors.border}`,
    borderRadius: theme.borderRadius.lg,
    padding: theme.spacing.xl,
    textAlign: 'center',
    cursor: 'pointer',
    transition: `all ${theme.transitions.fast}`,
    color: theme.colors.textMuted,
    fontSize: theme.typography.sizes.sm,
  },
  empty: {
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'center',
    justifyContent: 'center',
    padding: theme.spacing['3xl'],
    color: theme.colors.textMuted,
    fontSize: theme.typography.sizes.sm,
  },
  selectInput: {
    width: '100%',
    padding: theme.spacing.md,
    border: `1px solid ${theme.colors.border}`,
    borderRadius: theme.borderRadius.lg,
    fontSize: theme.typography.sizes.sm,
    backgroundColor: theme.colors.surface,
    color: theme.colors.text,
    cursor: 'pointer',
  },
};

// Default template for new profiles (as JSON string for editor)
const DEFAULT_PROFILE_JSON = JSON.stringify({
  id: 'neues-profil',
  name: 'Neues Profil',
  description: 'Beschreibung des Dokumenttyps',
  version: '1.0',
  detection: {
    keywords: ['Keyword1', 'Keyword2'],
  },
  fields: {
    daten: {
      feld1: { type: 'text', required: true, label: 'Feldname', hint: 'Hinweis fuer das LLM' },
      feld2: { type: 'date', label: 'Datum' },
    },
  },
  guidelines: '- Hinweis 1\n- Hinweis 2',
}, null, 2);

export default function ExtractionProfilesPage() {
  const [activeTab, setActiveTab] = useState('profiles');
  const [profiles, setProfiles] = useState([]);
  const [loading, setLoading] = useState(true);
  const [selectedProfile, setSelectedProfile] = useState(null);
  const [editorYaml, setEditorYaml] = useState('');
  const [isNew, setIsNew] = useState(false);

  // KI-Assistent state
  const [aiFile, setAiFile] = useState(null);
  const [aiDescription, setAiDescription] = useState('');
  const [aiLoading, setAiLoading] = useState(false);
  const [aiError, setAiError] = useState('');
  const aiFileInputRef = useRef(null);

  // Test workbench state
  const [testProfileId, setTestProfileId] = useState('');
  const [testText, setTestText] = useState('');
  const [testFile, setTestFile] = useState(null);
  const [testResult, setTestResult] = useState(null);
  const [testLoading, setTestLoading] = useState(false);
  const fileInputRef = useRef(null);

  useEffect(() => {
    loadProfiles();
  }, []);

  const loadProfiles = async () => {
    try {
      const res = await apiGet('/extraction/profiles');
      if (res.ok) {
        const data = await res.json();
        setProfiles(data.profiles || []);
      }
    } catch (error) {
      console.error('Error loading profiles:', error);
    } finally {
      setLoading(false);
    }
  };

  const openProfile = async (profileId) => {
    try {
      const res = await apiGet(`/extraction/profiles/${profileId}`);
      if (res.ok) {
        const data = await res.json();
        setSelectedProfile(data.profile);
        setEditorYaml(profileToJson(data.profile));
        setIsNew(false);
        setActiveTab('editor');
      }
    } catch (error) {
      console.error('Error loading profile:', error);
    }
  };

  const createNewProfile = () => {
    setSelectedProfile(null);
    setEditorYaml(DEFAULT_PROFILE_JSON);
    setIsNew(true);
    setActiveTab('editor');
  };

  const saveProfile = async () => {
    try {
      let profile;
      try {
        profile = JSON.parse(editorYaml);
      } catch {
        alert('Ungültiges JSON. Bitte Syntax prüfen.');
        return;
      }

      if (!profile.id) {
        alert('Profil muss eine "id" haben.');
        return;
      }

      let saveRes;
      if (isNew) {
        saveRes = await apiPost('/extraction/profiles', profile);
      } else {
        saveRes = await apiPut(`/extraction/profiles/${selectedProfile.id}`, profile);
      }

      if (saveRes.ok) {
        await loadProfiles();
        const data = await saveRes.json();
        setSelectedProfile(data.profile);
        setIsNew(false);
      } else {
        const error = await saveRes.json();
        alert(error.error || 'Fehler beim Speichern');
      }
    } catch (error) {
      console.error('Error saving profile:', error);
      alert('Fehler beim Speichern: ' + error.message);
    }
  };

  const deleteProfileHandler = async () => {
    if (!selectedProfile) return;
    if (!confirm(`Profil "${selectedProfile.name}" wirklich loeschen?`)) return;

    try {
      const res = await apiDelete(`/extraction/profiles/${selectedProfile.id}`);
      if (res.ok) {
        setSelectedProfile(null);
        setActiveTab('profiles');
        await loadProfiles();
      }
    } catch (error) {
      console.error('Error deleting profile:', error);
    }
  };

  const runTest = async () => {
    setTestLoading(true);
    setTestResult(null);

    try {
      let res;
      if (testFile) {
        const formData = new FormData();
        formData.append('file', testFile);
        if (testProfileId) formData.append('profile_id', testProfileId);
        res = await apiPostForm('/extraction/extract', formData);
      } else if (testText.trim()) {
        res = await apiPost('/extraction/extract', {
          text: testText,
          profile_id: testProfileId || undefined,
        });
      } else {
        setTestResult({ error: 'Bitte Text eingeben oder Datei hochladen' });
        setTestLoading(false);
        return;
      }

      if (res.ok) {
        const data = await res.json();
        setTestResult(data);
      } else {
        const error = await res.json();
        setTestResult({ error: error.error || 'Extraktion fehlgeschlagen' });
      }
    } catch (error) {
      setTestResult({ error: error.message });
    } finally {
      setTestLoading(false);
    }
  };

  const generateWithAi = async () => {
    if (!aiFile) return;

    setAiLoading(true);
    setAiError('');

    try {
      const formData = new FormData();
      formData.append('file', aiFile);
      if (aiDescription.trim()) {
        formData.append('description', aiDescription);
      }

      const res = await apiPostForm('/extraction/generate-profile', formData);

      if (res.ok) {
        const data = await res.json();
        setEditorYaml(JSON.stringify(data.profile, null, 2));
        setIsNew(true);
        setSelectedProfile(null);
        setAiFile(null);
        setAiDescription('');
      } else {
        const error = await res.json();
        setAiError(error.error || 'Generierung fehlgeschlagen');
      }
    } catch (error) {
      setAiError(error.message);
    } finally {
      setAiLoading(false);
    }
  };

  const handleAiFileDrop = (e) => {
    e.preventDefault();
    const file = e.dataTransfer?.files?.[0];
    if (file) setAiFile(file);
  };

  const handleFileDrop = (e) => {
    e.preventDefault();
    const file = e.dataTransfer?.files?.[0];
    if (file) setTestFile(file);
  };

  return (
    <div style={styles.container}>
      <div style={styles.header}>
        <div>
          <h1 style={styles.title}>Dokumenten-Extraktion</h1>
          <p style={styles.subtitle}>
            Extraktionsprofile verwalten und Dokumente strukturiert auslesen
          </p>
        </div>
        <button style={styles.btnPrimary} onClick={createNewProfile}>
          + Neues Profil
        </button>
      </div>

      <div style={styles.tabs}>
        {[
          { id: 'profiles', label: 'Profile' },
          { id: 'editor', label: 'Editor' },
          { id: 'test', label: 'Test-Werkbank' },
        ].map(tab => (
          <button
            key={tab.id}
            style={{
              ...styles.tab,
              ...(activeTab === tab.id ? styles.tabActive : {}),
            }}
            onClick={() => setActiveTab(tab.id)}
            onMouseEnter={(e) => {
              if (activeTab !== tab.id) e.currentTarget.style.backgroundColor = theme.colors.surfaceHover;
            }}
            onMouseLeave={(e) => {
              if (activeTab !== tab.id) e.currentTarget.style.backgroundColor = 'transparent';
            }}
          >
            {tab.label}
          </button>
        ))}
      </div>

      <div style={styles.content}>
        {activeTab === 'profiles' && (
          <div style={styles.section}>
            {loading ? (
              <div style={styles.empty}>Laden...</div>
            ) : profiles.length === 0 ? (
              <div style={styles.empty}>
                <p>Noch keine Extraktionsprofile vorhanden.</p>
                <button style={{ ...styles.btnPrimary, marginTop: theme.spacing.lg }} onClick={createNewProfile}>
                  Erstes Profil erstellen
                </button>
              </div>
            ) : (
              <div style={styles.profileGrid}>
                {profiles.map(profile => (
                  <div
                    key={profile.id}
                    style={styles.profileCard}
                    onClick={() => openProfile(profile.id)}
                    onMouseEnter={(e) => {
                      e.currentTarget.style.borderColor = theme.colors.primary;
                    }}
                    onMouseLeave={(e) => {
                      e.currentTarget.style.borderColor = theme.colors.border;
                    }}
                  >
                    <div style={styles.profileName}>{profile.name}</div>
                    <div style={styles.profileDesc}>{profile.description}</div>
                    <div style={styles.profileMeta}>
                      <span style={styles.badge}>{profile.fieldCount} Felder</span>
                      <span style={styles.badge}>v{profile.version}</span>
                      {profile.keywords?.length > 0 && (
                        <span style={styles.badge}>{profile.keywords.length} Keywords</span>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        {activeTab === 'editor' && (
          <div style={styles.editorContainer}>
            <div style={styles.editorLeft}>
              <div style={styles.editorHeader}>
                <div style={{ fontSize: theme.typography.sizes.md, fontWeight: theme.typography.weights.semibold, color: theme.colors.text }}>
                  {isNew ? 'Neues Profil' : (selectedProfile?.name || 'Profil bearbeiten')}
                </div>
                <div style={styles.btnGroup}>
                  {selectedProfile && !isNew && (
                    <button style={styles.btnDanger} onClick={deleteProfileHandler}>
                      Loeschen
                    </button>
                  )}
                  <button style={styles.btnPrimary} onClick={saveProfile}>
                    Speichern
                  </button>
                </div>
              </div>
              <textarea
                style={styles.textarea}
                value={editorYaml}
                onChange={(e) => setEditorYaml(e.target.value)}
                placeholder="Profil-JSON hier eingeben..."
                spellCheck={false}
              />
            </div>
            <div style={styles.editorRight}>
              {/* KI-Assistent */}
              <div style={{
                backgroundColor: theme.colors.surface,
                borderRadius: theme.borderRadius.xl,
                border: `1px solid ${theme.colors.border}`,
                padding: theme.spacing.xl,
                display: 'flex',
                flexDirection: 'column',
                gap: theme.spacing.md,
              }}>
                <div style={{
                  fontSize: theme.typography.sizes.sm,
                  fontWeight: theme.typography.weights.semibold,
                  color: theme.colors.primary,
                  display: 'flex',
                  alignItems: 'center',
                  gap: theme.spacing.sm,
                }}>
                  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke={theme.colors.primary} strokeWidth="2">
                    <path d="M12 2L2 7l10 5 10-5-10-5z" />
                    <path d="M2 17l10 5 10-5" />
                    <path d="M2 12l10 5 10-5" />
                  </svg>
                  KI-Assistent
                </div>
                <div style={{ fontSize: theme.typography.sizes.xs, color: theme.colors.textMuted }}>
                  Lade ein Beispieldokument hoch und die KI erstellt automatisch ein passendes Extraktionsprofil.
                </div>

                <div>
                  <label style={{ ...styles.label, fontSize: theme.typography.sizes.xs }}>Beispieldokument</label>
                  <div
                    style={{
                      ...styles.uploadArea,
                      padding: theme.spacing.lg,
                      fontSize: theme.typography.sizes.xs,
                      ...(aiFile ? { borderColor: theme.colors.primary, color: theme.colors.primary } : {}),
                    }}
                    onClick={() => aiFileInputRef.current?.click()}
                    onDragOver={(e) => e.preventDefault()}
                    onDrop={handleAiFileDrop}
                  >
                    {aiFile ? (
                      <span>
                        {aiFile.name}
                        <button
                          style={{ marginLeft: theme.spacing.sm, color: theme.colors.error, background: 'none', border: 'none', cursor: 'pointer', fontSize: theme.typography.sizes.xs }}
                          onClick={(e) => { e.stopPropagation(); setAiFile(null); }}
                        >
                          Entfernen
                        </button>
                      </span>
                    ) : (
                      'Datei hierher ziehen oder klicken'
                    )}
                  </div>
                  <input
                    ref={aiFileInputRef}
                    type="file"
                    style={{ display: 'none' }}
                    onChange={(e) => setAiFile(e.target.files?.[0] || null)}
                    accept=".pdf,.doc,.docx,.xlsx,.txt,.md,.png,.jpg,.jpeg"
                  />
                </div>

                <div>
                  <label style={{ ...styles.label, fontSize: theme.typography.sizes.xs }}>Was soll extrahiert werden? (optional)</label>
                  <input
                    style={{ ...styles.input, fontSize: theme.typography.sizes.xs }}
                    value={aiDescription}
                    onChange={(e) => setAiDescription(e.target.value)}
                    placeholder="z.B. Kopfdaten und Positionen eines Lieferscheins"
                  />
                </div>

                {aiError && (
                  <div style={{ fontSize: theme.typography.sizes.xs, color: theme.colors.error }}>
                    {aiError}
                  </div>
                )}

                <button
                  style={{
                    ...styles.btnPrimary,
                    fontSize: theme.typography.sizes.xs,
                    opacity: aiLoading || !aiFile ? 0.6 : 1,
                    width: '100%',
                  }}
                  onClick={generateWithAi}
                  disabled={aiLoading || !aiFile}
                >
                  {aiLoading ? 'Generiere Profil...' : 'Profil generieren'}
                </button>
              </div>

              {/* Referenz */}
              <div style={{
                fontSize: theme.typography.sizes.xs,
                color: theme.colors.textMuted,
                lineHeight: theme.typography.lineHeight.relaxed,
              }}>
                <strong style={{ color: theme.colors.textSecondary }}>Profil-Referenz</strong>
                <p style={{ marginTop: theme.spacing.sm }}><strong>Typen:</strong> text, number, date, boolean</p>
                <p><strong>Arrays:</strong> _array: true + _item_fields</p>
                <p><strong>Pflicht:</strong> required: true</p>
                <p><strong>Hints:</strong> Extraktions-Hilfe pro Feld</p>
              </div>
            </div>
          </div>
        )}

        {activeTab === 'test' && (
          <div style={styles.section}>
            <div style={styles.testArea}>
              <div style={styles.testTitle}>Test-Werkbank</div>

              <div style={styles.fieldGroup}>
                <label style={styles.label}>Extraktionsprofil</label>
                <select
                  style={styles.selectInput}
                  value={testProfileId}
                  onChange={(e) => setTestProfileId(e.target.value)}
                >
                  <option value="">Auto-Erkennung</option>
                  {profiles.map(p => (
                    <option key={p.id} value={p.id}>{p.name}</option>
                  ))}
                </select>
              </div>

              <div style={styles.fieldGroup}>
                <label style={styles.label}>Dokument-Text</label>
                <textarea
                  style={styles.testTextarea}
                  value={testText}
                  onChange={(e) => setTestText(e.target.value)}
                  placeholder="Dokumenttext hier einfuegen..."
                />
              </div>

              <div style={styles.fieldGroup}>
                <label style={styles.label}>Oder Datei hochladen</label>
                <div
                  style={{
                    ...styles.uploadArea,
                    ...(testFile ? { borderColor: theme.colors.primary, color: theme.colors.primary } : {}),
                  }}
                  onClick={() => fileInputRef.current?.click()}
                  onDragOver={(e) => e.preventDefault()}
                  onDrop={handleFileDrop}
                >
                  {testFile ? testFile.name : 'Datei hierher ziehen oder klicken zum Auswaehlen'}
                  {testFile && (
                    <button
                      style={{ marginLeft: theme.spacing.md, color: theme.colors.error, background: 'none', border: 'none', cursor: 'pointer', fontSize: theme.typography.sizes.xs }}
                      onClick={(e) => { e.stopPropagation(); setTestFile(null); }}
                    >
                      Entfernen
                    </button>
                  )}
                </div>
                <input
                  ref={fileInputRef}
                  type="file"
                  style={{ display: 'none' }}
                  onChange={(e) => setTestFile(e.target.files?.[0] || null)}
                  accept=".pdf,.doc,.docx,.xlsx,.txt,.md,.png,.jpg,.jpeg"
                />
              </div>

              <button
                style={{ ...styles.btnPrimary, opacity: testLoading ? 0.6 : 1 }}
                onClick={runTest}
                disabled={testLoading}
              >
                {testLoading ? 'Extrahiere...' : 'Extraktion starten'}
              </button>

              {testResult && (
                <div>
                  <div style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: theme.spacing.md,
                    marginBottom: theme.spacing.md,
                  }}>
                    <span style={styles.testTitle}>Ergebnis</span>
                    {testResult.success !== undefined && (
                      <span style={{
                        ...styles.badge,
                        ...(testResult.success ? styles.statusSuccess : styles.statusError),
                      }}>
                        {testResult.success ? 'Erfolgreich' : 'Fehler'}
                      </span>
                    )}
                    {testResult.validation && !testResult.validation.valid && (
                      <span style={{ ...styles.badge, ...styles.statusError }}>
                        {testResult.validation.errors.length} Validierungsfehler
                      </span>
                    )}
                    {testResult.retries > 0 && (
                      <span style={styles.badge}>{testResult.retries} Retries</span>
                    )}
                  </div>
                  <div style={styles.resultBox}>
                    {JSON.stringify(testResult.error || testResult.data || testResult, null, 2)}
                  </div>
                  {testResult.validation?.errors?.length > 0 && (
                    <div style={{ marginTop: theme.spacing.md }}>
                      <div style={{ fontSize: theme.typography.sizes.sm, fontWeight: theme.typography.weights.semibold, color: theme.colors.error, marginBottom: theme.spacing.sm }}>
                        Validierungsfehler:
                      </div>
                      {testResult.validation.errors.map((err, i) => (
                        <div key={i} style={{ fontSize: theme.typography.sizes.xs, color: theme.colors.error, marginBottom: theme.spacing.xs }}>
                          {err.field}: {err.message}
                        </div>
                      ))}
                    </div>
                  )}
                  {testResult.validation?.corrected?.length > 0 && (
                    <div style={{ marginTop: theme.spacing.md }}>
                      <div style={{ fontSize: theme.typography.sizes.sm, fontWeight: theme.typography.weights.semibold, color: theme.colors.warning, marginBottom: theme.spacing.sm }}>
                        Auto-korrigiert:
                      </div>
                      {testResult.validation.corrected.map((field, i) => (
                        <div key={i} style={{ fontSize: theme.typography.sizes.xs, color: theme.colors.warning, marginBottom: theme.spacing.xs }}>
                          {field}
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              )}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

// Format profile as pretty JSON for the editor
function profileToJson(profile) {
  try {
    return JSON.stringify(profile, null, 2);
  } catch {
    return '{}';
  }
}

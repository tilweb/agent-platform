import { useRef, useState } from 'react';
import { theme } from '../../../config/theme';
import { UploadIcon } from '../../../components/Icons';

/**
 * Drag-&-Drop-Upload für EMMA-Prozess-Export-PDFs (Muster: ExtractionProjectsPage).
 * props.onFiles(FileList|File[])  ·  props.busy
 */
const styles = {
  zone: {
    border: `2px dashed ${theme.colors.border}`,
    borderRadius: theme.borderRadius.xl,
    padding: theme.spacing['2xl'],
    textAlign: 'center',
    cursor: 'pointer',
    transition: `all ${theme.transitions.fast}`,
    backgroundColor: theme.colors.surface,
  },
  zoneActive: { borderColor: theme.colors.primary, backgroundColor: theme.colors.primaryLight },
  title: { fontSize: theme.typography.sizes.base, fontWeight: theme.typography.weights.medium, color: theme.colors.text, marginTop: theme.spacing.sm },
  hint: { fontSize: theme.typography.sizes.xs, color: theme.colors.textMuted, marginTop: theme.spacing.xs },
};

export default function Dropzone({ onFiles, busy }) {
  const inputRef = useRef(null);
  const [active, setActive] = useState(false);

  const handle = (fileList) => {
    const files = Array.from(fileList || []).filter((f) => /\.pdf$/i.test(f.name));
    if (files.length) onFiles?.(files);
  };

  return (
    <div
      style={{ ...styles.zone, ...(active ? styles.zoneActive : {}), opacity: busy ? 0.6 : 1, pointerEvents: busy ? 'none' : 'auto' }}
      onClick={() => inputRef.current?.click()}
      onDragOver={(e) => { e.preventDefault(); setActive(true); }}
      onDragLeave={() => setActive(false)}
      onDrop={(e) => { e.preventDefault(); setActive(false); handle(e.dataTransfer.files); }}
    >
      <UploadIcon size={28} color={theme.colors.primary} />
      <div style={styles.title}>{busy ? 'Analysiere…' : 'EMMA-Prozess-Export(e) hier ablegen'}</div>
      <div style={styles.hint}>
        PDF · mehrere Prozesse einer Familie gemeinsam hochladen (Master + Unterprozesse) für korrekten Call-Graph & OCR-Budget
      </div>
      <input
        ref={inputRef}
        type="file"
        accept="application/pdf,.pdf"
        multiple
        hidden
        onChange={(e) => { handle(e.target.files); e.target.value = ''; }}
      />
    </div>
  );
}

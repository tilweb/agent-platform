/**
 * ContractDetail
 * Detailed view of a contract with metadata and document
 */

import { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import ReactMarkdown from 'react-markdown';
import { theme } from '../../config/theme';
import { useContracts } from '../../hooks/useContracts';
import { ArrowLeftIcon, TrashIcon, ChatIcon, BookIcon } from '../../components/Icons';
import AddToCollectionModal from '../../components/AddToCollectionModal';

const styles = {
  container: {
    height: '100%',
    display: 'flex',
    flexDirection: 'column',
  },
  header: {
    padding: `${theme.spacing.xl} ${theme.spacing['2xl']}`,
    borderBottom: `1px solid ${theme.colors.border}`,
  },
  backLink: {
    display: 'inline-flex',
    alignItems: 'center',
    gap: theme.spacing.xs,
    fontSize: theme.typography.sizes.sm,
    color: theme.colors.primary,
    cursor: 'pointer',
    marginBottom: theme.spacing.lg,
    border: 'none',
    background: 'none',
    padding: 0,
    fontWeight: theme.typography.weights.medium,
  },
  headerContent: {
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
  },
  headerLeft: {
    flex: 1,
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
    display: 'flex',
    alignItems: 'center',
    gap: theme.spacing.md,
  },
  statusBadge: {
    fontSize: theme.typography.sizes.xs,
    padding: `${theme.spacing.xs} ${theme.spacing.md}`,
    borderRadius: theme.borderRadius.full,
    fontWeight: theme.typography.weights.medium,
  },
  statusActive: {
    backgroundColor: theme.colors.successLight,
    color: theme.colors.success,
  },
  statusExpiring: {
    backgroundColor: theme.colors.warningLight,
    color: theme.colors.warning,
  },
  statusExpired: {
    backgroundColor: theme.colors.errorLight,
    color: theme.colors.error,
  },
  headerActions: {
    display: 'flex',
    gap: theme.spacing.md,
  },
  actionButton: {
    padding: `${theme.spacing.sm} ${theme.spacing.lg}`,
    backgroundColor: 'transparent',
    color: theme.colors.text,
    border: `1px solid ${theme.colors.border}`,
    borderRadius: theme.borderRadius.lg,
    fontSize: theme.typography.sizes.sm,
    fontWeight: theme.typography.weights.medium,
    cursor: 'pointer',
    transition: `all ${theme.transitions.fast}`,
    display: 'flex',
    alignItems: 'center',
    gap: theme.spacing.sm,
  },
  deleteButton: {
    color: theme.colors.error,
    borderColor: `${theme.colors.error}30`,
  },
  content: {
    flex: 1,
    padding: theme.spacing['2xl'],
    overflow: 'auto',
  },
  // Tabs
  tabs: {
    display: 'flex',
    gap: theme.spacing.sm,
    marginBottom: theme.spacing.xl,
    borderBottom: `1px solid ${theme.colors.border}`,
    paddingBottom: theme.spacing.md,
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
  // Metadata section
  metadataGrid: {
    display: 'grid',
    gridTemplateColumns: 'repeat(2, 1fr)',
    gap: theme.spacing.xl,
  },
  metadataSection: {
    backgroundColor: theme.colors.surface,
    borderRadius: theme.borderRadius.lg,
    border: `1px solid ${theme.colors.border}`,
    padding: theme.spacing.xl,
  },
  sectionTitle: {
    fontSize: theme.typography.sizes.base,
    fontWeight: theme.typography.weights.semibold,
    color: theme.colors.text,
    marginBottom: theme.spacing.lg,
    display: 'flex',
    alignItems: 'center',
    gap: theme.spacing.sm,
  },
  fieldRow: {
    display: 'flex',
    justifyContent: 'space-between',
    padding: `${theme.spacing.sm} 0`,
    borderBottom: `1px solid ${theme.colors.borderLight}`,
  },
  fieldRowLast: {
    borderBottom: 'none',
  },
  fieldLabel: {
    fontSize: theme.typography.sizes.sm,
    color: theme.colors.textMuted,
  },
  fieldValue: {
    fontSize: theme.typography.sizes.sm,
    color: theme.colors.text,
    fontWeight: theme.typography.weights.medium,
    textAlign: 'right',
  },
  // Obligations
  obligationsList: {
    display: 'flex',
    flexDirection: 'column',
    gap: theme.spacing.md,
  },
  obligationCard: {
    padding: theme.spacing.lg,
    backgroundColor: theme.colors.background,
    borderRadius: theme.borderRadius.lg,
    border: `1px solid ${theme.colors.borderLight}`,
  },
  obligationHeader: {
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: theme.spacing.sm,
  },
  obligationParty: {
    fontSize: theme.typography.sizes.xs,
    fontWeight: theme.typography.weights.medium,
    color: theme.colors.primary,
    textTransform: 'uppercase',
  },
  obligationCategory: {
    fontSize: theme.typography.sizes.xs,
    padding: `${theme.spacing.xs} ${theme.spacing.sm}`,
    borderRadius: theme.borderRadius.sm,
    backgroundColor: theme.colors.surfaceHover,
    color: theme.colors.textSecondary,
  },
  obligationDescription: {
    fontSize: theme.typography.sizes.sm,
    color: theme.colors.text,
  },
  obligationRecurrence: {
    fontSize: theme.typography.sizes.xs,
    color: theme.colors.textMuted,
    marginTop: theme.spacing.sm,
  },
  // Document
  documentSection: {
    backgroundColor: theme.colors.surface,
    borderRadius: theme.borderRadius.lg,
    border: `1px solid ${theme.colors.border}`,
    padding: theme.spacing.xl,
  },
  documentContent: {
    fontSize: theme.typography.sizes.sm,
    color: theme.colors.text,
    lineHeight: theme.typography.lineHeight.relaxed,
  },
  // Loading & Error
  loading: {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    padding: theme.spacing['3xl'],
    color: theme.colors.textMuted,
  },
  error: {
    padding: theme.spacing.xl,
    textAlign: 'center',
    color: theme.colors.error,
  },
  // Delete modal
  modalOverlay: {
    position: 'fixed',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    zIndex: 1000,
  },
  modal: {
    backgroundColor: theme.colors.surface,
    borderRadius: theme.borderRadius.xl,
    padding: theme.spacing.xl,
    maxWidth: '400px',
    width: '90%',
  },
  modalTitle: {
    fontSize: theme.typography.sizes.lg,
    fontWeight: theme.typography.weights.semibold,
    color: theme.colors.text,
    marginBottom: theme.spacing.md,
  },
  modalText: {
    fontSize: theme.typography.sizes.sm,
    color: theme.colors.textSecondary,
    marginBottom: theme.spacing.xl,
  },
  modalActions: {
    display: 'flex',
    justifyContent: 'flex-end',
    gap: theme.spacing.md,
  },
  modalCancelButton: {
    padding: `${theme.spacing.sm} ${theme.spacing.lg}`,
    backgroundColor: 'transparent',
    color: theme.colors.text,
    border: `1px solid ${theme.colors.border}`,
    borderRadius: theme.borderRadius.lg,
    fontSize: theme.typography.sizes.sm,
    fontWeight: theme.typography.weights.medium,
    cursor: 'pointer',
  },
  modalDeleteButton: {
    padding: `${theme.spacing.sm} ${theme.spacing.lg}`,
    backgroundColor: theme.colors.error,
    color: '#fff',
    border: 'none',
    borderRadius: theme.borderRadius.lg,
    fontSize: theme.typography.sizes.sm,
    fontWeight: theme.typography.weights.medium,
    cursor: 'pointer',
  },
};

function ContractDetail() {
  const { id } = useParams();
  const navigate = useNavigate();
  const { getContract, getContractDocument, deleteContract, schemas } = useContracts();

  const [contract, setContract] = useState(null);
  const [document, setDocument] = useState(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState(null);
  const [activeTab, setActiveTab] = useState('overview');
  const [showDeleteModal, setShowDeleteModal] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);
  const [showCollectionModal, setShowCollectionModal] = useState(false);

  useEffect(() => {
    loadContract();
  }, [id]);

  const loadContract = async () => {
    try {
      setIsLoading(true);
      setError(null);

      const contractData = await getContract(id);
      setContract(contractData);

      const documentData = await getContractDocument(id);
      setDocument(documentData);
    } catch (err) {
      console.error('Error loading contract:', err);
      setError(err.message);
    } finally {
      setIsLoading(false);
    }
  };

  const handleDelete = async () => {
    setIsDeleting(true);
    try {
      await deleteContract(id);
      navigate('/apps/vertragsmanagement');
    } catch (err) {
      console.error('Error deleting contract:', err);
      setError(err.message);
    } finally {
      setIsDeleting(false);
      setShowDeleteModal(false);
    }
  };

  const handleStartChat = () => {
    // Navigate to chat with this contract as a reader
    const readers = [{
      id: contract.id,
      type: 'contract',
      title: `${contract.computed.party_a} - ${contract.computed.party_b}`,
      metadata: {
        contract_type: contract.contract_type,
        filename: contract.upload_filename,
      },
    }];
    const params = new URLSearchParams();
    params.set('readers', JSON.stringify(readers));
    navigate(`/?${params.toString()}`);
  };

  const handleAddToCollection = () => {
    setShowCollectionModal(true);
  };

  const handleCollectionSuccess = (collectionId) => {
    setShowCollectionModal(false);
    navigate(`/knowledge?collection=${collectionId}`);
  };

  const formatCurrency = (value) => {
    return new Intl.NumberFormat('de-DE', {
      style: 'currency',
      currency: 'EUR',
      minimumFractionDigits: 0,
      maximumFractionDigits: 0,
    }).format(value);
  };

  const getStatusBadge = (status) => {
    switch (status) {
      case 'active':
        return { style: styles.statusActive, label: 'Aktiv' };
      case 'expiring':
        return { style: styles.statusExpiring, label: 'Läuft aus' };
      case 'expired':
        return { style: styles.statusExpired, label: 'Abgelaufen' };
      default:
        return { style: {}, label: status };
    }
  };

  const getSchemaName = (typeId) => {
    const schema = schemas.find((s) => s.id === typeId);
    return schema?.name || typeId;
  };

  const getCategoryLabel = (category) => {
    const labels = {
      payment: 'Zahlung',
      delivery: 'Lieferung',
      maintenance: 'Wartung',
      reporting: 'Berichtspflicht',
      confidentiality: 'Geheimhaltung',
      compliance: 'Compliance',
      other: 'Sonstiges',
    };
    return labels[category] || category;
  };

  if (isLoading) {
    return (
      <div style={styles.container}>
        <div style={styles.header}>
          <button
            style={styles.backLink}
            onClick={() => navigate('/apps/vertragsmanagement')}
          >
            <ArrowLeftIcon size={16} /> Vertragsmanagement
          </button>
        </div>
        <div style={styles.loading}>Lade Vertrag...</div>
      </div>
    );
  }

  if (error || !contract) {
    return (
      <div style={styles.container}>
        <div style={styles.header}>
          <button
            style={styles.backLink}
            onClick={() => navigate('/apps/vertragsmanagement')}
          >
            <ArrowLeftIcon size={16} /> Vertragsmanagement
          </button>
        </div>
        <div style={styles.error}>
          {error || 'Vertrag nicht gefunden'}
        </div>
      </div>
    );
  }

  const statusBadge = getStatusBadge(contract.computed.status);

  return (
    <div style={styles.container}>
      <div style={styles.header}>
        <button
          style={styles.backLink}
          onClick={() => navigate('/apps/vertragsmanagement')}
        >
          <ArrowLeftIcon size={16} /> Vertragsmanagement
        </button>

        <div style={styles.headerContent}>
          <div style={styles.headerLeft}>
            <h1 style={styles.title}>
              {contract.computed.party_a} - {contract.computed.party_b}
            </h1>
            <div style={styles.subtitle}>
              <span>{getSchemaName(contract.contract_type)}</span>
              <span>|</span>
              <span style={{ ...styles.statusBadge, ...statusBadge.style }}>
                {statusBadge.label}
              </span>
              {contract.computed.days_to_expiry !== null && (
                <>
                  <span>|</span>
                  <span>
                    {contract.computed.days_to_expiry > 0
                      ? `Noch ${contract.computed.days_to_expiry} Tage`
                      : 'Abgelaufen'}
                  </span>
                </>
              )}
            </div>
          </div>

          <div style={styles.headerActions}>
            <button
              style={styles.actionButton}
              onClick={handleStartChat}
              onMouseEnter={(e) => {
                e.currentTarget.style.backgroundColor = theme.colors.surfaceHover;
              }}
              onMouseLeave={(e) => {
                e.currentTarget.style.backgroundColor = 'transparent';
              }}
            >
              <ChatIcon size={16} />
              Chat starten
            </button>
            <button
              style={styles.actionButton}
              onClick={handleAddToCollection}
              onMouseEnter={(e) => {
                e.currentTarget.style.backgroundColor = theme.colors.surfaceHover;
              }}
              onMouseLeave={(e) => {
                e.currentTarget.style.backgroundColor = 'transparent';
              }}
            >
              <BookIcon size={16} />
              Zu Collection
            </button>
            <a
              href={`/api/apps/vertragsmanagement/contracts/${contract.id}/original`}
              style={styles.actionButton}
              target="_blank"
              rel="noopener noreferrer"
              onMouseEnter={(e) => {
                e.currentTarget.style.backgroundColor = theme.colors.surfaceHover;
              }}
              onMouseLeave={(e) => {
                e.currentTarget.style.backgroundColor = 'transparent';
              }}
            >
              <DownloadIcon size={16} />
              Original
            </a>
            <button
              style={{ ...styles.actionButton, ...styles.deleteButton }}
              onClick={() => setShowDeleteModal(true)}
              onMouseEnter={(e) => {
                e.currentTarget.style.backgroundColor = theme.colors.errorLight;
              }}
              onMouseLeave={(e) => {
                e.currentTarget.style.backgroundColor = 'transparent';
              }}
            >
              <TrashIcon size={16} />
              Löschen
            </button>
          </div>
        </div>
      </div>

      <div style={styles.content}>
        {/* Tabs */}
        <div style={styles.tabs}>
          <button
            style={{
              ...styles.tab,
              ...(activeTab === 'overview' ? styles.tabActive : {}),
            }}
            onClick={() => setActiveTab('overview')}
          >
            Übersicht
          </button>
          <button
            style={{
              ...styles.tab,
              ...(activeTab === 'obligations' ? styles.tabActive : {}),
            }}
            onClick={() => setActiveTab('obligations')}
          >
            Pflichten ({contract.obligations?.length || 0})
          </button>
          <button
            style={{
              ...styles.tab,
              ...(activeTab === 'document' ? styles.tabActive : {}),
            }}
            onClick={() => setActiveTab('document')}
          >
            Dokument
          </button>
        </div>

        {/* Overview Tab */}
        {activeTab === 'overview' && (
          <div style={styles.metadataGrid}>
            {/* Key Info */}
            <div style={styles.metadataSection}>
              <h3 style={styles.sectionTitle}>
                <InfoIcon size={18} color={theme.colors.primary} />
                Vertragsübersicht
              </h3>
              <div style={styles.fieldRow}>
                <span style={styles.fieldLabel}>Vertragstyp</span>
                <span style={styles.fieldValue}>
                  {getSchemaName(contract.contract_type)}
                </span>
              </div>
              <div style={styles.fieldRow}>
                <span style={styles.fieldLabel}>Partei A</span>
                <span style={styles.fieldValue}>{contract.computed.party_a}</span>
              </div>
              <div style={styles.fieldRow}>
                <span style={styles.fieldLabel}>Partei B</span>
                <span style={styles.fieldValue}>{contract.computed.party_b}</span>
              </div>
              <div style={styles.fieldRow}>
                <span style={styles.fieldLabel}>Beginn</span>
                <span style={styles.fieldValue}>{contract.computed.start_date}</span>
              </div>
              <div style={styles.fieldRow}>
                <span style={styles.fieldLabel}>Ende</span>
                <span style={styles.fieldValue}>
                  {contract.computed.end_date || 'Unbefristet'}
                </span>
              </div>
              <div style={{ ...styles.fieldRow, ...styles.fieldRowLast }}>
                <span style={styles.fieldLabel}>Jahreswert</span>
                <span style={styles.fieldValue}>
                  {formatCurrency(contract.computed.annual_value)}
                </span>
              </div>
            </div>

            {/* Extracted Metadata */}
            <div style={styles.metadataSection}>
              <h3 style={styles.sectionTitle}>
                <DataIcon size={18} color={theme.colors.primary} />
                Extrahierte Daten
              </h3>
              {Object.entries(contract.extracted || {}).map(
                ([groupName, fields], groupIndex, groupArr) => (
                  <div key={groupName}>
                    <div
                      style={{
                        fontSize: theme.typography.sizes.xs,
                        fontWeight: theme.typography.weights.semibold,
                        color: theme.colors.textMuted,
                        textTransform: 'uppercase',
                        marginTop: groupIndex > 0 ? theme.spacing.lg : 0,
                        marginBottom: theme.spacing.sm,
                      }}
                    >
                      {groupName}
                    </div>
                    {Object.entries(fields || {}).map(
                      ([fieldName, value], fieldIndex, fieldArr) => (
                        <div
                          key={fieldName}
                          style={{
                            ...styles.fieldRow,
                            ...(fieldIndex === fieldArr.length - 1 &&
                            groupIndex === groupArr.length - 1
                              ? styles.fieldRowLast
                              : {}),
                          }}
                        >
                          <span style={styles.fieldLabel}>{fieldName}</span>
                          <span style={styles.fieldValue}>
                            {value !== null && value !== undefined
                              ? String(value)
                              : '-'}
                          </span>
                        </div>
                      )
                    )}
                  </div>
                )
              )}
            </div>
          </div>
        )}

        {/* Obligations Tab */}
        {activeTab === 'obligations' && (
          <div style={styles.metadataSection}>
            <h3 style={styles.sectionTitle}>
              <ChecklistIcon size={18} color={theme.colors.primary} />
              Vertragliche Pflichten
            </h3>
            {contract.obligations?.length > 0 ? (
              <div style={styles.obligationsList}>
                {contract.obligations.map((obligation, index) => (
                  <div key={index} style={styles.obligationCard}>
                    <div style={styles.obligationHeader}>
                      <span style={styles.obligationParty}>
                        {obligation.party === 'party_a'
                          ? contract.computed.party_a
                          : contract.computed.party_b}
                      </span>
                      <span style={styles.obligationCategory}>
                        {getCategoryLabel(obligation.category)}
                      </span>
                    </div>
                    <p style={styles.obligationDescription}>
                      {obligation.description}
                    </p>
                    {obligation.recurrence && (
                      <p style={styles.obligationRecurrence}>
                        Wiederholung: {obligation.recurrence}
                      </p>
                    )}
                  </div>
                ))}
              </div>
            ) : (
              <p style={{ color: theme.colors.textMuted, fontSize: theme.typography.sizes.sm }}>
                Keine Pflichten extrahiert.
              </p>
            )}
          </div>
        )}

        {/* Document Tab */}
        {activeTab === 'document' && (
          <div style={styles.documentSection}>
            <h3 style={styles.sectionTitle}>
              <DocumentIcon size={18} color={theme.colors.primary} />
              Vertragstext
            </h3>
            <div style={styles.documentContent}>
              {document ? (
                <ReactMarkdown
                  components={{
                    h1: ({ children }) => (
                      <h1 style={{ fontSize: theme.typography.sizes.xl, fontWeight: theme.typography.weights.bold, marginTop: theme.spacing.xl, marginBottom: theme.spacing.md, color: theme.colors.text }}>{children}</h1>
                    ),
                    h2: ({ children }) => (
                      <h2 style={{ fontSize: theme.typography.sizes.lg, fontWeight: theme.typography.weights.semibold, marginTop: theme.spacing.lg, marginBottom: theme.spacing.sm, color: theme.colors.text }}>{children}</h2>
                    ),
                    h3: ({ children }) => (
                      <h3 style={{ fontSize: theme.typography.sizes.base, fontWeight: theme.typography.weights.semibold, marginTop: theme.spacing.md, marginBottom: theme.spacing.sm, color: theme.colors.text }}>{children}</h3>
                    ),
                    p: ({ children }) => (
                      <p style={{ marginBottom: theme.spacing.md }}>{children}</p>
                    ),
                    ul: ({ children }) => (
                      <ul style={{ marginBottom: theme.spacing.md, paddingLeft: theme.spacing.xl }}>{children}</ul>
                    ),
                    ol: ({ children }) => (
                      <ol style={{ marginBottom: theme.spacing.md, paddingLeft: theme.spacing.xl }}>{children}</ol>
                    ),
                    li: ({ children }) => (
                      <li style={{ marginBottom: theme.spacing.xs }}>{children}</li>
                    ),
                    strong: ({ children }) => (
                      <strong style={{ fontWeight: theme.typography.weights.semibold }}>{children}</strong>
                    ),
                    table: ({ children }) => (
                      <table style={{ width: '100%', borderCollapse: 'collapse', marginBottom: theme.spacing.md }}>{children}</table>
                    ),
                    th: ({ children }) => (
                      <th style={{ padding: theme.spacing.sm, border: `1px solid ${theme.colors.border}`, textAlign: 'left', backgroundColor: theme.colors.surfaceHover, fontWeight: theme.typography.weights.medium }}>{children}</th>
                    ),
                    td: ({ children }) => (
                      <td style={{ padding: theme.spacing.sm, border: `1px solid ${theme.colors.border}`, textAlign: 'left' }}>{children}</td>
                    ),
                    blockquote: ({ children }) => (
                      <blockquote style={{ borderLeft: `4px solid ${theme.colors.primary}`, paddingLeft: theme.spacing.md, marginLeft: 0, marginBottom: theme.spacing.md, color: theme.colors.textSecondary, fontStyle: 'italic' }}>{children}</blockquote>
                    ),
                    hr: () => (
                      <hr style={{ border: 'none', borderTop: `1px solid ${theme.colors.border}`, margin: `${theme.spacing.lg} 0` }} />
                    ),
                  }}
                >
                  {document}
                </ReactMarkdown>
              ) : (
                'Kein Dokument verfügbar.'
              )}
            </div>
          </div>
        )}
      </div>

      {/* Delete Modal */}
      {showDeleteModal && (
        <div style={styles.modalOverlay} onClick={() => setShowDeleteModal(false)}>
          <div style={styles.modal} onClick={(e) => e.stopPropagation()}>
            <h3 style={styles.modalTitle}>Vertrag löschen?</h3>
            <p style={styles.modalText}>
              Möchten Sie diesen Vertrag wirklich löschen? Diese Aktion kann nicht
              rückgängig gemacht werden.
            </p>
            <div style={styles.modalActions}>
              <button
                style={styles.modalCancelButton}
                onClick={() => setShowDeleteModal(false)}
                disabled={isDeleting}
              >
                Abbrechen
              </button>
              <button
                style={styles.modalDeleteButton}
                onClick={handleDelete}
                disabled={isDeleting}
              >
                {isDeleting ? 'Löschen...' : 'Löschen'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Add to Collection Modal */}
      <AddToCollectionModal
        isOpen={showCollectionModal}
        onClose={() => setShowCollectionModal(false)}
        selectedItems={contract ? [{
          id: contract.id,
          type: 'contract',
          title: `${contract.computed.party_a} - ${contract.computed.party_b}`,
          metadata: {
            contract_type: contract.contract_type,
            filename: contract.upload_filename,
          },
        }] : []}
        onSuccess={handleCollectionSuccess}
      />
    </div>
  );
}

// Icons
function InfoIcon({ size = 20, color = 'currentColor' }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth="2">
      <circle cx="12" cy="12" r="10" />
      <line x1="12" y1="16" x2="12" y2="12" />
      <line x1="12" y1="8" x2="12.01" y2="8" />
    </svg>
  );
}

function DataIcon({ size = 20, color = 'currentColor' }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth="2">
      <ellipse cx="12" cy="5" rx="9" ry="3" />
      <path d="M21 12c0 1.66-4 3-9 3s-9-1.34-9-3" />
      <path d="M3 5v14c0 1.66 4 3 9 3s9-1.34 9-3V5" />
    </svg>
  );
}

function ChecklistIcon({ size = 20, color = 'currentColor' }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth="2">
      <path d="M9 11l3 3L22 4" />
      <path d="M21 12v7a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11" />
    </svg>
  );
}

function DocumentIcon({ size = 20, color = 'currentColor' }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth="2">
      <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" />
      <polyline points="14 2 14 8 20 8" />
      <line x1="16" y1="13" x2="8" y2="13" />
      <line x1="16" y1="17" x2="8" y2="17" />
    </svg>
  );
}

function DownloadIcon({ size = 20 }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
      <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" />
      <polyline points="7 10 12 15 17 10" />
      <line x1="12" y1="15" x2="12" y2="3" />
    </svg>
  );
}

export default ContractDetail;

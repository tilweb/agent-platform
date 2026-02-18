import { theme } from '../config/theme';

const statusStyles = {
  container: {
    display: 'inline-flex',
    alignItems: 'center',
    gap: theme.spacing.sm,
    padding: `${theme.spacing.sm} ${theme.spacing.lg}`,
    borderRadius: theme.borderRadius.full,
    fontSize: theme.typography.sizes.sm,
    fontWeight: theme.typography.weights.medium,
  },
  thinking: {
    backgroundColor: theme.colors.thinkingLight,
    color: theme.colors.thinking,
  },
  tool: {
    backgroundColor: theme.colors.warningLight,
    color: theme.colors.warning,
  },
  delegation: {
    backgroundColor: theme.colors.infoLight,
    color: theme.colors.info,
  },
  skill: {
    backgroundColor: '#8b5cf620',
    color: '#8b5cf6',
  },
  workflow: {
    backgroundColor: '#3b82f620',
    color: '#3b82f6',
  },
  spinner: {
    width: '16px',
    height: '16px',
    border: '2px solid transparent',
    borderRadius: '50%',
    animation: 'spin 1s linear infinite',
  },
  thinkingSpinner: {
    borderTopColor: theme.colors.thinking,
    borderRightColor: theme.colors.thinking,
  },
  toolSpinner: {
    borderTopColor: theme.colors.warning,
    borderRightColor: theme.colors.warning,
  },
  delegationSpinner: {
    borderTopColor: theme.colors.info,
    borderRightColor: theme.colors.info,
  },
  skillSpinner: {
    borderTopColor: '#8b5cf6',
    borderRightColor: '#8b5cf6',
  },
  workflowSpinner: {
    borderTopColor: '#3b82f6',
    borderRightColor: '#3b82f6',
  },
  progressBar: {
    height: '4px',
    backgroundColor: '#3b82f640',
    borderRadius: '2px',
    overflow: 'hidden',
    marginLeft: '8px',
    width: '60px',
  },
  progressFill: {
    height: '100%',
    backgroundColor: '#3b82f6',
    transition: 'width 0.3s ease',
  },
  icon: {
    width: '16px',
    height: '16px',
  },
};

const spinnerKeyframes = `
  @keyframes spin {
    to { transform: rotate(360deg); }
  }
`;

function AgentStatus({ status }) {
  if (!status) return null;

  const isThinking = status.type === 'thinking';
  const isTool = status.type === 'tool' || status.type === 'tool_complete';
  const isDelegation = status.type === 'delegation' || status.type === 'delegation_complete';
  const isSkill = status.type === 'skill';
  const isWorkflow = status.type === 'workflow';

  const getContainerStyle = () => {
    if (isWorkflow) return statusStyles.workflow;
    if (isSkill) return statusStyles.skill;
    if (isThinking) return statusStyles.thinking;
    if (isTool) return statusStyles.tool;
    if (isDelegation) return statusStyles.delegation;
    return statusStyles.thinking;
  };

  const getSpinnerStyle = () => {
    if (isWorkflow) return statusStyles.workflowSpinner;
    if (isSkill) return statusStyles.skillSpinner;
    if (isThinking) return statusStyles.thinkingSpinner;
    if (isTool) return statusStyles.toolSpinner;
    if (isDelegation) return statusStyles.delegationSpinner;
    return statusStyles.thinkingSpinner;
  };

  const getIcon = () => {
    if (isWorkflow) return <WorkflowIcon style={statusStyles.icon} />;
    if (isSkill) return <SkillIcon style={statusStyles.icon} />;
    if (isDelegation) return <DelegationIcon style={statusStyles.icon} />;
    return <div style={{ ...statusStyles.spinner, ...getSpinnerStyle() }} />;
  };

  return (
    <>
      <style>{spinnerKeyframes}</style>
      <div style={{ ...statusStyles.container, ...getContainerStyle() }}>
        {getIcon()}
        <span>{status.message}</span>
        {isSkill && status.tools?.length > 0 && (
          <span style={{ opacity: 0.7, fontSize: '0.85em' }}>
            ({status.tools.join(', ')})
          </span>
        )}
        {isWorkflow && status.progress !== undefined && (
          <div style={statusStyles.progressBar}>
            <div style={{ ...statusStyles.progressFill, width: `${status.progress}%` }} />
          </div>
        )}
      </div>
    </>
  );
}

function DelegationIcon({ style }) {
  return (
    <svg style={style} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
      <path d="M16 3h5v5" />
      <path d="M21 3l-7 7" />
      <path d="M21 14v5a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h5" />
    </svg>
  );
}

function SkillIcon({ style }) {
  return (
    <svg style={style} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
      <polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2" />
    </svg>
  );
}

function WorkflowIcon({ style }) {
  return (
    <svg style={style} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
      <polyline points="22 12 18 12 15 21 9 3 6 12 2 12" />
    </svg>
  );
}

export default AgentStatus;

// Agent icon colors
const agentColors = {
  general: '#14b8a6',
  researcher: '#3b82f6',
  writer: '#8b5cf6',
  default: '#6b7280',
};

function AgentIcon({ agentId, style }) {
  const color = agentColors[agentId] || agentColors.default;

  switch (agentId) {
    case 'general':
      return (
        <svg style={style} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth="2">
          <circle cx="12" cy="12" r="10" />
          <path d="M12 16v-4" />
          <path d="M12 8h.01" />
        </svg>
      );
    case 'researcher':
      return (
        <svg style={style} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth="2">
          <circle cx="11" cy="11" r="8" />
          <path d="M21 21l-4.35-4.35" />
        </svg>
      );
    case 'writer':
      return (
        <svg style={style} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth="2">
          <path d="M12 19l7-7 3 3-7 7-3-3z" />
          <path d="M18 13l-1.5-7.5L2 2l3.5 14.5L13 18l5-5z" />
          <path d="M2 2l7.586 7.586" />
          <circle cx="11" cy="11" r="2" />
        </svg>
      );
    default:
      return (
        <svg style={style} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth="2">
          <path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2" />
          <circle cx="12" cy="7" r="4" />
        </svg>
      );
  }
}

export default AgentIcon;
export { AgentIcon, agentColors };

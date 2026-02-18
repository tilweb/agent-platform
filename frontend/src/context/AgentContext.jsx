import { createContext, useContext } from 'react';
import { useAgents } from '../hooks/useAgents';

const AgentContext = createContext(null);

export function AgentProvider({ children }) {
  const agentState = useAgents();

  return (
    <AgentContext.Provider value={agentState}>
      {children}
    </AgentContext.Provider>
  );
}

export function useAgentContext() {
  const context = useContext(AgentContext);
  if (!context) {
    throw new Error('useAgentContext must be used within an AgentProvider');
  }
  return context;
}

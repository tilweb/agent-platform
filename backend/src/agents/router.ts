import { llmService, type Message } from '../services/llm';
import { buildRouterPrompt, listAgents } from '../services/agents';

const DEFAULT_AGENT = 'general';

/**
 * Route a user message to the appropriate agent using LLM-based analysis.
 *
 * NOTE: This function is kept as a fallback utility but is no longer used
 * in the main chat flow. The supervisor agent now handles all routing
 * and orchestration directly.
 */
export async function routeMessage(userMessage: string): Promise<string> {
  try {
    // Build the router prompt with current agent list
    const routerPrompt = await buildRouterPrompt();

    const messages: Message[] = [
      { role: 'system', content: routerPrompt },
      { role: 'user', content: userMessage },
    ];

    // Use non-streaming call for fast routing decision
    let response = '';

    for await (const chunk of llmService.streamChat(messages)) {
      if (!chunk?.choices?.[0]) continue;
      const choice = chunk.choices[0];
      if (choice?.delta?.content) {
        response += choice.delta.content;
      }
    }

    // Parse the response to extract agent ID
    const agentId = parseRouterResponse(response);

    // Validate the agent exists
    const agents = await listAgents();
    const validIds = agents.map(a => a.id);

    if (validIds.includes(agentId)) {
      console.log(`Router selected agent: ${agentId}`);
      return agentId;
    }

    console.warn(`Router returned invalid agent "${agentId}", falling back to ${DEFAULT_AGENT}`);
    return DEFAULT_AGENT;

  } catch (error: any) {
    console.error('Router error:', error.message);
    return DEFAULT_AGENT;
  }
}

/**
 * Parse the router response to extract the agent ID
 */
function parseRouterResponse(response: string): string {
  // Look for "ROUTE: <agent_id>" pattern
  const routeMatch = response.match(/ROUTE:\s*(\w+)/i);

  if (routeMatch && routeMatch[1]) {
    return routeMatch[1].toLowerCase();
  }

  // Fallback: look for agent names in the response
  const agents = ['general', 'researcher', 'writer'];
  const lowerResponse = response.toLowerCase();

  for (const agent of agents) {
    if (lowerResponse.includes(agent)) {
      return agent;
    }
  }

  return DEFAULT_AGENT;
}

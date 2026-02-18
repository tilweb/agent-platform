/**
 * Knowledge Base Tools - exports and instances
 */

export { KbSearchTool } from './KnowledgeTools';
export { KbIndexTool } from './KnowledgeTools';
export { KbManageTool } from './KnowledgeTools';

import { KbSearchTool } from './KnowledgeTools';
import { KbIndexTool } from './KnowledgeTools';
import { KbManageTool } from './KnowledgeTools';

export const kbSearchTool = new KbSearchTool();
export const kbIndexTool = new KbIndexTool();
export const kbManageTool = new KbManageTool();

export const knowledgeTools = [
  kbSearchTool,
  kbIndexTool,
  kbManageTool,
];

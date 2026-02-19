/**
 * Central data directory paths
 *
 * All file-based persistence uses DATA_DIR as the root.
 * Configurable via DATA_DIR env variable, defaults to ./data (relative to backend CWD).
 */

import { resolve, join } from 'path';

export const DATA_DIR = resolve(process.env.DATA_DIR || './data');

// Auth
export const AUTH_DIR = join(DATA_DIR, 'auth');
export const USERS_DIR = join(AUTH_DIR, 'users');
export const SESSIONS_DIR = join(AUTH_DIR, 'sessions');
export const GROUPS_DIR = join(AUTH_DIR, 'groups');
export const OAUTH_STATES_DIR = join(AUTH_DIR, 'oauth-states');

// Chat & Conversations
export const CHATS_DIR = join(DATA_DIR, 'chats');
export const CONVERSATIONS_DIR = join(DATA_DIR, 'conversations');
export const CHAT_UPLOADS_DIR = join(DATA_DIR, 'chat-uploads');
export const CHAT_FOLDERS_FILE = join(DATA_DIR, 'chat-folders.yaml');

// Config
export const CONFIG_DIR = join(DATA_DIR, 'config');
export const PROVIDERS_CONFIG = join(CONFIG_DIR, 'providers.yaml');
export const AGENTS_CONFIG = join(CONFIG_DIR, 'agents.md');
export const MCP_SERVERS_CONFIG = join(CONFIG_DIR, 'mcp-servers.yaml');

// Agents
export const AGENTS_DIR = join(DATA_DIR, 'agents');

// Knowledge Base
export const KB_BASE = join(DATA_DIR, 'knowledge-base');
export const KB_COLLECTIONS_FILE = join(KB_BASE, 'collections.yaml');
export const KB_INCOMING_DIR = join(KB_BASE, 'incoming');

// Tasks
export const TASKS_DIR = join(DATA_DIR, 'tasks');
export const TASK_RESULTS_DIR = join(DATA_DIR, 'tasks', 'results');

// Content
export const GENERATED_IMAGES_DIR = join(DATA_DIR, 'generated-images');
export const EXPORTS_DIR = join(DATA_DIR, 'exports');

// Memory
export const MEMORY_SESSIONS_DIR = join(DATA_DIR, 'memory', 'sessions');
export const MEMORY_USERS_DIR = join(DATA_DIR, 'memory', 'users');

// Projects
export const PROJECTS_DIR = join(DATA_DIR, 'projects');

// Tables
export const TABLES_DIR = join(DATA_DIR, 'tables');

// Connections
export const CONNECTIONS_DIR = join(DATA_DIR, 'connections');

// Skills
export const SKILLS_DIR = join(DATA_DIR, 'skills');

// Tools
export const CUSTOM_TOOLS_DIR = join(DATA_DIR, 'tools', 'custom');

// Apps
export const APPS_DIR = join(DATA_DIR, 'apps');
export const APPS_REGISTRY = join(APPS_DIR, 'registry.yaml');

// Usage & Audit
export const USAGE_DIR = join(DATA_DIR, 'usage');
export const AUDIT_DIR = join(DATA_DIR, 'audit');

// Notifications
export const NOTIFICATIONS_DIR = join(DATA_DIR, 'notifications');

// Temp
export const TEMP_DIR = join(DATA_DIR, 'temp');

// External API URLs (require explicit configuration, no hardcoded fallbacks)
export const MARKITDOWN_API_URL = process.env.MARKITDOWN_API_URL || '';
export const MARKITDOWN_API_KEY = process.env.ADACOR_AI_API_KEY || '';

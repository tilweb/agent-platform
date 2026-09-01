/**
 * Fester Icon-Katalog + Farbpalette für Agenten-Avatare (Add/Edit-Picker).
 * Reines Datenmodul (keine Komponenten) — die gewählte Icon-ID + Hex-Farbe
 * werden am Agenten gespeichert (`agent.icon`, `agent.color`).
 */

import {
  RobotIcon, BrainIcon, SparklesIcon, ChatIcon, PenIcon, DocumentIcon, BookIcon,
  FolderIcon, BarChartIcon, TargetIcon, BriefcaseIcon, CodeIcon, SearchIcon,
  LightningIcon, UserIcon, ClipboardIcon, CalendarIcon, MailIcon, ImageIcon,
  PlugIcon, TicketIcon, KeyIcon, BellIcon, TableIcon,
} from './Icons';

export const AGENT_ICONS = [
  { id: 'robot', label: 'Roboter', Comp: RobotIcon },
  { id: 'brain', label: 'Gehirn', Comp: BrainIcon },
  { id: 'sparkles', label: 'Funken', Comp: SparklesIcon },
  { id: 'chat', label: 'Chat', Comp: ChatIcon },
  { id: 'pen', label: 'Stift', Comp: PenIcon },
  { id: 'document', label: 'Dokument', Comp: DocumentIcon },
  { id: 'book', label: 'Buch', Comp: BookIcon },
  { id: 'folder', label: 'Ordner', Comp: FolderIcon },
  { id: 'chart', label: 'Diagramm', Comp: BarChartIcon },
  { id: 'target', label: 'Ziel', Comp: TargetIcon },
  { id: 'briefcase', label: 'Aktentasche', Comp: BriefcaseIcon },
  { id: 'code', label: 'Code', Comp: CodeIcon },
  { id: 'search', label: 'Suche', Comp: SearchIcon },
  { id: 'lightning', label: 'Blitz', Comp: LightningIcon },
  { id: 'user', label: 'Person', Comp: UserIcon },
  { id: 'clipboard', label: 'Klemmbrett', Comp: ClipboardIcon },
  { id: 'calendar', label: 'Kalender', Comp: CalendarIcon },
  { id: 'mail', label: 'E-Mail', Comp: MailIcon },
  { id: 'image', label: 'Bild', Comp: ImageIcon },
  { id: 'plug', label: 'Integration', Comp: PlugIcon },
  { id: 'ticket', label: 'Ticket', Comp: TicketIcon },
  { id: 'key', label: 'Schlüssel', Comp: KeyIcon },
  { id: 'bell', label: 'Glocke', Comp: BellIcon },
  { id: 'table', label: 'Tabelle', Comp: TableIcon },
];

export const AGENT_ICON_MAP = Object.fromEntries(AGENT_ICONS.map((i) => [i.id, i.Comp]));

export const AGENT_COLORS = [
  '#14b8a6', '#06b6d4', '#3b82f6', '#6366f1', '#8b5cf6', '#a855f7',
  '#ec4899', '#f43f5e', '#ef4444', '#f97316', '#f59e0b', '#22c55e',
  '#10b981', '#64748b',
];

export const DEFAULT_AGENT_ICON = 'robot';
export const DEFAULT_AGENT_COLOR = '#64748b';

/** Icon-Komponente zu einer Icon-ID (Fallback = Default-Icon). */
export function agentIconComp(icon) {
  return AGENT_ICON_MAP[icon] || AGENT_ICON_MAP[DEFAULT_AGENT_ICON];
}

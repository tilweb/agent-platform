/**
 * AgentAvatar / AgentGlyph — Darstellung eines Agenten-Icons aus gewähltem
 * Icon (Katalog-ID) + Farbe (Hex). Katalog + Palette liegen in `./agentIcons`.
 */

import { createElement } from 'react';
import { theme } from '../config/theme';
import { agentIconComp, DEFAULT_AGENT_COLOR } from './agentIcons';

/** Nur das Icon-Element (ohne Fläche) — via createElement, damit der
 *  React-Compiler kein „Component während Render" moniert. */
export function AgentGlyph({ icon, color, size = 24 }) {
  return createElement(agentIconComp(icon), { size, color: color || DEFAULT_AGENT_COLOR });
}

/** AgentAvatar — quadratische Icon-Fläche mit getöntem Hintergrund. */
export function AgentAvatar({ icon, color, size = 40, style }) {
  const c = color || DEFAULT_AGENT_COLOR;
  return (
    <div
      style={{
        width: size, height: size, flexShrink: 0,
        borderRadius: theme.borderRadius.md,
        backgroundColor: `${c}22`,
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        ...style,
      }}
    >
      <AgentGlyph icon={icon} color={c} size={Math.round(size * 0.55)} />
    </div>
  );
}

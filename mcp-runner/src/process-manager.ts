/**
 * Process Manager
 *
 * Manages the lifecycle of all MCP server connections.
 * npx-based MCP servers are installed into a shared package store
 * so all replicas use the same versions without per-instance caching.
 */

import { spawnSync } from 'child_process';
import { existsSync } from 'fs';
import { McpConnection } from './connection';
import type { ConnectRequest, ServerStatus, McpToolInfo, McpCallResult } from './types';

/** Shared package store — bind-mounted volume, same for all replicas */
const PACKAGE_STORE = process.env.MCP_PACKAGE_STORE || '/mcp-packages';

class ProcessManager {
  /** Only these commands are allowed to be spawned by the runner */
  private static ALLOWED_COMMANDS = new Set(['npx', 'node']);

  private connections = new Map<string, McpConnection>();
  private pending = new Map<string, Promise<McpConnection>>();

  async connect(request: ConnectRequest): Promise<McpConnection> {
    // Already connected → return immediately
    const existing = this.connections.get(request.id);
    if (existing && existing.status === 'connected') {
      return existing;
    }

    // Connect already in progress → wait for it instead of starting a second one
    const inflight = this.pending.get(request.id);
    if (inflight) {
      return inflight;
    }

    const promise = this.doConnect(request);
    this.pending.set(request.id, promise);

    try {
      return await promise;
    } finally {
      this.pending.delete(request.id);
    }
  }

  private async doConnect(request: ConnectRequest): Promise<McpConnection> {
    // Disconnect stale connection if any
    const existing = this.connections.get(request.id);
    if (existing) {
      await existing.disconnect();
    }

    // Resolve npx → local binary from shared package store
    const resolved = this.resolveNpx(request);

    const connection = new McpConnection(resolved);
    this.connections.set(request.id, connection);
    await connection.connect();
    return connection;
  }

  async disconnect(serverId: string): Promise<void> {
    const connection = this.connections.get(serverId);
    if (connection) {
      await connection.disconnect();
      this.connections.delete(serverId);
    }
  }

  async disconnectAll(): Promise<void> {
    const ids = Array.from(this.connections.keys());
    await Promise.all(ids.map(id => this.disconnect(id)));
  }

  getConnection(serverId: string): McpConnection | undefined {
    return this.connections.get(serverId);
  }

  getAllStatuses(): ServerStatus[] {
    return Array.from(this.connections.values()).map(conn => ({
      id: conn.serverId,
      name: conn.serverName,
      status: conn.status,
      error: conn.error || undefined,
      toolCount: conn.getTools().length,
      connectedAt: conn.connectedAt || undefined,
      pid: conn.pid || undefined,
      memoryMB: conn.getMemoryMB() || undefined,
    }));
  }

  getStatus(serverId: string): ServerStatus | null {
    const conn = this.connections.get(serverId);
    if (!conn) return null;

    return {
      id: conn.serverId,
      name: conn.serverName,
      status: conn.status,
      error: conn.error || undefined,
      toolCount: conn.getTools().length,
      connectedAt: conn.connectedAt || undefined,
      pid: conn.pid || undefined,
      memoryMB: conn.getMemoryMB() || undefined,
    };
  }

  getTools(serverId: string): McpToolInfo[] {
    const conn = this.connections.get(serverId);
    return conn ? conn.getTools() : [];
  }

  async callTool(serverId: string, toolName: string, args: Record<string, any>): Promise<McpCallResult> {
    const conn = this.connections.get(serverId);
    if (!conn) {
      throw new Error(`Server "${serverId}" not found`);
    }
    return conn.callTool(toolName, args);
  }

  async refreshTools(serverId: string): Promise<McpToolInfo[]> {
    const conn = this.connections.get(serverId);
    if (!conn) {
      throw new Error(`Server "${serverId}" not found`);
    }
    return conn.refreshTools();
  }

  get serverCount(): number {
    return this.connections.size;
  }

  get connectedCount(): number {
    let count = 0;
    for (const conn of this.connections.values()) {
      if (conn.status === 'connected') count++;
    }
    return count;
  }

  // =====================
  // Package Resolution
  // =====================

  /**
   * Resolve npx commands to locally installed binaries in the shared package store.
   * If the package isn't installed yet, runs `npm install --prefix` first.
   * Non-npx commands are passed through unchanged.
   */
  private resolveNpx(request: ConnectRequest): ConnectRequest {
    // Reject unknown commands — only npx and node are allowed
    if (!ProcessManager.ALLOWED_COMMANDS.has(request.command)) {
      throw new Error(`Command "${request.command}" is not allowed. Allowed: ${[...ProcessManager.ALLOWED_COMMANDS].join(', ')}`);
    }

    if (request.command !== 'npx' || !existsSync(PACKAGE_STORE)) {
      return request;
    }

    const args = request.args || [];
    // Extract package name: npx -y @scope/package [...rest] → @scope/package
    const pkgArg = args.find(a => !a.startsWith('-'));
    if (!pkgArg) return request;

    // Remaining args after package name (e.g. /data for filesystem server)
    const pkgIndex = args.indexOf(pkgArg);
    const serverArgs = args.slice(pkgIndex + 1);

    // Ensure package is installed in shared store
    this.ensureInstalled(pkgArg);

    // Find the binary name from the package
    const binDir = `${PACKAGE_STORE}/node_modules/.bin`;
    const binName = this.findBinary(binDir, pkgArg);

    if (!binName) {
      console.warn(`No binary found for ${pkgArg} in ${binDir}, falling back to npx`);
      return request;
    }

    const resolvedCommand = `${binDir}/${binName}`;
    console.log(`Resolved: npx ${pkgArg} → ${resolvedCommand}`);

    return {
      ...request,
      command: resolvedCommand,
      args: serverArgs,
    };
  }

  /**
   * Install a package into the shared store if not already present.
   */
  private ensureInstalled(pkg: string): void {
    const pkgDir = `${PACKAGE_STORE}/node_modules/${pkg}`;
    if (existsSync(pkgDir)) {
      return;
    }

    console.log(`Installing ${pkg} into shared package store...`);
    const result = spawnSync('npm', ['install', '--ignore-scripts', '--prefix', PACKAGE_STORE, pkg], {
      stdio: ['ignore', 'pipe', 'pipe'],
      env: process.env as Record<string, string>,
      timeout: 60_000,
    });

    if (result.status !== 0) {
      const stderr = result.stderr?.toString().trim() || '';
      throw new Error(`Failed to install ${pkg}: ${stderr || `exit code ${result.status}`}`);
    }

    console.log(`Installed ${pkg} into ${PACKAGE_STORE}`);
  }

  /**
   * Find the binary name for a package by looking at .bin/ entries.
   */
  private findBinary(binDir: string, pkg: string): string | null {
    if (!existsSync(binDir)) return null;

    // Common pattern: @scope/server-foo → server-foo or mcp-server-foo
    const shortName = pkg.includes('/') ? pkg.split('/').pop()! : pkg;

    // Check for exact match, then common prefixes
    const candidates = [shortName, `mcp-${shortName}`, shortName.replace('server-', 'mcp-server-')];
    for (const name of candidates) {
      if (existsSync(`${binDir}/${name}`)) {
        return name;
      }
    }

    // Fallback: list binDir and find any match
    try {
      const { readdirSync } = require('fs');
      const bins: string[] = readdirSync(binDir);
      const match = bins.find(b => b.includes(shortName) || shortName.includes(b));
      return match || null;
    } catch {
      return null;
    }
  }

  // =====================
  // Cache Warming
  // =====================

  /**
   * Pre-install npm packages into the shared store so connect is fast later.
   * Only works for npx-based commands — others are silently skipped.
   */
  async warmCache(command: string, args?: string[]): Promise<{ cached: boolean; package?: string; error?: string }> {
    if (command !== 'npx' || !existsSync(PACKAGE_STORE)) {
      return { cached: false };
    }

    const pkgArg = (args || []).find(a => !a.startsWith('-'));
    if (!pkgArg) {
      return { cached: false };
    }

    try {
      this.ensureInstalled(pkgArg);
      return { cached: true, package: pkgArg };
    } catch (err: any) {
      return { cached: false, package: pkgArg, error: err.message };
    }
  }
}

export const processManager = new ProcessManager();

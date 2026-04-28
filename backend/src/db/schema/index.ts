/**
 * Drizzle schema barrel — re-exports every module so drizzle-kit picks them up.
 *
 * Each file uses pgSchema('<name>') so all tables live in dedicated Postgres
 * schemas (auth, chat, apps, ...) — keeps the DB browseable by feature area.
 */

export * from './auth';
export * from './audit';
export * from './chat';
export * from './memory';
export * from './connections';
export * from './notifications';
export * from './tasks';
export * from './projects';
export * from './extraction';
export * from './tables';
export * from './custom_tools';
export * from './custom_skills';
export * from './kb';
export * from './apps';
export * from './vertragsmgmt';
export * from './projektmgmt';
export * from './liefermgmt';
export * from './vsm';
export * from './wzbar';
export * from './generated';

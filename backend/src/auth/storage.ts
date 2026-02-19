/**
 * User Storage - YAML-based user persistence
 */

import { parse as parseYaml, stringify as stringifyYaml } from 'yaml';
import type { User, CreateUserInput } from './types';
import { hashPassword } from './password';
import { unlinkSync } from 'node:fs';
import { join } from 'path';
import { USERS_DIR } from '../utils/paths';

// Per-user mutex for read-modify-write operations
const userLocks = new Map<string, Promise<void>>();

async function withUserLock<T>(userId: string, fn: () => Promise<T>): Promise<T> {
  let release: () => void;
  const prev = userLocks.get(userId) || Promise.resolve();
  userLocks.set(userId, new Promise<void>((resolve) => { release = resolve; }));
  await prev;
  try {
    return await fn();
  } finally {
    release!();
  }
}

/**
 * Ensure the users directory exists
 */
async function ensureUsersDir(): Promise<void> {
  const dir = Bun.file(USERS_DIR);
  try {
    await Bun.write(join(USERS_DIR, '.gitkeep'), '');
  } catch {
    // Directory might already exist
  }
}

/**
 * Generate a unique user ID
 */
function generateUserId(): string {
  return `user_${Date.now()}_${Math.random().toString(36).substring(2, 9)}`;
}

/**
 * Get the file path for a user
 */
function getUserFilePath(userId: string): string {
  return join(USERS_DIR, `${userId}.yaml`);
}

/**
 * Save a user to storage
 */
export async function saveUser(user: User): Promise<void> {
  await ensureUsersDir();
  const filePath = getUserFilePath(user.id);
  const yaml = stringifyYaml(user);
  await Bun.write(filePath, yaml);
}

/**
 * Load a user by ID
 */
export async function loadUser(userId: string): Promise<User | null> {
  const filePath = getUserFilePath(userId);
  const file = Bun.file(filePath);

  if (!(await file.exists())) {
    return null;
  }

  const content = await file.text();
  const user = parseYaml(content) as User;

  // Default role for existing users without role
  if (!user.role) {
    user.role = 'user';
  }

  return user;
}

/**
 * Find a user by username
 */
export async function findUserByUsername(username: string): Promise<User | null> {
  await ensureUsersDir();

  const glob = new Bun.Glob('*.yaml');
  for await (const file of glob.scan(USERS_DIR)) {
    if (file === '.gitkeep') continue;

    const filePath = join(USERS_DIR, file);
    const content = await Bun.file(filePath).text();
    const user = parseYaml(content) as User;

    // Default role for existing users without role
    if (!user.role) {
      user.role = 'user';
    }

    if (user.username.toLowerCase() === username.toLowerCase()) {
      return user;
    }
  }

  return null;
}

/**
 * Find a user by email
 */
export async function findUserByEmail(email: string): Promise<User | null> {
  await ensureUsersDir();

  const glob = new Bun.Glob('*.yaml');
  for await (const file of glob.scan(USERS_DIR)) {
    if (file === '.gitkeep') continue;

    const filePath = join(USERS_DIR, file);
    const content = await Bun.file(filePath).text();
    const user = parseYaml(content) as User;

    if (user.email?.toLowerCase() === email.toLowerCase()) {
      return user;
    }
  }

  return null;
}

/**
 * Create a new user
 * First user automatically becomes admin
 */
export async function createUser(input: CreateUserInput & { role?: 'admin' | 'user' }): Promise<User> {
  const now = new Date().toISOString();
  const passwordHash = await hashPassword(input.password);

  // First user becomes admin
  const isFirstUser = !(await hasUsers());
  const role = input.role || (isFirstUser ? 'admin' : 'user');

  const user: User = {
    id: generateUserId(),
    username: input.username,
    email: input.email,
    displayName: input.displayName || input.username,
    passwordHash,
    role,
    createdAt: now,
    updatedAt: now,
    isActive: true,
  };

  await saveUser(user);
  return user;
}

/**
 * Update a user
 */
export async function updateUser(userId: string, updates: Partial<Omit<User, 'id' | 'createdAt'>>): Promise<User | null> {
  return withUserLock(userId, async () => {
    const user = await loadUser(userId);
    if (!user) {
      return null;
    }

    const updatedUser: User = {
      ...user,
      ...updates,
      updatedAt: new Date().toISOString(),
    };

    await saveUser(updatedUser);
    return updatedUser;
  });
}

/**
 * Delete a user
 */
export async function deleteUser(userId: string): Promise<boolean> {
  const filePath = getUserFilePath(userId);
  const file = Bun.file(filePath);

  if (!(await file.exists())) {
    return false;
  }

  unlinkSync(filePath);
  return true;
}

/**
 * List all users
 */
export async function listUsers(): Promise<User[]> {
  await ensureUsersDir();

  const users: User[] = [];
  const glob = new Bun.Glob('*.yaml');

  for await (const file of glob.scan(USERS_DIR)) {
    if (file === '.gitkeep') continue;

    const filePath = join(USERS_DIR, file);
    const content = await Bun.file(filePath).text();
    const user = parseYaml(content) as User;

    // Default role for existing users without role
    if (!user.role) {
      user.role = 'user';
    }

    users.push(user);
  }

  return users;
}

/**
 * Check if any users exist
 */
export async function hasUsers(): Promise<boolean> {
  await ensureUsersDir();

  const glob = new Bun.Glob('*.yaml');
  for await (const file of glob.scan(USERS_DIR)) {
    if (file !== '.gitkeep') {
      return true;
    }
  }

  return false;
}

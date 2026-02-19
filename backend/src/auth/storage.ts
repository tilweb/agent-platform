/**
 * User Storage - YAML-based user persistence
 */

import type { User, CreateUserInput } from './types';
import { hashPassword } from './password';
import { USERS_DIR } from '../utils/paths';
import { createYamlStore, listYamlIds } from '../utils/yamlStorage';

const store = createYamlStore<User>(USERS_DIR);

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
 * Generate a unique user ID
 */
function generateUserId(): string {
  return `user_${Date.now()}_${Math.random().toString(36).substring(2, 9)}`;
}

/** Apply default role for legacy users */
function withDefaults(user: User): User {
  if (!user.role) user.role = 'user';
  return user;
}

/**
 * Save a user to storage
 */
export async function saveUser(user: User): Promise<void> {
  await store.save(user.id, user);
}

/**
 * Load a user by ID
 */
export async function loadUser(userId: string): Promise<User | null> {
  const user = await store.load(userId);
  return user ? withDefaults(user) : null;
}

/**
 * Find a user by username
 */
export async function findUserByUsername(username: string): Promise<User | null> {
  const users = await listUsers();
  return users.find(u => u.username.toLowerCase() === username.toLowerCase()) ?? null;
}

/**
 * Find a user by email
 */
export async function findUserByEmail(email: string): Promise<User | null> {
  const users = await listUsers();
  return users.find(u => u.email?.toLowerCase() === email.toLowerCase()) ?? null;
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
  return store.delete(userId);
}

/**
 * List all users
 */
export async function listUsers(): Promise<User[]> {
  const ids = await store.listIds();
  const users: User[] = [];
  for (const id of ids) {
    const user = await loadUser(id);
    if (user) users.push(user);
  }
  return users;
}

/**
 * Check if any users exist
 */
export async function hasUsers(): Promise<boolean> {
  const ids = await listYamlIds(USERS_DIR);
  return ids.length > 0;
}

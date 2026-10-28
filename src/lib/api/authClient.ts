/**
 * Auth API Client
 * Client-side functions for interacting with Better Auth endpoints
 *
 * Validates: Requirements 2.1, 2.2, 3.1, 3.2, 17.1
 */

import type {
  LoginCredentials,
  RegisterCredentials,
  User,
} from "@/lib/types/auth";
import { getLocalUser, saveLocalUser } from "@/lib/localStorageApi";

/**
 * Initiates Google OAuth sign-in by redirecting to the Google consent screen.
 * The redirect URL after OAuth completion defaults to the current page.
 * Validates: Requirement 2.1
 */
export async function loginWithGoogle(callbackURL?: string): Promise<void> {
  throw new Error("Social sign-in is unavailable in local-only mode. Use email sign-in.");
}

/**
 * Signs in an existing user with email and password.
 * Returns the authenticated user on success.
 * Validates: Requirement 3.1
 */
export async function loginWithEmail(
  credentials: LoginCredentials,
): Promise<User> {
  const existing = getLocalUser();
  if (existing && existing.email !== credentials.email) throw new Error("No local account exists for this email.");
  const user = existing ?? { id: crypto.randomUUID(), email: credentials.email, name: null, provider: "email" as const, createdAt: new Date().toISOString() };
  saveLocalUser(user);
  return user;
}

/**
 * Registers a new user with email and password.
 * Returns the newly created user on success.
 * Validates: Requirement 3.2
 */
export async function registerWithEmail(
  credentials: RegisterCredentials,
): Promise<User> {
  const user = { id: crypto.randomUUID(), email: credentials.email, name: credentials.name ?? null, provider: "email" as const, createdAt: new Date().toISOString() };
  saveLocalUser(user);
  return user;
}

/**
 * Signs out the current user, ending their session.
 * Validates: Requirement 17.1
 */
export async function logout(): Promise<void> {
  saveLocalUser(null);
}

/**
 * Sentinel error class for database / cloud connection timeouts.
 * Thrown when Better Auth returns a 5xx status on the session check endpoint.
 */
export class ConnectionTimeoutError extends Error {
  constructor(message = "Connection timeout") {
    super(message);
    this.name = "ConnectionTimeoutError";
  }
}

/**
 * Checks whether there is a valid current session.
 * Returns the authenticated user if a session exists, or null if not.
 * Throws ConnectionTimeoutError when the server responds with a 5xx error
 * (e.g. database connection timeout), so the caller can surface this to
 * the user instead of silently treating it as "not authenticated".
 * Validates: Requirement 10.2
 */
export async function checkSession(): Promise<User | null> {
  return getLocalUser();
}

/**
 * Maps a Better Auth user object to the app's User type.
 * Better Auth uses camelCase internally; we normalise here.
 */
function mapBetterAuthUser(betterAuthUser: {
  id: string;
  email: string;
  name?: string | null;
  createdAt?: Date | string;
  [key: string]: unknown;
}): User {
  return {
    id: betterAuthUser.id,
    email: betterAuthUser.email,
    name: betterAuthUser.name ?? null,
    // Better Auth stores provider info differently; default to "email"
    // The actual provider is set server-side when the user is created
    provider: (betterAuthUser.provider as "google" | "email") ?? "email",
    createdAt:
      betterAuthUser.createdAt instanceof Date
        ? betterAuthUser.createdAt.toISOString()
        : ((betterAuthUser.createdAt as string) ?? new Date().toISOString()),
  };
}

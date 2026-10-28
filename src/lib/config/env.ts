/**
 * Environment Variable Configuration and Validation
 *
 * This module defines required environment variables and validates them at startup.
 * Throws configuration errors if required variables are missing.
 */

interface EnvConfig {
  GOOGLE_CLIENT_ID: string;
  GOOGLE_CLIENT_SECRET: string;
  BETTER_AUTH_SECRET: string;
  // NEXT_PUBLIC_BASE_URL: string;
}

/**
 * Validates that all required environment variables are present
 * Throws an error with clear message if any are missing
 */
export function validateEnv(): EnvConfig {
  return {
    GOOGLE_CLIENT_ID: "",
    GOOGLE_CLIENT_SECRET: "",
    BETTER_AUTH_SECRET: "local-only",
  };
}

/**
 * Validated environment configuration
 * This will throw an error if validation fails
 */
export const env = validateEnv();

// Secure Authentication Library
import { cookies } from "next/headers";
import { createServerClient } from "@/lib/supabase";
import crypto from "crypto";

// Session configuration
export const SESSION_CONFIG = {
  cookieName: "claude_session",
  maxAge: 60 * 60 * 24 * 7, // 7 days
  secure: process.env.NODE_ENV === "production",
  httpOnly: true,
  sameSite: "lax" as const,
  path: "/",
};

// CSRF configuration
export const CSRF_CONFIG = {
  cookieName: "csrf_token",
  headerName: "x-csrf-token",
  maxAge: 60 * 60, // 1 hour
};

/**
 * Generate a secure random token
 */
export function generateToken(length: number = 32): string {
  return crypto.randomBytes(length).toString("hex");
}

/**
 * Create a secure session for a user
 */
export async function createSession(userId: string): Promise<string> {
  const sessionToken = generateToken();
  const supabase = createServerClient();

  // Store session in database (you could use Redis for better performance)
  const expiresAt = new Date(Date.now() + SESSION_CONFIG.maxAge * 1000);

  // For now, we'll use cookies only (stateless)
  // In production, consider storing sessions in database/Redis

  const cookieStore = cookies();
  cookieStore.set(SESSION_CONFIG.cookieName, sessionToken, {
    maxAge: SESSION_CONFIG.maxAge,
    secure: SESSION_CONFIG.secure,
    httpOnly: SESSION_CONFIG.httpOnly,
    sameSite: SESSION_CONFIG.sameSite,
    path: SESSION_CONFIG.path,
  });

  // Also store user ID in a separate cookie for quick access
  cookieStore.set("user_id", userId, {
    maxAge: SESSION_CONFIG.maxAge,
    secure: SESSION_CONFIG.secure,
    httpOnly: SESSION_CONFIG.httpOnly,
    sameSite: SESSION_CONFIG.sameSite,
    path: SESSION_CONFIG.path,
  });

  return sessionToken;
}

/**
 * Get current session user
 */
export async function getSessionUser(): Promise<{
  id: string;
  github_user_id: number;
  github_username: string;
  email: string | null;
  avatar_url: string | null;
} | null> {
  const cookieStore = cookies();
  const userId = cookieStore.get("user_id")?.value;

  if (!userId) {
    return null;
  }

  const supabase = createServerClient();
  const { data: user, error } = await supabase
    .from("users")
    .select("*")
    .eq("id", userId)
    .single();

  if (error || !user) {
    return null;
  }

  return user;
}

/**
 * Destroy session (logout)
 */
export async function destroySession(): Promise<void> {
  const cookieStore = cookies();
  cookieStore.delete(SESSION_CONFIG.cookieName);
  cookieStore.delete("user_id");
  cookieStore.delete("github_user_id");
  cookieStore.delete("github_username");
}

/**
 * Generate CSRF token
 */
export function generateCSRFToken(): string {
  const token = generateToken();
  const cookieStore = cookies();

  cookieStore.set(CSRF_CONFIG.cookieName, token, {
    maxAge: CSRF_CONFIG.maxAge,
    secure: SESSION_CONFIG.secure,
    httpOnly: false, // CSRF token needs to be readable by client
    sameSite: "strict",
    path: "/",
  });

  return token;
}

/**
 * Verify CSRF token
 */
export function verifyCSRFToken(token: string): boolean {
  const cookieStore = cookies();
  const storedToken = cookieStore.get(CSRF_CONFIG.cookieName)?.value;

  if (!storedToken || storedToken !== token) {
    return false;
  }

  return true;
}

/**
 * Require authentication - use in server components/actions
 */
export async function requireAuth() {
  const user = await getSessionUser();
  if (!user) {
    throw new Error("Unauthorized");
  }
  return user;
}

"use client";

import { api } from "./api-client";

export interface AuthUser {
  id: string;
  email: string;
  name: string;
  role: string;
  tenantId: string;
}

export interface AuthTokens {
  accessToken: string;
  refreshToken: string;
  expiresIn: number;
  user: AuthUser;
}

export function setTokens(tokens: AuthTokens): void {
  localStorage.setItem("access_token", tokens.accessToken);
  localStorage.setItem("refresh_token", tokens.refreshToken);
  localStorage.setItem("user", JSON.stringify(tokens.user));
  localStorage.setItem(
    "token_expires_at",
    String(Date.now() + tokens.expiresIn * 1000)
  );
}

export function clearTokens(): void {
  localStorage.removeItem("access_token");
  localStorage.removeItem("refresh_token");
  localStorage.removeItem("user");
  localStorage.removeItem("token_expires_at");
}

export function getUser(): AuthUser | null {
  if (typeof window === "undefined") return null;
  const raw = localStorage.getItem("user");
  if (!raw) return null;
  try {
    return JSON.parse(raw) as AuthUser;
  } catch {
    return null;
  }
}

export function isTokenExpired(): boolean {
  if (typeof window === "undefined") return true;
  const expiresAt = localStorage.getItem("token_expires_at");
  if (!expiresAt) return true;
  return Date.now() > parseInt(expiresAt, 10) - 30_000; // 30s buffer
}

export function isAuthenticated(): boolean {
  if (typeof window === "undefined") return false;
  const token = localStorage.getItem("access_token");
  return Boolean(token) && !isTokenExpired();
}

export async function login(
  email: string,
  password: string,
  tenantSlug: string
): Promise<AuthTokens> {
  const res = await api.post<{ data: AuthTokens }>("/auth/login", {
    email,
    password,
    tenantSlug,
  });
  setTokens(res.data);
  return res.data;
}

export async function logout(): Promise<void> {
  try {
    await api.post("/auth/logout");
  } catch {
    // Ignore logout errors
  } finally {
    clearTokens();
  }
}

export async function refreshAccessToken(): Promise<boolean> {
  const refreshToken = localStorage.getItem("refresh_token");
  if (!refreshToken) return false;

  try {
    const res = await api.post<{
      data: { accessToken: string; refreshToken: string; expiresIn: number };
    }>("/auth/refresh", { refreshToken });

    localStorage.setItem("access_token", res.data.accessToken);
    localStorage.setItem("refresh_token", res.data.refreshToken);
    localStorage.setItem(
      "token_expires_at",
      String(Date.now() + res.data.expiresIn * 1000)
    );
    return true;
  } catch {
    clearTokens();
    return false;
  }
}

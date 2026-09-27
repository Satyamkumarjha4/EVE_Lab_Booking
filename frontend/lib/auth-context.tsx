"use client";

import { createContext, useContext, useEffect, useState, type ReactNode } from "react";

import * as api from "./api";
import { invalidateCatalog } from "./catalog";
import type { Me } from "./types";

type AuthStatus = "restoring" | "authenticated" | "anonymous";

interface AuthContextValue {
  user: Me | null;
  status: AuthStatus;
  login: (email: string, password: string) => Promise<Me>;
  signup: (email: string, password: string) => Promise<Me>;
  logout: () => void;
}

const AuthContext = createContext<AuthContextValue | null>(null);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<Me | null>(null);
  const [status, setStatus] = useState<AuthStatus>("restoring");

  useEffect(() => {
    api.setAuthFailureHandler(() => {
      setUser(null);
      setStatus("anonymous");
    });

    let active = true;
    api
      .restoreSession()
      .then((restored) => (restored ? api.me() : null))
      .then((currentUser) => {
        if (!active) return;
        setUser(currentUser);
        setStatus(currentUser ? "authenticated" : "anonymous");
      })
      .catch(() => active && setStatus("anonymous"));

    return () => {
      active = false;
      api.setAuthFailureHandler(null);
    };
  }, []);

  async function authenticate(tokens: api.Tokens) {
    api.setTokens(tokens);
    const currentUser = await api.me();
    // Catalog visibility is role-scoped (a centre login only sees its own centre).
    invalidateCatalog();
    setUser(currentUser);
    setStatus("authenticated");
    return currentUser;
  }

  async function login(email: string, password: string) {
    return authenticate(await api.login(email, password));
  }

  async function signup(email: string, password: string) {
    await api.signup(email, password);
    return authenticate(await api.login(email, password));
  }

  function logout() {
    api.setTokens(null);
    invalidateCatalog();
    setUser(null);
    setStatus("anonymous");
  }

  return (
    <AuthContext.Provider value={{ user, status, login, signup, logout }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error("useAuth must be used within an AuthProvider");
  return ctx;
}

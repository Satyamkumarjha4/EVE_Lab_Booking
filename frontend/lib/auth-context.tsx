"use client";

import { createContext, useContext, useEffect, useState, type ReactNode } from "react";

import * as api from "./api";
import type { Me } from "./types";

interface AuthContextValue {
  user: Me | null;
  loading: boolean;
  login: (email: string, password: string) => Promise<void>;
  signup: (email: string, password: string) => Promise<void>;
  logout: () => void;
}

const AuthContext = createContext<AuthContextValue | null>(null);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<Me | null>(null);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    api.setAuthFailureHandler(() => setUser(null));
    return () => api.setAuthFailureHandler(null);
  }, []);

  async function authenticate(tokens: api.Tokens) {
    api.setTokens(tokens);
    const currentUser = await api.me();
    setUser(currentUser);
  }

  async function login(email: string, password: string) {
    setLoading(true);
    try {
      const tokens = await api.login(email, password);
      await authenticate(tokens);
    } finally {
      setLoading(false);
    }
  }

  async function signup(email: string, password: string) {
    setLoading(true);
    try {
      await api.signup(email, password);
      const tokens = await api.login(email, password);
      await authenticate(tokens);
    } finally {
      setLoading(false);
    }
  }

  function logout() {
    api.setTokens(null);
    setUser(null);
  }

  return (
    <AuthContext.Provider value={{ user, loading, login, signup, logout }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error("useAuth must be used within an AuthProvider");
  return ctx;
}

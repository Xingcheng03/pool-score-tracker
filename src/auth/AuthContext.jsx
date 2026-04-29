import React, { useEffect, useMemo, useState } from "react";
import { apiRequest, clearToken, getToken, jsonBody, setToken } from "../lib/api.js";
import { invalidateApiCache } from "../lib/apiCache.js";
import { AuthContext } from "./useAuth.js";

export function AuthProvider({ children }) {
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(Boolean(getToken()));

  useEffect(() => {
    let alive = true;

    async function loadMe() {
      if (!getToken()) {
        setLoading(false);
        return;
      }

      try {
        const result = await apiRequest("/auth/me");
        if (alive) setUser(result.user);
      } catch {
        clearToken();
        if (alive) setUser(null);
      } finally {
        if (alive) setLoading(false);
      }
    }

    loadMe();
    return () => {
      alive = false;
    };
  }, []);

  async function login(username, password) {
    const result = await apiRequest("/auth/login", {
      method: "POST",
      body: jsonBody({ username, password }),
    });
    setToken(result.token);
    invalidateApiCache();
    setUser(result.user);
    return result.user;
  }

  async function updateMe(payload) {
    const result = await apiRequest("/auth/me", {
      method: "PATCH",
      body: jsonBody(payload),
    });
    invalidateApiCache(["/players"]);
    setUser(result.user);
    return result.user;
  }

  function logout() {
    clearToken();
    invalidateApiCache();
    setUser(null);
  }

  const value = useMemo(
    () => ({
      user,
      loading,
      isAuthenticated: Boolean(user),
      isAdmin: user?.role === "ADMIN",
      login,
      updateMe,
      logout,
    }),
    [user, loading],
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

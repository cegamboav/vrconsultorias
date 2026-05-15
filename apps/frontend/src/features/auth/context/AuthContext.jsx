import { createContext, useEffect, useMemo, useState } from "react";
import { apiFetch } from "../../../lib/apiClient";
import { clearToken, getToken, setToken } from "../../../lib/tokenStorage";

export const AuthContext = createContext(null);

export function AuthProvider({ children }) {
  const [token, setTokenState] = useState(() => getToken());
  const [user, setUser] = useState(null);
  const [isLoading, setIsLoading] = useState(Boolean(getToken()));

  useEffect(() => {
    async function restoreSession() {
      if (!token) {
        setIsLoading(false);
        return;
      }

      try {
        const data = await apiFetch("/auth/me");
        setUser(data.user);
      } catch (_error) {
        clearToken();
        setTokenState(null);
        setUser(null);
      } finally {
        setIsLoading(false);
      }
    }

    restoreSession();
  }, [token]);

  async function login(email, password) {
    const data = await apiFetch("/auth/login", {
      method: "POST",
      body: JSON.stringify({ email, password })
    });

    setToken(data.token);
    setTokenState(data.token);
    setUser(data.user);
  }

  function logout() {
    clearToken();
    setTokenState(null);
    setUser(null);
  }

  async function refreshUser() {
    if (!token) return null;
    const data = await apiFetch("/auth/me");
    setUser(data.user);
    return data.user;
  }

  const value = useMemo(
    () => ({
      token,
      user,
      isLoading,
      isAuthenticated: Boolean(token && user),
      isAdmin: user?.role === "ADMIN",
      login,
      logout,
      refreshUser
    }),
    [token, user, isLoading]
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

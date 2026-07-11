"use client";

import { createContext, useContext, useState, useEffect } from "react";
import { useRouter, usePathname } from "next/navigation";

const AuthContext = createContext(null);

export function AuthProvider({ children }) {
  const [user, setUser] = useState(null);
  const [token, setToken] = useState(null);
  const [loading, setLoading] = useState(true);
  const router = useRouter();
  const pathname = usePathname();

  useEffect(() => {
    // Read from session / local storage
    let storedToken = null;
    let storedUser = null;
    try {
      storedToken = sessionStorage.getItem("token") || localStorage.getItem("token") || null;
      const rawUser = sessionStorage.getItem("currentUser") || localStorage.getItem("currentUser") || null;
      if (rawUser) storedUser = JSON.parse(rawUser);
    } catch {}

    if (storedToken && storedUser) {
      setToken(storedToken);
      setUser(storedUser);

      // Verify token is active
      fetch("/api/session/check", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ token: storedToken }),
      })
        .then((r) => r.json())
        .then((data) => {
          if (data && data.active === false) {
            // Token expired or superseded
            logoutAction(data.suspended);
          }
        })
        .catch(() => {})
        .finally(() => {
          setLoading(false);
        });
    } else {
      setLoading(false);
    }
  }, []);

  const login = (newToken, newUser, rememberMe = true) => {
    setToken(newToken);
    setUser(newUser);
    try {
      const storage = rememberMe ? localStorage : sessionStorage;
      storage.setItem("token", newToken);
      storage.setItem("currentUser", JSON.stringify(newUser));
      // Remove temporary flags
      localStorage.removeItem("_ss_loggingOut");
      sessionStorage.removeItem("_ss_loggingOut");
    } catch {}

    // Check if profile setup is required
    if (!newUser.termsAccepted) {
      router.push("/accept-terms");
    } else if (newUser.role === "Founder" && !newUser.profileComplete) {
      // we check dynamically or let pages handle redirect
      router.push("/welcome");
    } else {
      router.push(newUser.role === "Founder" ? "/founder-dashboard" : "/investor-dashboard");
    }
  };

  const logoutAction = (suspended = false) => {
    try {
      localStorage.setItem("_ss_loggingOut", "1");
      sessionStorage.setItem("_ss_loggingOut", "1");
    } catch {}

    // Hit logout endpoint
    if (token) {
      fetch("/api/auth/logout", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "Authorization": `Bearer ${token}`,
        },
        body: JSON.stringify({ token }),
      }).catch(() => {});
    }

    setToken(null);
    setUser(null);

    try {
      localStorage.removeItem("token");
      localStorage.removeItem("currentUser");
      sessionStorage.removeItem("token");
      sessionStorage.removeItem("currentUser");
    } catch {}

    if (suspended) {
      router.push("/suspended");
    } else {
      router.push("/");
    }
  };

  const logout = () => {
    logoutAction(false);
  };

  const updateUser = (updatedUser) => {
    setUser((prev) => {
      const nextUser = { ...prev, ...updatedUser };
      try {
        if (localStorage.getItem("token")) {
          localStorage.setItem("currentUser", JSON.stringify(nextUser));
        } else {
          sessionStorage.setItem("currentUser", JSON.stringify(nextUser));
        }
      } catch {}
      return nextUser;
    });
  };

  // Auth routing guards
  useEffect(() => {
    if (loading) return;

    const publicRoutes = ["/", "/reset-password", "/suspended", "/features", "/how-it-works", "/for-you"];
    const isPublic = publicRoutes.includes(pathname) || pathname.startsWith("/api");

    if (!token && !isPublic) {
      router.push("/");
    } else if (token && pathname === "/") {
      if (user?.role === "Founder") {
        router.push("/founder-dashboard");
      } else if (user?.role === "Investor") {
        router.push("/investor-dashboard");
      }
    }
  }, [pathname, token, loading]);

  return (
    <AuthContext.Provider value={{ user, token, loading, login, logout, updateUser }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error("useAuth must be used within an AuthProvider");
  }
  return context;
}

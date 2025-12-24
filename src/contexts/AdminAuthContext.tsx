import React, { createContext, useContext, useState, useEffect, useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';

interface Admin {
  id: string;
  email: string;
  role: string;
}

interface AdminAuthContextType {
  admin: Admin | null;
  isLoading: boolean;
  isAuthenticated: boolean;
  login: (email: string, password: string) => Promise<{ error?: string; attempts_remaining?: number }>;
  logout: (revokeAll?: boolean) => Promise<void>;
  refreshToken: () => Promise<boolean>;
}

const AdminAuthContext = createContext<AdminAuthContextType | undefined>(undefined);

const ACCESS_TOKEN_KEY = 'admin_access_token';
const REFRESH_TOKEN_KEY = 'admin_refresh_token';
const ADMIN_KEY = 'admin_user';

export function AdminAuthProvider({ children }: { children: React.ReactNode }) {
  const [admin, setAdmin] = useState<Admin | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [accessToken, setAccessToken] = useState<string | null>(null);

  // Initialize from localStorage
  useEffect(() => {
    const storedToken = localStorage.getItem(ACCESS_TOKEN_KEY);
    const storedAdmin = localStorage.getItem(ADMIN_KEY);
    
    if (storedToken && storedAdmin) {
      setAccessToken(storedToken);
      setAdmin(JSON.parse(storedAdmin));
    }
    setIsLoading(false);
  }, []);

  // Verify token on mount and periodically
  const verifyToken = useCallback(async () => {
    const token = localStorage.getItem(ACCESS_TOKEN_KEY);
    if (!token) return false;

    try {
      const { data, error } = await supabase.functions.invoke('admin-auth/verify', {
        headers: { Authorization: `Bearer ${token}` }
      });

      if (error || !data?.valid) {
        // Try to refresh
        return await refreshToken();
      }

      setAdmin(data.admin);
      localStorage.setItem(ADMIN_KEY, JSON.stringify(data.admin));
      return true;
    } catch {
      return await refreshToken();
    }
  }, []);

  const refreshToken = useCallback(async (): Promise<boolean> => {
    const refresh = localStorage.getItem(REFRESH_TOKEN_KEY);
    if (!refresh) {
      clearAuth();
      return false;
    }

    try {
      const { data, error } = await supabase.functions.invoke('admin-auth/refresh', {
        body: { refresh_token: refresh }
      });

      if (error || !data?.access_token) {
        clearAuth();
        return false;
      }

      setAccessToken(data.access_token);
      setAdmin(data.admin);
      localStorage.setItem(ACCESS_TOKEN_KEY, data.access_token);
      localStorage.setItem(ADMIN_KEY, JSON.stringify(data.admin));
      return true;
    } catch {
      clearAuth();
      return false;
    }
  }, []);

  // Auto-refresh token before expiry (every 12 minutes)
  useEffect(() => {
    if (!accessToken) return;

    const interval = setInterval(() => {
      refreshToken();
    }, 12 * 60 * 1000);

    return () => clearInterval(interval);
  }, [accessToken, refreshToken]);

  // Verify on mount
  useEffect(() => {
    if (accessToken) {
      verifyToken();
    }
  }, []);

  const clearAuth = () => {
    setAccessToken(null);
    setAdmin(null);
    localStorage.removeItem(ACCESS_TOKEN_KEY);
    localStorage.removeItem(REFRESH_TOKEN_KEY);
    localStorage.removeItem(ADMIN_KEY);
  };

  const login = async (email: string, password: string) => {
    try {
      const { data, error } = await supabase.functions.invoke('admin-auth/login', {
        body: { email, password }
      });

      if (error) {
        console.error('Login error:', error);
        return { error: 'Login failed. Please try again.' };
      }

      if (data.error) {
        return { 
          error: data.error, 
          attempts_remaining: data.attempts_remaining 
        };
      }

      setAccessToken(data.access_token);
      setAdmin(data.admin);
      localStorage.setItem(ACCESS_TOKEN_KEY, data.access_token);
      localStorage.setItem(REFRESH_TOKEN_KEY, data.refresh_token);
      localStorage.setItem(ADMIN_KEY, JSON.stringify(data.admin));

      return {};
    } catch (err) {
      console.error('Login exception:', err);
      return { error: 'An unexpected error occurred' };
    }
  };

  const logout = async (revokeAll = false) => {
    const token = localStorage.getItem(ACCESS_TOKEN_KEY);
    const refresh = localStorage.getItem(REFRESH_TOKEN_KEY);

    if (token) {
      try {
        await supabase.functions.invoke('admin-auth/logout', {
          headers: { Authorization: `Bearer ${token}` },
          body: { refresh_token: refresh, revoke_all: revokeAll }
        });
      } catch (err) {
        console.error('Logout error:', err);
      }
    }

    clearAuth();
  };

  const value: AdminAuthContextType = {
    admin,
    isLoading,
    isAuthenticated: !!admin && !!accessToken,
    login,
    logout,
    refreshToken
  };

  return (
    <AdminAuthContext.Provider value={value}>
      {children}
    </AdminAuthContext.Provider>
  );
}

export function useAdminAuth() {
  const context = useContext(AdminAuthContext);
  if (context === undefined) {
    throw new Error('useAdminAuth must be used within an AdminAuthProvider');
  }
  return context;
}

// Hook to get access token for API calls
export function useAdminToken(): string | null {
  return localStorage.getItem(ACCESS_TOKEN_KEY);
}

import { useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAdminAuth } from '@/contexts/AdminAuthContext';

const ACCESS_TOKEN_KEY = 'admin_access_token';

export function useAdminApi() {
  const { refreshToken, logout } = useAdminAuth();

  const callApi = useCallback(async <T>(
    functionName: string,
    options: {
      method?: 'GET' | 'POST' | 'PUT' | 'PATCH' | 'DELETE';
      body?: Record<string, unknown>;
      params?: Record<string, string>;
    } = {}
  ): Promise<{ data: T | null; error: string | null }> => {
    const token = localStorage.getItem(ACCESS_TOKEN_KEY);
    if (!token) {
      return { data: null, error: 'Not authenticated' };
    }

    const { method = 'GET', body, params } = options;
    
    // Build URL with query params for GET requests
    let url = functionName;
    if (params && Object.keys(params).length > 0) {
      const queryString = new URLSearchParams(params).toString();
      url = `${functionName}?${queryString}`;
    }

    try {
      const invokeOptions: {
        headers: Record<string, string>;
        method: 'GET' | 'POST' | 'PUT' | 'PATCH' | 'DELETE';
        body?: unknown;
      } = {
        method,
        headers: {
          Authorization: `Bearer ${token}`,
          'Content-Type': 'application/json',
        },
      };

      // For non-GET requests, include body
      if (method !== 'GET' && body) {
        invokeOptions.body = body;
      }

      const { data, error } = await supabase.functions.invoke(url, invokeOptions);

      if (error) {
        // If unauthorized, try to refresh
        if (error.message?.includes('401') || error.message?.includes('Unauthorized')) {
          const refreshed = await refreshToken();
          if (refreshed) {
            // Retry with new token
            const newToken = localStorage.getItem(ACCESS_TOKEN_KEY);
            invokeOptions.headers.Authorization = `Bearer ${newToken}`;
            const retryResult = await supabase.functions.invoke(url, invokeOptions);
            if (retryResult.error) {
              return { data: null, error: retryResult.error.message };
            }
            return { data: retryResult.data as T, error: null };
          } else {
            await logout();
            return { data: null, error: 'Session expired' };
          }
        }
        return { data: null, error: error.message };
      }

      if (data?.error) {
        return { data: null, error: data.error };
      }

      return { data: data as T, error: null };
    } catch (err) {
      console.error('API call error:', err);
      return { data: null, error: 'An unexpected error occurred' };
    }
  }, [refreshToken, logout]);

  // Convenience methods
  const get = useCallback(<T>(functionName: string, params?: Record<string, string>) => 
    callApi<T>(functionName, { method: 'GET', params }), [callApi]);

  const post = useCallback(<T>(functionName: string, body: Record<string, unknown>) => 
    callApi<T>(functionName, { method: 'POST', body }), [callApi]);

  const put = useCallback(<T>(functionName: string, body: Record<string, unknown>) => 
    callApi<T>(functionName, { method: 'PUT', body }), [callApi]);

  const patch = useCallback(<T>(functionName: string, body: Record<string, unknown>) => 
    callApi<T>(functionName, { method: 'PATCH', body }), [callApi]);

  const del = useCallback(<T>(functionName: string) => 
    callApi<T>(functionName, { method: 'DELETE' }), [callApi]);

  return { callApi, get, post, put, patch, del };
}

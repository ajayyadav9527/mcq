import { useState, useCallback, useEffect } from 'react';

// Maximum number of API keys allowed
const MAX_API_KEYS = 50;

// Storage key for localStorage
const STORAGE_KEY = 'gemini_api_keys';

export interface ApiKeyEntry {
  key: string;
  status: 'active' | 'inactive' | 'validating';
  addedAt: number;
  lastChecked: number;
  requestCount: number;
  lastUsed: number;
  rateLimited: boolean;
  rateLimitedAt: number;
}

export interface ValidationResult {
  key: string;
  status: 'success' | 'invalid' | 'replaced' | 'limit_reached' | 'duplicate';
  message: string;
}

interface UseApiKeyManagerReturn {
  apiKeys: ApiKeyEntry[];
  isValidating: boolean;
  validationResults: ValidationResult[];
  addBulkKeys: (keys: string[]) => Promise<ValidationResult[]>;
  removeKey: (key: string) => void;
  clearAllKeys: () => void;
  getNextAvailableKey: () => { key: string; index: number } | null;
  markKeyRateLimited: (key: string) => void;
  resetKeyUsage: () => void;
  getAvailableKeyCount: () => number;
  getKeyStatuses: () => ApiKeyStatus[];
  refreshKeyHealth: () => Promise<void>;
}

export interface ApiKeyStatus {
  index: number;
  key: string;
  status: 'idle' | 'active' | 'rate-limited' | 'recovering' | 'inactive';
  requestCount: number;
  recoveryProgress: number;
}

const RATE_LIMIT_RECOVERY_MS = 90000; // 90 seconds recovery

// Validate if a key is a Google Gemini API key format
const isGeminiKeyFormat = (key: string): boolean => {
  // Google API keys start with "AIza" and are 39 characters long
  return /^AIzaSy[A-Za-z0-9_-]{33}$/.test(key.trim());
};

// Validate key with actual API call
const validateKeyWithApi = async (key: string): Promise<{ valid: boolean; error?: string }> => {
  try {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 15000);
    
    const response = await fetch(
      `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key=${key}`,
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        signal: controller.signal,
        body: JSON.stringify({
          contents: [{ parts: [{ text: 'Say "OK" only.' }] }],
          generationConfig: { maxOutputTokens: 5 }
        })
      }
    );
    
    clearTimeout(timeoutId);
    
    if (response.ok) {
      return { valid: true };
    }
    
    const errorData = await response.json().catch(() => ({}));
    const errorMessage = errorData?.error?.message || `HTTP ${response.status}`;
    
    if (response.status === 400 || response.status === 403) {
      return { valid: false, error: 'Invalid or revoked API key' };
    }
    
    if (response.status === 429) {
      // Rate limited but key is valid
      return { valid: true };
    }
    
    return { valid: false, error: errorMessage };
  } catch (err: any) {
    if (err.name === 'AbortError') {
      return { valid: false, error: 'Request timeout' };
    }
    return { valid: false, error: err.message || 'Network error' };
  }
};

export const useApiKeyManager = (): UseApiKeyManagerReturn => {
  const [apiKeys, setApiKeys] = useState<ApiKeyEntry[]>(() => {
    try {
      const stored = localStorage.getItem(STORAGE_KEY);
      if (stored) {
        const parsed = JSON.parse(stored) as ApiKeyEntry[];
        return parsed.map(k => ({ ...k, rateLimited: false, rateLimitedAt: 0 }));
      }
    } catch (e) {
      console.error('Failed to load API keys from storage:', e);
    }
    return [];
  });
  
  const [isValidating, setIsValidating] = useState(false);
  const [validationResults, setValidationResults] = useState<ValidationResult[]>([]);
  
  // Save to localStorage when keys change
  useEffect(() => {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(apiKeys));
    } catch (e) {
      console.error('Failed to save API keys to storage:', e);
    }
  }, [apiKeys]);
  
  // Add bulk keys with validation
  const addBulkKeys = useCallback(async (inputKeys: string[]): Promise<ValidationResult[]> => {
    setIsValidating(true);
    setValidationResults([]);
    const results: ValidationResult[] = [];
    
    // Clean and deduplicate input keys
    const cleanedKeys = inputKeys
      .map(k => k.trim())
      .filter(k => k.length > 0);
    
    for (const key of cleanedKeys) {
      // Step 1: Check if it's already in our list (duplicate check)
      const isDuplicate = apiKeys.some(existing => existing.key === key);
      if (isDuplicate) {
        results.push({
          key,
          status: 'duplicate',
          message: 'API key already exists in your list.'
        });
        continue;
      }
      
      // Step 2: Validate it's a Google Gemini key format
      if (!isGeminiKeyFormat(key)) {
        results.push({
          key,
          status: 'invalid',
          message: 'Invalid API key: This is not a Google Gemini API key.'
        });
        // Stop processing further keys when invalid key detected
        break;
      }
      
      // Step 3: Health check with actual API call
      const validation = await validateKeyWithApi(key);
      
      if (!validation.valid) {
        results.push({
          key,
          status: 'invalid',
          message: `API key health check failed: ${validation.error}`
        });
        continue;
      }
      
      // Step 4: Check for inactive keys to replace
      const inactiveKeyIndex = apiKeys.findIndex(k => k.status === 'inactive');
      
      if (inactiveKeyIndex !== -1) {
        // Replace inactive key
        setApiKeys(prev => {
          const updated = [...prev];
          updated[inactiveKeyIndex] = {
            key,
            status: 'active',
            addedAt: Date.now(),
            lastChecked: Date.now(),
            requestCount: 0,
            lastUsed: 0,
            rateLimited: false,
            rateLimitedAt: 0
          };
          return updated;
        });
        
        results.push({
          key,
          status: 'replaced',
          message: 'API key replaced an inactive key.'
        });
        continue;
      }
      
      // Step 5: Check quota limit
      if (apiKeys.length >= MAX_API_KEYS) {
        results.push({
          key,
          status: 'limit_reached',
          message: 'API key limit reached. No additional keys can be added.'
        });
        // Stop processing when limit reached
        break;
      }
      
      // Step 6: Add as new key
      const newEntry: ApiKeyEntry = {
        key,
        status: 'active',
        addedAt: Date.now(),
        lastChecked: Date.now(),
        requestCount: 0,
        lastUsed: 0,
        rateLimited: false,
        rateLimitedAt: 0
      };
      
      setApiKeys(prev => [...prev, newEntry]);
      
      results.push({
        key,
        status: 'success',
        message: 'API key added successfully.'
      });
    }
    
    setValidationResults(results);
    setIsValidating(false);
    return results;
  }, [apiKeys]);
  
  // Remove a specific key
  const removeKey = useCallback((key: string) => {
    setApiKeys(prev => prev.filter(k => k.key !== key));
  }, []);
  
  // Clear all keys
  const clearAllKeys = useCallback(() => {
    setApiKeys([]);
    setValidationResults([]);
  }, []);
  
  // Get next available key for API calls
  const getNextAvailableKey = useCallback((): { key: string; index: number } | null => {
    const now = Date.now();
    let bestKey: { index: number; score: number } | null = null;
    
    for (let i = 0; i < apiKeys.length; i++) {
      const entry = apiKeys[i];
      
      if (entry.status !== 'active') continue;
      
      // Check if rate limited key has recovered
      if (entry.rateLimited) {
        if (now - entry.rateLimitedAt > RATE_LIMIT_RECOVERY_MS) {
          // Key has recovered
          setApiKeys(prev => {
            const updated = [...prev];
            updated[i] = { ...updated[i], rateLimited: false, rateLimitedAt: 0 };
            return updated;
          });
        } else {
          continue;
        }
      }
      
      // Calculate score (lower is better)
      const timeSinceLastUse = now - entry.lastUsed;
      const score = entry.requestCount * 1000 - timeSinceLastUse;
      
      if (!bestKey || score < bestKey.score) {
        bestKey = { index: i, score };
      }
    }
    
    if (bestKey) {
      const keyEntry = apiKeys[bestKey.index];
      
      // Update usage stats
      setApiKeys(prev => {
        const updated = [...prev];
        updated[bestKey!.index] = {
          ...updated[bestKey!.index],
          requestCount: updated[bestKey!.index].requestCount + 1,
          lastUsed: now
        };
        return updated;
      });
      
      return { key: keyEntry.key, index: bestKey.index };
    }
    
    return null;
  }, [apiKeys]);
  
  // Mark a key as rate limited
  const markKeyRateLimited = useCallback((key: string) => {
    setApiKeys(prev => prev.map(entry => 
      entry.key === key
        ? { ...entry, rateLimited: true, rateLimitedAt: Date.now() }
        : entry
    ));
  }, []);
  
  // Reset all key usage stats
  const resetKeyUsage = useCallback(() => {
    setApiKeys(prev => prev.map(entry => ({
      ...entry,
      requestCount: 0,
      lastUsed: 0,
      rateLimited: false,
      rateLimitedAt: 0
    })));
  }, []);
  
  // Get count of available keys
  const getAvailableKeyCount = useCallback((): number => {
    const now = Date.now();
    return apiKeys.filter(entry => {
      if (entry.status !== 'active') return false;
      if (entry.rateLimited && (now - entry.rateLimitedAt < RATE_LIMIT_RECOVERY_MS)) return false;
      return true;
    }).length;
  }, [apiKeys]);
  
  // Get key statuses for UI
  const getKeyStatuses = useCallback((): ApiKeyStatus[] => {
    const now = Date.now();
    
    return apiKeys.map((entry, i) => {
      let status: ApiKeyStatus['status'] = 'idle';
      let recoveryProgress = 100;
      
      if (entry.status === 'inactive') {
        status = 'inactive';
      } else if (entry.rateLimited) {
        const elapsed = now - entry.rateLimitedAt;
        if (elapsed < RATE_LIMIT_RECOVERY_MS) {
          status = 'recovering';
          recoveryProgress = Math.min(100, Math.round((elapsed / RATE_LIMIT_RECOVERY_MS) * 100));
        } else {
          status = 'idle';
        }
      } else if (entry.requestCount > 0 && now - entry.lastUsed < 5000) {
        status = 'active';
      }
      
      return {
        index: i,
        key: entry.key,
        status,
        requestCount: entry.requestCount,
        recoveryProgress
      };
    });
  }, [apiKeys]);
  
  // Refresh health of all keys
  const refreshKeyHealth = useCallback(async () => {
    setIsValidating(true);
    
    const updatedKeys = await Promise.all(
      apiKeys.map(async (entry) => {
        if (entry.status === 'inactive') return entry;
        
        const validation = await validateKeyWithApi(entry.key);
        
        return {
          ...entry,
          status: validation.valid ? 'active' : 'inactive',
          lastChecked: Date.now()
        } as ApiKeyEntry;
      })
    );
    
    setApiKeys(updatedKeys);
    setIsValidating(false);
  }, [apiKeys]);
  
  return {
    apiKeys,
    isValidating,
    validationResults,
    addBulkKeys,
    removeKey,
    clearAllKeys,
    getNextAvailableKey,
    markKeyRateLimited,
    resetKeyUsage,
    getAvailableKeyCount,
    getKeyStatuses,
    refreshKeyHealth
  };
};

export default useApiKeyManager;

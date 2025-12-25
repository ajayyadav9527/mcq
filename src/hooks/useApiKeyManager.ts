import { useState, useCallback, useEffect, useRef } from 'react';

// Maximum number of API keys allowed
const MAX_API_KEYS = 50;

// Storage key for localStorage
const STORAGE_KEY = 'gemini_api_keys';

// Minimum time between uses of the same key (in ms) - gives each key proper rest time
const MIN_KEY_COOLDOWN_MS = 3000; // 3 seconds minimum between same key uses

// Rate limit recovery time
const RATE_LIMIT_RECOVERY_MS = 90000; // 90 seconds recovery

// No default API keys - users must provide their own for security
// Hardcoding API keys in client-side code exposes them to extraction and abuse

export interface ApiKeyEntry {
  key: string;
  status: 'active' | 'inactive' | 'validating';
  addedAt: number;
  lastChecked: number;
  requestCount: number;
  lastUsed: number;
  rateLimited: boolean;
  rateLimitedAt: number;
  order: number; // For round-robin rotation
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

// Note: RATE_LIMIT_RECOVERY_MS and MIN_KEY_COOLDOWN_MS defined at top of file

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

// Track last used key index for round-robin rotation
let lastUsedKeyIndex = -1;

export const useApiKeyManager = (): UseApiKeyManagerReturn => {
  const [apiKeys, setApiKeys] = useState<ApiKeyEntry[]>(() => {
    try {
      const stored = localStorage.getItem(STORAGE_KEY);
      if (stored) {
        const parsed = JSON.parse(stored) as ApiKeyEntry[];
        if (parsed.length > 0) {
          // Ensure all stored keys have the order property
          return parsed.map((k, i) => ({ 
            ...k, 
            rateLimited: false, 
            rateLimitedAt: 0,
            order: k.order ?? i 
          }));
        }
      }
    } catch (e) {
      console.error('Failed to load API keys from storage:', e);
    }
    // Return empty array - backend keys will be fetched
    return [];
  });
  
  const [isValidating, setIsValidating] = useState(false);
  const [validationResults, setValidationResults] = useState<ValidationResult[]>([]);
  const backendKeysFetchedRef = useRef(false);
  
  // Fetch backend API keys on mount if no user keys exist
  useEffect(() => {
    const fetchBackendKeys = async () => {
      // Only fetch once and only if no stored keys
      if (backendKeysFetchedRef.current) return;
      backendKeysFetchedRef.current = true;
      
      // Check if we already have keys from localStorage
      const stored = localStorage.getItem(STORAGE_KEY);
      if (stored) {
        try {
          const parsed = JSON.parse(stored);
          if (Array.isArray(parsed) && parsed.length > 0) {
            console.log('Using stored API keys');
            return;
          }
        } catch (e) {}
      }
      
      try {
        const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
        if (!supabaseUrl) {
          console.log('No Supabase URL configured');
          return;
        }
        
        const response = await fetch(`${supabaseUrl}/functions/v1/gemini-keys`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' }
        });
        
        if (response.ok) {
          const data = await response.json();
          if (data.keys && Array.isArray(data.keys) && data.keys.length > 0) {
            console.log(`Loaded ${data.keys.length} backend Gemini API keys`);
            const backendKeys: ApiKeyEntry[] = data.keys.map((key: string, index: number) => ({
              key,
              status: 'active' as const,
              addedAt: Date.now(),
              lastChecked: Date.now(),
              requestCount: 0,
              lastUsed: 0,
              rateLimited: false,
              rateLimitedAt: 0,
              order: index
            }));
            setApiKeys(backendKeys);
          }
        } else {
          console.log('Failed to fetch backend keys:', response.status);
        }
      } catch (err) {
        console.error('Error fetching backend Gemini keys:', err);
      }
    };
    
    fetchBackendKeys();
  }, []);
  
  // Save to localStorage when keys change
  useEffect(() => {
    if (apiKeys.length > 0) {
      try {
        localStorage.setItem(STORAGE_KEY, JSON.stringify(apiKeys));
      } catch (e) {
        console.error('Failed to save API keys to storage:', e);
      }
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
            rateLimitedAt: 0,
            order: inactiveKeyIndex
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
      setApiKeys(prev => {
        const newEntry: ApiKeyEntry = {
          key,
          status: 'active',
          addedAt: Date.now(),
          lastChecked: Date.now(),
          requestCount: 0,
          lastUsed: 0,
          rateLimited: false,
          rateLimitedAt: 0,
          order: prev.length
        };
        return [...prev, newEntry];
      });
      
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
  
  // Get next available key for API calls using STRICT ROUND-ROBIN rotation
  // This ensures each key gets proper rest time between uses
  const getNextAvailableKey = useCallback((): { key: string; index: number } | null => {
    const now = Date.now();
    const activeKeys: { index: number; entry: ApiKeyEntry }[] = [];
    
    // First pass: collect all available keys and recover rate-limited ones
    for (let i = 0; i < apiKeys.length; i++) {
      const entry = apiKeys[i];
      
      if (entry.status !== 'active') continue;
      
      // Check if rate limited key has recovered
      if (entry.rateLimited) {
        if (now - entry.rateLimitedAt > RATE_LIMIT_RECOVERY_MS) {
          // Key has recovered - update it
          setApiKeys(prev => {
            const updated = [...prev];
            updated[i] = { ...updated[i], rateLimited: false, rateLimitedAt: 0 };
            return updated;
          });
          activeKeys.push({ index: i, entry: { ...entry, rateLimited: false } });
        }
        // Skip rate-limited keys that haven't recovered
        continue;
      }
      
      activeKeys.push({ index: i, entry });
    }
    
    if (activeKeys.length === 0) {
      console.log('No available API keys');
      return null;
    }
    
    // STRICT ROUND-ROBIN: Find next key in sequence that has had enough cooldown
    // Sort by order to maintain consistent rotation
    activeKeys.sort((a, b) => a.entry.order - b.entry.order);
    
    // Find the next key after lastUsedKeyIndex
    let selectedKey: { index: number; entry: ApiKeyEntry } | null = null;
    
    for (let attempt = 0; attempt < activeKeys.length; attempt++) {
      // Calculate which key to try next in round-robin order
      const candidateOrder = (lastUsedKeyIndex + 1 + attempt) % apiKeys.length;
      const candidate = activeKeys.find(k => k.entry.order === candidateOrder) 
        || activeKeys.find(k => k.entry.order > candidateOrder)
        || activeKeys[0];
      
      if (!candidate) continue;
      
      // Check if this key has had enough cooldown time
      const timeSinceLastUse = now - candidate.entry.lastUsed;
      
      if (timeSinceLastUse >= MIN_KEY_COOLDOWN_MS || candidate.entry.lastUsed === 0) {
        selectedKey = candidate;
        break;
      }
      
      // If this is the only key or we've tried all, use it anyway
      if (activeKeys.length === 1 || attempt === activeKeys.length - 1) {
        selectedKey = candidate;
        break;
      }
    }
    
    // Fallback: use the key with longest time since last use
    if (!selectedKey) {
      selectedKey = activeKeys.reduce((best, current) => 
        (current.entry.lastUsed < best.entry.lastUsed) ? current : best
      );
    }
    
    if (selectedKey) {
      // Update the last used key index
      lastUsedKeyIndex = selectedKey.entry.order;
      
      // Update usage stats
      setApiKeys(prev => {
        const updated = [...prev];
        updated[selectedKey!.index] = {
          ...updated[selectedKey!.index],
          requestCount: updated[selectedKey!.index].requestCount + 1,
          lastUsed: now
        };
        return updated;
      });
      
      console.log(`Using API key ${selectedKey.index + 1}/${apiKeys.length} (order: ${selectedKey.entry.order})`);
      return { key: selectedKey.entry.key, index: selectedKey.index };
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
  
  // Reset all key usage stats and round-robin counter
  const resetKeyUsage = useCallback(() => {
    lastUsedKeyIndex = -1; // Reset round-robin counter
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

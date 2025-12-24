import { useState, useEffect, useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';

interface DonationSettings {
  enabled: boolean;
  upiId: string | null;
  qrUrl: string | null;
}

export function useDonationSettings() {
  const [settings, setSettings] = useState<DonationSettings | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchSettings = useCallback(async () => {
    try {
      setLoading(true);
      setError(null);

      const { data, error: fnError } = await supabase.functions.invoke('donation-settings', {
        method: 'GET',
      });

      if (fnError) {
        console.error('Error fetching donation settings:', fnError);
        setError(fnError.message);
        setSettings({ enabled: false, upiId: null, qrUrl: null });
        return;
      }

      setSettings(data);
    } catch (err: any) {
      console.error('Error:', err);
      setError(err.message);
      setSettings({ enabled: false, upiId: null, qrUrl: null });
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchSettings();
  }, [fetchSettings]);

  return {
    settings,
    loading,
    error,
    refetch: fetchSettings,
  };
}

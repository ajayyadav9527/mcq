import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

serve(async (req) => {
  // Handle CORS preflight
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const supabase = createClient(supabaseUrl, supabaseKey);

    const url = new URL(req.url);
    const pathParts = url.pathname.split('/').filter(Boolean);
    
    // GET /donation-settings - Public endpoint to get donation settings
    if (req.method === 'GET') {
      console.log('Fetching donation settings...');
      
      // Fetch the three donation-related settings
      const { data: settings, error } = await supabase
        .from('system_settings')
        .select('key, value')
        .in('key', ['donation_enabled', 'donation_upi_id', 'donation_qr_url']);

      if (error) {
        console.error('Error fetching settings:', error);
        return new Response(
          JSON.stringify({ error: 'Failed to fetch settings' }),
          { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }

      // Build response object
      const result = {
        enabled: false,
        upiId: null as string | null,
        qrUrl: null as string | null,
      };

      for (const setting of settings || []) {
        if (setting.key === 'donation_enabled') {
          result.enabled = setting.value === true || setting.value === 'true';
        } else if (setting.key === 'donation_upi_id') {
          result.upiId = typeof setting.value === 'string' ? setting.value : null;
        } else if (setting.key === 'donation_qr_url') {
          result.qrUrl = typeof setting.value === 'string' ? setting.value : null;
        }
      }

      console.log('Donation settings:', result);

      return new Response(
        JSON.stringify(result),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    return new Response(
      JSON.stringify({ error: 'Method not allowed' }),
      { status: 405, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error) {
    console.error('Error:', error);
    return new Response(
      JSON.stringify({ error: 'Internal server error' }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});

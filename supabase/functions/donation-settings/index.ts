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
      
      // Fetch the donation_settings record
      const { data: setting, error } = await supabase
        .from('system_settings')
        .select('value')
        .eq('key', 'donation_settings')
        .single();

      if (error) {
        console.error('Error fetching settings:', error);
        // Return default disabled state if not found
        return new Response(
          JSON.stringify({ enabled: false, upiId: null, qrUrl: null }),
          { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }

      // Extract values from the JSON object
      const value = setting?.value || {};
      const result = {
        enabled: value.enabled === true,
        upiId: value.upiId || null,
        qrUrl: value.qrUrl || null,
      };

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

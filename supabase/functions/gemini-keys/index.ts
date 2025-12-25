import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

serve(async (req) => {
  // Handle CORS preflight requests
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    // Collect all available Gemini API keys from environment
    const keys: string[] = [];
    
    const key1 = Deno.env.get('GEMINI_API_KEY_1');
    const key2 = Deno.env.get('GEMINI_API_KEY_2');
    const key3 = Deno.env.get('GEMINI_API_KEY_3');
    const key4 = Deno.env.get('GEMINI_API_KEY_4');
    
    if (key1) keys.push(key1);
    if (key2) keys.push(key2);
    if (key3) keys.push(key3);
    if (key4) keys.push(key4);
    
    console.log(`Returning ${keys.length} Gemini API keys`);
    
    return new Response(
      JSON.stringify({ keys, count: keys.length }),
      { 
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 200 
      }
    );
  } catch (error) {
    console.error('Error fetching Gemini keys:', error);
    return new Response(
      JSON.stringify({ error: 'Failed to fetch API keys', keys: [], count: 0 }),
      { 
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 500 
      }
    );
  }
});

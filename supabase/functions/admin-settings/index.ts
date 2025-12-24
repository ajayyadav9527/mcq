import "https://deno.land/x/xhr@0.1.0/mod.ts";
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { verify } from "https://deno.land/x/djwt@v3.0.2/mod.ts";
import { crypto } from "https://deno.land/std@0.168.0/crypto/mod.ts";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

const SUPABASE_URL = Deno.env.get('SUPABASE_URL')!;
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
const JWT_SECRET = Deno.env.get('ADMIN_JWT_SECRET')!;

async function getJwtKey() {
  const encoder = new TextEncoder();
  const keyData = encoder.encode(JWT_SECRET);
  return await crypto.subtle.importKey(
    "raw",
    keyData,
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign", "verify"]
  );
}

async function verifyAdmin(req: Request) {
  const authHeader = req.headers.get('authorization');
  if (!authHeader?.startsWith('Bearer ')) {
    throw new Error('No token provided');
  }

  const token = authHeader.substring(7);
  const key = await getJwtKey();
  
  const payload = await verify(token, key);
  if (payload.type !== 'access') {
    throw new Error('Invalid token type');
  }
  
  return payload;
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);

  try {
    const admin = await verifyAdmin(req);
    const url = new URL(req.url);
    const pathParts = url.pathname.split('/').filter(Boolean);
    const settingKey = pathParts.length > 1 ? pathParts[pathParts.length - 1] : null;

    // GET /admin-settings - List all settings
    if (req.method === 'GET' && !settingKey) {
      const { data: settings, error } = await supabase
        .from('system_settings')
        .select('*')
        .order('key');

      if (error) throw error;

      return new Response(JSON.stringify({ settings }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // GET /admin-settings/:key - Get single setting
    if (req.method === 'GET' && settingKey) {
      const { data: setting, error } = await supabase
        .from('system_settings')
        .select('*')
        .eq('key', settingKey)
        .single();

      if (error && error.code !== 'PGRST116') throw error;

      if (!setting) {
        return new Response(JSON.stringify({ error: 'Setting not found' }), {
          status: 404,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });
      }

      return new Response(JSON.stringify({ setting }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // PUT /admin-settings/:key - Create or update setting
    if (req.method === 'PUT' && settingKey) {
      const body = await req.json();
      const { value, description } = body;

      if (value === undefined) {
        return new Response(JSON.stringify({ error: 'Value is required' }), {
          status: 400,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });
      }

      const { data: existingSetting } = await supabase
        .from('system_settings')
        .select('id')
        .eq('key', settingKey)
        .single();

      let setting;
      if (existingSetting) {
        const { data, error } = await supabase
          .from('system_settings')
          .update({ 
            value, 
            description: description || null,
            updated_by: admin.sub
          })
          .eq('key', settingKey)
          .select()
          .single();

        if (error) throw error;
        setting = data;
      } else {
        const { data, error } = await supabase
          .from('system_settings')
          .insert({ 
            key: settingKey,
            value,
            description: description || null,
            updated_by: admin.sub
          })
          .select()
          .single();

        if (error) throw error;
        setting = data;
      }

      // Log audit
      const ip = req.headers.get('x-forwarded-for') || 'unknown';
      const userAgent = req.headers.get('user-agent') || 'unknown';
      await supabase.from('admin_audit_logs').insert({
        admin_id: admin.sub,
        action_type: existingSetting ? 'UPDATE_SETTING' : 'CREATE_SETTING',
        target_type: 'setting',
        target_id: setting.id,
        metadata: { key: settingKey },
        ip_address: ip,
        user_agent: userAgent
      });

      return new Response(JSON.stringify({ setting }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // DELETE /admin-settings/:key - Delete setting
    if (req.method === 'DELETE' && settingKey) {
      const { data: setting } = await supabase
        .from('system_settings')
        .select('id')
        .eq('key', settingKey)
        .single();

      if (!setting) {
        return new Response(JSON.stringify({ error: 'Setting not found' }), {
          status: 404,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });
      }

      const { error } = await supabase
        .from('system_settings')
        .delete()
        .eq('key', settingKey);

      if (error) throw error;

      // Log audit
      const ip = req.headers.get('x-forwarded-for') || 'unknown';
      const userAgent = req.headers.get('user-agent') || 'unknown';
      await supabase.from('admin_audit_logs').insert({
        admin_id: admin.sub,
        action_type: 'DELETE_SETTING',
        target_type: 'setting',
        target_id: setting.id,
        metadata: { key: settingKey },
        ip_address: ip,
        user_agent: userAgent
      });

      return new Response(JSON.stringify({ success: true }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    return new Response(JSON.stringify({ error: 'Method not allowed' }), {
      status: 405,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });

  } catch (error: unknown) {
    console.error('Admin settings error:', error);
    
    const err = error as Error;
    if (err.message === 'No token provided' || err.message === 'Invalid token type') {
      return new Response(JSON.stringify({ error: 'Unauthorized' }), {
        status: 401,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }
    
    return new Response(JSON.stringify({ error: 'Internal server error' }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});

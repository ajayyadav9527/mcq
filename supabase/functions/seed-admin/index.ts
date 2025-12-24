import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

const SUPABASE_URL = Deno.env.get('SUPABASE_URL')!;
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;

// Simple password hashing using PBKDF2 (Web Crypto compatible)
async function hashPassword(password: string): Promise<string> {
  const encoder = new TextEncoder();
  const salt = crypto.getRandomValues(new Uint8Array(16));
  const keyMaterial = await crypto.subtle.importKey(
    "raw",
    encoder.encode(password),
    "PBKDF2",
    false,
    ["deriveBits"]
  );
  const derivedBits = await crypto.subtle.deriveBits(
    {
      name: "PBKDF2",
      salt: salt,
      iterations: 100000,
      hash: "SHA-256"
    },
    keyMaterial,
    256
  );
  const hashArray = Array.from(new Uint8Array(derivedBits));
  const saltArray = Array.from(salt);
  const combined = [...saltArray, ...hashArray];
  return btoa(String.fromCharCode(...combined));
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);

  try {
    // Check if admin already exists
    const { data: existingAdmin } = await supabase
      .from('admins')
      .select('id')
      .eq('email', 'admin@admin.com')
      .maybeSingle();

    if (existingAdmin) {
      return new Response(JSON.stringify({ 
        message: 'Admin already exists',
        email: 'admin@admin.com'
      }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // Hash password using PBKDF2
    const passwordHash = await hashPassword('Admin@123');

    // Insert admin
    const { data: admin, error } = await supabase
      .from('admins')
      .insert({
        email: 'admin@admin.com',
        password_hash: passwordHash,
        role: 'SUPER_ADMIN',
        is_active: true
      })
      .select()
      .single();

    if (error) {
      console.error('Error creating admin:', error);
      throw error;
    }

    console.log('Admin created successfully:', admin.email);

    return new Response(JSON.stringify({ 
      success: true,
      message: 'Admin created successfully',
      email: 'admin@admin.com',
      password: 'Admin@123'
    }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });

  } catch (error: unknown) {
    console.error('Seed admin error:', error);
    const err = error as Error;
    return new Response(JSON.stringify({ error: err.message }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});

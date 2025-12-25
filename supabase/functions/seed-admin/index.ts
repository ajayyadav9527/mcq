import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type, x-seed-secret',
};

const SUPABASE_URL = Deno.env.get('SUPABASE_URL')!;
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;

// Security: Read credentials from environment variables, not hardcoded
const SEED_ADMIN_SECRET = Deno.env.get('SEED_ADMIN_SECRET');
const SEED_ADMIN_EMAIL = Deno.env.get('SEED_ADMIN_EMAIL');
const SEED_ADMIN_PASSWORD = Deno.env.get('SEED_ADMIN_PASSWORD');

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

  // Get request metadata for audit logging
  const clientIp = req.headers.get('x-forwarded-for') || req.headers.get('cf-connecting-ip') || 'unknown';
  const userAgent = req.headers.get('user-agent') || 'unknown';

  // SECURITY: Require secret token for authentication
  if (!SEED_ADMIN_SECRET) {
    console.error(`[AUDIT] Seed admin attempt failed - SEED_ADMIN_SECRET not configured | IP: ${clientIp}`);
    return new Response(JSON.stringify({ error: 'Service not configured' }), {
      status: 503,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }

  const authHeader = req.headers.get('x-seed-secret');
  if (!authHeader || authHeader !== SEED_ADMIN_SECRET) {
    console.error(`[AUDIT] Seed admin unauthorized attempt | IP: ${clientIp} | User-Agent: ${userAgent}`);
    return new Response(JSON.stringify({ error: 'Unauthorized' }), {
      status: 401,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }

  // SECURITY: Validate environment variables are configured
  if (!SEED_ADMIN_EMAIL || !SEED_ADMIN_PASSWORD) {
    console.error(`[AUDIT] Seed admin failed - credentials not configured | IP: ${clientIp}`);
    return new Response(JSON.stringify({ error: 'Admin credentials not configured' }), {
      status: 503,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }

  // Validate email format
  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  if (!emailRegex.test(SEED_ADMIN_EMAIL)) {
    console.error(`[AUDIT] Seed admin failed - invalid email format | IP: ${clientIp}`);
    return new Response(JSON.stringify({ error: 'Invalid admin email configuration' }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }

  // Validate password strength
  if (SEED_ADMIN_PASSWORD.length < 8) {
    console.error(`[AUDIT] Seed admin failed - weak password | IP: ${clientIp}`);
    return new Response(JSON.stringify({ error: 'Admin password too weak' }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }

  const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);

  try {
    // Check if any admin already exists (don't reveal specific admin info)
    const { data: existingAdmins, error: checkError } = await supabase
      .from('admins')
      .select('id')
      .limit(1);

    if (checkError) {
      console.error(`[AUDIT] Seed admin database error | IP: ${clientIp}`, checkError);
      throw checkError;
    }

    if (existingAdmins && existingAdmins.length > 0) {
      console.log(`[AUDIT] Seed admin skipped - admin(s) already exist | IP: ${clientIp}`);
      // SECURITY: Don't reveal if specific admin exists, just that admins exist
      return new Response(JSON.stringify({ 
        message: 'Admin account already configured',
        action: 'none'
      }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // Hash password using PBKDF2
    const passwordHash = await hashPassword(SEED_ADMIN_PASSWORD);

    // Insert admin
    const { data: admin, error } = await supabase
      .from('admins')
      .insert({
        email: SEED_ADMIN_EMAIL.toLowerCase().trim(),
        password_hash: passwordHash,
        role: 'SUPER_ADMIN',
        is_active: true
      })
      .select('id, email')
      .single();

    if (error) {
      console.error(`[AUDIT] Seed admin creation failed | IP: ${clientIp}`, error);
      throw error;
    }

    console.log(`[AUDIT] Admin created successfully | ID: ${admin.id} | IP: ${clientIp}`);

    return new Response(JSON.stringify({ 
      success: true,
      message: 'Admin created successfully',
      action: 'created'
    }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });

  } catch (error: unknown) {
    console.error(`[AUDIT] Seed admin error | IP: ${clientIp}`, error);
    const err = error as Error;
    return new Response(JSON.stringify({ error: 'Failed to create admin' }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});

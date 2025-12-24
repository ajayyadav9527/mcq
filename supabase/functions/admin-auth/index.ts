import "https://deno.land/x/xhr@0.1.0/mod.ts";
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import * as bcrypt from "https://deno.land/x/bcrypt@v0.4.1/mod.ts";
import { create, verify } from "https://deno.land/x/djwt@v3.0.2/mod.ts";
import { crypto } from "https://deno.land/std@0.168.0/crypto/mod.ts";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

const SUPABASE_URL = Deno.env.get('SUPABASE_URL')!;
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
const JWT_SECRET = Deno.env.get('ADMIN_JWT_SECRET')!;

// Create crypto key from secret
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

// Generate access token (15 min expiry)
async function generateAccessToken(adminId: string, email: string, role: string) {
  const key = await getJwtKey();
  const now = Math.floor(Date.now() / 1000);
  return await create(
    { alg: "HS256", typ: "JWT" },
    {
      sub: adminId,
      email,
      role,
      iat: now,
      exp: now + 15 * 60, // 15 minutes
      type: "access"
    },
    key
  );
}

// Generate refresh token (7 days expiry)
async function generateRefreshToken(adminId: string) {
  const key = await getJwtKey();
  const now = Math.floor(Date.now() / 1000);
  return await create(
    { alg: "HS256", typ: "JWT" },
    {
      sub: adminId,
      iat: now,
      exp: now + 7 * 24 * 60 * 60, // 7 days
      type: "refresh"
    },
    key
  );
}

// Hash refresh token for storage
async function hashToken(token: string): Promise<string> {
  const encoder = new TextEncoder();
  const data = encoder.encode(token);
  const hashBuffer = await crypto.subtle.digest("SHA-256", data);
  const hashArray = Array.from(new Uint8Array(hashBuffer));
  return hashArray.map(b => b.toString(16).padStart(2, '0')).join('');
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);
  
  try {
    const url = new URL(req.url);
    const action = url.pathname.split('/').pop();
    const body = req.method === 'POST' ? await req.json() : {};
    
    // Get client IP and user agent for audit
    const ip = req.headers.get('x-forwarded-for') || req.headers.get('cf-connecting-ip') || 'unknown';
    const userAgent = req.headers.get('user-agent') || 'unknown';

    if (action === 'login') {
      const { email, password } = body;
      
      if (!email || !password) {
        return new Response(JSON.stringify({ error: 'Email and password required' }), {
          status: 400,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });
      }

      // Get admin by email
      const { data: admin, error: adminError } = await supabase
        .from('admins')
        .select('*')
        .eq('email', email.toLowerCase())
        .single();

      if (adminError || !admin) {
        console.log('Login failed: Admin not found', email);
        return new Response(JSON.stringify({ error: 'Invalid credentials' }), {
          status: 401,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });
      }

      // Check if account is locked
      if (admin.locked_until && new Date(admin.locked_until) > new Date()) {
        console.log('Login failed: Account locked', email);
        return new Response(JSON.stringify({ 
          error: 'Account locked. Try again later.',
          locked_until: admin.locked_until
        }), {
          status: 423,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });
      }

      // Check if account is active
      if (!admin.is_active) {
        console.log('Login failed: Account inactive', email);
        return new Response(JSON.stringify({ error: 'Account is disabled' }), {
          status: 403,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });
      }

      // Verify password
      const passwordValid = await bcrypt.compare(password, admin.password_hash);
      
      if (!passwordValid) {
        // Increment failed attempts
        const newAttempts = admin.failed_login_attempts + 1;
        const lockUntil = newAttempts >= 5 ? new Date(Date.now() + 30 * 60 * 1000).toISOString() : null;
        
        await supabase
          .from('admins')
          .update({ 
            failed_login_attempts: newAttempts,
            locked_until: lockUntil
          })
          .eq('id', admin.id);

        console.log('Login failed: Invalid password', email, 'Attempts:', newAttempts);
        return new Response(JSON.stringify({ 
          error: 'Invalid credentials',
          attempts_remaining: Math.max(0, 5 - newAttempts)
        }), {
          status: 401,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });
      }

      // Generate tokens
      const accessToken = await generateAccessToken(admin.id, admin.email, admin.role);
      const refreshToken = await generateRefreshToken(admin.id);
      const refreshTokenHash = await hashToken(refreshToken);

      // Store refresh token
      const expiresAt = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString();
      await supabase
        .from('refresh_tokens')
        .insert({
          admin_id: admin.id,
          token_hash: refreshTokenHash,
          expires_at: expiresAt
        });

      // Reset failed attempts and update last login
      await supabase
        .from('admins')
        .update({ 
          failed_login_attempts: 0,
          locked_until: null,
          last_login_at: new Date().toISOString()
        })
        .eq('id', admin.id);

      // Log audit event
      await supabase
        .from('admin_audit_logs')
        .insert({
          admin_id: admin.id,
          action_type: 'LOGIN',
          ip_address: ip,
          user_agent: userAgent,
          metadata: { email: admin.email }
        });

      console.log('Login successful:', email);
      return new Response(JSON.stringify({
        access_token: accessToken,
        refresh_token: refreshToken,
        admin: {
          id: admin.id,
          email: admin.email,
          role: admin.role
        }
      }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    if (action === 'refresh') {
      const { refresh_token } = body;
      
      if (!refresh_token) {
        return new Response(JSON.stringify({ error: 'Refresh token required' }), {
          status: 400,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });
      }

      // Verify refresh token
      const key = await getJwtKey();
      let payload;
      try {
        payload = await verify(refresh_token, key);
      } catch {
        return new Response(JSON.stringify({ error: 'Invalid refresh token' }), {
          status: 401,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });
      }

      if (payload.type !== 'refresh') {
        return new Response(JSON.stringify({ error: 'Invalid token type' }), {
          status: 401,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });
      }

      // Check if token exists in database
      const tokenHash = await hashToken(refresh_token);
      const { data: storedToken, error: tokenError } = await supabase
        .from('refresh_tokens')
        .select('*, admins(*)')
        .eq('token_hash', tokenHash)
        .eq('is_revoked', false)
        .single();

      if (tokenError || !storedToken) {
        return new Response(JSON.stringify({ error: 'Token not found or revoked' }), {
          status: 401,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });
      }

      // Check if token is expired
      if (new Date(storedToken.expires_at) < new Date()) {
        return new Response(JSON.stringify({ error: 'Refresh token expired' }), {
          status: 401,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });
      }

      const admin = storedToken.admins;
      if (!admin.is_active) {
        return new Response(JSON.stringify({ error: 'Account is disabled' }), {
          status: 403,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });
      }

      // Generate new access token
      const accessToken = await generateAccessToken(admin.id, admin.email, admin.role);

      console.log('Token refreshed for:', admin.email);
      return new Response(JSON.stringify({
        access_token: accessToken,
        admin: {
          id: admin.id,
          email: admin.email,
          role: admin.role
        }
      }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    if (action === 'logout') {
      const authHeader = req.headers.get('authorization');
      if (!authHeader?.startsWith('Bearer ')) {
        return new Response(JSON.stringify({ error: 'No token provided' }), {
          status: 401,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });
      }

      const token = authHeader.substring(7);
      const key = await getJwtKey();
      
      let payload;
      try {
        payload = await verify(token, key);
      } catch {
        return new Response(JSON.stringify({ error: 'Invalid token' }), {
          status: 401,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });
      }

      const { refresh_token } = body;
      if (refresh_token) {
        const tokenHash = await hashToken(refresh_token);
        await supabase
          .from('refresh_tokens')
          .update({ is_revoked: true })
          .eq('token_hash', tokenHash);
      }

      // Revoke all tokens for this admin if requested
      if (body.revoke_all) {
        await supabase
          .from('refresh_tokens')
          .update({ is_revoked: true })
          .eq('admin_id', payload.sub);
      }

      // Log audit event
      await supabase
        .from('admin_audit_logs')
        .insert({
          admin_id: payload.sub as string,
          action_type: 'LOGOUT',
          ip_address: ip,
          user_agent: userAgent,
          metadata: { revoke_all: body.revoke_all || false }
        });

      console.log('Logout successful:', payload.email);
      return new Response(JSON.stringify({ success: true }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    if (action === 'verify') {
      const authHeader = req.headers.get('authorization');
      if (!authHeader?.startsWith('Bearer ')) {
        return new Response(JSON.stringify({ valid: false, error: 'No token provided' }), {
          status: 401,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });
      }

      const token = authHeader.substring(7);
      const key = await getJwtKey();
      
      try {
        const payload = await verify(token, key);
        if (payload.type !== 'access') {
          throw new Error('Invalid token type');
        }
        
        return new Response(JSON.stringify({ 
          valid: true, 
          admin: {
            id: payload.sub,
            email: payload.email,
            role: payload.role
          }
        }), {
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });
      } catch {
        return new Response(JSON.stringify({ valid: false, error: 'Invalid or expired token' }), {
          status: 401,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });
      }
    }

    return new Response(JSON.stringify({ error: 'Unknown action' }), {
      status: 404,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });

  } catch (error) {
    console.error('Admin auth error:', error);
    return new Response(JSON.stringify({ error: 'Internal server error' }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});

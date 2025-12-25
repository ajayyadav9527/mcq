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

async function logAudit(
  supabase: any,
  adminId: string,
  actionType: string,
  targetType: string,
  targetId: string | null,
  metadata: Record<string, unknown>,
  req: Request
) {
  const ip = req.headers.get('x-forwarded-for') || req.headers.get('cf-connecting-ip') || 'unknown';
  const userAgent = req.headers.get('user-agent') || 'unknown';
  
  await supabase.from('admin_audit_logs').insert({
    admin_id: adminId,
    action_type: actionType,
    target_type: targetType,
    target_id: targetId,
    metadata,
    ip_address: ip,
    user_agent: userAgent
  });
}

// Sanitize search input to prevent SQL pattern injection
function sanitizeSearchInput(input: string): string {
  // Escape SQL ILIKE special characters: %, _, \
  // Also limit length to prevent abuse
  return input
    .replace(/\\/g, '\\\\')  // Escape backslashes first
    .replace(/%/g, '\\%')    // Escape percent
    .replace(/_/g, '\\_')    // Escape underscore
    .substring(0, 100);      // Limit length
}

// Validate search input characters (alphanumeric, @, ., -, _, space)
function isValidSearchInput(input: string): boolean {
  return /^[a-zA-Z0-9@.\-_\s]*$/.test(input);
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);

  try {
    // Verify admin token
    const admin = await verifyAdmin(req);
    const url = new URL(req.url);
    const pathParts = url.pathname.split('/').filter(Boolean);
    const userId = pathParts[pathParts.length - 1] !== 'admin-users' ? pathParts[pathParts.length - 1] : null;

    // GET /admin-users - List all users with pagination
    if (req.method === 'GET' && !userId) {
      const page = parseInt(url.searchParams.get('page') || '1');
      const limit = Math.min(parseInt(url.searchParams.get('limit') || '20'), 100);
      const rawSearch = url.searchParams.get('search') || '';
      const blocked = url.searchParams.get('blocked');
      
      let query = supabase
        .from('users')
        .select('*', { count: 'exact' });
      
      // Sanitize and validate search input before using in query
      if (rawSearch) {
        if (!isValidSearchInput(rawSearch)) {
          return new Response(JSON.stringify({ error: 'Invalid search characters' }), {
            status: 400,
            headers: { ...corsHeaders, 'Content-Type': 'application/json' },
          });
        }
        const sanitizedSearch = sanitizeSearchInput(rawSearch);
        query = query.or(`email.ilike.%${sanitizedSearch}%,name.ilike.%${sanitizedSearch}%`);
      }
      
      if (blocked !== null && blocked !== '') {
        query = query.eq('is_blocked', blocked === 'true');
      }
      
      const { data: users, error, count } = await query
        .order('created_at', { ascending: false })
        .range((page - 1) * limit, page * limit - 1);

      if (error) throw error;

      // Get API usage stats for each user
      const userIds = users?.map(u => u.id) || [];
      const { data: usageData } = await supabase
        .from('api_usage')
        .select('user_id, request_count, date')
        .in('user_id', userIds)
        .gte('date', new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString().split('T')[0]);

      // Aggregate usage per user
      const usageByUser: Record<string, number> = {};
      usageData?.forEach(u => {
        usageByUser[u.user_id] = (usageByUser[u.user_id] || 0) + u.request_count;
      });

      const usersWithUsage = users?.map(u => ({
        ...u,
        api_usage_30d: usageByUser[u.id] || 0
      }));

      return new Response(JSON.stringify({
        users: usersWithUsage,
        total: count,
        page,
        limit,
        total_pages: Math.ceil((count || 0) / limit)
      }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // GET /admin-users/:id - Get single user
    if (req.method === 'GET' && userId) {
      const { data: user, error } = await supabase
        .from('users')
        .select('*')
        .eq('id', userId)
        .single();

      if (error) throw error;

      // Get detailed API usage
      const { data: usage } = await supabase
        .from('api_usage')
        .select('*')
        .eq('user_id', userId)
        .order('date', { ascending: false })
        .limit(30);

      return new Response(JSON.stringify({
        user,
        api_usage: usage
      }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // POST /admin-users - Create new user
    if (req.method === 'POST' && !userId) {
      const body = await req.json();
      const { email, name, api_quota_daily, api_quota_weekly, api_quota_monthly } = body;

      if (!email) {
        return new Response(JSON.stringify({ error: 'Email is required' }), {
          status: 400,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });
      }

      const { data: newUser, error } = await supabase
        .from('users')
        .insert({
          email: email.toLowerCase(),
          name,
          api_quota_daily: api_quota_daily || 100,
          api_quota_weekly: api_quota_weekly || 500,
          api_quota_monthly: api_quota_monthly || 2000
        })
        .select()
        .single();

      if (error) {
        if (error.code === '23505') {
          return new Response(JSON.stringify({ error: 'User with this email already exists' }), {
            status: 409,
            headers: { ...corsHeaders, 'Content-Type': 'application/json' },
          });
        }
        throw error;
      }

      await logAudit(supabase, admin.sub as string, 'CREATE_USER', 'user', newUser.id, { email }, req);

      return new Response(JSON.stringify({ user: newUser }), {
        status: 201,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // PATCH /admin-users/:id - Update user
    if (req.method === 'PATCH' && userId) {
      const body = await req.json();
      const allowedFields = ['name', 'email', 'is_blocked', 'api_quota_daily', 'api_quota_weekly', 'api_quota_monthly'];
      
      const updates: Record<string, unknown> = {};
      for (const field of allowedFields) {
        if (body[field] !== undefined) {
          updates[field] = field === 'email' ? body[field].toLowerCase() : body[field];
        }
      }

      if (Object.keys(updates).length === 0) {
        return new Response(JSON.stringify({ error: 'No valid fields to update' }), {
          status: 400,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });
      }

      const { data: updatedUser, error } = await supabase
        .from('users')
        .update(updates)
        .eq('id', userId)
        .select()
        .single();

      if (error) throw error;

      await logAudit(supabase, admin.sub as string, 'UPDATE_USER', 'user', userId, { updates }, req);

      return new Response(JSON.stringify({ user: updatedUser }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // DELETE /admin-users/:id - Delete user
    if (req.method === 'DELETE' && userId) {
      const { data: user } = await supabase
        .from('users')
        .select('email')
        .eq('id', userId)
        .single();

      const { error } = await supabase
        .from('users')
        .delete()
        .eq('id', userId);

      if (error) throw error;

      await logAudit(supabase, admin.sub as string, 'DELETE_USER', 'user', userId, { email: user?.email }, req);

      return new Response(JSON.stringify({ success: true }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    return new Response(JSON.stringify({ error: 'Method not allowed' }), {
      status: 405,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });

  } catch (error: unknown) {
    console.error('Admin users error:', error);
    
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

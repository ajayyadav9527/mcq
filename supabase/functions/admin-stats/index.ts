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
    await verifyAdmin(req);
    const url = new URL(req.url);
    const pathParts = url.pathname.split('/').filter(Boolean);
    const statType = pathParts.length > 1 ? pathParts[pathParts.length - 1] : 'overview';

    if (req.method !== 'GET') {
      return new Response(JSON.stringify({ error: 'Method not allowed' }), {
        status: 405,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // Overview stats
    if (statType === 'overview' || statType === 'admin-stats') {
      // Get user counts
      const { count: totalUsers } = await supabase
        .from('users')
        .select('*', { count: 'exact', head: true });

      const { count: blockedUsers } = await supabase
        .from('users')
        .select('*', { count: 'exact', head: true })
        .eq('is_blocked', true);

      // Get today's new users
      const today = new Date().toISOString().split('T')[0];
      const { count: newUsersToday } = await supabase
        .from('users')
        .select('*', { count: 'exact', head: true })
        .gte('created_at', today);

      // Get API usage stats
      const { data: todayUsage } = await supabase
        .from('api_usage')
        .select('request_count')
        .eq('date', today);

      const totalRequestsToday = todayUsage?.reduce((sum, u) => sum + u.request_count, 0) || 0;

      // Get 7-day usage trend
      const sevenDaysAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString().split('T')[0];
      const { data: weeklyUsage } = await supabase
        .from('api_usage')
        .select('date, request_count')
        .gte('date', sevenDaysAgo)
        .order('date');

      // Aggregate by date
      const usageByDate: Record<string, number> = {};
      weeklyUsage?.forEach(u => {
        usageByDate[u.date] = (usageByDate[u.date] || 0) + u.request_count;
      });

      return new Response(JSON.stringify({
        users: {
          total: totalUsers || 0,
          blocked: blockedUsers || 0,
          active: (totalUsers || 0) - (blockedUsers || 0),
          new_today: newUsersToday || 0
        },
        api: {
          requests_today: totalRequestsToday,
          weekly_trend: Object.entries(usageByDate).map(([date, count]) => ({ date, count }))
        }
      }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // API usage details
    if (statType === 'api-usage') {
      const days = parseInt(url.searchParams.get('days') || '30');
      const startDate = new Date(Date.now() - days * 24 * 60 * 60 * 1000).toISOString().split('T')[0];
      
      const { data: usage } = await supabase
        .from('api_usage')
        .select('*')
        .gte('date', startDate)
        .order('date');

      // Aggregate by date and endpoint
      const byDate: Record<string, number> = {};
      const byEndpoint: Record<string, number> = {};
      
      usage?.forEach(u => {
        byDate[u.date] = (byDate[u.date] || 0) + u.request_count;
        byEndpoint[u.endpoint] = (byEndpoint[u.endpoint] || 0) + u.request_count;
      });

      return new Response(JSON.stringify({
        by_date: Object.entries(byDate).map(([date, count]) => ({ date, count })),
        by_endpoint: Object.entries(byEndpoint)
          .map(([endpoint, count]) => ({ endpoint, count }))
          .sort((a, b) => b.count - a.count)
      }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // Audit logs
    if (statType === 'audit-logs') {
      const page = parseInt(url.searchParams.get('page') || '1');
      const limit = Math.min(parseInt(url.searchParams.get('limit') || '50'), 100);
      const adminId = url.searchParams.get('admin_id');
      const actionType = url.searchParams.get('action_type');
      
      let query = supabase
        .from('admin_audit_logs')
        .select('*, admins(email)', { count: 'exact' });

      if (adminId) {
        query = query.eq('admin_id', adminId);
      }
      
      if (actionType) {
        query = query.eq('action_type', actionType);
      }

      const { data: logs, error, count } = await query
        .order('created_at', { ascending: false })
        .range((page - 1) * limit, page * limit - 1);

      if (error) throw error;

      return new Response(JSON.stringify({
        logs,
        total: count,
        page,
        limit,
        total_pages: Math.ceil((count || 0) / limit)
      }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    return new Response(JSON.stringify({ error: 'Unknown stat type' }), {
      status: 404,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });

  } catch (error: unknown) {
    console.error('Admin stats error:', error);
    
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

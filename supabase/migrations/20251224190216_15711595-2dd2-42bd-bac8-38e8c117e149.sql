-- RLS Policies: All admin tables are accessed via edge functions with service role key
-- These policies deny all direct client access (security by design)

-- Admins table: No direct client access allowed
CREATE POLICY "No direct access to admins"
ON public.admins
FOR ALL
TO anon, authenticated
USING (false)
WITH CHECK (false);

-- Refresh tokens: No direct client access
CREATE POLICY "No direct access to refresh_tokens"
ON public.refresh_tokens
FOR ALL
TO anon, authenticated
USING (false)
WITH CHECK (false);

-- Users table: Admin access only via edge functions
CREATE POLICY "No direct access to users"
ON public.users
FOR ALL
TO anon, authenticated
USING (false)
WITH CHECK (false);

-- API usage: Admin access only via edge functions
CREATE POLICY "No direct access to api_usage"
ON public.api_usage
FOR ALL
TO anon, authenticated
USING (false)
WITH CHECK (false);

-- System settings: Admin access only via edge functions
CREATE POLICY "No direct access to system_settings"
ON public.system_settings
FOR ALL
TO anon, authenticated
USING (false)
WITH CHECK (false);

-- Audit logs: Admin access only via edge functions
CREATE POLICY "No direct access to audit_logs"
ON public.admin_audit_logs
FOR ALL
TO anon, authenticated
USING (false)
WITH CHECK (false);
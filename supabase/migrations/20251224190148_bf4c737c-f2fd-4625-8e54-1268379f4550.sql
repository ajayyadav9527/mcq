-- Create admin roles enum
CREATE TYPE public.admin_role AS ENUM ('SUPER_ADMIN', 'ADMIN');

-- Create admins table (for seeded admin ONLY - no API creation allowed)
CREATE TABLE public.admins (
    id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
    email TEXT NOT NULL UNIQUE,
    password_hash TEXT NOT NULL,
    role admin_role NOT NULL DEFAULT 'SUPER_ADMIN',
    is_active BOOLEAN NOT NULL DEFAULT true,
    failed_login_attempts INTEGER NOT NULL DEFAULT 0,
    locked_until TIMESTAMP WITH TIME ZONE,
    last_login_at TIMESTAMP WITH TIME ZONE,
    created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
    updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Create refresh_tokens table for JWT token management
CREATE TABLE public.refresh_tokens (
    id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
    admin_id UUID NOT NULL REFERENCES public.admins(id) ON DELETE CASCADE,
    token_hash TEXT NOT NULL UNIQUE,
    expires_at TIMESTAMP WITH TIME ZONE NOT NULL,
    is_revoked BOOLEAN NOT NULL DEFAULT false,
    created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Create users table for app users (managed by admin)
CREATE TABLE public.users (
    id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
    email TEXT UNIQUE,
    name TEXT,
    is_blocked BOOLEAN NOT NULL DEFAULT false,
    api_quota_daily INTEGER NOT NULL DEFAULT 100,
    api_quota_weekly INTEGER NOT NULL DEFAULT 500,
    api_quota_monthly INTEGER NOT NULL DEFAULT 2000,
    created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
    updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Create api_usage table for tracking API usage
CREATE TABLE public.api_usage (
    id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
    user_id UUID REFERENCES public.users(id) ON DELETE CASCADE,
    endpoint TEXT NOT NULL,
    request_count INTEGER NOT NULL DEFAULT 1,
    date DATE NOT NULL DEFAULT CURRENT_DATE,
    created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
    UNIQUE(user_id, endpoint, date)
);

-- Create system_settings table for admin-configurable settings
CREATE TABLE public.system_settings (
    id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
    key TEXT NOT NULL UNIQUE,
    value JSONB NOT NULL DEFAULT '{}',
    description TEXT,
    updated_by UUID REFERENCES public.admins(id),
    created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
    updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Create admin_audit_logs table
CREATE TABLE public.admin_audit_logs (
    id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
    admin_id UUID REFERENCES public.admins(id) ON DELETE SET NULL,
    action_type TEXT NOT NULL,
    target_type TEXT,
    target_id UUID,
    metadata JSONB DEFAULT '{}',
    ip_address TEXT,
    user_agent TEXT,
    created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Enable RLS on all tables
ALTER TABLE public.admins ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.refresh_tokens ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.users ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.api_usage ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.system_settings ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.admin_audit_logs ENABLE ROW LEVEL SECURITY;

-- Create function to update timestamps
CREATE OR REPLACE FUNCTION public.update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = now();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql SET search_path = public;

-- Create triggers for automatic timestamp updates
CREATE TRIGGER update_admins_updated_at
    BEFORE UPDATE ON public.admins
    FOR EACH ROW
    EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER update_users_updated_at
    BEFORE UPDATE ON public.users
    FOR EACH ROW
    EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER update_system_settings_updated_at
    BEFORE UPDATE ON public.system_settings
    FOR EACH ROW
    EXECUTE FUNCTION public.update_updated_at_column();

-- Insert seeded admin (password: Deadman@9527, bcrypt hashed)
-- Using bcrypt hash for 'Deadman@9527'
INSERT INTO public.admins (email, password_hash, role) VALUES (
    'yadavaj7709922864',
    '$2a$12$LQv3c1yqBWVHxkd0LHAkCOYz6TtxMQJqhN8/LewKlZ.aD/V6VlqWS',
    'SUPER_ADMIN'
);

-- Insert default system settings
INSERT INTO public.system_settings (key, value, description) VALUES
    ('maintenance_mode', '{"enabled": false, "message": "Site is under maintenance"}', 'Enable/disable maintenance mode'),
    ('registration_enabled', '{"enabled": true}', 'Enable/disable user registration'),
    ('api_limits', '{"daily": 100, "weekly": 500, "monthly": 2000, "enabled": true}', 'Global API rate limits'),
    ('donation_settings', '{"enabled": false, "upi_id": "", "message": "Support Development"}', 'UPI donation settings'),
    ('apis_config', '{"mcq_generator": true, "ocr": true, "quiz": true}', 'Individual API enable/disable')
ON CONFLICT (key) DO NOTHING;

-- Create indexes for performance
CREATE INDEX idx_api_usage_user_date ON public.api_usage(user_id, date);
CREATE INDEX idx_api_usage_date ON public.api_usage(date);
CREATE INDEX idx_admin_audit_logs_admin ON public.admin_audit_logs(admin_id);
CREATE INDEX idx_admin_audit_logs_created ON public.admin_audit_logs(created_at DESC);
CREATE INDEX idx_refresh_tokens_admin ON public.refresh_tokens(admin_id);
CREATE INDEX idx_refresh_tokens_expires ON public.refresh_tokens(expires_at);
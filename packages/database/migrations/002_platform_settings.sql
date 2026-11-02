-- ==========================================================
-- 002_platform_settings.sql
-- Create platform_settings table for Super Admin & System Settings
-- ==========================================================

CREATE TABLE IF NOT EXISTS public.platform_settings (
    key TEXT PRIMARY KEY,
    value TEXT NOT NULL,
    description TEXT,
    updated_at TIMESTAMPTZ DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.platform_settings ENABLE ROW LEVEL SECURITY;

-- Allow public read of platform settings (e.g. for server API verification)
CREATE POLICY "Allow read platform_settings"
    ON public.platform_settings FOR SELECT
    USING (true);

-- Allow server API to insert or update platform settings
CREATE POLICY "Allow upsert platform_settings"
    ON public.platform_settings FOR ALL
    USING (true)
    WITH CHECK (true);

-- Seed default Super Admin Master PIN
INSERT INTO public.platform_settings (key, value, description)
VALUES ('super_admin_pin', 'admin786', 'Master Super Admin Security Key for MeraResto Portal')
ON CONFLICT (key) DO NOTHING;


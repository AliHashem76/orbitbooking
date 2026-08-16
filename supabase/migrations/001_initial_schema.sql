-- Orbit Booking — Initial Schema, RLS, Functions & Seed
-- Run in Supabase SQL Editor or via CLI: supabase db push

CREATE EXTENSION IF NOT EXISTS "pgcrypto";

-- ---------------------------------------------------------------------------
-- Tables
-- ---------------------------------------------------------------------------

CREATE TABLE IF NOT EXISTS public.admins (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  username TEXT NOT NULL UNIQUE,
  password_hash TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS public.businesses (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  trade_name TEXT NOT NULL,
  business_type TEXT NOT NULL,
  country TEXT NOT NULL,
  currency TEXT NOT NULL DEFAULT 'USD',
  timezone TEXT NOT NULL DEFAULT 'Asia/Beirut',
  username TEXT NOT NULL UNIQUE,
  password_hash TEXT NOT NULL,
  phone TEXT,
  slug TEXT NOT NULL UNIQUE,
  subscription_date TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
  renewal_date TIMESTAMPTZ NOT NULL,
  is_active BOOLEAN NOT NULL DEFAULT TRUE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT businesses_renewal_after_sub CHECK (renewal_date > subscription_date - INTERVAL '1 day')
);

CREATE TABLE IF NOT EXISTS public.services (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  business_id UUID NOT NULL REFERENCES public.businesses(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  duration_minutes INTEGER NOT NULL CHECK (duration_minutes > 0 AND duration_minutes <= 1440),
  price NUMERIC(12, 2) NOT NULL CHECK (price >= 0),
  is_active BOOLEAN NOT NULL DEFAULT TRUE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS public.business_settings (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  business_id UUID NOT NULL UNIQUE REFERENCES public.businesses(id) ON DELETE CASCADE,
  working_days INTEGER[] NOT NULL DEFAULT ARRAY[1,2,3,4,5],
  daily_hours JSONB NOT NULL DEFAULT '{"start":"09:00","end":"17:00"}'::JSONB,
  breaks JSONB NOT NULL DEFAULT '[]'::JSONB,
  buffer_minutes INTEGER NOT NULL DEFAULT 10 CHECK (buffer_minutes >= 0 AND buffer_minutes <= 120),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TYPE public.appointment_status AS ENUM ('upcoming', 'completed', 'canceled');

CREATE TABLE IF NOT EXISTS public.appointments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  business_id UUID NOT NULL REFERENCES public.businesses(id) ON DELETE CASCADE,
  service_id UUID NOT NULL REFERENCES public.services(id) ON DELETE RESTRICT,
  client_name TEXT NOT NULL,
  client_phone TEXT NOT NULL,
  starts_at TIMESTAMPTZ NOT NULL,
  ends_at TIMESTAMPTZ NOT NULL,
  status public.appointment_status NOT NULL DEFAULT 'upcoming',
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT appointments_ends_after_starts CHECK (ends_at > starts_at)
);

-- ---------------------------------------------------------------------------
-- Indexes
-- ---------------------------------------------------------------------------

CREATE INDEX IF NOT EXISTS idx_businesses_slug ON public.businesses(slug);
CREATE INDEX IF NOT EXISTS idx_businesses_country ON public.businesses(country);
CREATE INDEX IF NOT EXISTS idx_businesses_renewal ON public.businesses(renewal_date);
CREATE INDEX IF NOT EXISTS idx_services_business ON public.services(business_id);
CREATE INDEX IF NOT EXISTS idx_appointments_business ON public.appointments(business_id);
CREATE INDEX IF NOT EXISTS idx_appointments_starts ON public.appointments(business_id, starts_at);
CREATE INDEX IF NOT EXISTS idx_appointments_status ON public.appointments(status);

-- ---------------------------------------------------------------------------
-- Updated_at trigger
-- ---------------------------------------------------------------------------

CREATE OR REPLACE FUNCTION public.set_updated_at()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_admins_updated ON public.admins;
CREATE TRIGGER trg_admins_updated
  BEFORE UPDATE ON public.admins
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

DROP TRIGGER IF EXISTS trg_businesses_updated ON public.businesses;
CREATE TRIGGER trg_businesses_updated
  BEFORE UPDATE ON public.businesses
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

DROP TRIGGER IF EXISTS trg_services_updated ON public.services;
CREATE TRIGGER trg_services_updated
  BEFORE UPDATE ON public.services
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

DROP TRIGGER IF EXISTS trg_settings_updated ON public.business_settings;
CREATE TRIGGER trg_settings_updated
  BEFORE UPDATE ON public.business_settings
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

DROP TRIGGER IF EXISTS trg_appointments_updated ON public.appointments;
CREATE TRIGGER trg_appointments_updated
  BEFORE UPDATE ON public.appointments
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- ---------------------------------------------------------------------------
-- Auto default settings when business is created
-- ---------------------------------------------------------------------------

CREATE OR REPLACE FUNCTION public.create_default_business_settings()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  INSERT INTO public.business_settings (business_id)
  VALUES (NEW.id)
  ON CONFLICT (business_id) DO NOTHING;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_business_defaults ON public.businesses;
CREATE TRIGGER trg_business_defaults
  AFTER INSERT ON public.businesses
  FOR EACH ROW EXECUTE FUNCTION public.create_default_business_settings();

-- ---------------------------------------------------------------------------
-- Renew subscription (+1 month from current renewal_date)
-- ---------------------------------------------------------------------------

CREATE OR REPLACE FUNCTION public.renew_business_subscription(p_business_id UUID)
RETURNS TIMESTAMPTZ
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_new_renewal TIMESTAMPTZ;
BEGIN
  UPDATE public.businesses
  SET
    renewal_date = renewal_date + INTERVAL '1 month',
    is_active = TRUE
  WHERE id = p_business_id
  RETURNING renewal_date INTO v_new_renewal;

  IF v_new_renewal IS NULL THEN
    RAISE EXCEPTION 'Business not found';
  END IF;

  RETURN v_new_renewal;
END;
$$;

REVOKE ALL ON FUNCTION public.renew_business_subscription(UUID) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.renew_business_subscription(UUID) TO service_role;

-- ---------------------------------------------------------------------------
-- Public booking insert (validates slot conflicts server-side)
-- ---------------------------------------------------------------------------

CREATE OR REPLACE FUNCTION public.create_public_appointment(
  p_business_slug TEXT,
  p_service_id UUID,
  p_client_name TEXT,
  p_client_phone TEXT,
  p_starts_at TIMESTAMPTZ
)
RETURNS UUID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_business public.businesses%ROWTYPE;
  v_service public.services%ROWTYPE;
  v_settings public.business_settings%ROWTYPE;
  v_ends_at TIMESTAMPTZ;
  v_buffer INTERVAL;
  v_id UUID;
  v_conflict INT;
BEGIN
  SELECT * INTO v_business
  FROM public.businesses
  WHERE slug = p_business_slug AND is_active = TRUE AND renewal_date >= NOW();

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Business unavailable';
  END IF;

  SELECT * INTO v_service
  FROM public.services
  WHERE id = p_service_id AND business_id = v_business.id AND is_active = TRUE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Service not found';
  END IF;

  SELECT * INTO v_settings
  FROM public.business_settings
  WHERE business_id = v_business.id;

  v_ends_at := p_starts_at + (v_service.duration_minutes || ' minutes')::INTERVAL;
  v_buffer := COALESCE(v_settings.buffer_minutes, 0) * INTERVAL '1 minute';

  IF p_starts_at < NOW() THEN
    RAISE EXCEPTION 'Cannot book in the past';
  END IF;

  SELECT COUNT(*) INTO v_conflict
  FROM public.appointments a
  WHERE a.business_id = v_business.id
    AND a.status <> 'canceled'
    AND tstzrange(a.starts_at - v_buffer, a.ends_at + v_buffer, '[)')
        && tstzrange(p_starts_at, v_ends_at, '[)');

  IF v_conflict > 0 THEN
    RAISE EXCEPTION 'Time slot unavailable';
  END IF;

  INSERT INTO public.appointments (
    business_id, service_id, client_name, client_phone, starts_at, ends_at, status
  )
  VALUES (
    v_business.id, v_service.id, TRIM(p_client_name), TRIM(p_client_phone),
    p_starts_at, v_ends_at, 'upcoming'
  )
  RETURNING id INTO v_id;

  RETURN v_id;
END;
$$;

REVOKE ALL ON FUNCTION public.create_public_appointment(TEXT, UUID, TEXT, TEXT, TIMESTAMPTZ) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.create_public_appointment(TEXT, UUID, TEXT, TEXT, TIMESTAMPTZ) TO anon, authenticated, service_role;

-- ---------------------------------------------------------------------------
-- Public-safe views (no password hashes / no client PII)
-- ---------------------------------------------------------------------------

CREATE OR REPLACE VIEW public.public_businesses AS
SELECT
  id,
  trade_name,
  business_type,
  country,
  currency,
  timezone,
  phone,
  slug,
  is_active,
  renewal_date
FROM public.businesses
WHERE is_active = TRUE AND renewal_date >= NOW();

CREATE OR REPLACE VIEW public.public_busy_slots AS
SELECT
  business_id,
  starts_at,
  ends_at,
  status
FROM public.appointments
WHERE status <> 'canceled';

-- ---------------------------------------------------------------------------
-- Row Level Security
-- ---------------------------------------------------------------------------

ALTER TABLE public.admins ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.businesses ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.services ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.business_settings ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.appointments ENABLE ROW LEVEL SECURITY;

-- Admins: no public access
DROP POLICY IF EXISTS admins_no_public ON public.admins;
CREATE POLICY admins_no_public ON public.admins
  FOR ALL TO anon, authenticated
  USING (false)
  WITH CHECK (false);

-- Businesses: block direct table access for anon (use public_businesses view + service_role)
DROP POLICY IF EXISTS businesses_public_select ON public.businesses;
DROP POLICY IF EXISTS businesses_no_public_write ON public.businesses;
DROP POLICY IF EXISTS businesses_no_public_update ON public.businesses;
DROP POLICY IF EXISTS businesses_no_public_delete ON public.businesses;
CREATE POLICY businesses_deny_all ON public.businesses
  FOR ALL TO anon, authenticated
  USING (false)
  WITH CHECK (false);

-- Services: public may read active services (server still uses service_role)
DROP POLICY IF EXISTS services_public_select ON public.services;
CREATE POLICY services_public_select ON public.services
  FOR SELECT TO anon, authenticated
  USING (is_active = TRUE);

DROP POLICY IF EXISTS services_no_public_insert ON public.services;
DROP POLICY IF EXISTS services_no_public_update ON public.services;
DROP POLICY IF EXISTS services_no_public_delete ON public.services;
CREATE POLICY services_no_public_insert ON public.services
  FOR INSERT TO anon, authenticated WITH CHECK (false);
CREATE POLICY services_no_public_update ON public.services
  FOR UPDATE TO anon, authenticated USING (false);
CREATE POLICY services_no_public_delete ON public.services
  FOR DELETE TO anon, authenticated USING (false);

-- Settings: public read for optional client-side slot calculation
DROP POLICY IF EXISTS settings_public_select ON public.business_settings;
CREATE POLICY settings_public_select ON public.business_settings
  FOR SELECT TO anon, authenticated
  USING (true);

DROP POLICY IF EXISTS settings_no_public_insert ON public.business_settings;
DROP POLICY IF EXISTS settings_no_public_update ON public.business_settings;
DROP POLICY IF EXISTS settings_no_public_delete ON public.business_settings;
CREATE POLICY settings_no_public_insert ON public.business_settings
  FOR INSERT TO anon, authenticated WITH CHECK (false);
CREATE POLICY settings_no_public_update ON public.business_settings
  FOR UPDATE TO anon, authenticated USING (false);
CREATE POLICY settings_no_public_delete ON public.business_settings
  FOR DELETE TO anon, authenticated USING (false);

-- Appointments: deny direct public access (PII). Busy times via public_busy_slots;
-- inserts via create_public_appointment SECURITY DEFINER.
DROP POLICY IF EXISTS appointments_public_select ON public.appointments;
DROP POLICY IF EXISTS appointments_no_public_insert ON public.appointments;
DROP POLICY IF EXISTS appointments_no_public_update ON public.appointments;
DROP POLICY IF EXISTS appointments_no_public_delete ON public.appointments;
CREATE POLICY appointments_deny_all ON public.appointments
  FOR ALL TO anon, authenticated
  USING (false)
  WITH CHECK (false);

-- ---------------------------------------------------------------------------
-- Seed default master admin (username: admin / password: admin)
-- bcrypt hash generated with cost 10 for "admin"
-- ---------------------------------------------------------------------------

INSERT INTO public.admins (username, password_hash)
VALUES (
  'admin',
  '$2b$10$ERv5T3Dkpk6d0wTADU5KQedFyBBqIW0VLorBy/MgzXrkyNs31UeBq'
)
ON CONFLICT (username) DO NOTHING;

-- ---------------------------------------------------------------------------
-- Grants
-- ---------------------------------------------------------------------------

GRANT USAGE ON SCHEMA public TO anon, authenticated, service_role;

REVOKE ALL ON TABLE public.admins FROM anon, authenticated;
REVOKE ALL ON TABLE public.businesses FROM anon, authenticated;
REVOKE ALL ON TABLE public.appointments FROM anon, authenticated;

GRANT SELECT ON public.public_businesses TO anon, authenticated;
GRANT SELECT ON public.public_busy_slots TO anon, authenticated;
GRANT SELECT ON public.services TO anon, authenticated;
GRANT SELECT ON public.business_settings TO anon, authenticated;
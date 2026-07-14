-- =============================================================
-- Tattoo CRM — Supabase Schema
-- Ejecutar en el SQL Editor de Supabase (https://supabase.com)
-- =============================================================

-- 1. Crear la tabla de clientes
CREATE TABLE IF NOT EXISTS public.clients (
    id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id         UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    first_name      TEXT NOT NULL DEFAULT '',
    last_name       TEXT NOT NULL DEFAULT '',
    email           TEXT NOT NULL DEFAULT '',
    phone           TEXT NOT NULL DEFAULT '',
    city            TEXT NOT NULL DEFAULT '',
    state           TEXT NOT NULL DEFAULT '',
    zip             TEXT NOT NULL DEFAULT '',
    country         TEXT NOT NULL DEFAULT 'US',
    tattoo_price    INTEGER NOT NULL DEFAULT 0,
    deposit         INTEGER NOT NULL DEFAULT 1000,
    material_cost   INTEGER NOT NULL DEFAULT 0,
    appointment_date DATE,
    status          TEXT NOT NULL DEFAULT 'adelanto_pagado'
                    CHECK (status IN ('adelanto_pagado', 'completado')),
    capi_status     TEXT CHECK (capi_status IN ('enviado', 'no_enviado')),
    tattoo_description TEXT NOT NULL DEFAULT '',
    meta_lead_id    TEXT,                        -- Meta Lead Gen ID (15-17 dígitos)
    created_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at      TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- 2. Índices
CREATE INDEX IF NOT EXISTS idx_clients_user_id ON public.clients(user_id);
CREATE INDEX IF NOT EXISTS idx_clients_status ON public.clients(status);
CREATE INDEX IF NOT EXISTS idx_clients_capi ON public.clients(status, capi_status);

-- 3. Trigger: actualizar updated_at automáticamente
CREATE OR REPLACE FUNCTION public.update_updated_at()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = now();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trg_clients_updated_at
    BEFORE UPDATE ON public.clients
    FOR EACH ROW
    EXECUTE FUNCTION public.update_updated_at();

-- 4. Trigger: cuando status cambia a 'completado', poner capi_status = 'no_enviado'
CREATE OR REPLACE FUNCTION public.set_capi_pending()
RETURNS TRIGGER AS $$
BEGIN
    IF NEW.status = 'completado' AND OLD.status != 'completado' THEN
        NEW.capi_status = 'no_enviado';
    END IF;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trg_clients_capi_pending
    BEFORE UPDATE ON public.clients
    FOR EACH ROW
    EXECUTE FUNCTION public.set_capi_pending();

-- 5. Row Level Security (RLS)
ALTER TABLE public.clients ENABLE ROW LEVEL SECURITY;

-- Política: cada usuario solo ve sus propios clientes
CREATE POLICY "Users can view own clients"
    ON public.clients FOR SELECT
    USING (auth.uid() = user_id);

-- Política: cada usuario solo inserta con su propio user_id
CREATE POLICY "Users can insert own clients"
    ON public.clients FOR INSERT
    WITH CHECK (auth.uid() = user_id);

-- Política: cada usuario solo actualiza sus propios clientes
CREATE POLICY "Users can update own clients"
    ON public.clients FOR UPDATE
    USING (auth.uid() = user_id);

-- Política: cada usuario solo elimina sus propios clientes
CREATE POLICY "Users can delete own clients"
    ON public.clients FOR DELETE
    USING (auth.uid() = user_id);

-- =============================================================
-- Migraciones posteriores (ejecutar secuencialmente)
-- =============================================================

-- Migración 1: Agregar meta_lead_id (Qualified Leads CRM integration)
-- ALTER TABLE public.clients ADD COLUMN IF NOT EXISTS meta_lead_id TEXT;

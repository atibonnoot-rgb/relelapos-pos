-- ====================================================================
-- RELELAPOS CLOUD DATABASE SCHEMA FOR SUPABASE
-- Run this in your Supabase SQL Editor (Dashboard -> SQL Editor -> New Query -> Run)
-- ====================================================================

-- 1. ORDERS TABLE
CREATE TABLE IF NOT EXISTS public.orders (
    id TEXT PRIMARY KEY,
    token_number INTEGER,
    order_type TEXT DEFAULT 'Dine-In',
    table_number TEXT,
    items JSONB NOT NULL DEFAULT '[]'::jsonb,
    item_count INTEGER DEFAULT 0,
    subtotal NUMERIC(10,2) DEFAULT 0,
    discount NUMERIC(10,2) DEFAULT 0,
    cgst NUMERIC(10,2) DEFAULT 0,
    sgst NUMERIC(10,2) DEFAULT 0,
    tax NUMERIC(10,2) DEFAULT 0,
    total NUMERIC(10,2) NOT NULL DEFAULT 0,
    payment_method TEXT DEFAULT 'UPI',
    payment_status TEXT DEFAULT 'Paid',
    order_status TEXT DEFAULT 'New',
    customer JSONB DEFAULT '{}'::jsonb,
    special_note TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- 2. PRINT JOBS TABLE (Hardware Thermal Printer Queue)
CREATE TABLE IF NOT EXISTS public.print_jobs (
    job_id TEXT PRIMARY KEY,
    order_id TEXT NOT NULL,
    token_number TEXT,
    status TEXT NOT NULL DEFAULT 'PENDING',
    claimed_by TEXT,
    claimed_at TIMESTAMPTZ,
    claim_expires_at TIMESTAMPTZ,
    printed_at TIMESTAMPTZ,
    printed_by TEXT,
    attempts INTEGER DEFAULT 0,
    raw_order JSONB,
    customer_receipt_text TEXT,
    kot_text TEXT,
    customer_escpos_base64 TEXT,
    kot_escpos_base64 TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_print_jobs_status ON public.print_jobs (status, created_at);

-- 3. APP CONFIG TABLE (Dynamic Menu, Banners, Store Info, Shift Finances)
CREATE TABLE IF NOT EXISTS public.app_config (
    key TEXT PRIMARY KEY,
    value JSONB NOT NULL,
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- 4. ROW LEVEL SECURITY (RLS) POLICIES
ALTER TABLE public.orders ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.print_jobs ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.app_config ENABLE ROW LEVEL SECURITY;

-- Allow access via Anon / Service Key
DROP POLICY IF EXISTS "Allow public read on orders" ON public.orders;
DROP POLICY IF EXISTS "Allow public insert on orders" ON public.orders;
DROP POLICY IF EXISTS "Allow public update on orders" ON public.orders;
DROP POLICY IF EXISTS "Allow public delete on orders" ON public.orders;

CREATE POLICY "Allow public read on orders" ON public.orders FOR SELECT USING (true);
CREATE POLICY "Allow public insert on orders" ON public.orders FOR INSERT WITH CHECK (true);
CREATE POLICY "Allow public update on orders" ON public.orders FOR UPDATE USING (true);
CREATE POLICY "Allow public delete on orders" ON public.orders FOR DELETE USING (true);

DROP POLICY IF EXISTS "Allow public all on print_jobs" ON public.print_jobs;
CREATE POLICY "Allow public all on print_jobs" ON public.print_jobs FOR ALL USING (true);

DROP POLICY IF EXISTS "Allow public all on app_config" ON public.app_config;
CREATE POLICY "Allow public all on app_config" ON public.app_config FOR ALL USING (true);

-- 5. ENABLE REALTIME (Safely wrapped so script succeeds even if publication is already enabled or handled via Dashboard)
DO $$
BEGIN
    ALTER PUBLICATION supabase_realtime ADD TABLE public.orders;
EXCEPTION WHEN OTHERS THEN
    RAISE NOTICE 'Notice: Realtime on orders skipped or already present: %', SQLERRM;
END $$;

DO $$
BEGIN
    ALTER PUBLICATION supabase_realtime ADD TABLE public.print_jobs;
EXCEPTION WHEN OTHERS THEN
    RAISE NOTICE 'Notice: Realtime on print_jobs skipped or already present: %', SQLERRM;
END $$;

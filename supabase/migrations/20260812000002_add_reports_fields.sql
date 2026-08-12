-- Agregar columnas status, moderator_notes y evidence_url a la tabla product_reports
ALTER TABLE public.product_reports 
ADD COLUMN IF NOT EXISTS status VARCHAR(20) NOT NULL DEFAULT 'pending',
ADD COLUMN IF NOT EXISTS moderator_notes TEXT,
ADD COLUMN IF NOT EXISTS evidence_url TEXT;

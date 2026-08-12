-- 1. CREAR TABLA: product_reports
CREATE TABLE public.product_reports (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    product_id UUID NOT NULL REFERENCES public.products(id) ON DELETE CASCADE,
    reporter_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
    reason TEXT NOT NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- 2. HABILITAR SEGURIDAD A NIVEL DE FILA (RLS)
ALTER TABLE public.product_reports ENABLE ROW LEVEL SECURITY;

-- 3. POLÍTICAS DE ACCESO RLS
-- Permitir insertar reportes a cualquier usuario autenticado (bajo su propio reporter_id)
CREATE POLICY "Permitir insertar reportes a usuarios autenticados"
ON public.product_reports
FOR INSERT
TO authenticated
WITH CHECK (auth.uid() = reporter_id);

-- Permitir consultar reportes únicamente a administradores
CREATE POLICY "Permitir ver reportes solo a administradores"
ON public.product_reports
FOR SELECT
TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM public.profiles
    WHERE profiles.id = auth.uid() AND profiles.role = 'admin'
  )
);

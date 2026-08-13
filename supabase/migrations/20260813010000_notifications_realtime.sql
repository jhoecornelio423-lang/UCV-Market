-- ========================================================
-- NOTIFICACIONES EN TIEMPO REAL + REPORTES
-- 1) RLS product_reports: admin UPDATE/DELETE, reporter SELECT propio
-- 2) Un solo reporte por producto + reporter (constraint único)
-- 3) REPLICA IDENTITY FULL: realtime entrega valores viejos en UPDATE
-- 4) Publicación realtime garantizada para orders y product_reports
-- ========================================================

-- 1. POLÍTICAS RLS product_reports (idempotente: drop + create)

-- UPDATE: solo administradores (resolver/rechazar reportes)
DROP POLICY IF EXISTS "Permitir gestionar reportes solo a administradores" ON public.product_reports;
DROP POLICY IF EXISTS "Admins actualizan reportes" ON public.product_reports;
CREATE POLICY "Admins actualizan reportes"
ON public.product_reports FOR UPDATE
TO authenticated
USING (
  EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid() AND role = 'admin')
)
WITH CHECK (
  EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid() AND role = 'admin')
);

-- DELETE: solo administradores (descartar reportes)
DROP POLICY IF EXISTS "Permitir eliminar reportes solo a administradores" ON public.product_reports;
DROP POLICY IF EXISTS "Admins eliminan reportes" ON public.product_reports;
CREATE POLICY "Admins eliminan reportes"
ON public.product_reports FOR DELETE
TO authenticated
USING (
  EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid() AND role = 'admin')
);

-- SELECT: el reporter puede ver el estado de sus propios reportes (notificaciones)
DROP POLICY IF EXISTS "Reporter ve sus propios reportes" ON public.product_reports;
CREATE POLICY "Reporter ve sus propios reportes"
ON public.product_reports FOR SELECT
TO authenticated
USING (auth.uid() = reporter_id);

-- 2. UN SOLO REPORTE POR PRODUCTO + REPORTER
-- Limpiar duplicados existentes dejando el más reciente
DELETE FROM public.product_reports pr
USING public.product_reports pr2
WHERE pr.id <> pr2.id
  AND pr.product_id = pr2.product_id
  AND pr.reporter_id = pr2.reporter_id
  AND pr.created_at < pr2.created_at;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'product_reports_product_reporter_unique'
  ) THEN
    ALTER TABLE public.product_reports
      ADD CONSTRAINT product_reports_product_reporter_unique UNIQUE (product_id, reporter_id);
  END IF;
END $$;

-- 3. REPLICA IDENTITY FULL: realtime entrega los valores viejos en los UPDATE
ALTER TABLE public.orders REPLICA IDENTITY FULL;
ALTER TABLE public.product_reports REPLICA IDENTITY FULL;

-- 4. Garantizar publicación realtime (idempotente)
DO $$
BEGIN
  ALTER PUBLICATION supabase_realtime ADD TABLE public.orders;
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$
BEGIN
  ALTER PUBLICATION supabase_realtime ADD TABLE public.product_reports;
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

-- 5. Refuerzo idempotente: admin puede gestionar productos (ocultar/eliminar)
DROP POLICY IF EXISTS "Admins gestionan todos los productos" ON public.products;
CREATE POLICY "Admins gestionan todos los productos"
ON public.products FOR ALL
TO authenticated
USING (
  EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid() AND role = 'admin')
)
WITH CHECK (
  EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid() AND role = 'admin')
);

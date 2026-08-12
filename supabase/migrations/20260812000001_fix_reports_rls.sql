-- Corregir políticas RLS para inserción y selección en product_reports
DROP POLICY IF EXISTS "Permitir insertar reportes a usuarios autenticados" ON public.product_reports;
DROP POLICY IF EXISTS "Permitir ver reportes solo a administradores" ON public.product_reports;

-- Nueva política de inserción
CREATE POLICY "Permitir insertar reportes a usuarios autenticados"
ON public.product_reports
FOR INSERT
TO authenticated
WITH CHECK (true);

-- Nueva política de selección
CREATE POLICY "Permitir ver reportes a usuarios autenticados"
ON public.product_reports
FOR SELECT
TO authenticated
USING (true);

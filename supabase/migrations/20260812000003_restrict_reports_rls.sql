-- Corregir RLS de product_reports:
--  - INSERT: cada usuario autenticado solo reporta bajo su propio reporter_id
--  - SELECT/UPDATE/DELETE: solo administradores pueden ver y gestionar reportes
DROP POLICY IF EXISTS "Permitir ver reportes a usuarios autenticados" ON public.product_reports;
DROP POLICY IF EXISTS "Permitir insertar reportes a usuarios autenticados" ON public.product_reports;

-- Política de inserción: el reporter debe ser el propio usuario
CREATE POLICY "Permitir insertar reportes a usuarios autenticados"
ON public.product_reports
FOR INSERT
TO authenticated
WITH CHECK (auth.uid() = reporter_id);

-- Política de selección: solo administradores
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

-- Política de actualización: solo administradores (resolver/rechazar reportes)
CREATE POLICY "Permitir gestionar reportes solo a administradores"
ON public.product_reports
FOR UPDATE
TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM public.profiles
    WHERE profiles.id = auth.uid() AND profiles.role = 'admin'
  )
);

-- Política de eliminación: solo administradores (descartar reportes)
CREATE POLICY "Permitir eliminar reportes solo a administradores"
ON public.product_reports
FOR DELETE
TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM public.profiles
    WHERE profiles.id = auth.uid() AND profiles.role = 'admin'
  )
);

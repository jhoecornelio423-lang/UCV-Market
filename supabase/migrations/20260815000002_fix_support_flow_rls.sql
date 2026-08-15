-- ============================================================
-- CORRECCIÓN DEL FLUJO DE SOPORTE / DISPUTAS (RLS)
-- ============================================================
-- Objetivos:
--  1. El comprador y el vendedor SOLO ven sus propios tickets
--     (user_id o seller_id) y el admin todos.
--  2. Las ADVERTENCIAS y acciones administrativas SÍ son visibles
--     para las partes de la disputa (antes se ocultaban).
--  3. El aislamiento de hilos (buyer/seller) se mantiene estricto:
--     cada parte solo lee su hilo y nunca el de la otra.
-- Idempotente: se puede re-ejecutar sin errores.
-- ============================================================

-- ============================================================
-- 1. SUPPORT_TICKETS
-- ============================================================
ALTER TABLE public.support_tickets ENABLE ROW LEVEL SECURITY;

-- Limpia políticas legadas (nombres antiguos en inglés y español)
DROP POLICY IF EXISTS "Users can view their own tickets" ON public.support_tickets;
DROP POLICY IF EXISTS "Users can create tickets" ON public.support_tickets;
DROP POLICY IF EXISTS "Admins can view all tickets" ON public.support_tickets;
DROP POLICY IF EXISTS "Admins can update all tickets" ON public.support_tickets;
DROP POLICY IF EXISTS "Usuarios ven sus propios tickets" ON public.support_tickets;
DROP POLICY IF EXISTS "Usuarios crean sus propios tickets" ON public.support_tickets;
DROP POLICY IF EXISTS "Admins gestionan tickets" ON public.support_tickets;

-- SELECT: el participante (comprador o vendedor vinculado) y el admin.
CREATE POLICY "Usuarios ven sus propios tickets"
ON public.support_tickets FOR SELECT TO authenticated
USING (
  auth.uid() = user_id
  OR auth.uid() = seller_id
  OR EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid() AND role = 'admin')
);

-- INSERT: el usuario solo crea tickets bajo su propio user_id.
CREATE POLICY "Usuarios crean sus propios tickets"
ON public.support_tickets FOR INSERT TO authenticated
WITH CHECK (auth.uid() = user_id);

-- UPDATE: solo el admin gestiona el ticket (estado, prioridad, vínculos).
CREATE POLICY "Admins gestionan tickets"
ON public.support_tickets FOR UPDATE TO authenticated
USING (EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid() AND role = 'admin'));

-- ============================================================
-- 2. SUPPORT_MESSAGES (aislamiento estricto por hilo)
-- ============================================================
ALTER TABLE public.support_messages ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Lectura de mensajes de disputa" ON public.support_messages;
DROP POLICY IF EXISTS "Insertar mensajes de disputa" ON public.support_messages;
DROP POLICY IF EXISTS "Admin edita historial de soporte" ON public.support_messages;
DROP POLICY IF EXISTS "Admin borra historial de soporte" ON public.support_messages;

-- SELECT: el admin ve todo; un participante ve los mensajes de SU hilo
-- (los suyos + las respuestas del admin dirigidas a su hilo).
CREATE POLICY "Lectura de mensajes de disputa"
ON public.support_messages FOR SELECT TO authenticated
USING (
  EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid() AND role = 'admin')
  OR (
    EXISTS (
      SELECT 1 FROM public.support_tickets t
      WHERE t.id = ticket_id AND auth.uid() IN (t.user_id, t.seller_id)
    )
    AND thread = CASE
      WHEN auth.uid() = (SELECT user_id FROM public.support_tickets WHERE id = ticket_id) THEN 'buyer'
      WHEN auth.uid() = (SELECT seller_id FROM public.support_tickets WHERE id = ticket_id) THEN 'seller'
    END
    AND (participant_id = auth.uid() OR sender_role = 'admin')
  )
);

-- INSERT: el admin escribe a cualquier hilo; el usuario solo escribe
-- como sí mismo en su propio hilo y en tickets activos.
CREATE POLICY "Insertar mensajes de disputa"
ON public.support_messages FOR INSERT TO authenticated
WITH CHECK (
  EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid() AND role = 'admin')
  OR (
    participant_id = auth.uid()
    AND sender_role = thread
    AND thread = CASE
      WHEN auth.uid() = (SELECT user_id FROM public.support_tickets WHERE id = ticket_id) THEN 'buyer'
      WHEN auth.uid() = (SELECT seller_id FROM public.support_tickets WHERE id = ticket_id) THEN 'seller'
    END
    AND EXISTS (
      SELECT 1 FROM public.support_tickets
      WHERE id = ticket_id AND status NOT IN ('closed', 'rejected')
    )
  )
);

-- UPDATE/DELETE: solo el admin (historial).
CREATE POLICY "Admin edita historial de soporte"
ON public.support_messages FOR UPDATE TO authenticated
USING (EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid() AND role = 'admin'))
WITH CHECK (EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid() AND role = 'admin'));

CREATE POLICY "Admin borra historial de soporte"
ON public.support_messages FOR DELETE TO authenticated
USING (EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid() AND role = 'admin'));

-- ============================================================
-- 3. SUPPORT_EVENTS: las partes ven TODO el historial de su disputa
--    (incluidas advertencias, vínculos y baneos).
-- ============================================================
ALTER TABLE public.support_events ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Ver eventos de disputa" ON public.support_events;
DROP POLICY IF EXISTS "Admin registra eventos de disputa" ON public.support_events;

CREATE POLICY "Ver eventos de disputa"
ON public.support_events FOR SELECT TO authenticated
USING (
  EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid() AND role = 'admin')
  OR EXISTS (
    SELECT 1 FROM public.support_tickets t
    WHERE t.id = ticket_id AND auth.uid() IN (t.user_id, t.seller_id)
  )
);

-- INSERT: solo el admin registra eventos.
CREATE POLICY "Admin registra eventos de disputa"
ON public.support_events FOR INSERT TO authenticated
WITH CHECK (EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid() AND role = 'admin'));

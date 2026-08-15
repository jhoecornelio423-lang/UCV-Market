-- ============================================================
-- PRIVACIDAD ESTRICTA DE HILOS DE SOPORTE
-- Refuerza el aislamiento: el comprador SOLO lee los mensajes
-- dirigidos a él (participant_id = auth.uid()) en SU hilo, y el
-- vendedor solo los suyos. El admin ve todo.
-- Se re-crean las políticas para garantizar que la versión
-- desplegada sea esta (idempotente, se puede re-ejecutar).
-- ============================================================

ALTER TABLE public.support_messages ENABLE ROW LEVEL SECURITY;

-- El usuario solo ve mensajes donde él es el participante (sus
-- propios mensajes y las respuestas del admin dirigidas a él),
-- y SOLO dentro de su propio hilo. El admin ve todos.
DROP POLICY IF EXISTS "Lectura de mensajes de disputa" ON public.support_messages;
CREATE POLICY "Lectura de mensajes de disputa"
ON public.support_messages FOR SELECT TO authenticated
USING (
  EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid() AND role = 'admin')
  OR (
    participant_id = auth.uid()
    AND thread = CASE
      WHEN auth.uid() = (SELECT user_id FROM public.support_tickets WHERE id = ticket_id) THEN 'buyer'
      WHEN auth.uid() = (SELECT seller_id FROM public.support_tickets WHERE id = ticket_id) THEN 'seller'
    END
  )
);

-- Inserciones: el admin envía a cualquier participante; el usuario
-- solo escribe como sí mismo (participant_id propio, sender_role
-- coherente con su hilo) y solo en tickets activos.
DROP POLICY IF EXISTS "Insertar mensajes de disputa" ON public.support_messages;
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

-- Seguridad adicional: nadie (ni admin) puede MODIFICAR o BORRAR
-- mensajes ya enviados, salvo el admin gestiona el historial.
DROP POLICY IF EXISTS "Admin edita historial de soporte" ON public.support_messages;
CREATE POLICY "Admin edita historial de soporte"
ON public.support_messages FOR UPDATE TO authenticated
USING (EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid() AND role = 'admin'))
WITH CHECK (EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid() AND role = 'admin'));

DROP POLICY IF EXISTS "Admin borra historial de soporte" ON public.support_messages;
CREATE POLICY "Admin borra historial de soporte"
ON public.support_messages FOR DELETE TO authenticated
USING (EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid() AND role = 'admin'));

-- ============================================================
-- AISLAR TAMBIÉN LA LECTURA DE EVENTOS
-- El participante solo ve los eventos de SU hilo; el admin todos.
-- ============================================================
ALTER TABLE public.support_events ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Ver eventos de disputa" ON public.support_events;
CREATE POLICY "Ver eventos de disputa"
ON public.support_events FOR SELECT TO authenticated
USING (
  EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid() AND role = 'admin')
  OR EXISTS (
    SELECT 1 FROM public.support_tickets t
    WHERE t.id = ticket_id AND auth.uid() IN (t.user_id, t.seller_id)
  )
);

DROP POLICY IF EXISTS "Admin registra eventos de disputa" ON public.support_events;
CREATE POLICY "Admin registra eventos de disputa"
ON public.support_events FOR INSERT TO authenticated
WITH CHECK (EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid() AND role = 'admin'));

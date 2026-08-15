-- ============================================================
-- CENTRO DE DISPUTAS: conversaciones separadas (Admin <-> Comprador,
-- Admin <-> Vendedor), códigos de ticket, prioridades, eventos y
-- acciones administrativas. El comprador y el vendedor NUNCA se
-- comunican directamente.
-- ============================================================

-- ============================================================
-- 1. EXTENDER support_tickets
-- ============================================================
ALTER TABLE public.support_tickets
  ADD COLUMN IF NOT EXISTS ticket_code TEXT,
  ADD COLUMN IF NOT EXISTS priority TEXT NOT NULL DEFAULT 'medio'
    CHECK (priority IN ('alto', 'medio', 'critico')),
  ADD COLUMN IF NOT EXISTS seller_id UUID REFERENCES public.profiles(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS order_id UUID REFERENCES public.orders(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS idx_support_tickets_seller ON public.support_tickets(seller_id);

-- Ampliar los estados posibles (rejected = desestimada)
ALTER TABLE public.support_tickets DROP CONSTRAINT IF EXISTS support_tickets_status_check;
ALTER TABLE public.support_tickets ADD CONSTRAINT support_tickets_status_check
  CHECK (status IN ('open', 'in_progress', 'in_review', 'waiting_buyer', 'waiting_seller',
                    'evidence_received', 'resolved', 'rejected', 'closed'));

-- Código de ticket TKT-XXXX (secuencia)
CREATE SEQUENCE IF NOT EXISTS support_ticket_code_seq;

CREATE OR REPLACE FUNCTION public.assign_support_ticket_code()
RETURNS TRIGGER LANGUAGE plpgsql AS $$
BEGIN
  IF NEW.ticket_code IS NULL THEN
    NEW.ticket_code := 'TKT-' || lpad(nextval('support_ticket_code_seq')::text, 4, '0');
  END IF;
  RETURN NEW;
END $$;

DROP TRIGGER IF EXISTS trg_support_ticket_code ON public.support_tickets;
CREATE TRIGGER trg_support_ticket_code
  BEFORE INSERT ON public.support_tickets
  FOR EACH ROW EXECUTE FUNCTION public.assign_support_ticket_code();

-- ============================================================
-- 2. Código de transacción TXN-XXXX en orders
-- ============================================================
ALTER TABLE public.orders ADD COLUMN IF NOT EXISTS order_code TEXT;

CREATE SEQUENCE IF NOT EXISTS order_code_seq;

CREATE OR REPLACE FUNCTION public.assign_order_code()
RETURNS TRIGGER LANGUAGE plpgsql AS $$
BEGIN
  IF NEW.order_code IS NULL THEN
    NEW.order_code := 'TXN-' || lpad(nextval('order_code_seq')::text, 4, '0');
  END IF;
  RETURN NEW;
END $$;

DROP TRIGGER IF EXISTS trg_order_code ON public.orders;
CREATE TRIGGER trg_order_code
  BEFORE INSERT ON public.orders
  FOR EACH ROW EXECUTE FUNCTION public.assign_order_code();

-- ============================================================
-- 3. TABLA: support_messages (hilos separados por participante)
-- ============================================================
CREATE TABLE IF NOT EXISTS public.support_messages (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  ticket_id UUID NOT NULL REFERENCES public.support_tickets(id) ON DELETE CASCADE,
  participant_id UUID REFERENCES public.profiles(id) ON DELETE SET NULL,
  sender_role TEXT NOT NULL CHECK (sender_role IN ('admin', 'buyer', 'seller')),
  thread TEXT NOT NULL DEFAULT 'buyer' CHECK (thread IN ('buyer', 'seller')),
  body TEXT NOT NULL,
  read_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_support_messages_ticket ON public.support_messages(ticket_id, created_at);
CREATE INDEX IF NOT EXISTS idx_support_messages_participant ON public.support_messages(participant_id);

ALTER TABLE public.support_messages ENABLE ROW LEVEL SECURITY;

-- El admin ve todos los mensajes; un participante SOLO ve su hilo.
DROP POLICY IF EXISTS "Lectura de mensajes de disputa" ON public.support_messages;
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
    AND (sender_role = 'admin' OR participant_id = auth.uid())
  )
);

-- Solo el admin o el participante de su propio hilo pueden insertar.
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

-- ============================================================
-- 4. TABLA: support_events (historial administrativo de la disputa)
-- ============================================================
CREATE TABLE IF NOT EXISTS public.support_events (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  ticket_id UUID NOT NULL REFERENCES public.support_tickets(id) ON DELETE CASCADE,
  event_type TEXT NOT NULL,
  description TEXT NOT NULL,
  created_by UUID REFERENCES public.profiles(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_support_events_ticket ON public.support_events(ticket_id, created_at);

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

-- ============================================================
-- 5. TABLA: profile_warnings (advertencias al emprendedor)
-- ============================================================
CREATE TABLE IF NOT EXISTS public.profile_warnings (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  profile_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  reason TEXT NOT NULL,
  ticket_id UUID REFERENCES public.support_tickets(id) ON DELETE SET NULL,
  created_by UUID REFERENCES public.profiles(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_profile_warnings_profile ON public.profile_warnings(profile_id);

ALTER TABLE public.profile_warnings ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Admin gestiona advertencias" ON public.profile_warnings;
CREATE POLICY "Admin gestiona advertencias"
ON public.profile_warnings FOR ALL TO authenticated
USING (EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid() AND role = 'admin'))
WITH CHECK (EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid() AND role = 'admin'));

-- ============================================================
-- 6. RLS: el vendedor vinculado también ve el ticket
-- ============================================================
DROP POLICY IF EXISTS "Usuarios ven sus propios tickets" ON public.support_tickets;
CREATE POLICY "Usuarios ven sus propios tickets"
ON public.support_tickets FOR SELECT TO authenticated
USING (
  auth.uid() = user_id
  OR auth.uid() = seller_id
  OR EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid() AND role = 'admin')
);

-- ============================================================
-- 7. Al crear un ticket se siembran el primer mensaje y el evento
-- ============================================================
CREATE OR REPLACE FUNCTION public.seed_support_thread()
RETURNS TRIGGER LANGUAGE plpgsql SECURITY DEFINER AS $$
BEGIN
  INSERT INTO public.support_messages (ticket_id, participant_id, sender_role, thread, body)
  VALUES (NEW.id, NEW.user_id, 'buyer', 'buyer', NEW.message);

  INSERT INTO public.support_events (ticket_id, event_type, description, created_by)
  VALUES (NEW.id, 'created', 'Disputa creada por el comprador', NEW.user_id);

  RETURN NEW;
END $$;

DROP TRIGGER IF EXISTS trg_support_thread_seed ON public.support_tickets;
CREATE TRIGGER trg_support_thread_seed
  AFTER INSERT ON public.support_tickets
  FOR EACH ROW EXECUTE FUNCTION public.seed_support_thread();

-- ============================================================
-- 8. Backfill: códigos, mensajes y eventos de tickets existentes
-- ============================================================
DO $$
DECLARE
  t RECORD;
BEGIN
  FOR t IN SELECT * FROM public.support_tickets WHERE ticket_code IS NULL ORDER BY created_at
  LOOP
    UPDATE public.support_tickets
    SET ticket_code = 'TKT-' || lpad(nextval('support_ticket_code_seq')::text, 4, '0')
    WHERE id = t.id;
  END LOOP;

  FOR t IN SELECT * FROM public.support_tickets
           WHERE id NOT IN (SELECT ticket_id FROM public.support_messages)
  LOOP
    INSERT INTO public.support_messages (ticket_id, participant_id, sender_role, thread, body)
    VALUES (t.id, t.user_id, 'buyer', 'buyer', t.message);

    IF t.admin_reply IS NOT NULL AND length(trim(t.admin_reply)) > 0 THEN
      INSERT INTO public.support_messages (ticket_id, participant_id, sender_role, thread, body)
      VALUES (t.id, NULL, 'admin', 'buyer', t.admin_reply);
    END IF;

    INSERT INTO public.support_events (ticket_id, event_type, description, created_by)
    VALUES (t.id, 'created', 'Disputa creada por el comprador', t.user_id);
  END LOOP;

  FOR t IN SELECT * FROM public.orders WHERE order_code IS NULL ORDER BY created_at
  LOOP
    UPDATE public.orders
    SET order_code = 'TXN-' || lpad(nextval('order_code_seq')::text, 4, '0')
    WHERE id = t.id;
  END LOOP;
END $$;

ALTER TABLE public.support_tickets ALTER COLUMN ticket_code SET NOT NULL;
ALTER TABLE public.orders ALTER COLUMN order_code SET NOT NULL;

-- ============================================================
-- 9. Realtime: el chat y los eventos fluyen a la app
-- ============================================================
ALTER TABLE public.support_messages REPLICA IDENTITY FULL;
ALTER TABLE public.support_events REPLICA IDENTITY FULL;

DO $$
BEGIN
  ALTER PUBLICATION supabase_realtime ADD TABLE public.support_messages;
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$
BEGIN
  ALTER PUBLICATION supabase_realtime ADD TABLE public.support_events;
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

-- ============================================================
-- 10. Webhook -> send-push cuando llega un mensaje nuevo
--     (admin -> participante, y participante -> admins)
-- ============================================================
DO $$
DECLARE
  WEBHOOK_URL constant text := 'https://dqjuifzsowwrrfppczsj.functions.supabase.co/send-push';
  WEBHOOK_SECRET constant text := '94c1ef6a78d3b250';
BEGIN
  DROP TRIGGER IF EXISTS trg_support_message_push ON public.support_messages;
  EXECUTE format($fn$
    CREATE OR REPLACE FUNCTION public.trg_support_message_push_fn()
    RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER AS $body$
    BEGIN
      PERFORM net.http_post(
        url := '%s',
        body := jsonb_build_object(
          'type', 'INSERT',
          'table', 'support_messages',
          'record', to_jsonb(NEW)
        ),
        headers := jsonb_build_object('Content-Type', 'application/json', 'Authorization', '%s'),
        timeout_milliseconds := 5000
      );
      RETURN NEW;
    END $body$;
  $fn$, WEBHOOK_URL, WEBHOOK_SECRET);
  CREATE TRIGGER trg_support_message_push
  AFTER INSERT ON public.support_messages
  FOR EACH ROW EXECUTE FUNCTION public.trg_support_message_push_fn();
END $$;

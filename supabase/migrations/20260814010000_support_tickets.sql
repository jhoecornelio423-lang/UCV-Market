-- ============================================================
-- Flujo de Soporte: tabla support_tickets
-- Comprador y vendedor pueden crear tickets; el admin responde y
-- gestiona el estado. El usuario recibe notificación cuando el
-- equipo responde o resuelve su ticket.
-- ============================================================

-- 1. Tabla (idempotente: no falla si ya existe)
CREATE TABLE IF NOT EXISTS public.support_tickets (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  subject TEXT NOT NULL,
  message TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'open'
    CHECK (status IN ('open', 'in_progress', 'resolved', 'closed')),
  admin_reply TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Columnas de seguridad por si la tabla ya existía sin alguna
ALTER TABLE public.support_tickets
  ADD COLUMN IF NOT EXISTS admin_reply TEXT,
  ADD COLUMN IF NOT EXISTS updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW();

ALTER TABLE public.support_tickets ENABLE ROW LEVEL SECURITY;

CREATE INDEX IF NOT EXISTS idx_support_tickets_user ON public.support_tickets(user_id);

-- 2. RLS (drop + create para poder reintentar sin duplicados)
DROP POLICY IF EXISTS "Usuarios crean sus propios tickets" ON public.support_tickets;
DROP POLICY IF EXISTS "Usuarios ven sus propios tickets" ON public.support_tickets;
DROP POLICY IF EXISTS "Admins gestionan tickets" ON public.support_tickets;

-- El usuario crea tickets bajo su propio user_id
CREATE POLICY "Usuarios crean sus propios tickets"
ON public.support_tickets FOR INSERT TO authenticated
WITH CHECK (auth.uid() = user_id);

-- El usuario ve sus propios tickets; el admin ve todos
CREATE POLICY "Usuarios ven sus propios tickets"
ON public.support_tickets FOR SELECT TO authenticated
USING (
  auth.uid() = user_id
  OR EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid() AND role = 'admin')
);

-- Solo el admin actualiza (estado y respuesta)
CREATE POLICY "Admins gestionan tickets"
ON public.support_tickets FOR UPDATE TO authenticated
USING (
  EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid() AND role = 'admin')
);

-- 3. Trigger updated_at
CREATE OR REPLACE FUNCTION public.set_updated_at()
RETURNS TRIGGER LANGUAGE plpgsql AS $$
BEGIN
  NEW.updated_at := NOW();
  RETURN NEW;
END $$;

DROP TRIGGER IF EXISTS trg_support_tickets_updated_at ON public.support_tickets;
CREATE TRIGGER trg_support_tickets_updated_at
  BEFORE UPDATE ON public.support_tickets
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- 4. Realtime: el usuario recibe en la app cuando cambia su ticket
ALTER TABLE public.support_tickets REPLICA IDENTITY FULL;
DO $$
BEGIN
  ALTER PUBLICATION supabase_realtime ADD TABLE public.support_tickets;
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

-- 5. Webhook -> Edge Function send-push (respuesta/resolución del ticket)
DO $$
DECLARE
  WEBHOOK_URL constant text := 'https://dqjuifzsowwrrfppczsj.functions.supabase.co/send-push';
  WEBHOOK_SECRET constant text := '94c1ef6a78d3b250';
BEGIN
  DROP TRIGGER IF EXISTS trg_support_ticket_push ON public.support_tickets;
  EXECUTE format($fn$
    CREATE OR REPLACE FUNCTION public.trg_support_ticket_push_fn()
    RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER AS $body$
    BEGIN
      IF NEW.status IS DISTINCT FROM OLD.status OR NEW.admin_reply IS DISTINCT FROM OLD.admin_reply THEN
        PERFORM net.http_post(
          url := '%s',
          body := jsonb_build_object(
            'type', 'UPDATE',
            'table', 'support_tickets',
            'record', to_jsonb(NEW),
            'old', to_jsonb(OLD)
          ),
          headers := jsonb_build_object('Content-Type', 'application/json', 'Authorization', '%s'),
          timeout_milliseconds := 5000
        );
      END IF;
      RETURN NEW;
    END $body$;
  $fn$, WEBHOOK_URL, WEBHOOK_SECRET);
  CREATE TRIGGER trg_support_ticket_push
  AFTER UPDATE ON public.support_tickets
  FOR EACH ROW EXECUTE FUNCTION public.trg_support_ticket_push_fn();
END $$;

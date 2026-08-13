-- ========================================================
-- HARDENING PARA PRODUCCIÓN
-- Corrige: escalada de privilegios, suspensión de cuentas,
-- validación de reseñas, RPC de pedidos, visibilidad admin y
-- restauración de stock al cancelar.
-- ========================================================

-- 1. EXTENDER EL ENUM DE ROLES PARA SOPORTAR SUSPENSIÓN
ALTER TYPE public.user_role ADD VALUE IF NOT EXISTS 'suspended';
ALTER TYPE public.user_role ADD VALUE IF NOT EXISTS 'suspended_buyer';

-- 2. NO CONFIAR EN EL ROL ENVIADO POR EL CLIENTE EN EL REGISTRO
-- Todos los usuarios se registran como comprador; el rol se asigna
-- por el flujo de solicitud de emprendedor (admin) o por OAuth.
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER
SECURITY DEFINER
AS $$
BEGIN
    INSERT INTO public.profiles (id, full_name, phone, role, campus, rating_average)
    VALUES (
        NEW.id,
        COALESCE(NEW.raw_user_meta_data->>'full_name', 'Estudiante UCV'),
        COALESCE(NEW.raw_user_meta_data->>'phone', ''),
        'comprador',
        COALESCE(NEW.raw_user_meta_data->>'campus', 'Campus Central'),
        5.00
    );
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- 3. RLS EN profiles: impedir que un usuario cambie su propio rol
-- El WITH CHECK valida que el rol nuevo sea igual al rol actual.
DROP POLICY IF EXISTS "Permitir actualización de perfil propio" ON public.profiles;
CREATE POLICY "Permitir actualización de perfil propio"
ON public.profiles FOR UPDATE
TO authenticated
USING (auth.uid() = id)
WITH CHECK (
  auth.uid() = id
  AND NEW.role = (SELECT role FROM public.profiles WHERE id = auth.uid())
);

-- Permitir que el usuario cree su propio perfil (fallback OAuth)
-- solo con rol comprador; el rol jamás puede venir del cliente.
DROP POLICY IF EXISTS "Usuario crea su propio perfil" ON public.profiles;
CREATE POLICY "Usuario crea su propio perfil"
ON public.profiles FOR INSERT
TO authenticated
WITH CHECK (auth.uid() = id AND NEW.role = 'comprador');

-- Acceso administrativo completo a los perfiles (suspender, aprobar, etc.)
DROP POLICY IF EXISTS "Admins gestionan todos los perfiles" ON public.profiles;
CREATE POLICY "Admins gestionan todos los perfiles"
ON public.profiles FOR ALL
TO authenticated
USING (
  EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid() AND role = 'admin')
)
WITH CHECK (
  EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid() AND role = 'admin')
);

-- 4. ADMIN: visibilidad completa sobre productos y pedidos
-- Sin esto, el panel admin no ve productos inactivos ni calcula ingresos reales.
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

DROP POLICY IF EXISTS "Admins ven todos los pedidos" ON public.orders;
CREATE POLICY "Admins ven todos los pedidos"
ON public.orders FOR ALL
TO authenticated
USING (
  EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid() AND role = 'admin')
)
WITH CHECK (
  EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid() AND role = 'admin')
);

DROP POLICY IF EXISTS "Admins ven todos los items de pedidos" ON public.order_items;
CREATE POLICY "Admins ven todos los items de pedidos"
ON public.order_items FOR SELECT
TO authenticated
USING (
  EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid() AND role = 'admin')
);

DROP POLICY IF EXISTS "Admins ven todos los logs de stock" ON public.stock_logs;
CREATE POLICY "Admins ven todos los logs de stock"
ON public.stock_logs FOR SELECT
TO authenticated
USING (
  EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid() AND role = 'admin')
);

-- 5. RESTAURAR POLÍTICAS SEGURAS DE product_reports
-- (La migración 20260812000001 las relajó a modo temporal.)
DROP POLICY IF EXISTS "Permitir insertar reportes a usuarios autenticados" ON public.product_reports;
CREATE POLICY "Permitir insertar reportes a usuarios autenticados"
ON public.product_reports FOR INSERT
TO authenticated
WITH CHECK (auth.uid() = reporter_id);

DROP POLICY IF EXISTS "Permitir ver reportes a usuarios autenticados" ON public.product_reports;
DROP POLICY IF EXISTS "Permitir ver reportes solo a administradores" ON public.product_reports;
CREATE POLICY "Permitir ver reportes solo a administradores"
ON public.product_reports FOR SELECT
TO authenticated
USING (
  EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid() AND role = 'admin')
);

-- 6. VALIDAR QUE LA RESEÑA SEA PARA EL VENDEDOR REAL DEL PEDIDO
DROP POLICY IF EXISTS "Comprador califica su pedido completado" ON public.reviews;
CREATE POLICY "Comprador califica su pedido completado"
ON public.reviews FOR INSERT
TO authenticated
WITH CHECK (
  auth.uid() = reviewer_id
  AND reviewee_id = (SELECT seller_id FROM public.orders WHERE id = order_id)
  AND EXISTS (
    SELECT 1 FROM public.orders
    WHERE id = order_id AND buyer_id = auth.uid() AND status = 'completed'
  )
);

-- 7. RPC create_order: validar vendedor de cada ítem y que acepte pedidos
CREATE OR REPLACE FUNCTION public.create_order(
  p_seller_id UUID,
  p_delivery_place VARCHAR,
  p_items JSONB
)
RETURNS UUID
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_order_id UUID;
  v_total_price DECIMAL(10, 2) := 0;
  v_item RECORD;
  v_product_stock INT;
  v_product_price DECIMAL(10, 2);
  v_product_active BOOLEAN;
  v_product_seller_id UUID;
  v_seller_accepting BOOLEAN;
  v_seller_role TEXT;
  v_buyer_id UUID;
BEGIN
  v_buyer_id := auth.uid();
  IF v_buyer_id IS NULL THEN
    RAISE EXCEPTION 'Usuario no autenticado en el sistema.';
  END IF;

  IF v_buyer_id = p_seller_id THEN
    RAISE EXCEPTION 'No puedes realizar un pedido a tu propio emprendimiento.';
  END IF;

  -- Validar que el vendedor exista, acepte pedidos y no esté suspendido
  SELECT accepting_orders, role::text INTO v_seller_accepting, v_seller_role
  FROM public.profiles
  WHERE id = p_seller_id;

  IF v_seller_role IS NULL THEN
    RAISE EXCEPTION 'El vendedor no existe.';
  END IF;
  IF v_seller_role = 'suspended' OR v_seller_role = 'suspended_buyer' THEN
    RAISE EXCEPTION 'El vendedor está suspendido.';
  END IF;
  IF NOT COALESCE(v_seller_accepting, true) THEN
    RAISE EXCEPTION 'El emprendimiento no está aceptando pedidos por el momento.';
  END IF;

  v_order_id := gen_random_uuid();
  INSERT INTO public.orders (id, buyer_id, seller_id, total_price, delivery_place, status)
  VALUES (v_order_id, v_buyer_id, p_seller_id, 0, p_delivery_place, 'pending');

  FOR v_item IN SELECT * FROM jsonb_to_recordset(p_items) AS x(product_id UUID, quantity INT)
  LOOP
    IF v_item.quantity <= 0 THEN
      RAISE EXCEPTION 'La cantidad del producto debe ser mayor a cero.';
    END IF;

    SELECT stock, price, is_active, seller_id
    INTO v_product_stock, v_product_price, v_product_active, v_product_seller_id
    FROM public.products
    WHERE id = v_item.product_id
    FOR UPDATE;

    IF NOT FOUND THEN
      RAISE EXCEPTION 'El producto con ID % no existe.', v_item.product_id;
    END IF;

    -- El ítem debe pertenecer al vendedor indicado en el pedido
    IF v_product_seller_id <> p_seller_id THEN
      RAISE EXCEPTION 'El producto % no pertenece al vendedor seleccionado.', v_item.product_id;
    END IF;

    IF NOT v_product_active THEN
      RAISE EXCEPTION 'El producto seleccionado ya no está disponible.';
    END IF;

    IF v_product_stock < v_item.quantity THEN
      RAISE EXCEPTION 'Stock insuficiente para el producto seleccionado.';
    END IF;

    UPDATE public.products
    SET stock = stock - v_item.quantity
    WHERE id = v_item.product_id;

    INSERT INTO public.stock_logs (product_id, quantity_changed, type, notes)
    VALUES (v_item.product_id, -v_item.quantity, 'sale', 'Venta por pedido #' || v_order_id);

    INSERT INTO public.order_items (order_id, product_id, quantity, price_at_sale)
    VALUES (v_order_id, v_item.product_id, v_item.quantity, v_product_price);

    v_total_price := v_total_price + (v_product_price * v_item.quantity);
  END LOOP;

  UPDATE public.orders
  SET total_price = v_total_price
  WHERE id = v_order_id;

  RETURN v_order_id;
EXCEPTION
  WHEN OTHERS THEN
    RAISE;
END;
$$;

-- 9. OCULTAR PRODUCTOS AL DEJAR DE SER EMPRENDEDOR
-- Si el usuario pasa a comprador o es suspendido, sus productos
-- dejan de mostrarse (is_active = false). SECURITY DEFINER para
-- que RLS no impida la actualización desde el trigger.
CREATE OR REPLACE FUNCTION public.handle_profile_role_change()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  IF NEW.role <> 'emprendedor' AND OLD.role = 'emprendedor' THEN
    UPDATE public.products
    SET is_active = false
    WHERE seller_id = NEW.id AND is_active = true;
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_profile_role_change ON public.profiles;
CREATE TRIGGER trg_profile_role_change
  BEFORE UPDATE OF role ON public.profiles
  FOR EACH ROW
  EXECUTE FUNCTION public.handle_profile_role_change();

-- 8. VALIDAR TRANSICIONES DE ESTADO DE PEDIDOS + RESTAURAR STOCK AL CANCELAR
CREATE OR REPLACE FUNCTION public.handle_order_status_change()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
DECLARE
  v_actor UUID := auth.uid();
  v_item RECORD;
BEGIN
  IF OLD.status = NEW.status THEN
    RETURN NEW;
  END IF;

  IF v_actor IS NULL THEN
    RAISE EXCEPTION 'Usuario no autenticado.';
  END IF;

  -- Cancelación/rechazo: solo desde 'pending' y solo por comprador (se cancela)
  -- o vendedor (se rechaza). En ambos casos se restaura el stock.
  IF NEW.status = 'cancelled' THEN
    IF v_actor <> OLD.buyer_id AND v_actor <> OLD.seller_id THEN
      RAISE EXCEPTION 'Solo el comprador o el vendedor pueden cancelar el pedido.';
    END IF;
    IF OLD.status <> 'pending' THEN
      RAISE EXCEPTION 'Solo se puede cancelar un pedido pendiente.';
    END IF;

    -- Restaurar stock y registrar en stock_logs
    FOR v_item IN SELECT product_id, quantity FROM public.order_items WHERE order_id = NEW.id
    LOOP
      UPDATE public.products
      SET stock = stock + v_item.quantity
      WHERE id = v_item.product_id;

      INSERT INTO public.stock_logs (product_id, quantity_changed, type, notes)
      VALUES (v_item.product_id, v_item.quantity, 'restock', 'Cancelación de pedido #' || NEW.id);
    END LOOP;

    RETURN NEW;
  END IF;

  -- Avance del pedido: solo el vendedor, en secuencia válida
  IF NEW.status IN ('accepted', 'preparing', 'ready', 'completed') THEN
    IF v_actor <> OLD.seller_id THEN
      RAISE EXCEPTION 'Solo el vendedor puede avanzar el estado del pedido.';
    END IF;

    IF OLD.status = 'completed' OR OLD.status = 'cancelled' THEN
      RAISE EXCEPTION 'Un pedido finalizado no puede cambiar de estado.';
    END IF;

    IF OLD.status = 'pending' AND NEW.status NOT IN ('accepted', 'preparing', 'ready', 'completed') THEN
      RAISE EXCEPTION 'Transición de estado inválida.';
    END IF;

    IF OLD.status = 'accepted' AND NEW.status NOT IN ('preparing', 'ready', 'completed') THEN
      RAISE EXCEPTION 'Transición de estado inválida.';
    END IF;

    IF OLD.status = 'preparing' AND NEW.status NOT IN ('ready', 'completed') THEN
      RAISE EXCEPTION 'Transición de estado inválida.';
    END IF;

    IF OLD.status = 'ready' AND NEW.status <> 'completed' THEN
      RAISE EXCEPTION 'Transición de estado inválida.';
    END IF;
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_order_status_change ON public.orders;
CREATE TRIGGER trg_order_status_change
  BEFORE UPDATE OF status ON public.orders
  FOR EACH ROW
  EXECUTE FUNCTION public.handle_order_status_change();

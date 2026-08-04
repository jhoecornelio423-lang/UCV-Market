-- ========================================================
-- FUNCIONES TRANSACCIONALES (RPC) Y POLÍTICAS DE RLS
-- ========================================================

-- 1. FUNCIÓN RPC: create_order (Lógica transaccional de pedidos y stock)
CREATE OR REPLACE FUNCTION public.create_order(
  p_seller_id UUID,
  p_delivery_place VARCHAR,
  p_items JSONB
)
RETURNS UUID
LANGUAGE plpgsql
SECURITY DEFINER -- Ejecuta con permisos de administrador para poder editar productos y stock
AS $$
DECLARE
  v_order_id UUID;
  v_total_price DECIMAL(10, 2) := 0;
  v_item RECORD;
  v_product_stock INT;
  v_product_price DECIMAL(10, 2);
  v_product_active BOOLEAN;
  v_buyer_id UUID;
BEGIN
  -- Obtener el ID del comprador desde el token JWT de Supabase
  v_buyer_id := auth.uid();
  IF v_buyer_id IS NULL THEN
    RAISE EXCEPTION 'Usuario no autenticado en el sistema.';
  END IF;

  -- Validar que el comprador no se esté autocomprando
  IF v_buyer_id = p_seller_id THEN
    RAISE EXCEPTION 'No puedes realizar un pedido a tu propio emprendimiento.';
  END IF;

  -- Crear el registro principal del Pedido
  v_order_id := gen_random_uuid();
  INSERT INTO public.orders (id, buyer_id, seller_id, total_price, delivery_place, status)
  VALUES (v_order_id, v_buyer_id, p_seller_id, 0, p_delivery_place, 'pending');

  -- Iterar sobre los productos enviados en el JSONB
  -- Formato esperado: [{"product_id": "uuid", "quantity": 1}, ...]
  FOR v_item IN SELECT * FROM jsonb_to_recordset(p_items) AS x(product_id UUID, quantity INT)
  LOOP
    -- Bloquear fila del producto para evitar lecturas cruzadas concurrentes (Pessimistic Lock)
    SELECT stock, price, is_active INTO v_product_stock, v_product_price, v_product_active
    FROM public.products
    WHERE id = v_item.product_id
    FOR UPDATE;

    IF NOT FOUND THEN
      RAISE EXCEPTION 'El producto con ID % no existe.', v_item.product_id;
    END IF;

    IF NOT v_product_active THEN
      RAISE EXCEPTION 'El producto seleccionado ya no está disponible.';
    END IF;

    IF v_product_stock < v_item.quantity THEN
      RAISE EXCEPTION 'Stock insuficiente para el producto seleccionado.';
    END IF;

    -- Descontar stock
    UPDATE public.products
    SET stock = stock - v_item.quantity
    WHERE id = v_item.product_id;

    -- Registrar log de stock
    INSERT INTO public.stock_logs (product_id, quantity_changed, type, notes)
    VALUES (v_item.product_id, -v_item.quantity, 'sale', 'Venta por pedido #' || v_order_id);

    -- Registrar detalle del pedido
    INSERT INTO public.order_items (order_id, product_id, quantity, price_at_sale)
    VALUES (v_order_id, v_item.product_id, v_item.quantity, v_product_price);

    -- Sumar total
    v_total_price := v_total_price + (v_product_price * v_item.quantity);
  END LOOP;

  -- Actualizar costo total de la orden
  UPDATE public.orders
  SET total_price = v_total_price
  WHERE id = v_order_id;

  RETURN v_order_id;
EXCEPTION
  WHEN OTHERS THEN
    -- Ante cualquier error, PostgreSQL realiza un rollback implícito de todo el bloque
    RAISE;
END;
$$;


-- 2. POLÍTICAS DE ROW LEVEL SECURITY (RLS) DETALLADAS

-- Tabla: profiles
-- Lectura: Cualquier usuario autenticado puede leer perfiles.
CREATE POLICY "Permitir lectura de perfiles a autenticados" 
ON public.profiles FOR SELECT 
TO authenticated 
USING (true);

-- Escritura: Un usuario solo puede actualizar su propio perfil.
CREATE POLICY "Permitir actualización de perfil propio" 
ON public.profiles FOR UPDATE 
TO authenticated 
USING (auth.uid() = id);

-- Tabla: categories
-- Lectura: Cualquier usuario autenticado puede ver categorías.
CREATE POLICY "Permitir lectura de categorías a autenticados" 
ON public.categories FOR SELECT 
TO authenticated 
USING (true);

-- Escritura: Solo administradores pueden insertar/modificar categorías.
CREATE POLICY "Permitir gestión a administradores" 
ON public.categories FOR ALL 
TO authenticated 
USING (
  EXISTS (
    SELECT 1 FROM public.profiles 
    WHERE id = auth.uid() AND role = 'admin'
  )
);

-- Tabla: products
-- Lectura: Cualquier autenticado puede ver productos activos y en stock.
CREATE POLICY "Permitir ver productos activos en stock" 
ON public.products FOR SELECT 
TO authenticated 
USING (is_active = TRUE AND stock > 0);

-- Lectura complementaria: El emprendedor dueño puede ver todos sus productos, activos o no.
CREATE POLICY "Emprendedor puede ver todos sus productos" 
ON public.products FOR SELECT 
TO authenticated 
USING (auth.uid() = seller_id);

-- Inserción: Solo emprendedores pueden crear productos asociados a su id.
CREATE POLICY "Emprendedores pueden crear productos propios" 
ON public.products FOR INSERT 
TO authenticated 
WITH CHECK (
  auth.uid() = seller_id 
  AND EXISTS (
    SELECT 1 FROM public.profiles 
    WHERE id = auth.uid() AND role = 'emprendedor'
  )
);

-- Actualización: Solo el dueño puede editar el producto.
CREATE POLICY "Emprendedores pueden editar productos propios" 
ON public.products FOR UPDATE 
TO authenticated 
USING (auth.uid() = seller_id);

-- Borrado: Solo el dueño puede dar de baja el producto (o desactivarlo).
CREATE POLICY "Emprendedores pueden eliminar productos propios" 
ON public.products FOR DELETE 
TO authenticated 
USING (auth.uid() = seller_id);

-- Tabla: product_images
CREATE POLICY "Lectura pública de imágenes a autenticados" 
ON public.product_images FOR SELECT 
TO authenticated 
USING (true);

CREATE POLICY "Vendedores pueden agregar imágenes a sus productos" 
ON public.product_images FOR INSERT 
TO authenticated 
WITH CHECK (
  EXISTS (
    SELECT 1 FROM public.products 
    WHERE id = product_id AND seller_id = auth.uid()
  )
);

CREATE POLICY "Vendedores pueden borrar imágenes de sus productos" 
ON public.product_images FOR DELETE 
TO authenticated 
USING (
  EXISTS (
    SELECT 1 FROM public.products 
    WHERE id = product_id AND seller_id = auth.uid()
  )
);

-- Tabla: favorites
CREATE POLICY "Usuarios pueden gestionar sus propios favoritos" 
ON public.favorites FOR ALL 
TO authenticated 
USING (auth.uid() = user_id);

-- Tabla: orders
-- Lectura: Comprador o vendedor implicados.
CREATE POLICY "Comprador o vendedor pueden ver el pedido" 
ON public.orders FOR SELECT 
TO authenticated 
USING (auth.uid() = buyer_id OR auth.uid() = seller_id);

-- Inserción: Cualquier comprador puede crear pedidos (a través de RPC se valida el buyer_id).
CREATE POLICY "Compradores pueden crear pedidos" 
ON public.orders FOR INSERT 
TO authenticated 
WITH CHECK (auth.uid() = buyer_id);

-- Actualización: Permite al comprador cancelar o al vendedor cambiar de estado.
CREATE POLICY "Actualizar estados del pedido involucrados" 
ON public.orders FOR UPDATE 
TO authenticated 
USING (auth.uid() = buyer_id OR auth.uid() = seller_id);

-- Tabla: order_items
CREATE POLICY "Involucrados pueden ver items del pedido" 
ON public.order_items FOR SELECT 
TO authenticated 
USING (
  EXISTS (
    SELECT 1 FROM public.orders 
    WHERE id = order_id AND (buyer_id = auth.uid() OR seller_id = auth.uid())
  )
);

CREATE POLICY "Comprador puede insertar items del pedido" 
ON public.order_items FOR INSERT 
TO authenticated 
WITH CHECK (
  EXISTS (
    SELECT 1 FROM public.orders 
    WHERE id = order_id AND buyer_id = auth.uid()
  )
);

-- Tabla: reviews
CREATE POLICY "Cualquiera puede leer reseñas" 
ON public.reviews FOR SELECT 
TO authenticated 
USING (true);

CREATE POLICY "Comprador califica su pedido completado" 
ON public.reviews FOR INSERT 
TO authenticated 
WITH CHECK (
  auth.uid() = reviewer_id 
  AND EXISTS (
    SELECT 1 FROM public.orders 
    WHERE id = order_id AND buyer_id = auth.uid() AND status = 'completed'
  )
);

-- Tabla: stock_logs
CREATE POLICY "Emprendedor puede ver logs de stock de sus productos" 
ON public.stock_logs FOR SELECT 
TO authenticated 
USING (
  EXISTS (
    SELECT 1 FROM public.products 
    WHERE id = product_id AND seller_id = auth.uid()
  )
);

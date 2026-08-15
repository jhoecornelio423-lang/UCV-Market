# UCV Market - Master Blueprint
## Documento 03: Diseño de Módulos, RLS y Transacciones PostgreSQL (Supabase Serverless)

Este documento detalla la implementación modular del frontend en Ionic/Angular, la comunicación con la API de PostgREST, las políticas detalladas de seguridad a nivel de base de datos (RLS), la lógica transaccional de pedidos en PL/pgSQL y la integración de notificaciones push serverless.

---

### 19. Estructura y Arquitectura Frontend (Ionic 8 + Angular 18)

Para garantizar la mantenibilidad y aplicar **Clean Architecture** en el cliente, estructuramos la aplicación Angular en capas bien diferenciadas:

```
src/app/
├── core/
│   ├── auth/                      # Servicios y Guards de Autenticación
│   │   ├── auth.guard.ts
│   │   └── supabase-auth.service.ts
│   └── database/                  # Inicialización del cliente Supabase
│       └── supabase.client.ts
├── shared/                        # Componentes comunes a varios módulos
│   ├── components/                # ProductCard, StarRating
│   └── pipes/                     # PriceFormatPipe
└── features/                      # Módulos puros cargados bajo demanda (Lazy Loading)
    ├── auth/                      # Login, Registro, Recuperación
    ├── catalog/                   # Catálogo de Productos y Búsqueda
    ├── cart/                      # Carrito de Compras Local
    ├── orders/                    # Historial y Seguimiento de Pedidos
    ├── seller-panel/              # Gestión de stock e inventario
    └── admin-panel/               # Moderación de categorías y reportes
```

#### Patrón Repository en Angular:
Implementamos interfaces en TypeScript para desacoplar el consumo de datos de la UI. Por ejemplo, para el catálogo:

##### Interfaz (`core/repositories/product.repository.ts`):
```typescript
import { Observable } from 'rxjs';
import { Product } from '../models/product.model';

export interface ProductRepository {
  getActiveProducts(categoryId?: string, searchName?: string): Observable<Product[]>;
  getProductById(id: string): Observable<Product>;
  createProduct(product: Partial<Product>, images: File[]): Observable<Product>;
  updateProduct(id: string, product: Partial<Product>): Observable<Product>;
}
```

##### Implementación Concreta (`core/repositories/supabase/supabase-product.repository.ts`):
```typescript
import { Injectable } from '@angular/core';
import { ProductRepository } from '../product.repository';
import { SupabaseClientService } from '../../database/supabase.client';
import { from, Observable } from 'rxjs';
import { map } from 'rxjs/operators';
import { Product } from '../../models/product.model';

@Injectable({
  providedIn: 'root'
})
export class SupabaseProductRepository implements ProductRepository {
  constructor(private supabaseService: SupabaseClientService) {}

  getActiveProducts(categoryId?: string, searchName?: string): Observable<Product[]> {
    let query = this.supabaseService.client
      .from('products')
      .select('*, product_images(*)')
      .eq('is_active', true)
      .gt('stock', 0);

    if (categoryId) {
      query = query.eq('category_id', categoryId);
    }
    if (searchName) {
      query = query.ilike('name', `%${searchName}%`);
    }

    // Convertimos la promesa nativa de Supabase en un Observable de RxJS
    return from(query).pipe(
      map(response => {
        if (response.error) throw new Error(response.error.message);
        return response.data as Product[];
      })
    );
  }

  getProductById(id: string): Observable<Product> {
    return from(
      this.supabaseService.client
        .from('products')
        .select('*, product_images(*), profiles(*)')
        .eq('id', id)
        .single()
    ).pipe(
      map(response => {
        if (response.error) throw new Error(response.error.message);
        return response.data as Product;
      })
    );
  }

  createProduct(product: Partial<Product>, images: File[]): Observable<Product> {
    // Lógica para insertar producto y cargar sus imágenes en Supabase Storage
    throw new Error('Not implemented yet');
  }

  updateProduct(id: string, product: Partial<Product>): Observable<Product> {
    return from(
      this.supabaseService.client
        .from('products')
        .update(product)
        .eq('id', id)
        .select()
        .single()
    ).pipe(
      map(response => {
        if (response.error) throw new Error(response.error.message);
        return response.data as Product;
      })
    );
  }
}
```

---

### 20. Arquitectura de la API (PostgREST de Supabase)

Al no escribir un backend personalizado, las peticiones HTTP se dirigen al componente **PostgREST** de Supabase, que expone de forma automática un API RESTful sobre las tablas y funciones de PostgreSQL:

- **Listar productos (GET):** `/rest/v1/products?is_active=eq.true&stock=gt.0`
- **Crear producto (POST):** `/rest/v1/products` (Enviando payload JSON y cabecera de autenticación Bearer).
- **Actualizar stock (PATCH):** `/rest/v1/products?id=eq.{uuid}`

*Seguridad en las cabeceras:* Todas las peticiones al API llevan la cabecera `apikey` (pública) y, para peticiones autenticadas, la cabecera `Authorization: Bearer <JWT>`.

---

### 21. Diseño de Pantallas UX/UI (Detalle del MVP)

1. **Pantalla de Registro e Inicio de Sesión:**
   - Formularios minimalistas con validación reactiva en Angular.
   - Restricción del input de correo: Expresión regular que valida estrictamente la terminación `@ucvvirtual.edu.pe` o `@ucv.edu.pe`.
   - Efecto visual: Fondos oscuros translúcidos con desenfoque (`backdrop-filter`) para dar un aspecto premium al renderizarse sobre dispositivos móviles.

2. **Ficha del Catálogo General:**
   - Lista dinámica filtrable mediante chips de categorías táctiles en el header.
   - Barra de búsqueda predictiva con debounce de 300 ms en RxJS para evitar llamadas innecesarias al API mientras el usuario escribe.
   - Selector estático del Campus UCV (e.g., "Campus Los Olivos", "Campus Trujillo") mediante un modal bottom-sheet elegante.

3. **Checkout y Puntos de Encuentro:**
   - Resumen del carrito agrupado por emprendedor.
   - Menú desplegable para seleccionar el **Punto de Entrega Estático** dentro del campus (Biblioteca, Pabellón C - Primer Piso, Patio de Comidas, Puerta de Entrada 1).

---

### 22. Diseño del Sistema de Autenticación (Supabase Auth JWT)

El flujo de sesión se sustenta en tokens JWT de corta duración y tokens de refresco persistidos localmente.

```
┌──────────────┐                 ┌───────────────┐                 ┌─────────────┐
│ Cliente App  │                 │ Supabase Auth │                 │ PostgreSQL  │
└──────┬───────┘                 └───────┬───────┘                 └──────┬──────┘
       │                                 │                                │
       │─── 1. Iniciar sesión ──────────>│                                │
       │    (email, password)            │                                │
       │                                 │─── 2. Valida credenciales ────>│
       │                                 │<─── Contraseña válida ─────────│
       │<── 3. Retorna Token JWT ────────│                                │
       │    (contiene rol en user_metadata)                               │
       │                                                                  │
       │─── 4. Petición de datos (Header: Bearer JWT) ───────────────────>│
       │                                                                  │── 5. Evalúa RLS
       │                                                                  │   (auth.uid() = owner)
       │<── 6. Retorna Datos autorizados ─────────────────────────────────│
```

*Persistencia en Móvil:* Al recibir el JWT, Capacitor guarda el token y el refresh token mediante `Capacitor Preferences`. Al iniciar la app, un Guard lee este almacenamiento para reconstruir la sesión activa.

---

### 23. Diseño Transaccional de Pedidos (PL/pgSQL RPC)

Dado que no contamos con un backend para procesar el pedido y descontar el stock de manera atómica, desarrollamos una **Función Almacenada (RPC)** en PostgreSQL. Esto garantiza el cumplimiento estricto de las propiedades **ACID** (Atomicidad, Consistencia, Aislamiento y Durabilidad) y previene la sobreventa concurrente del stock.

#### Función PostgreSQL `create_order` en PL/pgSQL:
```sql
CREATE OR REPLACE FUNCTION public.create_order(
  p_seller_id UUID,
  p_delivery_place VARCHAR,
  p_items JSONB
)
RETURNS UUID
LANGUAGE plpgsql
SECURITY DEFINER -- Se ejecuta con permisos de administrador para alterar stock y orders
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
  -- Obtener el ID del comprador directamente desde el token de autenticación JWT de Supabase
  v_buyer_id := auth.uid();
  IF v_buyer_id IS NULL THEN
    RAISE EXCEPTION 'Usuario no autenticado en el sistema.';
  END IF;

  -- 1. Crear el registro principal del Pedido
  v_order_id := gen_random_uuid();
  INSERT INTO public.orders (id, buyer_id, seller_id, total_price, delivery_place, status)
  VALUES (v_order_id, v_buyer_id, p_seller_id, 0, p_delivery_place, 'pending');

  -- 2. Procesar cada producto enviado en el JSONB
  -- Formato esperado de p_items: [{"product_id": "uuid", "quantity": 2}, ...]
  FOR v_item IN SELECT * FROM jsonb_to_recordset(p_items) AS x(product_id UUID, quantity INT)
  LOOP
    -- Bloquear el registro del producto para actualización (Pessimistic Locking)
    -- Esto bloquea escrituras concurrentes sobre este producto específico hasta que termine la transacción
    SELECT stock, price, is_active INTO v_product_stock, v_product_price, v_product_active
    FROM public.products
    WHERE id = v_item.product_id
    FOR UPDATE;

    -- Validaciones de negocio
    IF NOT FOUND THEN
      RAISE EXCEPTION 'El producto con ID % no existe.', v_item.product_id;
    END IF;

    IF NOT v_product_active THEN
      RAISE EXCEPTION 'El producto seleccionado no está activo actualmente.';
    END IF;

    IF v_product_stock < v_item.quantity THEN
      RAISE EXCEPTION 'Stock insuficiente. Producto: %, Stock disponible: %, Solicitado: %', 
        v_item.product_id, v_product_stock, v_item.quantity;
    END IF;

    -- 3. Descontar el stock del producto
    UPDATE public.products
    SET stock = stock - v_item.quantity
    WHERE id = v_item.product_id;

    -- 4. Registrar en el historial de stock
    INSERT INTO public.stock_logs (product_id, quantity_changed, type, notes)
    VALUES (v_item.product_id, -v_item.quantity, 'sale', 'Descuento automático por pedido: ' || v_order_id);

    -- 5. Insertar el detalle del pedido
    INSERT INTO public.order_items (order_id, product_id, quantity, price_at_sale)
    VALUES (v_order_id, v_item.product_id, v_item.quantity, v_product_price);

    -- Acumular precio total
    v_total_price := v_total_price + (v_product_price * v_item.quantity);
  END LOOP;

  -- 6. Actualizar el costo total acumulado en el pedido principal
  UPDATE public.orders
  SET total_price = v_total_price
  WHERE id = v_order_id;

  RETURN v_order_id;
EXCEPTION
  WHEN OTHERS THEN
    -- En caso de error, PostgreSQL realiza un ROLLBACK automático de toda la transacción
    RAISE;
END;
$$;
```

*Invocación desde Angular:*
```typescript
const { data: orderId, error } = await supabase.rpc('create_order', {
  p_seller_id: 'vendedor-uuid',
  p_delivery_place: 'Biblioteca Pabellón A',
  p_items: [{ product_id: 'prod-uuid', quantity: 2 }]
});
```

---

### 24. Políticas de Seguridad a Nivel de Fila (RLS Policies)

Habilitamos RLS en todas las tablas de PostgreSQL para blindar el acceso a los datos. Las políticas SQL definidas son:

#### Tabla: `products`
```sql
ALTER TABLE public.products ENABLE ROW LEVEL SECURITY;

-- Política de Lectura: Cualquiera (autenticado) puede ver productos activos
CREATE POLICY "Permitir lectura de productos activos" 
ON public.products FOR SELECT 
TO authenticated
USING (is_active = true AND stock > 0);

-- Política de Inserción: Solo emprendedores pueden crear productos, y su id de vendedor debe ser su uid autenticado
CREATE POLICY "Permitir creación a emprendedores dueños" 
ON public.products FOR INSERT 
TO authenticated
WITH CHECK (
  auth.uid() = seller_id 
  AND EXISTS (
    SELECT 1 FROM public.profiles 
    WHERE id = auth.uid() AND role = 'emprendedor'
  )
);

-- Política de Actualización: Solo el dueño del producto puede editarlo
CREATE POLICY "Permitir actualización a dueños del producto" 
ON public.products FOR UPDATE 
TO authenticated
USING (auth.uid() = seller_id);
```

#### Tabla: `orders`
```sql
ALTER TABLE public.orders ENABLE ROW LEVEL SECURITY;

-- Política de Lectura: Un usuario solo puede ver pedidos donde es comprador o vendedor
CREATE POLICY "Usuarios pueden ver sus propios pedidos" 
ON public.orders FOR SELECT 
TO authenticated
USING (auth.uid() = buyer_id OR auth.uid() = seller_id);

-- Política de Actualización: Compradores y vendedores pueden cambiar el estado bajo ciertas condiciones
CREATE POLICY "Permitir actualización de estado de pedido" 
ON public.orders FOR UPDATE 
TO authenticated
USING (auth.uid() = buyer_id OR auth.uid() = seller_id);
```

---

### 25. Sistema de Notificaciones Serverless (PostgreSQL + Deno Edge Functions + FCM)

Para enviar notificaciones push en tiempo real a los teléfonos móviles sin un servidor intermedio permanente, implementamos una arquitectura orientada a eventos usando **PostgreSQL Triggers** (con la extensión `pg_net`), **Supabase Edge Functions** (Deno) y **Firebase Cloud Messaging** (FCM). Complementariamente, la app escucha **Realtime de Supabase** (`postgres_changes`) para notificar en segundo plano/abierto sin pasar por FCM.

```
  orders Table             Postgres Trigger          Supabase Edge Function          Firebase FCM
 (INSERT/UPDATE)           (pg_net webhook)           (Deno TypeScript)               Gateway
┌──────────────┐           ┌────────────────┐         ┌──────────────────┐       ┌─────────────────┐
│ status/cancel│ ────────> │ Invoca HTTP    │ ──────> │ Decide receptor  │ ────> │ Envía Push a    │
│              │           │ POST a Edge F. │         │ y despacha a FCM │       │ Dispositivo     │
└──────────────┘           └────────────────┘         └──────────────────┘       └─────────────────┘
```

1. **Triggers de Base de Datos en la tabla `orders`:**

   a. **Webhook de notificación** (`trg_order_status_push`): al insertar o cambiar el estado de un pedido, se invoca asincrónicamente la Edge Function `send-push` enviando el registro **completo** (`to_jsonb(NEW)` y `to_jsonb(OLD)`). La tabla tiene `REPLICA IDENTITY FULL`, de modo que `NEW` incluye todas las columnas (incluida `cancelled_by`).

```sql
CREATE OR REPLACE FUNCTION public.trg_order_status_push_fn()
RETURNS TRIGGER LANGUAGE plpgsql SECURITY DEFINER AS $body$
BEGIN
  IF NEW.status IS DISTINCT FROM OLD.status THEN
    PERFORM net.http_post(
      url := 'https://<proyecto-id>.functions.supabase.co/send-push',
      body := jsonb_build_object(
        'type', 'UPDATE', 'table', 'orders',
        'record', to_jsonb(NEW), 'old', to_jsonb(OLD)
      ),
      headers := jsonb_build_object('Content-Type', 'application/json', 'Authorization', '<WEBHOOK_SECRET>'),
      timeout_milliseconds := 5000
    );
  END IF;
  RETURN NEW;
END $body$;

CREATE TRIGGER trg_order_status_push
  AFTER UPDATE OF status ON public.orders
  FOR EACH ROW EXECUTE FUNCTION public.trg_order_status_push_fn();
```

   b. **Registro del actor de cancelación** (`trg_order_cancelled_by`): la columna `cancelled_by` guarda `auth.uid()` para saber **quién** canceló el pedido (comprador o vendedor). Se setea en un trigger `BEFORE UPDATE`, por lo que el webhook `AFTER UPDATE` ya lo incluye en `record`.

```sql
ALTER TABLE public.orders
  ADD COLUMN IF NOT EXISTS cancelled_by UUID REFERENCES public.profiles(id);

CREATE OR REPLACE FUNCTION public.set_order_cancelled_by()
RETURNS TRIGGER LANGUAGE plpgsql AS $$
BEGIN
  NEW.cancelled_by := auth.uid();
  RETURN NEW;
END $$;

CREATE TRIGGER trg_order_cancelled_by
  BEFORE UPDATE OF status ON public.orders
  FOR EACH ROW
  WHEN (NEW.status = 'cancelled')
  EXECUTE FUNCTION public.set_order_cancelled_by();
```

2. **Supabase Edge Function (`supabase/functions/send-push/index.ts`):**
   Función TypeScript que se ejecuta en el Deno Runtime en el Edge de Supabase. Según el evento (`table`, `type`, `record`) decide el **receptor** y el mensaje:

   | Evento | Condición | Receptor | Mensaje |
   |---|---|---|---|
   | `orders` INSERT | — | Vendedor | "¡Nuevo pedido recibido!" |
   | `orders` UPDATE | `status` normal (`accepted`, `preparing`, `ready`, `completed`, `cancelled`) | Comprador | Mensaje según estado |
   | `orders` UPDATE | `status = 'cancelled'` y `cancelled_by = buyer_id` | Vendedor | "Pedido cancelado por el comprador" |
   | `product_reports` INSERT | — | **Todos los admins** | "Nuevo reporte de producto" |
   | `product_reports` UPDATE | `status = 'resolved'` / `'rejected'` | Reporter | Aviso de resolución del reporte |
   | `support_tickets` UPDATE | Se agregó `admin_reply` o `status = resolved/closed` | Autor del ticket | "Respuesta del equipo" / "Ticket resuelto" |

   - Consulta el/los token(s) FCM del usuario en la tabla `push_tokens` y envía el payload con `priority: HIGH` y el canal Android `pedidos`. Cuando el receptor es "todos los admins", obtiene los `id` de `profiles` con `role = 'admin'` y envía a los tokens de cada uno.
   - Si un token responde `404`/`410` (dispositivo desinstalado), lo elimina de `push_tokens`.

3. **Realtime en la app (Ionic/Angular):**
   El servicio `NotificationService` se suscribe a `postgres_changes` para reflejar notificaciones en la bandeja y mostrar notificaciones locales sin depender de FCM:
   - Comprador: cambios de estado de sus pedidos (`buyer_id`).
   - Vendedor: pedidos nuevos (`seller_id` INSERT) y pedidos cancelados por el comprador (`seller_id` UPDATE + `cancelled_by != seller_id`).
   - Comprador: resolución de sus reportes (`reporter_id`).
   - **Admin:** nuevos reportes de producto (INSERT en `product_reports` sin filtro; el RLS solo deja ver el evento al admin). La bandeja del admin se muestra desde el panel con una campana en el header móvil y en el sidebar de escritorio (componente `AdminNotificationsComponent`).
   - **Todos los usuarios:** respuesta/resolución de sus tickets de soporte (`user_id` en `support_tickets`).

> **Nota Android:** el push se muestra aunque la app esté en segundo plano, pero si el usuario la **forzó a detener** o el fabricante la **optimizó en batería** (Xiaomi/Huawei/Samsung), Android bloquea la entrega hasta reabrir la app. No es un defecto del código.

---

### 26. Módulo de Integración con WhatsApp

Para cerrar las ventas, el cliente Ionic genera dinámicamente un enlace que abre la aplicación móvil de WhatsApp o WhatsApp Web.

```typescript
generateWhatsAppLink(orderId: string, sellerPhone: string, buyerName: string, deliveryPlace: string, totalPrice: number): string {
  const baseText = `Hola, te escribo de UCV Market 🛒.\n\nSoy el comprador *${buyerName}* y acabo de registrar el pedido *#${orderId.substring(0, 8)}*.\n\n📍 *Punto de Entrega:* ${deliveryPlace}\n💰 *Monto Total:* S/. ${totalPrice.toFixed(2)}\n\nPor favor, confírmame el pedido para proceder con la entrega contra entrega.`;
  
  return `https://wa.me/51${sellerPhone}?text=${encodeURIComponent(baseText)}`;
}
```
*Experiencia de Usuario:* Al hacer click en "Contactar por WhatsApp" desde la pantalla de pedido en Ionic, el flujo se desvía directamente a WhatsApp de forma instantánea, cerrando la brecha de comunicación con el vendedor.

---

### 27. Flujo de Soporte (Comprador y Vendedor)

El centro de soporte permite a **compradores** y **vendedores** crear tickets ante el equipo de administración, y al **admin** responderlos y gestionar su estado. Accesible desde `/buyer-panel/support` y `/seller/support` (ambos renderizan el mismo componente compartido `SupportPageComponent` en `features/support/`).

**Modelo de datos (`support_tickets`):**

| Columna | Tipo | Descripción |
|---|---|---|
| `id` | UUID PK | Identificador |
| `user_id` | UUID FK → profiles | Autor del ticket (comprador o vendedor) |
| `subject` | TEXT | Asunto |
| `message` | TEXT | Descripción del problema/consulta |
| `status` | TEXT | `open` → `in_progress` → `resolved` / `closed` |
| `admin_reply` | TEXT | Respuesta del equipo de soporte |
| `created_at` / `updated_at` | TIMESTAMPTZ | Fechas (con trigger `set_updated_at`) |

**Políticas RLS:**
- **INSERT:** el usuario crea tickets solo bajo su propio `user_id` (`auth.uid() = user_id`).
- **SELECT:** el usuario ve sus propios tickets; el admin ve todos.
- **UPDATE:** solo el admin (estado y `admin_reply`).

**Flujo:**
1. El comprador o vendedor abre "Centro de Soporte" (desde *Ayuda* en su perfil o *Contactar con Soporte* en Negocio) y crea un ticket con asunto y mensaje.
2. El admin lo ve en **Admin → Soporte** (tabla `support_tickets`), puede **responder** (guarda `admin_reply` y marca `resolved`) o **resolver** sin respuesta.
3. El usuario recibe **notificación push (FCM)** y **notificación en la bandeja (Realtime)** cuando el equipo responde o resuelve su ticket; al tocar navega a su centro de soporte.

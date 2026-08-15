# UCV Market - Master Blueprint
## Documento 04: Estrategia de Crecimiento, Seguridad, DevOps y Negocio (Versión Supabase Serverless)

Este documento detalla los aspectos no funcionales, la gestión de infraestructura serverless, las políticas de ciberseguridad, y el modelo comercial estratégico para consolidar a **UCV Market** como una startup rentable y escalable dentro de la comunidad universitaria.

---

### 38. Seguridad y Privacidad (Zero-Trust Serverless)

En una arquitectura serverless donde el cliente móvil interactúa directamente con la base de datos a través de APIs de PostgREST, la seguridad no se delega a un servidor intermedio (como Laravel). Se adopta una filosofía **Zero-Trust (Confianza Cero)** articulada en tres niveles:

1. **Autenticación Fuerte mediante Supabase Auth:**
   - La generación y el descifrado de las contraseñas se gestiona mediante algoritmos criptográficos robustos en la infraestructura de Supabase (uso de hashes adaptativos `bcrypt`).
   - El cliente recibe un JSON Web Token (JWT) firmado con algoritmo HS256 mediante la clave privada de Supabase. El token contiene metadatos de identidad y rol del usuario (`comprador`, `emprendedor`, `admin`).
   - El almacenamiento de tokens en dispositivos Android/iOS se delega al plugin `Capacitor Secure Storage`, el cual encapsula los datos utilizando los mecanismos nativos de hardware: `Keychain` en iOS y `Keystore` en Android. En clientes web clásicos se utilizan cookies cifradas con atributos `Secure` y `HttpOnly` para mitigar ataques XSS.

2. **Políticas de Control de Acceso (Row Level Security - RLS):**
   - RLS es la última y más importante línea de defensa. Cada tabla de PostgreSQL actúa como un guardián autónomo. Aunque un atacante obtenga la llave pública del API (`anon_key`), no podrá leer ni alterar registros ajenos a menos que el JWT firmado por Supabase apruebe explícitamente las políticas de la tabla.

3. **Prevención de Inyecciones SQL:**
   - PostgREST traduce automáticamente los filtros HTTP a consultas preparadas parametrizadas en SQL (Prepared Statements). Esto neutraliza por completo los intentos de inyección SQL en el catálogo de búsqueda.

---

### 39. Optimización del Rendimiento y Concurrencia

Al no poseer infraestructura física propia, la optimización se enfoca en reducir el consumo de base de datos y la transferencia de datos móviles:

1. **Evitar Consultas N+1 en Supabase (PostgREST Joins):**
   - En sistemas REST tradicionales, listar productos con sus imágenes asociadas suele requerir múltiples peticiones HTTP.
   - *Solución:* El SDK de Supabase (a través de PostgREST) permite realizar consultas anidadas (joins implícitos) que PostgreSQL procesa internamente con alta eficiencia y retorna como un único objeto JSON consolidado en una sola petición de red:
     ```typescript
     // Consulta optimizada: Resuelve productos, imágenes y perfil del vendedor en 1 petición HTTP
     const { data, error } = await this.supabase
       .from('products')
       .select('*, product_images(*), profiles(full_name, phone)')
       .eq('is_active', true);
     ```

2. **Índices de Base de Datos Estratégicos:**
   - Para acelerar las búsquedas por texto y filtros de categorías, crearemos índices B-Tree específicos en PostgreSQL sobre:
     - `products(category_id, is_active)`
     - `orders(buyer_id, seller_id)`
     - `favorites(user_id, product_id)` (índice compuesto único para evitar duplicidad de favoritos y agilizar búsquedas).

3. **Procesamiento de Imágenes en el Cliente (Optimización WebP Frontend):**
   - Cargar imágenes crudas de cámaras fotográficas (3MB - 8MB) saturaría el almacenamiento de Supabase Storage y ralentizaría la carga en dispositivos de los compradores.
   - *Solución:* El frontend de Ionic/Angular optimizará las fotos **antes** de subirlas a la nube de Supabase. Al capturar la foto, un servicio en TypeScript redimensionará la imagen a un canvas de `800x800px`, la comprimirá a una calidad del `80%` y la convertirá a un objeto Blob formato **WebP**. Una imagen típica de 4MB pasará a pesar ~80KB previo al envío por red, reduciendo el consumo de ancho de banda móvil y almacenamiento en un 95%.

---

### 40. Estrategia de Despliegue y DevOps Serverless (CI/CD)

La simplificación de la infraestructura serverless elimina la necesidad de orquestadores complejos como Kubernetes o balanceadores de carga físicos. El ciclo de vida de desarrollo se automatiza de la siguiente manera:

```
               ┌────────────────────────────────────────────────────────┐
               │              Repositorio GitHub (Monorepo)             │
               └───────────────────────────┬────────────────────────────┘
                                           │
         ┌─────────────────────────────────┴─────────────────────────────────┐
         ▼                                                                   ▼
┌──────────────────┐                                                ┌──────────────────┐
│  GitHub Actions  │                                                │  GitHub Actions  │
│  (Frontend CI)   │                                                │  (Supabase CD)   │
└────────┬─────────┘                                                └────────┬─────────┘
         │                                                                   │
         ▼ (Auto-Build & Deploy)                                             ▼ (db push / deploy)
┌──────────────────┐                                                ┌──────────────────┐
│  Hosting Web /   │                                                │  Supabase Cloud  │
│  Vercel CDN      │                                                │  (Postgres/Edge) │
└──────────────────┘                                                └──────────────────┘
```

1. **Entorno de Desarrollo Local:**
   - Los desarrolladores pueden ejecutar el entorno de base de datos de Supabase de manera local utilizando la herramienta **Supabase CLI** (la cual empaqueta de forma liviana Supabase en contenedores locales de Docker solo para pruebas del programador).
   
2. **Control de Versiones de Base de Datos (Migraciones):**
   - Cada alteración al esquema de la base de datos se registra como un script SQL incremental dentro de la carpeta `supabase/migrations/` en el repositorio Git.
   - Para aplicar cambios a producción, se utiliza el CLI de Supabase: `supabase db push` o se integran en GitHub Actions.
   - La migración de notificaciones (`20260814000000_notify_seller_on_cancel.sql`) agrega la columna `orders.cancelled_by` y su trigger, y **debe aplicarse antes** de redesplegar `send-push`.

3. **Despliegue del Frontend (Web / PWA):**
   - El código de Ionic/Angular se integra con plataformas CDN globales como **Vercel** o **Netlify**. Con cada commit en la rama principal (`main`), estas plataformas compilan el código automáticamente (`npm run build --prod`) y distribuyen los archivos estáticos a escala global con latencia mínima de carga.

4. **Despliegue de Edge Functions:**
   - La función en Deno para envío de notificaciones push se despliega directamente desde la consola con la instrucción: `supabase functions deploy send-push --project-ref <proyecto-id>`.
   - El webhook (trigger `pg_net`) apunta a la URL de la función con un `WEBHOOK_SECRET` compartido; los secrets `WEBHOOK_SECRET` y `FIREBASE_SERVICE_ACCOUNT` se configuran en `Settings -> Functions -> Secrets` de Supabase.

---

### 41. Buenas Prácticas y Calidad de Código

1. **Clean Code en Angular 18:**
   - Empleo de Standalone Components para eliminar los archivos redundantes de módulos (`NgModule`), agilizando el arranque del frontend.
   - Uso intensivo del inyector de dependencias declarativo con la función `inject()` de Angular (e.g., `private authService = inject(AuthService)`), simplificando la legibilidad sobre los constructores tradicionales.

2. **Principios SOLID en la Capa del Cliente:**
   - **Single Responsibility:** Los componentes de la UI solo manejan eventos visuales y estados locales de la interfaz. La lógica de persistencia se delega enteramente a los Repositorios de datos.
   - **Dependency Inversion:** Las vistas dependen de abstracciones (interfaces TypeScript). Esto permite intercambiar la implementación de datos de Supabase por datos de simulación locales (*Mock data*) en un solo paso durante las fases de pruebas unitarias.

---

### 42. Modelo de Negocio (Monetización Sostenible de la Startup)

Para dotar a UCV Market de viabilidad comercial real desde su MVP:

1. **Modelo Freemium para Emprendedores Universitarios:**
   - **Plan Semilla (Gratuito):** Permite listar hasta 5 productos activos, control de stock básico y redirección ilimitada de pedidos a WhatsApp.
   - **Plan Emprendedor Plus (S/. 9.90 mensual):** Productos ilimitados, insignias distintivas de "Vendedor Destacado", prioridad de listado en el catálogo superior del buscador y acceso a un panel de analíticas detallado (clics en WhatsApp, vistas de productos y conversión de pedidos).

2. **Tasa Transaccional de Conexión de Alto Valor:**
   - Para pedidos complejos de catering, servicios académicos o productos personalizados que superen los S/. 50.00, se cobrará una pequeña comisión fija de S/. 1.00 por la gestión exitosa del pedido a través del sistema.

3. **Publicidad B2C Georreferenciada Local:**
   - Oferta de banners publicitarios pagados en el home de la app dirigidos a los comercios aledaños al campus (restaurantes externos, copisterías, librerías, residencias estudiantiles).

---

### 43. Riesgos del Proyecto y Mitigación

1. **Riesgo Administrativo (Restricciones Universitarias):**
   - *Riesgo:* Que las autoridades del campus consideren la app como una perturbación al orden o al monopolio de la cafetería oficial y decidan bloquear o prohibir su uso.
   - *Mitigación:* Posicionar a UCV Market como una iniciativa académica liderada por estudiantes bajo el auspicio de la incubadora **UCV Emprende**. Demostrar que formaliza un comercio informal preexistente que ocurre sin control en WhatsApp, aumentando la seguridad dentro del campus.

2. **Riesgo Tecnológico (Límites Gratuitos de Supabase/Firebase):**
   - *Riesgo:* Que el volumen de usuarios supere las cuotas gratuitas iniciales de Supabase Cloud o Firebase, provocando cobros imprevistos.
   - *Mitigación:* Optimizar el rendimiento y las consultas para reducir los accesos a base de datos. Si el proyecto crece, el Plan Pro de Supabase ($25 USD mensuales) es sumamente asequible y escalable, pudiendo financiarse holgadamente con los primeros 10 usuarios del Plan Emprendedor Plus.

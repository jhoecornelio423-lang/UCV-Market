# UCV Market - Master Blueprint
## Documento 02: Arquitectura del Sistema y Modelado UML (Versión Supabase Serverless)

Este documento técnico de arquitectura define la organización estructural, el diseño físico y lógico de la base de datos PostgreSQL, y los diagramas de modelado UML de **UCV Market**, adaptados completamente a la arquitectura serverless provista por **Supabase**.

---

### 11. Arquitectura Completa del Sistema (Serverless)

En esta nueva versión de la arquitectura, eliminamos por completo la capa de servidor tradicional (Laravel + MySQL) y adoptamos un patrón **Client-to-Database Direct (Serverless)**, donde el cliente híbrido de Ionic/Angular se comunica de forma directa y segura con los servicios gestionados de Supabase a través de su SDK oficial.

```mermaid
graph TD
    subgraph Frontend_App [Ionic / Angular - Multiplataforma]
        View[Vistas HTML / SCSS]
        Comp[Angular Components]
        Serv[Services / Logic]
        RepoInt[Repository Interfaces]
        RepoImpl[Supabase Repository Impls]
        SupaSDK[Supabase JS Client SDK]
    end

    subgraph Supabase_Cloud_Platform [Supabase Managed Services]
        SupaAuth[Supabase Auth - JWT / Sessions]
        SupaStorage[Supabase Storage - Buckets WebP]
        EdgeFunc[Edge Functions - Deno TypeScript]
        PostgreSQL[(PostgreSQL Database Engine)]
    end

    subgraph Firebase_Console [Google Cloud Services]
        FCM[Firebase Cloud Messaging - Push]
    end

    View <--> Comp
    Comp <--> Serv
    Serv <--> RepoInt
    RepoImpl -.->|Implementa| RepoInt
    RepoImpl --> SupaSDK
    
    SupaSDK <-->|HTTPS / REST API| SupaAuth
    SupaSDK <-->|HTTPS / REST API| SupaStorage
    SupaSDK <-->|HTTPS / WebSockets| PostgreSQL
    
    EdgeFunc <--> PostgreSQL
    EdgeFunc -->|Push Notification HTTP API| FCM
    FCM -->|Push Payload| Frontend_App
```

#### Justificación de las Decisiones Arquitectónicas:
1. **Frontend Desacoplado mediante Repository Pattern:**
   - *Decisión:* Las páginas y componentes de Angular no invocan directamente al SDK de Supabase (`supabase.from('products').select(...)`). En su lugar, consumen interfaces como `ProductRepository` inyectadas mediante Dependency Injection (DI) de Angular.
   - *Alternativa:* Consumo directo del cliente Supabase en los controladores de la vista.
   - *Justificación:* El consumo directo acopla el frontend a la tecnología de Supabase. Si mañana se requiere migrar a Firebase o consumir un API REST clásico, habría que reescribir cada componente. Con el patrón Repository, solo se escribe una nueva implementación concreta de la interfaz (`HttpProductRepository` o `FirebaseProductRepository`) y se registra en el inyector de Angular, sin alterar la UI.

2. **Seguridad en la Base de Datos (Row Level Security - RLS):**
   - *Decisión:* Toda la seguridad y el control de accesos se delegan al motor de base de datos PostgreSQL a través de políticas RLS. El cliente móvil se conecta con una llave pública anónima (`anon_key`), y PostgreSQL valida la identidad del usuario a través del token JWT enviado automáticamente en las cabeceras HTTP por el SDK.
   - *Justificación:* Al no haber un servidor intermedio que valide las peticiones, la base de datos debe ser auto-protegida. RLS permite definir reglas como: *"Un usuario solo puede insertar un producto si su id autenticado (`auth.uid()`) coincide con el campo `user_id` de la fila"*.

---

### 12. Diseño de Base de Datos (PostgreSQL en Supabase)

#### Decisiones Técnicas sobre Datos:
- **UUID como Identificador Clave:** En PostgreSQL, el tipo `UUID` es un ciudadano de primera clase. Utilizaremos UUIDs autogenerados mediante `gen_random_uuid()` para todas las llaves primarias. Esto previene la enumeración de recursos desde el cliente y asegura identificadores únicos globales, vital para una arquitectura distribuida y offline-first.
- **Relación con Supabase Auth (`auth.users`):** Supabase gestiona la tabla interna `users` en el esquema de sistema `auth`. Para resguardar la integridad referencial y almacenar datos complementarios (como el celular de WhatsApp o reputación), crearemos una tabla `profiles` en el esquema `public` con una llave foránea que referencia a `auth.users` con borrado en cascada.

---

### 13. Modelo Entidad-Relación (MER Físico - PostgreSQL)

A continuación se presenta la estructura física detallada de la base de datos relacional en PostgreSQL:

```mermaid
erDiagram
    profiles {
        uuid id PK "references auth.users"
        varchar full_name
        varchar phone
        enum role "['comprador', 'emprendedor', 'admin']"
        decimal rating_average "3_2"
        varchar campus
        timestamp created_at
        timestamp updated_at
    }

    categories {
        uuid id PK "default gen_random_uuid()"
        varchar name
        varchar slug UK
        varchar icon
        timestamp created_at
    }

    products {
        uuid id PK "default gen_random_uuid()"
        uuid seller_id FK "references profiles(id)"
        uuid category_id FK "references categories(id)"
        varchar name
        text description
        decimal price "10_2"
        integer stock
        boolean is_active
        varchar pickup_location
        integer whatsapp_clicks
        timestamp created_at
        timestamp updated_at
    }

    product_images {
        uuid id PK "default gen_random_uuid()"
        uuid product_id FK "references products(id) ON DELETE CASCADE"
        varchar image_url
        boolean is_featured
        timestamp created_at
    }

    favorites {
        uuid id PK "default gen_random_uuid()"
        uuid user_id FK "references profiles(id) ON DELETE CASCADE"
        uuid product_id FK "references products(id) ON DELETE CASCADE"
        timestamp created_at
    }

    orders {
        uuid id PK "default gen_random_uuid()"
        uuid buyer_id FK "references profiles(id)"
        uuid seller_id FK "references profiles(id)"
        decimal total_price "10_2"
        varchar delivery_place "Punto estático de entrega"
        enum status "['pending', 'accepted', 'preparing', 'ready', 'completed', 'cancelled']"
        timestamp created_at
        timestamp updated_at
    }

    order_items {
        uuid id PK "default gen_random_uuid()"
        uuid order_id FK "references orders(id) ON DELETE CASCADE"
        uuid product_id FK "references products(id)"
        integer quantity
        decimal price_at_sale "10_2"
        timestamp created_at
    }

    reviews {
        uuid id PK "default gen_random_uuid()"
        uuid order_id FK "references orders(id) unique"
        uuid reviewer_id FK "references profiles(id)"
        uuid reviewee_id FK "references profiles(id)"
        integer rating "1_5"
        text comment
        timestamp created_at
    }

    profiles ||--o{ products : "crea"
    categories ||--o{ products : "clasifica"
    products ||--o{ product_images : "contiene"
    profiles ||--o{ favorites : "marca"
    products ||--o{ favorites : "es_favorito"
    profiles ||--o{ orders : "compra"
    profiles ||--o{ orders : "recibe"
    orders ||--o{ order_items : "contiene"
    products ||--o{ order_items : "se_vende"
    orders ||--o| reviews : "evalúa"
    profiles ||--o{ reviews : "escribe"
```

---

### 14. Casos de Uso UML (Detalle del MVP)

El modelado de casos de uso se enfoca estrictamente en las interacciones transaccionales directas del MVP con los servicios de Supabase.

```mermaid
usecaseDiagram
    actor Comprador as "Comprador UCV"
    actor Emprendedor as "Emprendedor UCV"
    actor Administrador as "Administrador UCV"

    package Supabase_Edge_Boundary {
        usecase UC1 as "Registrar Perfil (Supabase Auth)"
        usecase UC2 as "Ver Catálogo y Favoritos (PostgreSQL)"
        usecase UC3 as "Cargar Fotos de Productos (Supabase Storage)"
        usecase UC4 as "Procesar Compra (PostgreSQL Transaction/RPC)"
        usecase UC5 as "Modificar Estados del Pedido"
        usecase UC6 as "Registrar Calificación de Compra"
        usecase UC7 as "Moderar Contenido y Categorías"
        usecase UC8 as "Redirección a WhatsApp"
    }

    Comprador --> UC1
    Comprador --> UC2
    Comprador --> UC4
    Comprador --> UC6
    Comprador --> UC8

    Emprendedor --> UC1
    Emprendedor --> UC3
    Emprendedor --> UC5
    Emprendedor --> UC8

    Administrador --> UC1
    Administrador --> UC7
```

---

### 15. Diagrama de Clases (Frontend Clean Architecture)

Este diagrama ilustra la estructura estática del frontend en Angular, mostrando cómo se desacopla la UI de la base de datos de Supabase utilizando interfaces y el patrón Repository.

```mermaid
classDiagram
    class ProductListComponent {
        -ProductService productService
        +products: Product[]
        +ngOnInit() void
        +loadProducts() void
    }

    class ProductService {
        -ProductRepository productRepo
        +getActiveProducts() Observable~Product[]~
        +createProduct(product: ProductCreateDTO) Observable~Product~
    }

    class ProductRepository {
        <<interface>>
        +getAllActive() Observable~Product[]~
        +findById(id: string) Observable~Product~
        +save(product: ProductCreateDTO) Observable~Product~
    }

    class SupabaseProductRepository {
        -SupabaseClient supabase
        +getAllActive() Observable~Product[]~
        +findById(id: string) Observable~Product~
        +save(product: ProductCreateDTO) Observable~Product~
    }

    class Product {
        +string id
        +string sellerId
        +string name
        +double price
        +int stock
        +boolean isActive
    }

    ProductListComponent --> ProductService
    ProductService --> ProductRepository
    SupabaseProductRepository ..|> ProductRepository
    SupabaseProductRepository --> Product : "mapea a"
```

---

### 16. Diagrama de Componentes

Muestra la interacción física de los componentes empaquetados dentro de la aplicación híbrida y cómo consumen los módulos en la nube de Supabase.

```mermaid
graph LR
    subgraph Frontend_App [App Ionic/Angular - Mobile / PWA]
        ComponentUI[UI Components - Ionic Components]
        CoreServices[Core Services - Auth & Geolocation]
        FeatureRepo[Repositories - Supabase Concrete Implementations]
        FCMPlugin[Capacitor FCM Plugin]
    end

    subgraph Supabase_Platform [Servicios de Backend - Cloud]
        AuthSvc[Supabase Auth Service]
        RestAPI[Auto-generated REST API PostgREST]
        StorageSvc[Supabase Storage Service]
        Database[PostgreSQL Database]
        EdgeF[Supabase Edge Functions]
    end

    ComponentUI --> CoreServices
    ComponentUI --> FeatureRepo
    CoreServices --> AuthSvc
    FeatureRepo -->|HTTP JSON / POSTGREST| RestAPI
    FeatureRepo -->|Binary Upload / Storage API| StorageSvc
    RestAPI --> Database
    StorageSvc --> Database
    EdgeF --> Database
    EdgeF -->|FCM API HTTP| FCMPlugin
```

---

### 17. Diagrama de Despliegue (Infraestructura Serverless)

El despliegue bajo el paradigma serverless simplifica drásticamente la infraestructura. No existen servidores web propios, proxies inversos (Nginx), contenedores de Docker en producción o bases de datos autogestionadas. Todo se despliega en plataformas PaaS/SaaS globales.

```mermaid
graph TD
    subgraph Clientes [Entornos de Ejecución]
        PWA[Web App / PWA - Hosteado en Vercel/Netlify]
        Android[App Android - Dispositivo Móvil APK]
    end

    subgraph Cloud_Supabase [Supabase Edge - Global Infrastructure]
        SupaAPI[Supabase Gateway - CDN & API Routing]
        AuthEngine[Supabase Auth Engine]
        StorageEngine[Supabase Storage Buckets]
        EdgeEngine[Supabase Edge Functions - Deno Runtime]
        DBInstance[Managed PostgreSQL Instance]
    end

    subgraph Firebase [Google Cloud Platform]
        FCMServer[Firebase Cloud Messaging Gateway]
    end

    subgraph WhatsApp_API [Meta Platforms]
        WA[WhatsApp Web Gateway / Chat]
    end

    PWA & Android -->|HTTPS / WSS| SupaAPI
    SupaAPI --> AuthEngine
    SupaAPI --> StorageEngine
    SupaAPI --> EdgeEngine
    SupaAPI --> DBInstance
    
    EdgeEngine -->|Dispara Alerta Push| FCMServer
    FCMServer -->|Notificación Push| Android
    PWA & Android -->|Deep Link HTTPS| WA
```

#### Explicación de la Infraestructura de Despliegue:
1. **Vercel / Netlify / Supabase Hosting:** El bundle de la aplicación web y PWA compilado por Ionic/Angular se aloja en un hosting de archivos estáticos global (CDN). Esto reduce el coste de infraestructura web a prácticamente $0 USD durante las fases iniciales de la startup y garantiza tiempos de carga extremadamente bajos.
2. **Supabase Gateway:** Actúa como el único punto de entrada a las bases de datos de Supabase. Distribuye y balancea las peticiones de las aplicaciones clientes directamente hacia la base de datos PostgreSQL a través de PostgREST, garantizando seguridad y eficiencia sin necesidad de implementar balanceadores de carga físicos.
3. **Supabase Edge Functions:** Son funciones en la nube ligeras que se ejecutan en un entorno de Deno en servidores Edge (cercanos al usuario). Se utilizarán exclusivamente para interactuar con Firebase Cloud Messaging (FCM) y enviar notificaciones de manera segura, aislando las credenciales privadas de Firebase del código cliente de la app móvil.

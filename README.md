# VALLE-GO 🛒 - Marketplace Universitario

¡Bienvenido al repositorio oficial de **VALLE-GO**! Una plataforma diseñada específicamente para la comunidad estudiantil de la Universidad César Vallejo, permitiendo a los alumnos emprender y comprar productos dentro del campus de manera segura y eficiente.

---

## 🚩 Problema
Dentro de los campus universitarios, el comercio entre estudiantes (venta de postres, almuerzos, servicios técnicos, etc.) suele ser desorganizado, basándose principalmente en grupos de WhatsApp o el "boca a boca". Esto genera varios inconvenientes:
- **Dificultad para encontrar productos:** Los compradores no tienen un catálogo centralizado.
- **Incertidumbre en la entrega:** No hay un sistema de seguimiento del estado de los pedidos.
- **Falta de visibilidad para emprendedores:** Los alumnos con pequeños negocios no tienen herramientas para gestionar su stock o medir sus ventas.

---

## 💡 Solución
**VALLE-GO** centraliza la oferta y demanda del campus en una aplicación híbrida (Web/Móvil) con interfaces modernas basadas en un diseño **Premium Figma**.
- **Para Compradores:** Un catálogo categorizado con buscador inteligente, carruseles de productos populares y seguimiento vertical de pedidos en tiempo real.
- **Para Emprendedores:** Un Dashboard profesional con métricas de ventas, gestión de inventario con carga de imágenes "drag & drop" y un sistema de control de estados (Aceptar -> Preparar -> Listo).
- **Notificaciones Push:** Alertas en tiempo real vía **Firebase Cloud Messaging (FCM)** y Realtime de Supabase: pedidos nuevos, cambios de estado y cancelaciones (aviso al vendedor cuando el comprador cancela), además de avisos de reportes de producto al panel de administración.
- **Centro de Soporte:** Compradores y vendedores crean tickets de soporte; el equipo administrador responde y gestiona el estado, con notificaciones al autor del ticket.
- **Seguridad:** Registro exclusivo para correos institucionales `@ucv.edu.pe` o `@ucvvirtual.edu.pe`.

---

## 🛠️ Stack Tecnológico
Para garantizar robustez y escalabilidad, hemos utilizado un stack de última generación:

- **Frontend:** [Angular 20](https://angular.io/) con [Ionic Framework 8](https://ionicframework.com/) para una experiencia nativa fluida.
- **Mobile:** [Capacitor 8](https://capacitorjs.com/) para el despliegue en Android e iOS.
- **Backend/Database:** [Supabase](https://supabase.com/) (PostgreSQL) para la gestión de datos en tiempo real y autenticación.
- **Diseño:** Figma (UI/UX alineado con la identidad institucional UCV).
- **Lenguaje:** TypeScript / SCSS.

---

## 🚀 Cómo Ejecutar el Proyecto

### Requisitos Previos
- Node.js 22 (consulta `.nvmrc`; Angular también admite las versiones indicadas en `frontend/package.json`)
- Ionic CLI (`npm install -g @ionic/cli`)
- Una cuenta/proyecto en Supabase y sus credenciales públicas de cliente.

### Pasos para Web
1. **Clonar el repositorio:**
   ```bash
   git clone https://github.com/tu-usuario/UCV-Market.git
   cd UCV-Market/frontend
   ```
2. **Instalar dependencias:**
   ```bash
   npm ci
   ```
3. **Configurar variables de entorno:**
   Crea el archivo `.env` a partir de la plantilla y completa tus credenciales de Supabase:
   ```bash
   cp .env.example .env
   ```
   Edita `.env` (nunca lo subas al repositorio):
   ```dotenv
   SUPABASE_URL=TU_URL_DE_SUPABASE
   SUPABASE_KEY=TU_ANON_KEY
   ```
   > Los archivos `src/environments/environment.ts` y `environment.prod.ts` se generan automáticamente y no se versionan. En Cloudflare Pages y CI define `SUPABASE_URL` y `SUPABASE_KEY` como variables del proyecto.
4. **Ejecutar el servidor de desarrollo:**
   ```bash
   npm start
   ```
   *La app se abrirá en `http://localhost:8100`*

### Pasos para Android
1. **Generar el build de producción:**
   ```bash
   ionic build
   ```
2. **Sincronizar con Capacitor:**
   ```bash
   npx cap sync android
   ```
3. **Abrir en Android Studio:**
   ```bash
   npx cap open android
   ```
4. **Ejecutar desde Android Studio** en tu dispositivo físico o emulador.

### Validaciones antes de abrir un Pull Request

Desde `frontend/`, con las variables de entorno configuradas:

```bash
npm run lint
npm test -- --watch=false --browsers=ChromeHeadless
npm run build
```

### Despliegue web en Cloudflare Pages

Cloudflare Pages es el hosting web oficial. El proyecto compila desde `frontend/` con `npm run build` y publica el directorio `www/`. El despliegue manual autorizado puede ejecutarse con:

```bash
npm run deploy:web
```

El despliegue automático debe ejecutarse únicamente desde `main` después de superar las validaciones.

---

## 🗂️ Estructura del repositorio

```text
UCV-Market/
├── .github/             # CI y plantilla de Pull Request
├── docs/                # Arquitectura, requisitos y operación
├── frontend/            # Ionic/Angular y proyecto nativo Capacitor
└── supabase/
    ├── functions/       # Edge Functions
    ├── migrations/      # Única fuente de verdad del esquema SQL
    └── seed.sql
```

Los APK/AAB y las carpetas `build/` o `www/` son productos generados y no se guardan en Git.

---

## 📚 Documentación Técnica
La documentación detallada del proyecto (requisitos, arquitectura y UML, diseño de módulos, y estrategia de DevOps) se encuentra en la carpeta [`docs/`](docs/):
- `01_requirements_analysis.md` — Análisis de requisitos, historias de usuario y sprints.
- `02_architecture_and_uml.md` — Arquitectura, diagramas de componentes y despliegue.
- `03_module_and_feature_design.md` — Diseño de módulos, RLS, transacciones y notificaciones serverless.
- `04_devops_and_business_strategy.md` — Pipeline de despliegue, estrategia de negocio y buenas prácticas.

---

## 👨‍💻 Contribuciones
La rama `main` debe permanecer desplegable. Trabaja en una rama corta, ejecuta las validaciones y abre un Pull Request para revisión del compañero. Consulta [`CONTRIBUTING.md`](CONTRIBUTING.md) para las reglas de ramas, commits, migraciones y despliegues.

---
*Desarrollado para la comunidad de la Universidad César Vallejo.*

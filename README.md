# VALLE-GO 🛒 - Marketplace Universitario

¡Bienvenido al repositorio oficial de **VALLE-GO** (antes UCV Market)! Una plataforma diseñada específicamente para la comunidad estudiantil de la Universidad César Vallejo, permitiendo a los alumnos emprender y comprar productos dentro del campus de manera segura y eficiente.

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
- Node.js (v18 o superior)
- Ionic CLI (`npm install -g @ionic/cli`)
- Una cuenta/proyecto en Supabase (opcional para desarrollo local si ya tienes las keys).

### Pasos para Web
1. **Clonar el repositorio:**
   ```bash
   git clone https://github.com/tu-usuario/UCV-Market.git
   cd UCV-Market/frontend
   ```
2. **Instalar dependencias:**
   ```bash
   npm install
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
   > Los archivos `src/environments/environment.ts` y `environment.prod.ts` se generan automáticamente con `npm run generate-env` (incluido en `npm start` y `npm run build`). En Netlify/CI define `SUPABASE_URL` y `SUPABASE_KEY` como variables de entorno del proyecto.
4. **Ejecutar el servidor de desarrollo:**
   ```bash
   ionic serve
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

---

## 👨‍💻 Contribuciones
Este proyecto fue desarrollado siguiendo principios de **Clean Architecture** y **Diseño Responsivo**. Si deseas contribuir, por favor abre un *Pull Request* o reporta un *Issue*.

---
*Desarrollado para la comunidad de la Universidad César Vallejo.*

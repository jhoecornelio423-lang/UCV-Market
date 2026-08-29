# Navegación móvil por panel lateral y correcciones administrativas

## Objetivo

Reemplazar las barras inferiores de comprador, vendedor y administrador por un encabezado uniforme y un panel lateral izquierdo en móvil y tablet, sin alterar la navegación contextual de las subpantallas ni las barras laterales de escritorio. Corregir en el mismo conjunto los problemas de responsive, operación y accesibilidad comprobados en el panel administrador.

## Alcance

- Comprador: catálogo, explorar, pedidos, favoritos y perfil.
- Vendedor: dashboard, pedidos, productos, estadísticas y negocio.
- Administrador: dashboard, vendedores, usuarios, productos, categorías, soporte y reportes.
- Breakpoint único: móvil/tablet por debajo de `992px`; escritorio desde `992px`.
- No se cambia el esquema de Supabase, los repositorios de datos, los guards ni los permisos.
- No se muestra navegación global en detalle de producto, carrito, checkout, seguimiento, formularios, soporte contextual, notificaciones ni otras rutas secundarias.

## Arquitectura de navegación

Se añadirá un componente compartido `RoleMobileNavigationComponent` en `shared/components/role-mobile-navigation`. El componente recibirá una configuración tipada con identidad del rol, rutas, iconos, insignias opcionales y ruta activa. Emitirá las acciones de cierre de sesión y, cuando el shell lo requiera, la solicitud de abrir notificaciones.

Cada shell de rol conservará la responsabilidad de:

1. Determinar si la URL actual pertenece a su allowlist exacta de rutas principales.
2. Proporcionar los destinos y las insignias propias del rol.
3. Ejecutar el cierre de sesión mediante `AuthService`.
4. Resolver la acción de notificaciones con el comportamiento que ya posee ese rol.

El componente compartido será responsable de:

1. Mostrar el encabezado uniforme con botón `☰`, marca VALLE-GO, etiqueta del rol y zona de acciones.
2. Abrir un `ion-menu` desde la izquierda con backdrop y navegación etiquetada.
3. Marcar el destino activo mediante comparación exacta de la URL normalizada.
4. Cerrar el panel al navegar, tocar el backdrop o pulsar `Esc`.
5. Mostrar “Cerrar sesión” al final del panel.
6. Garantizar objetivos interactivos de al menos `44 × 44px`.

Las allowlists existentes de comprador y vendedor se reutilizarán. Se añadirá una allowlist equivalente para administrador. Las tres barras inferiores y sus estilos se eliminarán completamente.

## Encabezado y comportamiento responsive

- Por debajo de `992px`, las rutas principales muestran el encabezado y el panel lateral compartidos.
- Desde `992px`, el encabezado móvil y el `ion-menu` permanecen ocultos; se conservan las barras laterales existentes.
- Las rutas secundarias no reservan espacio para el encabezado compartido.
- La ruta activa tiene indicador visual y `aria-current="page"`.
- El botón del menú expone `aria-label`, `aria-expanded` y el vínculo con el panel.
- El foco vuelve al botón de apertura después de cerrar el panel.
- Los encabezados internos de cada pantalla conservan su título y contenido, pero se eliminan acciones duplicadas cuando el encabezado compartido ya las proporciona.

## Correcciones del administrador

### Breakpoint de 768px

El panel administrador dejará de combinar `ion-hide-md-*` con una regla personalizada `max-width: 768px`. Usará el mismo límite `lg` que comprador y vendedor, evitando que el sidebar visible se coloque encima de un layout en columna.

### Soporte móvil

- El contenedor principal permitirá desplazamiento vertical real y reservará espacio para el encabezado.
- La barra de acciones será alcanzable y no quedará recortada por `overflow: hidden`.
- Los tickets se convertirán en botones semánticos con foco visible y selección anunciada.
- Los tickets con estado `resolved`, `rejected` o `closed` deshabilitarán prioridad, estado, vinculación, desestimación, advertencia y baneo.
- La navegación entre comprador y vendedor seguirá disponible únicamente cuando exista el participante correspondiente.

### Usuarios y vendedores

- En móvil se mostrarán tarjetas con identidad, campus/negocio, estado y acción principal.
- En tablet y escritorio se conservarán las tablas.
- La acción de suspender o reactivar tendrá nombre accesible específico para cada persona y un área mínima de `44 × 44px`.
- La versión móvil no dependerá de desplazamiento horizontal para llegar a estado o acciones.

### Accesibilidad y textos

- Los filtros, buscadores, notificaciones, cierre de sesión y acciones destructivas tendrán áreas mínimas de `44 × 44px`.
- Los gráficos `canvas` tendrán nombre y descripción accesibles, además de un resumen textual con los valores representados.
- “Gestión de Usuarios” será el `h1` principal.
- Los contadores usarán singular y plural correctos, por ejemplo `1 reporte` y `2 reportes`.
- Las imágenes usarán textos alternativos localizados y descriptivos.
- “Marcar leídas” se ocultará o deshabilitará cuando no haya notificaciones sin leer.
- Los elementos que navegan o ejecutan acciones serán botones o enlaces reales, no `div` clicables.

## Estado, datos y errores

El panel lateral solo mantiene estado visual local abierto/cerrado. Un `NavigationEnd` actualiza la ruta activa y cierra el menú. Las insignias continúan leyendo los observables y contadores actuales; el componente compartido no consulta Supabase.

Los fallos de cierre de sesión mantienen el comportamiento existente de cada shell. Abrir o cerrar el menú nunca modifica datos. Las acciones administrativas conservan sus confirmaciones actuales; esta entrega solo impide presentarlas como disponibles cuando el estado del ticket no las admite.

## Pruebas

### Automatizadas

- El componente compartido abre y cierra el panel, refleja `aria-expanded`, marca la ruta activa, emite cierre de sesión y cierra tras navegar.
- Cada shell muestra navegación en sus rutas principales y la oculta en rutas secundarias.
- La allowlist administrativa usa coincidencia exacta y normaliza query, fragmento y slash final.
- Las disputas cerradas deshabilitan todos los controles mutables y las abiertas conservan sus acciones válidas.
- Usuarios y vendedores renderizan la información y nombres accesibles requeridos por las tarjetas móviles.
- Notificaciones sin elementos no ofrecen una acción “Marcar leídas” activa.
- Los contadores cubren singular y plural.

### Verificación técnica

- `npm run lint`
- `npm test -- --watch=false --browsers=ChromeHeadless`
- `npm run build`

### Verificación en navegador

- Comprador, vendedor y administrador a `390 × 844`, `768 × 1024` y `1280 × 720`.
- Sin barras inferiores ni desbordamiento horizontal del documento.
- Menú visible solo en rutas principales por debajo de `992px`.
- Sidebars intactos desde `992px`.
- Menú operable con teclado, backdrop y `Esc`.
- Soporte móvil permite alcanzar conversación y acciones sin modificar datos.
- Guards de rol continúan redirigiendo accesos cruzados.

## Criterios de aceptación

1. No existe ninguna barra de navegación inferior para los tres roles.
2. Todas las rutas principales móviles/tablet comparten el mismo patrón de encabezado y panel lateral.
3. Ninguna ruta secundaria muestra navegación global.
4. El layout funciona sin salto ni espacio vacío a 768px.
5. Estado y acciones de Usuarios y Vendedores son accesibles sin scroll horizontal en móvil.
6. Una disputa cerrada no permite mutaciones y su contenido completo es alcanzable en móvil.
7. Los controles auditados cumplen el objetivo mínimo de `44 × 44px` y los gráficos poseen alternativa accesible.
8. Lint, pruebas, build y revisión responsive finalizan correctamente.

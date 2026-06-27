# Especificación Técnica de SEO · Eskemma
### Documento maestro de auditoría y estándares de construcción

---

## Nota metodológica

Este documento consolida los hallazgos de tres cuerpos de conocimiento revisados entre junio de 2026: el curso de SEO Técnico de Natalia Prieto (Platzi), el curso de SEO Técnico de Alejandro González (Platzi), y un curso de AEO/GEO sobre optimización para motores de respuesta de inteligencia artificial. El propósito es traducir las buenas prácticas y metodologías de auditoría de ambos cursos al contexto específico de Eskemma: una plataforma construida en Next.js, desplegada en Vercel, con backend en Firebase Cloud Functions Gen2, actualmente en fase de construcción activa.

Cada factor técnico se organiza en dos vertientes. La primera, identificada como Vertiente A, corresponde a correcciones o verificaciones sobre lo que ya está construido del sitio. La segunda, identificada como Vertiente B, corresponde a estándares que deben observarse durante la construcción de las páginas y componentes pendientes, de modo que no se introduzcan los mismos errores que la auditoría busca prevenir.

Una advertencia recurrente a lo largo de ambos cursos, y que aplica con particular fuerza al stack de Eskemma, es que buena parte de las optimizaciones que en un sitio HTML clásico o WordPress requieren implementación manual, en Next.js están resueltas nativamente por el framework cuando se usa correctamente, y se rompen precisamente cuando se usa incorrectamente. Este documento señala explícitamente esos puntos de riesgo.

---

## Índice

1. Rastreo e indexación
2. Arquitectura del sitio web
3. On-page técnico
4. Rendimiento y velocidad de carga
5. JavaScript y renderizado (Next.js)
6. Contenido enriquecido, schema y AEO
7. Off-page
8. Roadmap consolidado de implementación
9. Anexo de herramientas de auditoría

---

## 1. Rastreo e indexación

Esta sección cubre todo lo relacionado con la capacidad de Google de encontrar, rastrear e indexar el sitio. Es la base sobre la que se construye cualquier otro esfuerzo de posicionamiento: si el rastreo o la indexación fallan, ninguna optimización posterior tiene efecto.

### 1.1 Estado de indexación del sitio

**Qué es.** Verificar si el sitio aparece en el índice de Google mediante el operador `site:eskemma.com` en una búsqueda directa. Es la primera comprobación de cualquier auditoría y el punto de referencia para medir progreso.

**Vertiente A — verificar en lo construido.** En cuanto el dominio eskemma.com esté públicamente accesible, ejecutar `site:eskemma.com` en Google para confirmar indexación. Si no aparece ninguna página, las causas más probables están en los puntos 1.2 y 1.3 (bloqueo por robots.txt o etiqueta meta robots).

**Vertiente B — estándar de construcción.** No se requiere ninguna acción de desarrollo aquí; es un punto de verificación periódica, no de implementación.

### 1.2 Archivo robots.txt

**Qué es.** Archivo de texto en la raíz del dominio (`eskemma.com/robots.txt`) que comunica a los rastreadores qué rutas pueden o no pueden visitar, mediante las directivas `Allow` y `Disallow`. Next.js permite generarlo de forma dinámica mediante un archivo `robots.ts` en el directorio `app/`.

**Vertiente A — verificar en lo construido.** Revisar el contenido actual de robots.txt en cuanto exista. Comprobar específicamente que no contenga un `Disallow: /` global por error de configuración heredado de un entorno de desarrollo o staging — este es el error más grave y común que documentan ambos cursos. Confirmar que las rutas bloqueadas sean efectivamente rutas sin valor de búsqueda (por ejemplo, rutas de autenticación, checkout si aplica, o paneles internos de usuario), nunca contenido editorial o de producto.

**Vertiente B — estándar de construcción.** Bloquear explícitamente desde el inicio las rutas de login, dashboard de usuario autenticado, y cualquier ruta de procesamiento interno de Moddulo que no deba indexarse (por ejemplo, vistas de trabajo en progreso dentro de una fase). No bloquear nunca el blog, las páginas de producto (`/moddulo`, `/sefix`), la landing del lead magnet, ni el glosario. Incluir la referencia al sitemap dentro del propio robots.txt, que es la práctica que ambos cursos señalan como más confiable cuando el archivo se genera dinámicamente.

Es importante notar que el curso de Alejandro González señala explícitamente que la directiva `noindex` dentro de robots.txt deja de ser soportada por Google; el control de indexación por página debe hacerse exclusivamente mediante la etiqueta meta robots (ver 1.3), nunca desde robots.txt.

### 1.3 Etiqueta meta robots

**Qué es.** Etiqueta HTML (`<meta name="robots" content="noindex">`) o su equivalente en cabeceras HTTP (`X-Robots-Tag`), que indica página por página si debe o no indexarse. A diferencia de robots.txt, que bloquea el rastreo, esta etiqueta permite el rastreo pero impide la indexación — la distinción es relevante porque una página bloqueada por robots.txt puede aún aparecer en resultados sin descripción si otros sitios la enlazan, mientras que `noindex` la excluye por completo.

**Vertiente A — verificar en lo construido.** Auditar con Screaming Frog o una herramienta equivalente (Seolizer, Spotivo, mencionadas en el curso de González) cuáles páginas tienen la etiqueta y cuáles deberían tenerla pero no la tienen. Las candidatas típicas en Eskemma son: páginas de "próximamente" para Sefix y PESTEL mientras no estén activas, vistas de error o estados intermedios de Moddulo, y cualquier página generada automáticamente sin contenido sustantivo.

**Vertiente B — estándar de construcción.** En Next.js (App Router), esto se controla mediante el objeto `metadata` exportado en cada archivo `page.tsx`, con el campo `robots: { index: false, follow: true }` o equivalente. Establecer como convención del proyecto que toda página nueva declare explícitamente su política de indexación en el momento de creación, no como tarea posterior — esto evita el patrón de "página huérfana sin metadata" que ambos cursos identifican como el hallazgo más frecuente en auditorías reales (la página de checkout sin título, sin H1, sin metadata, fue el ejemplo recurrente en el curso de González).

### 1.4 Mapa de sitio XML (sitemap)

**Qué es.** Archivo XML que enumera las URLs del sitio que deben indexarse, facilitando que Google las descubra sin depender exclusivamente del rastreo por enlaces internos. Se envía a Google Search Console y se referencia en robots.txt.

**Vertiente A — verificar en lo construido.** Una vez generado, confirmar con Screaming Frog (función Crawl Analysis → "URLs not in sitemap") que todas las URLs indexables del sitio están efectivamente listadas. Verificar también el caso inverso: que el sitemap no incluya rutas con `noindex`, bloqueadas, o redirigidas — un sitemap con URLs muertas es señal de mala calidad para Google y desperdicia presupuesto de rastreo.

**Vertiente B — estándar de construcción.** Next.js permite generar el sitemap dinámicamente mediante un archivo `sitemap.ts` en `app/`, que puede construirse a partir de las rutas reales del CMS o base de datos (Firestore, en el caso de Eskemma) en lugar de mantenerlo manualmente. Esto es preferible a un sitemap estático porque se mantiene sincronizado automáticamente con cada artículo nuevo del blog "El Baúl de Fouché" sin intervención manual — resuelve de raíz el problema de sitemaps desactualizados que el curso de González señala como tarea de mantenimiento constante en sitios tradicionales. Una vez generado, enviarlo a Google Search Console desde el primer despliegue público del dominio.

### 1.5 Certificado de seguridad SSL (HTTPS)

**Qué es.** Protocolo de cifrado que Google utiliza como factor de ranking desde hace varios años, y que además determina si el navegador muestra el sitio como "seguro" o emite una advertencia al usuario.

**Vertiente A — verificar en lo construido.** Vercel provisiona y renueva certificados SSL automáticamente para todos los dominios y subdominios conectados, por lo que este punto debería estar resuelto por defecto. La verificación pendiente es de otro tipo: auditar con Screaming Frog que no existan enlaces internos que apunten a versiones `http://` en lugar de `https://` — el curso de González documenta este error como sorprendentemente común incluso en sitios que sí tienen el certificado correctamente instalado, porque queda un enlace suelto en un logo, un menú o un componente reutilizado que nadie revisó.

**Vertiente B — estándar de construcción.** Establecer como regla de codificación que ninguna URL interna se escriba jamás con protocolo explícito `http://` o `https://` hacia el propio dominio; deben usarse siempre rutas relativas (`/blog/articulo`) o el componente `<Link>` de Next.js, que elimina por completo la posibilidad de este error.

### 1.6 Redirecciones de protocolo y www

**Qué es.** Todo dominio es accesible potencialmente por cuatro combinaciones (con/sin `www`, http/https). Debe elegirse una versión canónica y redirigir las otras tres mediante redirecciones 301 permanentes, para que Google no interprete el sitio como cuatro sitios distintos con contenido duplicado.

**Vertiente A — verificar en lo construido.** Probar las cuatro combinaciones de eskemma.com con una herramienta como HTTP Status o Redirect Path, y confirmar que las tres no canónicas redirigen con código 301 a la versión elegida, sin errores intermedios.

**Vertiente B — estándar de construcción.** Vercel resuelve esto de forma centralizada en la configuración de dominios del proyecto, donde se define el dominio primario y se configura la redirección automática de las variantes. Decisión a tomar una sola vez al configurar el dominio: si Eskemma usará `www.eskemma.com` o `eskemma.com` sin subdominio como versión canónica — ambas son válidas, lo que importa es la consistencia y que quede declarada explícitamente en la configuración de Vercel desde el primer despliegue, no como ajuste posterior.

### 1.7 Contenidos duplicados y etiqueta canonical

**Qué es.** Cuando dos o más URLs sirven el mismo contenido (por ejemplo, un producto accesible desde dos categorías distintas), Google no sabe cuál posicionar y divide la autoridad entre ambas. Se resuelve con la etiqueta `<link rel="canonical">`, que declara cuál es la URL "original" a efectos de indexación.

**Vertiente A — verificar en lo construido.** Este riesgo es particularmente relevante para Eskemma en dos frentes. Primero, si el blog permite filtrar artículos por categoría o etiqueta y esos filtros generan parámetros de URL (`?categoria=estrategia`), cada combinación puede generarse como página indexable distinta sin serlo conceptualmente. Segundo, si en algún momento Sefix expone vistas de datos electorales filtrables por municipio, estado o año, el mismo patrón de duplicidad por filtros es exactamente el caso que ambos cursos documentan extensamente con el sitio de e-commerce de ejemplo (categorías con y sin marca generando el mismo listado de productos).

**Vertiente B — estándar de construcción.** En Next.js, el campo `alternates: { canonical: '...' }` dentro del objeto `metadata` de cada página resuelve esto de forma explícita. Como regla general: toda página filtrable o paginada debe declarar su canonical apuntando a la versión sin filtros cuando el contenido subyacente es el mismo, y debe evaluarse caso por caso si una combinación de filtros merece ser indexable por sí misma (por ejemplo, una vista de "artículos del blog sobre estrategia electoral" sí podría justificar su propia indexación si tiene volumen de búsqueda propio, mientras que una vista de datos de Sefix filtrada por un municipio muy específico probablemente no).

### 1.8 Respuestas del servidor: redirecciones 3XX y errores 4XX/5XX

**Qué es.** Códigos de estado HTTP que el servidor devuelve ante cada solicitud. Los relevantes para SEO son el 301 (redirección permanente), 302 (redirección temporal), 404 (no encontrado) y 500 (error de servidor). Un patrón de error frecuente es que una página muestre visualmente un mensaje de "no encontrado" sin que el servidor devuelva efectivamente el código 404 — Google interpreta esto como una página válida con poco contenido, no como una ausencia.

**Vertiente A — verificar en lo construido.** Auditar con Screaming Frog o Seolizer la lista completa de códigos de respuesta del sitio. Verificar específicamente, con una herramienta como Link Redirect Trace, que la página de error personalizada de Eskemma devuelve efectivamente el código 404 del servidor y no únicamente un 200 con contenido de "página no encontrada". Revisar también que no existan enlaces internos apuntando a URLs que ya redirigen (encadenamiento de redirecciones), actualizando esos enlaces para que apunten directamente al destino final.

**Vertiente B — estándar de construcción.** Next.js gestiona esto de forma nativa mediante el archivo `not-found.tsx`, que sí devuelve el código 404 correcto sin necesidad de configuración adicional — siempre que se use el mecanismo del framework (`notFound()` desde una Server Component o Route Handler) y no se simule el estado de error únicamente a nivel visual con una condición en el cliente. Establecer como estándar que cualquier flujo donde un usuario pueda llegar a contenido inexistente (un artículo eliminado del blog, una fase de Moddulo que no aplica al tipo de proyecto del usuario, una página de resultado de Sefix para un municipio sin datos) invoque explícitamente `notFound()` del lado del servidor.

---

## 2. Arquitectura del sitio web

Esta sección cubre cómo se organiza y conecta internamente el sitio: la estructura de URLs, la profundidad de navegación, la paginación y la semántica del HTML. Mientras la sección anterior determinaba si Google puede llegar al sitio, esta determina si, una vez dentro, puede entenderlo y recorrerlo eficientemente. El concepto que atraviesa toda la sección, tomado del curso de Alejandro González, es el de presupuesto de rastreo (crawl budget): Google asigna un límite de recursos a cada sitio para rastrearlo, y una arquitectura deficiente desperdicia ese presupuesto en rutas sin valor en lugar de en contenido relevante.

### 2.1 URLs amigables

**Qué es.** Las URLs deben ser legibles, descriptivas, separadas por guiones medios (nunca guiones bajos ni espacios), sin caracteres especiales, sin tildes, sin mayúsculas y sin parámetros de filtro innecesarios. Una URL bien construida le comunica a Google y al usuario el contenido de la página antes de que cargue.

**Vertiente A — verificar en lo construido.** Auditar con Spotivo o Screaming Frog que ninguna URL del sitio contenga caracteres especiales, espacios codificados, o parámetros de filtro técnico expuestos (el ejemplo documentado en ambos cursos es el de URLs de e-commerce que exponen códigos internos de filtro como `?f=284_20`, que no tienen ningún valor semántico). Revisar específicamente las rutas generadas por Sefix si en algún momento exponen filtros de búsqueda sobre datos electorales.

**Vertiente B — estándar de construcción.** La convención ya definida en la arquitectura de Eskemma (`eskemma.com/blog/estrategia-politica`, máximo 5 palabras, sin artículos ni preposiciones) cumple este estándar y debe mantenerse sin excepción para toda ruta nueva. Una regla adicional que aporta este bloque y que conviene formalizar: nunca incluir fechas en las URLs del blog (evitar patrones como `/blog/2026/06/articulo`), porque comunican obsolescencia incluso cuando el contenido sigue vigente — esto ya estaba implícito en el trabajo previo de Eskemma pero conviene declararlo explícitamente como regla.

### 2.2 Profundidad y niveles de navegación

**Qué es.** La profundidad de una página se mide por cuántos clics de distancia está del home siguiendo la estructura de enlaces internos, no por la longitud de su URL. Google trata el nivel 5 como el límite razonable; a partir del nivel 6 la probabilidad de rastreo decae significativamente. Cuanto más cerca del home esté enlazada una página, mayor importancia relativa le asigna Google.

**Vertiente A — verificar en lo construido.** Una vez el sitio esté navegable, usar Seolizer (función Depth) para mapear visualmente la profundidad de cada sección. Verificar en particular que las páginas de producto (`/moddulo`, `/sefix`) y los artículos pilares del blog estén enlazados a no más de 2 niveles del home, dado que son las páginas que concentran la estrategia de clusters de contenido definida en el plan SEO de Eskemma.

**Vertiente B — estándar de construcción.** Diseñar la navegación principal y el footer de modo que los artículos pilares de cada cluster temático (C1 a C7, según el plan MAES ya trabajado) sean accesibles en máximo 2 niveles desde el home, reservando niveles más profundos únicamente para artículos satélite y contenido de cola larga. El glosario de comunicación política, al ser una página de tráfico constante pero no prioritaria en jerarquía de negocio, puede vivir en un nivel 2 o 3 sin afectar su rendimiento, siempre que tenga suficiente interlinking desde los artículos del blog que mencionen los términos.

### 2.3 Rutas de navegación (breadcrumbs)

**Qué es.** Elemento de navegación visible que muestra al usuario su ubicación jerárquica dentro del sitio (Home > Blog > Estrategia política > artículo) y que simultáneamente comunica a Google la categorización del contenido. Tiene su propio tipo de schema markup asociado (`BreadcrumbList`).

**Vertiente A — verificar en lo construido.** Confirmar que cada artículo del blog y cada página de producto implemente breadcrumbs visibles y con el schema correspondiente, no solo el componente visual sin marcado estructurado.

**Vertiente B — estándar de construcción.** Implementar un componente de breadcrumbs reutilizable que genere automáticamente tanto el HTML visible como el JSON-LD de `BreadcrumbList` a partir de la ruta actual, de modo que no dependa de que cada página declare esto manualmente. Esto es coherente con el plan de arquitectura del sitio ya definido para Eskemma, donde el blog está organizado en silos temáticos (`/blog/estrategia-politica`, `/blog/opinion-publica`, etc.) — la estructura de carpetas ya implica la jerarquía que el breadcrumb debe reflejar.

### 2.4 Paginación y carga de contenido dinámico

**Qué es.** Cuando un listado de contenido se divide en páginas o se carga mediante scroll infinito, Google debe poder rastrear cada fragmento como una URL distinta y verificable, no solo como un cambio visual dentro de la misma URL. El error documentado en el curso de González es el de un elemento de paginación que cambia el contenido visible en pantalla sin cambiar la URL ni cargar el contenido del lado del servidor — en ese caso, Google nunca llega a ver el contenido de la segunda página.

**Vertiente A — verificar en lo construido.** Si el blog de Eskemma implementa paginación de artículos (página 1, página 2, etc.) o un listado filtrable de recursos, verificar con la herramienta de prueba de compatibilidad móvil de Google, o inspeccionando directamente el HTML servido (no el renderizado final en pantalla), que el contenido de cada página de resultados es efectivamente parte del documento que Google recibe.

**Vertiente B — estándar de construcción.** Este es uno de los puntos donde la elección correcta de la estrategia de renderizado de Next.js resuelve el problema de raíz: si los listados paginados del blog se construyen como Server Components con rutas dedicadas (`/blog/page/2`) en lugar de como estado de cliente que oculta y muestra elementos sin cambiar de URL, el contenido está presente en el HTML inicial sin necesidad de optimizaciones adicionales. Se profundiza en esta distinción en la sección 5 (JavaScript y renderizado).

### 2.5 Semántica del HTML

**Qué es.** Que los elementos visuales del sitio usen la etiqueta HTML que corresponde a su función real: un título debe ser una etiqueta `<h1>`-`<h6>` y no un `<div>` con estilos que lo hacen parecer un título; un párrafo debe ser `<p>`; texto dentro de una imagen debe existir también como texto real fuera de la imagen. Esto no es un detalle estético sino la forma en que tanto el algoritmo de Google como los lectores de pantalla para personas con discapacidad visual interpretan qué es cada elemento del contenido.

**Vertiente A — verificar en lo construido.** Inspeccionar con las herramientas de desarrollo del navegador (clic derecho, inspeccionar elemento) los títulos principales de las páginas ya construidas de Eskemma, confirmando que el título visual coincide con una etiqueta `<h1>` real y no con un `<div>` o `<span>` estilizado para aparentarlo. Verificar especialmente cualquier texto que actualmente exista únicamente dentro de una imagen (por ejemplo, si el logo o algún banner contiene texto incrustado en el archivo gráfico en lugar de como texto HTML superpuesto).

**Vertiente B — estándar de construcción.** Dado que Eskemma usa Tailwind CSS, existe un riesgo específico y frecuente: es perfectamente posible (y visualmente indistinguible) crear un `<div>` con clases de Tailwind que imite el tamaño y peso de un título sin que sea semánticamente un título. La regla de construcción debe ser: la elección de la etiqueta HTML se decide primero por su función semántica (¿es el título principal de la página? `<h1>`. ¿Es un subtítulo de sección? `<h2>`) y solo después se le aplican las clases de Tailwind para el estilo visual — nunca al revés. Esto conecta directamente con la jerarquía tipográfica ya definida en el manual de estilo de Eskemma (Arimo en variantes de peso y tamaño): esa jerarquía visual debe mapear siempre a una jerarquía semántica de etiquetas H, no solo a clases de utilidad visual.

---

## 3. On-page técnico

Es importante aclarar, siguiendo la distinción que hace explícita el curso de Alejandro González, que "on-page" no significa "dentro del sitio" en sentido amplio, sino específicamente los elementos que se editan dentro del contenido mismo de cada página. Estos elementos tienen dos frentes distintos: uno técnico (¿existe la etiqueta, está duplicada, tiene la longitud correcta?) y uno estratégico (¿el texto está bien redactado, usa las palabras clave correctas, persuade al lector?). Esta sección cubre exclusivamente el frente técnico; el frente estratégico de redacción y keywords pertenece al trabajo editorial ya desarrollado en la metodología MAES de Eskemma y no se duplica aquí.

### 3.1 Meta título (title tag)

**Qué es.** El texto que aparece como enlace clicable en los resultados de búsqueda y en la pestaña del navegador. Debe ser único por página, contener la palabra clave principal cerca del inicio, y caber dentro del espacio visual que Google reserva en el snippet (aproximadamente 50-60 caracteres, aunque el límite real es de espacio visual, no de conteo de caracteres, por lo que letras anchas como la "O" caben menos que letras angostas como la "I").

**Vertiente A — verificar en lo construido.** Auditar con Spotivo o Screaming Frog (pestaña Page Titles) tres problemas específicos: títulos duplicados entre páginas distintas, títulos ausentes, y títulos que exceden el espacio visual del snippet. El error de títulos duplicados es señalado como de prioridad alta en ambos cursos porque Google no puede diferenciar páginas que aparentan ser el mismo contenido.

**Vertiente B — estándar de construcción.** En Next.js, el campo `title` dentro de `metadata` debe declararse de forma única en cada `page.tsx`, nunca heredado sin modificación desde un layout compartido. Para contenido generado dinámicamente desde Firestore (artículos del blog, fichas de fases de Moddulo), el título debe construirse a partir de un campo propio del documento de datos, nunca derivado automáticamente de forma genérica (por ejemplo, nunca un patrón como "Artículo - Eskemma" repetido para todos los artículos). Verificar la longitud con la herramienta SERP Simulator de Mangools antes de publicar cada pieza, como ya está establecido en el flujo de planeación de contenidos de Eskemma.

### 3.2 Meta descripción

**Qué es.** El texto descriptivo que aparece bajo el título en el snippet de búsqueda. No es un factor de ranking directo, pero influye fuertemente en el CTR (la proporción de personas que hacen clic frente a las que ven el resultado), que sí es una señal indirecta de relevancia para Google.

**Vertiente A — verificar en lo construido.** Auditar duplicados, ausencias, y descripciones que excedan el espacio visual disponible (aproximadamente 150-160 caracteres, con la misma advertencia sobre espacio visual frente a conteo de caracteres). A diferencia del título, ambos cursos coinciden en que no es estrictamente necesario que cada página tenga una meta descripción manual: para páginas de bajo valor estratégico, Google puede generar una automáticamente a partir del contenido. La prioridad debe concentrarse en las páginas de mayor valor: home, páginas de producto, artículos pilares del blog, y la landing del lead magnet.

**Vertiente B — estándar de construcción.** Redactar manualmente la meta descripción únicamente para las páginas de alto valor estratégico ya identificadas en la planeación de contenidos de Eskemma (los 5 contenidos prioritarios de Q1 ya tienen su meta descripción definida en el trabajo previo). Para contenido de cola larga o generado en volumen, permitir que el campo quede ausente antes que forzar una descripción genérica repetida, que sería un error peor que la ausencia.

### 3.3 Meta keywords

**Qué es.** Etiqueta HTML obsoleta desde hace aproximadamente ocho años, que Google deja explícitamente de usar como factor de ranking. Su presencia no perjudica directamente, pero su uso es señal de desactualización en la implementación y en algunos casos puede leerse como intento de sobre-optimización.

**Vertiente A — verificar en lo construido.** Confirmar con Screaming Frog que esta etiqueta no esté presente en ninguna plantilla o componente del sitio. Es poco probable que aparezca en una construcción nueva en Next.js, pero vale la pena descartarlo explícitamente, especialmente si algún componente o plantilla fue adaptado de un boilerplate o ejemplo externo.

**Vertiente B — estándar de construcción.** No implementar esta etiqueta bajo ninguna circunstancia. No requiere ninguna otra acción.

### 3.4 Títulos H1

**Qué es.** El título principal del contenido de una página, que debe existir exactamente una vez por página (nunca cero, nunca más de una), debe ser semánticamente un `<h1>` real (ver punto 2.5), y debe ser único respecto al H1 de cualquier otra página del sitio.

**Vertiente A — verificar en lo construido.** Auditar con Screaming Frog tres escenarios de error: páginas sin H1, páginas con H1 duplicado respecto a otra página (típicamente generado por plantillas o filtros que producen el mismo título para variantes del mismo contenido), y páginas con múltiples H1 (frecuentemente un H1 visible y otro oculto por CSS que quedó de una iteración de diseño anterior). El curso de González documenta este último caso como particularmente insidioso porque es invisible para quien revisa solo la interfaz visual.

**Vertiente B — estándar de construcción.** Establecer como regla de componentización que el H1 se declare una sola vez por plantilla de página y que ningún componente reutilizable (header, hero section, card) incluya su propio H1 independiente — un error común en sistemas de componentes es que un componente de "encabezado de sección" se reutilice en una página donde ya existe otro H1 en otro lugar del árbol de componentes. Para contenido generado dinámicamente, el H1 debe construirse siempre a partir del título real de la pieza (el título del artículo, el nombre de la fase de Moddulo), nunca de un texto fijo de plantilla.

### 3.5 Contenido insuficiente ("contenido pobre")

**Qué es.** Páginas con menos de aproximadamente 350 palabras de texto real tienen mayor dificultad para posicionar, porque ofrecen poca señal semántica sobre la que Google pueda evaluar relevancia. Es frecuente que esto ocurra no por decisión editorial sino porque el contenido relevante está incrustado dentro de imágenes en lugar de existir como texto.

**Vertiente A — verificar en lo construido.** Identificar con Sideliner o el conteo de palabras de Screaming Frog las páginas con menor volumen de texto, prestando atención particular al home (que en muchos sitios concentra mensajes breves de marca dentro de elementos gráficos) y a páginas de producto que puedan depender de infografías o diagramas sin transcripción textual equivalente.

**Vertiente B — estándar de construcción.** Este punto ya está resuelto en gran medida por la planeación editorial de Eskemma, donde los artículos pilares se especifican en rangos de 2000 a 3000 palabras y los satélite entre 1000 y 1500. El riesgo real está en las páginas no editoriales: home, páginas de producto, y la página de "nosotros". Establecer como estándar que toda pieza visual de marca (manifiesto, propuesta de valor, diagramas de metodología) tenga su equivalente textual accesible en el HTML, no únicamente como imagen o componente gráfico SVG sin texto alternativo extenso.

### 3.6 Textos alternativos en imágenes (alt text)

**Qué es.** Atributo HTML (`alt="..."`) que describe el contenido de una imagen para los algoritmos de búsqueda, que no pueden "ver" la imagen directamente, y para personas que usan lectores de pantalla. Debe ser descriptivo y específico, no genérico ni forzado con palabras clave de forma artificial.

**Vertiente A — verificar en lo construido.** Auditar con Screaming Frog (pestaña Images) las imágenes sin atributo alt, y revisar manualmente una muestra de las que sí lo tienen para confirmar que son descriptivas y no genéricas (el ejemplo del curso de González de un alt text mejorable es "Sábanas, 400 hilos" en lugar de simplemente "sábanas").

**Vertiente B — estándar de construcción.** El componente `Image` de Next.js exige el atributo `alt` como prop obligatoria en TypeScript estricto, lo que ya ofrece una protección estructural contra la ausencia total del atributo. La disciplina pendiente es de calidad, no de presencia: redactar cada alt text describiendo específicamente el contenido visual (para los diagramas propios de metodología que son parte del diferencial de Eskemma, por ejemplo "Diagrama de las cuatro fases de la pirámide MAES aplicada a Eskemma" en lugar de un genérico "diagrama de metodología"), incorporando la palabra clave del artículo de forma natural cuando aplique sin forzarla.

---

## 4. Rendimiento y velocidad de carga

La velocidad de carga es, según ambos cursos, uno de los factores con mayor impacto directo tanto en experiencia de usuario como en señales de ranking, particularmente desde que Google incorporó las métricas de Core Web Vitals a su algoritmo. El dato de referencia que ambos cursos comparten es que más de la mitad de los usuarios abandona un sitio que no carga en menos de 3 a 4 segundos. Esta sección distingue dos tiempos que con frecuencia se confunden: el tiempo de respuesta del servidor (cuánto tarda en llegar el primer byte de información) y el tiempo total de carga (cuánto tarda la página en estar completamente visible e interactiva).

### 4.1 Tiempo de respuesta del servidor (TTFB)

**Qué es.** El Time To First Byte mide cuánto tiempo transcurre desde que se solicita una página hasta que el servidor empieza a responder, antes de que el navegador empiece siquiera a procesar el contenido. Un TTFB alto (el curso de González documenta casos de 7 a 12 segundos en sitios mal configurados) indica un problema de servidor o de backend, no del frontend ni del diseño de la página. El estándar de referencia es mantenerlo por debajo de 500 milisegundos.

**Vertiente A — verificar en lo construido.** Medir con la extensión Coinfo de Chrome (o el reporte equivalente de GTmetrics) el TTFB de las rutas ya desplegadas de Eskemma. Si el sitio usa Server-Side Rendering o Server Components que dependen de consultas a Firestore o de invocaciones a Firebase Cloud Functions Gen2 antes de poder renderizar, el TTFB depende directamente de la latencia de esas consultas, no solo de Vercel como infraestructura de hosting. Esto es relevante porque significa que un TTFB alto en Eskemma podría señalar una consulta a Firestore mal optimizada o una Cloud Function con cold start, no necesariamente un problema de configuración de Vercel.

**Vertiente B — estándar de construcción.** Establecer como práctica de desarrollo que toda página que dependa de datos dinámicos de Firestore evalúe si esos datos pueden obtenerse mediante generación estática (`generateStaticParams`, revalidación incremental) en lugar de en cada solicitud. Para el blog de Eskemma en particular, dado que los artículos no cambian con frecuencia una vez publicados, la estrategia de Incremental Static Regeneration (ISR) de Next.js es la opción de mejor rendimiento: el contenido se genera una vez y se revalida solo periódicamente, evitando que cada visita dependa de una consulta en vivo a Firestore.

### 4.2 Velocidad de carga total

**Qué es.** El tiempo acumulado desde la solicitud hasta que la página es completamente interactiva, que incluye el TTFB más el tiempo de descarga, procesamiento y renderizado de todos los recursos (HTML, CSS, JavaScript, imágenes). El estándar de referencia de ambos cursos es mantenerse por debajo de 4 segundos.

**Vertiente A — verificar en lo construido.** Medir con GTmetrics o PageSpeed Insights cada plantilla de página representativa (home, artículo de blog, página de producto), no solo el home. PageSpeed Insights, al estar construido sobre Lighthouse, es además la herramienta más alineada con las métricas reales de Core Web Vitals que Google usa como factor de ranking, por lo que conviene priorizarla sobre GTmetrics para Eskemma específicamente, aunque el curso de González prefiera GTmetrics por su lenguaje menos técnico.

**Vertiente B — estándar de construcción.** Vercel resuelve automáticamente buena parte de las optimizaciones que ambos cursos describen como tareas manuales: compresión Gzip/Brotli, code splitting de JavaScript por ruta, y servido desde CDN edge. El trabajo de construcción que sigue siendo responsabilidad del equipo de desarrollo es el correcto uso de estas capacidades nativas: usar `next/image` para todas las imágenes (con optimización y lazy loading automáticos), usar `next/font` para la carga de Arimo en lugar de importar la fuente mediante una etiqueta `<link>` externa a Google Fonts (lo que evita una solicitud de red adicional y un posible salto visual de fuente), y evitar dependencias de JavaScript pesadas para funcionalidades que pueden resolverse con CSS nativo.

### 4.3 Caché del navegador

**Qué es.** Instrucción que el servidor envía al navegador indicando durante cuánto tiempo debe conservar localmente los archivos del sitio (imágenes, CSS, JavaScript) sin tener que volver a descargarlos en visitas subsecuentes. El estándar documentado es un mínimo de un mes para archivos estáticos que no cambian con frecuencia.

**Vertiente A — verificar en lo construido.** Revisar en GTmetrics (sección "Leverage browser caching") la configuración actual de cabeceras de caché para los recursos estáticos del sitio.

**Vertiente B — estándar de construcción.** Vercel configura automáticamente cabeceras de caché de larga duración para los assets estáticos generados por Next.js (archivos en `/_next/static/`), por lo que este punto requiere mínima intervención manual si el proyecto usa las convenciones estándar del framework. El punto de atención queda en los archivos servidos directamente desde la carpeta `public/` (íconos, imágenes que no pasan por el componente `Image`, documentos descargables como el lead magnet en PDF): confirmar que el archivo `next.config.js` declare cabeceras de caché explícitas para esa carpeta si no se está usando ya el sistema de assets optimizados de Next.js para todo el contenido estático.

### 4.4 CDN y peso de las imágenes

**Qué es.** Una red de distribución de contenido (CDN) sirve los archivos del sitio desde servidores geográficamente cercanos al usuario que hace la solicitud, reduciendo la latencia de red. El peso de las imágenes es un factor relacionado: el estándar documentado es mantener cada imagen por debajo de 120 KB, con un máximo absoluto de 180 KB para imágenes grandes de fondo.

**Vertiente A — verificar en lo construido.** Dado que Vercel opera como CDN global de forma nativa para todo el contenido desplegado, este punto está resuelto estructuralmente sin intervención adicional, a diferencia del escenario de los cursos donde el CDN es una capa adicional que requiere instalación (Cloudflare, mencionado explícitamente). La verificación pendiente es exclusivamente sobre el peso real de las imágenes: auditar con Screaming Frog (pestaña Images, filtro por tamaño) cualquier imagen que exceda el umbral, especialmente las fotografías o capturas usadas en el blog y las imágenes Open Graph generadas para redes sociales.

**Vertiente B — estándar de construcción.** El componente `next/image` aplica automáticamente compresión y conversión a formatos modernos (WebP, AVIF) en tiempo de servido, lo que en la práctica resuelve el problema de peso de imágenes siempre que se use ese componente en lugar de etiquetas `<img>` planas. Para los diagramas propios de metodología (que ya se identificaron en la planeación de contenidos como diferencial frente a la competencia), priorizar SVG en lugar de PNG o JPG cuando el diagrama sea vectorial, dado que un SVG bien optimizado pesa una fracción de su equivalente rasterizado y escala sin pérdida de calidad en cualquier densidad de pantalla.

### 4.5 Minificación y carga de CSS y JavaScript

**Qué es.** La minificación elimina espacios, saltos de línea y comentarios innecesarios del código para reducir su peso de transferencia. La carga diferida ("defer") de JavaScript evita que el navegador deba esperar a procesar todos los scripts antes de poder mostrar el contenido visible, moviendo su ejecución hacia el final del ciclo de carga de la página.

**Vertiente A — verificar en lo construido.** Verificar en PageSpeed Insights o GTmetrics si existen recomendaciones activas de minificación o de diferir JavaScript no utilizado en la carga inicial.

**Vertiente B — estándar de construcción.** Este es otro punto donde Next.js y Vercel resuelven el problema de raíz cuando se usan correctamente: la minificación de CSS y JavaScript en producción es automática y no requiere configuración manual, y el sistema de code splitting por ruta ya difiere la carga de JavaScript que no corresponde a la página actual. El riesgo real de construcción está en patrones específicos que neutralizan estas optimizaciones: importar librerías completas cuando solo se necesita una función específica (por ejemplo, importar toda una librería de iconos en lugar de los iconos individuales desde `lucide-react`), o marcar como `"use client"` componentes que podrían ser Server Components, lo que fuerza JavaScript adicional a enviarse al navegador innecesariamente. Estas decisiones de arquitectura de componentes tienen más impacto en el rendimiento real de Eskemma que cualquier ajuste de configuración de build.

---

## 5. JavaScript y renderizado (Next.js)

Esta es la sección de mayor relevancia directa para Eskemma de todo el documento, porque es la única que aborda explícitamente sitios construidos con frameworks de JavaScript modernos (React y equivalentes), que es exactamente la categoría a la que pertenece Next.js. Ninguno de los dos cursos de SEO técnico fue diseñado pensando en este stack — ambos auditan sitios construidos sobre PHP, WordPress o HTML estático — pero el módulo correspondiente del curso de Alejandro González sí aborda el caso general de aplicaciones JavaScript (SPA y PWA) con suficiente profundidad como para aplicarse directamente.

### 5.1 El problema de fondo: cómo Google rastrea sitios en JavaScript

**Qué es.** Cuando Google rastrea un sitio, su proceso ocurre en dos pasadas separadas en el tiempo. En la primera pasada, rastrea el HTML sin ejecutar JavaScript y lo envía a una cola de renderizado. En un momento posterior e indeterminado (puede ser horas, días o semanas), vuelve a pasar, esta vez ejecutando el JavaScript, y solo entonces indexa el contenido que depende de esa ejecución. Esto significa que cualquier contenido que solo aparece después de que el JavaScript se ejecuta en el navegador del usuario queda invisible para Google durante un periodo de tiempo no controlable, y en el peor caso puede no llegar a indexarse correctamente si la segunda pasada encuentra problemas.

**Por qué esto es crítico para Eskemma.** Next.js fue diseñado precisamente para resolver este problema mediante renderizado en el servidor (SSR) y generación estática (SSG/ISR), que entregan el HTML ya completo en la primera respuesta, sin que Google necesite ejecutar JavaScript para ver el contenido. El riesgo no está en usar Next.js — está en usarlo de forma que se anule esta ventaja, por ejemplo forzando que partes del contenido se carguen exclusivamente del lado del cliente cuando podrían generarse en el servidor.

**Vertiente A — verificar en lo construido.** Para cada plantilla de página ya construida (home, artículo de blog, página de producto), usar la función "Fetch and Render" de una herramienta como la mencionada en el curso (technicalseo.com) o el propio Inspector de URLs de Google Search Console, configurando el user agent como Googlebot Smartphone, y comparar el HTML recibido en la primera pasada (sin ejecutar JavaScript) contra el contenido visual final. Si contenido editorial relevante (el cuerpo de un artículo, la descripción de una fase de Moddulo, el listado de productos) no aparece en esa primera pasada, es una señal de que ese contenido se está generando exclusivamente en el cliente y debe migrarse a Server Component o a una estrategia de generación estática.

**Vertiente B — estándar de construcción.** Como regla general de arquitectura para todo el proyecto: el contenido que constituye la razón de ser de cada página (el texto del artículo, no su botón de "compartir"; la información de la fase de Moddulo, no el estado de un formulario interactivo) debe renderizarse como Server Component por defecto. Solo la interactividad real (formularios, estados de UI, animaciones) justifica marcar un componente como `"use client"`. Esta es la práctica recomendada general de Next.js App Router, pero conviene declararla explícitamente como estándar de Eskemma porque es fácil, bajo presión de tiempo de desarrollo, construir componentes completos como Client Components por comodidad cuando solo una pequeña parte de ellos necesita interactividad.

### 5.2 URLs únicas y navegación verdadera

**Qué es.** Cada vista o estado de contenido distinto dentro de una aplicación JavaScript debe corresponder a una URL distinta y verificable, no a un cambio puramente visual dentro de la misma URL. El error documentado en el curso de González es el de aplicaciones donde hacer clic en un elemento de navegación cambia lo que se ve en pantalla pero la URL en la barra del navegador permanece idéntica — en ese caso, Google no tiene manera de indexar ese contenido como una página distinta, ni el usuario puede compartir o volver directamente a ese estado.

**Vertiente A — verificar en lo construido.** Verificar manualmente, navegando por el sitio ya construido, que cada sección, cada artículo y cada fase de Moddulo cambia efectivamente la URL en la barra del navegador al navegar hacia ella, y que recargar la página en esa URL muestra el mismo contenido (lo que confirma que no es solo un estado de cliente sin persistencia real de ruta).

**Vertiente B — estándar de construcción.** El App Router de Next.js, cuando se usa mediante el sistema de carpetas y archivos `page.tsx` y el componente `<Link>`, garantiza esto de forma estructural: cada ruta del sistema de archivos es una URL real con soporte de navegador completo (recarga, retroceder, compartir enlace). El punto de riesgo está en componentes de interfaz que simulan navegación sin usarla realmente — por ejemplo, un sistema de pestañas (tabs) dentro de una página de Moddulo que cambia de fase visualmente mediante estado de React sin actualizar la URL. Cuando ese contenido tiene valor de indexación propio (cada fase de Moddulo probablemente lo tiene, dado que son conceptos metodológicos diferenciados), debe implementarse como rutas reales (`/moddulo/fases/diagnostico`, `/moddulo/fases/estrategia`) en lugar de como pestañas de estado interno, incluso si visualmente se prefiere la experiencia de pestañas — eso puede lograrse con rutas paralelas o interceptoras de Next.js sin sacrificar la indexabilidad.

### 5.3 Enlaces con etiqueta ancla, nunca botones

**Qué es.** Google rastrea el sitio siguiendo específicamente las etiquetas `<a href="...">` (anclas). Un elemento de navegación implementado como `<button onClick={...}>` que cambia de página mediante JavaScript no es rastreado en la primera pasada de Google de la misma manera, porque no es semánticamente un enlace aunque visualmente se comporte como uno.

**Vertiente A — verificar en lo construido.** Inspeccionar con las herramientas de desarrollo del navegador los elementos de navegación principal (menú, footer, tarjetas de artículo del blog, botones de "leer más") para confirmar que están implementados con la etiqueta de ancla correspondiente y no con elementos de botón que simulan navegación vía JavaScript.

**Vertiente B — estándar de construcción.** Esta es, junto con el uso correcto de Server Components, la regla de construcción más importante de todo el documento para el equipo de desarrollo de Eskemma: todo enlace de navegación interna debe implementarse exclusivamente con el componente `<Link>` de Next.js (que en tiempo de ejecución renderiza una etiqueta `<a>` real), nunca con un `<button>` que ejecute `router.push()` o equivalente para navegación entre páginas. El uso de `<button>` debe reservarse exclusivamente para acciones que no son navegación (enviar un formulario, abrir un modal, alternar un estado de interfaz). Esta distinción debe incorporarse como regla de revisión de código (code review) y, si el proyecto usa linting personalizado, como una regla de ESLint que señale el uso de `router.push` dentro de manejadores de clic en elementos de tipo botón cuando el destino es una ruta interna navegable.

### 5.4 Renderizado dinámico y renderizado en servidor: las dos soluciones avanzadas

**Qué es.** Para sitios JavaScript que por alguna razón no pueden resolver todo su contenido del lado del servidor, existen dos estrategias de mitigación: el renderizado dinámico (servir una versión pre-renderizada específicamente a los rastreadores, manteniendo la versión interactiva para usuarios humanos) y el renderizado en servidor (SSR), que es la solución estructural donde el contenido se genera en el backend antes de enviarse, sin depender de que el cliente ejecute JavaScript para obtenerlo.

**Por qué esto no es un problema pendiente para Eskemma sino una ventaja ya disponible.** El curso de González presenta el SSR como la solución "más avanzada" y de mayor esfuerzo de implementación, precisamente porque para los frameworks que él audita (Angular, Vue, React puro mediante Create React App) añadir SSR requiere configuración adicional considerable. Next.js, en cambio, ofrece SSR, SSG e ISR como mecanismos nativos de primera clase, no como una capa añadida. Esto significa que Eskemma no necesita "resolver" este problema — ya tiene la herramienta correcta. Lo que sí requiere disciplina activa es decidir, página por página, cuál de las tres estrategias de renderizado de Next.js corresponde a cada tipo de contenido: SSG para contenido que no cambia (páginas institucionales, artículos del blog una vez publicados), ISR para contenido que cambia con poca frecuencia (listados de artículos, índice del glosario), y SSR puro reservado para contenido genuinamente dinámico por usuario (vistas autenticadas dentro de Moddulo).

**Vertiente A y B — síntesis.** No aplica la distinción habitual entre verificar lo construido y definir el estándar, porque este punto es exactamente el mismo en ambos casos: para cada ruta del proyecto, presente o futura, debe documentarse explícitamente qué estrategia de renderizado de Next.js utiliza y por qué, como parte de la revisión de cada nueva página antes de integrarse a producción.

---

## 6. Contenido enriquecido, schema y AEO

Esta sección integra dos cuerpos de conocimiento de naturaleza distinta pero técnicamente complementaria. El primero es el schema markup o microformatos, una práctica ya consolidada de SEO clásico que ayuda a Google a entender qué tipo de contenido representa cada página. El segundo es la optimización para motores de respuesta de inteligencia artificial (AEO/GEO), una disciplina emergente que determina si ChatGPT, Claude, Perplexity o Gemini citan, mencionan o recomiendan a Eskemma cuando un usuario les pregunta sobre comunicación política estratégica. Ambas prácticas comparten el mismo principio de fondo: estructurar el contenido de forma que una máquina pueda extraer significado de él sin ambigüedad, y por eso se desarrollan juntas en este bloque.

### 6.1 Schema markup (microformatos)

**Qué es.** Código estructurado, generalmente en formato JSON-LD, insertado en el `<head>` del HTML, que declara explícitamente qué tipo de entidad representa el contenido de la página (un artículo, un producto, una organización, una lista de preguntas frecuentes) y sus atributos específicos. Es invisible para el usuario pero determina si Google puede mostrar resultados enriquecidos (estrellas de calificación, fechas de evento, pasos numerados) y, de forma más relevante para Eskemma, es una de las señales que los motores de respuesta de IA usan para extraer información estructurada con confianza.

**Vertiente A — verificar en lo construido.** Auditar con Screaming Frog (pestaña Structured Data) o la herramienta de prueba de datos estructurados de Google qué páginas ya tienen schema implementado y de qué tipo. Para Eskemma, los tipos de schema más relevantes y su estado de prioridad son: `Organization` para la página de inicio y "nosotros" (declarando nombre, descripción, logo y enlaces a redes sociales), `Article` para cada entrada del blog (con autor, fecha de publicación, fecha de modificación), `BreadcrumbList` para la navegación jerárquica (ya cubierto en el punto 2.3), y `FAQPage` para cualquier sección de preguntas frecuentes que se incorpore en páginas de producto.

**Vertiente B — estándar de construcción.** Construir un conjunto de funciones generadoras de JSON-LD reutilizables (no copiar el código manualmente en cada página) que tomen los datos reales de cada entidad de Firestore y produzcan el schema correspondiente de forma automática: cada artículo nuevo del blog genera su `Article` schema a partir de los mismos campos que ya alimentan el título, la meta descripción y la fecha. Validar cada tipo de schema con el validador oficial de schema.org antes de integrarlo a producción — ambos cursos coinciden en que un schema con errores es peor que no tener schema, porque puede interpretarse como señal de manipulación de resultados.

Una advertencia específica que aporta el material revisado y que aplica directamente a Eskemma: si en algún momento se implementa un schema de tipo `Product` o se declaran calificaciones (`aggregateRating`) para Moddulo, Sefix o PESTEL, esas calificaciones deben corresponder a reseñas reales y visibles en la página. Declarar una calificación que no es verificable en el contenido visible de la página es, según ambos cuerpos de conocimiento revisados, tratado por Google como intento de manipulación de resultados de búsqueda.

### 6.2 AEO: optimización para motores de respuesta de inteligencia artificial

**Qué es.** A diferencia del SEO clásico, que busca posicionar en los resultados de Google, el AEO (Answer Engine Optimization) busca que el contenido sea encontrado, considerado suficientemente valioso, y citado como fuente confiable por motores de respuesta como ChatGPT, Claude, Perplexity y Gemini. El material revisado plantea esto no como sustituto del SEO sino como una capa adicional que se construye sobre las mismas bases: el contenido bien estructurado para Google generalmente está bien posicionado también para ser extraído por sistemas de IA, pero existen prácticas específicas que mejoran significativamente esa extracción.

**Por qué esto es estratégicamente relevante para Eskemma de forma particular.** El comportamiento de búsqueda que describe el curso de AEO/GEO — un usuario que le pregunta directamente a una IA "cómo diseño una estrategia de campaña política" o "qué metodología debo usar para un diagnóstico político" antes de buscarlo en Google — coincide exactamente con el patrón de búsqueda informacional que ya se identificó para los buyer personas de Eskemma en el trabajo de estrategia SEO previo (José Luis, Julia, Francisco). Para un proyecto que busca posicionarse como autoridad metodológica en un nicho nuevo y subatendido en español, aparecer citado por un motor de respuesta de IA cuando alguien pregunta sobre estos temas tiene un valor de credibilidad comparable o superior a una posición alta en Google, particularmente porque ese tráfico, según el material revisado, llega con tasas de conversión más altas al estar el usuario ya educado sobre el tema antes de llegar al sitio.

**Vertiente A — verificar en lo construido.** Hacer una auditoría de visibilidad inicial siguiendo el método manual descrito en el curso: formular entre 5 y 10 preguntas reales que los buyer personas de Eskemma harían a una IA sobre su categoría (por ejemplo, "qué es la opinión pública y cómo se mide", "cómo diseñar una estrategia de campaña política local", "qué metodología usar para diagnóstico político"), consultarlas en modo incógnito en ChatGPT, Claude y Perplexity, y documentar en una hoja de cálculo si Eskemma aparece mencionada, en qué posición relativa, y qué fuentes cita cada motor en su lugar. Esto establece la línea base de visibilidad en IA contra la cual medir progreso, exactamente como se hizo con las métricas de Search Console para el SEO clásico.

**Vertiente B — estándar de construcción aplicado a la redacción de contenido.** El material revisado propone tres pilares de optimización que deben incorporarse como estándar de redacción para todo el contenido editorial de Eskemma, integrándose con las guías de redacción y el perfil de estilo `eske-blog-style` que se formalizará en el trabajo de producción de contenidos bajo la metodología MAES:

Primero, optimización de entidades nombradas: usar el nombre completo y explícito de los productos y conceptos propios de Eskemma (Moddulo, Sefix, MEC, MVP, FODA-IBEA) en lugar de referencias vagas como "nuestra plataforma" o "esta metodología", especialmente en la primera mención de cada sección. Una IA que extrae fragmentos de texto necesita que cada fragmento sea comprensible de forma independiente, sin depender de contexto que esté en otro párrafo.

Segundo, tripletas semánticas: estructurar las afirmaciones clave en la forma sujeto-verbo-objeto, de manera directa y verificable ("Moddulo estructura el diagnóstico político en cuatro ejes" en lugar de "el proceso de diagnóstico que ofrecemos contempla habitualmente varios ejes que suelen ser relevantes para el análisis"). Esta práctica debe incorporarse como regla de redacción dentro del perfil de estilo editorial del blog (`eske-blog-style`, pendiente de formalizar en el trabajo de producción de contenidos bajo la metodología MAES), de modo que la claridad sintáctica y la extraibilidad por fragmentos queden definidas desde el origen como criterio del propio estilo, y no como un ajuste posterior sobre un texto ya redactado.

Tercero, fragmentación en bloques autocontenidos (chunking): estructurar el contenido en bloques de aproximadamente 100 a 200 palabras bajo un encabezado H2 que formule una pregunta clara, de manera que cada bloque pueda extraerse y tener sentido completo por sí mismo sin necesidad de leer el resto del artículo. Esto es coherente y reforzante con la práctica de pirámide invertida ya incorporada al checklist de verificación de contenidos de Eskemma (sección "Pirámide invertida" del documento de verificación de optimización ya elaborado), y con la recomendación de H2 cada 150-200 palabras que aparece también en el curso de AEO de forma independiente — ambos cuerpos de conocimiento convergen en la misma práctica desde ángulos distintos, lo que refuerza su prioridad.

**Vertiente B — estándar de construcción aplicado a señales externas.** El material de AEO enfatiza que las menciones en fuentes externas (sitios de reseñas, foros, medios editoriales, YouTube) tienen más peso ante los motores de IA que el propio contenido del sitio, porque representan validación independiente. Esto conecta directamente con la estrategia de link building y relaciones públicas que ya se había esbozado en el análisis de off-page de los cursos de SEO clásico (sección 7 de este documento), y debe planificarse como una sola estrategia integrada, no como dos esfuerzos separados: cada mención conseguida en un medio de comunicación política, cada reseña de un usuario beta de Moddulo en un sitio de terceros, y cada aparición en listas de "mejores herramientas de" construye autoridad simultáneamente para SEO clásico y para AEO.

---

## 7. Off-page

A diferencia de las secciones anteriores, el off-page no se implementa en el código del sitio sino en la actividad externa que construye autoridad y reconocimiento de marca. Se incluye en este documento porque, según ambos cursos clásicos y el material de AEO, es un factor de peso comparable o superior al trabajo técnico interno, y porque varias de sus prácticas requieren preparación técnica previa en el sitio (por ejemplo, que la página de "nosotros" tenga la información correcta antes de buscar que medios externos enlacen hacia ella).

### 7.1 Vinculación de redes sociales y consistencia de marca

**Qué es.** Enlazar visiblemente los perfiles de redes sociales desde el sitio, y mantener esos perfiles activos, porque un perfil social inactivo o desactualizado genera la impresión de que el producto o servicio ya no opera, lo que daña la confianza tanto del usuario como, según el material de AEO, de los propios motores de respuesta de IA que evalúan señales de actividad reciente.

**Vertiente A — verificar en lo construido.** Confirmar que el sitio enlace visiblemente a los canales activos de Eskemma una vez estén definidos (LinkedIn, X/Twitter, el canal donde se redistribuya el contenido del blog).

**Vertiente B — estándar de construcción.** Esto ya está cubierto conceptualmente por el sistema de redistribución multicanal definido en la estrategia SEO de Eskemma (1 artículo = hilo + post LinkedIn + newsletter + infografía), que garantiza actividad constante en los canales sin esfuerzo de producción adicional. El punto técnico pendiente es simplemente asegurar que los enlaces a redes sociales en el sitio (footer, página de "nosotros") apunten siempre a los perfiles vigentes y se actualicen si cambia el handle o la plataforma priorizada.

### 7.2 Open Graph y presentación en redes sociales

**Qué es.** Conjunto de etiquetas meta que controlan cómo se ve un enlace cuando se comparte en redes sociales: título, descripción e imagen de vista previa. Sin esta configuración, las redes sociales extraen esta información de forma automática y con frecuencia incorrecta o incompleta.

**Vertiente A — verificar en lo construido.** Probar cada URL pública relevante de Eskemma (home, artículos del blog, páginas de producto) en un depurador de Open Graph (el de Meta o herramientas equivalentes), confirmando que el título y la descripción no se corten de forma abrupta y que la imagen de vista previa cargue correctamente.

**Vertiente B — estándar de construcción.** En Next.js, el campo `openGraph` dentro de `metadata` permite declarar esto de forma explícita por página, idealmente reutilizando los mismos datos que alimentan el título y la meta descripción SEO, con la imagen de vista previa generada específicamente para el formato social (proporción aproximada 1.91:1, que es distinta a la proporción de las imágenes de contenido del artículo). Para el volumen de contenido que produce el blog de Eskemma, conviene evaluar la generación dinámica de imágenes Open Graph mediante la API de imágenes de Next.js (`ImageResponse`), que permite crear automáticamente una imagen de vista previa con el título de cada artículo sin depender de que cada pieza tenga una imagen de portada diseñada manualmente.

### 7.3 Link building

**Qué es.** La práctica de conseguir que otros sitios enlacen hacia el propio, lo que Google interpreta como una señal de confianza y autoridad ("voto" de otro sitio). El material revisado distingue tres escenarios: aprovechar menciones existentes que no incluyen enlace, generar alertas para detectar nuevas menciones, y proponer contenido a terceros a cambio de un enlace.

**Vertiente A — no aplica en sentido estricto**, dado que esta es una actividad externa y no de código, pero conviene preparar el terreno técnico: asegurar que la página de "nosotros" y las páginas de producto tengan la información clara y citable que facilitaría a un periodista o bloguero de comunicación política enlazar correctamente hacia Eskemma.

**Vertiente B — estándar de práctica continua.** Configurar alertas (Google Alerts o equivalente) para el nombre de marca "Eskemma" y para los nombres de producto (Moddulo, Sefix), de manera que cualquier mención en medios de comunicación política, foros de consultoría, o publicaciones académicas sobre comunicación política se detecte y pueda gestionarse para conseguir el enlace correspondiente si no existe ya. Esta práctica converge directamente con la estrategia de identificación de fuentes citadas por motores de IA descrita en la sección 6.2: las mismas fuentes que conviene rastrear para AEO (sitios de reseñas, medios especializados, foros) son las fuentes prioritarias de link building clásico.

### 7.4 SEO local (Google Business Profile)

**Qué es.** Perfil gestionado directamente por Google que muestra información de contacto, dirección, horario de atención y ubicación en Google Maps, mostrándose en un panel destacado cuando alguien busca el nombre de la marca o categorías locales relacionadas. Es relevante sobre todo para negocios con presencia física que el usuario podría visitar, pero también opera como una señal adicional de legitimidad y verificación ante Google incluso cuando el negocio no recibe público en su sede.

**Por qué aplica a Eskemma a pesar de ser un producto digital.** El núcleo del negocio es online y eso no cambia, pero Eskemma sí contará con una dirección física de oficinas, ubicada en la capital del país. Esto tiene dos implicaciones distintas que conviene separar con claridad. La primera es de autoridad y verificación: una ficha de Google Business Profile con dirección confirmada es una señal adicional de que Eskemma es una organización real y establecida, lo cual refuerza el E-E-A-T (Experience, Expertise, Authoritativeness, Trustworthiness) de la página de "Contacto", que es donde esta información de dirección, teléfono y ficha de Google se mostrará públicamente. La segunda es de oportunidad de posicionamiento geográfico genuino: estar ubicado en la capital coincide con la mayor concentración de los perfiles de mayor valor de Eskemma (consultores políticos como Francisco, legisladores y funcionarios con operación en el ámbito federal o de la capital), por lo que búsquedas como "consultoría en comunicación política [capital]" o "asesoría estratégica electoral [capital]" tienen una oportunidad real de captar tráfico de alta intención que el SEO de contenido por sí solo no alcanza.

**Vertiente A — verificar en lo construido.** No aplica todavía, dado que la ficha de Google Business Profile aún no se ha creado. Sí conviene verificar, en cuanto se construya o actualice la página de "Contacto", que la dirección, el nombre comercial y el teléfono que eventualmente se declaren en el perfil de Google coincidan exactamente con los que aparezcan en esa página del sitio — la inconsistencia de estos datos entre el sitio y la ficha de Google (lo que se conoce como NAP, Name-Address-Phone, por sus siglas en inglés) es la causa más común de que Google no confíe en la verificación de un perfil local.

**Vertiente B — estándar de incorporación.** Al crear la ficha de Google Business Profile, conviene tomar las siguientes prevenciones, derivadas directamente de los hallazgos de ambos cursos clásicos sobre este factor.

Primero, elegir con cuidado la categoría de negocio declarada. Dado que Eskemma no es una consultora de atención al público en el sentido tradicional, la categoría debe reflejar con precisión el tipo de actividad (por ejemplo, una categoría de consultoría empresarial o servicios profesionales, no una categoría de "tienda" o "comercio" que no corresponde al modelo de negocio) para evitar que el perfil aparezca en búsquedas irrelevantes o que Google lo suspenda por inconsistencia entre categoría y actividad real.

Segundo, ser explícito sobre la modalidad de atención. Google permite declarar si el negocio atiende únicamente con cita previa, lo cual es relevante para Eskemma porque la sede no debe interpretarse como un punto de atención abierta al público en general, sino como oficinas de un equipo de consultoría y desarrollo de producto. Declarar esto correctamente desde el inicio previene que un usuario llegue sin previo aviso esperando atención inmediata, y previene también que Google penalice el perfil por inconsistencias si en algún momento se reporta que el negocio no atendía en el horario declarado.

Tercero, decidir conscientemente el área de servicio declarada. La herramienta permite declarar no solo la ubicación de la sede sino también las zonas o regiones a las que el negocio presta servicio más allá de su ubicación física — dado que Eskemma opera en realidad para todo México y Latinoamérica de forma digital, conviene declarar esto explícitamente en el perfil para no limitar la percepción de alcance del negocio a la zona inmediata de la capital, evitando al mismo tiempo declarar zonas de servicio tan amplias que diluyan la relevancia local genuina que sí aporta tener una sede verificable.

Cuarto, mantener actividad y consistencia una vez creado el perfil. Un perfil de Google Business Profile creado y luego abandonado (sin fotos actualizadas, sin respuesta a reseñas, con horario desactualizado) genera el mismo efecto negativo de percepción de inactividad que ya se documentó para redes sociales en el punto 7.1 — la recomendación es incorporar la revisión periódica de este perfil al mismo ciclo de mantenimiento mensual que ya está definido para las demás tareas de SEO constante de Eskemma.

Quinto, evaluar con cautela la incorporación de reseñas. Si en el futuro se solicitan reseñas a clientes o usuarios beta de Moddulo en este perfil, deben ser reseñas genuinas de personas que efectivamente interactuaron con el equipo o el producto — la misma advertencia sobre calificaciones no verificables que se señaló para el schema markup de tipo `Product` en la sección 6.1 aplica aquí: una reseña que no corresponde a una interacción real puede leerse como manipulación y dañar la confianza del perfil completo, no solo de la reseña individual.

---

## 8. Roadmap consolidado de implementación

Esta tabla reorganiza todos los factores ya descritos por orden de prioridad y momento de ejecución, distinguiendo entre tareas de Vertiente A (verificación o corrección sobre lo construido) y Vertiente B (estándar a establecer antes o durante la construcción de lo pendiente). El orden de prioridad sigue la misma lógica que ambos cursos establecen: primero lo que bloquea el rastreo e indexación por completo, después lo que afecta la calidad de esa indexación, y por último lo que amplifica el alcance una vez la base técnica es sólida.

| Prioridad | Factor | Vertiente | Momento de ejecución | Sección de referencia |
|---|---|---|---|---|
| Crítica | Robots.txt sin bloqueo global accidental | A | Antes de cualquier despliegue público | 1.2 |
| Crítica | Estrategia de renderizado correcta (Server Components por defecto) | B | Regla de arquitectura desde el inicio del desarrollo | 5.1 |
| Crítica | Enlaces de navegación con `<Link>`, nunca botones con JS | B | Regla de codificación desde el inicio del desarrollo | 5.3 |
| Alta | Sitemap.xml dinámico generado y enviado a Search Console | A y B | Al momento del primer despliegue público | 1.4 |
| Alta | Metadata única por página (título, descripción) sin duplicados | B | Convención obligatoria en cada `page.tsx` nuevo | 3.1, 3.2 |
| Alta | Un único H1 real por página, coherente con jerarquía semántica | B | Convención de componentización desde el inicio | 2.5, 3.4 |
| Alta | Canonical declarado en páginas filtrables o paginadas | B | Al construir el blog y cualquier vista de Sefix filtrable | 1.7 |
| Alta | Página 404 con código de servidor real (`notFound()`) | B | Al construir el manejo de errores del proyecto | 1.8 |
| Media | TTFB y velocidad de carga medidos por plantilla | A | Una vez exista una versión desplegada navegable | 4.1, 4.2 |
| Media | Schema markup de Organization, Article y BreadcrumbList | A y B | Al publicar el primer artículo del blog | 6.1 |
| Media | Auditoría de visibilidad base en motores de IA (línea base AEO) | A | En paralelo al lanzamiento del blog | 6.2 |
| Media | Redirecciones 301 de versiones no canónicas del dominio | A y B | Al configurar el dominio en Vercel | 1.6 |
| Media | Alt text descriptivo en imágenes y diagramas propios | B | Al producir cada pieza de contenido visual | 3.6 |
| Media | Open Graph con imagen dinámica por artículo | B | Al construir el sistema de publicación del blog | 7.2 |
| Baja | Profundidad de navegación verificada (máximo 5 niveles) | A | Una vez el sitio tenga volumen de contenido | 2.2 |
| Baja | Alertas de marca para link building y AEO | B | Práctica continua, no de una sola vez | 7.3 |
| Baja | Caché de assets estáticos fuera de `/public/` | A | Revisión periódica, no bloqueante | 4.3 |
| Media | Ficha de Google Business Profile con NAP consistente y categoría correcta | B | Al confirmar dirección definitiva de oficinas | 7.4 |
| Diferida | Hreflang para variantes regionales de español | B | Solo si Eskemma despliega contenido diferenciado por país | (curso 2, módulo 07) |

---

## 9. Anexo de herramientas de auditoría

Listado de herramientas mencionadas a lo largo de los tres cuerpos de conocimiento revisados, organizadas por función. Se incluye una nota sobre cuáles son directamente aplicables al flujo de trabajo de Eskemma y cuáles requieren adaptación o tienen equivalentes más adecuados al stack Next.js/Vercel.

**Rastreo e indexación**
Google Search Console (esencial, sin sustituto). Screaming Frog (rastreador de escritorio, licencia gratuita hasta 500 URLs). Seolizer y Spotivo (rastreadores web alternativos con planes gratuitos, hasta 10,000 y 500 URLs respectivamente). El operador de búsqueda `site:eskemma.com` como verificación manual inmediata sin necesidad de herramienta externa.

**Velocidad y rendimiento**
Google PageSpeed Insights, construido sobre Lighthouse (preferible a GTmetrics para Eskemma por su alineación directa con las métricas de Core Web Vitals que Google usa como factor de ranking). GTmetrics (alternativa con métricas clásicas más legibles para quien no tiene perfil técnico). La extensión de Chrome Coinfo para medir TTFB de forma aislada. TinyJPG o el optimizador nativo de `next/image` para compresión de imágenes.

**Datos estructurados y AEO**
El validador oficial de schema.org para confirmar ausencia de errores antes de publicar cualquier JSON-LD. La herramienta de generación de schema de technicalseo.com como apoyo para construir el código sin necesidad de escribirlo manualmente. Herramientas de auditoría de visibilidad en IA mencionadas en el curso de AEO (la herramienta de auditoría de HubSpot y su "AEO Grader"), útiles para obtener una primera fotografía rápida, aunque el método manual de consulta directa en modo incógnito a ChatGPT, Claude y Perplexity, documentado en la sección 6.2, es el que da mayor control y comprensión del contexto real de cada mención.

**Verificación de protocolo y redirecciones**
HTTP Status y Link Redirect Trace (extensión de Chrome) para verificar cadenas de redirección y códigos de respuesta reales.

**Identificación de tecnología**
BuiltWith, para identificar con qué tecnología está construido un sitio de competencia al hacer benchmark — no aplica a la auditoría del propio sitio de Eskemma, dado que la tecnología ya es conocida, pero es útil para el ejercicio de análisis de competencia ya iniciado en el trabajo de estrategia SEO.

**Nota sobre herramientas no aplicables o de aplicabilidad limitada.** Varias herramientas mencionadas en los cursos (HT Access generators, paneles de cPanel, plugins de WordPress para minificación o caché) no tienen equivalente de uso directo en Eskemma porque la funcionalidad que resuelven ya está cubierta nativamente por Vercel o por la configuración de Next.js. Se omiten del listado operativo de Eskemma por esa razón, no por descuido.

---

*Fin del documento. Próximo paso sugerido: trasladar este archivo al repositorio de Eskemma bajo `/docs/specs/seo-tecnico.md` para que Claude Code pueda consultarlo en cualquier sesión de trabajo, tanto en modo auditoría (Vertiente A) sobre el código ya existente, como en modo estándar (Vertiente B) al construir páginas y componentes nuevos.*

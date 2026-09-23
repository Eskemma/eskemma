# CLAUDE.md — Eskemma

Contexto e instrucciones para el desarrollo del proyecto.
**Actualizar al cerrar cada sprint.**

---

## Protocolo de Fuentes Externas (IDs de Series/Indicadores)

**Aplica a toda integración con APIs externas: INEGI, Banxico, y cualquier
fuente que se agregue en desarrollos futuros (Fase 3 - Investigación, etc.)**

Antes del primer uso en producción de cualquier ID de serie o indicador externo:

1. **Verificar con llamada real** al endpoint de metadatos de la API.
2. **Documentar en el código** (comentario junto a la constante):
   - Fecha de verificación
   - Campo y valor exacto que confirma la identidad (texto literal de la respuesta)
   - Nunca solo el label inferido — siempre la evidencia de la API

Formato de comentario obligatorio:
```ts
// Verificado YYYY-MM-DD vía GET <endpoint-metadatos>
// ID_SERIE → campo:"valor literal de la API"  →  descripción legible
```

**Nunca asumir un ID por inferencia, plausibilidad o documentación de
terceros sin confirmar contra la API real.** Si el token no está disponible
en local, dejar el ID marcado con `⚠️ PENDIENTE DE VERIFICACIÓN` y la
fecha, en vez de asumir.

Referencia de implementación: `lib/centinela/pestel/scraper/banxico.ts`
(verificado 2026-07-08).

**Para cualquier fuente nueva que cruce datos por territorio municipal
(`CVE_MUN`)**: consultar obligatoriamente
`docs/ecosistema/T10-fontana/claves-geograficas-no-confiables.md` antes de
decidir el mecanismo de join — dos catálogos "oficiales INEGI" pueden tener
numeraciones de municipio distintas sin ningún aviso (incidente real
2026-08-23, Fontana F1/F2). Nunca asumir compatibilidad de CVE_MUN entre
catálogos sin verificarlo con una muestra real.

---

## Idioma y Commits

- Responder siempre en **español**
- Código y comentarios técnicos en **inglés**
- Formato de commits obligatorio: `YY-MM-DD. <descripción>`
  - Ejemplo: `26-03-27. feat(pestel): refactorizar trigger a fire-and-forget`

---

## Frescura de este documento

Antes de escribir la entrada del Historial de Sprints al cerrar cualquier
ronda de trabajo, correr `npm run check-docs-freshness` — compara la
fecha del código real contra la fecha de las secciones de este archivo
que lo describen (manifiesto: `docs/claude-md-freshness-manifest.json`).
Si marca algo, corregirlo antes de cerrar la ronda: pedirle a Claude Code
que lea el código real de la ruta señalada y redacte la corrección de esa
sección específica — mismo flujo ya usado con las filas de Sefix y PESTEL
(incidente real, 26-09-15/17, brechas de 99 a 170 días sin detectar).
Agregar una entrada al manifiesto cada vez que se escriba una afirmación
de estado nueva y verificable (no para narrativa de "Historial de
Sprints" o "Deuda Técnica", que ya llevan fecha propia por entrada).

---

## Qué es Eskemma

Plataforma SaaS de consultoría política con IA, orientada a consultores,
equipos de campaña y funcionarios públicos en México.

| Ruta | Módulo | Estado |
|------|--------|--------|
| `/moddulo` | Moddulo — gestión de proyectos políticos con IA (9 fases) | Activo |
| `/centinela/pestel` | PESTEL — análisis PEST-L en tiempo real | En desarrollo |
| `/cursos` | Talleres y cursos interactivos | Activo |
| `/sefix` | Dashboard electoral — Next.js/React/TypeScript nativo, 24 rutas API propias bajo `app/api/sefix/`. Migrado desde el prototipo original en R/Shiny (`docs/sefix_R/`, sin desarrollo activo desde 26-04-12, se conserva solo como artefacto histórico) | Activo |
| `/blog` | El Baúl de Fouché | Activo |

---

## Stack Técnico

| Capa | Tecnología | Versión |
|------|-----------|---------|
| Framework | Next.js App Router | 16.x |
| UI | React | 19.x |
| Lenguaje | TypeScript strict | 5.x |
| Estilos | Tailwind CSS con `@theme` | 4.1.5 |
| Auth | Firebase Auth + session cookies HTTP-only | — |
| Base de datos | Firestore | — |
| Storage | Firebase Cloud Storage | — |
| Cloud Functions | Node.js Gen2 | 22 |
| AI | Anthropic Claude Sonnet 4.6 | `claude-sonnet-4-6` |
| Email | Resend + Nodemailer | — |
| Despliegue frontend | Vercel | — |
| Despliegue functions | Google Cloud (Firebase) | — |

**No existe app móvil nativa.** La versión móvil es responsive web con
breakpoints Tailwind (`sm:`, `lg:`).

---

## Autenticación

Flujo de sesión — no modificar sin revisar todas las dependencias:

```
Firebase signIn (cliente)
  → getIdToken()
  → POST /api/auth/session { idToken }
  → Firebase Admin crea session cookie (HTTP-only, Secure, SameSite:lax, 5 días)
```

| Archivo | Propósito |
|---------|-----------|
| `lib/session.ts` | createSession, getSession, deleteSession |
| `lib/session-config.ts` | SESSION_CONFIG centralizado |
| `lib/server/auth-helpers.ts` | `getSessionFromRequest()` — para API routes |
| `lib/server/session.server.ts` | `getServerSession()` — para Server Components |
| `context/AuthContext.tsx` | hook `useAuth()` en el cliente |

- En **API routes**: siempre `getSessionFromRequest(request)`
- En **Server Components**: siempre `getServerSession()`

---

## Estilos y Design System

### Colores custom (`@theme` en `globals.css`)

| Token | Propósito |
|-------|-----------|
| `blue-eske` | Primario, links |
| `orange-eske` | Secundario, CTAs |
| `bluegreen-eske` | Headers de sección, navegación |
| `white-eske` | Fondos |
| `gray-eske` | Bordes, texto deshabilitado |
| `black-eske` | Texto principal |
| `yellow-eske` | Warnings |
| `green-eske` | Success |
| `red-eske` | Errores |
| `violet-eske` | Identidad de categoría (ver "Token `violet-eske`"): "No Binario" en Sefix y cuadrante "Vigilar" de PESTEL. **No es un color libre** |

Cada color tiene escala `-10` `-20` `-30` `-40` `-60` `-70` `-80` `-90`, **salvo
`violet-eske`** (solo base, `-20` y `-60`) **y `black-eske`**, que solo define `-10` `-20` `-30` `-40` y `-90` (y `-10` es el más
CLARO). **Ninguna escala incluye el paso 50**, y **`black-eske-60`/`-70`/`-80` y
`blue-eske-900` NUNCA existieron**: no son tokens que se perdieron, fueron
extrapolaciones erróneas del equipo (se asumió que `black-eske-80` era "un gris medio";
por nombre serían casi negros, y `blue-eske-900` es un typo de `blue-eske-90`). Verificado
en el historial de git: `black-eske` se definió en el primer commit solo con `-10…-40` y
`-90`. Una clase con un token inexistente no truena en build ni en `tsc` (es solo un
string de className) pero es un no-op silencioso en runtime: el texto hereda el color de
su ancestro más cercano (en modo claro, casi siempre `#2b2b2b` → la jerarquía visual
quedaba plana; una variable CSS `var(--color-…)` inexistente en un `fill` de SVG cae a
negro puro). Incidentes reales: 26-09-12 (3 badges "Archivado" casi invisibles en modo
oscuro), 26-09-13 (~150 ocurrencias en `app/moddulo/`) y la auditoría de diseño
(26-09-20/21: el paso 50 en 32 líneas; `black-eske-60`/`-80` en ~400 líneas de Sefix y
Fontana; el botón "Ver planes de suscripción" de cursos con `blue-eske-900` renderizaba
texto blanco sobre amarillo, contraste 1.45:1). Nota: `gray-eske-60` se sobrescribe en
un segundo `@theme` a `#9a9a9a` (contraste WCAG). **Antes de usar cualquier token,
confirmar que su paso existe en `globals.css`.** Guard permanente:
`lib/design/tokensColor.test.ts` — **sin remanentes tolerados** (desde 26-09-21): falla
si CUALQUIER token `-eske` usado en `app/`, `lib/`, `context/`, `types/` o `utils/` no
está definido en `globals.css`, y nombra explícitamente el paso 50, `black-eske-60`/`-70`/
`-80` y `blue-eske-900`. Incluye una prueba del propio escáner (evita un pase vacuo si el
regex se rompe).

**Texto secundario/atenuado — mapeo por rol** (sub-ronda 2, 26-09-21). El texto que en
modo oscuro usa un tono gris-azulado fijo tiene su equivalente en claro por rol; al
escribir texto secundario usa la pareja completa, nunca un token suelto:

| Rol | Modo oscuro (`dark:text-[…]`) | Modo claro | Contraste sobre `#f7fafb` |
|-----|-------------------------------|------------|---------------------------|
| Subtítulo, etiqueta, texto secundario | `#9AAEBE` | `text-black-eske-20` | 7.45:1 (AAA) |
| Texto terciario, nota, dato tenue | `#6D8294` | `text-black-eske-10` | 6.38:1 (AA) |
| Texto de cuerpo algo atenuado (menús, hover) | `#C7D6E0` | `text-black-eske-40` | ~11:1 |
| Placeholder | `dark:placeholder:text-[#6D8294]` | `placeholder:text-gray-eske-90` | 4.09:1 (más claro que el texto tecleado) |

`gray-eske-90` (`#7a7a7a`, 4.09:1) NO cumple AA para texto pequeño: no usarlo para
texto secundario salvo placeholders. Con opacidad se conserva el sufijo
(`text-black-eske-10/50` para una etiqueta deshabilitada). Para `fill`/`stroke` de
Recharts, que no acepta clases: `isDark ? "#C7D6E0" : "var(--color-black-eske-20)"`
(patrón de `useDarkMode()`), nunca una variable sin definir.

**Tinte suave de marca = opacidad del token**, no una escala clara inventada:
`bg-red-eske/10`, `bg-green-eske/20`, `dark:bg-yellow-eske/10`, `border-orange-eske/30`
(ya usado en `PESTLPanelV2`). Equivalencias al reemplazar colores genéricos de Tailwind
(sub-ronda PESTEL 26-09-20): texto rojo/verde/naranja/azul de 600-700 → paso `-60`/`-70`
del token (contraste ≥ original); texto amarillo en claro → `brown-eske-60` (el amarillo
no contrasta sobre fondo claro; precedente `NaturalezaBadge`); en oscuro los semánticos
de `:root` (`--color-danger` = red-eske-20, `--color-success` = green-eske-30,
`--color-brand-emphasis` = orange-eske-20). Grises: el más cercano que NO baje el
contraste original (`text-gray-400` → `gray-eske-90`, `-500` → `black-eske-10`).
Al reemplazar un token inexistente que **no tenía variante `dark:`**, agregar la variante
oscura (`dark:text-[#9AAEBE]`): un color fijo sin ella dejaría texto oscuro sobre fondo
oscuro. **El único violeta oficial es `violet-eske`** (abajo); no existe morado/púrpura genérico equivalente y
no se debe usar `violet-eske` para categorías nuevas sin decisión de diseño.

**Token `violet-eske` (26-09-21).** Identidad de la categoría **"No Binario"** en las gráficas y
tooltips de Sefix; por decisión de diseño el cuadrante **"Vigilar"** de la matriz de PESTEL
usa el mismo tono. Se creó porque ese violeta es color de identidad de una serie de datos, no
decoración, y ninguna escala existente lo cubría. **Origen del valor (exacto, no aproximado):**
`COL_NB = #9B59B6` y `COL_NB_DARK = #C585F5` de `SexoCharts.tsx` (las constantes hex se eliminaron:
el token es ahora la única fuente). Pasos definidos en `app/globals.css`:

| Token | Valor | Uso |
|-------|-------|-----|
| `violet-eske` | `#9b59b6` | Bordes, rellenos, series, tinte por opacidad (`/10`, `/40`); ≥ 3:1 en ambos temas |
| `violet-eske-20` | `#c585f5` | Texto en modo oscuro (5.05:1 sobre `#18324A`) |
| `violet-eske-60` | `#773e8e` | Texto en modo claro (6.99:1 sobre `white-eske`). **Único valor derivado:** mismo matiz y saturación (HSL 282.6° / 38.9 %), luminosidad 40 % |

**Usos oficiales (4, todos por decisión de Raúl):** categoría "No Binario" (Sefix), cuadrante "Vigilar"
(PESTEL), chips de país de Moddulo (`ProjectSelector`, `redactor/page`) y el chip de filtro "orden"
de `BlogToolbar` (sub-ronda C, 26-09-22). Cualquier uso nuevo requiere decisión de diseño.

El `-60` existe porque la base da **4.45:1** sobre `white-eske` (< AA 4.5 en texto pequeño) y
sobre las tarjetas oscuras solo 2.82:1. Patrón de uso: `text-violet-eske-60 dark:text-violet-eske-20`,
`border-violet-eske/40`, `bg-violet-eske/10`. El guard incluye `violet` en `COLORES_ESKE`: un paso
inexistente (`violet-eske-70`) rompe el test como cualquier otro token.

**Token `premium-eske` (26-09-22).** Identidad del plan de suscripción **"Premium"**
(`SubscriptionBadge`, borde/precio/ribbon "Más Popular" de `suscripciones.tsx`). Se creó porque, a
diferencia de los 4 usos de `violet-eske` (todos arbitrarios/incidentales), este púrpura SÍ es
identidad de producto real — consistente con Basic=azul/Professional=verde — y su tono es
materialmente distinto de `violet-eske` (ΔE76 45.5: mismo rango de matiz, 271-283°, pero mucho más
saturado, 81 % vs 39 %). **Origen del valor (exacto):** `#9333ea` (Tailwind `purple-600`), el único
hex usado para Premium en todo el repo.

| Token | Valor | Uso |
|-------|-------|-----|
| `premium-eske` | `#9333ea` | Bordes, relleno, badge sólido (con texto blanco, 5.38:1), tinte por opacidad; texto en claro (5.13:1 sobre `white-eske`, ya pasa AA sin paso adicional) |
| `premium-eske-20` | `#ba7ef2` | Texto en modo oscuro (4.61:1 sobre `#18324A`; la base solo da 2.82:1) |

Patrón de uso: `text-premium-eske dark:text-premium-eske-20`, `border-premium-eske/40`,
`bg-premium-eske`. El guard incluye `premium` en `COLORES_ESKE`.

**Auditoría de diseño — estado (26-09-21).** Sub-ronda 1 (PESTEL + paso 50, 26-09-20)
y sub-ronda 2 (26-09-21: `black-eske-60` 252 → 0, `black-eske-80` 148 → 0,
`blue-eske-900` 1 → 0; 401 clases en 67 archivos de Sefix, Fontana, compartidos,
cursos y `app/dev`) cerradas: **cero tokens `-eske` inexistentes en todo el código**,
con guard sin remanentes. La sub-ronda 2 NO fue cosmética: restauró la jerarquía
visual en modo claro (subtítulos, etiquetas y notas pasaron de `#2b2b2b` heredado a
gris `#525252`/`#5c5c5c`), arregló el CTA de cursos (blanco sobre amarillo →
`blue-eske-90`, 7.58:1), los ejes de gráficas (negro puro → `black-eske-20`), las
etiquetas deshabilitadas (`/50` ya atenúa) y los hovers (`Tabs`, `HistoricoPartidos*`).
PESTEL y Sefix con **0** colores genéricos de Tailwind y **sin excepciones** en el guard: el
cuadrante "Vigilar" (`ImpactMatrix`) y los 4 tooltips "No Binario" (`SexoCharts` ×3, `G3SexChart` ×1;
16 clases, no 4) usan `violet-eske`. Otros cambios de Sefix: `HistoricoView`
`dark:bg-red-900/20` → `dark:bg-red-eske/20`; defecto real corregido en `G3SexChart`
(`text-purple-700` sin `dark:` = 1.89:1 sobre la tarjeta oscura); y en `SexoCharts` se eliminaron
`COL_NB`/`COL_NB_DARK` y 2 declaraciones `colNB` que nunca se usaban (el texto "No Binario:" pasó
a clases del token).

**"Vigilar": resuelto.** Raúl confirmó en navegador (ambos temas) el cambio de tono al token
(283°/39 % vs el violeta de Tailwind 263°/70 %; contraste claro 6.44 → 6.18, oscuro 5.70 → 5.63).

**Colisión Extranjero vs No Binario — RESUELTA (26-09-21).** El morado es la identidad del **ámbito
Extranjero** en toda la sección LNE (7 archivos / 70 referencias), no una convención de "Mujeres", y
chocaba con `violet-eske-20` solo en oscuro (`#C585F5`, ΔE 0; en claro ΔE 39-41). Decisión de Raúl
(recomendación de Claude; su propuesta inicial `#F15F8E` era `red-eske-20` = `--color-danger` en oscuro,
y ni `-20` ni `-30` cumplen 3:1 en ambos temas): en `SexoCharts` (S1-S4, vía `coloresM` y `getSexosS3`) y
`G3SexChart`, **Mujeres usa la misma paleta rosa/rojo en ambos ámbitos**; no hay tokens ni hex nuevos
(G3 referencia `COLORS_NACIONAL`). **Hombres y el resto de la paleta morado/azul de Extranjero no
cambian** (`EdadCharts`, `G1TrendChart`, `G2BarChart`, `OrigenCharts`, `semanalUtils`). Medido después:
colisión con No Binario ΔE 0 → **50.2** en oscuro y 41.1 → 42.5 en claro; sin colisión nueva (el rosa
queda a ΔE ≥ 41.2 de cualquiera de los 22 colores de Extranjero vigentes); contraste de las líneas sobre
`white-eske` (claro) 4.42-8.66 y sobre `#18324A` (oscuro, fondo real de `ChartCard`) 3.64-5.38, **salvo
`G3SexChart` "Lista Mujeres" en oscuro `#C45070` = 2.97:1** (0.03 bajo 3:1; ya era así en Nacional, el
morado anterior daba 5.12). Pendiente menor: aclararlo (p. ej. `#F4839D`) en ambos ámbitos si se
quiere cumplir 3:1 estricto.

**Sitio principal — diagnóstico (26-09-21) y estado por sub-ronda.** Conteo real: **772 clases
(600 líneas, 83 archivos)** con el criterio gray|red|green|yellow|orange|blue|purple|violet-NNN;
el "259" que circulaba estaba subestimado ~3× y no se sabe con qué criterio se midió. 68 % es
`gray` (523), 61 % es `text-*`; solo 60 llevan `dark:`. Cero tokens fantasma en todo el repo (ni
en los 3 CSS) y el guard ya cubre `app/`, `lib/`, `context/`, `types/`, `utils/` (solo `.ts/.tsx`;
los CSS se revisaron a mano). Concentración: `app/blog` 237, `componentsHome` 122, `newsletter` 75,
`componentsBlog` 71, `profile` 67, `suscripciones` 47. **Casos que NO son mapeo mecánico:** (a)
colores de marca de terceros en `blog/[slug]/ShareButtons` (Facebook/X/LinkedIn/WhatsApp) y el
simulador SERP/OG de `blog/admin/components/SEOPreview` (imita a Google) — excepciones, no
migrar; (b) identidad por plan/rol: `SubscriptionBadge` y las tarjetas de `suscripciones`
(basic=azul, premium=púrpura, professional=verde) — resuelto en D con el token `premium-eske`, ver
abajo; (c) 5 `text-yellow-*` (4 en `suscripciones` = sub-ronda D, 1 en `newsletter/confirm` = B; **ninguno en A**) → `brown-eske-60`;
(d) chip morado de filtro en `BlogToolbar` — resuelto en C, ver abajo. **División (tokens) — las 4
sub-rondas cerradas, sitio principal en 0 salvo las 12 excepciones de marca de C:** **A ✅ RESUELTA
26-09-21 (143 → 0, 21 archivos: cookies/privacidad/condiciones, contacto, cursos, `shared`, `geo`,
`legal`, `Header`, `NotificationBell`, `HomeClient`, `lib/redactor`)**; **B ✅ RESUELTA 26-09-22
(197 → 0, 20 archivos: `componentsHome` completo incl. `RegisterModal`, `newsletter/confirm` y
`newsletter/unsubscribe`)**; **C ✅ RESUELTA 26-09-22 (310 → 0, 39 archivos: blog público + admin;
`ShareButtons` y `SEOPreview` quedan con 12 clases de marca de terceros como excepción exacta
declarada en el guard)**; **D ✅ RESUELTA 26-09-22 (124 → 0, 3 archivos: `profile`, `suscripciones`,
`SubscriptionBadge`, con el token nuevo `premium-eske`)**. **Fuera del "sitio principal": Moddulo**
(315 clases, no registrado hasta 26-09-21) → migrado, ver abajo. Quedan además 14 clases en
Centinela/Fontana (`AppCard`, kebab de Fontana) — fuera del alcance de estas 4 sub-rondas. **Pendiente
restante:** los grises `gray-eske-40`/`-70` demasiado claros en
`FontanaCanvasItemCard`/`FontanaModduloButton`, `lib/constants/categories.ts` (8 categorías de blog
con hex crudo, reportado en C, sin tocar) y los ajustes visuales puntuales que Raúl detecte.

**Sub-ronda A (26-09-21) — 143 → 0 en 21 archivos.** Método de siempre: tabla exacta (53 tokens
distintos, aborta ante lo no mapeado) y verificación: 69 clases nuevas presentes en el CSS compilado,
0 conflictos de cascada vs HEAD, guard probado en negativo (por directorio y por **archivo suelto**: el
recorrido del guard ahora acepta rutas de archivo, p. ej. `app/HomeClient.tsx`). **Guard extendido** a las
rutas de A (`app/contacto`, `politica-*`, `condiciones-*`, `cursos`, `componentsCursos`, `shared`, `geo`,
`legal`, `lib/redactor`, `HomeClient`, `Header`, `NotificationBell`). **Sin casos de identidad semántica**
(colores por plan o categoría): todo fue error/éxito/info/advertencia y grises de texto. **Hallazgo:**
`HomeClient` tenía `bg-blue-60`, `bg-orange-60`, `bg-green-60`, `bg-red-60` (avatares de testimonios): no
son clases de Tailwind (faltaba `-eske`), o sea el mismo bug de "token que no existe = no-op silencioso";
la foto los cubre por completo, así que no había efecto visible; ahora `bg-*-eske-60`. El guard de
genéricos detecta esta familia de typos (paso de 2 dígitos sin `-eske`). **Defectos previos corregidos:**
caja de advertencia de `politica-de-cookies` con fondo claro fijo y texto naranja claro en oscuro (ahora
tinte por opacidad + `dark:text`); mensaje vacío de `NotificationBell` sin variante oscura (texto oscuro
sobre la tarjeta oscura); 8 `dark:text-*` agregados en textos de error/éxito. **Contraste (medido contra
el original):** `blue-800`/`green-800` sobre tinte pasaron a `-90` (bajarían con `-80`: 8.01 → 6.90 y
6.81 → 5.75); la advertencia naranja sobre tinte ya era **3.11:1** y con `-60` sería 3.42, así que
se usó `orange-eske-80` (≈5.18); las notas terciarias `text-gray-400 dark:text-[#6D8294]` van a
`black-eske-10` (6.38:1) y no a `gray-eske-90` (4.09, no cumple AA en texto pequeño). Los botones
deshabilitados de `PaginationCursos` conservan `gray-eske-90` (estado deshabilitado). **Deuda previa
NO tocada:** `text-gray-eske-90` en texto de cuerpo/secundario de `HomeClient` y `contacto` (4.09:1).

**Sub-ronda B (26-09-22) — 197 → 0 en 20 archivos.** `app/components/componentsHome/` completo
(incl. `RegisterModal`, `LoginModal`, `SignInModal`, `RecoverPassword`, `VerifyEmailModal`,
`ScheduleDate`, los 3 modales de plan de suscripción, `PlanesInteractivos`) + `app/newsletter/confirm`
+ `app/newsletter/unsubscribe`. Mismo método: tabla exacta (44 tokens distintos, aborta ante lo no
mapeado). **Recontado antes de tocar código: idéntico al diagnóstico del 26-09-21** (`git log` sin
commits en el área desde entonces). **Sin casos de identidad semántica:** se verificó explícitamente
que los 3 modales de plan (`SuscriptionBasicModal`/`PremiumModal`/`ProfessioinalModal`) NO repiten el
patrón de `SubscriptionBadge` (básico=azul/premium=púrpura/profesional=verde) — los 3 usan los mismos
`bluegreen-eske`/`blue-eske` sin importar el plan; sus únicas clases genéricas son chrome neutro
(botón de cerrar, separadores). El resto es semántica estándar ya resuelta en rondas previas
(error=rojo, éxito=verde, info=azul, advertencia=amarillo/marrón); sin colores de marca de terceros.
**3 bugs de sufijo `-eske` faltante** (mismo patrón que `HomeClient` en A): `border-red-60`/`text-red-60`
en `ScheduleDate` (6 puntos, bordes/mensajes de validación de formulario, hoy invisibles) →
`red-eske-60`; `border-gray-90` en los 3 modales de plan (botón "Cambiar método de pago") →
`gray-eske-90`; `bg-gray-20` en `PlanesInteractivos` (3 círculos de ícono) → `gray-eske-20`.
**Caja de advertencia en `newsletter/confirm`** (el único `text-yellow-*` del diagnóstico, rama de
enlace expirado): `text-brown-eske-60` en claro + `dark:text-yellow-eske` agregado (no tenía variante
oscura), mismo criterio ya establecido. **2 gradientes de página sin variante oscura**
(`from-gray-50 to-gray-100` en `unsubscribe/page.tsx` — el fallback de `Suspense`, sus hermanos con
contenido real ya la tenían) → se agregó `dark:from-[#0B1620] dark:to-[#112230]`. **2 pares
claro/oscuro colapsados** por resolver al mismo token/opacidad por diseño (`bg-yellow-eske/10` y
`bg-blue-eske/20`, ambos ya lo eran en oscuro por convención de la familia — redundante, no error).
Contraste verificado contra el original en los mapeos no triviales (`text-blue-800` → `blue-eske-90`
8.35:1 vs 7.15:1 original; `bg-red-500`/`hover:bg-red-600` con texto blanco 5.45:1/7.38:1 vs
3.76:1/4.83:1); 2 bajan levemente pero siguen ≥ AA (`dark:text-blue-eske-30` 6.34:1,
`text-brown-eske-60` 5.37:1, patrón ya aprobado en rondas previas). Verificación: 58 clases nuevas
presentes en el CSS compilado, 0 conflictos de cascada nuevos vs HEAD, guard probado en negativo con
edición real, `tsc`, `next build` y 331 pruebas.

**Sub-ronda C (26-09-22) — 310 → 0 en 39 archivos, salvo 12 clases de marca declaradas.** Blog público
(`app/blog/` excl. `admin/` + `app/components/componentsBlog/`, 156 clases/23 archivos) + admin
(`app/blog/admin/`, 154 clases/16 archivos). **`ShareButtons` y `SEOPreview` — excepción confirmada,
pero NO en bloque:** de las 12 clases genuinamente de marca (Facebook/X/LinkedIn/WhatsApp en
`ShareButtons`; Google/Facebook/X en las pestañas de `SEOPreview`), 5 de `ShareButtons` (label
"Compartir:", botón "Copiar enlace", check de éxito) y 24 de `SEOPreview` (placeholders de imagen,
bordes, texto de cuerpo — inconsistentes con el resto del archivo, que ya usaba tokens) NO eran marca
y sí migraron. Las 12 restantes quedan como **excepción EXACTA en el guard** (lista literal, no
`toEqual([])`; probado en negativo agregando una clase de marca no declarada — falla igual que quitar
una de las 12). **Chip morado de `BlogToolbar` (26-09-22, 4º uso oficial de `violet-eske`, decisión de
Raúl):** investigado a fondo antes de tocarlo — es el 3º de tres indicadores de "filtro activo"
(categoría/búsqueda/orden), visible solo si `currentSort !== "newest"`; `currentSort` es estado de UI
local (`searchParams`), sin relación con ninguna categoría/tag/estado editorial del blog (verificado
contra `types/post.types.ts` y `lib/posts.ts`) — NO es una identidad como "No Binario", pero
reutilizar `violet-eske` sí era una decisión de diseño nueva (extender su uso oficial a un contexto
sin relación). Decisión: `violet-eske` para el chip de orden, `blue-eske` para el chip de búsqueda
(antes azul genérico) — los 3 filtros quedan visualmente distintos
(categoría=`bluegreen-eske`/búsqueda=`blue-eske`/orden=`violet-eske`). **Otros hallazgos de admin, sin
requerir decisión:** estado editorial (`admin/blog/page.tsx`) y moderación de comentarios
(`CommentFilters`/`CommentModal`/`CommentsTable`) **ya usaban tokens**; solo el hover del botón de
borrar quedó genérico (`dark:hover:bg-red-900/30` → `dark:hover:bg-red-eske/30`, 3 puntos); rol de
usuario en `CommentItem` solo gatea un permiso, sin color. `lib/constants/categories.ts` (8 categorías
con hex crudo) queda reportado, fuera de alcance (no son clases Tailwind). **Sin bugs de sufijo
`-eske` faltante** en este alcance (a diferencia de A/B). **2 casos de contraste no trivial:** banner
de error de `NewsletterSignup` sobre tarjeta `bg-bluegreen-eske` (no blanco) — `text-red-100` 5.44:1 →
`text-white-eske` s/ `bg-red-eske/20` **7.30:1**; botón × del chip de categoría
(`hover:text-gray-200` → `hover:text-white-eske`). El resto reutiliza las correspondencias por paso ya
verificadas en A/B. **2 pares claro/oscuro colapsados** (mismo criterio de rondas previas: el `dark:`
del chip de búsqueda ya era `blue-eske/20` desde antes de esta ronda — un token existente, no
genérico — y coincidió con el nuevo valor de claro). Verificación: 66 clases nuevas presentes en el
CSS compilado, 0 conflictos de cascada nuevos vs HEAD, guard probado en negativo en AMBOS bloques (el
de 0 y el de excepciones exactas), `tsc`, `next build` y 332 pruebas.

**Sub-ronda D (26-09-22) — 124 → 0 en 3 archivos, con el token nuevo `premium-eske`. Cierra las 4
sub-rondas del sitio principal.** `app/profile/page.tsx` (67), `app/suscripciones/page.tsx` (47),
`app/components/SubscriptionBadge.tsx` (10). Condicionada a decidir el púrpura de Premium — ver
"Token `premium-eske`" arriba (decisión de Raúl: token propio, no 5º uso de `violet-eske`, por ser
identidad de producto real y de tono materialmente distinto). **Texto secundario por rol, no por
paso:** en `profile.tsx` se encontraron 3 tonos distintos de contraparte oscura (`#9AAEBE`,
`#6D8294`, `#C7D6E0`) en las mismas familias `text-gray-400/500/600/700` — el mapeo siguió la tabla
de CLAUDE.md ("Texto secundario/atenuado — mapeo por rol") leyendo el par oscuro real de cada
literal, no un mapeo plano por paso (un `text-gray-500` con `#9AAEBE` va a `black-eske-20`, no a
`black-eske-10` como el paso sugeriría solo). **Bug real corregido:** `profile.tsx:902`, uno de tres
`text-gray-700` de fila de checkbox idénticos sin su par `dark:text-[#C7D6E0]` — se agregó, mismo
criterio que `OrigenCharts` (sub-ronda 2). **`SubscriptionBadge`, switch `getBadgeColor()` completo:**
`admin`→`red-eske-60` y `unsubscribed-*`→`orange-eske` (decisiones de Raúl, ambas mecánicas —
reutilizan el tono real aceptando que comparten familia con "error"/"CTA"); `registered`/`default`
(`bg-gray-400`/`bg-gray-500`, con `text-white`) — **ningún paso de `gray-eske` alcanza AA con texto
blanco** (máximo `gray-eske-90` = 4.29:1); se cambió el texto a `black-eske`/`black-eske-40`, mismo
patrón que ya usaba `visitor` (`bg-gray-eske-40 text-black-eske-40`) — `registered`→
`bg-gray-eske-60 text-black-eske` (5.03:1), `default`→`bg-gray-eske-70 text-black-eske` (5.61:1);
`visitor` conserva su mapeo con precedente directo. **Extrapolaciones de bajo riesgo** (bordes
decorativos, no texto): `border-blue-500`/`dark:border-blue-400` (Basic seleccionado) →
`border-blue-eske`/`dark:border-blue-eske-30`, mismo criterio "+1 paso en oscuro" ya documentado en
`globals.css` para `--color-brand-primary`; mismo patrón para `border-green-500`/`dark:border-green-400`
(Professional); `hover:border-blue-300`/`hover:border-green-300` → `/40`, extrapolación lineal del
patrón `-200→/30` ya usado. Casos con precedente directo no detectado por el diagnóstico inicial
(`bg-yellow-50`→`yellow-eske/10`, `border-yellow-200`→`yellow-eske/30`, `border-blue-200`→
`blue-eske/30`, `hover:bg-gray-400`→`gray-eske-70`): resueltos sin pedir decisión nueva. **Sin bugs
de sufijo `-eske` faltante** en este alcance (primera ronda, junto con C, sin ese patrón). **Sin
colores de marca de terceros** (no hay checkout ni plantilla de correo de suscripción en el repo).
1 par claro/oscuro colapsado (`bg-yellow-eske/10`, mismo criterio de rondas previas). Verificación:
47 clases nuevas presentes en el CSS compilado, 0 conflictos de cascada nuevos vs HEAD, guard probado
en negativo, `tsc`, `next build` y 333 pruebas. **Con esto quedan cerradas las 4 sub-rondas (A+B+C+D)
del sitio principal.**

**Moddulo — migración (26-09-21, orden invertido a propósito: primero el frente de mayor volumen).**
`app/moddulo` + `app/components/moddulo`: **315 de 315 clases migradas en 20 archivos** (296 el primer día, 19 púrpuras al día siguiente).
Método: tabla exacta de 99 tokens distintos que aborta ante cualquiera sin mapear, bitácora por
reemplazo, y verificación posterior: 103 clases nuevas, **todas presentes en el CSS compilado** (una
clase con token inexistente no truena, simplemente no se genera), 0 conflictos de cascada nuevos vs
HEAD. Reglas aplicadas: texto gris 600/700/800-900 → `black-eske-20/-40/base`; fondos gris 50/100 →
`white-eske-40`/`gray-eske-10`; rojo/verde/naranja/azul de texto → paso `-60…-90`; **amarillo de texto
→ `brown-eske-60`/`-80`**; tintes por opacidad del token (`/10`, `/20`); sólidos con texto blanco →
`-60` (AA); en oscuro los semánticos (`red-eske-20`, `green-eske-30`, `orange-eske-20`,
`yellow-eske`). Se **agregó `dark:text-*`** en 26 puntos que no lo tenían (texto de error/éxito y
chips de estado con tinte; los tintes por opacidad no necesitan `dark:bg`, funcionan en ambos temas).
**Corregido durante la ronda:** el primer mapeo bajaba a `text-{green,orange,blue}-700` (`-70`) sobre
tinte por debajo de AA y del original (4.30 / 4.21 vs 4.57 / 4.52); se subió a `-80` (5.22 / 5.18 /
6.14). **Casos semánticos:** `ConfigWizard` codifica **azul = Electoral, verde = Gubernamental** (dos
flujos completos): se conserva con `blue-eske`/`green-eske`, sin cambio de identidad; el naranja es un
patrón consistente de "atención" (diálogos de confirmación, badge "Editando") → `orange-eske`.
**Los 19 púrpuras (decisión de Raúl):** 15 eran el estado "Requiere ajuste" / semáforo ámbar
(`PhaseReportView`, `RDAHistoryModal`, `DVSView`, `exploracion/page`): el púrpura era la contraparte en
claro de un `dark:…yellow-eske` (rodeo por AA del amarillo en claro) → ahora **`brown-eske-60` en claro,
`yellow-eske` en oscuro**, con el patrón de `MotoresSequentialView` (borde `yellow-eske-60`, punto
`yellow-eske-70`); los pares light/dark que quedaron idénticos se colapsaron. Los otros 4 son los chips
de país (`ProjectSelector`, `redactor/page`), que **no tenían variante oscura** → `violet-eske` con su par
(`text-violet-eske-60 dark:text-violet-eske-20`). Moddulo = **0** genéricos, guard sin excepciones. **Badges del hub
(`STATUS_COLORS`, 26-09-23):** `draft` era `bg-gray-eske-20 text-gray-eske-60` (2.23:1, sin `dark:`);
ahora `bg-gray-eske-20 text-black-eske-20 dark:bg-white/10 dark:text-[#C7D6E0]` (claro 6.20:1, oscuro
6.56:1). `archived` recibió el mismo `dark:text-[#C7D6E0]`: con `#9AAEBE` daba 4.26:1 sobre el tinte
`white/10` (< AA); el mapeo por rol de la tabla de texto secundario NO alcanza AA sobre ese tinte, usar
`#C7D6E0`. **Mismo defecto sin corregir:** el badge archivado del hub de PESTEL
(`app/centinela/pestel/page.tsx`) conserva `dark:text-[#9AAEBE]` (4.26:1).

**Regla**: usar siempre colores del design system. No usar colores genéricos
de Tailwind (`blue-500`, `gray-300`) en componentes nuevos.

**Regla (badges/chips de estado — aplica a cualquier app nueva del
ecosistema):** un badge con fondo de un color "claro fijo" (ej.
`bg-gray-eske-20`, `bg-yellow-100`) SIEMPRE necesita su propia variante
`dark:bg-*` — nunca asumir que un fondo claro + texto le va a leer bien
sobre una card oscura solo porque se ve bien en modo claro. Verificar
ambos temas explícitamente para todo badge de estado (activo/pausado/
archivado/borrador, etc.), no solo el estado por defecto.

### Abreviaturas de estado (convención por contexto, 26-09-23)

Una sola tabla de letras (`lib/geo/abreviaturasEstado.ts`, por CVE) y **tres formas según el
espacio**; nunca escribir una tabla de abreviaturas nueva en un componente:

| Forma | Ejemplo | Cuándo | Fuente |
|-------|---------|--------|--------|
| Nombre completo | Estado de México | Prosa, tooltips, tablas con espacio | catálogo (`nombreEstadoDisplay`) |
| Código compacto (MAYÚSCULAS, sin puntuación, 2-6 letras) | `EDOMEX` | Ejes y columnas angostas (heatmap de origen de Sefix) | `codigoEstado(cve)` |
| Forma con punto | `EDOMEX.` (CDMX sin punto) | Etiquetas cortas de texto (padrón de Moddulo: "GUADALAJARA, JAL.") | `abreviaturaConPunto(cve)` |

Prosa de Sefix (`semanalUtils`): nombre completo para los 32 salvo `CDMX` (siglas universales).
**Solo display:** ningún proceso lee ni une datos con estos códigos; la clave de dato es el CVE o la
llave snake (`ln_<estado>`), y el orden de `RECEPTOR_ORDER`/`ORIGIN_SUFFIXES` es contrato de datos
(test que lo fija verbatim). **Códigos reservados a países:** `MEX` es México (ISO3, Fontana F4), por lo
que el Estado de México es **`EDOMEX`**; `COL` es Colombia, por lo que Colima es **`COLI`**. Test
permanente: ningún código de estado coincide con un ISO3 que el sistema conozca. Cambios visibles al
unificar: Moddulo `COL.`→`COLI.`, `TAMS.`→`TAMPS.`, `Q.ROO.`→`QROO.`; heatmap `MEX`→`EDOMEX`; prosa
`Edo. México`/`B.C.S.`/`S.L.P.`/`Q. Roo` → nombres completos. **Medido (Chrome, Arimo 9 px):** `EDOMEX`
= 39.02 px (el más ancho; `TAMPS` 30.3, `QROO` 27.5, `COLI` 21.0), todos caben en el eje vertical
(67 px útiles); en la columna de etiquetas de fila `EDOMEX` desbordaba por 0.02 px (44 px − 5 de
padding = 39), así que la columna pasó a **48 px**. *Nota:* `NL` es también el ISO2 de Países Bajos;
el sistema solo maneja ISO3, así que no colisiona hoy — revisarlo si se incorpora ISO2.

### Tipografía
- **Arimo** — body y títulos generales
- **PT Sans** — captions y texto pequeño
- **Philosopher** — títulos en el blog

### Flex + `truncate`: regla Safari

`truncate` requiere `min-w-0` en el elemento mismo (o en su flex/grid parent directo)
cuando está dentro de un flex o grid container. Sin él, Safari desborda el texto;
Chromium lo oculta casualmente.
- Alternativa válida: `max-w-*` en el elemento con `truncate`.
- Contexto bloque (elemento dentro de `block` o `block-link`): `min-w-0` no aplica;
  el ancho de bloque ya constrae el elemento. No se necesita `min-w-0`.

---

## Nomenclatura de Distritos Electorales (convención de UI compartida)

**Estándar obligatorio para TODA la UI del ecosistema** (Sefix, Fontana, Moddulo/TerritorySelector,
y cualquier app futura del catálogo MMEE que muestre distritos electorales):

`{prefijo D.F./D.L.} {cve_estado, 2 dígitos}{cve_distrito, 2 dígitos} {CABECERA en mayúsculas}`

Ejemplos: `D.F. 1405 PUERTO VALLARTA` (Jalisco, distrito federal 05), `D.L. 0927 IZTAPALAPA` (CDMX,
distrito local 27).

**Por qué**: el número de distrito solo (ej. "Distrito 05") es ambiguo — existe un distrito 05 en
cada estado, y un mismo municipio puede ser cabecera de varios distritos (ej. Guadalajara e
Iztapalapa aparecen 3 veces cada uno en su estado). La cve de 4 dígitos (estado+distrito) es
autosuficiente, no depende de contexto externo (encabezado de columna, estado ya seleccionado en otro
control) para ser inequívoca.

**Implementación de referencia**: `lib/geo/formatDistrito.ts` (`formatDistritoLabel()`) — función
compartida, sin dependencias server-only, importable tanto desde componentes cliente
(`TerritorySelector.tsx`) como desde adaptadores server-side (`lib/fontana/ingesta/eceg.ts`). Origen:
proyecto real `nZvpYu4nnZrsw5hoGcVP` (Iztapalapa) expuso la ambigüedad — 26-08-15/16.

**No confundir con** `GeoOptionDistrito.nombre` (`lib/geo/distritos.ts`, formato legado
`"D.F. 001 – JUAREZ"`, sin cve de estado) — ese campo NO cambia de forma porque Sefix lo parsea con
`split("–")`; el formato nuevo se construye al CONSUMIR ese campo vía `formatDistritoLabel()`, nunca
en la fuente compartida.

---

## Geografía compartida — `lib/geo/` (normalización de nombres)

**Punto único para resolver/normalizar nombres geográficos en TODO el ecosistema**
(Sefix, Fontana, PESTEL, Moddulo y apps futuras). Módulos puros (sin firebase/red):
`lib/geo/municipioCanonico.ts` (municipios), `lib/geo/estados.ts` (estados),
`lib/geo/display.ts` (nombre a mostrar), `lib/geo/candidatosGeo.ts` (búsqueda por
nombre que devuelve TODOS los candidatos: Estado/Municipio/Distrito federal/Distrito
local) y `lib/geo/cabeceraNombres.ts` (comparación de nombres de cabecera),
`lib/geo/claveMunicipioEstado.ts` (clave de un municipio tecleado dentro de un estado) y
`lib/geo/abreviaturasEstado.ts` (códigos/abreviaturas de estado para DISPLAY; ver "Abreviaturas
de estado" en Estilos).
**Antes de escribir cualquier
`.normalize("NFD")`/`toUpperCase()` sobre un nombre de estado/municipio/distrito,
usar estos** — el diagnóstico del 2026-09-19 encontró ~18 implementaciones que
discrepaban y 4 fallos reales (padrón de "Tlaquepaque" devolvía el dato estatal,
`matchDistrito` fallaba con "Tonalá", 4 resolvers de estado contradiciéndose,
`toStorageKey("Jalisco")` → `"J"`). Tests: `lib/geo/normalizacionGeografica.test.ts`.

**Dos representaciones del mismo dato — nunca colapsadas en una función:**
- **Clave interna** (comparar/unir/nombrar archivos): MAYÚSCULAS, sin acentos,
  Ñ/Ü conservadas — `normalizeGeoName`, `claveCanonicaMunicipio(estadoCve, nombre)`,
  `resolverEstado(x).clave`, `claveAlmacenamiento(x)`.
- **Nombre a mostrar** (`lib/geo/display.ts`, `nombreEstadoDisplay`):
  - Distrito electoral → prefijo + cabecera en MAYÚSCULAS sin acento:
    `"1405 PUERTO VALLARTA"`, `"3103 MERIDA"` (`nombreDistritoDisplay`). El
    prefijo desambigua cabeceras compartidas (Mérida ×3, Tonalá y Zapopan ×2).
  - Estado/municipio/ciudad → sin prefijo, capitalización normal, CON acentos:
    `"Puerto Vallarta"`, `"Michoacán"` (no "…de Ocampo"), `"Veracruz"`,
    `"Estado de México"`. Los acentos de un municipio NO se pueden inventar: el
    topojson INE y el padrón DERFE vienen en MAYÚSCULAS sin acentos (2,477/2,477)
    — `nombreMunicipioDisplay` conserva acentos si el nombre ya los trae y lo
    declara (`conAcentosGarantizados`) si no.

**Reglas de producto (codificadas, no reinterpretar):**
- `resolverEstado("México")` → **Estado de México (CVE 15)** (igual que la copia de
  Cloud Functions y las fuentes DERFE/SESNSP/ENIGH). El PAÍS "México" (selector de
  país del proyecto, `territorio.pais`, y el `nombre` de un territorio de nivel
  `"nacional"`) es un contexto aparte: **nunca** pasar `territorio.pais`/`nombre` de
  un territorio nacional a estas funciones. Verificado 2026-09-19: hoy ningún camino
  lo hace (los resolvers reciben `territorio.estado`, `undefined` en nacional).
- **Alcance nacional:** el enum `nivel: "nacional"` sigue siendo la fuente
  estructural. Para un TEXTO de estado: `resolverEstado("Nacional")` →
  `{ esNacional: true, cve: null, clave: "NACIONAL", nombre: "Nacional" }` (unión
  discriminada: nunca un CVE inventado). Vacío/`undefined` **no** es nacional en el
  helper compartido — Sefix lo trata como nacional en su borde
  (`!estadoInput || esAlcanceNacional(estadoInput)`); los adaptadores de Fontana
  como "sin estado". No confundir con el `ámbito: "nacional" | "extranjero"` de
  Sefix (voto en el extranjero — otro concepto).
- Resolución de municipio: siempre `claveCanonicaMunicipio` (alias verificados,
  nunca reglas genéricas de prefijo — ver `claves-geograficas-no-confiables.md`).

**Pendientes registrados (no perder de vista):**
- **Desambiguación de texto libre/dictado** ("dame la votación en México" — ¿país o
  Estado de México según el resto de la frase?). NO se resuelve en este helper: es
  interpretación conversacional, no normalización de catálogos estructurados.
  Candidato natural: el trabajo de Sefix-AI (T06). Por eso
  `lib/fontana/geo/resolverTerritorioNombre.ts` (nombres dichos por el usuario en el
  chat de Fontana) sigue usando `ESTADO_CVE_MAP` directo y NO resuelve "México" a estado.
  **Reconocimiento de ENTRADA del Estado de México (anotado 26-09-23, NO implementado):** cuando un
  USUARIO lo escribe o dicta debe reconocerse en cualquiera de sus formas — "México", "Edomex",
  "EDOMEX", "MEX" en contexto de estado, "Estado de México", "Mex." — y decidir país vs estado según
  el resto de la frase. Es interpretación conversacional de nomenclatura geográfica (Punto 2 de la
  agenda, con el agente de Fontana como base), no display: `abreviaturasEstado.ts` solo PRODUCE texto.
  **`MEX` queda reservado para el país** en todo texto que el sistema genere (nunca como código de
  estado); si `resolverEstado` llega a aceptar "MEX", será solo dentro de esa capa contextual.
- **Guard de sincronización con la copia de Cloud Functions — RESUELTO (2026-09-20).**
  `functions/src/utils/estadoCveMap.ts` (functions/ no puede importar de `lib/`) ya no se
  mantiene a mano: es un archivo **GENERADO** desde `lib/geo/estados.ts` (catálogo +
  `ALIAS_ESTADO`) y el mapa de acentos de `municipioCanonico.ts` por
  `scripts/lib/geoCfSync.ts` (`npm run sync-geo-cf`; `npm run check-geo-cf` solo chequea).
  Guard **bloqueante**: `lib/geo/estadoCveMapCF.test.ts` falla —y por tanto el paso 1 del
  pre-push, `npm run test`— si el archivo commiteado difiere byte a byte de lo que genera
  la fuente, o si una batería de paridad (nombres, claves, alias, mayúsculas, acentos, `_`,
  espacios, nacional, vacío, no-string) da otra respuesta que `resolverEstadoCve`. Por qué
  bloquea y no solo avisa: es determinista y local (ms, sin red ni fechas) → sin falsos
  positivos, a diferencia del detector de frescura; y dejar pasar una divergencia significa
  un CVE `null` en silencio (scrapers INEGI omitidos en `scrapeAndAnalyze`). La divergencia
  que había (CDMX/DF, nombres oficiales largos, espacios de más, `nuevo_leon`, y `TypeError`
  con entradas no-string; 296 entradas de la batería) se corrigió al generar el archivo. El
  guard se probó contra la lógica anterior (fixture verbatim en el test) y editando a mano un
  alias. **Remanente:** `country.ts` ↔ `functions/src/utils/country.ts` (país, no estado; 4
  líneas idénticas salvo comentarios) sigue con sincronización manual — candidato a extender
  este mismo guard.
- **Ambigüedad por nombre compartido — capa de DATOS lista (2026-09-19); interfaz de
  desambiguación PENDIENTE de diseño.** `matchDistrito` ya no existe: la sustituye
  `buscarDistritoCandidatos()` (`lib/sefix/districtMatching.ts`), que devuelve la LISTA
  de candidatos (0/1/n; cada uno con `nombre`, `codigo` de 4 dígitos, `anio` y
  `estrategia`) en vez de "el primero". Estrategias, en orden: (a) `cve_distrito` +
  estado → código; (b) número (romano/arábigo) del texto legado + estado → código; (c)
  nombre exacto; (d) cabecera de la frase legada "con cabecera en X" (todas las
  coincidencias). El código (a/b) solo se acepta si el nombre de cabecera es compatible
  (contención de palabras: "QUERETARO" ~ "SANTIAGO DE QUERETARO", nunca "NAUCALPAN DE
  JUAREZ" ~ "AMECAMECA DE JUAREZ"); sin nombre de referencia, solo en la numeración
  vigente (año ≥ 2024). Los 4 call sites (`exploracion/page.tsx` ×2, `sefixContext.ts`
  ×2) toman `[0]` vía `primerCandidatoTemporal()` con `console.warn` de medición
  (TEMPORAL). Núcleo de 4 categorías: `buscarCandidatosPorNombre(texto, {estadoCve,
  municipios, tipos})` → `CandidatoGeo[]` (tipo, clave, nombre de display,
  `coincidencia` exacta/parcial, `anio`, `nombresPorAnio`); el catálogo de municipios se
  inyecta (el de INE es server-only). Hoy ningún call site lo usa: es la base para
  Sefix-AI/texto libre, junto con `resolverTerritorioNombre` (Estado vs Municipio, que
  sigue resolviendo por su cuenta).
  **Hallazgo completo (datos reales, 132 CSV de Storage: federal 2006-2024, local
  2015-2024; Firestore de proyectos Moddulo):**
  - *Nombre compartido dentro de un estado (2024):* 37 nombres de cabecera federales y 90
    locales los comparten varios distritos (Mérida ×3 = 3103/3104/3106; Iztapalapa ×4
    fed; Ecatepec ×5; Tijuana ×4).
  - *Cuatro categorías:* 12 estados tienen cabecera con el nombre del Estado en algún año
    (Aguascalientes, Campeche, Colima, Chihuahua, Durango, Guanajuato, Puebla, Querétaro,
    San Luis Potosí, Tlaxcala, Veracruz, Zacatecas — 13 fed / 10 loc, según el año) y 13
    estados tienen un MUNICIPIO homónimo (los 12 + Sinaloa): triple homonimia
    Estado/Municipio/Distrito. Querétaro = Estado 22 + Municipio + fed 2203/2204/2206 +
    locales 2201-2206. 14 nombres de cabecera existen en >1 estado (Tonalá, Cuauhtémoc ×3,
    Guadalupe, Juárez…): se resuelven porque todos los call sites conocen el estado.
  - *Dimensión temporal (confirmada, grande):* el nombre de la cabecera cambia entre años
    en 136 de 313 códigos federales (26 estados) y 342 de 692 locales (30 estados)
    (`lib/geo/cabeceras_historicas.json`, generado por `scripts/geo-cabeceras-historicas.ts`).
    Una parte son renombres de la MISMA cabecera (QUERETARO ↔ SANTIAGO DE QUERETARO 2006/
    2015 vs 2009/2012/2018+, CD. ↔ CIUDAD, TOLUCA ↔ TOLUCA DE LERDO); el resto es el mismo
    CÓDIGO reasignado a otro territorio (Baja California 0206 = Mexicali en 2016, Tecate
    desde 2019; México 1521 = Naucalpan hasta 2015, Amecameca desde 2018).
    **Identidad de un distrito = (tipo, año, código de 4 dígitos)**; ni el nombre ni el
    código solos son estables entre años, y no se afirma continuidad entre años.
  - *Numeración del selector vs resultados:* federal 300/300 códigos del catálogo 2025
    (`cabeceras_fed.json`) coinciden con el CSV 2024; **local solo 513/679**: 128 códigos
    (19 %) son OTRO territorio en el CSV de resultados (Tabasco 19/21, Zacatecas 10/18,
    Yucatán 9/21, Nayarit 8/18…). Sin la verificación de nombre, un proyecto estructurado
    con `cve_distrito` local habría recibido en silencio los resultados de otro distrito.
    Coahuila y Tamaulipas no tienen archivo local 2024 (el bucle por años de
    `resolveDistrictCabecera` lo cubre).
  - *Dos bugs reales de `matchDistrito`, corregidos:* (1) el territorio ESTRUCTURADO del
    wizard nuevo (`cve_distrito:"027"`, `municipio:"IZTAPALAPA"`; proyecto real
    `nZvpYu…`) nunca resolvía (la opción trae cve === nombre, "0927 IZTAPALAPA", así que
    comparar con "027" jamás coincidía) y Sefix caía en silencio a nivel estatal: ahora →
    `0927 IZTAPALAPA`; (2) el número del texto legado se ignoraba ("… IV … Mérida" daba
    3103, el primero): ahora → 3104. Los 2 proyectos legados reales (Puerto Vallarta "V")
    no cambian. Además `matchDistrito` no reparaba mojibake (25 cabeceras locales reales
    como "TLAJOMULCO DE ZU" + "Ã" + U+0091 + "IGA").
  - *Calidad de dato:* el CSV local de Colima 2015 trae "NO ESTABLECIDO ACUERDO 27/NNNN"
    (370 filas) en lugar de la cabecera; se excluye de `cabeceras_historicas.json`.
  - *Superficie relacionada NO tocada:* 15 adaptadores de Fontana pasan de distrito a
    municipio con `extraerCiudadCabecera()` (`lib/moddulo/territorioLabel.ts`); 88 de 361
    cabeceras federales NO son nombre de municipio (CIUDAD DEL CARMEN, VICTORIA DE DURANGO…).
  **Pendiente:** la interfaz de notificación/desambiguación al usuario (qué se le muestra
  cuando hay >1 candidato, cómo elige, cómo se recuerda) queda sin diseñar, ligada al
  trabajo de interpretación de texto libre/Sefix-AI ya anotado arriba; aquí solo se
  preparó el terreno de datos. Cuando exista, los call sites TEMPORAL usan la lista completa.
- **Resoluciones inline de estado — MIGRADAS (2026-09-19).** Las 32 (17 archivos:
  adaptadores de Fontana, `lib/fontana/tabla/`, rutas `app/api/fontana/**` y
  `app/api/geo/resolver-municipio`) ahora usan `resolverEstadoCve`; el ratchet de
  `lib/geo/estados.test.ts` está en **0**. Un test de propiedad prueba que toda
  entrada que resolvía la expresión vieja da el MISMO CVE con el resolver nuevo (solo
  cambian los casos que antes fallaban: "México", nombres oficiales largos, CDMX).
  Caso real verificado: F3-1 (homicidios) con "México" resuelve como F1-1 (7.4, Edomex).
  Excepciones deliberadas (documentadas en el código): (a) `resolverTerritorioNombre.ts`
  línea del lookup de texto libre sigue con `ESTADO_CVE_MAP[norm]` (ambigüedad "México"
  → pendiente Sefix-AI, ver arriba); (b) fuentes indexadas por NOMBRE de estado usan
  `claveEstadoDatos` (canonicaliza ambos lados) y conservan alias PROPIOS de la
  fuente (IEP: nombres en inglés; SHCP: `ALIAS_ENTIDAD_SHCP`). Al migrar aparecieron
  fallos silenciosos reales, ya corregidos: STPS devolvía 0 (no error) para estados
  con nombre largo (F3-16), ENVIPE fallaba en 4 estados, IEP no resolvía CDMX/Edomex.
- **Resultados locales de Sefix — CORREGIDO (2026-09-19).** `getResultadosLocalesFiltered`
  compara el municipio con `claveComparacionMunicipio` en ambos lados (alias + plegado
  Ñ/Ü) y repara con `repararMojibakeGeo` la Ñ mal codificada que trae el CSV real de
  Jalisco ("ZUÃ\x91IGA"). Antes: Tlaquepaque/Gral. Escobedo/Tlajomulco → 0 votos;
  ahora 284,031 / 168,321 / 225,030. Tests: `lib/sefix/resultadosLocalesMunicipio.test.ts`.
- **Resultados FEDERALES de Sefix — CORREGIDO (2026-09-19).** `getResultadosFiltered`
  compara el municipio con `claveComparacionMunicipio` en ambos lados (el CVE de estado sale
  del estado pedido o, en alcance nacional, de `cve_estado` de la fila). Evidencia real: 12
  municipios cambian de nombre CRUDO entre años en los CSV federales (TLAQUEPAQUE 2006-2012
  ↔ SAN PEDRO TLAQUEPAQUE 2015+, SILAO ↔ SILAO DE LA VICTORIA, MEDELLIN ↔ MEDELLIN DE
  BRAVO, ACAMBAY ↔ ACAMBAY DE RUIZ CASTAÑEDA, varios de Oaxaca) y `allYears` pasa la MISMA
  cadena a todos los años → 0 votos en silencio en los años con otro nombre. Antes/después:
  Tlaquepaque 2006-2024 0 → 203,330 / 179,932 / 252,951 / 188,134 / 258,865 / 285,854;
  Silao 2009 0 → 52,152; Medellín de Bravo 2018 0 → 28,989; Gral. Escobedo 2024 0 → 169,095;
  control (ZAPOPAN 2024, nombre idéntico) 677,614 = 677,614. No se aplica
  `repararMojibakeGeo` (0 municipios federales con mojibake; sí en los locales). No tocados:
  la cascada geo (`getEleccionesGeo` / `getEleccionesLocalesGeo`, filtro `row.municipio ===
  municipio` de secciones), que recibe la cadena de la opción del mismo año; la local además
  compara con opciones ya limpiadas por `cleanGeoName` (quita '?') contra la fila cruda: 1
  caso real (CA?ITAS DE FELIPE PESCADOR, 2016).
- **Otros normalizadores sueltos — MIGRADOS (2026-09-20), con remanente explícito.**
  Barrido con datos reales (Firestore de proyectos, Storage de Sefix). Migrados (derivan del
  núcleo, con test contra el fixture anterior verbatim en `lib/geo/normalizadoresSueltos.test.ts`):
  (1) Moddulo F2 `normalizeParaAbrev`/`ESTADOS_ABREV` → `lib/moddulo/abreviaturaEstado.ts`
  (tabla por CVE, mismos valores; ahora resuelve "Distrito Federal", "Edo. Méx."…);
  (3) `TerritorySelector` `ESTADOS_MEXICO` (valores que se GUARDAN en `territorio.estado`) →
  `NOMBRES_ESTADO_ORDENADOS`; (4) su dedup de municipios tecleados (`trim().toLowerCase()`) →
  `claveMunicipioDeEstado` (alias verificados + acentos: "San Pedro Tlaquepaque" ya no se
  agrega tras "Tlaquepaque" — doble conteo en agregación aditiva; 0 duplicados reales aún);
  (5) `territorioHeuristicas` NFD-strip propio → plegado compartido; (6) **`checkTerritoryMatch`**
  (`lib/moddulo/linkCompatibility.ts`, puerta de la vinculación Moddulo↔PESTEL/Fontana/Canal 3):
  comparaba estado/municipio/cve_distrito con `!==` → estado por CVE, municipio por
  `claveComparacionMunicipio`, distrito por número (`extraerNumeroDistrito`), país plegado.
  Fallo real corregido: proyecto `nZvpYu…` (Iztapalapa, local 27, estructurado) vs sesión
  Fontana `1qEjT…` (mismo distrito, texto) daba `"mismatch"`; ahora `"approximate"` (496 pares
  reales: 495 idénticos, 1 cambia; los 5 mismatch genuinos de municipios distintos se conservan;
  "exact" sigue exigiendo `cve_distrito` en ambos lados — nunca se concede por interpretar
  texto); (7) Sefix cliente: `ESTADO_MAP` (`lib/sefix/constants.ts`), la llave "snake"
  (`claveEstadoSnake`, única definición para `SemanalView`, `semanal-origen-matriz` y el
  pipeline — 32/32 claves de `por_entidad` en Storage verificadas), `pregenerate-semanal.ts`
  (33 nombres crudos reales de los CSV: mismas claves que antes), `GeoNavegador` `ENTIDADES` y
  `OrigenCharts` `NOMBRES`/`ESTADOS_ORIGEN_KEYS`. Ninguno tenía un fallo activo (excepto el 6):
  eran copias con riesgo latente (si una cambia, el heatmap de origen queda vacío en silencio).
  **Remanente (decisión de diseño, no se tocó):** (a) las tablas de **abreviaturas** (3 convenciones
  distintas: `TAMPS` vs `TAMS.`; `MEX` vs `EDOMEX.` vs `Edo. México`) — **RESUELTO 26-09-23**: tabla única
  en `lib/geo/abreviaturasEstado.ts`, tres formas por contexto, `EDOMEX` y `COLI`; ver "Abreviaturas de
  estado" en Estilos;
  (b) `detectEstadoFromXpcto`/`ESTADOS_MEXICO` de `exploracion/page.tsx`: busca un estado por
  subcadena en texto libre; 0 fallos en 11 XPCTO reales, pero la subcadena da falsos positivos
  demostrables ("Miguel Hidalgo", "Ecatepec de Morelos", "Vicente Guerrero") y "México" (país vs
  Estado) exige decisión → pertenece a la interpretación de texto libre/Sefix-AI; (c)
  `country.ts` (ver guard CF). No son normalizadores de nombres geográficos y no se migran:
  plegado de texto genérico de Fontana (`pipMinimos`, modales, encabezados CONEVAL),
  `extractedDataGrounding`, y los catálogos con numeración propia de la fuente
  (`stpsHuelgas` 2..33 ≠ CVE INEGI, `sesnsp`, `ESTADO_TO_LOC_KEYS`,
  `eleccionesLocalesConstants`). Los lookups directos `ESTADO_CVE_MAP[x]` de hooks de UI de
  Sefix reciben valores canónicos del selector, no texto libre.
- Restaurar acentos de municipios para display: ningún catálogo estructurado actual
  los conserva (el ITER solo trae la clave canónica).

---

## Nomenclatura — pestaña de lienzo/Canvas de apps del ecosistema

**Convención de naming a seguir en toda app del catálogo MMEE que tenga una pestaña
de "lienzo" (Canvas):** la etiqueta visible de esa pestaña es **`Canvas - {NombreApp}`**.

- Fontana (T10): `Canvas - Fontana` (`app/centinela/fontana/FontanaWorkspace.tsx`).
- Cuando llegue Sefix-AI (T06) u otra app con lienzo: `Canvas - Sefix-AI`, etc.

**Por qué**: cada app del ecosistema puede aportar su propio lienzo dentro de un mismo
flujo (ej. F3-Investigación consume varias técnicas); una etiqueta genérica "Canvas" o solo
el nombre de la app ("Fontana") es ambigua cuando conviven varias. `Canvas - {App}` deja
claro qué lienzo es sin depender de contexto externo.

El `id` interno de la pestaña NO cambia por esto (Fontana sigue siendo `id: "fontana"`) —
la convención es solo sobre la etiqueta que ve el usuario.

---

## SEO — Estándar de Construcción (Vertiente B)

**Aplica a toda `page.tsx` y componente nuevo o modificado.**
Spec completo: `docs/specs/seo-tecnico.md`

### Workflow obligatorio

Antes de escribir o modificar cualquier código para una página o componente:

1. Leer `docs/specs/seo-tecnico.md` (o la sección relevante si ya se leyó en la sesión).
2. Identificar qué secciones aplican a esa pieza concreta.
3. Aplicar la **Vertiente B** desde el primer borrador — no como ajuste posterior.
4. **Antes de entregar el código final**, declarar en lista breve qué secciones se aplicaron y cómo.

### Qué sección aplica a qué tipo de pieza

| Sección | Aplica a |
|---------|---------|
| 1.3 meta robots | Toda `page.tsx` — declarar política de indexación explícita |
| 1.7 canonical | Páginas filtrables, paginadas o con variantes de URL |
| 1.8 `notFound()` | Flujos donde el usuario puede llegar a contenido inexistente |
| 2.3 breadcrumbs | Páginas dentro de jerarquías (`/blog/`, `/moddulo/`, `/cursos/`) |
| 2.5 semántica HTML | Todo componente con contenido textual — etiquetas H1-H6 reales |
| 3.1 title | Toda `page.tsx` — único por página, keyword cerca del inicio |
| 3.2 description | Páginas de alto valor — manual; nunca genérica repetida |
| 3.4 H1 | Exactamente un `<h1>` por `page.tsx`; ningún componente reutilizable incluye su propio H1 |
| 3.6 alt text | Todo `<Image>` — descriptivo y específico |
| 4.1-4.2 rendimiento | Evaluar ISR / SSG vs SSR por tipo de contenido |
| 5.1 Server Components | Contenido de la página como Server Component por defecto |
| 5.3 `<Link>` | Navegación interna con `<Link>`, nunca `<button onClick={router.push}>` |
| 6.1 schema | Artículos (BlogPosting), listas (Blog), FAQ, Organization, Breadcrumb |
| 7.2 Open Graph | Toda `page.tsx` — `openGraph` con `images` (1200×630) y bloque `twitter` |

### Metadata mínima para toda `page.tsx`

```tsx
export const metadata: Metadata = {
  title: "Título único con keyword — Eskemma",
  description: "Descripción manual en páginas de alto valor",
  robots: { index: true, follow: true },
  alternates: { canonical: `${SITE_URL}/ruta` },
  openGraph: {
    title: "...", description: "...",
    url: `${SITE_URL}/ruta`, siteName: "Eskemma",
    locale: "es_MX", type: "website",
    images: [{ url: "...", width: 1200, height: 630, alt: "..." }],
  },
  twitter: {
    card: "summary_large_image",
    title: "...", description: "...", images: ["..."],
  },
};
```

**Imagen OG placeholder:** `${SITE_URL}/images/blog-hero.jpg` (1200×630, existe en `public/images/`)
hasta que haya imagen OG corporativa diseñada.

---

## Accesibilidad (WCAG AA — no negociable)

- `aria-hidden="true"` en íconos decorativos
- `aria-label` en botones de solo ícono
- `htmlFor` asociado a todos los inputs
- Focus rings con `focus-visible:` (no `focus:`)
- Modales: hook `useFocusTrap` (`app/hooks/useFocusTrap.ts`)
- Escape en modales/dropdowns: hook `useEscapeKey` (`app/hooks/useEscapeKey.ts`)
- Animaciones: respetar `prefers-reduced-motion`

---

## Estructura del Proyecto

```
/
├── app/
│   ├── api/                          # 142 API route handlers (recontado 26-09-21)
│   │   ├── auth/session/             # POST/DELETE/GET sesiones
│   │   ├── moddulo/                  # CRUD proyectos + chat SSE
│   │   └── centinela/pestel/        # config, feed, trigger, status
│   ├── components/
│   │   ├── centinela/pestel/dashboard/  # RiskVectorWidget, PESTLPanel
│   │   └── moddulo/
│   ├── centinela/pestel/
│   │   ├── page.tsx                  # Hub (lista de análisis)
│   │   └── analisis/[id]/page.tsx    # Vista individual PEST-L
│   └── moddulo/proyecto/[projectId]/[phaseId]/
├── lib/
│   ├── ai/claude.ts                  # Instancia Anthropic
│   ├── server/                       # Utilidades solo servidor
│   └── centinela/pestel/            # Lógica PESTEL
├── types/
│   ├── pestel.types.ts
│   ├── moddulo.types.ts
│   ├── firestore.types.ts
│   ├── session.types.ts
│   └── subscription.types.ts
├── context/AuthContext.tsx
├── functions/src/pestel/          # Cloud Functions (build separado)
│   ├── scrapeAndAnalyze.ts           # HTTP CF principal
│   ├── scheduledMonitor.ts           # Cron cada 6 horas
│   ├── generateFeed.ts               # Orquestador PEST-L
│   ├── classifier/claudePESTL.ts     # Clasificación con Claude
│   ├── risk/vectorCalculator.ts      # Cálculo determinístico
│   └── scrapers/                     # googleNewsRSS, dof, inegi, banxico
├── firestore.rules
├── storage.rules
└── firebase.json
```

---

## Cloud Functions — Reglas de Desarrollo

Las functions tienen su propio `package.json` y `tsconfig.json` en
`functions/`. **No pueden importar desde `lib/` del proyecto raíz.**

### Lógica duplicada: puntos de sincronización manual obligatorios

Cuando se modifique cualquiera de estos archivos, actualizar AMBAS copias simultáneamente:

| Lógica | Next.js | Cloud Function |
|--------|---------|---------------|
| Google News RSS scraper + tabla de locales por país | `lib/centinela/pestel/scraper/googleNewsRSS.ts` | `functions/src/pestel/scrapers/googleNewsRSS.ts` |
| Gate de país `isMexico()` | `lib/centinela/pestel/utils/country.ts` | `functions/src/utils/country.ts` |
| Pesos del escaneo PESTEL por tipo de proyecto (dimensiones prioritarias/seguimiento) | `lib/moddulo/dimensionPriority.ts` | `functions/src/pestel/dimensionPriority.ts` |
| Resolución de estado → CVE (`getCveEntidad`) | `lib/geo/estados.ts` | `functions/src/utils/estadoCveMap.ts` — **GENERADO**, no editar: `npm run sync-geo-cf`; guard bloqueante en `lib/geo/estadoCveMapCF.test.ts` (pre-push) |

**Checklist obligatorio al sincronizar instrucciones de PROMPT (no solo tablas/funciones)
entre el path express (una sola llamada a Claude cubre las 6 dimensiones) y el path
Centinela (una llamada por dimensión, vía `buildDimensionPrompt`):**

No basta con igualar el texto por rama/dimensión. Antes de dar por cerrada la
sincronización, verificar explícitamente si la instrucción que se está portando
dependía, en el path de una-sola-llamada, de un bloque **global/implícito** que
aplica a las 6 dimensiones a la vez (ej. una sección única de "reglas de campo"
al final del prompt) — ese bloque **no tiene equivalente natural** en el path
por-dimensión de Centinela, donde cada llamada solo conoce su propia dimensión.
Si la instrucción incluye un caso negativo o una excepción ("no aplica cuando...",
"deja este campo en false salvo que...", "omite esto para el resto de los casos"),
esa regla debe reescribirse explícitamente **dentro de cada rama relevante** del
prompt por-dimensión, no asumirse heredada de un bloque global que allí no existe.

Precedente: el campo auditable `escaladaPorRelevanciaLocal` (M1, pesos por tipo
de proyecto) se implementó primero en express con la regla negativa en un bloque
global de reglas de campo aplicable a las 6 dimensiones; al portar el mismo
criterio a `claudePESTL.ts` (Centinela, prompt por dimensión) esa regla negativa
no tenía dónde vivir y se perdió — resultado: una dimensión ya prioritaria podía
marcarse incorrectamente como "escalada por relevancia local", detectado recién
en verificación en vivo (26-07-19). Mismo tipo de punto ciego que el header
combinado INEGI/Banxico y el sesgo hacia datos numéricos del contexto Legal de
Colombia: una suposición válida en la forma de datos/granularidad de un path deja
de sostenerse al portarla al otro sin re-derivarla explícitamente.

### ESLint Google style guide (obligatorio para deploy)

- Comillas **dobles** `"` (no simples)
- Indentación **2 espacios**
- Líneas máximo **80 caracteres**
- Operadores ternarios `?` y `:` al **final** de la línea
- JSDoc con `@param` y `@return` en todas las funciones exportadas
- Sin espacios dentro de `{}` en imports: `import {foo} from "bar"`

### Workflow de deploy

```bash
cd functions && npm install       # Siempre antes si cambió package.json
firebase deploy --only functions
```

### Secrets (Firebase Secret Manager, no `.env`)

```bash
firebase functions:secrets:set ANTHROPIC_API_KEY
firebase functions:secrets:set INEGI_TOKEN
firebase functions:secrets:set BANXICO_TOKEN
```

---

## Firestore — Colecciones

| Colección | Propósito |
|-----------|-----------|
| `users` | Perfiles, roles, suscripciones, progreso talleres |
| `posts` | Blog — subcollection: `comments` |
| `moddulo_projects` | Proyectos Moddulo con historial de chat por fase |
| `moddulo_redactor_projects` | Proyectos del Redactor |
| `moddulo_redactor_generations` | Historial de generaciones |
| `pestel_configs` | Configuraciones legacy (V1) — solo lectura |
| `pestel_feeds` | Resultados PEST-L V1 legacy (`vigente: true/false`) |
| `pestel_projects` | Proyectos V2 con tipo, nombre, horizonte, etapa |
| `pestel_variable_configs` | Config variables PEST-L por proyecto (E3) |
| `pestel_analyses` | Resultados PEST-L V2 (`PestlAnalysisV2`) |
| `pestel_data_sources` | Datos manuales cargados en E4 |
| `pestel_jobs` | Estado de jobs (`pending/running/completed/failed`) |
| `pestel_raw_articles` | Artículos crudos del scraper |
| `pestel_alerts` | Alertas por umbral de riesgo |
| `fontana_sesiones` | Sesiones de Fontana (T10) — selección de indicadores por familia, `canvasItems[]`. Subcolecciones append-only: `mensajes` (chat del agente), `adjuntos` (texto extraído de archivos del usuario — nunca el binario; purga a 90 días) |
| `notifications` | Notificaciones in-app |
| `newsletter_subscribers` | Suscriptores |
| `resources` | Recursos descargables |

**Regla**: queries con `where` + `orderBy` requieren índice compuesto en
Firestore. Si no existe, la query falla silenciosamente. Preferir ordenar
en memoria cuando el volumen es pequeño (< 100 docs por usuario).

---

## PESTEL — Arquitectura y Estado

### Flujo completo V2 (activo)

```
Wizard E1-E3: usuario crea pestel_projects + pestel_variable_configs
  ↓
E4 /datos: agrega fuentes manuales → semáforo cobertura
  → POST /api/centinela/pestel/project/[id]/data-source
  → GET  /api/centinela/pestel/project/[id]/coverage
  ↓
Botón "Ejecutar análisis IA" (habilitado solo si ningún 🔴 en semáforo)
  → POST /api/centinela/pestel/trigger { projectId }
  → Pre-crea job (status: "pending") en pestel_jobs
  → Llama scrapeAndAnalyze CF sin esperar (fire-and-forget)
  → Retorna { jobId } inmediatamente
  ↓
Frontend polling a /api/centinela/pestel/status?jobId=
  ↓
Cloud Function scrapeAndAnalyze (V2 path):
  → Ejecuta 4 scrapers en paralelo (Promise.allSettled)
  → Guarda artículos crudos en pestel_raw_articles
  → Llama generateAnalysisV2:
      → 5 llamadas paralelas a Claude (una por dimensión P/E/S/T/L)
      → 1 llamada adicional para cadenas de impacto
      → Detección de sesgos determinística (sin Claude)
      → Calcula globalConfidence ponderado
      → Guarda pestel_analyses (PestlAnalysisV2)
  → Actualiza job (status: "completed", analysisId)
  ↓
Frontend detecta "completed" → carga análisis → muestra E5
```

### Páginas V2

```
/centinela/pestel                           Hub (pestel_projects)
/centinela/pestel/nuevo                     Wizard E1-E3
/centinela/pestel/[projectId]/datos         E4 — semáforo + carga manual
/centinela/pestel/[projectId]/analisis      E5 — resultados IA (PESTLPanelV2)
```

### Estado de fases

| Etapa | Descripción | Estado |
|-------|-------------|--------|
| E1-E3 | Wizard: tipo, territorio, variables PEST-L | ✅ Completado |
| E4    | Datos: semáforo cobertura + carga manual | ✅ Completado |
| E5    | Análisis IA: 5 dims paralelas + sesgos + cadenas | ✅ Completado |
| E6    | Interpretación: matriz drag-drop (puntero + teclado), panel de sesgos, voces del territorio, comparación con análisis previo; `/approve` responde 422 mientras haya sesgos sin revisar (human-in-loop real) | ✅ Completado (verificado 26-09-21) |
| E7    | Informes: 4 formatos con streaming (ejecutivo, técnico, FODA-lista, escenarios) + scorecard ponderado + export PDF/DOCX. Falta el 5º formato de la spec 07 (mapa de insights por tipo de proyecto) | 🟡 Parcial — 4 de 5 formatos (verificado 26-09-21) |
| E8    | Monitoreo continuo + alertas. Hecho: dashboard por dimensión, histórico, cron `scheduledMonitor` cada 6 h para proyectos con `autoMonitorEnabled`, versionado de análisis, UI de alertas/banner de crisis, **y ahora la generación real de alertas** — `calcularVectorRiesgoV2` (determinista, sin llamadas a Claude adicionales) se ejecuta al final de `generateAnalysisV2` (V2, el único camino que corre hoy) y escribe en `pestel_alerts` cuando el score supera `alertas.vectorRiesgoUmbral` del proyecto; `isCrisis` con un criterio sustituto (ver detalle abajo, "PESTEL — Etapa 8: generación de alertas"). **Ciclo básico cerrado, sin correo** (`notificarEmail` sigue sin leerse — Opción B, pendiente aparte); umbral sigue fijo en 70 por defecto sin UI para cambiarlo por proyecto; frecuencia sigue fija en 6 h (no la de la Etapa 2); `feedSync.ts` (V1, trigger de `pestel_feeds`) ya no lanza error — no-op explícito documentado, V1 no tiene una fórmula equivalente (fuera de alcance, ver detalle) | ✅ Ciclo básico cerrado (26-09-22) — sin correo (Opción B aparte), sin umbral/frecuencia configurables por UI |
| —     | Integración con Fontana (Económico/Social/Ecológico), ambas vías (Express + Controlada) | ✅ Completado 26-09-13 |
| —     | Integración con Moddulo F2 (exploración) — `generate-m1-express` (MapaPESTEL express), `import-pestel` (409 + `confirmReplace`), `find-linked-pestel`, `unlink-pestel`; consumidas por `exploracion/page.tsx` | ✅ Completado (verificado 26-09-21) |

### Especificaciones funcionales

Las decisiones de UX y metodología de PESTEL están en `_docs/specs/pestel/`.
**Leer la spec del módulo antes de desarrollar cualquier componente de PESTEL.**

| Archivo | Módulo |
|---------|--------|
| `_docs/specs/pestel/00_contexto_metodologico.md` | Por qué existe PESTEL, lógica PEST-L |
| `_docs/specs/pestel/01_onboarding.md` | Configuración del proyecto (tipo, equipo, horizonte) |
| `_docs/specs/pestel/02_territorio.md` | Definición geográfica, institucional, electoral |
| `_docs/specs/pestel/03_variables.md` | Variables PEST-L por tipo de proyecto, pesos, indicadores |
| `_docs/specs/pestel/04_datos.md` | Recolección modo mixto, semáforo de cobertura |
| `_docs/specs/pestel/05_procesamiento_ia.md` | Capas de análisis, prompts base, detección de sesgos |
| `_docs/specs/pestel/06_interpretacion.md` | Matriz impacto/probabilidad, human-in-the-loop |
| `_docs/specs/pestel/07_informes.md` | Formatos de salida, scorecard, escenarios |
| `_docs/specs/pestel/08_monitoreo.md` | Dashboard, alertas, modo crisis |
| `_docs/specs/pestel/data_model.md` | Entidades TypeScript compartidas |

### Decisiones metodológicas no negociables

Estas decisiones complementan las reglas técnicas ya documentadas arriba.
No propongas alternativas sin consultar primero.

1. **Human-in-the-loop obligatorio.** Ningún output de IA en PESTEL es
   definitivo hasta validación explícita del usuario. La IA clasifica y
   propone; el analista decide. Aplica especialmente a la Etapa 6
   (interpretación) y a cualquier reclasificación de factores PEST-L.

2. **Variables por tipo de proyecto.** Cada tipo de proyecto (electoral,
   gubernamental, legislativo, ciudadano) activa un conjunto distinto de
   variables PEST-L por defecto. Estos conjuntos están definidos en
   `_docs/specs/pestel/03_variables.md` — no inventarlos en código.

3. **Detección de sesgos en Etapa 5.** El procesamiento IA debe detectar
   y reportar: sesgo urbano, sesgo etario digital, sobrerepresentación de
   fuentes digitales sin validación de campo, y contradicciones entre datos
   oficiales y percepción ciudadana. No es un feature opcional.

4. **Modo mixto de datos por defecto.** PESTEL combina siempre fuentes
   automáticas (APIs, scraping) con carga manual del equipo. No existe un
   modo "solo automático".

5. **Semáforo de cobertura visible.** El indicador verde/amarillo/rojo por
   dimensión PEST-L debe mostrarse desde la Etapa 4 y mantenerse visible
   en las Etapas 5 y 6. Un análisis no avanza si alguna dimensión está en rojo.

### Principios de diseño de PESTEL

Estos principios rigen las decisiones de UX y arquitectura del sistema. No
son negociables y aplican a todas las etapas, incluyendo las futuras E6-E8.

1. **Transparencia metodológica.** Toda salida de IA debe incluir su nivel
   de confianza y las fuentes que la respaldan. El usuario siempre sabe qué
   datos usó el sistema y qué tan confiables son. Las narrativas deben citar
   sus fuentes con el formato `(Fuente: nombre, fecha)`.

2. **Trazabilidad.** Cada análisis debe poder reconstruirse: qué artículos
   se usaron, qué variables estaban activas, qué fecha. Los documentos
   `pestel_analyses` conservan el `jobId` de origen que apunta al
   documento `pestel_raw_articles` con los datos crudos.

3. **Colaborador estratégico, no oráculo.** PESTEL propone; el analista
   decide. Los outputs de IA son insumos para el juicio profesional, no
   recomendaciones definitivas. Ningún output es definitivo sin validación
   explícita del usuario (E6 human-in-the-loop).

### PESTEL — Etapa 8: generación de alertas (26-09-22)

**Diagnóstico previo a este cierre (investigación separada, mismo día):**
el hueco no era solo "nada escribe en `pestel_alerts`" — no existía ningún
cálculo de riesgo conectado al camino que realmente corre hoy (V2).
`calculateRiskVector` (`functions/src/pestel/risk/vectorCalculator.ts`)
seguía vivo pero cableado exclusivamente al camino V1 legacy
(`generateFeedFromRawData`), que el cron de monitoreo automático nunca
ejecuta — su input (`ClassifiedArticle[]` con sentimiento por artículo) no
existe en V2, que enruta por palabra clave sin clasificar artículos. El
texto de la UI ("las alertas se generan cuando el riesgo supera el
umbral") describía un campo que `PestlAnalysisV2` ni siquiera almacenaba.
`feedSync.ts` (el único artefacto relacionado con "alertas" en el código)
era un trigger de Firestore sobre `pestel_feeds` (colección V1, nunca se
crea desde el monitoreo automático V2) que lanzaba `throw new
Error("Not implemented — ver Fase 4")` — huérfano desde el rediseño V2
(26-03-27), el comentario "Fase 4" se refería a la integración con
Moddulo (ya resuelta por otro mecanismo), no a alertas.

**Fórmula (`calcularVectorRiesgoV2`, `functions/src/pestel/risk/
vectorRiesgoV2.ts`), determinista, sin llamadas a Claude adicionales** —
opera sobre `DimensionAnalysis[]` (`classification`/`intensity`/`trend`/
`confidence`), que las 6 llamadas de la Etapa 5 YA producen:

```
base(AMENAZA) = 80, base(NEUTRAL) = 40, base(OPORTUNIDAD) = 15
modificador(ALTA) = 1.0, modificador(MEDIA) = 0.6, modificador(BAJA) = 0.3

riesgo_dim = 50 + (base(classification) − 50) × modificador(intensity)
```
Si la dimensión es AMENAZA y `trend` es ASCENDENTE, +10 (empeorando); si
es DESCENDENTE, −10 (mejorando) — sin ajuste de tendencia para
OPORTUNIDAD/NEUTRAL. Agregado del proyecto, promedio ponderado por
`confidence` de cada dimensión (mismo principio que `globalConfidence`):
```
vectorRiesgo = clamp( Σ(riesgo_dim × confidence_dim) / Σ(confidence_dim) )
```
Si `confidence` de todas las dimensiones es 0 (análisis degenerado), cae
al neutro 50 y nunca dispara alerta — caso límite verificado.

**`isCrisis` — criterio sustituto, NO el original de la spec 08.** La
spec 08 pide un spike de menciones > 300% sobre la media de 7 días —
requiere tracking de volumen diario que el pipeline no guarda hoy y que
no se construyó en esta ronda (infraestructura nueva, fuera de alcance).
Se activa en su lugar un criterio sustituto, deliberadamente más agresivo
que el umbral normal: `isCrisis = vectorRiesgo ≥ umbral + 15` **y** al
menos 2 dimensiones simultáneas en AMENAZA+ALTA. **Esto NO resuelve la
spec 08 original — la sustituye temporalmente** y queda anotado como
pendiente de revisión para cuando se retome la versión fortalecida de
PESTEL (tracking de volumen de menciones en el tiempo).

**Backtesting (26-09-22, solo lectura, 141 análisis reales de
`pestel_analyses` en Firestore, antes de conectar la fórmula al flujo en
vivo):** la fórmula no mostró falsos positivos/negativos evidentes contra
los datos existentes (casos degenerados caen correctamente a 50 sin
alertar; el caso más bajo de la muestra, con una dimensión OPORTUNIDAD y
el resto mixto, correctamente no disparó). **Limitación de la muestra,
documentada explícitamente porque condiciona cómo leer el comportamiento
en producción:** 128 de los 141 análisis (91%) vienen de un único
proyecto de prueba interno con clasificación mayoritariamente AMENAZA —
no es una muestra suficiente para calibrar los parámetros con confianza
total. Se decidió (aprobado por Raúl) dejar la fórmula tal como fue
diseñada, sin ajustar ningún número, y observar el comportamiento real en
producción antes de calibrar. **Si en el futuro las alertas parecen
dispararse con más frecuencia de la esperada en producción real, el
primer lugar a revisar es la tendencia de clasificación del análisis por
dimensión (E5, prompts de `analyzeDimension`), no necesariamente la
fórmula de `vectorRiesgo` en sí — son responsabilidades distintas del
sistema.**

**Punto de inserción:** dentro de `generateAnalysisV2`
(`functions/src/pestel/generateFeed.ts`), entre el paso 9 (guardar
`pestel_analyses`) y el paso 10 (actualizar `currentStage`) — reusa
`dimResults`, ya calculado por las 6 llamadas a Claude de la Etapa 5 (cero
llamadas nuevas a la IA). El umbral del proyecto (`alertas.
vectorRiesgoUmbral`) se reenvía desde `scrapeAndAnalyze.ts`, que ya tenía
`projectData.alertas` en scope al leer el proyecto — sin lectura nueva de
Firestore. Mismo punto de disparo para análisis manual (`POST
/api/centinela/pestel/trigger`) y automático (`scheduledMonitor`, cron de
6 h): ambos llaman a la misma Cloud Function `scrapeAndAnalyze` con
`{projectId, userId}`. El monitoreo automático sigue desactivado por
defecto (`autoMonitorEnabled: false` al crear el proyecto) — este cambio
no lo activa ni lo afecta, solo cambia qué pasa al terminar un análisis.
Al escribir la alerta (`pestel_alerts`, tipo nuevo `"vector_riesgo_alto"`,
`types/pestel.types.ts`), la descripción cita el score, el umbral y las
2 dimensiones que más pesaron (`dimensionesDominantes`) — principio de
transparencia metodológica ya no-negociable de PESTEL.

**`feedSync.ts` corregido, no eliminado.** El camino V1
(`pestel_configs`/`POST /api/centinela/pestel/config`) sigue siendo
técnicamente alcanzable en código aunque documentado como legacy/solo-
lectura, así que el trigger se dejó como no-op explícito (`logger.info`)
en vez de borrarlo — documenta en su cabecera por qué V1 no tiene una
fórmula de riesgo equivalente (`PESTLAnalysis`, el shape que guarda
`pestel_feeds`, no trae `classification`/`intensity` por dimensión; la
fórmula de V2 no es reusable sin rediseñarla) y por qué el `throw`
original generaba error en cada doc de `pestel_feeds` sin que nadie lo
consumiera.

**Pruebas de regresión (`functions/src/pestel/risk/
vectorRiesgoV2.test.ts`, 20 casos).** `functions/` no tenía runner de
pruebas (sin jest/vitest/mocha; `firebase-functions-test` presente como
devDependency pero sin ningún archivo de prueba en todo el paquete) — se
agregó `tsx` (único devDependency nuevo) + `node:test`/`node:assert`
(stdlib de Node 22, sin framework de pruebas nuevo), script `npm run test`
en `functions/package.json`. Cobertura: caso degenerado (vacío,
confidence:0 en todas), riesgo por combinación clasificación×intensidad,
ajuste de tendencia (solo AMENAZA, ambas direcciones, confirmando que NO
aplica a NEUTRAL/OPORTUNIDAD), agregado ponderado por confidence (peso
igual, confidence:0 no arrastra, mayor confidence pesa más),
`dimensionesDominantes` (máximo 2, orden correcto), `isCrisis` (dispara
con el gate compuesto, NO dispara con 1 sola dimensión AMENAZA+ALTA pese
a superar el margen, NO dispara si el vectorRiesgo no alcanza el margen
aunque haya 2 dimensiones, el umbral por proyecto desplaza el punto de
disparo) y el adaptador `dimensionAnalysisAVectorRiesgoInput` (mapeo +
round-trip). `functions/tsconfig.build.json` (nuevo, extiende
`tsconfig.json` y excluye `src/**/*.test.ts`) es el que usa `npm run
build`/`build:watch` — el `tsconfig.json` base sigue incluyendo los
`.test.ts` porque ESLint (`parserOptions.project`) necesita verlos;
separarlos evita que el archivo de pruebas se compile a `lib/` (y se
despliegue) sin romper el linter. `vitest.config.ts` (raíz) excluye
`functions/**` para que el runner de Next.js no intente interpretar
archivos que usan la API de `node:test`.

**Verificación:** `tsc --noEmit` (raíz) limpio; `next build` limpio;
`cd functions && npm run build` limpio; `cd functions && npm run lint`
limpio en todo lo tocado por esta ronda (2 hallazgos pre-existentes en
`claudePESTL.ts`, sin relación con este cambio, no tocados — líneas largas
ya presentes antes de esta ronda); 333 pruebas de la raíz sin regresión;
20/20 pruebas nuevas de `vectorRiesgoV2.test.ts`. **Pendiente de Raúl:**
desplegar (`firebase deploy --only functions`, acción que este flujo no
ejecuta por sí solo) y disparar un análisis real (manual o esperar el
cron) sobre un proyecto con `alertas.vectorRiesgoUmbral` conocido, para
confirmar en producción que `pestel_alerts` se escribe y que el feed/
banner de crisis (`AlertsFeed`, `CrisisBanner`) dejan de estar vacíos.

**Explícitamente fuera de alcance de este cierre** (ya evaluado en el
diagnóstico previo, no bloquean el ciclo básico): umbral/frecuencia
configurables por UI (`vectorRiesgoUmbral` ya es un campo por proyecto en
Firestore, falta la UI para editarlo; la frecuencia de 6 h es una
constante de código, cambiarla a "por proyecto" requiere arquitectura de
scheduling distinta); correo (`AlertasConfig.notificarEmail` sigue sin
leerse — Opción B, extensión de bajo-medio costo sobre el mismo punto de
escritura, con `lib/email.ts`/Resend ya en uso en otros flujos); reglas de
alerta configurables por el usuario (`AlertRule`, tipo definido en
`types/pestel.types.ts` pero nunca construido/leído — sin empezar).

---

## Fontana (T10) — Capa conversacional

Detalle completo: `docs/ecosistema/T10-fontana/` y `_docs/fontana-t10-contexto-desarrollo.md`.

**UI (`app/centinela/fontana/`)** — `FontanaMain` (header) → `FontanaWorkspace`
con 2 pestañas:
- **Indicadores** (`FontanaIndicadoresAccordion`): acordeón horizontal de las 5
  familias, una abierta a la vez. Carga perezosa por familia con caché en
  estado local; mutar la selección (añadir/quitar) invalida esa caché.
  F1/F2/F3/F5 → `FontanaComparativeTable`; F4 → `FontanaF4Panel` (shape propio).
- **Fontana** (`FontanaCanvasTab`): lienzo de `FontanaSesion.canvasItems[]`
  (`FontanaCanvasItemCard` — resumen / grafica / tabla / desglose).

**Agente "Fontana"** (`FontanaAgentBubble` + `app/components/shared/chat/*`):
burbuja persistente + panel en `ResponsivePanel` (sidebar derecho desktop, con
auto-open; bottom sheet mobile, sin auto-open). SSE en `POST /api/fontana/chat`
con **tool use real** del SDK Anthropic (`lib/fontana/agente/`):
- `consultar_indicador` — valor de un indicador en el territorio de la sesión;
  `compararNiveles: true` (default recomendado) devuelve `nivelesComparados`.
  Narrativos F5 (F5-1/3/4/5/9/10) van a `GET .../sesion/[id]/narrativa`.
- `consultar_indicador_territorio_externo` — indicador en un estado/municipio
  DISTINTO al del proyecto, solo cuando el usuario lo nombra explícitamente.
  `GET .../consulta-territorio` — resuelve el nombre vía `claveCanonicaMunicipio`
  (helper compartido `lib/fontana/geo/resolverTerritorioNombre.ts`);
  `ambiguo` si el municipio se repite entre estados (el agente pregunta). Fase 1:
  solo lectura, sin Canvas.
- `consultar_serie_temporal` — serie histórica (varios años) de un indicador
  con historia. **Sin `enum` en el schema**: valida contra el config
  `lib/fontana/series/seriesDisponibles.ts` (`SERIES_DISPONIBLES` / `tieneSerie`).
  1ª ola (2026-09-01): **F2-6, F2-12, F3-16, F3-17, F2-1, F2-2, F2-14** (corte
  nacional/estatal) + **F2-17** (piloto). 2ª ola (2026-09-03): series
  **MUNICIPALES** — **F2-3** (CONEVAL Rezago Social, est+mun) y **F2-5,
  F2-20, F2-21, F2-22** (PNUD IDH/sub-índices, municipal). Dispatcher
  `lib/fontana/ingesta/serieTemporal.ts` → resolver por familia de fuente
  (`resolverSerieEnigh` / `resolverSerieHuelgas` / `resolverSerieIep` /
  `resolverSerieInegiPm` / `resolverSerieConeval` / `resolverSeriePnud` / el
  pilot `resolverSerieCompetitividadEstatal`), todos junto a la función de
  celda existente, sin tocarla. `GET .../serie-temporal`.
  Sin `territorioNombre` = territorio del proyecto; con `territorioNombre` =
  un estado o municipio nombrado (un municipio se mantiene municipal solo si
  el indicador publica serie municipal). Proyecto plural multi-estado
  (`estadosDelTerritorio`) → `multiEstado`; proyecto plural multi-municipio
  en series municipales (`municipiosDelTerritorio`, `lib/fontana/geo/`) →
  `multiMunicipio` — en ambos el agente pregunta a cuál se refiere, nunca
  asume. La respuesta lleva `nivel` (nacional / estatal / municipal) — si es
  estatal, el agente aclara que aplica a todo el estado, no es promedio de
  los municipios/distritos. `tieneSerie: boolean`
  expuesto en `consultar_indicador`, `listar_indicadores_familia`,
  `listar_indicadores_activos_todas_familias`, `GET /familia/[id]`,
  `GET /contexto` → el system prompt no lleva lista de excepciones. No genera
  Canvas — para eso `generar_visualizacion` tipo `serie_temporal`. F3-16
  (huelgas): serie DENSA min-año..año-en-curso-1 (año en curso excluido por
  parcial; año sin registros = 0 real).
- `consultar_detalle_indicador` — lista de entidades detrás de un
  conteo/clasificación; solo F3-8 (municipios ZAP), F5-6 (giros DENUE), F5-8
  (localidades GACP), vía `GET .../familia/[familiaId]/detalle`.
- `listar_indicadores_familia` — indicadores activos + `catalogoCompleto` de
  UNA familia; el agente NUNCA enumera de memoria.
- `listar_indicadores_activos_todas_familias` — las 5 familias en 1 llamada
  (evita encadenar 5).
- `generar_visualizacion` — crea un `canvasItem` (`resumen` / `grafica` /
  `tabla` / `desglose` / `distribucion` / `serie_temporal` /
  `comparacion_territorios`). Cuatro ejes: `grafica` = mismo indicador entre
  niveles geográficos DEL PROYECTO; `distribucion` (F1-2, F1-11, F1-12,
  F2-12) = categorías dentro de un nivel; `serie_temporal` = evolución en
  el tiempo (ver `SERIES_DISPONIBLES`); `comparacion_territorios`
  (26-09-06) = mismo indicador entre 2-8 territorios ARBITRARIOS que el
  usuario nombró explícitamente (ver detalle abajo). Rechaza F4. Todos
  llevan `fuenteEtiqueta`. El agente NUNCA anuncia el resultado en el mismo
  turno.
- `navegar_pestana` — cambia de pestaña / abre familia.

Las líneas de trazabilidad de herramientas (`toolCalls`) se persisten con el
mensaje pero **no se renderizan al usuario** — el chat muestra un indicador
genérico "Consultando datos…". Los IDs de indicador (`F<n>-<n>`) NUNCA
aparecen en la prosa dirigida al usuario. Ver `app/components/shared/chat/`.

**Metadata de las 5 familias** (nombre, descripción, color): fuente única en
`lib/fontana/familias.ts` (`FAMILIAS_FONTANA` / `FAMILIA_META`) — la consumen el
acordeón, las cards del Canvas, `tools.ts` y el system prompt del agente. Nunca
re-hardcodear en otro sitio. La LISTA de indicadores por familia sale del
registry vía `/api/fontana/familia/[familiaId]`, nunca hardcodeada.

**Regla no negociable**: el agente SOLO responde con datos devueltos por una
herramienta — nunca con conocimiento propio. Los datos salen de los endpoints
ya existentes (`familia/[familiaId]`, `narrativa`), nunca de `resolverIndicadorFontana`
importado directo ni de una fuente paralela.

**Persistencia**: `FontanaSesion.canvasItems[]` (campo, aditivo) + subcolección
append-only `fontana_sesiones/{sesionId}/mensajes` (`GET .../mensajes` para
rehidratar). Sin store cliente nuevo — `useState` + endpoints.

**Adjuntar archivo (2026-09-01)**: el composer sube archivos a
`POST /api/fontana/sesion/[id]/adjunto` (multipart). Se extrae SOLO el texto
(extractor compartido `lib/moddulo/attachments.ts` — PDF/DOCX/XLSX/TXT/CSV,
XLSX vía `exceljs`), **nunca el binario** (ni en Storage ni temporalmente).
Validación de tipo real en servidor (magic bytes), límite 10 MB, texto
truncado a 50 000 chars. Se guarda en la subcolección append-only
`fontana_sesiones/{id}/adjuntos` (`{ id, nombreArchivo, textoExtraido,
tipoMime, cargadoEn: Timestamp }`). El chat antepone ese texto al turno como
**contexto** (`lib/fontana/agente/adjuntosContexto.ts`, presupuesto 60 000
chars), nunca como fuente de datos. Borrado en cascada con la sesión
(`recursiveDelete`) + purga automática a los 90 días
(`functions/src/fontana/purgeAdjuntos.ts`, `onSchedule` cada 24 h — requiere
`firebase deploy --only functions`).

**Dictado de voz (2026-09-01)**: botón de micrófono en el composer sobre la
Web Speech API nativa (`useSpeechDictation`, `es-MX`). Texto editable, sin
auto-envío. Estado explícito de navegador no soportado. `next.config.ts`
relaja `Permissions-Policy: microphone=(self)` **solo** para
`/centinela/fontana` (el resto del sitio mantiene `microphone=()`).

**Patrón reutilizable**: `docs/ecosistema/patrones-compartidos/agente-conversacional.md`
(referencia para Sefix-AI T06 y apps futuras).

---

## Moddulo — Arquitectura

9 fases secuenciales por proyecto:

```
proposito → exploracion → investigacion → diagnostico →
estrategia → tactica → gerencia → seguimiento → evaluacion
```

- Chat con Claude vía **streaming SSE** en `/api/moddulo/chat/[phaseId]`
  (sin tools; solo proposito/exploracion/investigacion montan el chat).
  Lo que el modelo extrae (`xpcto.`/`pestl.`/`semaforo.`/`hipotesis.`) pasa por
  `lib/moddulo/extractedDataGrounding.ts` ANTES de emitirse al cliente y de
  escribirse a Firestore: descarta cifras/fechas que el usuario no dio en
  ninguna forma equivalente (tolera formato, millones, fechas relativas, sumas
  derivadas). Determinista a propósito. No cubre parafraseos sin cifras ni la
  omisión de un dato que el usuario sí dio. El prompt base
  (`lib/ai/phases/prompts.ts`, "LÍMITES DE TU INFORMACIÓN") prohíbe inventar
  causas técnicas y presentar conocimiento propio como dato verificado.
- En la fase `exploracion` (F2), Moddulo debe consumir PESTEL para
  generar el análisis PEST-L del territorio del proyecto.

---

## Suscripciones

| Rol | Plan | Precio MXN | Acceso relevante |
|-----|------|-----------|------------------|
| `user` | freemium | $0 | Blog, Redactor limitado |
| `basic` | basic | $2,899/mes | + Cursos, Sefix |
| `premium` | premium | $5,899/mes | + Centinela, Moddulo |
| `professional` | professional | $9,899/mes | + API, white label |

Ver `types/subscription.types.ts` → `PLAN_FEATURES` para detalles completos.

---

## Seguridad — Reglas de Oro

1. Nunca hardcodear secrets. Usar `.env` (Next.js) o Firebase Secret Manager
   (Cloud Functions).
2. Siempre verificar sesión en API routes con `getSessionFromRequest()`.
3. Todo identificador que llegue del cliente (`storagePath`, `projectId`,
   `resultadoId`, ids de sesión/análisis, urls) y se use con el Admin SDK
   (Firestore o Storage) debe validarse contra `session.uid` **antes de
   usarse**, tanto para LEER como para ESCRIBIR. El Admin SDK ignora
   `firestore.rules` y `storage.rules`: el endpoint es la única barrera.
   No basta con que el usuario esté autenticado. Guards existentes
   (`lib/moddulo/storagePathAuth.ts`, `lib/moddulo/project.ts`):
   - `esStoragePathDeUsuario(path, uid, projectId)` — un solo `storagePath`.
   - `sonAdjuntosDeUsuario(adjuntos, uid, projectId)` — arreglos de adjuntos
     (fail-closed: exige `storagePath` en cada elemento).
   - `getProject(id, session.uid)` — proyecto Moddulo (null si `uid` no es
     colaborador); obligatorio antes de leer o escribir
     `moddulo_projects/{id}` con un id del body.
   - `esUrlDeDescargaDelBucket(url, bucket)` — allow-list para cualquier
     `fetch` servidor de una url recibida o persistida desde el cliente
     (anti-SSRF; solo urls de descarga de nuestro bucket).
   Incidente real (26-09-15/18): IDOR de `storagePath` en F3
   (`canal1/entregar`, `canal3/vincular`, `confirm`), en los adjuntos del
   chat de Moddulo y en `POST /centinela/pestel/project` (escritura
   cross-tenant vía `modduloProjectId`), más un SSRF encadenado por la
   `url` persistida en `archivosAdjuntos`.
   **Mismo patrón, tercer punto — `createProject` (26-09-23):** `POST /api/moddulo/projects`
   tomaba `pestelProjectId` del body y `createProject` lo usaba con el Admin SDK sin leerlo:
   persistía `linkedSource {kind:"T22", sourceId}` y hacía
   `pestel_projects/{id}.update({modduloProjectId})` sobre un proyecto PESTEL ajeno (con
   efecto de 2º orden: `deleteProject` borra ese back-link con el `sourceId` guardado).
   Corregido: `createProject` lee `pestel_projects/{id}` ANTES de armar o escribir nada y
   exige `userId === uid`; si no existe o es ajeno lanza `PestelProjectNoPropioError` y la
   ruta responde **404** (el mismo error para "no existe" y "ajeno": no revela qué ids
   existen). Regresión permanente: `lib/moddulo/project.createProject.test.ts` (4 casos:
   ajeno, inexistente, propio, sin id — sin el guard fallan 2 de 4) y
   `app/api/moddulo/projects/route.test.ts` (404 / 201; sin el guard falla el 404). Evidencia
   real: escaneo de SOLO lectura de Firestore (13 proyectos Moddulo, 5 PESTEL, 2 enlaces):
   **0 enlaces cross-tenant** en ambos sentidos y 0 a un PESTEL inexistente; ninguna
   escritura ni documento sintético en producción. **No tocado (nota):** `pestAnalysisId`
   solo se almacena (su lectura posterior ya pasa por rutas con ownership) y
   `deleteProject` conserva su `update` sin guard (con el guard de creación ya no se puede
   sembrar un `sourceId` ajeno; los datos existentes están limpios).
   **Política de roles pendiente (no corregida a propósito):** hoy cualquier
   colaborador de un proyecto Moddulo, incluido el rol `client`, puede
   vincularlo (`getProject` no distingue rol) — permisivo por diseño hasta
   definir el plan "colaborativo". Además `import-moddulo-attachments`
   compara `role === "owner" || "editor"`, pero `CollaboratorRole` es
   `"owner" | "co-consultant" | "analyst" | "client"`: `"editor"` no existe,
   así que en la práctica solo el `owner` pasa. Resolver ambos juntos al
   diseñar los permisos del plan colaborativo.
   **B1 — confirmación antes de `__action` (no construido, 26-09-18):** el
   chat de Moddulo lanza el análisis express cuando el modelo emite
   `__action: "start_express"` y el cliente lo ejecuta sin confirmación
   adicional (`exploracion/page.tsx`). No se agregó un guard: el forense sobre
   los 11 proyectos reales con chat (todos de UNA cuenta de pruebas interna)
   encontró 8/8 disparos con instrucción explícita ("express") y 0 con una frase
   ambigua tipo "hazlo". Revisar si algún día se observa un disparo real sin
   instrucción explícita, o cuando el volumen de usuarios reales crezca lo
   suficiente para que esa muestra deje de ser representativa.
4. Nunca `dangerouslySetInnerHTML` sin sanitizar con DOMPurify.
5. Las cookies de sesión son HTTP-only — nunca accederlas desde JS cliente.
6. Nunca ejecutar comandos que impriman valores de variables de entorno o
   credenciales en el output: `cat .env`, `grep .env`, `echo $VAR`, `printenv`,
   ni variantes. Para verificar que una variable existe, usar:
   `[ -n "$VAR" ] && echo "OK" || echo "FALTA"` — solo confirma presencia,
   nunca revela el valor.
7. **Rotación de credenciales — cómo verificar.** Una prueba de "¿funciona la
   credencial nueva?" (p. ej. `/api/test-admin`) NO confirma una rotación mientras
   la vieja siga activa: el éxito no distingue cuál de las dos se usa. Orden:
   (1) probar que la nueva es válida por sí sola, (2) ponerla en Vercel y
   redeployar, (3) revocar la vieja, (4) probar en el entorno real; si falla, la
   nueva sigue viva y basta volver a pegarla. Vercel guarda el valor literal: al
   pasar una variable de `.env` a Vercel no pegar las comillas envolventes. Una
   llave de servicio nunca va en un archivo commiteado (`app/secrets/` ya está en
   `.gitignore`, pero un `git add -f` lo salta). Incidentes reales: 26-09-22
   (llave de Firebase Admin commiteada en 2025-08-25) y 26-09-23 (Vercel con una
   llave ya revocada tras la rotación) — detalle en el Historial de Sprints.

---

## Variables de Entorno

**Next.js (`.env`):**
```
NEXT_PUBLIC_FIREBASE_API_KEY
NEXT_PUBLIC_FIREBASE_PROJECT_ID        # eskemma-3c4c3
NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET
NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN
NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID
NEXT_PUBLIC_FIREBASE_APP_ID
FIREBASE_PROJECT_ID
FIREBASE_PRIVATE_KEY
FIREBASE_CLIENT_EMAIL
ANTHROPIC_API_KEY
RESEND_API_KEY
FIREBASE_FUNCTIONS_URL                 # https://us-central1-eskemma-3c4c3.cloudfunctions.net
NEXT_PUBLIC_APP_URL
NEXT_PUBLIC_ENVIRONMENT                # development | production
INEGI_TOKEN
BANXICO_TOKEN
```

**Cloud Functions** (Firebase Secret Manager, no en `.env`):
```
ANTHROPIC_API_KEY
INEGI_TOKEN
BANXICO_TOKEN
```

---

## Comandos Frecuentes

```bash
# Después de clonar el repo (una sola vez) — instala el hook de pre-push
# (tests + frescura de CLAUDE.md + revisión de seguridad del diff, ver
# scripts/git-hooks/pre-push). Sin Husky deliberadamente — un solo
# desarrollador, un solo hook, no justifica la dependencia.
npm run install-hooks

# Desarrollo local
npm run dev

# Pruebas
npm run test

# Frescura de CLAUDE.md vs. código real
npm run check-docs-freshness

# Firestore + Storage rules
firebase deploy --only firestore:rules
firebase deploy --only storage

# Cloud Functions
cd functions && npm install
cd functions && npm run lint && npm run build   # Verificar antes de deploy
firebase deploy --only functions

# Secrets
firebase functions:secrets:set <NOMBRE>

# Logs
firebase functions:log
```

---

## Documentación Interna

| Archivo | Contenido |
|---------|-----------|
| `_docs/pestel-engineering-plan.md` | Plan de ingeniería detallado de PESTEL |
| `_docs/specs/pestel/` | Especificaciones funcionales de PESTEL (9 archivos) |

---

## Deuda Técnica Conocida

| Ítem | Detalle | Detectado |
|------|---------|-----------|
| Drift `capacidades` XPCTO (3 vs. 4 subcampos) | El FAT 2.0 (Fase 1, variable C) define 4 dimensiones: Financiero, Humano, Organizacional, Material. `types/moddulo.types.ts` (`XPCTO.capacidades`) solo tiene 3 campos: `financiero`, `humano` (comentario: "Equipo y estructura organizacional" — fusiona Humano+Organizacional), `logistico` (comentario: "Infraestructura y medios operativos" ≈ Material). No bloquea funcionalidad actual; evaluar si separar en 4 campos al tocar el wizard de F1 o el tipo `XPCTO`. | 26-07-16, auditoría snapshot XPCTO/Centinela |
| Captura de distrito electoral sin estructura en `TerritorySelector.tsx` | TerritorySelector.tsx (compartido por Moddulo y PESTEL) captura el número de distrito electoral y la descripción de su cabecera en un único campo de texto libre, sin separación estructurada entre ambos. Fontana depende de parsear ese texto (vía `extraerCiudadCabecera()`, regex sobre la frase "con cabecera en X") para resolver la alcaldía/municipio dominante en proyectos de nivel distrito_federal/distrito_local — si el texto no sigue ese formato exacto (como el proyecto de prueba de CDMX, Distrito Local 27), Fontana no puede determinar el municipio y muestra el texto de "sin municipio definido" aunque el dato geográfico real sí exista en el catálogo de Fontana (`cabeceras_loc.json`). Recomendación evaluada y descartada: un selector/catálogo de distritos por país (mala UX fuera de México, catálogos inmanejables). Recomendación pendiente de evaluar en el chat de Moddulo: separar el campo actual en dos inputs de texto libre — (a) identificador del distrito, (b) descripción/cabecera — sin necesidad de catálogo por país, solo para que Fontana pueda cruzar por estado + identificador de distrito en vez de depender del parseo de una frase completa. Proyecto de prueba `nZvpYu4nnZrsw5hoGcVP` (CDMX, Distrito Local 27) se deja sin modificar deliberadamente, como caso de verificación para cuando se implemente el fix real. **Resuelto 26-08-16/17** por el rediseño de territorio (selector estructurado + `TipoAgregacionTerritorial`) — se deja la fila como registro histórico. | 26-08-12, revisión de consistencia Fontana T10 (Incremento 4) |
| ~~Clasificación `agregacionPlural` de F3/F4/F5 pendiente de poblar~~ **RESUELTO** | Al cerrar Familias 3/4/5 (commits 26-08-22/25/27), el registry pasó de 41 a **86 entradas** con `agregacionPlural.tipo` clasificado en las 5 familias (verificado 26-08-27: `scripts/verify-fontana-agregacion-plural-cobertura.ts` → 86/86, 0 sin clasificar; `scripts/diff-fontana-registry.ts` → local == Storage, 0 diffs). `app/api/fontana/familia/[familiaId]/route.ts` ya NO responde 400 para F3/F4/F5 — soporta F1/F2/F3/F5 por el flujo geográfico común y F4 por su rama propia; el 400 solo aplica a un `familiaId` que no sea una de las 5. Se deja la fila como registro histórico. | 26-08-17, Fase 3 del rediseño de territorio |
| Duplicación del primitivo de chat (shared/chat vs. ModduloChat/AdvisorPanel) | La capa conversacional de Fontana (T10) introdujo `app/components/shared/chat/` (`useChatStream`, `ChatBubble`, `ChatPanel`, `MarkdownContent`) — nuevos, inspirados en el patrón de `app/moddulo/components/ModduloChat.tsx` pero sin modificarlo. El loop de lectura SSE y el renderer markdown quedan duplicados entre `shared/chat/` y `ModduloChat.tsx` + `app/moddulo/proyecto/[projectId]/exploracion/components/AdvisorPanel.tsx`. Esos dos NO se tocaron esta ronda; migrarlos a los primitivos compartidos queda para un chat dedicado. | 26-08-27, capa conversacional de Fontana (T10) |
| ~~Subcolección `mensajes` huérfana al borrar una sesión de Fontana~~ **RESUELTO** | El `DELETE` de `app/api/fontana/sesion/[sesionId]/route.ts` hacía solo `ref.delete()`, que en Firestore NO borra subcolecciones — cada sesión eliminada dejaba su `mensajes` huérfano. Detectado en la auditoría de adjuntos (2026-09-01). Corregido en la misma ronda al cambiar a `adminDb.recursiveDelete(ref)` (necesario de todos modos para la nueva subcolección `adjuntos`): arrastra `mensajes` y `adjuntos`. Se deja como registro. | 26-09-01, ronda de adjuntar archivo + dictado de voz |
| Rate limiting del fallback de visión (PDF sin texto nativo → Claude) | Todo PDF cuyo texto nativo sea < 120 chars dispara una llamada a `claude-sonnet-4-6` como visión, sin límite por sesión ni usuario. Aplica a `lib/moddulo/attachments.ts` (chat de Moddulo, import PESTEL, adjuntos de Fontana) y a `app/api/centinela/pestel/project/[projectId]/upload-source/route.ts`. No se implementó un límite básico esta ronda (no era trivial de añadir limpio al reusar el extractor). Vector de coste, no de seguridad. | 26-09-01, ronda de adjuntar archivo + dictado de voz |
| Purga de adjuntos de Fontana: sin `collectionGroup`, deploy manual | `functions/src/fontana/purgeAdjuntos.ts` (`onSchedule` cada 24 h, primera función programada del repo que fija `timeoutSeconds`/`memory`) **itera sesión por sesión** en vez de una query `collectionGroup("adjuntos")` — decisión explícita para no introducir el primer índice `COLLECTION_GROUP` del repo. Migrar solo si el conteo de sesiones lo hace lento. La purga no corre hasta `firebase deploy --only functions`. `next.config.ts` ahora tiene un override de `Permissions-Policy` por ruta (`/centinela/fontana`, `microphone=(self)`). | 26-09-01, ronda de adjuntar archivo + dictado de voz |
| Functions emulator + `firebase-functions` desactualizado: `admin.firestore.Timestamp` sale `undefined` | Al probar `purgeAdjuntos` en el Functions emulator (firebase-tools 15, `firebase-functions ^6.0.1`), `admin.firestore.Timestamp.fromMillis(...)` dentro del handler tira `Cannot read properties of undefined (reading 'fromMillis')` — el runtime parcheado del emulador no expone el estático `Timestamp` en el namespace `firestore`. **No es un bug del código de producción** (en GCF real funciona); es del emulador con esta versión de `firebase-functions` (el propio emulador avisa "outdated version"). Mitigación aplicada en `purgeAdjuntos.ts`: el `cutoff` se construye como `Date` (`new Date(...)`), que Firestore convierte a `Timestamp` en la query de forma transparente. Si alguien prueba otra función programada en el emulador y necesita un `Timestamp`, construirlo desde una instancia (`admin.firestore().Timestamp` no; usar `Date` o `admin.firestore.Timestamp` importado de `firebase-admin/firestore`) o actualizar `firebase-functions`. Nota adicional: el emulador de Firestore exige **Java ≥ 21** (firebase-tools 15). | 26-09-01, verificación en desarrollo de `purgeAdjuntos` |
| Sin vista previa de contenido en M2 (F3-Investigación) | M2 no tiene ningún mecanismo de vista previa del contenido de un resultado antes de que el usuario lo apruebe — aplica a Canal 2, Canal 3 y Canal 1 (Fontana) por igual, ninguno está resuelto. Hoy la aprobación se basa solo en metadatos (pregunta, origen, cobertura), sin que el usuario vea el contenido real. Pendiente de diseño, fuera del alcance de Fontana — afecta a F3 en general. Suspendido deliberadamente: se aborda en un chat dedicado a M2, no en el de Fontana/Canal 1. | 26-08-19, verificación en navegador de Fontana T10 (Escenarios b/c + Canal 1) |
| Incidente CVE_MUN INE-vs-INEGI (Fontana F1/F2) — **RESUELTO** | `resolveMunicipioCve()`/`getMunicipiosOptions()` (`lib/geo/municipios.ts`, numeración INE) divergía del CVE_MUN oficial en ~55-63% de los municipios (1,573/2,848 reverificado). Usado como join externo en `coneval.ts` (F2-1/F2-2/F2-3/F2-14), `conapoMarginacion.ts` (F2-4) y `bienestar.ts` (F2-7/F2-8) — producía el valor de OTRO municipio, sin error visible. Paso 1: mitigación de emergencia (aviso "En validación..."), verificada en navegador. Paso 2: `eceg.ts` verificado NO expuesto (32/32 estados, 0 divergencias — join internamente consistente, INE contra INE). Paso 3: auditoría de producción — 1 entrega afectada encontrada (proyecto `fvpuanYx7EYhdV3WLqBr`), confirmada como cuenta de pruebas interna, no cliente real, sin necesidad de notificación; datos marcados para reprocesar tras el fix. Paso 4: fix de fondo — los 3 adaptadores migrados a join por NOMBRE (mismo patrón ya aprobado en `icmm.ts`), incluyendo el path de agregación distrital ponderada (`resolverNumeradorDenominadorMunicipios`, vulnerable por la misma causa, no estaba en la lista original) — verificado con 18 municipios reales de 8 estados, valores correctos por municipio (no más "El Grullo" al pedir Guadalajara). Paso 5: documento central `docs/ecosistema/T10-fontana/claves-geograficas-no-confiables.md`. | 26-08-23, verificación en vivo de `gacp.ts` (Familia 5) |
| Discrepancia menor F1-1 (ECEG) en Tuxtla Gutiérrez, Chiapas | Spot-check del incidente CVE_MUN (arriba) comparó valores reales de F1-1 (Población Total) contra la cifra oficial INEGI (Censo 2020, Comunicado 37/21): Tuxtla Gutiérrez muestra 604,089 en Fontana vs. 604,147 oficial — diferencia real de 58 habitantes (0.0096%). Causa distinta al incidente de CVE_MUN: `eceg-data-pipeline.ts` (`buildMunicipiosData`) calcula el nivel municipal sumando secciones electorales reasignadas a municipio vía `SECCION.shp`, no leyendo el total censal oficial por municipio directamente — artefacto de reconciliación sección↔municipio en el borde entre municipios. Otros 4 territorios verificados en el mismo spot-check (Nacional, Chiapas estatal, Aldama, Benemérito de las Américas) coincidieron exactamente. Diferido deliberadamente — prioridad del incidente de CVE_MUN era mayor. Pendiente: muestrear más municipios para confirmar si es un caso aislado o un patrón sistemático en el borde sección/municipio. | 26-08-23, verificación Paso 2 del incidente CVE_MUN |
| ~~F2-17/F2-6/F2-15/F2-16 (indicadores estatal-only) — celda simple muestra el primer estado en silencio para proyecto plural multi-estado~~ **RESUELTO** | En un proyecto plural que abarca más de un estado, la celda de la tabla comparativa mostraba el valor del PRIMER estado seleccionado sin advertir. Causa raíz: `resolverCompetitividadEstatal` (`imco.ts`) y el patrón gemelo `enigh.ts` (`resolverNacionalYEstatal`) usan solo `territorio.estado`, que `TerritorySelector.tsx` fija al PRIMER elemento. **Diagnóstico (26-09-08/09):** el caso `nivel:"estatal"` plural ya estaba cubierto por la rama estatal-plural de `resolverAgregacionPlural` (desglose por estado). El hueco real era solo `nivel:"municipal"/"distrito_*"` plural que abarca ≥2 estados: ahí el override plural de `familia/[familiaId]/route.ts` solo toca la celda del nivel objetivo (municipal/distrital), y la celda Estatal seguía con el primer estado. **Fix (26-09-09):** helper compartido `desgloseEstatalParaEstados(id, nombresEstados)` extraído de la rama estatal-plural (refactor sin cambio de comportamiento) + bloque nuevo en la ruta que, para los 4 indicadores cuando `estadosDelTerritorio(territorio).length > 1` y `nivel !== "estatal"`, adjunta el desglose por estado + un `motivo` honesto a la celda Estatal — mismo `BloqueAgregacionPlural` + modal "Ver valores por unidad" que ya usa el caso estatal-plural, sin campo de tipo nuevo. | 26-09-01, piloto de serie temporal F2-17 |
| F2-20/F2-21 serie municipal (PNUD) no cubre Oaxaca, la celda sí — **decisión ratificada 26-09-03** | `resolverSeriePnud` lee el combinado `ID_IDH_COMBINADO` (única fuente con 2010/2015/2020), que colapsa los 570 municipios de Oaxaca en 30 regiones (capital y Tuxtepec incluidas — verificado en vivo). La CELDA de F2-20/F2-21 lee standalone 2020 (`ID_SE_2020`/`ID_SI_2020`) que SÍ traen Oaxaca. Decisión (hallazgo 3): la serie mantiene `MOTIVO_OAXACA_SERIE` — una serie de un solo punto (2020) no es una serie, y generarla confundiría a quien pidió una tendencia. La inconsistencia con la celda es aceptable y explicable (la celda nunca prometió historia). Revisar solo si aparece una fuente PNUD con historia municipal que desagregue Oaxaca. | 26-09-03, series municipales 2ª ola |
| Modal de municipios (`FontanaMunicipiosModal.tsx`, modo buscador) sin virtualizar | `ModalEstado` en modo "buscador" (>119 municipios, ej. Oaxaca 570) renderiza todas las filas sin virtualización (`filtradosIndice.map(...)` en un `<ul>` plano). El bug de solapamiento de texto se corrigió con `min-w-0`/`break-words` (26-09-03), pero 570 filas montadas siguen siendo un costo de render. Migrar a lista virtualizada solo si el modo buscador se vuelve lento en la práctica. | 26-09-03, hallazgo 4 |
| Reporte de sesión de Fontana: la sección "heredados" solo cubre F1/F2 | `derivarMinimosPorFamilia` (`lib/fontana/pipMinimos.ts`) deriva `minimos` solo con prefijo `F1-`/`F2-` (`app/api/fontana/sesion/route.ts`), así que la sección "Indicadores del Programa de Investigación (heredados)" del reporte de sesión (`lib/fontana/reporte/reporteSesionSkeleton.ts`) nunca puede contener un `canvasItem` de un indicador F3/F4/F5 — irían siempre a "Exploración adicional" aunque el PIP los pidiera. No bloquea nada hoy (F3/F4/F5 nacen `familiaVacia()`). Al cerrar el trabajo pendiente de Familia 4 (indicadores de Sefix-AI en F3) y Familia 5 (contenido curado), revisar si `derivarMinimosPorFamilia` debe extenderse más allá de F1/F2. Comentario in-situ en `reporteSesionSkeleton.ts`. | 26-09-09, implementación del reporte de sesión |
| Reporte de sesión de Fontana: sin aviso de finalización cuando se genera desde el chat y el usuario no está en la pestaña Reporte | La generación del reporte es asíncrona (job + polling). Si el usuario la dispara desde el chat del agente y luego cambia de pestaña (o cierra el panel), no hay ninguna notificación cuando el reporte termina — el polling vive en `FontanaReportePanel.tsx`, que solo corre mientras la pestaña Reporte está montada; al volver a ella el polling se reanuda y carga el reporte, pero mientras tanto el usuario no sabe que ya está listo. No se implementó un mecanismo de notificación más sofisticado (mensaje de seguimiento del agente inyectado en la subcolección `mensajes`, o un aviso en `notifications`) — diferido deliberadamente. Evaluar un aviso in-app (la colección `notifications` ya existe) o un mensaje del agente al completar el job, si el flujo por chat se vuelve de uso frecuente. | 26-09-10, arquitectura asíncrona del reporte de sesión |

---

## Historial de Sprints

| Fecha | Sprint | Resultado |
|-------|--------|-----------|
| 26-03-24 | Fase 0 Centinela | Base del hub Centinela, homepage fixes |
| 26-03-25 | PESTEL F1+F2 | Scraping + clasificación PEST-L completados |
| 26-03-26 | PESTEL F3 inicio | 1ª versión UI dashboard PESTEL |
| 26-03-27 | PESTEL F3 cont. | Hub multi-territorio + página análisis individual |
| 26-03-27 | PESTEL rediseño E1-E5 | Rediseño completo alineado con specs: wizard E1-E3, semáforo E4, análisis por dimensión E5, tipos V2, nuevas colecciones Firestore |
| 26-03-28 | PESTEL correcciones post-E5 | Persistencia análisis (latest-analysis endpoint), fix economicData INEGI/Banxico→Claude, contexto legal LGIPE/INE, citación fuentes, integración Sefix (datos electorales dim-P), semáforo amarillo texto negro, principios de diseño en CLAUDE.md |
| 26-08-27 | Fontana T10 — capa conversacional | Estructura de 2 pestañas (Indicadores / Fontana-Canvas) que reemplaza la vista única de tabla; acordeón de 5 familias con carga perezosa + caché. Agente "Fontana" con tool use real del SDK Anthropic (`consultar_indicador`, `generar_visualizacion`, `navegar_pestana`) — solo responde con datos de una llamada a herramienta. Endpoints nuevos: `POST /api/fontana/chat` (SSE), `GET .../sesion/[id]/mensajes`, `GET .../sesion/[id]/narrativa`. Persistencia: `FontanaSesion.canvasItems[]` + subcolección `fontana_sesiones/{id}/mensajes`. Primitivos compartidos nuevos: `app/components/shared/{Tabs,ResponsivePanel,chat/*}`. |
| 26-09-01 | Fontana T10 — adjuntar archivo + dictado de voz | Composer con adjuntar archivo (PDF/DOCX/XLSX/TXT/CSV; extrae SOLO texto vía `lib/moddulo/attachments.ts` + `exceljs`, nunca el binario; validación de tipo real server-side; endpoint `POST .../sesion/[id]/adjunto`; subcolección append-only `adjuntos`; contexto por turno con presupuesto de 60 000 chars) y dictado de voz (Web Speech API nativa, `useSpeechDictation`, `es-MX`, sin auto-envío, estado de navegador no soportado; `Permissions-Policy: microphone=(self)` solo en `/centinela/fontana`). Retención: `recursiveDelete` en cascada (también cierra el hallazgo de `mensajes` huérfano) + purga a 90 días (`functions/src/fontana/purgeAdjuntos.ts`, `onSchedule` cada 24 h; lógica en `purgarAdjuntosVencidos()` separada del wrapper, verificada en el emulador 26-09-01 — deploy a producción pendiente, ver `docs/ecosistema/T10-fontana/purga-adjuntos-runbook.md`). Doc de patrón reutilizable: `docs/ecosistema/patrones-compartidos/agente-conversacional.md`. `lib/moddulo/attachments.ts` pasa de 5 a 6 consumidores. |
| 26-09-01 | Fontana T10 — piloto de serie temporal F2-17 | Primera serie histórica consultable de Fontana. Tool nueva `consultar_serie_temporal` (enum `["F2-17"]`) + Canvas `serie_temporal` (`generar_visualizacion`) + ruta `GET /api/fontana/serie-temporal` + adaptador `resolverSerieCompetitividadEstatal` (`imco.ts`, lee los 10 años 2016-2025 del mismo `imco_ice/2025.json`). Helpers de geo compartidos: `resolverTerritorioNombre` extraído de `consulta-territorio` a `lib/fontana/geo/`, `estadosDelTerritorio` nuevo. Proyecto plural multi-estado → `multiEstado` (el agente pregunta a cuál estado, nunca asume). `alcance:"estatal"` propagado a tool/Canvas/render/prompt (el ICE aplica a todo el estado, no es promedio de municipios). System prompt: 3ª rama de desambiguación (temporal) + excepción F2-17 en "evolución temporal" + regla "no anunciar" blindada por tipo. Deuda pre-existente registrada (celda simple estatal-only muestra el primer estado en silencio) — no corregida esta ronda. Sin campo `serieHistorica` en los otros 85 (piloto de un caso). |
| 26-09-01 | Fontana T10 — series temporales 1ª ola (7 indicadores nac/est) | Generalización del piloto F2-17. Config `lib/fontana/series/{seriesDisponibles,tipos}.ts` (`SERIES_DISPONIBLES` / `tieneSerie` — fuente única de verdad, sin `enum` en la tool). Dispatcher `lib/fontana/ingesta/serieTemporal.ts` → 4 resolvers nuevos por familia de fuente (`resolverSerieEnigh` F2-6/F2-12, `resolverSerieHuelgas` F3-16, `resolverSerieIep` F3-17, `resolverSerieInegiPm` F2-1/2/14 — todos junto a la función de celda, sin tocarla) + el pilot IMCO enrutado por `fuenteId:"imco"`. Canvas type generalizado: `alcance:"estatal"` → `nivel: NivelTablaFontana`; `esEstadoDelProyecto` → `esTerritorioDelProyecto`; render con nota por nivel. `tieneSerie` en 5 superficies de lista → prompt genérico ("si `tieneSerie:true`, usa `consultar_serie_temporal`"), sin lista. F2-6 Gini → `formato:"indice"` (coeficiente, no conteo). F3-16 huelgas → serie densa, año en curso excluido (parcial), año sin registros = 0. Fuera de esta ola: municipales (necesitan `municipiosDelTerritorio` + `no_agregable`), F4, F2-15/16/10/8, F1-18. |
| 26-09-03 | Fontana T10 — correcciones razonamiento/streaming + series 2ª ola (5 municipales) | **(a)** Correcciones de calidad del agente registradas como estándar reutilizable en `docs/ecosistema/patrones-compartidos/agente-conversacional.md` §7: `thinking` habilitado en `chat/route.ts` (`budget_tokens:2000`, `max_tokens:6000`), supresión de texto de iteraciones intermedias del loop de tool-use vía evento SSE `text_suppress`, regla de prompt ampliada (nada de "espera/en realidad/corrijo", verificar aritmética, IDs internos invisibles cueste 1 o 5 llamadas), higiene de textos de rechazo de tool. **(b)** Series **municipales**: `resolverSerieConeval` (F2-3 Rezago Social, est+mun — lee los 5 xlsx del ZIP IRS 2000-2020; offsets 14/16 verificados estables en los 5 años; año sin encabezado verificable → `valor:null` + nota, nunca se omite) y `resolverSeriePnud` (F2-5/20/21/22 IDH+sub-índices, municipal — lee las columnas 2010/2015/2020 del combinado `ID_IDH_COMBINADO`, mapa de columnas verificado en vivo vía identidad media-geométrica + standalone SE/SI). Guard nuevo `lib/fontana/geo/municipiosDelTerritorio.ts` (espejo de `estadosDelTerritorio`) → `multiMunicipio` en route/tool/prompt (espejo de `multiEstado`). `nivelObjetivoSerie` generalizado a `"nacional"|"estatal"|"municipal"|null`. Cross-check: punto 2020 de cada serie == celda actual (F2-3 GDL −1.3417; F2-5 GDL 0.815; F2-20 GDL 0.739). Fuera de esta ola: corte municipal de F2-1/2/14, F2-8 (`aditivo`, CKAN por trimestre), F4, F2-15/16/10, F1-18, aplicar thinking+supresión a `moddulo/chat`. |
| 26-09-03 | Fontana T10 — 4 hallazgos de verificación de la 2ª ola | **1 (crítico):** `generar_visualizacion serie_temporal` generó 3 tarjetas de F2-14 estatal cuando se pidió F2-5 municipal para 3 municipios. Causa: el modelo pasó un `indicadorId` equivocado + la ruta colapsaba un `territorioNombre` de municipio a su estado en silencio (`ok:true`) + `generarSerieTemporal` no verificaba geografía. Fix: `serie-temporal/route.ts` devuelve `{ok:false, colapsoNivel:true, entregaNivel, municipioPedido, estado, motivo}` en vez de colapsar; `consultarSerieTemporal` instruye a aclararlo ANTES; `generarSerieTemporal` → `reject` + guard `pedidoMunicipio && nivel!=="municipal"`. System prompt: la regla "nunca adivines un ID" se extiende a `generar_visualizacion` (reconfirmar antes de CADA llamada, incluso cross-turno), N entidades = N llamadas con el MISMO indicador descrito así, y "consultar X no habilita a graficar Y". **2 (crítico):** sección nueva del system prompt "## Confirma que puedes hacer algo antes de ofrecerlo o ejecutarlo" (mismo peso que la regla absoluta de datos; incisos a/b/c). También en el doc de patrón §8. **3:** verificado en vivo que el PNUD colapsa los 570 municipios de Oaxaca en 30 regiones — capital y Tuxtepec incluidas — así que `MOTIVO_OAXACA` para F2-5/F2-22 es correcto, NO sobre-clasificación; la celda de F2-20/F2-21 (standalone, sí trae Oaxaca) no cambia; la serie de F2-20/F2-21 mantiene `MOTIVO_OAXACA_SERIE` (decisión: una serie de 1 punto no es serie). `MOTIVO_OAXACA` reescrito autosuficiente (el agente lo cita verbatim, sin inventar "municipios pequeños y dispersos"). **4:** modal `FontanaMunicipiosModal.tsx` (`ModalEstado` buscador) — filas con texto solapado para nombres largos (Guanajuato 49 ch, Oaxaca 44, Tlaxcala/Hidalgo/Veracruz/Guerrero/Puebla ≥32); NO por volumen ni por dato sucio (catálogo limpio, 2477 registros verificados), NO preselección por default (es "Seleccionar todos"). Fix general: `min-w-0 flex-1 break-words` en el nombre + `max-w-[45%]` en la columna de valor, en los 4 `Fila*`. Virtualización de 570 filas → deuda de rendimiento, fuera de esta ronda. |
| 26-09-03 | Fontana T10 — 1 investigación PNUD + 3 correcciones de UI | **1 (solo reporte, sin código):** escaneo de `ID_IDH_COMBINADO` (32 estados) — Oaxaca es el ÚNICO estado agregado (30 regiones, capital incluida); los otros 31 están individualizados y completos (los 7 deltas negativos son municipios creados post-marco-2020, no huecos; única omisión real: Chiapas 095, ya documentada). Sin fuente alternativa estructurada de IDH municipal tras evaluar 5 (PNUD PAD sirve el mismo archivo; edición 2014 solo PDF; CONABIO 2010 metodología vieja; CONEVAL Rezago Social mide otra cosa; Coplade sin dataset). Límite de la fuente primaria a nivel nacional — comportamiento actual (`MOTIVO_OAXACA`) correcto y definitivo. **2:** quitado el botón × del composer del chat (`ChatPanel.tsx`); el cierre queda en la × del header + Escape + backdrop mobile. **3:** `SerieTemporalGrafica` (`FontanaCanvasItemCard.tsx`) pasa de barras horizontales a **gráfica de líneas** (SVG en línea a mano, sin recharts — que solo se usa en Sefix; `viewBox 0 0 100 100` + `preserveAspectRatio="none"` + puntos posicionados en HTML; nulos parten la línea en segmentos; eje X thinned si >12 años; ranking `#N/32` por punto; etiquetas de valor thinned si >8). **Separación de `formato`**: `"indice"` (0-100, 2 dec — solo F2-17) se divide en `"coeficiente"` (0-1 y negativos, 4 dec — F2-6 Gini, F2-3 rezago, F2-5/20/21/22 IDH) y `"puntaje"` (1-5, 3 dec — F3-17 IEP). Unión ampliada en `series/tipos.ts`, `types/fontana.types.ts`, `canvasBuilder.ts`, `tools.ts`; `fmt()` con rama por formato. Regresión verificada: ningún valor crudo cambia de magnitud, solo la precisión mostrada (Gini 2024 = 0.3612 crudo; IEP 2025 = 2.54583; ICE = escala 0-100). **4:** `text-red-eske` en los textos de carga de Fontana que no lo tenían (`FontanaIndicadoresAccordion` "Cargando indicadores…", `FontanaDetalleModal` ×2, `FontanaF4PaisesModal`, `ChatPanel` "Consultando datos…"); el label "Consultando…" del CTA primario de `FontanaOnboarding` se deja sin cambio (rojear un CTA primario se lee como error). |
| 26-09-03 | Fontana T10 — F1-2 pirámide de edades real por sexo | Investigación previa: los CSV del ITER 2020 que Fontana ya tiene en disco (`info_geo_eske/iter_2020/`) traen `P_<grupo>_F`/`_M` (diccionario `fd_iter_cpv2020.pdf`, secc. "ESTRUCTURA POR EDAD Y SEXO", ind. 48-101) — sin descarga nueva. `scripts/fontana-iter-pipeline.ts` ampliado (`QUINQUENAL_GROUPS_SEXO`, 36 columnas, junto a los 18 totales) + validación cruzada H+M=total (los **32 estados** pasan exacto, incluidos los 570 municipios de Oaxaca) — bodega `iter_2020/piramide/{estatal,municipios/{NN}}.json` **re-subida**. Adaptador `iter.ts`: `distribucionSexo?: Record<grupo,{hombres,mujeres}>` en `ValorIndicadorFontana`/`CeldaTablaFontana`, poblado por `toPiramideCelda` + `resolverNacionalIter` (nacional agrega los 32). Canvas: `FontanaCanvasDistribucion` gana `piramideSexo?: {etiqueta,hombres,mujeres}[]`; `construirCanvasDistribucion` la arma para F1-2; `NOTA_F1_2` ("no separado por sexo") eliminada. Render: `PiramideSexo` en `FontanaCanvasItemCard.tsx` — barras espejo desde eje central (hombres izq. `color`, mujeres der. `color` @0.55), grupo más viejo arriba, conteos abreviados. System prompt: F1-2 pasa de "pirámide/histograma" a "pirámide de edades por sexo (dos lados)". Verificado: nacional POBTOT 126,014,024, P_85YMAS 433,968 H / 605,583 M; Guadalajara municipal 1,385,629, cruce H+M=total OK por grupo. |
| 26-09-04 | Fontana T10 — guards de calidad del agente (3 hallazgos, forense de Firestore) | **Forense (dump real, no inferencia):** (1+2) el modelo produjo un turno completo afirmando "genero la pirámide ahora / ya está en tu Canvas / aquí la lectura" para Cuernavaca **con CERO tool calls** — alucinó acción y resultado; el usuario vio un canvasItem viejo (append-only) del 09-01. Path de datos verificado perfecto (Morelos bodega con `_M/_F` en los 36 municipios). (3) los 8 municipios de Jalisco: instancias tempranas = código no desplegado (mtimes 20:13-21:09 local vs turnos); la instancia real = hueco arquitectónico (el modelo resuelve los N nombres y pasa `territorioNombre` en cada llamada → `multiMunicipio` nunca se dispara). **Fixes:** **(A)** `chat/route.ts` — al cerrar turno, si `toolCallsAcum.length===0` Y el texto final matchea `AFIRMA_RESULTADO` (regex de aserción de resultado, verificada: matchea las 2 alucinaciones, no 5 respuestas legítimas sin tool) → inyecta aviso `[verificación del sistema]` + fuerza UNA iteración de corrección (`text_suppress` borra el texto falso). System prompt: sección nueva "Nunca reportes el resultado de una acción que no ejecutaste" (mismo peso que la regla absoluta de datos). **(B)** `ToolContext.vizTerritoriosDelTurno: Set` (1 por turno); `limiteTerritoriosLote` en `generarSerieTemporal` + rama F1-2/F1-11: a la 3ª `territorioNombre` DISTINTO sin `confirmadoLote:true` → `reject` forzando UNA pregunta por lote. Campo `confirmadoLote` nuevo en el schema; flujo documentado en el prompt. **(C)** `construirCanvasDistribucion` — si `distribucionSexoCruda` llega con TODOS los valores en 0 (bodega vieja) → NO emite `piramideSexo`, cae a `categorias` + nota honesta (verificado). **Auditoría C de los otros builders:** `serie_temporal` ya guardado (render "Sin datos para graficar"); `distribucion`/`tabla` ok; **`grafica` y `resumen` SIN guard** — crean tarjeta aunque todos los niveles/filas sean "sin dato" (render honesto con motivos, pero tarjeta inútil) → hallazgo menor, pendiente de decidir si se corrige. |
| 26-09-09 | Fontana T10 — Bloque 2 ítem 1: la celda Estatal de F2-17/F2-6/F2-15/F2-16 mostraba el primer estado en silencio (proyecto plural multi-estado) | **Deuda registrada 26-09-01** (piloto de serie de F2-17). **Diagnóstico (evidencia real, sin implementar hasta aprobación):** (a) los 4 resolvers de celda siguen leyendo solo `territorio.estado` — `resolverCompetitividadEstatal` (`imco.ts`) y el gemelo `resolverNacionalYEstatal` (`enigh.ts`) — que `TerritorySelector.tsx` fija al PRIMER elemento; `CeldaFontana`/`CeldaTablaFontana` sin campo de nota/alcance. (b) `estadosDelTerritorio(t)` (`lib/fontana/geo/`, síncrono, server-only) es el mecanismo reutilizable — ya lo usan 4 rutas API; usable desde `familia/[familiaId]/route.ts`. (c) **El bug era más estrecho de lo registrado:** el caso `nivel:"estatal"` plural YA lo cubría la rama estatal-plural de `resolverAgregacionPlural` (desglose por estado + `BloqueAgregacionPlural` + modal). El hueco real: `nivel:"municipal"`/`distrito_*` plural que abarca ≥2 estados — ahí el override plural de la ruta solo toca la celda del nivel objetivo (municipal/distrital) y la Estatal seguía con `territorio.estado`. **Diseño (aprobado):** reutilizar el desglose por estado, NO introducir un campo de nota nuevo en `CeldaTablaFontana` — el desglose es el único recurso visual que la tabla ya tiene para proyecto plural, y ya es el patrón para estos 4 indicadores en el caso hermano. **Implementación:** (1) helper `desgloseEstatalParaEstados(indicadorId, nombresEstados)` extraído de la rama estatal-plural de `resolverAgregacionPlural` (`index.ts`) — refactor sin cambio de comportamiento; la rama pasa a llamarlo con `territorio.estadosSeleccionados`. (2) `familia/[familiaId]/route.ts` — `INDICADORES_ESTATAL_ALCANCE_PLURAL = Set(["F2-17","F2-6","F2-15","F2-16"])` + imports de `estadosDelTerritorio` y `desgloseEstatalParaEstados`; tras el override plural, si el indicador está en el Set, `sesion.territorio.nivel !== "estatal"` y `estadosDelTerritorio(territorio).length > 1` → blanquea la celda Estatal, le pone un `motivo` honesto ("Este indicador es estatal y tu proyecto abarca N estados (…) — no es un promedio…") o el motivo de `valorAgregado` (tasa_ponderada), y le adjunta `agregacionPlural` con el desglose por estado + `tipoCalculo`. Render: `Celda` sin `valor` → `BloqueAgregacionPlural` (`:342-344`) → "Ver valores por unidad (N)" → `FontanaMunicipiosModal` `scope:"seleccion"` (mismo camino que el caso estatal-plural ya ejercita). **Verificación (`scripts/verify-bloque2-item1.ts`, ya borrado):** `estadosDelTerritorio` → 2 estados dispara, 1 no; `desgloseEstatalParaEstados` de los 4 con territorio sintético Jalisco+Nayarit → 2 estados con valor real por celda (F2-17 ICE 51.13/39.53; F2-6 Gini 0.3612/0.3563; F2-15 3279.48/1982.75; F2-16 1881.85/1429.66), 0 no resueltas, F2-17/F2-6 `valorAgregado:null`, F2-15/F2-16 `motivo` "no implementada a nivel Estatal"; cross-check == `resolverDesgloseEstadosNacional`; **regresión — la rama estatal-plural produce EXACTAMENTE el mismo `desglosePorUnidad`/`noResueltas` que antes del refactor** (JSON idéntico), celdas a nivel `estatal`. `tsc --noEmit`, `next build` y `verify-fontana-series-disponibilidad-sync` (22) limpios. **Pendiente de Raúl (navegador):** proyecto con municipios/distritos en ≥2 estados distintos, pestaña Indicadores → Familia 2 — en F2-17/F2-6/F2-15/F2-16 la columna Estatal muestra el motivo honesto + "Ver valores por unidad (N)" (no un valor único silencioso); el modal lista cada estado con su valor; claro/oscuro. Proyecto de un solo estado (o singular) → sin cambios. |
| 26-09-08 | Fontana T10 — verificación Parte B: el dedup de Canvas anulaba la personalización de países F4 (bug) + guard nuevo | **Diagnóstico con dump real (`fontana_sesiones/7GSYpu6g9zSZTmAFbbGq/mensajes`), no supuesto:** la personalización de países funcionaba en el script (llama `resolverSerieInternacionalF4` directo) pero NO en el navegador. **Causa raíz:** `generarSerieInternacional` (`tools.ts`) — `fetchSerieInternacional` SÍ reenvía `paisAgregar`/`paisExcluir` y el resolver SÍ se ejecuta con el set personalizado, pero luego el dedup (`ctx.canvasItemsSesion.find`) tenía clave de identidad = **`ci.indicadorId` y nada más**; encontraba la tarjeta previa (set por defecto) y devolvía SUS datos con `yaExistiaEnCanvas:true` + `"Ya tenías la serie… no se duplicó."`, descartando el resultado fresco. **Evidencia:** la 1ª generación de cada indicador F4 funcionó (`{F4-3, paisesAgregar:["Perú"]}` → "Agregué al Canvas… IDH global", 6 países); toda generación POSTERIOR para un indicador con tarjeta → dedup (`{F4-5, paisesExcluir:["Argentina"]}`, `{F4-5, paisesAgregar:["Paraguay","Venezuela","Panamá"]}`, `{F4-3, paisesAgregar:["Uruguay"]}` → todas "Ya tenías… no se duplicó."). **El modelo fabricó la limitación arquitectónica** (ningún tool result la dice): "el set de 5 países es fijo e inamovible", "una vez generada una tarjeta no es posible modificar su set de países", "Perú no forma parte del set fijo… no es posible agregarlo" — contradicho en la MISMA sesión por la generación #52 donde Perú SÍ se agregó. **Acotado:** el camino de LECTURA (`consultar_serie_temporal` rama F4) nunca tuvo dedup — solo el Canvas estaba roto. **Fix 1 (`tools.ts`):** clave de dedup = `indicadorId` + **conjunto ordenado de `iso3`** — `claveSetPaises(data.paises)` (set fresco, ya resuelto) vs `claveSetPaises(ci.paises)` del item persistido (ambos tienen `iso3`, sin cambio de tipo). Dos peticiones son "la misma tarjeta" solo si el set final de países coincide exacto; el dedup real (mismo set dos veces, cualquier orden) se preserva. **Fix 2 (`chat/route.ts`, patrón de `NIEGA_SERIE_HISTORICA`):** guard `NIEGA_PERSONALIZACION_PAISES` + `AVISO_*` + flag `correccionPersonalizacionPaisesHecha` — dispara si el texto final afirma "set fijo/inamovible" / "no es posible agregar/excluir/modificar países" / "no forma parte del set fijo" **Y** `evidenciaPersonalizacionPaises` (algún `toolCallsAcum[]` de `generar_visualizacion`/`consultar_serie_temporal` con `paisesAgregar`/`paisesExcluir` no vacío en el `input` crudo). Excepción `PERSONALIZACION_RECHAZO_LEGITIMO` (referencias a "no nombraste" / "explícitamente" / "dime cuáles") para NO marcar la negativa correcta del guard `paisesNoNombradosPorUsuario`. **Verificación (`scripts/verify-f4-dedup-guard.ts`, ya borrado):** (1) clave de dedup — 5 casos: excluir Argentina / agregar Perú / agregar Uruguay sobre un indicador con tarjeta → **tarjeta NUEVA**; mismo set dos veces (incl. orden distinto) → **REUSA**. (2) guard — 8 frases: las 4 fabricadas reales del dump (#92/#14/#15/#34) → dispara; 4 de control (mensaje legítimo del dedup, respuesta normal, aclaración ANTES de generar, rechazo legítimo del guard de nombres) → NO dispara. (2b) gate — 5 casos: con `paisesAgregar`/`paisesExcluir` no vacío → true; sin params / array vacío / tool no relevante → false. `tsc --noEmit`, `next build` y `verify-fontana-series-disponibilidad-sync` (22) limpios. **Pendiente de Raúl (navegador):** reproducir los 4 casos de la sesión original — excluir Argentina de Inflación ya generada, agregar Perú a Inflación ya generada, agregar Uruguay al IDH ya generado con Perú, regenerar F4-7 → los 4 deben producir una tarjeta NUEVA con el set correcto; pedir el MISMO set dos veces → reusa; forzar la frase fabricada → el guard la corrige. |
| 26-09-08 | Fontana T10 — Familia 4: set de países de la serie personalizable (agregar/excluir por petición explícita) + nota de escala comprimida | **Contexto**: la serie internacional de F4 siempre usaba el set fijo México + Colombia/Chile/Brasil/Argentina. Decisión de producto (Raúl): el set de 5 pasa a ser el DEFAULT; el usuario puede pedir agregar (ej. "añade Perú") o excluir (ej. "sin Argentina") países explícitamente — mismo principio que `comparacion_territorios` para territorios mexicanos. Solo aplica a la serie de Canvas de F4 (el camino de celda/tabla `familia4.ts` queda fuera de alcance, mismo criterio que `comparacion_territorios` no tocó la tabla de familias). **Investigación previa (verificación en vivo 26-09-08):** cobertura de países fuera del set — HDR (F4-3), TI (F4-7) y CEPALSTAT-Latinobarómetro (F4-9/10/11) cubren cualquier país LatAm con serie completa; **Banco Mundial tiene el hueco sistémico conocido de Venezuela** (F4-1 hasta 2011, F4-4 hasta 2006, F4-5 solo 2009-2016) y CEPALSTAT-Gini es irregular (VEN ~2013, GTM 4 pts). Los 4 resolvers ya iteran sobre `isos3` y devuelven `estadoConsulta` por país → un país agregado sin datos aparece declarado, nunca una línea inventada; sin mecanismo nuevo para los huecos. **Implementación (7 puntos):** (1) `lib/fontana/geo/resolverPaisesNombres.ts` nuevo — lookup nombre→iso3 contra `PAIS_ISO3_POR_NOMBRE` (23 países, ahora exportado + `PAISES_F4_NOMBRES`), tolerante a acentos/mayúsculas vía `normalizeGeoName`, `noResueltos` para lo que no está en el catálogo. (2) `resolverSerieInternacionalF4(indicadorId, paisPrincipalIso3, refsOverride?: string[])` — `refsOverride ?? PAISES_REFERENCIA_F4`, filtrando el país principal; usado en los 2 puntos que forzaban la constante (`isos3` y la reconstrucción de `referencia`). Los 4 resolvers no cambian. (3) `serie-internacional/route.ts` lee `getAll("paisAgregar")`/`getAll("paisExcluir")` → `resolverPaisesNombres` → `refsFinal` (default filtrando excluidos + agregados, tope 8 total, mínimo 1 de referencia); respuesta gana `setPersonalizado` + `paisesNoReconocidos`. (4) `tools.ts` — schema `paisesAgregar`/`paisesExcluir` en `generar_visualizacion` + `consultar_serie_temporal` (solo F4); `fetchSerieInternacional` reenvía como params repetidos; **guard `paisesNoNombradosPorUsuario` — réplica EXACTA del reject de `generarComparacionTerritorios`**: reutiliza `territorioNombradoPorUsuario` + `territorioConfirmadoDePropuestaAnterior` (funcionan sobre cualquier nombre propio); si `paisesAgregar`/`paisesExcluir` trae un país que el usuario no nombró literalmente → reject de la llamada completa, en `generarSerieInternacional` y en la rama F4 de `consultarSerieTemporal`; narración de `setPersonalizado`/`paisesNoReconocidos` en ambas `instruccion(Chat)`. (5) `FontanaCanvasItemCard.tsx` (c-lite) — nota "«X» domina la escala vertical por su magnitud muy superior — valores exactos en la tabla" cuando el pico del país más alto supera al 2º por > 5× (compara picos por país, NO el rango global que también crece por variación natural); **no toca el dominio del eje**. (6) `systemPrompt.ts` — Regla 4 del bloque F4 reescrita ("el set de 5 es el DEFAULT; el usuario puede pedir agregar/quitar explícitamente — nunca los elijas tú") + Regla 2 + menciones `:268`/`:305`. (7) `FontanaF4Panel.tsx` — texto bajo la tabla ("puedes pedirle que agregue o quite países"); sin selector ni catálogo nuevo. **Verificación con datos reales (`scripts/verify-f4-paises-flexibles.ts` + `-escala.ts` + `-guard-paises.ts`, ya borrados):** (1) F4-3 + Perú → 6 países, Perú 34 pts 1990-2023, cross-check último punto (0.794) == celda HDR EXACTO. (2) F4-5 sin Argentina → 4 países, sin ARG, `escalaComprimida` pasa de true (ratio pico 14.9, dominante ARG) a **false** (ratio 1.3). (3) F4-1 + Venezuela → VEN declarada con serie real 1990-2011 (22 pts, último 21282.64 == celda BM), nunca inventada. (4) `resolverPaisesNombres(["Perú","peru","ARGENTINA","Narnia","Estados Unidos"])` → 4 resueltos, "Narnia" en `noResueltos`. (5) guard — 7 casos: "añade Perú" sin decirlo → reject; diciéndolo → pasa; "sin Argentina" → pasa; modelo cuela 2 no dichos → reject; usuario confirma propuesta del asistente → pasa; mezcla uno dicho/uno no → reject. (regresión) sin `refsOverride` → `[MEX,COL,CHL,BRA,ARG]` idéntico en F4-1/3/5. `escalaComprimida` NO se dispara en F4-1 (ratio 1.2) ni F4-3 (1.0). `tsc --noEmit`, `next build` y `verify-fontana-series-disponibilidad-sync` (22) limpios. **Pendiente de Raúl (navegador):** "añade Perú a la serie del IDH" → 6 líneas + tabla con Perú; "quítame Argentina de la inflación" → 4 líneas, escala menos comprimida, la nota (c-lite) desaparece; pedir un país sin nombrarlo → el agente pregunta, no lo agrega; F4-5 con el set completo → la nota "Argentina domina la escala" visible. |
| 26-09-08 | Fontana T10 — verificación Fase 3: etiquetas de valor final se sobreponían en la serie internacional (bug) | Verificación en navegador de F4-1/F4-5 (capturas reales): cuando varios países terminan con valores Y cercanos (F4-1: PIB PPA de MX/BRA/COL muy juntos; F4-5: 3%/1%/0.4% aplastados por Argentina a 220%), las etiquetas de valor al final de cada línea se traslapaban e ilegibles, en pantalla y en la descarga. **Causa:** `SerieInternacionalGrafica` (`FontanaCanvasItemCard.tsx`) posicionaba cada etiqueta en `top: yAt(v)%` sin ninguna lógica de anti-colisión. **Fix (descolisión vertical 1-D):** pre-cómputo `etiquetasFinales` (iso3, color, texto, x, `yReal`); helper que ordena por `yReal`, empuja hacia abajo lo que quede a menos de `gap` (`min(9, 92/(n-1))` % ≈ 11-12 px sobre 128 px para texto de 9 px) y corrige hacia arriba si topa el borde (`[4, 96]`); el punto queda en `yReal`, la etiqueta en el `yAjustado`, y una **línea guía punteada** del color del país las une cuando `|Δ| > 1.5`. Descolisión global (las series F4 casi siempre comparten el último año → todas las etiquetas en el mismo X). Sin tocar `xAt`/`yAt`/dominio/`aniosTick`/tabla/leyenda ni el layout del contenedor. **`SerieTemporalGrafica` (geográfica) NO se tocó** — una sola línea, etiquetas distribuidas a lo largo del eje X (no apiladas en un X); confirmado que el problema no aplica. **Verificación (`scripts/verify-f4-etiquetas.ts`, ya borrado):** reproducción del helper con los 2 casos reales — F4-1: COL/BRA colisionaban (yReal 93.1 y 88.6) → separadas a 96/87 con línea guía; F4-5: MX/COL/CHL/BRA los 4 en yReal ~92.6-93.1 → separados a 96/69/87/78, ARG (outlier) intacto en 6.9; en ambos la separación mínima entre etiquetas == `gap` y todas en `[4, 96]`. `tsc --noEmit` y `next build` limpios. **Pendiente de Raúl (navegador):** tarjeta de F4-1 y F4-5, etiquetas legibles con su línea guía; descarga PNG/JPG en claro y oscuro. **(Parte B — flexibilizar el set fijo de países F4: agregar/excluir países por petición explícita + nota de escala comprimida (c-lite) — investigación aprobada, plan de implementación entregado por separado, NO implementado esta ronda.)** |
| 26-09-08 | Fontana T10 — Fase 3 de Familia 4: serie histórica de F4-1, F4-4, F4-5 (Banco Mundial). Familia 4 completa. | **Verificación en vivo previa (antes de construir, mismo estándar que F4-7):** llamadas reales a la API de Banco Mundial para los 3 códigos (`NY.GDP.PCAP.PP.CD`, `SI.POV.DDAY`, `FP.CPI.TOTL.ZG`). **Hallazgo 1 — la auditoría decía "paginar ~9k filas":** falso para este caso — acotando a los 5 países del set (`country/mex;col;chl;bra;arg`) la respuesta cabe en **1 página** (`total` ~200-330); el ~9k era para `country=all`. **Hallazgo 2 — F4-4 (`SI.POV.DDAY`)** ahora es "$3.00/día (2021 PPP)" (ya no $2.15). El `sourceNote` "no comparable con ediciones anteriores" se refiere a comparar contra REPORTES viejos del BM ($1.90/2011 PPP, $2.15/2017 PPP), **NO a un quiebre dentro de un pull fresco** (todo en 2021 PPP) — misma distinción fina que F4-2. Años de encuesta IRREGULARES (MX 18 pts, CHL 16, BRA 31), ARG con hueco en 2015 (INDEC). `value:0` es real (varios países ≈0% a esa línea). **Hallazgo 3 — F4-5 (`FP.CPI.TOTL.ZG`), la auditoría lo daba por "limpio como los otros"; NO lo es:** (a) el BM **no publica CPI de Argentina antes de 2018** — solo 7 pts 2018-2024, valores 34%-220%; (b) Brasil tuvo **hiperinflación 1990-1994** (~3000%). Con eje Y lineal compartido (como hace `SerieInternacionalGrafica`), ARG reciente aplasta a MX/COL/CHL/BRA (todos <15% desde 2000). **Decisión de Raúl (Opción 1):** incluir F4-5 con `anioMinimo: 2000` (excluye la hiperinflación de BRA) + `notaTarjeta` que explica la ausencia de ARG pre-2018 y la diferencia de escala — "Argentina en otro régimen inflacionario" es información políticamente relevante, no un defecto a esconder, y la tabla año×país da los valores exactos sin el problema de escala. **Implementación:** `resolverSerieBancoMundial(indicadorId, isos3, anioMinimo?)` en `bancoMundial.ts` junto al resolver de celda sin tocarlo — **un solo resolver genérico** para los 3 (comparten formato de respuesta y endpoint); caché de serie propia (query distinta a la de celda: sin `mrnev`, con `date=1990:<año>`); solo puntos con `value !== null` (mismo criterio que la celda y las oleadas de CEPALSTAT); filtro final por `anioMinimo`; loop de paginación defensivo (`json[0].pages`, inalcanzable con 5 países); sin `rankOficialUltimo` (el BM no da rank). Descomentadas las 3 entradas en `SERIES_INTERNACIONALES_DISPONIBLES` (`F4-1`/`F4-4` `anioMinimo:1990`, `F4-5` `anioMinimo:2000` + nota). Rama `else if (cfg.fuenteId === "banco_mundial")` en el dispatcher `serieInternacional.ts`. **Sin tocar:** `serie-internacional/route.ts` (`formatoDesdeUnidad("USD PPA")` → `"moneda"`, `"%"` → `"porcentaje"`, ya correctos — a diferencia de F4-7 que necesitó el fix de `"0-100"`); `tools.ts` (bifurcación `familiaDeIndicador(id)==="F4"` + `tieneSerieInternacional(id)` genérica, cero IDs F4 literales — F4-1/4/5 quedan cubiertos end-to-end sin editar; la nota de F4-5 ya llega al modelo por `resultForModel.nota` + `"La serie trae una aclaración estructural — menciónala: …"` en `instruccion`/`instruccionChat`, mismo canal que F4-2). **Registry:** F4-1/F4-4/F4-5 tenían `disponibilidadTemporal:{categoria:"a"}` stale → `fix-fontana-series-disponibilidad-sync.ts` (recogió los 3), `diff-fontana-registry.ts` confirmó que SOLO cambió ese campo en esos 3, subido a Storage. **Guard de sincronización:** `verify-fontana-series-disponibilidad-sync.ts` ANTES del fix del registry FALLA señalando F4-1/F4-4/F4-5 categoría "a"; DESPUÉS PASA (22 IDs) — cubre los IDs 7-8-9 sin que se tocara el guard. **Verificación con datos reales (`scripts/verify-fontana-f4-banco-mundial.ts`, ya borrado):** `tieneSerieInternacional` F4-1/4/5 → true, F4-6/F4-8 → false; **cross-check obligatorio — último punto de cada serie == valor de la celda actual, EXACTO, para los 5 países × los 3 indicadores** (F4-1 2025: 25868.479/22640.422/37774.088/23433.29/32586.631; F4-4 2024: 1.6/8.5/0.4/3/1; F4-5: MX/COL/CHL/BRA 2025 = 3.807/5.142/4.213/5.017, ARG 2024 = 219.884); F4-1 36 pts 1990-2025 sin huecos; F4-4 años de encuesta irregulares; F4-5 ARG = 7 pts 2018-2024, BRA primer año = 2000, nota presente. `tsc --noEmit` y `next build` limpios; `verify-fontana-series-disponibilidad-sync.ts` verde (22). **Pendiente de Raúl (navegador):** valores por año en el chat (inflación de México en 2010, PIB PPA de Chile en 2015) sin negar la serie; tarjeta de F4-1 ($ en el eje), F4-4 (línea segmentada por años de encuesta), F4-5 (nota naranja visible + el agente la cita al narrar la serie en el chat, no solo en el Canvas); claro/oscuro + descarga PNG/JPG. |
| 26-09-07 | Fontana T10 — Fase 2 de Familia 4: serie histórica de F4-7 (Índice de Percepción de Corrupción, Transparencia Internacional) | **Verificación en vivo previa (antes de construir):** descarga real del workbook de TI — la hoja `CPI 2024` (la que lee la celda) NO trae años anteriores; la tendencia está en OTRAS hojas del mismo archivo (la auditoría asumía "otras columnas"). Dos formatos: `CPI Timeseries 2012 - 2024` (ancho, 50 cols, con inconsistencia REAL de mayúsculas entre años — `CPI score 2014..2024` pero `CPI Score 2013`/`CPI Score 2012`) y **`CPI Historical`** (largo/tidy: `ISO3`/`Year`/`CPI score`/`Rank`, una fila por país-año, `Rank` en todos los años). Se elige `CPI Historical` por robustez (4 columnas con nombre exacto vs 50, sin trampa de mayúsculas). **Cobertura:** MX + COL/CHL/BRA/ARG con los **13 años completos 2012-2024**, sin huecos. **Quiebre metodológico:** NO hay quiebre interno — la revisión de TI de 2012 es justo la razón de que la serie arranque ese año (hoja titulada "Score timeseries since 2012", datos pre-2012 no están en el archivo). A diferencia de F4-2 (CEPAL marca 2014/2016), **todo el rango publicado es una sola serie comparable**: sin `anioMinimo`, sin nota de tramo. **Implementación:** `resolverSerieTransparency(isos3)` en `transparencyInternational.ts` junto al resolver de celda, sin tocarlo — caché de serie propia (24h, single-flight), `parsearSerieCpi` lee `CPI Historical` por nombre de columna exacto (`throw` claro si falta alguna, mismo criterio que `Hoja "CPI 2024" no encontrada` — sin auto-reparación tipo ZIP, el workbook queda fijado igual que el de celda). `F4-7: { fuenteId: "transparency" }` en `SERIES_INTERNACIONALES_DISPONIBLES` (el tipo `FuenteSerieF4Id` ya incluía `"transparency"`). Rama `else if (cfg.fuenteId === "transparency")` en el dispatcher `serieInternacional.ts`. **Bug latente corregido:** `formatoDesdeUnidad` (`serie-internacional/route.ts`) devolvía `"coeficiente"` para `"índice (0-100)"` porque la substring `"0-1"` está contenida en `"0-100"` — se añade el check de `"0-100"` → `"indice"` ANTES del de `"0-1"` (F4-9/10/11 con `unidad:"%"` y F4-2 con `"índice (0-1)"` no se ven afectados). **`tools.ts` NO se tocó** — la bifurcación `familiaDeIndicador(id) === "F4"` + `tieneSerieInternacional(id)` es genérica, sin lista de IDs (grep: cero IDs F4 literales en el archivo); F4-7 queda cubierto end-to-end automáticamente. Es la prueba de que el barrido de la ronda anterior cerró la CLASE, no solo los 5 IDs. **Registry:** F4-7 tenía `disponibilidadTemporal:{categoria:"a"}` stale → `fix-fontana-series-disponibilidad-sync.ts` (ya itera `SERIES_INTERNACIONALES_DISPONIBLES`, recogió F4-7 solo), `diff-fontana-registry.ts` confirmó que SOLO cambió ese campo de F4-7, subido a Storage. **Guard de sincronización:** `verify-fontana-series-disponibilidad-sync.ts` ANTES del fix del registry FALLA señalando `F4-7 (SERIES_INTERNACIONALES_DISPONIBLES) → categoría "a"`; DESPUÉS PASA (19 IDs) — cubre el 6º ID sin que se tocara el guard. **Verificación con datos reales (`scripts/verify-fontana-f4-7-serie.ts` + `-e2e.ts`, ya borrados):** `tieneSerieInternacional("F4-7")` → true, F4-1/4/5/6/8 → false; `resolverSerieInternacionalF4("F4-7","MEX")` → 5 países `ok`, 13 pts 2012-2024 cada uno; **cross-check obligatorio — último punto (2024) == valor de la celda actual, EXACTO: MEX 26, COL 39, CHL 63, BRA 34, ARG 37**; `rankOficialUltimo` == `celda.rankOficial` (140/92/32/107/99); valores de control MEX 2015=31, MEX 2012=34, ARG 2019=45 OK; simulación del cuerpo de la ruta + `construirCanvasSerieInternacional` → `formato:"indice"`, `polaridad:"mayor_mejor"`, `nota:null`, tarjeta "Índice de Percepción de Corrupción — comparación internacional (2012-2024)", 5 países. `tsc --noEmit` y `next build` limpios; `verify-fontana-series-disponibilidad-sync.ts` verde (19). **Pendiente de Raúl (navegador):** "¿cuál fue el CPI de México en 2015?" → responde 31 sin negar la serie; tarjeta de Canvas de F4-7 con 5 líneas + tabla año×país (13 años → thinned a ~8 filas, igual que F4-3) en claro/oscuro + descarga PNG/JPG. **Fase 3 (no en esta ronda):** F4-1/F4-4/F4-5 (Banco Mundial). |
| 26-09-07 | Fontana T10 — descarga PNG/JPG del Canvas ilegible con el sitio en modo oscuro | Verificación en navegador de F4-7 (capturas reales): la tarjeta se ve bien en pantalla en modo oscuro, pero la descarga PNG/JPG salía con **fondo blanco y texto en variante oscura** (texto claro sobre fondo claro) — los números de la tabla año×país invisibles, encabezados de año/país apenas visibles (`#9AAEBE`). **Diagnóstico (evidencia real, sin navegador):** `exportElementAsImage` (`app/components/shared/`) pasaba `backgroundColor:"#ffffff"` a `html-to-image` — fuerza el fondo del lienzo a blanco, pero `html-to-image` inlina los colores COMPUTADOS de los nodos vivos, que en modo oscuro (`.dark` en `<html>`, estrategia de clase — `@custom-variant dark (&:where(.dark, .dark *))`) resuelven a `dark:text-[#EAF2F8]` / `dark:text-[#9AAEBE]`. Resultado: fondo claro + texto oscuro-variante = sin contraste. **NO es específico de la tabla** (agregada en la ronda de F4-3): el mismo patrón `dark:text-*` está en todo el render (pirámide, series geográficas, barras) — la tabla, más densa en texto y con `#EAF2F8` casi blanco, solo lo hizo evidente. Sin convención previa documentada; el `#ffffff` hardcodeado (26-09-05) ya apuntaba a "siempre claro" pero a medias (solo el fondo). **Fix (causa raíz, en la util compartida):** la descarga SIEMPRE se ve en tema claro, sea cual sea el tema activo — se quita la clase `.dark` de `<html>` durante la captura (con un reflow forzado para que `html-to-image` lea los colores claros) y se restaura en `finally`. Un solo cambio cubre los 5 tipos de gráfica + pirámide + cualquier consumidor futuro. Parpadeo breve del sitio durante la captura (acción explícita del usuario, aceptable). El path de PDF no se toca — ya se renderiza con CSS claro fijo, nunca captura el DOM. Modo claro sin regresión (`teniaDark=false` → comportamiento idéntico al previo). `tsc --noEmit` y `next build` limpios. **Pendiente de Raúl (navegador):** PNG + JPG de F4-7 en modo oscuro → tabla legible; ídem F4-3; descarga en modo claro sin cambios. |
| 26-09-07 | Fontana T10 — nombre de archivo de las descargas del Canvas: sin referencia legible a la tarjeta | Verificación en navegador de F4-7: al descargar la gráfica "Índice de Percepción de Corrupción — comparación internacional (2012-2024)" en PNG/JPG, el nombre sugerido era `Exploracion_Aguascalientes_cv-1788817046569-dj7g9o_2026-09-07` — el `cv-…` es `item.id` (opaco), y la parte legible es el nombre de la sesión, idéntica para TODAS las descargas de esa sesión → el usuario percibía que "conservaba el título anterior". **Causa:** `FontanaCanvasItemCard.tsx` era el único llamador de `buildFilename`/`exportToPdf` (`lib/shared/reportExport.ts`) que pasaba `item.id` como `variantSlug` en vez de una etiqueta legible (PESTEL pasa el formato del informe, Moddulo el label de la fase — ambos correctos). **Fix:** `refDescarga = item.titulo?.trim() || item.id` (el título del canvas item, siempre en lenguaje llano por diseño — nunca lleva el ID del indicador) usado en las 2 descargas (imagen y PDF). `slugify` (compartida) ahora colapsa los `_` que dejan los signos removidos (`—`, `()`) y recorta guiones/underscores de los extremos — mejora cosmética para los 3 módulos, sin regresión (nombres de proyecto sin puntuación quedan igual). Resultado: `Exploracion_Aguascalientes_Indice_de_Percepcion_de_Corrupcion_comparacion_internacional_2012-2024_2026-09-07.jpg`. Colisión solo si misma sesión + título idéntico + mismo día → el navegador añade " (1)". `tsc --noEmit` y `next build` limpios. |
| 26-09-07 | Fontana T10 — F4 series: 4ª instancia del patrón "cableado para Canvas, olvidado en el hermano" + tabla de valores en la tarjeta + barrido de auditoría | **Contexto**: la verificación en navegador de las 3 correcciones anteriores (fila de abajo) reveló que el agente **volvió a negar que el Gini internacional tuviera serie** — esta vez al intentar LEER los valores año por año, no al listar. **Diagnóstico:** la Fase 1 cableó la generación de Canvas (`generar_visualizacion tipo:"serie_temporal"` → `generarSerieInternacional`) pero NO la herramienta de LECTURA: `consultarSerieTemporal` (`tools.ts`) → `fetchSerie` → `serie-temporal/route.ts` (importa solo el `tieneSerie` geográfico) → `{error:"sin_serie", mensaje:"...no tiene serie histórica disponible en Fontana todavía."}` para todo F4. El agente lo reportó verbatim y hasta repudió retroactivamente la tarjeta correcta. El guard `NIEGA_SERIE_HISTORICA` de la ronda anterior NO lo atrapaba porque su compuerta exigía `"tieneSerie":true` en algún `tool_result` del turno, y aquí el único resultado fue `{error:"sin_serie"}`. 4ª instancia confirmada del mismo patrón estructural en F4 (Canvas rechazo → tieneSerie en listados → set fijo de países → esta). **Fix A — cablear `consultar_serie_temporal` al camino internacional:** rama nueva al tope de `consultarSerieTemporal` — `if (familiaDeIndicador(id) === "F4")` → `fetchSerieInternacional` (ya existía) → devuelve `paises[].puntos` COMPLETOS + `instruccion` de que puede citar cualquier año de cualquier país. Verificado en vivo: F4-2 2020 → México 0.452, Colombia 0.552, Chile 0.488, Brasil 0.519, Argentina "sin serie"; 2019 → solo Colombia (0.529) y Brasil (0.538) tienen punto (CEPALSTAT bienal por país, años distintos) — el agente ahora da esa respuesta exacta. **Fix B — tabla de valores año × país** debajo de `SerieInternacionalGrafica` (`FontanaCanvasItemCard.tsx`): filas = años, columnas = países; los años son EXACTAMENTE los del eje X (`aniosTick`, mismo `stepX`) — completa si ≤12 puntos (F4-2 → 5 filas), thinned con el criterio del eje para series largas (F4-3, 34 años → 8 filas: 1990/1995/.../2020/2023), nota "años mostrados = los del eje" cuando aplica. `overflow-x-auto`, `tabular-nums`, ya en `TIPOS_IMAGEN` (la descarga la incluye). **Fix C — endurecer el guard `NIEGA_SERIE_HISTORICA`:** la compuerta ahora dispara con `(a) "tieneSerie":true en algún tool_result` **O** `(b) se llamó una herramienta con un indicadorId de F4 que está en SERIES_INTERNACIONALES_DISPONIBLES` **O** `(c) el texto menciona el nombre de uno de esos 5 indicadores` (`RE_NOMBRE_F4_CON_SERIE` desde `FAMILIA4_NOMBRES`). (b)/(c) cierran la clase: un `sin_serie` fabricado por CUALQUIER herramienta de lectura para un id F4, no solo el ya corregido. `AFIRMA_SERIE_HISTORICA` corregida — quitados `disponible` y los alcances (`internacional`/`municipal`/…) porque aparecen tal cual en frases NEGATIVAS ("no tiene serie histórica disponible en Fontana", "no tiene serie internacional"); ahora solo cuenta como afirmación un "sí tiene/hay" o un calificador temporal concreto (año, nº de puntos, "cerrada"). Además: los 2 `tieneSerie(indicadorId)` sueltos restantes de `consultarIndicador` (rama narrativa F5 `:450`, resultado geográfico `:540` — ambos inalcanzables para F4) pasan a `tieneSerieCualquiera` por consistencia (la comida de este bug es dejar stragglers con el helper viejo). **Fix D — barrido de auditoría** de las 8 herramientas + 18 rutas API + los 2 dispatchers de series. Resultado: **NO hay un 5º caso.** Todo lo que toca indicadores de F4 está cableado (`consultar_indicador`, `consultar_serie_temporal`, `generar_visualizacion`, `listar_indicadores_*`, ruta `familia/F4`, ruta `serie-internacional`) o rechaza F4 explícitamente por diseño (`consulta-territorio`, `comparacion-territorios`, `distribucion`, `familia/[id]/municipios`, `familia/[id]/detalle`, `[C4]` de los demás tipos de Canvas). Único hallazgo: `sesion/[id]/contexto/route.ts` **excluye F4 del contexto inicial** (`continue` para todo lo no-F1/F2/F3/F5) — pero es una exclusión deliberada y TOTAL documentada (F4 tiene shape/panel propio), no la variante "un camino sí, el hermano no" del patrón; el modelo ve F4 al llamar `listar_indicadores_*`. Se reporta, no se toca. **Verificación (`scripts/verify-fontana-f4-lectura-serie.ts`, ya borrado):** (A) valores año×país reales de F4-2 en 2019/2020. (B) tabla F4-2 completa (9 filas), F4-3 thinned (8 filas, = eje X). (C) guard endurecido — 6 casos: dispara con el incidente 2ª parte (gate b+c) y con solo-el-nombre (gate c); NO dispara con F4-7 (sin serie aún, no en el config), negativa geográfica legítima (F5), matizada F4 "X no / Y sí", ni afirmación pura. `tsc --noEmit` y `next build` limpios. **Pendiente de Raúl (navegador):** pedir valores del Gini por año (México/Colombia/Chile/Brasil en 2019 y 2020) → el agente responde con datos reales sin negar la serie; tabla año×país visible en la tarjeta de F4-2 y F4-3. |
| 26-09-07 | Fontana T10 — F4: motivo incoherente de "cobertura limitada" para países que SÍ están en el alcance de la fuente (Argentina en CEPALSTAT) | **Contexto**: verificación en navegador de A/B/C/D — el motivo mostrado para Argentina en la serie del Gini internacional (F4-2) decía "CEPALSTAT no tiene serie para este país — cobertura limitada a América Latina y el Caribe". Incoherente: Argentina SÍ es parte de América Latina y el Caribe; el calificativo de cobertura geográfica solo aplicaría a un país realmente fuera del alcance de la fuente, no como frase de relleno por default. **Diagnóstico (grep):** el sufijo "— cobertura limitada a América Latina y el Caribe" existía SOLO en `cepalstat.ts`, en 2 puntos — la rama `!registro` de `resolverCepalstat` (celda F4) y la rama `delPais.length === 0` de `resolverSerieCepalstat` (serie F4) — es decir una plantilla compartida entre celda y serie y entre los 4 indicadores CEPALSTAT (F4-2/9/10/11). El resto de fuentes (TI, RSF) ya usaban frase plana. Argentina cae ahí porque su encuesta de hogares CEPALSTAT es urbana: aparece en el indicador 3289 pero sin fila con el desglose "Nacional" (`dim_326=327`), no porque esté fuera del alcance geográfico. **Fix (corrige la lógica, no solo el texto):** helper nuevo `motivoSinTotalCepalstat(datos, iso3)` — si el país aparece en algún registro del indicador → "CEPALSTAT no publica el desglose nacional de este indicador para este país (la fuente sí lo cubre, pero no con un valor nacional)."; si no aparece en absoluto → "CEPALSTAT no publica este indicador para este país." Ninguna de las dos afirma cobertura geográfica limitada. Usado en las 2 ramas. La rama `anioMinimo` (F4-2, sin datos comparables desde 2016) se dejó intacta: ya no hacía la afirmación falsa. `ALCANCE_LATAM` (el Set que gobierna el modal de "resto de países") no se tocó — ese sí es alcance de fuente y es correcto. **Verificación con datos reales:** F4-2 → Argentina, celda y serie, ahora "CEPALSTAT no publica el desglose nacional… la fuente sí lo cubre…" (rama "aparece en el indicador", correcta — ARG tiene filas urbano/rural en 3289); F4-9/10/11 → Argentina resuelve `ok` con valor real (68/41/77), no toca el motivo. `tsc --noEmit` y `next build` limpios. |
| 26-09-07 | Fontana T10 — Fase 1 de F4: 3 correcciones post-verificación en navegador (1 grave: el agente negó una serie que sí existe) | **Contexto**: la verificación en navegador de la Fase 1 de series de F4 (cerrada el 26-09-06) reveló 3 problemas. **Problema 1 (GRAVE) — el agente dijo "el Gini internacional (tieneSerie: false)… no tiene serie histórica habilitada", cuando F4-2 SÍ tiene serie internacional.** Diagnóstico (3 agentes Explore, sin forense de Firestore — el análisis de código es concluyente y la cita textual del modelo del campo `tieneSerie: false` prueba que vino de una herramienta real): la Fase 1 solo actualizó a `tieneSerie(id) || tieneSerieInternacional(id)` **2 de 5** superficies (`consultar_indicador` rama F4; `familia/[familiaId]` rama F4). Quedaron con `tieneSerie(i.id)` solo (→ `false` para todo F4): `listar_indicadores_familia` `indicadoresActivos` (`tools.ts:383`) y `catalogoCompleto` (`:395`), y `listar_indicadores_activos_todas_familias` (`:868`). El modelo llamó una de esas, recibió `tieneSerie:false` y lo reportó fielmente — **no fue alucinación, fue un bug de datos.** Ningún guard de `chat/route.ts` cubre una negación falsa: `AFIRMA_RESULTADO` es solo positivo + solo con 0 tool calls; `VOCABULARIO_NO_DISPONIBLE_SIN_RESPALDO` es solo vocabulario de conectores; no existe cruce de "X no está disponible" contra un `tool_result` que diga que sí. **Fix 1:** helper `tieneSerieCualquiera(id)` (= `tieneSerie || tieneSerieInternacional`) en las 3 superficies de listado; `nivelesSerie(id)` devuelve el sentinela **`["internacional"]`** para indicadores F4 con serie (no `null` — el prompt trataría `null` + `tieneSerie:true` como inconsistencia de datos); mismo `nivelesSerie` añadido a la rama F4 de `consultar_indicador`. **Guard defensivo nuevo (decisión de Raúl — cierra la CLASE de error, no la instancia; espejo de `AFIRMA_RESULTADO`):** `chat/route.ts` — al cerrar turno, si el texto final niega que un indicador tenga serie histórica (`NIEGA_SERIE_HISTORICA`, incluye el campo crudo `tieneSerie: false`) Y **no** afirma también que sí hay serie para otro (`AFIRMA_SERIE_HISTORICA`, con lookbehind `(?<!\bno\s)` para no contar "no tiene serie" como afirmación) Y algún `toolResultTextsAcum` del turno contiene `"tieneSerie":true` → `text_suppress` + fuerza UNA corrección. Probado: dispara con la frase real del incidente + con el campo crudo suelto; NO dispara con respuesta matizada "X no tiene, Y sí" ni con afirmación pura ni con texto sin relación; una negativa legítima solo dispararía si un tool result del turno trae `"tieneSerie":true` (gate `toolResultTextsAcum`). **Problema 2 — explicación inconsistente ("no hay serie" vs "sí hay serie pero no comparación puntual").** Causa: la regla de F4-en-Canvas estaba dispersa en 4 lugares del system prompt, sin declaración autoritativa. **Fix 2:** sección nueva `## Familia 4 (comparación internacional) — qué SÍ y qué NO en Canvas` (fuente única de verdad): (a) F4 SÍ tiene serie histórica, nunca digas lo contrario para un id con `tieneSerie:true`; (b) en Canvas F4 solo admite `serie_temporal`; (c) NO existe un tipo de "comparación puntual entre países para un solo momento" — si lo piden, ofrece la serie o el valor puntual en el chat, sé preciso sobre CUÁL limitación aplica; (d) el set de países es fijo. Los otros 3 spots ahora apuntan a este bloque. **Problema 3 — sustitución silenciosa de países**: usuario pidió "México, Chile, Argentina", el Canvas mostró México/Colombia/Chile/Brasil. Confirmado que `generarSerieInternacional`/`resolverSerieInternacionalF4`/la ruta **no tienen ningún mecanismo** para un subconjunto nombrado — el set es SIEMPRE `[paisPrincipal, ...PAISES_REFERENCIA_F4]` (coherente con el diseño "el usuario NUNCA elige"). Es límite de diseño, no bug. **Fix 3:** system prompt (inciso d del bloque nuevo) + nudge server-side en `generarSerieInternacional` (`instruccionChat`): si el usuario pidió países específicos, aclararlo ANTES de generar ("los países de F4 son fijos; no puedo generar solo con los que mencionaste, pero la serie muestra el set completo donde sí aparecen los que pediste y sí están"), nunca sustituir en silencio y explicar después. **Verificación (`scripts/verify-fontana-f4-tieneSerie-fix.ts`, ya borrado):** F4-2/3/9/10/11 → `tieneSerie:true` + `nivelesSerie:["internacional"]`; F4-1/4/5/6/7/8 → `tieneSerie:false` + `null`; regresión F2-1 `["nacional","estatal","municipal"]`, F2-3 `["estatal","municipal"]`, F3-16 `["nacional","estatal"]`, F1-1 `false`/`null` — todos OK. Regexes del guard nuevo probadas contra 7 frases (incidente real, campo crudo, negativa legítima, matizada, afirmación pura, sin relación) — todas las detecciones correctas. `tsc --noEmit` y `next build` limpios. **Pendiente de Raúl (navegador):** reproducir el caso exacto (pedir serie de Gini para México/Chile/Argentina) → el agente debe decir que F4-2 SÍ tiene serie, aclarar ANTES que el set es fijo, y generar con el set completo. |
| 26-09-06 | Fontana T10 — series temporales de Familia 4 (comparación internacional), Fase 1: F4-2, F4-3, F4-9, F4-10, F4-11 | **Contexto**: los indicadores F4 comparan México contra un set fijo de 4 países (`PAISES_REFERENCIA_F4` = COL/CHL/BRA/ARG) y solo mostraban un valor puntual; cada resolver bajaba una serie multi-año y la colapsaba. **Hallazgo que definió el enfoque:** el rechazo `[C4]` de `generar_visualizacion` (`tools.ts`) NO bloqueaba las series de F4 — `tipo:"serie_temporal"` se despacha ANTES de esa compuerta; el bloqueo real era `generarSerieTemporal` → `if (!tieneSerie(id))`, y `tieneSerie` solo conoce `SERIES_DISPONIBLES` (F2/F3). ⇒ para habilitar F4 no se toca `[C4]`; el resto de tipos (resumen/grafica/tabla/distribucion/comparacion_territorios) sigue rechazado para F4 exactamente igual. El camino de datos de F4 es **totalmente paralelo** al geográfico (sin `Territorio`/`SERIES_DISPONIBLES`/`serieTemporal.ts`/`nivelObjetivoSerie`), mismo criterio que `familia4.ts` es paralelo a `resolverIndicadorFontana`. **Implementación:** config nuevo `lib/fontana/series/seriesInternacionalesDisponibles.ts` (`SERIES_INTERNACIONALES_DISPONIBLES` + `tieneSerieInternacional`, SEPARADA de `tieneSerie`); dispatcher `lib/fontana/ingesta/serieInternacional.ts` (`resolverSerieInternacionalF4`, modelado en `resolverIndicadorComparativoF4` — cada país conserva SUS PROPIOS años, sin re-expresar sobre un eje común); resolvers `resolverSerieCepalstat(id, isos3, anioMinimo?)` (F4-2/9/10/11 — reusa `fetchDatosIndicador`/`fetchMapaAños` ya cacheados, NO colapsa; para F4-2 filtra `Number(año) >= 2016`) y `resolverSerieHdr(isos3)` (F4-3 — `FilaHdr.serie` mapea todas las cols `hdi_YYYY`); ruta `GET /api/fontana/serie-internacional` (sin params de territorio); tipo de Canvas nuevo `FontanaCanvasSerieInternacional` (`tipo:"serie_internacional"` — clave `iso3`, `estadoConsulta` de 4 estados **por país** en vez de motivo binario, `nota` de tarjeta, `polaridad` de `FAMILIA4_POLARIDAD`, `paises[]` cada uno con sus `puntos`); builder `construirCanvasSerieInternacional`; render `SerieInternacionalGrafica` (`FontanaCanvasItemCard.tsx` — N polilíneas, **eje X posiciona por VALOR de año** no por índice para que México bienal y Colombia anual se dibujen sin romper la línea, dominio Y compartido, México línea más gruesa, leyenda, países sin serie listados aparte con su motivo); `TIPOS_IMAGEN` gana `serie_internacional`. **Ruteo:** `tools.ts` — en el despacho de `serie_temporal`, `if (familiaDeIndicador(id) === "F4") → generarSerieInternacional` (nuevo, sin guards de territorio), si no `generarSerieTemporal`; el enum del tool no cambia. Descripción del tool + system prompt: F4 pasa de "no disponible en Canvas" a "solo `serie_temporal`". `familia/[familiaId]/route.ts` (rama F4) + `consultar_indicador` rama F4: `tieneSerie` → `tieneSerie || tieneSerieInternacional`. **Guard extendido (decisión de Raúl, misma ronda):** `verify-fontana-series-disponibilidad-sync.ts` y `fix-...` ahora cubren también `SERIES_INTERNACIONALES_DISPONIBLES`; los 5 ids F4 tenían `disponibilidadTemporal:{categoria:"a"}` stale → puestos en `null` y subidos a Storage (`diff-fontana-registry.ts` confirmó SOLO esos 5 campos; mismo fix que los 13 geográficos del 26-09-05). Guard probado en ambas direcciones (pasa con 18 ids; detecta una desincronización deliberada de F4-2). **Verificación con datos reales (`scripts/verify-fontana-serie-internacional.ts`, ya borrado):** (1) **cross-check — el ÚLTIMO punto de cada serie == el valor de la celda actual** (`resolverIndicadorComparativoF4` → `fila.paisPrincipal.valor` / `referencia[i].valor`), EXACTO, para MX + 4 referencia × los 5 indicadores. (2) **F4-2: MX = 5 puntos [2016, 2018, 2020, 2022, 2024], NINGUNO pre-2016**; COL/BRA anuales 2016-2024, CHL 3 pts, ARG `sin_datos_confirmado` (sin línea, listado en leyenda). Nota naranja de tramo presente. (3) F4-3: 34 pts 1990-2023 los 5 países. F4-9/10/11: 23 pts 1996-2024 los 5 países. (4) regresión: `serie_temporal` para F2/F3 sigue produciendo `serie_temporal` normal (la bifurcación solo intercepta `familiaDeIndicador==="F4"`). (5) regresión: `[C4]` intacto — `grafica`/`tabla`/`resumen`/`distribucion` para F4 siguen rechazados sin cambio. `tsc --noEmit` y `next build` limpios. **Pendiente de Raúl (navegador):** render de la tarjeta multi-país en claro/oscuro + descarga PNG/JPG. **Fases 2/3 (no en esta ronda):** F4-7 (TI, columnas de tendencia 2012-2024 del mismo workbook — verificar encabezados en vivo antes), F4-1/F4-4/F4-5 (Banco Mundial: quitar `mrnev=1` + `?date=1990:2025` + paginar ~9k filas). **Fuera:** F4-8 (RSF, "quiebre 2022" del doc de auditoría sin respaldo en el código — no confirmado), F4-6 (EIU, tabla hardcodeada). |
| 26-09-06 | Fontana T10 — serie histórica MUNICIPAL de F2-1/F2-2/F2-14 (pobreza CONEVAL, 2ª ola) | **Contexto**: los 3 indicadores ya tenían serie nacional/estatal (1ª ola, INEGI-PM BISE); faltaba el corte municipal, dejado como "ambiguo/esfuerzo alto" en la auditoría porque se creía que necesitaba archivos xlsx por año con offsets frágiles. La investigación del Bloque 1 (chequeos en vivo 2026-09-06) confirmó otra cosa: los 3 puntos históricos existen como **CSV planos descargables** en la carpeta oficial de Datos Abiertos `pobreza_municipal_2010-2020/`, con **nombres de columna idénticos** (`pobreza`/`pobreza_e`/`carencias`) en los 3 años, y el PDF metodológico oficial ("5. Comparabilidad") declara **"serie quinquenal comparable 2010-2020"** (CONEVAL re-estimó 2010 al ajustar el método en 2015 — la ruptura MCS→Modelo Estadístico 2015 de nivel nacional NO fragmenta esta serie municipal). **Implementación:** `resolverSerieConevalPobrezaMunicipal` (`lib/fontana/ingesta/coneval.ts`, junto a `resolverSerieConeval`/`resolverCeldasPobreza`) — lee los 3 CSV **por nombre de columna** (no offset posicional), con un splitter CSV quote-aware nuevo (~12 líneas — los campos con coma van entre comillas `"922,268"`, los porcentajes planos `23.7`; ningún adaptador existente maneja comas dentro de comillas). Parser por año extraído a función pura exportada `parsearCsvPobrezaMunicipalAnio` (testeable). Cache module-singleton + in-flight dedupe + TTL 24h, mismo patrón que `cargarSerieRezagoSocial`. Reutiliza `resolverNombreMunicipio`/`resolveEstadoCve`/`claveMunicipioPorNombre` ya en el archivo. Un año cuya columna no se localice → punto `{valor:null, nota}` (nunca se omite un año, espejo de `aniosNoVerificados` de F2-3). Municipio con <2 puntos (creado post-2015) → `{ok:false, motivo}` ("un punto no es serie", mismo criterio que PNUD Oaxaca). **Ruteo:** `serieTemporal.ts` — dentro de `case "inegi_pm_bise"` se hace el split por nivel (`nivelObjetivoSerie` → si `"municipal"` va al resolver nuevo, si no a `resolverSerieInegiPm` sin tocar). `SERIES_DISPONIBLES` de F2-1/2/14 gana `"municipal"` en `niveles` (fuenteId sigue `inegi_pm_bise`). **Nota serie-cerrada (superficie nueva, decisión de Raúl — Opción 1):** `ResultadoSerieOk` gana `nota?` a nivel de serie (distinta de `PuntoSerie.nota`), propagada por `serie-temporal/route.ts` → `FontanaCanvasSerieTemporal.nota?` → render naranja en `SerieTemporalGrafica` (calcado del patrón que ya tiene `FontanaCanvasDistribucion`); también llega al modelo (`resultForModel.nota` + nudge en `instruccionChat`) para que la narre. Texto: "CONEVAL cerró la serie municipal de pobreza en 2020 […] no habrá cortes municipales posteriores […] la medición pasó a INEGI, que solo la publica a nivel nacional y estatal." System prompt (`consultar_serie_temporal`) actualizado: F2-1/2/14 pasan de "solo nac/est" a "nac/est Y municipal (serie cerrada de 3 puntos)". **Verificación con datos reales (`scripts/verify-fontana-pobreza-municipal-serie.ts`, ya borrado):** (1) **cross-check gate — 12/12 combos municipio×indicador PASAN**: el punto 2020 de la serie coincide con la celda actual (xlsx) dentro de **±0.04 pp** (Guadalajara F2-1: celda 24.82 / serie 24.8, Δ=0.02; máx Δ=0.04 en Oaxaca de Juárez carencia). El CSV de Datos Abiertos redondea a 1 decimal y la celda a 2 → la diferencia es ≤0.05 pp por construcción, aceptable para una serie histórica; **fallback de "2020 desde la celda" NO se activó**. (2) series plausibles y con tendencia conocida (Guadalajara pobreza 25.8→25.4→24.8; Oaxaca de Juárez carencia 71.6→66.3→70.8). (3) regresión nac/est: `resolverSerieTemporal("F2-1", nacional|estatal)` sigue devolviendo la serie de INEGI-PM (fuente "INEGI (Pobreza Multidimensional 2024)", 5 puntos 2016-2024), el branch municipal no la intercepta. (4) municipio post-2015: 17 municipios en 2020 y no en 2010/2015 (San Quintín BC, varios de Chiapas) → `{ok:false}` con el motivo de "un solo punto". (5) columna ausente forzada (CSV doctoreado sin `carencias`) → `columnasFaltantes=["carencias"]`, `pobreza` sigue mapeada. `tsc --noEmit` limpio; `next build` — pendiente de confirmar; `verify-fontana-series-disponibilidad-sync.ts` pasa (13/13, sin subir registry). **Pendiente de Raúl (navegador):** que la tarjeta de Canvas de serie_temporal para F2-1 en un proyecto municipal muestre la línea de 3 puntos + la nota naranja de serie cerrada. **Fuera de alcance:** F2-8 serie (pausada), Familia 4 (F4-2 decidido: solo tramo 2016-2024), vendorizar los CSV a `info_geo_eske/` como resiliencia ante el dominio legacy de CONEVAL. |
| 26-09-06 | Fontana T10 — F2-8 (Beca Benito Juárez): corrección de integridad del dato publicado — la celda usaba el 4to. trimestre (sobre-conteo ~41%) | **Contexto**: al investigar la posible serie histórica trimestral de F2-8 (Bloque 1 de pendientes), se descubrió que la celda YA publicada en la tabla comparativa de Familia 2 inflaba el conteo de beneficiarios. **Diagnóstico con evidencia real en vivo (3 hallazgos convergentes, `datastore_search`/`package_show` con `curl`+UA):** **(1) salto uniforme** — total nacional Q1=4,206,066 · Q2=4,236,344 · Q3=4,237,327 (planos, ±0.7%), pero **Q4=5,919,559 (+40.7%)**, con multiplicador 1.31–1.54 (casi todos ~1.40) en LOS 32 estados; un factor casi constante en todo el país es artefacto del archivo, no crecimiento real de matrícula (que sería disparejo por estado). **(2) contra cifra oficial** — la Beca Universal EMS Benito Juárez 2025 tiene **4,224,381 estudiantes** (gob.mx); Q1/Q2/Q3 cuadran ±0.4%, **Q4 la excede en ~1.7 millones** (imposible como conteo de becarios EMS). **(3) estructura de montos** — `BECA` en Q4 son escalones ACUMULADOS 1900/3800/5700/7600/9500 (×1..×5 del apoyo bimestral de $1,900); Q4 se publicó el 16-ene-2026 (tras cierre fiscal) y trae >1 fila por becario; Q1-Q3 no tienen esa mezcla. Los 4 archivos trimestrales además son **heterogéneos de esquema** (`bimestre` vs `trimestre` vs `TRIMESTRE`, MAYÚS/minús, `CVE_EDO` con/sin zero-pad, `FECHA_ALTA` ISO vs DD/MM/YYYY). El dataset nunca fue distinguible por persona (Colima Q1: 25,427 filas, 217 combinaciones únicas, una fila idéntica hasta 4,138 veces) — el conteo de filas solo equivale a "becarios" si cada uno aparece 1 vez, cierto en Q1-Q3, falso en Q4. **Sin columna de corte dentro de Q4** para aislar un periodo (campos: `TRIMESTRE` constante, `BECA`, `FECHA_ALTA`) → no se puede "arreglar" Q4 filtrando. **Fix (swap Q4→Q3, `lib/fontana/ingesta/bienestar.ts`):** los 32 `RESOURCE_BECA_BJ` cambian a los recursos "3er. trim. 2025" (extraídos vía `package_show`, CVE de estado del nombre de archivo `S311_EDO_NN_`); `FUENTE_ETIQUETA_BIENESTAR_BECA` → "3er. trim. 2025"; path de bodega → `bienestar_becabj_2025q3_v2/` (sufijo nuevo para invalidar la caché con los conteos inflados de Q4, mismo patrón `_v2`); la lógica de conteo de filas NO cambia (Q3 es un snapshot limpio). Cabecera del archivo documenta los 3 hallazgos in extenso con la instrucción explícita de **NO reintroducir Q4 pensando que "más reciente = mejor"**. **Verificado con datos reales (leyendo los ids desde el código ya editado):** nacional con Q3 = **4,237,327 → +0.31%** vs cifra oficial; spot-check municipal Jalisco/Colima — Q3 cae dentro de ±15% de un prorrateo poblacional de la cifra oficial (San Pedro Tlaquepaque Q3=23,768 vs ~23,034 esperado = 1.03×, Puerto Vallarta 10,027 vs ~9,783 = 1.02×, Manzanillo 6,130 vs ~6,403 = 0.96×), mientras Q4 inflaba ~1.25–1.45× por municipio (Guadalajara pasa de 60,147 en Q4 a 50,341 en Q3; Colima municipio de 10,120 a 7,687). `tsc --noEmit` limpio; `next build` — pendiente de confirmar. **Verificación en navegador (tabla comparativa de Familia 2 muestra el valor nuevo, más bajo) — pendiente de Raúl** (afecta a cualquier sesión con F2-8 activo; la tabla re-resuelve en vivo por sesión, no es snapshot, así que basta recargar). **Serie histórica de F2-8: sigue PAUSADA** — cualquier serie debe construirse sobre snapshots tipo Q1-Q3 y homologar primero la heterogeneidad de esquema entre trimestres; la auditoría (`auditoria-series-temporales.md`) baja el esfuerzo de F2-8 de "bajo" a "medio-alto". |
| 26-09-07 | Fontana T10 — 4ª variante del patrón de fondo: `comparacion_territorios` sin parámetro de nivel + guard de vocabulario **NO cerrado**, cobertura ampliada | Verificación en producción: al pedir explícitamente "nivel MUNICIPAL (capitales)" para 8 territorios, Puebla y Querétaro siguieron resolviendo ESTATAL — el sistema afirmó "SESNSP no desagrega a nivel de municipio capital para esas entidades", una explicación **fabricada, no respaldada por ningún resultado real** (2ª repetición confirmada de esta clase específica de fabricación, la 1ª fue "conector no activo" en Iztapalapa, 26-09-05). **Diagnóstico (a) con evidencia real** — SESNSP SÍ tiene el dato: `resolverIndicadorFontana("F3-2", {municipio:"Puebla", nivel:"municipal"})` → 35,509 carpetas; Querétaro → 32,601. No es límite de la fuente. **Diagnóstico (b) confirmado por código**: el schema de `generar_visualizacion` para `comparacion_territorios` (`tools.ts`) solo tenía `territorios`/`estadosPorTerritorio` — **sin ningún parámetro de nivel**, a diferencia de `consultar_indicador_territorio_externo` (que sí tiene `nivel: enum["estatal","municipal"]` desde el principio, exactamente para este caso). La ruta confirmaba el mismo hueco del otro lado: `nivelHintPorIndicador(registro, null)` con el segundo argumento hardcodeado a `null` — sin plumbing para recibir un override. 4ª variante confirmada del mismo patrón de fondo (nivelObjetivoSerie/Iztapalapa → resolución de nombre Querétaro/Puebla → SESNSP capitalización → esta), pero de naturaleza distinta: no es resolución silenciosa incorrecta, es una laguna real de diseño del schema. **Fix punto 1:** `nivelesPorTerritorio` (paralelo a `territorios`, mismo patrón que `estadosPorTerritorio`) propagado hasta `nivelHintPorIndicador` vía `resolverTerritoriosNombres` (que ahora recibe `registro` + `nivelHintExplicito` POR TERRITORIO, ya no un solo `nivelHint` para todo el lote); system prompt actualizado con el mismo criterio que ya tenía la consulta individual. Verificado con datos reales: Puebla/Querétaro forzando `nivel:"municipal"` → 35,509/32,601 exactos; sin el override, siguen cayendo a estatal por defecto (sin regresión); override "estatal" sobre un nombre que no es un estado real (Iztapalapa) no tiene efecto — resuelve municipal igual, sin error. **Punto 2 — evaluación de fondo del guard de vocabulario, NO implementada como solución completa:** se evaluó (2a) verificación semántica genérica del texto final contra el `motivo` real — descartada por ahora: sin un LLM-juez adicional (costo, latencia, y su propio riesgo de alucinación — no resuelve el problema, lo mueve un nivel arriba) no hay forma determinística de detectar de forma genérica "esta oración es una explicación causal fabricada"; existe un punto intermedio (solapamiento léxico entre la explicación del modelo y los `motivo` reales del turno, sin LLM) que sería más estructural que un blacklist pero es un cambio de mayor riesgo/alcance que amerita su propia ronda de diseño — queda propuesto, no implementado. **Se implementó (2b), cobertura incremental**: `VOCABULARIO_NO_DISPONIBLE_SIN_RESPALDO` (`chat/route.ts`) gana `no desagrega`/`sin desagregación` — probado con 8 casos (incluida la frase real del incidente, 4 motivos reales legítimos que no deben dispararlo, y 1 explicación legítima que SÍ contiene vocabulario similar porque viene de un resultado real — el guard correctamente no la marca). **Documentado explícitamente, por instrucción del usuario: este punto se reporta como "cobertura ampliada, problema de fondo pendiente" — NO como cerrado.** Un guard por lista de frases seguirá encontrando casos nuevos con vocabulario distinto mientras no se invierta en la verificación estructural — revisar si se repite una 3ª vez antes de decidir invertir en el punto intermedio. `tsc --noEmit` y `next build` limpios. |
| 26-09-06 | Fontana T10 — 3ª variante del bug "filtro literal sin join canónico" (SESNSP, F3-1/F3-2 municipal daba 0) | Verificación en producción: `comparacion_territorios` dio "0 carpetas" para 5 de 7 municipios (Cuernavaca, Iztapalapa, Mérida, Culiacán, Mexicali) en Incidencia delictiva (F3-2), mientras la tabla comparativa de la familia mostraba 13,863 para Cuernavaca con el mismo indicador. **Diagnóstico con evidencia real (ambos caminos son la MISMA función, `resolverIndicadorFontana`, no dispatchers distintos):** `resolverIndicadorFontana("F3-2", {municipio:"CUERNAVACA"})` → 0; `resolverIndicadorFontana("F3-2", {municipio:"Cuernavaca"})` → 13,863 — la única diferencia es la CAPITALIZACIÓN del string (`resolverTerritorioNombre`, usado por `comparacion-territorios` para nombres externos, devuelve el nombre en MAYÚSCULAS del catálogo geográfico; el territorio propio de un proyecto lo guarda en capitalización normal). Causa raíz: `carpetasMunicipio`/`carpetasEstado` (`lib/fontana/ingesta/sesnsp.ts`) mandaban el nombre del municipio DIRECTO y LITERAL a un filtro de la API CKAN externa de SESNSP — sin normalizar — mientras que `carpetasPorMunicipioEstado` (usada por el desglose plural, que sí funcionaba) ya tenía la corrección correcta desde 2026-08-27: descargar todo el estado y buscar por `claveCanonicaMunicipio`, inmune a mayúsculas/acentos. La corrección NUNCA se había propagado al camino de un solo territorio — 3ª variante confirmada de la misma familia de bug (nivelObjetivoSerie/Iztapalapa → resolución de nombre Querétaro/Puebla → esta). **Fix:** `carpetasMunicipio` y `carpetasEstado` reescritas para reutilizar `carpetasPorMunicipioEstado` + `claveCanonicaMunicipio` — mismo mecanismo ya probado, sin parche puntual; `sumarCarpetas` (código muerto tras el cambio) eliminada. Como F3-1 y F3-2 comparten esta misma función (`resolverSesnspGenerico`), el fix corrige ambos indicadores a la vez. **Verificado con datos reales:** caso motivador — Cuernavaca da 13,863 con AMBAS capitalizaciones ahora; F3-1 (Tasa de homicidios) también tenía el mismo bug latente y quedó corregido igual (32.06 por 100k con ambas capitalizaciones); los 7 territorios reales del incidente (Cuernavaca 13,863 / Iztapalapa 27,416 / Mérida 3,135 / Culiacán 15,156 / Mexicali 31,266 — antes 0; Puebla/Querétaro/Zacatecas correctamente a nivel estatal, ya que para F3-2 ese nivel SÍ es viable — comportamiento correcto, no bug); desglose por estado (el camino que ya funcionaba) sigue dando el valor correcto tras el refactor, sin regresión. **Higiene (barrido preventivo pedido explícitamente):** grep de todo `lib/fontana/ingesta/` buscando otros resolvers con filtro de string literal sin `claveCanonicaMunicipio` — ningún otro candidato real encontrado: `gacp.ts`/`sun.ts` usan `resolverCveOficialMunicipio` (anvcc.ts), que internamente YA llama `claveCanonicaMunicipio`, así que están protegidos por un camino indirecto; el resto de fuentes con municipio en el nombre (`shcpGasto`, `stpsHuelgas`, `iep`, `banxico`) son nacional/estatal-only con motivo explícito de "no publica por municipio", sin join que romper; las fuentes internacionales/nacionales (banxico, cepalstat, bancoMundial, transparencyInternational, pnudHdr, enigh, stpsSalario, rsf) no tienen nivel municipal en absoluto. `tsc --noEmit` y `next build` limpios. |
| 26-09-06 | Fontana T10 — fluidez del guard de lote (confirmación parcial) + rediseño de las 3 gráficas de barras horizontales | **Punto 1:** el guard de territorios (`territorioNombradoPorUsuario`) solo miraba el mensaje ACTUAL del usuario — cuando el sistema propuso 6 territorios ("¿confirmas Cuernavaca, Toluca, Pachuca de Soto, Querétaro, Puebla y Cuauhtémoc?") y el usuario corrigió solo un nombre ("sí, se trata de Pachuca de Soto"), exigía repetir los 6 completos. **Fix:** `territorioConfirmadoDePropuestaAnterior()` (`tools.ts`) — un territorio también cuenta como nombrado por el usuario si el ASISTENTE ya lo propuso en su último mensaje real (`ctx.ultimoMensajeAsistente`, nuevo campo en `ToolContext`/`chat/route.ts`, mismo `ultimoMensajeAssistantReal()` ya usado para `municipiosPreguntadosPrevio`) Y el usuario responde con lenguaje de confirmación/corrección (`RE_CONFIRMACION_O_CORRECCION`) — sigue siendo 100% server-side y determinístico contra texto real, nunca confía en que el modelo afirme haber preguntado. Aplicado en `limiteTerritoriosLote` y en el guard de `comparacion_territorios`. **2 bugs reales encontrados durante la verificación de este fix (no teóricos — aparecieron al probar con texto real) y corregidos en la misma ronda:** (a) `\b` de JS regex no cierra correctamente después de una vocal acentuada ("sí" no matcheaba `\bs[ií]\b` porque "í" no es `\w`) — se resolvió normalizando el texto (`normalizeGeoName`) antes de probar la regex, con la propia regex reescrita en mayúsculas sin acentos; (b) el fallback por token de `territorioNombradoPorUsuario` (ya en producción desde 26-09-05) hacía `substring` plano, no palabra completa — "Ciudad" (de "Ciudad de México") calzaba dentro de "ciudad**es**" en una frase genérica, dejando pasar un territorio que el usuario nunca nombró; se apretó a coincidencia de palabra completa (`contienePalabraCompleta`, `\b<patrón>\b` sobre texto ya normalizado) — verificado que no regresiona los 5 casos ya validados en la ronda de Fallo 1. Verificación de los 3 escenarios pedidos: confirmación parcial (genera los 6) / sin propuesta previa (sigue bloqueando) / regresión del incidente original Iztapalapa-Jalisco (pregunta genérica de tipo → sigue bloqueando) — los 3 correctos. **Punto 2:** rediseño de `GraficaBarras`, `DistribucionBarras` y `ComparacionTerritoriosBarras` (compartían el mismo patrón: etiqueta a la izquierda truncada + barra al centro + valor a la derecha, con la unidad de medida completa repetida en cada fila cuando `unidad` era una frase larga, ej. "% que percibe inseguridad en su ciudad" de ENSU). Nuevo componente compartido `FilaBarraHorizontal` — nombre completo ARRIBA (nunca se trunca), barra a ancho completo debajo, valor junto al nombre (sin repetir la unidad); `item.unidad`/`item.formato` se muestra UNA vez como subtítulo de toda la gráfica, no por fila. Mismo lenguaje visual en los 3 componentes; se preserva todo lo que ya funcionaba (badges de "(tu proyecto)", nivel por fila cuando difieren entre territorios, notas de `motivo`/`noResueltos`). `tsc --noEmit` y `next build` limpios — falta verificación visual en navegador (light/dark) de parte del usuario. |
| 26-09-06 | Fontana T10 — inconsistencia de nivel geográfico en colisión estado/municipio homónimo (Querétaro, Puebla) | Verificación en producción de `comparacion_territorios` (ronda anterior): en la MISMA conversación, consultas individuales previas de Querétaro/Puebla habían devuelto valores reales (36.1%, 81.3%, Percepción de Inseguridad ENSU F3-4), pero la comparación en lote los resolvió a nivel ESTATAL (ENSU no tiene cobertura estatal → "sin dato"), contradiciendo lo ya afirmado. **Causa raíz confirmada en código:** `resolverTerritorioNombre` (`lib/fontana/geo/`) resuelve ESTADO por defecto cuando el nombre coincide con un estado — SOLO evita esa rama si el llamador pasa `nivelHint:"municipal"` explícito. El flujo individual (`consultar_indicador_territorio_externo`) tiene un parámetro `nivel` OPCIONAL que el MODELO decide pasar o no (heurística, no determinística — por eso acertó unas veces y falló otras en la misma conversación); el flujo nuevo `resolverTerritoriosNombres` (ronda anterior) lo pasaba hardcodeado a `null`, así que NUNCA tenía oportunidad de resolver municipal. Mismo patrón que `nivelObjetivoSerie` (26-09-06, ronda anterior), pero NO se repitió el error de "forzar municipal siempre" (eso solo cambiaría el bug de sentido — para un indicador donde estatal SÍ es el nivel correcto, forzar municipal generaría "sin dato" donde antes había un valor real). **Fix consciente del indicador:** `nivelHintPorIndicador(registro, nivelHintExplicito)` (nueva, co-ubicada en `resolverTerritorioNombre.ts`) — consulta `IndicadorRegistro.niveles` (ya existente, `estado:"confirmado"|"pendiente"|"no_viable"` por nivel); si "estatal" es `no_viable` Y "municipal" está `confirmado` para ESE indicador, fuerza `nivelHint:"municipal"` de forma determinística; si "estatal" SÍ es viable, no toca nada (comportamiento de hoy se preserva). Aplicado en AMBOS flujos por decisión explícita del usuario (no solo el que motivó el hallazgo): `consulta-territorio/route.ts` (consulta individual) y `comparacion-territorios/route.ts` (lote, vía nuevo parámetro `nivelHint` en `resolverTerritoriosNombres`). **Verificado con datos reales:** caso motivador — Querétaro 36.1%, Puebla 81.3%, Cuernavaca 79.8% ahora resuelven municipal en AMBOS flujos (antes solo a veces en el individual, nunca en el lote); caso de control (Colima, F1-1 Población Total — estatal Y municipal confirmados) sigue resolviendo ESTADO (731,391 hab.), sin regresión; ambiguo (Guadalupe, 4 candidatos)/no-encontrado siguen funcionando igual con el nuevo `nivelHint` aplicado. `tsc --noEmit` y `next build` limpios. |
| 26-09-06 | Fontana T10 — `comparacion_territorios`: un indicador entre N territorios arbitrarios (investigación → propuesta → aprobación → implementación) | Pendiente retomado: comparar 1 indicador entre N territorios nombrados por el usuario (ej. Percepción de Inseguridad en varias ciudades) en UNA tarjeta de Canvas — antes solo posible con N consultas de texto sueltas (`consultar_indicador_territorio_externo`). **Investigación previa (2 agentes Explore):** `generar_visualizacion` tipo `grafica` está hard-wired a `NivelTablaFontana` en las 4 capas (schema/executor/builder/render — `GraficaBarras` incluso ignora `etiquetaNivel` y recalcula desde el enum); extenderlo conflaría 2 ejes semánticamente distintos. El patrón F4 (comparación internacional) es un mal precedente — lista fija en código, sin usuario, F4 está excluida por diseño del Canvas (`generar_visualizacion` la rechaza explícitamente). El precedente correcto ya existía: `FontanaCanvasDesglose`/`agregacionPlural.desglosePorUnidad`+`noResueltas` (shape "N etiquetas arbitrarias + valor + motivo", con partición resuelto/no-resuelto ya construida para los municipios propios de un proyecto plural) — se generalizó a territorios EXTERNOS nombrados. **Diseño aprobado:** nuevo `tipo:"comparacion_territorios"` DENTRO de `generar_visualizacion` (no tool nueva — mismo criterio que ya diferenció `consultar_serie_temporal`, pero aquí el tool YA es un dispatcher multi-modo, así que un `tipo` más es lo consistente). **Condición de seguridad añadida antes de aprobar** (cierra el mismo hueco del incidente de los 8 municipios de Jalisco, pero para una sola llamada con array en vez de N llamadas repetidas — `limiteTerritoriosLote` cuenta llamadas repetidas, nunca se dispara con un array de una sola llamada): reutiliza `territorioNombradoPorUsuario` (sin tocarla) para verificar que CADA nombre en `territorios[]` esté literalmente en el último mensaje del usuario — si el modelo intenta colar aunque sea uno no nombrado, se rechaza la llamada COMPLETA. **Implementación:** `resolverTerritoriosNombres()` (`lib/fontana/geo/`, wrapper `Promise.all` sobre `resolverTerritorioNombre`, sin tocarla); ruta nueva `GET /api/fontana/comparacion-territorios` (`territorio=` repetido + `estado=` paralelo); `construirCanvasComparacionTerritorios` (`canvasBuilder.ts`); `FontanaCanvasComparacionTerritorios` (tipo nuevo, `filas[]` con `esTerritorioDelProyecto`/`esTerritorioExterno`/`nivel` por fila + `noResueltos[]`); render `ComparacionTerritoriosBarras` (mismo patrón que `GraficaBarras`, `key`=`territorioLabel`, nota si los niveles difieren entre filas, lista honesta de `noResueltos`); tope duro de 8 territorios (rechazo explícito arriba de eso, nunca trunca en silencio); agregado a `TIPOS_IMAGEN` (descarga PNG/JPG reutiliza `exportElementAsImage` sin cambios ahí). System prompt: 4º eje de gráfica + bloque dedicado de reglas de `territorios`. **Verificación con datos reales (F3-4, Percepción de inseguridad ENSU):** caso feliz — Cuernavaca 79.8%, Toluca 71%, Guadalajara 78.2% (valores reales); "Pachuca" solo NO resuelve pero "Pachuca de Soto" sí (54.6%, mismo comportamiento ya documentado en el contexto original del pendiente — no es un bug nuevo); "Querétaro"/"Puebla" resuelven como ESTADO y devuelven motivo honesto ("ENSU no tiene cobertura estatal completa") en vez de inventar un valor; "CDMX" no resuelve (no es alias reconocido, reportado honesto en `noResueltos`) pero "Ciudad de México" sí; "Cuauhtémoc"/"Guadalupe" ambiguos con candidatos reales de 4 estados cada uno. Guard nuevo probado con 3 escenarios: usuario nombra todos → acepta; modelo intenta colar 5 capitales no pedidas → rechaza señalando cuáles; frase colectiva sin nombrar ninguno (mismo patrón que el incidente original) → rechaza los 8. Tope de 8 probado (9 rechaza, 8 acepta). `tsc --noEmit` y `next build` limpios. |
| 26-09-06 | Fontana T10 — recortes en los bordes de las imágenes descargadas del Canvas | Tras el primer uso real de "Descargar PNG/JPG" (`exportElementAsImage.ts`), el usuario reportó valores ilegibles en los extremos de la pirámide de edades y de la gráfica de serie temporal. Causa (2 bugs de layout distintos, no un problema del mecanismo de exportación): **(1) Pirámide** (`PiramideSexo`) — la barra y su etiqueta de conteo comparten la misma fila flex; el ancho de la barra se calculaba como `(valor/max)*100%` SIN tope, así que el grupo de edad con el valor máximo llegaba a 100% y dejaba 0% de espacio para su propio número, empujándolo fuera del contenedor — visible en pantalla si hay margen ambiente de la página, pero cortado en la imagen exportada porque `exportElementAsImage` captura exactamente el recuadro del nodo, sin margen para overflow. **Primer fix (revertido — incorrecto):** tope de 80% en el ancho de la barra — corregía el corte pero aplanaba la lectura de proporciones (varios grupos con valores distintos entre 61k-76k se veían con la misma longitud de barra), detectado por el usuario en verificación visual. **Fix correcto:** la etiqueta pasa a una columna de ancho fijo (`shrink-0`) fuera del cálculo de porcentaje; la barra se escala 0-100% dentro de un "carril" (bar-track, `flex-1` anidado) que ya excluye el ancho de la etiqueta — a cualquier valor, incluido el máximo, la barra llena como mucho su propio carril sin invadir la columna de la etiqueta. Proporcionalidad exacta entre barras preservada, sin tope artificial. **(2) Serie temporal** (`SerieTemporalGrafica`) — las etiquetas de los puntos extremos (año/valor en x=0% y x=100%) se centran con `-translate-x-1/2`, así que la mitad del texto ("0.759", "2020") cae fuera del contenedor en los bordes; el contenedor solo tenía `mx-1` (4px) de margen. Fix: `mx-8` (32px). **(3) Defensa en profundidad**: el wrapper `graficaRef` (el nodo que captura `exportElementAsImage`) de los 3 tipos gráficos pasa de `p-1` a `p-4` — más margen base para cualquier overflow menor no cubierto por los 2 fixes anteriores. `tsc --noEmit` y `next build` limpios. |
| 26-09-06 | Fontana T10 — verificación en navegador post-fix de catálogo: 4 hallazgos, `nivelObjetivoSerie` corregido | **Punto 1 (corrección de premisa, sin fix):** el "motivo fabricado" reportado ("El IDH y sus sub-índices solo existen a nivel municipal en PNUD...") en realidad es el `motivo` LITERAL de `resolverSeriePnud` (`pnud.ts:438`) — coincide palabra por palabra. El guard `VOCABULARIO_NO_DISPONIBLE_SIN_RESPALDO` no lo bloqueó porque no debía: el texto SÍ estaba respaldado. No hay una nueva forma de fabricación evadiendo el guard. **Punto 2 (CONFIRMADO, causa real distinta a la hipótesis inicial de "catálogo corrupto tipo ITER"):** el catálogo de nombres de PNUD ya usa `claveCanonicaMunicipio` y está verificado 16/16 para las alcaldías de CDMX (comentario de cabecera `pnud.ts:22-24`, mismo dataset que usa la serie) — el catálogo estaba bien. El bug real: `nivelObjetivoSerie` (`lib/fontana/series/tipos.ts`) NUNCA intentaba "municipal" para proyectos `distrito_local`/`distrito_federal`/`distrito` (legacy) — solo probaba "estatal", pase lo que pase — aunque el indicador SÍ publicara serie municipal y el `territorio.municipio` ya viniera resuelto (vía `extraerCiudadCabecera`, ya cableado en cada resolver desde el Incremento 4). Afectaba a los 5 resolvers que usan la función (`coneval`, `enigh`, `pnud`, `stpsHuelgas`, `inegiPm`) — con 2 síntomas distintos según si el indicador tenía o no nivel "estatal" como alternativa (F2-5/20/21/22 → motivo genérico de "no existe a ese nivel"; F2-3 → silenciosamente devolvía el dato de TODO el estado en vez de intentar el municipio). **Fix:** la función ahora prueba "municipal" ANTES que "estatal" para los 4 tipos con municipio resoluble (municipal + los 3 distrito_*), y sigue sin tocar el camino "estatal puro" (nunca intenta municipal ahí, correcto). Verificado con 8 casos de regresión (pura función, incluye los 2 casos de no-regresión pedidos: estatal puro con indicador estatal+municipal sigue en estatal; distrito_local con indicador solo nacional/estatal sigue cayendo a estatal) — los 8 pasan. Verificación end-to-end con datos REALES: `resolverSeriePnud("F2-21", iztapalapa)` y `resolverSerieConeval("F2-3", iztapalapa)` con un `Territorio` sintético `distrito_local` → ambos devuelven ahora la serie MUNICIPAL real de Iztapalapa (IDH-Ingreso 2010/2015/2020: 0.787/0.805/0.759; Rezago Social 2000-2020 con sus 5 valores reales), no un motivo de error. **Punto 3 (CONFIRMADO, hueco de cobertura real, no regresión de una regla que dejó de aplicar):** la regla "IDs de indicador son internos" (`systemPrompt.ts`) nunca prohibió citar el nombre snake_case de una tool — solo cubría IDs y narración de proceso HACIA ADELANTE. El modelo, al autocorregirse ante la corrección del usuario, citó `listar_indicadores_activos_todas_familias` literal. **Fix (prompt + guard server-side, mismo patrón que los 2 guards anteriores):** sección renombrada "Los IDs de indicador y los nombres de herramientas son internos" con prohibición explícita + ejemplo del incidente + cobertura explícita del contexto retrospectivo/autocorrección; guard nuevo en `chat/route.ts` (`contieneNombreHerramienta`, chequeo EXACTO —no regex difusa— contra los 8 nombres reales de `FONTANA_TOOLS`) que fuerza una corrección si el texto final cita cualquiera; probado contra la frase real de la transcripción (detecta) y 2 frases limpias (no detecta, sin falsos positivos). **Punto 4 (CONFIRMADO, sin implementar — decisión de producto pendiente del usuario):** `useChatStream.ts:89-96` pinta cada `text_delta` en pantalla EN VIVO, antes de saber si esa iteración terminará suprimida (`chat/route.ts` solo decide después de `finalMessage()`, cuando todo el texto de la iteración ya viajó) — el parpadeo es consecuencia directa y esperada del diseño "pintar en vivo, decidir después", no un bug de temporización menor. 3 rutas evaluadas (buffer cliente, buffer servidor por iteración, heurística de detección temprana) — ninguna es gratis: todas sacrifican el streaming token-a-token de la iteración FINAL para eliminar el parpadeo de las intermedias, porque no se puede saber de antemano si el modelo llamará una herramienta después de escribir texto. Usuario decidió mantener streaming en vivo, aceptar el riesgo residual — sin cambios este punto. `tsc --noEmit` y `next build` limpios. |
| 26-09-05 | Fontana T10 — catálogo de series históricas mal etiquetado (incidente Iztapalapa) — 2 bugs, 3 fixes | **Diagnóstico (sin forense de Firestore — la sesión pegada no existe en las 12 sesiones reales de producción; solo lectura de código/registry):** el usuario reportó 5/11 indicadores mal etiquetados en la tabla de "qué tiene serie histórica" para un proyecto municipal (Iztapalapa). **Bug 1:** `listar_indicadores_familia`/`listar_indicadores_activos_todas_familias` (`tools.ts`) exponían `tieneSerie` (booleano) pero NUNCA `niveles` — la columna "Nivel de la serie" que el modelo mostraba era pura inferencia del NOMBRE del indicador ("IDH Municipal"→"Municipal"), sin respaldo de ningún tool result. **Bug 2 (confirmado leyendo `data/fontana/INDICATOR_REGISTRY.json` directamente):** los 13 indicadores YA cableados en `SERIES_DISPONIBLES` (incluido F2-17, el piloto original, no solo los 5 reportados) conservaban `disponibilidadTemporal.categoria:"a"/"c"` con nota "función pendiente" — nunca actualizado al construir su conector real (2ª ola, 26-09-03). El modelo, al no encontrar el motivo real de la falla, reciclaba ese vocabulario stale ("el conector no está activo" — frase que solo existe en `systemPrompt.ts` como explicación de categoría "b", ni siquiera la "a" real del registry) en vez de citar el `motivo` real de `resolverSeriePnud`/`resolverSerieConeval` (`Municipio "X" no reconocido...`) — violación de la regla ya existente de reportar el motivo verbatim. **Fixes:** **(1)** `scripts/fix-fontana-series-disponibilidad-sync.ts` puso `disponibilidadTemporal: null` en los 13 IDs de `SERIES_DISPONIBLES` (diff verificado contra Storage antes de subir — solo cambió ese campo, en esos 13 IDs; subido con `upload-fontana-registry.ts`); guard permanente `scripts/verify-fontana-series-disponibilidad-sync.ts` (falla si algún ID de `SERIES_DISPONIBLES` conserva categoría no-null; probado en ambas direcciones — pasa limpio y detecta una desincronización de prueba deliberada). **(2)** `nivelesSerie` (de `SERIES_DISPONIBLES[id].niveles`) expuesto junto a `tieneSerie` en `indicadoresActivos`/`catalogoCompleto` de las 2 herramientas de catálogo; system prompt instruye usarlo literal, nunca inferir del nombre. **(3)** guard server-side nuevo en `chat/route.ts` (mismo espíritu que `AFIRMA_RESULTADO`) — `VOCABULARIO_NO_DISPONIBLE_SIN_RESPALDO` (conector/función pendiente/no está activo-conectado): si el texto final usa ese vocabulario y NINGÚN resultado real de herramienta del turno (`toolResultTextsAcum`, nuevo acumulador) lo contiene, se descarta y fuerza una corrección; probado con 8 casos (3 frases reales de la transcripción, 4 motivos reales del código de los resolvers, 1 caso legítimo simulando que la herramienta sí trae ese vocabulario) — los 8 correctos. System prompt: sección nueva "Nunca inventes POR QUÉ algo no está disponible". **(4) Forense de Iztapalapa: NO localizado** — las 12 sesiones reales de `fontana_sesiones` no incluyen ninguna con territorio Iztapalapa; la corrección se apoya en la evidencia de código (registry + tools + regex), no en un dump real de esa conversación. `tsc --noEmit` y `next build` limpios. |
| 26-09-05 | Fontana T10 — 3 ajustes de UI: bulk add/clear indicadores, composer a 2 niveles, descargar/eliminar en Canvas | **1:** botones "Añadir todos los indicadores"/"Limpiar indicadores" en `FontanaIndicadoresAccordion.tsx` (mismo patrón visual `text-[11px] underline` que "Seleccionar todos"/"Limpiar seleccionados" de `FontanaMunicipiosModal.tsx`) — nueva rama bulk en el PATCH de `sesion/[sesionId]/route.ts` (`accion:"agregar_todos"\|"quitar_todos"`, catálogo completo importado server-side igual que ya hace `familia/[familiaId]/route.ts`); "quitar_todos" solo vacía `seleccionUsuario` (los `minimos`/candado viven en array separado, nunca se tocan — sin necesidad de filtrar). **2:** composer del chat compartido (`ChatPanel.tsx`) reestructurado de 1 fila a 2 niveles: textarea sola arriba a todo el ancho, adjuntar+dictado abajo a la izquierda (centro vacío), botón enviar fuera de la columna con `self-stretch` (pasa de círculo fijo 36×36 a `rounded-2xl w-11` con alto = las 2 filas combinadas). **3 (investigación previa + implementación):** kebab (⋮) en `FontanaCanvasItemCard.tsx` con Descargar/Eliminar. Descargar PDF (resumen/tabla/desglose) reutiliza **literal** `lib/shared/reportExport.ts` (`exportToPdf`+`buildFilename`, mismo mecanismo popup+`window.print()` de Moddulo/PESTEL) vía serializador nuevo `lib/fontana/canvasExport.ts` (`canvasItemToMarkdown`, solo contenido, no mecanismo). Descargar PNG/JPG (grafica/distribucion/serie_temporal) — verificado por grep que NO existía ningún precedente de captura DOM→imagen en el repo — primera instancia con `html-to-image` (dependencia nueva, liviana, sin deps nativas), envuelta en util **compartida** `app/components/shared/exportElementAsImage.ts` (no enterrada en Fontana) para que el próximo módulo la reutilice. Eliminar = borrado suave: `FontanaCanvasItemBase.eliminado?: boolean` (mismo patrón que `FontanaSesion.archivada`), nueva rama PATCH `{canvasItemId, eliminarCanvasItem:true}` (Firestore no permite update parcial de un elemento de array — se lee y reescribe completo), `FontanaCanvasTab` filtra `!eliminado` al renderizar. Modal de confirmación: mirror inline de `FontanaSesionesHub.tsx` (`SesionCard`) — no existe componente compartido de confirmación en el repo, se documenta como hallazgo. Texto del modal deliberadamente honesto sobre el borrado suave ("Dejará de verse en tu Canvas", sin "no se puede deshacer"/"permanente", que sí aplica en `SesionCard` porque ahí es borrado duro). "Ver en Canvas": confirmado que hoy NO apunta a un item específico (solo cambia de pestaña, sin scroll/resaltado por `canvasItemId`) — sin cambio de alcance esta ronda, decisión explícita del usuario. Verificado: `canvasItems` son snapshots de valores ya resueltos, sin dependencia de la selección activa de indicadores (grep sin resultados en `FontanaCanvasTab`/`FontanaCanvasItemCard` sobre `indicadoresPorFamilia`) — "Limpiar indicadores" no afecta tarjetas de Canvas ya generadas. `tsc --noEmit` y `next build` limpios. |
| 26-09-05 | Fontana T10 — 2 fallos post-fix `confirmadoLote`: umbral de lote penaliza selección explícita + re-llamada redundante duplica tarjetas | **Fallo 1 (umbral):** tras la pregunta correcta del agente, el usuario nombró 3 municipios explícitos en una sola respuesta ("solo Guadalajara, Zapopan y Tlaquepaque") — caso que la regla original decía que pasaba directo — pero el 3º (Tlaquepaque) se bloqueó igual, porque `limiteTerritoriosLote` contaba territorios DISTINTOS en el turno sin mirar si el usuario ya los había nombrado. **Fix:** `territorioNombradoPorUsuario()` (`tools.ts`) — compara (vía `normalizeGeoName`) el territorio de la llamada contra `ctx.ultimoMensajeUsuario` (el mensaje que disparó el turno, nuevo campo en `ToolContext`/`chat/route.ts`); match por substring completo O por último token ≥4 caracteres (cubre que el modelo expanda "Tlaquepaque" a "San Pedro Tlaquepaque"). Si el usuario ya lo nombró, esa llamada NO cuenta hacia el límite — sin tope de cantidad (se rechazó deliberadamente subir el número mágico de 3 a otro). **Fallo 2 (GRAVE, re-llamada redundante) — forense de Firestore de la sesión real (`vO9JFif6W3UQc7DlyqPq`) ANTES de tocar código:** confirmado que NO hubo alucinación esta vez (Tlaquepaque sí se generó y persistió, turno `d4cab890`) — el problema apareció en el turno SIGUIENTE, al pedir "lectura comparativa de estas tres gráficas": el agente volvió a llamar `generar_visualizacion` para Guadalajara/Zapopan (duplicando sus tarjetas) y Tlaquepaque (bloqueada de nuevo, 3ª del turno). Causa raíz: `generar_visualizacion` es la ÚNICA herramienta que devuelve los valores numéricos de una pirámide (`piramideSexo`) al modelo — no existe un tool de solo-lectura equivalente para F1-2 — y `historial` (`chat/route.ts`) reconstruye cada turno solo con el TEXTO narrado de mensajes previos, nunca con los `tool_result` crudos, así que el modelo estructuralmente no tiene forma de "releer" los números sin volver a llamar la herramienta. Confirmado con el usuario: no es un caso aislado, es arquitectónico. **Fix (2 capas, ambas por decisión explícita del usuario — no una en vez de la otra):** capa prompt (`systemPrompt.ts`) instruye que si el resultado trae `yaExistiaEnCanvas:true` no se anuncia "agregué/generé"; capa server-side (la que realmente evita el problema, sin depender de que el modelo obedezca) — `FontanaCanvasDistribucion` gana `territorioLabel?: string` (mismo campo que ya tenía `FontanaCanvasSerieTemporal`, poblado en `construirCanvasDistribucion`); `ToolContext.canvasItemsSesion: FontanaCanvasItem[]` (snapshot de `sesion.canvasItems` al iniciar el turno, mutado in-place según se agregan tarjetas EN el turno); `buscarCanvasItemExistente()` compara `indicadorId+territorioLabel` (match bidireccional por substring, sirve tanto para la aproximación pre-fetch en `limiteTerritoriosLote` con el nombre crudo como para el match exacto post-fetch) — si ya existe, la rama F1-2/F1-11 de `generarVisualizacion` y `generarSerieTemporal` devuelven los datos de la tarjeta EXISTENTE (`yaExistiaEnCanvas:true`, sin `canvasItem` en el resultado) en vez de duplicar la escritura en Firestore; `limiteTerritoriosLote` tampoco cuenta esa llamada hacia el límite. **Verificación:** heurística de Fallo 1 probada contra los textos reales de la transcripción (5/5 casos, incluida la frase real "Sólo dame los de Guadalajara, Zapopan y Tlaquepaque."); matcher de Fallo 2 probado contra los labels reales del dump ("Guadalajara" vs "GUADALAJARA, JALISCO", etc., 6/6 casos). `tsc --noEmit` y `next build` limpios. |
| 26-09-04 | Fontana T10 — `confirmadoLote` deja de ser un booleano ciego (2ª forma de falla, 8 municipios de Jalisco) | Forense (mismo método): tras el fix del guard B, el modelo SÍ preguntó algo antes de generar — pero preguntó el TIPO de gráfica ("¿pirámide o urbano/rural?"), y al responder el usuario ("sí, pirámide de edades") el modelo trató esa respuesta como confirmación del LOTE DE MUNICIPIOS, mandando `confirmadoLote:true` en las 8 llamadas desde la primera (turno `84de2db5`, 2026-09-04T18:15:04Z, verificado en el dump). Causa: `confirmadoLote` era un booleano autoreportado sin verificación semántica — mismo principio ya aplicado en el guard A (nunca confiar en lo que el modelo afirma de sí mismo sin contrastarlo con la conversación real). **Fix:** `ToolContext.municipiosPreguntadosPrevio: boolean` (nuevo campo, `chat/route.ts`) — calculado del ÚLTIMO mensaje real del asistente (excluyendo `id:"welcome"`) contra `esPreguntaDeMunicipios()`: dos coincidencias independientes, menciona "municipio(s)" Y lenguaje de cantidad/selección (`cuál(es)`, `cuánto(s)`, `todos`, `todas`, `en particular`, `algunos`). `limiteTerritoriosLote` (`tools.ts`) solo honra `confirmadoLote:true` si además `ctx.municipiosPreguntadosPrevio` es cierto; si no, cae al conteo normal (3ª sin confirmar bloquea) y deja un `console.warn` no bloqueante (`[fontana] confirmadoLote:true rechazado...`) para medir con qué frecuencia el modelo intenta el atajo. System prompt reforzado en el bloque "Flujo de lote confirmado": el flag nunca vale por haber contestado OTRA pregunta (tipo, formato), y el servidor lo verifica de forma independiente. **Verificación manual de la heurística** (8 casos, incluida la transcripción real que falló): 1 falso negativo encontrado y corregido antes de cerrar la ronda — `cu[aá]les?` no matcheaba el singular "cuál" (le faltaba la rama sin "es"), corregido a `cu[aá]l(es)?`; los 8 casos pasan tras el ajuste, incluida la pregunta real "¿de cuál de los 8 municipios quieres ver la evolución?". `tsc --noEmit` y `next build` limpios. |
| 26-09-03 | Fontana T10 — `distribucion` con territorio explícito + guard multiMunicipio (F1-2/F1-11) | Mismo patrón que `serie_temporal`, extendido a `generar_visualizacion tipo:"distribucion"`. Ruta nueva `GET /api/fontana/distribucion` (F1-2 pirámide / F1-11 urbano-rural — ambos vía `resolverIndicadorIter`, que acepta cualquier `Territorio`): sin `territorio` y proyecto plural municipal → `{ok:false, multiMunicipio:true, municipios:[...]}`; con `territorio` → `resolverTerritorioNombre` + `esTerritorioExterno`/`esTerritorioDelProyecto`. `tools.ts`: `generar_visualizacion` schema gana `territorioNombre`/`estadoNombre` para `distribucion`; F1-2/F1-11 pasan por la ruta nueva (rechazo con instrucción "pregunta a cuál/cuáles municipios, una tarjeta por cada uno, nunca combines"), F1-12/F2-12 siguen por el flujo de familia (rechazan `territorioNombre`). System prompt: bloque de territorio para `distribucion` de F1-2/F1-11. Verificado: proyecto plural → `multiMunicipio` con los 3 municipios; `territorioNombre:"Jalisco"` → pirámide estatal (POBTOT 8,348,151) con `esTerritorioExterno:true`; `territorioNombre:"Zapopan"` (del proyecto) → `esTerritorioDelProyecto:true`; proyecto singular sin cambios; F1-11 "Jalisco" → %urbano 87.95. |
| 26-09-03 | Fontana T10 — fix sistémico de resolución de nombres de municipio (ITER) | **Causa raíz (byte a byte):** `scripts/fontana-iter-pipeline.ts` leía los CSV del ITER (UTF-8) como `latin1` → `NOM_MUN` acentuados quedaban mojibake (`TONALÃ¡`) en `iter_2020/catalogo_municipios/{NN}.json` → todo municipio acentuado fallaba en `resolverMunicipioCveIter` (Tonalá, Tlajomulco de Zúñiga, Juanacatlán, Cuauhtémoc/CDMX, Oaxaca de Juárez…). NO era divergencia de normalización ni fallo de `resolverTerritorioNombre` (ese resuelve bien). **Fix:** (a) módulo puro nuevo `lib/geo/municipioCanonico.ts` (`normalizeGeoName`, `normalizarNombreMunicipio`, `ALIAS_MUNICIPIO`, `claveCanonicaMunicipio` — sin firebase/topojson; `municipios.ts` lo re-exporta, importadores sin cambio); (b) pipeline lee `utf-8` y keyea el catálogo con `claveCanonicaMunicipio` (misma función que el query time — se elimina el `normalizeGeoName` local que podía divergir); (c) `conapo.ts` y `compendio.ts` (otros 2 consumidores del catálogo) alineados a `claveCanonicaMunicipio`; la ruta `familia/[id]/municipios` ya no usaba el catálogo. Bodega **re-subida** con validación round-trip: **INE→catálogo 32/32 estados** (28 al 100%, 4 con municipios creados post-Censo-2020 sin fila ITER, Oaxaca 570/570 con la colisión conocida SAN JUAN/PEDRO MIXTEPEC documentada). Verificado en vivo: Tonalá POBTOT 569,913 · Tlajomulco de Zúñiga 727,750 · Juanacatlán 30,855 · Cuauhtémoc CDMX 545,884 · CONAPO F2-4 Tlajomulco 48.66 · Compendio densidad 1017.52 · 0 llaves con mojibake. **Prompt:** frase colectiva ("los municipios del proyecto") ya NO autoriza al modelo a enumerar y disparar N tarjetas — pregunta primero; solo nombrar municipios explícitos autoriza generación directa. |
| 26-09-09 | Fontana T10 — Reporte de sesión (generar / editar / descargar / entregar) + capa interpretativa a F3 (Opción A) | **Nuevo:** cada sesión de Fontana genera UN reporte de sesión (sobreescribible, editable, autoguardado) que organiza los `canvasItems` fijados. **Modelo de datos:** subcolección `fontana_sesiones/{id}/reporte/actual` (`ReporteSesionFontana` — cuerpo markdown + `secciones.{heredados,libres}` + `canvasItemsRef`) + puntero ligero `FontanaSesion.reporteSesion?` (patrón de `entregaCanal1`; habilita los 3 botones de destino; se invalida con `FieldValue.delete()` al repuntar de tarea PIP + borra el doc de subcolección). **Generación híbrida:** `lib/fontana/reporte/reporteSesionSkeleton.ts` (determinístico — bucketing: un `canvasItem` va COMPLETO a "heredados" si ≥1 de sus indicadores está en la unión de `minimos`, nunca se divide; sesión Canal 1 → sección heredados primero, suelta → una sola sección; reutiliza `canvasItemToMarkdown` + nuevo `canvasItemResumenTextoMd` para los 5 tipos gráficos) + `lib/fontana/reporte/generarReporteSesion.ts` (prosa de `claude-sonnet-4-6` no-streaming sobre el esqueleto, sin inventar cifras; escritura atómica `batch`; lanza `"Canvas vacío"` → 400/rechazo). **Endpoint** `app/api/fontana/sesion/[sesionId]/reporte/route.ts` (GET lee subcolección · POST genera/regenera · PATCH edición manual, no toca `secciones`). **Agente:** tool `generar_reporte_sesion` (sin params) → mismo servicio; evento SSE nuevo `reporte_generado` (`useChatStream` → `FontanaAgentBubble` → `FontanaWorkspace`); system prompt: cuándo llamarla, nunca anuncia el contenido, nunca nombra la herramienta (guard `contieneNombreHerramienta` ya la cubre — `FONTANA_TOOLS.map(t=>t.name)`). **UI:** 3ª pestaña "Reporte" (`FontanaReportePanel.tsx` — visor `react-markdown` + toggle "Editar texto" con `<textarea>` y autoguardado debounce 800 ms, botones separados Editar/Regenerar, aviso pasivo "hay contenido nuevo en el Canvas" comparando `canvasItemsRef`, descarga PDF/DOCX vía `lib/shared/reportExport.ts` `brandLabel:"Fontana"`). **Gate:** `FontanaMain` pasa `reporteListo` → `FontanaCanal1Button` y `FontanaModduloButton` deshabilitan la acción de destino hasta que exista reporte (rama "Regresar a Moddulo F3" intacta). **Entrega a F3 — Opción A:** `subirReporteInterpretativo()` (`exportarContextoTerritorial.ts`) sube el `.md` a Storage con el mismo `request-upload` `formato:"datos"` (verificado: la ruta no valida extensión); `ResultadoCanal1`/`ResultadoFuenteExterna.payload` gana `reporteInterpretativoUrl?: string` (aditivo — ningún lector de `.payload` en el repo); `canal1/entregar` y `canal3/vincular` (vía `VincularFuenteForm` modo Fontana) lo aceptan (best-effort — 404 = se entrega sin la capa). **Aislamiento de M3 por construcción:** `sintesis/generar` serializa el string del path pero nunca lo resuelve — SIN CAMBIOS en M3. **Vista previa en M2** (`F3ResultadosRecibidos.tsx`): bloque colapsable que hace `GET /api/moddulo/f3/resultados/[id]/reporte` (lectura server-side de Storage, ruta nueva) → `MarkdownContent`, con etiqueta "capa adicional, la síntesis M3 usa solo los datos de indicadores". `.md` huérfanos en cada reentrega = comportamiento esperado (documentado, coherente con el JSON de contexto). **Verificación:** `scripts` de scratchpad — bucketing/orden/suelta/canvas-vacío/items-eliminados (18 casos sintéticos) + dry run contra sesión real `vO9JFif6W3UQc7DlyqPq` (Canal 1, Zapopan): esqueleto correcto, Claude preservó 6/6 encabezados y 47/47 filas de tabla sin alterar cifras, prosa con citas `(Fuente: …)`, nada escrito en Firestore. Precisión #1 (guard `AFIRMA_RESULTADO` + gate `toolCallsAcum.length===0` cubre la tool) y #2 (nombre de tool nunca en errores) verificadas. `tsc --noEmit` y `next build` limpios. **Deuda registrada:** la sección "heredados" solo cubre F1/F2 (`pipMinimos` deriva solo esos prefijos) — revisar al cerrar Familia 4/5. **Pendiente de Raúl (navegador):** los 14 escenarios del plan de verificación end-to-end. |
| 26-09-10 | Fontana T10 — Reporte de sesión: Parte B (cubre indicadores de la tabla comparativa, no solo canvasItems) + arquitectura ASÍNCRONA | **Parte B (defecto Oaxaca):** el reporte solo leía `sesion.canvasItems`, así que los indicadores heredados F1 que el usuario vio en la tabla comparativa (proyecto senaduría Oaxaca) no aparecían. Fix: `resolverCeldasIndicadoresSesion.ts` (nuevo, extraído de `contexto/route.ts` que pasa a wrapper delgado) resuelve las celdas de TODOS los indicadores seleccionados (unión `minimos + seleccionUsuario` de F1/F2/F3/F5, F4 fuera) vía fetch a `familia/[id]`; `construirEsqueletoReporte` fusiona ambas fuentes con dedup (un indicador ya cubierto por un `canvasItem` NO se repite como fila cruda de tabla), mismo bucketing heredados/libres (`origen === "canal1" && minimosUnion.has(id)`). **Arquitectura asíncrona (crisis de latencia):** medición real — la sesión Oaxaca de 22 indicadores tarda ~86-101s y el caso extremo de 75 (F1+F2+F3+F5 completos) ~85-104s, dominado por un solo indicador lento (F3-2/SESNSP ~62-81s cold) — sobre el techo de 60s del repo. **Decisión: Vercel-native (sin Cloud Function — `functions/` no puede importar `lib/`, duplicar la ingesta era prohibitivo) + `after()` (Next 16) + `maxDuration: 300` + polling + Opción C.** (1) Job doc `fontana_sesiones/{id}/reporte/job` (id fijo `"job"`, 1:1 con la sesión, cascada de borrado, sin índice compuesto) — `ReporteSesionJob {jobId, status: pending|running|completed|failed, startedAt, completedAt?, error?}`; helpers en `reporteJob.ts` (`crearReporteJob` sobrescribe el doc entero, `marcarReporteJob` merge, `jobEnCurso` con `REPORTE_JOB_STALE_MS = 10min` para un `running` colgado). (2) `POST .../reporte` → auth + pre-check barato `tieneContenido` (400 `sin_contenido`) + idempotencia (`jobEnCurso` → devuelve el job existente, 200) + `crearReporteJob` + `after(() => generarReporteSesion(...))` + `202 {jobId, status}`. (3) `generarReporteSesion` = worker en background que **NUNCA lanza** (try/catch → `marcarReporteJob("failed", error)`): `running` → `resolverCeldasIndicadoresSesion` con `timeoutMs: 90_000` por indicador (en `familia/[id]/route.ts` un `Promise.race` con `Symbol` → 4 celdas `{nivel, motivo: MOTIVO_TIMEOUT_REPORTE}` + salta los bloques de agregación plural; `MOTIVO_TIMEOUT_REPORTE` en `tablaColumnas.ts` es específico de timeout, no se confunde con "sin dato para este territorio") → `construirEsqueletoReporte` → **Opción C**: Claude (`claude-sonnet-4-6`, `max_tokens: 3000`) recibe SOLO `esqueleto.resumenProsa` (resumen compacto por sección, sin tablas) y devuelve SOLO prosa JSON `{lecturaEjecutiva, parrafosPorSeccion}`; `parsearProsa` tolera fences y valida forma (null → fallback = `markdownEsqueleto` determinístico); `ensamblar` intercala cabecera + lectura ejecutiva + por bloque `[## titulo, parrafo, bloque.markdown]` → Claude nunca ve/echa las tablas (garantía estructural de no-alteración de cifras, ~23s vs ~55s) → `batch`: `reporte/actual` + puntero `reporteSesion` + `job` a `completed`. (4) `GET .../reporte/job` (nuevo) → `{status, enCurso, jobId, error, completedAt}` o `{status:"none"}`. (5) `FontanaReportePanel.tsx` reescrito: "Generar"/"Regenerar" → POST → `setInterval` de 4s contra `.../reporte/job` (timeout de cliente 12min); `completed` → `GET .../reporte` (markdown) + `onSesionActualizada`; `failed` → error + "Reintentar"; el reporte anterior sigue visible y editable mientras se regenera; al montar/cambiar de sesión reanuda un job en curso (reload); props nuevas `jobIdInicial`/`onJobIdConsumido` para el job disparado desde el chat. (6) Chat: `generarReporteSesionTool` hace `fetch` POST a la ruta (que tiene su propio `maxDuration: 300` + `after()`, imposible bajo los 60s del SSE de `chat/route.ts`) → devuelve `{ok:true, jobEnCurso:true, instruccion: "EMPEZASTE a generarlo…"}`; evento SSE `reporte_generado` → `reporte_job_iniciado {jobId}` (`useChatStream` → `FontanaAgentBubble` → `FontanaWorkspace` abre la pestaña Reporte + pasa `jobIdInicial`). Guard `AFIRMA_RESULTADO` no se dispara: su compuerta es `toolCallsAcum.length === 0` y la tool SÍ registra un tool call; además la frase correcta ("empecé a generarlo") no es un resultado confirmado falso. System prompt (`generar_reporte_sesion`): la generación es asíncrona, confirma en UNA frase que empezó, nunca "ya está listo". **Verificación (`scripts/verify-fontana-reporte-async.ts`, permanente):** Opción C — `ensamblar` conserva íntegro el markdown de cada bloque (valores 31.7 / motivo de timeout intactos), 2 títulos `##` exactos, fallback con prosa null === `markdownEsqueleto`; `parsearProsa` — fences y formas inválidas; `jobEnCurso` — pending/running-fresco → en curso, running-colgado/completed/failed/null → no (base de la idempotencia; el doc de id fijo `"job"` hace imposible 2 jobs por sesión); `MOTIVO_TIMEOUT_REPORTE` honesto y distinguible de `MOTIVO_NIVEL_NO_CUBIERTO`. `tsc --noEmit` y `next build` limpios. `firestore.rules` sin cambios (la subcolección `reporte` no es accesible desde el cliente, igual que `mensajes`/`adjuntos` — todo por Admin SDK). **Deuda registrada:** sin aviso de finalización cuando el reporte se genera desde el chat y el usuario no está en la pestaña Reporte. **Pendiente de Raúl (navegador):** sesión Oaxaca real (22 ind.) — medir el tiempo de `completed`; caso extremo 75 ind. + canvasItems variados — medir el número exacto; timeout forzado por indicador con el `motivo` honesto; dos clics rápidos → un solo job; flujo por chat completo con `AFIRMA_RESULTADO` sin dispararse; entrega a F3 tras un reporte async sin cambios de comportamiento. |
| 26-09-10 | Fontana T10 — Reporte de sesión, Parte A: 6 ajustes post-verificación en navegador | **1:** pestaña "Fontana" → **"Canvas - Fontana"** (`FontanaWorkspace.tsx`; `id` interno sigue `"fontana"`). Convención documentada en `CLAUDE.md` (`## Nomenclatura — pestaña de lienzo/Canvas de apps del ecosistema`) para apps futuras (ej. `Canvas - Sefix-AI`). **2:** encabezado del reporte reestructurado en `reporteSesionSkeleton.ts` — línea 1 `# Reporte de sesión — {nombreProyecto}` (Canal 1: nombre del proyecto Moddulo, resuelto en `generarReporteSesion` vía `getProject`; sesión suelta: `sesion.nombre` → territorio, sin placeholder), línea 3 `**Territorio:** {territorio del usuario}`, línea 5 `Generado el {fecha}.`. System prompt del redactor: conserva esas 3 líneas literales además de los encabezados. **3:** el botón del toggle de edición pasa de "Vista previa" a **"Guardar cambios"** en modo edición — ahora hace flush inmediato del `<textarea>` (`flushGuardado`: clear debounce + PATCH ya) antes de volver a solo-lectura; en modo lectura sigue diciendo "Editar texto". Refactor: `guardarContenido()` compartido por el debounce y el flush. **4:** `InfoTooltip` (`app/components/ui/InfoTooltip.tsx`, el componente ya usado en PESTEL/TerritorySelector) junto a "Regenerar" — explica cuándo usarlo (incorporar indicadores nuevos del Canvas, reconstruye el reporte completo). **5:** "Editar texto"/"Guardar cambios" y "Regenerar" pasan a botón outline azul (`BTN_OUTLINE` con los tokens `border-bluegreen-eske-60 dark:border-blue-eske-20` del `btnBase` ya existente en `investigacion/page.tsx`); "Descargar" se queda sólido. **6:** función nueva "Eliminar reporte" (botón de texto rojo bajo el reporte + modal de confirmación espejo del de `FontanaCanvasItemCard`/`SesionCard` — no hay componente de confirmación compartido en el repo) → `DELETE /api/fontana/sesion/[id]/reporte` → helper compartido nuevo `lib/fontana/reporte/invalidarReporteSesion.ts` (borra el puntero `reporteSesion` + el doc `reporte/actual`) que TAMBIÉN reemplaza la lógica inline duplicada del repunte de tarea PIP en `sesion/route.ts`. NO toca Storage: un `.md` ya entregado a Moddulo es artefacto histórico de esa entrega (mismo criterio que los huérfanos de reentrega). Tras eliminar: pestaña vuelve al estado vacío, los 3 botones de destino se re-deshabilitan. **Verificación:** script sintético (`verify-parte-a.ts`, scratchpad) — encabezado con estructura y orden exactos en Canal 1 / suelta sin nombre / suelta con `sesion.nombre`, sin placeholder; regresión de bucketing/secciones OK. Dry run contra sesión real `vO9JFif6W3UQc7DlyqPq` (nombre de proyecto "Campaña de comunicación Vialidad ZMG" resuelto): Claude conservó las 3 líneas del encabezado + 6 encabezados + 47/47 filas de tabla, nada escrito en Firestore. `tsc --noEmit` y `next build` limpios. **Pendiente de Raúl (navegador):** renombrado visible; encabezado con datos reales; "Guardar cambios" persiste antes de salir de edición; tooltip visible; estilos de botón claro/oscuro; eliminar → confirmar → estado vacío + destinos deshabilitados. |
| 26-09-11 | Fontana T10 — "Notas metodológicas": documento (Fases 1-3) + implementación en la interfaz (Fase 4), primer patrón reutilizable del ecosistema | **Documento** (`docs/ecosistema/T10-fontana/Fontana_T10_Notas_Metodologicas.md`, de cara al usuario final, editado a mano por Raúl — no generado por IA ni por datos en tiempo real): auditoría de Fase 1 con 3 agentes Explore (docs/`_docs/`; adaptadores `lib/fontana/ingesta/` + system prompt; registry de 86 indicadores + series + Reporte de Sesión) — hallazgo clave: el "prontuario de naturaleza de dato" que la documentación técnica prometía (`Fontana_T10_Arquitectura_Paso3_v2.md:161`) nunca se escribió, se redactó desde cero en Fase 3. Investigación adicional (a petición de Raúl, antes de Fase 2): F5-15/16/17 (PIB municipal, PIB turístico, rezago de vivienda) citan "INECC/ANVCC" como fuente — verificado en vivo (`anvcc.ts:1-20`, columnas reales `pib_mun`/`pib_turistico_mun`/`con_rezago` del mismo WFS de vulnerabilidad climática) que la cita es correcta pero incompleta: son cifras que el INECC COMPILÓ como insumo de su propio índice (capacidad económica/vivienda como variables de "capacidad adaptativa"), no estadística oficial de INEGI/CONAVI-SHF — el documento usa la fórmula "compilado por el INECC… usando como insumo cifras que originalmente produce [INEGI/CONAVI-SHF]" en vez de citar la fuente sin ese matiz; caso usado como ejemplo real del prontuario. Estructura de Fase 2: esquema de 7 bloques + Encabezado + Historial de cambios, con el catálogo de 86 indicadores movido del cuerpo a un Apéndice (no rompe la lectura corrida). Contenido final con Apéndice completo (86/86 filas, sin resumir) + sección 2.4 Siglas (exhaustiva, con `[verificar]` explícito en los términos sin fuente cierta confirmada en el código — mismo criterio que el prontuario; ICMM y SIC sí verificados contra `icmm.ts:2`/`sic.ts:119`). **Fase 4 — arquitectura (investigación con 3 agentes Explore, aprobada):** (A) Almacenamiento = Markdown en el repo, NO Firestore — no hay precedente de leer `.md` en runtime en `app/`, pero tampoco existe una colección de "documentos de referencia" (el blog guarda `content` como string editable vía panel admin, pensado para posts cortos, no para este caso); para contenido de edición manual e infrecuente, git ya resuelve versionado/historial sin nueva superficie de datos ni reglas — decisión que sienta precedente para Sefix-AI y futuras apps. (B-D) Componente compartido nuevo `app/components/shared/MethodologyDoc/MethodologyDocView.tsx` (Client Component, props `{markdown, brandLabel, baseName}`) reutiliza 2 patrones ya existentes en vez de construir desde cero: el índice sticky+mobile de `app/components/legal/TableOfContents.tsx` (sin moverlo de carpeta esta ronda) y la extracción de headings por regex+slugify de `lib/posts.ts:181-207` — **extraída a `lib/shared/extractHeadings.ts`** (nueva fuente única; `lib/posts.ts` pasa a re-exportarla, mismo comportamiento, blog sin regresión). Los headings `h2`/`h3` del render (`react-markdown`+`remark-gfm`) calculan su `id` con el mismo `slugifyHeading` que el extractor — anclas e índice siempre coinciden, sin instalar `rehype-slug` (no estaba en el repo). Botón "Descargar PDF" llama `exportToPdf(markdown, baseName, "notas-metodologicas", "Notas metodológicas", brandLabel)` (`lib/shared/reportExport.ts`) sin depender de sesión/territorio — confirmado que ningún consumidor existente (`FontanaCanvasItemCard`, `PhaseDownloadMenu` de Moddulo) lo requiere en la firma. Página nueva `app/centinela/fontana/notas-metodologicas/page.tsx` (Server Component): solo `fs.readFileSync` del `.md` + `&lt;MethodologyDocView brandLabel="Fontana" baseName="Notas-metodologicas-Fontana" /&gt;` — el patrón completo para una futura app (Sefix-AI) es copiar esas 3 líneas con su propio `.md`, sin tocar el componente compartido. (E) 2 enlaces "Notas metodológicas": `ChatPanel.tsx` (`app/components/shared/chat/`, compartido por ubicación aunque hoy de uso único) gana prop opcional `secondaryLink?: {label, href}`, renderizada en la misma línea del subtítulo separada por "—" (`"Asistente de datos abiertos — Notas metodológicas"`, `target="_blank"` para no perder el chat abierto) — `FontanaAgentBubble.tsx` la pasa; `FontanaMain.tsx` gana un `&lt;Link&gt;` en la misma línea del breadcrumb `← Fontana` (separado, sin desplazar título/territorio/botón de acción) — ubicación resuelta con criterio propio dentro de lo aprobado, sin patrón exacto previo en ese componente. (F) Firestore sin cambios. **Verificación con evidencia real:** extracción de headings sobre el `.md` real → 20 items de índice (H2/H3), 0 IDs duplicados, Apéndice 86/86 filas de indicador intactas (confirmado tras la edición de Raúl sobre el borrador de Fase 3). `tsc --noEmit` y `next build` limpios — la ruta `/centinela/fontana/notas-metodologicas` sale prerenderizada como estática (○) en el build, confirmando que el Server Component lee el archivo real sin error. **Pendiente de Raúl (navegador):** los 2 enlaces visibles en los 3 estados del header de `FontanaMain` (Canal 1 / Moddulo vinculado / independiente); la página con navegación por anclas real (click en el índice); "Descargar PDF" con el Apéndice completo en el PDF resultante; claro/oscuro. |
| 26-09-11 | Fontana T10 — encuadre de interpretación por tipo de proyecto (corrige el sesgo electoral por defecto) en el chat y en el Reporte de Sesión | **Contexto:** hipótesis de Raúl a verificar — el agente tiende a enmarcar hallazgos en términos electorales ("contingente electoral", "votantes") incluso en proyectos no electorales, probablemente porque casi todas las pruebas reales fueron proyectos electorales. **Investigación (3 agentes Explore, sin implementar hasta aprobación):** (1) `sesion.tipoProyecto` SÍ llega hasta el agente conversacional — se interpola en `systemPrompt.ts:60` (`bloqueTerritorio`) desde `construirSystemPromptFontana(territorio, tipoProyecto)` (`chat/route.ts:237`); también viaja al `ToolContext` sin consumidor hoy. `pipMinimos.ts` es intencionalmente agnóstico al tipo de proyecto (deriva de texto del PIP, no de una tabla por tipo — documentado en su propia cabecera). (2) Auditoría completa de `systemPrompt.ts` (356 líneas): el sesgo es puntual, no sistémico — 1 ejemplo central (línea 343, "un electorado con presencia significativa de comunidades originarias" en la plantilla obligatoria "Formato de cada respuesta con datos", aplicable a las 5 familias sin distinción de tipo) + 3 menciones secundarias de "comunicación política"/"equipos políticos" sin rama condicional (líneas 75, 306, 352) — el dato se declaraba al modelo pero ninguna instrucción lo usaba para adaptar tono. (3) `generarReporteSesion.ts` (Reporte de Sesión, superficie separada): mismo tipo de sesgo en `SYSTEM_PROSA` línea 39 ("un proyecto político" genérico) — pero además **nunca recibía `sesion.tipoProyecto`** (0 ocurrencias confirmadas por grep en `generarReporteSesion.ts`/`reporteSesionSkeleton.ts`/`canvasExport.ts`), a diferencia del chat. **Decisión de Raúl:** corregir AMBAS superficies (dejar el reporte sin corregir crearía inconsistencia real dentro del mismo producto). **Texto de las 4 variantes aprobado tras 2 ajustes de Raúl** (legislativo gana "representación de intereses territoriales" en el encuadre general; el ejemplo de legislativo pierde el calificativo "culturales" — reducir la atención legislativa a lo indígena solo a lo cultural es impreciso, hay derechos territoriales/laborales/de acceso a servicios también) + precisión de diseño: el encuadre es un punto de partida para priorizar, nunca una restricción de contenido. **Implementación:** `lib/fontana/agente/systemPrompt.ts` gana 3 constantes exportadas — `ENCUADRE_POR_TIPO` (electoral: "comunicación de campaña y segmentación de voto"; gubernamental: "planeación presupuestal y priorización de política pública"; legislativo: "agenda legislativa, representación de intereses territoriales y argumentación de iniciativas"; ciudadano: "organización comunitaria e incidencia pública"), `EJEMPLO_POBLACION_INDIGENA_POR_TIPO` (4 variantes del ejemplo de la línea 343, mismo dato F1-3 para comparar el cambio de encuadre) y `ENCUADRE_INSTRUCCION` ("Este encuadre es tu punto de partida para priorizar qué destacar primero según el tipo de proyecto — no una limitación de contenido. Si un dato tiene implicaciones relevantes fuera de ese encuadre, inclúyelas también.") — interpoladas en las líneas 75 (neutralizada, ya no dice "equipos políticos"), 306, 343 y 352. `lib/fontana/reporte/generarReporteSesion.ts`: `SYSTEM_PROSA` (const) pasa a `construirSystemProsa(tipoProyecto)` (función), **reutilizando el mismo `ENCUADRE_POR_TIPO`/`ENCUADRE_INSTRUCCION` importados de `systemPrompt.ts`** (sin redacción paralela que mantener sincronizada) — llamada en el sitio real con `sesion.tipoProyecto` (ya estaba en scope, sin necesidad de tocar `construirEsqueletoReporte`/`reporteSesionSkeleton.ts`). **Verificación con evidencia real (`scripts/verify-fontana-reporte-async.ts`, sección 5, permanente):** estático — los 4 prompts del chat y las 4 variantes de `SYSTEM_PROSA` contienen su propio encuadre/ejemplo/instrucción y NO contienen el de ningún otro tipo (0 contaminación cruzada, 29 checks); ninguno dice ya "proyecto político"/"un electorado…" genérico. **En vivo (Claude real, 4 llamadas)** con el mismo indicador sintético (F1-3, 12.4% municipal / 65.7% estatal / 19.4% nacional) para los 4 tipos de proyecto en el chat: cada respuesta real usa el vocabulario de su propio encuadre (electoral → "campaña"/"electorado"; gubernamental → "servicios"/"planeación"; legislativo → "legislativ"/"representa"/"iniciativa"/"derecho"; ciudadano → "comunitari"/"incidencia"/"organización"), sin que ninguna use el vocabulario de otro tipo como dominante; **2 de las 4 respuestas reales (legislativo, ciudadano) mencionan espontáneamente una implicación fuera de su encuadre principal** (ej. legislativo menciona "acceso a servicios"; ciudadano menciona "representación"/"participación política"), confirmando que la instrucción "no es una limitación" tiene efecto real, no es texto muerto. Reporte de Sesión: 2 llamadas reales (gubernamental y electoral, mismo dato sintético) con `construirSystemProsa` → gubernamental usa "planeación presupuestal" y ya NO dice "proyecto político"; **electoral (regresión) sigue leyendo con el mismo encuadre de antes** — "segmentación del electorado", "mensajes de campaña", "electorado predominantemente urbano" — confirmando que el tipo que sí tenía el encuadre correcto no se degradó al hacerlo explícito. `tsc --noEmit` y `next build` limpios. **Pendiente de Raúl (navegador):** generar el Reporte de Sesión completo end-to-end (no solo la llamada de prosa aislada) para al menos un proyecto real de cada tipo, y los 4 tipos en el chat con una pregunta real del usuario (esta ronda se verificó con un indicador y una pregunta sintéticos). |
| 26-09-11 | Fontana T10 — fix: columna "Distrital" ausente en la tabla comparativa para proyectos no-electorales a nivel distrito_federal/distrito_local | **Bug reportado por Raúl** (3 capturas): proyecto tipo "Legislativo" a nivel "Distrito electoral federal" (Yucatán › PROGRESO) sin columna "Distrital" en la tabla, mientras un proyecto de control ("Diputado Local 27 CDMX") sí la mostraba. Hipótesis de Raúl a verificar: diferencia `distrito_federal` vs. `distrito_local`. **Investigación (2 agentes Explore en paralelo) — hipótesis REFUTADA:** el código trata ambos niveles de forma idéntica en todos los puntos revisados (`systemPrompt.ts`, ~13 adaptadores de `lib/fontana/ingesta/`, `tools.ts`, `FontanaComparativeTable.tsx`). **Causa raíz real, en `lib/fontana/tablaColumnas.ts:44-48` (`columnasParaTipoProyecto`):** la columna `"distrital"` solo entraba al set base cuando `tipo === "electoral"` — asimetría entre el caso DIRECTO (mi territorio propio ES un distrito) y el caso INVERSO ya resuelto para cualquier tipo desde 2026-08-05 (mi territorio es municipal/nacional y quiero ver el desglose de los distritos que contiene). Confirmado en Firestore (`fontana_sesiones`, 13 docs): Proyecto A real = `tipoProyecto:"legislativo"`, `territorio.nivel:"distrito_federal"` (Yucatán PROGRESO, sesión `m4qUAXZpDXQfBEYzpCz6`); Proyecto B de control = `tipoProyecto:"electoral"`, `territorio.nivel:"distrito_local"` (sesión `1qEjTadeNVliXafJtnBH`) — la diferencia observada era coincidencia de tipo, no de federal-vs-local. **Alcance confirmado:** un solo punto de fix cubre tabla, chat y Reporte de Sesión — los 3 consumen `columnas` desde la MISMA llamada a `columnasParaTipoProyecto` dentro de `app/api/fontana/familia/[familiaId]/route.ts:231` (`consultar_indicador` del chat y `resolverCeldasIndicadoresSesion.ts` del reporte hacen fetch a ese mismo endpoint, sin ruta paralela). **Fix (aprobado por Raúl):** `esDistritoPropio = territorioNivel === "distrito_federal" || "distrito_local" || "distrito"` (legado); `base = tipo === "electoral" || esDistritoPropio ? COLUMNAS_ELECTORAL : COLUMNAS_NO_ELECTORAL` — mismo criterio que ya aplica a "municipal"/"estatal" (siempre visibles para el proyecto que ES ese territorio, sin importar tipo). **Verificación con evidencia real:** (1) `columnasParaTipoProyecto` con los 2 proyectos reales + 6 casos de regresión (gubernamental/ciudadano a nivel distrito, casos inversos municipal/nacional para legislativo/electoral, estatal sin cambio) — todos correctos, sin regresión en el caso inverso. (2) `resolverIndicadorFontana("F1-1", territorio real de la sesión m4qUAXZpDXQfBEYzpCz6)` → celda `distrital` con valor REAL (386,061 habitantes, `coberturaPct:98.4`, INEGI Censo 2020 vía ECEG) — confirma que no es una columna vacía, el resolver de datos (`conCeldaDistritalPropia`, `lib/fontana/ingesta/index.ts`) ya calculaba este valor para cualquier tipo de proyecto; solo el filtro de columnas lo ocultaba. (3) Sin backfill necesario — `columnasParaTipoProyecto` tiene un único call site (`familia/[familiaId]/route.ts:231`) y se re-evalúa en cada request, nada persistido en Firestore depende del set de columnas. `tsc --noEmit` y `next build` limpios. **Pendiente de Raúl (navegador):** proyecto real de Yucatán (Legislativo, distrito federal) → columna Distrital visible con dato real; proyecto de control (electoral, distrito local) sin cambio; chat conversacional y Reporte de Sesión del proyecto de Yucatán reflejan el nivel distrital. |
| 26-09-12 | Fontana T10 — 5 ajustes independientes de UI/contenido | Investigación previa con 3 agentes Explore en paralelo (modales de listado/buscador + kebab ya existente en `FontanaCanvasItemCard.tsx` + precedente de CSV en `app/api/sefix/historico-tabla/route.ts`; selector de color hexadecimal de PESTEL `WizardStep1Tipo.tsx`; header de botones de destino + estado vacío de Reporte) + 1 agente Plan que compiló el diseño. **1 — kebab con CSV en modales de listado:** único archivo con el patrón, `FontanaMunicipiosModal.tsx` (router a 4 componentes internos `ModalDistrito`/`ModalEstado`/`ModalMunicipio`/`ModalSeleccion`) — helper `descargarCsv`/`nombreArchivoCsv` local al archivo (primer export CSV de Fontana, sin helper genérico previo en el repo — client-side puro, `Blob`+`URL.createObjectURL`+`<a download>`, con BOM para acentos en Excel) + componente `KebabDescargarCsv` (mismo patrón hand-rolled de `FontanaCanvasItemCard.tsx`, sin librería) añadido junto al input de búsqueda (envuelto en `flex items-center gap-2`, input a `flex-1 min-w-0`) en los 4 modales; en `ModalEstado` modo buscador, las filas sin valor cargado exportan "No cargado" en vez de un valor inventado. El botón "✕" de cerrar no se tocó (vive en una fila de header separada en los 4). **2 — párrafo de feedback + mailto en Notas Metodológicas:** insertado verbatim en `Fontana_T10_Notas_Metodologicas.md` (después del párrafo intro, antes del primer `---`), correo como link markdown explícito `[centinela@eskemma.com](mailto:centinela@eskemma.com)` — sin cambios en `MethodologyDocView.tsx` (confirmado que su `components` de `react-markdown` no sobreescribe `a`, el renderer default ya maneja `mailto:`). **3 — selector de color hexadecimal:** replicado el patrón exacto de `WizardStep1Tipo.tsx` de PESTEL (swatch "+" punteado → dispara `<input type="color" className="sr-only">` oculto, diálogo nativo del SO, sin librería — + campo de texto hex validado `/^#[0-9A-Fa-f]{6}$/` + preview) inline en los 2 call sites de Fontana (`app/centinela/fontana/page.tsx` creación, `FontanaSesionesHub.tsx` edición) — sin extraer a componente compartido (ni PESTEL lo tiene extraído hoy, y los 2 call sites usan tamaños de swatch distintos, `w-8 h-8` vs `w-7 h-7` — YAGNI). Los 7 swatches originales y el color por defecto (`COLOR_SWATCHES[1]` = `"#248CC1"`) intactos. **4 — rebalanceo del header de botones de destino:** en `FontanaModduloButton.tsx` (escenario independiente, 2 botones) y `FontanaCanal1Button.tsx` (escenario vinculado, rama "aún no entregado" — la rama "ya entregado" con sus 2 botones queda explícitamente fuera de alcance, no está gateada por `reporteListo` y no corresponde a ninguno de los 2 escenarios pedidos). Texto explicativo reordenado ARRIBA de los botones (antes iba debajo/al final) y reescrito ("...para habilitar las siguientes opciones:" / "...para habilitar la entrega:"); decidido con Raúl que el estado `reporteListo` no muestra ningún texto (mismo criterio que ya aplicaba). El botón "Vincular a proyecto existente" pasa de link subrayado a pastilla con borde (reusa el estilo ya existente de "Regresar a Moddulo F3", `border-white/30 text-white hover:bg-white/10`) — ambos botones ahora `flex-1 min-w-0` en una fila `flex`, tamaño reducido (`text-xs px-3 py-1.5`) y `whitespace-normal leading-tight` para que el texto se envuelva a 2 líneas en vez de que los botones se apilen entre sí en mobile. **5 — texto del estado vacío de Reporte:** el único párrafo estático de `FontanaReportePanel.tsx` (no condicional a canal1/independiente) se reemplaza por los 2 párrafos nuevos de Raúl (su propia prosa ya cubre ambas ramas, sin lógica condicional nueva) — mismo `className`, el `gap-4` del contenedor da el espaciado. `tsc --noEmit` y `next build` limpios para los 5 puntos. **Verificación en navegador — NO realizada esta ronda:** los 5 puntos viven en superficies que requieren sesión autenticada de Firebase (excepto el punto 2, página pública) o son de UX/legibilidad (ajuste de mobile del punto 4) — no se abrió el dev server para esto por instrucción vigente de no dejarlo corriendo en background; queda pendiente que Raúl lo verifique en su propio navegador, con especial atención en el punto 4 a que el texto de ambos botones sea legible en mobile aunque se envuelva a 2 líneas (no solo que técnicamente quepan). **Pendiente de Raúl (navegador):** los 5 puntos — capturas reales en mobile (~360-390px) y desktop del punto 4 en ambos escenarios (independiente/vinculado, con y sin reporte listo); descarga de CSV real desde al menos 2 modales distintos; clic en el mailto; selector hex en ambos formularios; texto nuevo de la pestaña Reporte vacía. |
| 26-09-12 | Fontana T10 — 5 hallazgos de verificación de la ronda de UI anterior | **1 — hex siempre en mayúsculas:** el barrido encontró 5 puntos reales con el patrón de picker hexadecimal (no solo los 3 mencionados) — Fontana (`page.tsx`, `FontanaSesionesHub.tsx`), PESTEL (`WizardStep1Tipo.tsx`, `ConfigEditModal.tsx` — este último solo con `<input type="color">` nativo, sin swatches) y Moddulo (`proyecto/nuevo/page.tsx`, mismo patrón swatches+hex personalizado que Fontana/PESTEL — confirma la sospecha de Raúl). `.toUpperCase()` agregado en el punto donde se valida/guarda cada valor (regex existente + el handler del `<input type="color">` nativo, que el navegador siempre devuelve en minúsculas) — persistido en mayúsculas, no solo mostrado así. **2 — contraste sobre fondo amarillo (F5):** 2 bugs reales de texto blanco fijo (`color:"#fff"`/`className="text-white"`) sobre un color de fondo INLINE (no un token del design system) — `FontanaIndicadoresAccordion.tsx` (chip de familia activo + badge circular "5") y `FontanaCanvasItemCard.tsx` (badge circular de familia en las tarjetas del Canvas). Fix: helper `esColorClaro(hex)` (duplicado en los 2 archivos — mismo criterio ya usado en Sefix, `PartidosBarChart.tsx`/`PartidosBarChartLoc.tsx`, fórmula de luminancia YIQ) decide `#2b2b2b` (= `text-black-eske`) vs `#ffffff` según el color de fondo real de cada familia — F5 (`#FFD14A`) ahora legible en ambos temas, las otras 4 familias (más oscuras) sin cambio visual. **3 — Notas metodológicas siempre en pestaña nueva:** el enlace del chat ya tenía `target="_blank"`; el de `FontanaMain.tsx` (pantalla principal) no — agregado `target="_blank" rel="noopener noreferrer"`, mismo comportamiento en los 2 puntos de acceso. **4 — contraste del kebab en modo claro:** `KebabDescargarCsv` (componente compartido por los 4 modales de listado, ronda anterior) usaba `text-gray-eske-40` — cambiado a los MISMOS tokens que ya usa la "✕" de cerrar del mismo modal (`text-black-eske-80 dark:text-[#9AAEBE]`, mismo hover `hover:bg-gray-eske-10 dark:hover:bg-white/5`) — un solo punto de fix cubre los 4 modales. **5 — "Actualizando…" en red-eske + modal de resultado:** texto envuelto en `<span className="text-red-eske">` (mismo patrón ya usado para "Cargando…" en `FontanaMunicipiosModal.tsx`). Modal de resultado: **barrido de los ~35 componentes `role="dialog"` del sitio confirma que NO existe un modal de notificación/resultado genérico y reutilizable** — cada modal existente (`RegistrationSuccessModal.tsx`, `SuscriptionResponseModal.tsx`, `BackPropagationModal` de Moddulo, etc.) es de contenido bespoke por flujo, sin abstracción compartida; se construyó un modal nuevo en `FontanaCanal1Button.tsx` (mismo esqueleto visual ya usado en los modales de Fontana — `fixed inset-0` + backdrop + panel `rounded-xl` — para consistencia dentro del módulo, no un componente nuevo inventado sin precedente de forma), disparado SOLO en la rama "Actualizar entrega" (no en la primera entrega, que ya tiene feedback suficiente con la transición de UI) — éxito en `green-eske`, error en `red-eske`. `tsc --noEmit` y `next build` limpios para los 5 puntos. **Verificación en navegador — NO realizada esta ronda** (mismo motivo que la ronda anterior: superficies autenticadas + no dejar `npm run dev` en background). **Pendiente de Raúl (navegador):** hex en mayúsculas en los 5 puntos (incluido tras recargar, confirmando que persiste así en Firestore); familia 5 legible en claro/oscuro (chip del acordeón + badge de tarjetas de Canvas); enlace de Notas metodológicas desde la pantalla principal abre en pestaña nueva; kebab visible en modo claro en al menos 2 modales; "Actualizando…" en rojo + modal de resultado tras actualizar una entrega ya existente (éxito y, si es posible forzar, error). |
| 26-09-12 | Fontana T10 — 2 ajustes post-verificación: recuadro del párrafo de feedback + contraste del kebab en los 3 hubs | **1 — recuadro para el párrafo de feedback:** el párrafo de `Fontana_T10_Notas_Metodologicas.md` pasa de párrafo plano a blockquote markdown (`>`) — `MethodologyDocView.tsx` gana un override `blockquote` (antes sin estilo, el navegador lo rendeaba sin marco) con borde ligero pero visible (`border-gray-eske-30 dark:border-white/15`) + tinte de fondo sutil (`bg-gray-eske-10/40 dark:bg-white/5`) — cualquier `>` futuro del documento queda destacado igual, sin marcado especial adicional por caso. **2 — contraste del kebab en los 3 hubs:** el barrido (grep del SVG de 3 puntos en todo `app/`) encontró que el mismo `text-gray-eske-40` (tono demasiado tenue en modo claro, ya corregido en los modales de listado de Fontana en la ronda anterior) seguía en 4 instancias más: `FontanaSesionesHub.tsx` (2 — sesión suelta y sesión vinculada), `app/centinela/pestel/page.tsx` (hub de PESTEL) y `app/moddulo/page.tsx` (hub de Moddulo) — las 4 cambiadas a los mismos tokens ya usados por el botón "✕"/cierre en cada superficie (`text-black-eske-80 dark:text-[#9AAEBE]`, hover `hover:bg-gray-eske-10 dark:hover:bg-white/5`). **Hallazgo relacionado, NO corregido (fuera del alcance pedido — solo los 3 hubs):** el mismo `text-gray-eske-40` aparece también en el kebab de análisis PESTEL dentro de `app/moddulo/proyecto/[projectId]/exploracion/page.tsx` (F2 de Moddulo, no una card de hub) — reportado para que Raúl decida si también se corrige. `tsc --noEmit` y `next build` limpios. **Pendiente de Raúl (navegador):** recuadro visible en Notas metodológicas (claro/oscuro); kebab visible en modo claro en al menos una card de cada uno de los 3 hubs (Fontana, Moddulo, PESTEL). |
| 26-09-12 | Ecosistema — homologación del selector de color hexadecimal (crear Y editar, Fontana/Moddulo/PESTEL) | **Contexto:** Raúl reportó que Moddulo "Editar proyecto" no tenía el selector hexadecimal (solo 7 swatches), a diferencia de "Nuevo proyecto" que sí. Auditoría real (agente Explore, grep de `type="color"` + arrays de 7 swatches en todo el repo) confirmó **7 puntos totales**, no solo el de Moddulo: 4 ya tenían el picker completo (Fontana crear/editar, PESTEL `WizardStep1Tipo.tsx` reusado por crear Y editar) y **3 con el gap** — `app/moddulo/page.tsx` (`ProjectCard`, editar, solo swatches), `app/centinela/pestel/page.tsx` (`ProjectCard`, editar, solo swatches) y `app/components/centinela/pestel/ConfigEditModal.tsx` (editar, SOLO input nativo — ni swatches ni campo de texto hex). **Fix:** los 3 ganan el mismo mecanismo ya establecido (swatch "+" punteado → dispara `<input type="color" className="sr-only">` oculto, diálogo nativo del SO + campo de texto hex validado `/^#[0-9A-Fa-f]{6}$/`, ambos con `.toUpperCase()`) — en `ConfigEditModal.tsx` se añadió también el array `COLOR_SWATCHES` (antes no tenía swatches en absoluto) y se comparó `color.toLowerCase() === hex` para resaltar el swatch activo sin importar el case del valor cargado de Firestore. Confirmado que `ModduloProject`/`PESTELProject`/`FontanaSesion` comparten el mismo shape `color?: string` — sin cambios de tipo en ningún lado. `tsc --noEmit` y `next build` limpios. **Pendiente de Raúl (navegador):** los 3 puntos — "Editar proyecto" en el hub de Moddulo, "Editar" en el hub de PESTEL, y la ruta "Datos del proyecto" (Ruta A) de `ConfigEditModal.tsx` — todos con el selector completo (7 swatches + "+" + hex), guardando y persistiendo el color personalizado. |
| 26-09-12 | PESTEL — contraste de las etiquetas en las cards de proyectos archivados (modo oscuro) | **Causa raíz:** las 2 etiquetas de la card archivada ("Etapa N — ..." y "Archivado", `app/centinela/pestel/page.tsx`) usaban `text-gray-eske-50` — token que **no existe** en el design system (sin `--color-gray-eske-50` en `globals.css`, confirmado por grep) — la clase era un no-op silencioso; el texto heredaba el color de un ancestro y, en modo oscuro, ese heredado resultaba casi del mismo tono que el fondo `bg-gray-eske-20` (claro, sin variante `dark:`), volviéndose casi invisible sobre la card oscura. Fix: `bg-gray-eske-20 text-black-eske-20 dark:bg-white/10 dark:text-[#9AAEBE]` en los 2 puntos (constante `PESTEL_STATUS_COLORS.archived` + el ternario inline de la etiqueta "Etapa"). **Hallazgo relacionado, NO corregido (mismo bug, fuera del hub reportado):** `app/moddulo/page.tsx:133` (`STATUS_COLORS.archived`) tiene EXACTAMENTE el mismo `text-gray-eske-50` inválido — Raúl solo reportó PESTEL; se deja para que decida si también se corrige en el hub de Moddulo. `tsc --noEmit` y `next build` limpios. **Pendiente de Raúl (navegador):** card de un proyecto archivado de PESTEL en modo oscuro — ambas etiquetas ("Etapa N — ..." y "Archivado") legibles con buen contraste; modo claro sin cambio visual. |
| 26-09-12 | Moddulo — mismo fix de contraste en el badge "Archivado" del hub + auditoría de Fontana | Aplicado el mismo fix que en PESTEL (`STATUS_COLORS.archived` en `app/moddulo/page.tsx:133`): `text-gray-eske-50` (token inexistente, no-op) → `bg-gray-eske-20 text-black-eske-20 dark:bg-white/10 dark:text-[#9AAEBE]`. Sin otro badge "Archivado" independiente en Moddulo (a diferencia de PESTEL, que además tenía un ternario inline duplicado para la etiqueta de etapa) — un solo punto de fix cubre el hub completo. **Auditoría del hub de Fontana (`FontanaSesionesHub.tsx`):** sin el bug — no usa `text-gray-eske-50` en ningún punto (solo `-60`/`-70`/`-80`, todos tokens válidos) y las sesiones archivadas no tienen un badge de color propio (reusan `SesionCard` tal cual, solo agrupadas bajo el heading "Archivadas") — nada que corregir. Regla general documentada en `CLAUDE.md` (`## Estilos y Design System`) para que futuras apps del ecosistema (Sefix-AI, etc.) no repitan ni el token inexistente (`-50` no existe en ninguna escala de color) ni el patrón de fondo-claro-fijo sin variante `dark:` en badges de estado. `tsc --noEmit` y `next build` limpios. |
| 26-09-13 | Integración PESTEL↔Fontana — Económico/Social/Ecológico, ambas vías (Express + Controlada) | **Contexto:** auditoría previa (Bloque A) confirmó que PESTEL citaba CONEVAL/CONAPO/SESNSP/ENVIPE/ENSU como metadata (`presets.ts`, campo `dataSource`) sin consumirlos jamás — y para INEGI, su única fuente real, tenía cobertura muy inferior a Fontana (3 series de población + 3 IDs rotos vs. 14 indicadores curados de ECEG). Decisión de Raúl: PESTEL consume Fontana para esos 3 factores; Político/Tecnológico/Legal quedan fuera (vacíos reales de Fontana, sin cambio). **Diseño clave:** NO se construye un generador de prosa nuevo en Fontana — se inyectan bloques de datos estructurados (con instrucción explícita de no-promediar cuando el `tipoCalculo` es `no_agregable`/`narrativo_sintetizado`) en la MISMA llamada a Claude que cada vía de PESTEL ya hace por dimensión. Las 2 vías de PESTEL (Express — 1 llamada/6 dimensiones; Controlada — 1 llamada/dimensión, Cloud Function) NO convergen en ningún punto de prompt/clasificación — cada una recibe el bloque de Fontana en su propio prompt. **1 — extracción (regresión verificada):** `lib/fontana/tabla/construirCeldasTabla.ts` (nuevo) extrae `resolverCeldasParaTerritorio` de `app/api/fontana/familia/[familiaId]/route.ts` (ahora wrapper delgado) — sin cambio de comportamiento, verificado contra 2 sesiones reales de Firestore (Yucatán F1-1 distrital 386,061/98.4%; Oaxaca F2-1 estatal-plural). **2 — mapeo:** `lib/fontana/pestelInsumos.ts` — `INDICADORES_PESTEL_POR_DIMENSION` (curado, no toda la familia) + tipo `InsumoFontana` (simple/sintesis/sin_dato), fuente única para el lado Next.js. **3 — endpoint + secreto:** `POST /api/fontana/insumos-pestel` (sin sesión de usuario — auth por header `x-fontana-internal-token` contra el secreto nuevo `FONTANA_INTERNAL_TOKEN`, Firebase Secret Manager, mismo patrón que `INEGI_TOKEN`/`BANXICO_TOKEN`) — wrapper delgado de `lib/fontana/tabla/insumosPestel.ts` (`resolverInsumosFontanaPestel`, el núcleo real, importado directo por Express y vía HTTP por la Cloud Function — una sola implementación, 2 convenciones de invocación según el runtime, `functions/` no puede importar `lib/`). Verificado end-to-end en proceso: 401 con token incorrecto, 200 con 25 insumos reales para dimensión Social. **4 — fallback de nivel + síntesis narrativa:** `lib/fontana/tabla/sintesisDistrital.ts` (`resolverValoresMunicipiosDelDistrito`) — cuando el nivel propio (distrital) no tiene dato pero los municipios que lo componen sí, arma un desglose por municipio en vez de una tabla 1x1 vacía. **Hallazgo real durante la verificación:** 48 llamadas paralelas a SESNSP/CONAPO fallaron TODAS con "Error de conexión" (límite de concurrencia externo, no lógica) — corregido con lotes de 8 (`TAMANO_LOTE`), verificado con valores reales variados (BOKOBA 45.77, XOCCHEL 0, YAXKUKUL 0). Guard proactivo: solo se construye la síntesis si ≥1 municipio resolvió un valor real (nunca una síntesis fabricada de puros motivos de error). **5 — los 2 puntos de inserción en el prompt:** `functions/src/pestel/classifier/claudePESTL.ts` (`buildDimensionPrompt`/`analyzeDimension` ganan `fontanaData`, gateado a `E`/`S`/`Ec`; citación `'Fontana (fuente)'` agregada al allow-list, 5ª entrada) + `lib/ai/phases/prompts.ts` (`getMapaPESTELExpressPrompt`, mismo criterio, bloque duplicado deliberadamente — los 2 runtimes no pueden compartir código); `functions/src/pestel/generateFeed.ts` hace el `fetch` al endpoint nuevo antes del batch de Claude, `functions/src/pestel/scrapeAndAnalyze.ts` agrega el secreto a su config. Verificado con una llamada REAL a Claude (`analyzeDimension`, no simulada): citó `"Fontana (SESNSP (RNID...))"` y `"Fontana (CONAPO (Índice de Marginación 2020))"` en el formato exacto, y describió el patrón de heterogeneidad entre BOKOBA/XOCCHEL/PROGRESO **sin calcular ni mencionar ningún promedio** — el diseño de no-promediar funciona en una llamada real, no solo en el prompt. **6 — semáforo de cobertura de Etapa 4 auto-verde:** `fontanaCubreDimension(dimension, nivelTerritorio)` (nueva, `lib/fontana/tabla/insumosPestel.ts`) — consulta el registry ESTÁTICO de Fontana (nunca resuelve el dato en vivo; la ruta de cobertura se consulta en cada visita a E4 y los adaptadores externos tardan segundos-minutos) para decidir si ≥1 indicador de la dimensión está `"confirmado"` en el nivel territorial del proyecto (con el mismo fallback distrital→municipal del punto 4). `app/api/centinela/pestel/project/[projectId]/coverage/route.ts` marca la dimensión verde automáticamente cuando Fontana cubre, sin requerir carga manual — con el mismo nivel de confianza que las demás fuentes automáticas (`FONTANA_AUTO_CONFIDENCE = 90`); nunca sobrescribe una señal roja real de mala calidad en datos manuales ya cargados. Verificado con el registry real: municipal (E/S/Ec) → true; distrito_federal (E/S, vía fallback municipal) → true; `Ec` nacional → false (correcto, F5 es municipal-only). `tsc --noEmit`, `next build` y `cd functions && npm run build` limpios en las 6 verificaciones. **Pendiente de Raúl (navegador):** proyecto PESTEL real en E4 con territorio municipal/distrital → semáforo verde automático en Económico/Social/Ecológico sin carga manual; ejecutar un análisis real (Express y Controlada) y confirmar que la narrativa cita a Fontana; proyecto plural/distrital sin cobertura propia → narrativa describe el patrón entre municipios sin inventar un promedio. |
| 26-09-13 | Integración PESTEL↔Fontana — corrección: citación de Fontana no seguía el formato cerrado acordado | **Reporte de Raúl (verificación real de la 1ª ejecución Express):** la narrativa citaba `Fontana (SESNSP (RNID, Incidencia delictiva municipal, datos.gob.mx))` — sub-fuente anidada, sin ninguna fecha — en vez del formato cerrado `'Fontana, YYYY-MM-DD'` acordado en el diseño, igual de estricto que Banxico/DOF/INEGI-BISE. **Causa raíz confirmada (sin asumir):** (1) `InsumoFontana` nunca cargó un campo de período — `CeldaTablaFontana` no tiene fecha estructurada, solo `fuenteEtiqueta` (texto libre); el bloque de datos solo mandaba `fuenteEtiqueta` completo entre paréntesis a Claude. (2) La regla de citación implementada en `claudePESTL.ts`/`prompts.ts` decía literalmente `'Fontana (fuente)' — Fontana no expone un período separado` — una decisión tomada durante la implementación (26-09-13, misma ronda) que se desvió del diseño aprobado sin marcarlo como tal ante Raúl. **Hallazgo adicional (evidencia real):** no todas las fuentes de Fontana tienen vintage extraíble — la mayoría de las etiquetas SÍ embeben año/trimestre en texto (`"CONEVAL (Medición de la pobreza 2020)"` → 2020, `"INEGI (ENSU 2026-T2, ...)"` → 2026-T2, `"Bienestar (..., 3er. trim. 2025, ...)"` → 2025-T3), pero SESNSP/RNID (dataset corriente) genuinamente no publica un vintage en su etiqueta — forzar una fecha ahí violaría la regla no-negociable "nunca la fecha actual ni una fecha inferida" ya vigente para las otras 4 fuentes. **Fix:** `InsumoFontanaSimple`/`InsumoFontanaSintesis` (`lib/fontana/pestelInsumos.ts` + espejo en `claudePESTL.ts`) ganan `periodo?: string`, poblado por `extraerPeriodoFuente()` (nueva, `lib/fontana/tabla/insumosPestel.ts`) — regex sobre `fuenteEtiqueta`, nunca inventa: trimestre (`"3er. trim. 2025"` / `"2026-T2"`) primero, año de 4 dígitos (el ÚLTIMO en el texto) después, `undefined` si no hay ninguno. Los 2 formatters (`formatFontanaData` en Cloud Function, `formatFontanaInsumos` en Express) cambian la línea de dato a `| fuente: Fontana | período: ${periodo ?? "sin período"} | detalle: ${fuenteEtiqueta}` — `detalle` es SOLO contexto para el modelo, nunca parte del formato de cita. Las reglas de citación (los 2 puntos del allow-list en cada archivo) se reescriben: formato cerrado `'Fontana, <período>'` cuando hay período real, `'Fontana'` sin fecha (nunca inventada) cuando la línea trae `"período: sin período"` — nunca `'Fontana (detalle)'`. **Verificación con evidencia real:** `extraerPeriodoFuente` — 7/7 casos reales de `fuenteEtiqueta` correctos, incluido el caso SESNSP (→ `undefined`, correcto, no un año fabricado). Llamada REAL a `analyzeDimension` (no simulada) con un insumo SESNSP (sin período) + uno INEGI/ECEG (período "2020") → narrativa citó exactamente `"(Fontana)"` para el primero y `"(Fontana, 2020)"` para el segundo — cero anidación de sub-fuente, cero fecha inventada; señales estructuradas con `fuente:"Fontana"`/`fechaCorte:"sin fecha"` y `fuente:"Fontana"`/`fechaCorte:"2020"` respectivamente. Verificación estática del lado Express (`getMapaPESTELExpressPrompt`): el bloque `[FONTANA]` del prompt ya emite `período: sin período`/`período: 2020` y la regla de citación ya no menciona `'Fontana (fuente)'`. `tsc --noEmit`, `next build` y `cd functions && npm run build` limpios. **Pendiente de Raúl (navegador):** repetir el análisis real que expuso el bug (Express, mismo proyecto de Guadalajara u otro con datos de Fontana en E/S/Ec) y confirmar que la nueva narrativa cita a Fontana en el formato correcto — con fecha real cuando la fuente la publica, sin fecha (nunca inventada) cuando no, sin romper el límite de 3 citas. |
| 26-09-13 | Integración PESTEL↔Fontana — 2 correcciones: bug bloqueante de "Relanzar análisis" (Express) + contraste gris en Moddulo | **1 — bug bloqueante ("Relanzar análisis" no hacía nada, sin error visible):** reportado por Raúl con logs reales (`[inegi] HTTP 400 serie 628229/444612/381016` — los 3 IDs YA documentados como rotos desde 2026-07-08, confirmado no-fatales e irrelevantes al bug). **Investigación (2 agentes Explore) confirmó la causa real:** la llamada nueva a `resolverInsumosFontanaPestel` en `generate-m1-express/route.ts` (ronda anterior) NO pasaba `timeoutMs` — `resolverCeldasParaTerritorio` solo activa su guard de timeout cuando `timeoutMs > 0` (si no, cada indicador corre SIN límite); con 42 indicadores (13 E + 24 S + 5 Ec) resolviendo contra fuentes externas reales (SESNSP, CONEVAL, ECEG...) sin ningún timeout, un solo indicador lento bastaba para colgar la petición completa hasta que Vercel la mataba a los 300s (`maxDuration`), sin log ni error visible — confirmado exacto: el `console.log` de diagnóstico que debía imprimirse justo después del bloque de Fontana nunca aparecía en los logs reportados. El mismo hueco existía también en el endpoint `insumos-pestel/route.ts` (usado por Controlada) y en el fallback de síntesis distrital (`sintesisDistrital.ts`, lotes secuenciales de 8 municipios, cada uno también sin límite). **Decisión de Raúl:** Express es la vía RÁPIDA (para exhaustividad existe Controlada) — 25s por indicador, aceptando que uno lento caiga honestamente a `sin_dato` (nunca se finge que el dato no existía) en vez de colgar el análisis completo; los indicadores de una dimensión resuelven en PARALELO, así que el tiempo real ≈ el más lento, no la suma. **Fix:** `resolverInsumosFontanaPestel`/`resolverValoresMunicipiosDelDistrito` ganan `opts?.timeoutMs`, threading hasta el guard `Promise.race` ya existente en `construirCeldasTabla.ts` (mismo patrón replicado en `sintesisDistrital.ts` para los lotes secuenciales). Los 2 llamadores pasan un valor explícito: Express `25_000`; el endpoint de Controlada `15_000` (comfortablemente bajo los 20s que ya usa `fetchFontanaInsumos` — `functions/src/pestel/generateFeed.ts` — para abortar su propio `fetch`, evitando competir con ese límite). **Verificado con datos reales:** dimensión Social (24 indicadores) con `timeoutMs:25_000` → 30.4s totales, 21/25 insumos con dato real, 1 timeout honesto (F3-2/SESNSP, el mismo indicador ya documentado como lento en frío); `timeoutMs:1` (forzado) → 9ms, no se cuelga, cae a `sin_dato` con motivo honesto. **2 — contraste gris insuficiente en modo claro, más allá del punto exacto de la captura (F2-Exploración):** auditoría (2 agentes Explore) encontró que el problema NO es la frase puntual reportada (esa usa tokens válidos, `bluegreen-eske`/`blue-eske-20`) sino 2 tokens INVÁLIDOS del design system, reincidencia del mismo patrón ya documentado en CLAUDE.md (26-09-12) pero muchísimo más extendida: `text-gray-eske-50` (22 archivos) y `text-black-eske-80`/`-70` (16+2 archivos) — ninguno existe en `globals.css` (`black-eske` solo tiene `-10/-20/-30/-40/-90`; `gray-eske` solo `-10/-20/-30/-40/-60/-70/-80/-90`, sin `-50` en ningún color del sistema) — ~150 ocurrencias en TODO `app/moddulo/` (no solo Exploración: también F3-Investigación, F1-Propósito, hubs, componentes compartidos), casi siempre con su contraparte `dark:` YA correcta y funcionando — solo el lado de modo claro era un no-op silencioso. **Fix (mecánico, sin tocar el lado `dark:` ya correcto):** `text-gray-eske-50` → `text-black-eske-20` (mismo reemplazo ya usado en el fix de badges "Archivado" de 26-09-12); `text-black-eske-80`/`-70` → `text-black-eske-40` (el tono real más oscuro disponible antes de `-90`, que es negro puro). Aplicado en los 30 archivos identificados vía `grep -rl` + reemplazo por archivo (no en bloque — el primer intento con `xargs -0`/glob de rutas con `[projectId]` falló silenciosamente en zsh; corregido iterando con `while read`). **Hallazgo relacionado, incluido en la misma ronda por decisión de Raúl:** 2 archivos (`ConfigWizard.tsx` del Redactor, `ModduloChat.tsx`) usaban grises GENÉRICOS de Tailwind (`text-gray-400`/`text-gray-500`, no tokens `-eske`) para placeholders e íconos/hints — violación de la regla "nunca colores genéricos de Tailwind", clase de problema distinta (no es un token inválido, es un color fuera del design system) pero corregida en la misma ronda: `text-gray-400`→`text-gray-eske-70`, `text-gray-500`→`text-gray-eske-90` (alcance acotado a los placeholders/íconos reportados — el resto de grises genéricos de esos 2 archivos, ej. `border-gray-300`/`bg-gray-50`/`text-gray-800` de inputs y burbujas de chat, es el lenguaje visual deliberado de esos componentes, no parte de este bug, y queda fuera de alcance). `tsc --noEmit`, `next build` y `cd functions && npm run build` limpios para ambos puntos. **Pendiente de Raúl (navegador):** repetir "Relanzar análisis" (Express) → debe completar en un tiempo razonable, con o sin algún indicador cayendo honestamente a "sin dato"; confirmar que la corrección de citación de la ronda anterior se refleja en el nuevo análisis; capturas de contraste corregido en modo claro (Exploración, Investigación F3, Propósito, y los 2 archivos de grises genéricos). |
| 26-09-13 | Integración PESTEL↔Fontana — 3 correcciones post-verificación real: spinner ausente en "Relanzar análisis", contraste gris residual (tokens VÁLIDOS pero demasiado claros), citación con "Fontana" en vez de la fuente oficial | Raúl repitió la verificación tras el fix anterior y reportó 3 problemas nuevos con evidencia real (logs + capturas). **1 — "Relanzar análisis" sigue sin dar ninguna señal visual, pero esta vez el backend SÍ completa** (log real: `[fontana/tabla] timeout (25000ms) resolviendo F3-2` seguido del `console.log` de diagnóstico que antes nunca aparecía — confirma que el fix del timeout del punto anterior funcionó). **Causa raíz real (lectura directa de la cadena de renderizado, no supuesta):** `app/moddulo/proyecto/[projectId]/exploracion/page.tsx` — el ternario que decide qué mostrar en el panel central evalúa `mode === "editing" && dvs !== null` (línea ~1381) ANTES que `isExpressAnalyzing` (línea ~1403); el modal "Relanzar análisis" se confirma típicamente ESTANDO en modo edición (como en la captura real de Raúl, badge "Editando" visible) y su `onConfirm` nunca sacaba la página de `mode:"editing"` — así que la vista de edición de motores se quedaba fija en pantalla durante TODO el proceso (spinner nunca visible) y, al terminar, la vista tampoco cambiaba a mostrar el resultado nuevo porque `mode` seguía en `"editing"`. **Fix:** `onConfirm` del modal gana `setMode(dvs ? "completed" : "active")` + `setShowReporte(false)` antes de disparar `handleGenerarDVSRef.current()` — sin tocar la preservación deliberada de `draftDVS` (sigue sin limpiarse). **2 — contraste gris residual, en elementos NO cubiertos por el fix anterior porque usan tokens VÁLIDOS del design system, solo demasiado claros para servir de texto legible** (`text-gray-eske-40` #d4d4d4, `text-gray-eske-70` #a3a3a3 — contraste insuficiente en WCAG AA sobre fondo blanco, a diferencia del bug anterior que eran tokens inexistentes/no-op): el ícono del menú kebab "⋮" + sus 3 opciones ("Nuevo análisis", "Vincular con análisis independiente") + la etiqueta "Solo lectura"/"Auto-rellena via chat" del panel "ANÁLISIS PESTEL", replicado también en `proposito/page.tsx` (Variables XPCTO) y en un badge de territorio del header. Fix: `text-gray-eske-40`→`text-black-eske-20` (íconos/etiquetas), `text-gray-eske-70`→`text-black-eske-20` (texto de opciones de menú y badges), hover `text-gray-eske-70`→`text-black-eske`; aplicado también en `AdvisorPanel.tsx` (mismo patrón de ícono ✕) y en 4 archivos más con el mismo `text-gray-eske-70` genérico como texto de cuerpo (`redactor/page.tsx`, `ProjectSelector.tsx` ×2, `PhaseReportView.tsx` ×2). **Hallazgo relacionado, NO corregido (mismo patrón, fuera de Moddulo):** el mismo ícono de kebab con `text-gray-eske-40 hover:text-gray-eske-70` sigue así en `app/centinela/fontana/FontanaCanvasItemCard.tsx` y `FontanaModduloButton.tsx` — módulo Fontana, no reportado esta ronda, se deja para que Raúl decida. **3 — la narrativa citaba "(Fontana, 2026-T2)" en vez de la fuente oficial real:** el formato acordado ('Fontana, <período>') era formalmente correcto pero conceptualmente equivocado — al usuario le importa la fuente oficial del dato (INEGI/SESNSP/CONEVAL/...), no "Fontana", que es solo la app que agrega y verifica datos ya oficiales. **Fix:** `extraerFuenteOficial()` (nueva, junto a `extraerPeriodoFuente` en `lib/fontana/tabla/insumosPestel.ts`) extrae el nombre de la agencia — el texto antes del primer paréntesis de `fuenteEtiqueta`, patrón estructural confirmado en TODOS los `FUENTE_ETIQUETA_*` de `lib/fontana/ingesta/*.ts` ("SESNSP (...)", "INEGI (...)", "CONEVAL (...)", etc.) — nunca "Fontana". Nuevo campo `fuenteOficial: string` en `InsumoFontanaSimple`/`Sintesis` (+ espejo en `claudePESTL.ts`); los 2 formatters cambian `fuente: Fontana` por `fuente_oficial: ${fuenteOficial}`; las reglas de citación (ambos runtimes) exigen el formato `'<fuente_oficial>, <período>'`, prohibiendo explícitamente escribir "Fontana" en la cita. **Verificado con datos reales:** `extraerFuenteOficial` 6/6 casos reales correctos (SESNSP/INEGI/CONEVAL/CONAPO/IMCO); llamada REAL a Claude reproduciendo el caso exacto de Raúl (ENSU 78.2% + homicidios SESNSP) → narrativa cita `"(INEGI, 2026-T2)"` y `"SESNSP"` (sin fecha, honesto), cero apariciones de "Fontana" en toda la respuesta. `tsc --noEmit`, `next build` y `cd functions && npm run build` limpios en los 3 puntos. **Pendiente de Raúl (navegador):** repetir "Relanzar análisis" estando en modo edición → debe aparecer el spinner "Analizando con IA…" y, al terminar, la vista debe actualizarse con el resultado nuevo; contraste del kebab/menú/"Solo lectura" legible en modo claro; la narrativa nueva cita fuentes oficiales (INEGI/SESNSP/CONEVAL/...), nunca "Fontana". |
| 26-09-13 | Integración PESTEL↔Fontana — 4ª corrección: la cita "INEGI" colapsaba productos distintos de una misma institución (Censo vs. ENSU) | Raúl verificó el fix anterior (ya no dice "Fontana") pero encontró una imprecisión de fondo: `"(INEGI, 2026-T2)"` para percepción de inseguridad (ENSU) y `"(INEGI, 2020)"` para escolaridad (Censo) citaban distinto dato bajo el mismo nombre — mismo problema de fondo que ya se evitó a propósito en las Notas Metodológicas de Fontana (Censo/ITER/ECEG/ENVIPE/ENSU documentados como productos separados de INEGI, no una fuente genérica). **Investigación (sin implementar hasta aprobación — plan mode):** causa raíz confirmada en `extraerFuenteOficial()` (`lib/fontana/tabla/insumosPestel.ts`): extraía SOLO el texto antes del primer paréntesis de `fuenteEtiqueta`, descartando el producto/encuesta que va dentro. Confirmado que el problema es sistémico vía grep de las ~28 constantes `FUENTE_ETIQUETA_*` reales: INEGI (9 productos — ECEG/Censo, ITER/Censo, ENSU, ENOE, ENVIPE, ENIGH, ICMM, Compendio, Pobreza Multidimensional), CONEVAL (Pobreza vs. Rezago Social vs. GACP), Bienestar (Producción vs. Beca Benito Juárez), PNUD México (4 sub-índices) — todos colapsarían al nombre de la agencia sola. Se evaluaron 2 opciones: (a) parsing genérico del texto entre paréntesis — descartada: un parser mecánico no reproduce la etiqueta humana ya decidida a mano (ej. "INEGI (ITER, Censo 2020)" daría "ITER", no "Censo" como Raúl mismo la nombró); (b) tabla de curación manual — **aprobada por Raúl**. **Implementación:** `lib/fontana/tabla/fuenteOficialCurada.ts` (nuevo) — tabla de 34 patrones (regex anclada al PREFIJO ESTABLE agencia+producto, nunca al string completo con año/trimestre, para sobrevivir el cambio de vintage) → etiqueta corta curada (ej. `/^INEGI \(ENSU/` → `"INEGI/ENSU"`, `/^INEGI \(ITER, Censo 2020\)/` y `/^INEGI \(Censo 2020, vía ECEG\)/` → ambas `"INEGI/Censo"`, `/^CONEVAL \(Medición de la pobreza/` → `"CONEVAL/Pobreza"` vs. `/^CONEVAL \(Índice de Rezago Social/` → `"CONEVAL/Rezago Social"`) + 2 fuentes con formato distinto sin paréntesis inmediato tras la agencia (CONAGUA, ANVCC/INECC) también cubiertas. `extraerFuenteOficial()` consulta esta tabla primero; si ninguna coincide (fuente aún no curada), cae al fallback agencia-sola de siempre — nunca rompe, nunca cita vacío. **Verificado con datos reales:** 34/34 constantes reales de `lib/fontana/ingesta/*.ts` cubiertas por la tabla (script de auditoría); casos exactos de Raúl — ENSU → `"INEGI/ENSU"`, Censo/ECEG → `"INEGI/Censo"`, CONEVAL Pobreza vs. Rezago Social distinguibles; fuente hipotética no curada → cae al fallback sin romper. Llamada REAL a Claude (mismo escenario, ENSU 78.2% + escolaridad Censo 9.4 años) → narrativa citó `"INEGI/ENSU 2026-T2"` y `"(INEGI/Censo, 2020)"`, ambos distinguibles, formato de cita sin cambios. `tsc --noEmit`, `next build` y `cd functions && npm run build` limpios. **Pendiente de Raúl (navegador):** un análisis real con datos de al menos 2 productos INEGI distintos (ej. Censo + ENSU) en la misma dimensión → la narrativa cita cada uno con su etiqueta de producto, nunca ambos como "INEGI" a secas. |
| 26-09-13 | Integración PESTEL↔Fontana — CIERRE de la ronda de correcciones (contraste + timeout Express + citación curada), verificación final confirmada post-reinicio | Raúl reportó una verificación inicial que parecía mostrar el problema de citación aún presente — **investigado y confirmado como FALSO POSITIVO**: era un análisis reciclado (cacheado en el estado del cliente) generado ANTES de la corrección de la 4ª ronda, no una regresión real. El reinicio del sistema lo evidenció: un análisis nuevo generado después del reinicio, con los mismos datos reales de Guadalajara, mostró la corrección funcionando correctamente — `"1,384,959 habitantes (INEGI, 2020)"` y `"78.2%... (INEGI/ENSU, 2026-T2)"`, Censo y ENSU distinguidos exactamente como se diseñó. **Con esto, la integración PESTEL↔Fontana queda validada end-to-end en la vía Express** (datos reales de Fontana, timeout que no cuelga el análisis, citación precisa por producto/institución, sin alucinaciones ni imprecisiones de las rondas anteriores) — cierre confirmado con evidencia real, no solo con builds limpios. **Fuera de alcance de esta ronda, ya acordado:** la verificación equivalente de la vía Controlada (PESTEL completo E1-E8, Cloud Function) queda para una sesión de trabajo aparte. Sin trabajo pendiente de esta ronda. |
| 26-09-21 | Diseño — sub-ronda 2: tokens fantasma `black-eske-60`/`-80` y `blue-eske-900` → 0 en todo el repo (Sefix, Fontana, compartidos, cursos, `app/dev`) + guard sin remanentes | **Origen:** diagnóstico de solo lectura (26-09-21) de la familia de tokens inexistentes que la sub-ronda 1 dejó reportada. **Hallazgos con evidencia (CSS del build + Chrome headless, ambos temas):** los 3 tokens NUNCA existieron (git: `black-eske` definido solo con `-10…-40` y `-90` desde el primer commit; `black-eske-80` aparece en Nov-2025 y `-60` en Abr-2026 como extrapolaciones); una clase con token inexistente no genera CSS (verificado en `.next/static/chunks/*.css`) → el texto hereda el color del ancestro (~372 de 375 clases de texto: `#2b2b2b`, jerarquía plana; 2 spans "— Corte" heredaban el azul del encabezado; 5 `fill="var(--color-black-eske-60)"` de ejes de gráfica caían a negro puro `rgb(0,0,0)`; el CTA de cursos con `blue-eske-900` heredaba blanco sobre `bg-yellow-eske`, contraste 1.45:1; 6 etiquetas con `/50·/60·/70` no atenuaban; 3 `hover:` sin efecto). 373/375 tenían contraparte `dark:` correcta → modo oscuro no afectado (salvo ejes y CTA). Intención inferida por la contraparte oscura + el comentario de `InfoTooltip` ("secundario = `text-black-eske-80` / `dark:text-[#9AAEBE]`"): texto secundario/terciario. **Corrección (401 clases, 67 archivos; script con tabla exacta que ABORTA ante cualquier caso no mapeado y detecta conflicto de cascada con otro `text-*` del mismo elemento — 0 conflictos):** mapeo por rol de la contraparte oscura — `#9AAEBE` → `black-eske-20` (7.45:1), `#6D8294` → `black-eske-10` (6.38:1), `#C7D6E0`/`#C8D8E8` → `black-eske-40`; opacidad conservada (`black-eske-10/50·/60·/70`); `blue-eske-900` → `blue-eske-90` (1.45:1 → 7.58:1); 5 `var(--color-black-eske-60)` → `black-eske-20`; hovers: `HistoricoPartidos`/`Loc` `hover:black-eske-20`, `Tabs` `hover:black-eske-40`; las 2 excepciones que heredaban azul pasan a gris; `app/dev` (21) mecánico (`white/40` → `-10`, `white/50·55·60` y `black-eske-40` → `-20`). **Casos con criterio propio (declarados):** (1) `PartidosMultiSelect` placeholder → `placeholder:text-gray-eske-90` y no `black-eske-10` (debe verse más claro que el texto tecleado; precedente sub-ronda 1); (2) `OrigenCharts` (~992), único sin `dark:` → se AGREGÓ `dark:text-[#9AAEBE]` (sin él el texto quedaría oscuro sobre fondo oscuro); (3) `G1TrendChart` "Hoy": `isDark ? "#C7D6E0" : var(--color-black-eske-20)`, consistente con el `tickFill` del mismo archivo (antes negro también en oscuro); (4) hover de `HistoricoPartidos*` a `black-eske-20` (no `-40`) para que el efecto sea perceptible; (5) `GeoNavegador` (`dark:text-white/60`) → `-20`. **Guard (`lib/design/tokensColor.test.ts`):** se eliminó `TOPE_REMANENTE`; ahora CUALQUIER token `-eske` no definido en `globals.css` rompe el test (dirs `app`, `lib`, `context`, `types`, `utils`), con prohibición explícita por nombre y prueba del escáner sobre texto sintético; probado en negativo (reintroducir `hover:text-black-eske-80` en `Tabs.tsx` → 2 tests fallan; revertido). **Verificación:** grep de conteo `black-eske-60` 252→0, `-80` 148→0, `blue-eske-900` 1→0 (código); `tsc --noEmit`, `next build` y `vitest` (326) limpios. **Pendiente de Raúl (navegador, guía visual entregada aparte por frente):** Frente 1 (CTA cursos, etiquetas deshabilitadas, hovers, ejes) y Frente 2 (textos secundarios en Sefix y Fontana, claro/oscuro). **Fuera de alcance, reportado:** 9 genéricos de Sefix, 259 del sitio principal, kebab `gray-eske-40/-70` de `FontanaCanvasItemCard`/`FontanaModduloButton`, `dark:text-black-eske-40` (token válido pero oscuro-sobre-oscuro) en 4 páginas `app/dev`. |
| 26-09-21 | Diseño — ronda 3: Sefix + diagnóstico del sitio principal; deriva de CLAUDE.md corregida | **Paso 0 (frescura, 6 secciones leídas contra el código real; no eran falsos positivos):** `api-route-count` 142 correcto. `sefix-modulo`: eran **24** rutas, no 23 → corregido. `pestel-e6` ⏳ → ✅ (matriz drag-drop con puntero + teclado, panel de sesgos, voces, comparación; `/approve` responde 422 con sesgos sin revisar). `pestel-e7` ⏳ → 🟡 (4 de 5 formatos de la spec 07: falta "mapa de insights por tipo de proyecto"; scorecard + PDF/DOCX sí). `pestel-e8` ⏳ → 🟡 (dashboard, histórico, cron 6 h, versionado sí; **nada escribe `pestel_alerts` ni `isCrisis`** → feed y banner siempre vacíos; umbral fijo 70; sin email). `pestel-integracion-moddulo-f2` ⏳ → ✅ (4 rutas consumidas por `exploracion/page.tsx`). Las fechas del detector eran de commits de color, pero las filas llevaban meses erradas. **Parte 1:** Sefix 16 → 0 genéricos salvo el púrpura "No Binario", que la ronda 4 (fila siguiente) resolvió con el token `violet-eske`; guard extendido a `app/sefix` + `lib/sefix` con regex compartido (probado en negativo). **Parte 2:** diagnóstico documentado, sin corregir. **Hallazgos sin tocar:** el texto de `monitoreo/page.tsx` afirma que las alertas "se generan cuando el score supera el umbral" (no es cierto hoy); `functions/src/pestel/feedSync.ts` está exportado y lanza `Not implemented` en cada `pestel_feeds` creado por la ruta V1; `app/sefix/components/IframePanel.tsx` es código muerto (0 imports). |
| 26-09-21 | Diseño — ronda 4: token `violet-eske` + Moddulo (296/315) | **Decisión 1:** el violeta "No Binario" se oficializa como token (`violet-eske` `#9b59b6` = `COL_NB`; `-20` `#c585f5` = `COL_NB_DARK`; `-60` `#773e8e` derivado solo para texto en claro, 6.99:1). Migrados los 4 tooltips de Sefix (16 clases) y "Vigilar" de PESTEL; eliminados `COL_NB`/`COL_NB_DARK` y 2 `colNB` sin uso. Guard: `violet` en `COLORES_ESKE`, PESTEL y Sefix en **0 sin excepciones**. **Decisión 2:** Moddulo primero (315 clases). 296 migradas por tabla exacta (99 tokens, aborta ante lo no mapeado), 26 `dark:text-*` agregados, 19 púrpuras retenidos y documentados para decisión. Regresión propia detectada y corregida: `-70` bajaba a AA los chips verde/naranja/azul → `-80`. Verificación: 103 clases nuevas presentes en el CSS compilado, 0 conflictos de cascada vs HEAD, guard probado en negativo (el primer intento fue un no-op de `sed` y se rehízo), `tsc`, `next build` y 329 pruebas. **Sin tocar por instrucción:** E8 (alertas sin generarse) y sub-rondas A-D del sitio principal. |
| 26-09-21 | Diseño — ronda 5: cierre de Moddulo (315/315) + diagnóstico de la colisión Extranjero/No Binario | **Aprobado y aplicado:** los 15 púrpuras del ámbar "Requiere ajuste" → `brown-eske-60` (claro) / `yellow-eske` (oscuro) con el patrón de `MotoresSequentialView`; los 4 de los chips de país (sin variante oscura) → `violet-eske` con su par claro/oscuro. Moddulo = 0 genéricos; guard de PESTEL, Sefix y Moddulo **sin ninguna excepción**, probado en negativo con edición real. Verificación: `tsc`, `next build`, 329 pruebas, 15 clases nuevas presentes en el CSS compilado. **Investigado y luego resuelto (ronda 6):** ver "Colisión Extranjero vs No Binario — RESUELTA". **Sin tocar por instrucción:** E8 y sub-rondas A-D del sitio principal. |
| 26-09-21 | Diseño — ronda 6: colisión Extranjero/No Binario resuelta | Mujeres-Extranjero pasa a la paleta rosa/rojo de Mujeres-Nacional en `SexoCharts` (S1-S4) y `G3SexChart` (2 archivos, sin tokens ni hex nuevos). Hombres y las demás gráficas de Extranjero intactos. Verificado: ΔE con No Binario 0 → 50.2 (oscuro) y 41.1 → 42.5 (claro); sin colisión nueva (ΔE ≥ 41.2 contra los 22 colores de Extranjero); ningún texto describe el color. Aviso: `G3SexChart` "Lista Mujeres" oscuro = 2.97:1 (heredado de Nacional). `tsc`, `next build` y 329 pruebas. **Con esto se cierra el punto 4 del plan de extras**, salvo lo documentado: badge `draft` del hub, E8 y sub-rondas A-D del sitio principal. |
| 26-09-21 | Diseño — ronda 7: sitio principal, sub-ronda A (143 → 0) | 21 archivos (páginas estáticas, cursos, componentes compartidos, `Header`, `NotificationBell`, `HomeClient`, `lib/redactor`). Guard extendido (acepta archivos sueltos) y probado en negativo por directorio y por archivo. Hallazgo: 4 clases inexistentes `bg-*-60` en `HomeClient` (no-op silencioso). Ajustes de contraste medidos contra el original (`-90` verde/azul sobre tinte, `orange-eske-80`, notas terciarias a `black-eske-10`); 2 defectos previos de modo oscuro corregidos (caja de cookies, mensaje vacío de notificaciones). Los "5 `text-yellow-*`" no estaban en A (están en B y D). Verificación: `tsc`, `next build`, 330 pruebas, 69 clases presentes en el CSS, 0 conflictos de cascada. **Pendiente:** sub-rondas B (197), C (310), D (124), E8, badge `draft` del hub. |
| 26-09-22 | Diseño — ronda 8: sitio principal, sub-ronda B (197 → 0) | 20 archivos (`componentsHome` completo, `newsletter/confirm`, `newsletter/unsubscribe`). Recontado antes de tocar código: idéntico al diagnóstico previo. 3 modales de plan de suscripción verificados sin identidad de color (no repiten el patrón de `SubscriptionBadge`), mapeo mecánico sin decisión pendiente. 3 bugs de sufijo `-eske` faltante corregidos (`red-60`, `gray-90`, `gray-20`, mismo patrón que `HomeClient` en A). Caja de advertencia de `newsletter/confirm` → `brown-eske-60`/`yellow-eske`, con `dark:` agregado. 2 gradientes con `dark:` agregado, 2 pares claro/oscuro colapsados por resolver al mismo token. Verificación: `tsc`, `next build`, 331 pruebas, 58 clases presentes en el CSS, 0 conflictos de cascada, guard extendido y probado en negativo. **Pendiente:** sub-rondas C (310), D (124), E8, badge `draft` del hub. |
| 26-09-22 | Diseño — ronda 9: sitio principal, sub-ronda C (310 → 0, salvo 12 de marca) | Blog público (156/23) + admin (154/16). `ShareButtons`/`SEOPreview`: de sus 41 clases totales, 12 son marca real (Facebook/X/LinkedIn/WhatsApp, pestañas Google/Facebook/X) → excepción **exacta** en el guard (lista literal, probada en negativo agregando una clase no declarada); las otras 29 no eran marca y migraron. Chip morado de `BlogToolbar` investigado a fondo (3er indicador de filtro activo, estado de UI local sin relación con datos del blog) y resuelto con decisión de Raúl: `violet-eske` (4º uso oficial) para el chip de orden, `blue-eske` para el de búsqueda. Estado editorial y moderación de comentarios ya usaban tokens, sin tocar. Sin bugs de sufijo `-eske` en este alcance. Banner de error de `NewsletterSignup` sobre fondo de marca (no blanco) → `text-white-eske`, 7.30:1 vs 5.44:1 original. Verificación: `tsc`, `next build`, 332 pruebas, 66 clases presentes en el CSS, 0 conflictos de cascada, guard probado en negativo en los 2 bloques (cero genéricos y excepciones exactas). **Pendiente:** sub-ronda D (124, condicionada a decisión de plan/color), E8, badge `draft` del hub, `lib/constants/categories.ts` (hex crudo, reportado). |
| 26-09-22 | Diseño — ronda 10: sitio principal, sub-ronda D (124 → 0) + token `premium-eske` — cierra las 4 sub-rondas | Investigación previa (2 exploradores en paralelo) confirmó que el púrpura de Premium (`#9333ea`, único hex en todo el repo) es identidad de producto real (borde+precio consistentes en `suscripciones.tsx`, igual que Basic/Professional) y un tono materialmente distinto de `violet-eske` (ΔE76 45.5). Decisión de Raúl: token nuevo `premium-eske` (no 5º uso de `violet-eske`). `admin`→`red-eske-60` y `unsubscribed-*`→`orange-eske` (decisiones de Raúl, mecánicas). `registered`/`default` de `SubscriptionBadge`: ningún paso de `gray-eske` alcanza AA con texto blanco → texto cambiado a `black-eske`, mismo patrón que `visitor` (5.03:1/5.61:1). Mapeo por rol de la contraparte oscura (no por paso) en `profile.tsx`, con 3 tonos distintos encontrados. Bug real corregido: `profile.tsx:902`, un `dark:` faltante entre 3 filas idénticas. Extrapolaciones de bajo riesgo en bordes decorativos (`+1 paso en oscuro`, ya documentado para `--color-brand-primary`). Verificación: `tsc`, `next build`, 333 pruebas, 47 clases presentes en el CSS, 0 conflictos de cascada, guard probado en negativo. **Con esto cierran A+B+C+D del sitio principal.** **Pendiente:** E8, badge `draft` del hub, `lib/constants/categories.ts`, grises de Fontana. |
| 26-09-22 | PESTEL — Etapa 8: generación de alertas (cierra el ciclo básico) | Investigación previa (misma ronda) confirmó que el hueco era más profundo que "nada escribe en `pestel_alerts`": ningún cálculo de riesgo estaba conectado al camino que corre hoy (V2) — `calculateRiskVector` seguía cableado solo a V1 legacy (input `ClassifiedArticle[]` con sentimiento por artículo, que V2 nunca genera), y `feedSync.ts` era un trigger sobre `pestel_feeds` (colección V1, inalcanzable desde el cron V2) con un `throw` huérfano desde el rediseño V2 (26-03-27). Fórmula nueva `calcularVectorRiesgoV2` (`functions/src/pestel/risk/vectorRiesgoV2.ts`, determinista, cero llamadas a Claude adicionales — opera sobre `classification`/`intensity`/`trend`/`confidence` que las 6 llamadas de la Etapa 5 ya producen): riesgo por dimensión según clasificación (AMENAZA=80/NEUTRAL=40/OPORTUNIDAD=15) modulado por intensidad y, solo en AMENAZA, ±10 según tendencia; agregado del proyecto = promedio ponderado por `confidence`. `isCrisis` con criterio SUSTITUTO (`vectorRiesgo ≥ umbral+15` y ≥2 dimensiones AMENAZA+ALTA) — documentado explícitamente que NO es el criterio original de la spec 08 (spike de menciones >300% sobre 7 días, requiere tracking de volumen diario que no existe hoy), pendiente de revisión para la versión fortalecida de PESTEL. **Backtesting previo (solo lectura, 141 análisis reales de Firestore) sin falsos positivos/negativos evidentes, pero con limitación de muestra documentada: 91% de los datos vienen de un único proyecto de prueba con clasificación mayoritariamente AMENAZA — no es representativa para calibrar con confianza; se aprobó dejar la fórmula sin ajustar números, a la espera de producción real** — si las alertas se disparan con más frecuencia de la esperada, revisar primero la tendencia de clasificación de E5, no necesariamente esta fórmula (responsabilidades distintas). Insertada entre el paso 9 y el paso 10 de `generateAnalysisV2` (mismo punto de disparo para análisis manual y automático, sin activar `autoMonitorEnabled`); `vectorRiesgoUmbral` reenviado desde `scrapeAndAnalyze.ts` sin lectura nueva de Firestore. Tipo de alerta nuevo `"vector_riesgo_alto"` (`types/pestel.types.ts`, con `analysisId` para trazabilidad). `feedSync.ts` corregido (no eliminado): no-op explícito documentado, V1 no tiene fórmula equivalente. **Pruebas de regresión nuevas** (`vectorRiesgoV2.test.ts`, 20 casos) — primera vez que `functions/` tiene un runner de pruebas: se agregó `tsx` (único devDependency nuevo) + `node:test`/`node:assert` (stdlib), sin introducir un framework nuevo; `functions/tsconfig.build.json` (nuevo) excluye los `.test.ts` del build de deploy sin afectar a ESLint, `vitest.config.ts` (raíz) excluye `functions/**`. Verificación: `tsc --noEmit`, `next build`, `cd functions && npm run build`, `cd functions && npm run lint` (2 líneas largas pre-existentes en `claudePESTL.ts` bloqueaban el hook de pre-deploy de `firebase deploy` — sin relación con la fórmula, corregidas mecánicamente al intentar el deploy real, ver fila siguiente), 333 pruebas de la raíz sin regresión, 20/20 pruebas nuevas. **Cierra el ciclo básico de E8 — sin correo** (`notificarEmail` sigue sin leerse, Opción B pendiente aparte) **y sin umbral/frecuencia configurables por UI** (fuera de alcance, ya evaluado). **Pendiente de Raúl:** desplegar (`firebase deploy --only functions`) y disparar un análisis real (manual o cron) para confirmar en producción que `pestel_alerts` se escribe y que `AlertsFeed`/`CrisisBanner` dejan de estar vacíos. |
| 26-09-22 | PESTEL E8 — despliegue: secreto faltante + 2 hallazgos incidentales resueltos | El primer intento de `firebase deploy --only functions` reveló 3 bloqueos, ninguno del diseño de la fórmula: **(1)** el hook de pre-deploy corre `npm run lint` con el `tsconfig.json` base (necesario para que ESLint vea también `vectorRiesgoV2.test.ts`) — las 8 líneas largas pre-existentes de `claudePESTL.ts` (ya reportadas en la fila de arriba como "sin relación, no tocadas") SÍ bloqueaban el deploy real aunque no las nuestras; corregidas mecánicamente (solo wrapping de línea, cero cambio de lógica), verificado con `tsc --noEmit`, `next build`, `cd functions && npm run build/lint/test` limpios. **(2)** `FONTANA_INTERNAL_TOKEN` (integración PESTEL↔Fontana, 26-09-13) nunca se había fijado en Secret Manager — el secreto está declarado en `scrapeAndAnalyze.ts` desde esa ronda pero nadie lo creó; generado un valor nuevo (`openssl rand -hex 32`) y fijado por Raúl en Secret Manager + `.env` local + Vercel (los 3 entornos). **(3, hallazgo incidental, SIN relación con E8 ni con el punto 2):** al revisar el estado de Vercel para confirmar el punto 2, Raúl reportó un error de build en `develop` — investigado con evidencia real (sin CLI de Vercel disponible, diagnóstico por lectura directa del repo): `lib/fontana/ingesta/zap.ts` (+ `ensuCatalogo.ts`, `ingesta/ensu.ts`, `ingesta/envipe.ts`) importan estáticamente 4 JSON de `data/fontana/` al bundle de Next.js — pero `.gitignore:105` (`/data/`, pensada para excluir ~2GB de datos electorales) los excluía en silencio desde que esos imports se introdujeron (Fontana Familia 3, **26-08-27**, confirmado por `git log`); los archivos existían en disco local (por eso el build local sí funcionaba) pero nunca llegaron a GitHub, así que el build de Vercel para `develop` llevaba roto casi un mes — **desde antes de que existiera esta ronda de E8, sin relación con la fórmula de alertas.** Fix: excepción de 3 pasos en `.gitignore` (`/data/*` → `!/data/fontana/` → `/data/fontana/*` → reincluir solo los 4 archivos) — `INDICATOR_REGISTRY.json` y `contenido_curado/` (se leen de Cloud Storage en runtime, no se importan al bundle) y el resto de `data/` (datos grandes) siguen ignorados sin cambio, verificado con `git check-ignore -v` antes/después y `git status --porcelain -uall` confirmando que solo esos 4 archivos quedaban para agregar. Commiteados en un commit separado y enfocado (`8e990c8`, datos públicos INEGI/DOF, sin información sensible), verificado que el blob de git es byte-idéntico al archivo en disco y que un `git worktree` limpio (simulando un checkout fresco tipo Vercel) materializa los 4 archivos sin residuo local. **Deploy reintentado y confirmado exitoso** (`firebase deploy --only functions`, mismo día) — Firebase otorgó automáticamente `roles/secretmanager.secretAccessor` a la cuenta de servicio para `FONTANA_INTERNAL_TOKEN`, confirmando que el secreto SÍ estaba en Secret Manager (no solo en Vercel/`.env`); las 7 funciones (`scrapeAndAnalyze`, `scheduledMonitor`, `feedSync`, `purgeAdjuntos`, `onUserCreate`, `onUserUpdate`, `setAdminRole`) se actualizaron/crearon sin errores. **Aún pendiente de Raúl:** hacer `git push` de este commit y del resto del trabajo de E8 (no auto-push, ver reglas de la sesión); confirmar en el panel de Vercel si el build de `develop` ahora completa (el fix del punto 3 sigue sin push hasta que Raúl lo suba). |
| 26-09-22 | PESTEL E8 — verificación en vivo confirmada (fórmula, escritura y UI) | Raúl disparó un análisis real (`FlOLfyDYPiHd3OEmDZV5`, proyecto "Campaña de Ricardo Anaya (PAN) para la Presidencia") sobre el deploy recién hecho — `pestel_alerts` siguió vacío. **Investigado con lectura directa de Firestore (script de solo lectura, scratchpad) en vez de asumir "correcto" sin verificar:** las 6 dimensiones reales de ese análisis (P/S/L en AMENAZA+ALTA, E en AMENAZA+MEDIA, T/Ec en NEUTRAL) producen, con la fórmula exacta, `vectorRiesgo = 69` — **a 1 punto del umbral (70) del proyecto**. Confirmado además que `pestel_alerts` tenía 0 documentos en TODO el proyecto (no solo para ese análisis) — la ausencia de alerta es el resultado matemáticamente correcto de la fórmula, no un fallo silencioso. **Duda aparte de Raúl, también investigada:** el indicador "Alertas" no se movía y él no veía en la terminal el `GET .../alerts` del polling de `AlertsFeed` (solo veía `GET /api/notifications`, una ruta distinta y no relacionada — la campanita de notificaciones in-app, no el feed de alertas de monitoreo). Confirmado por código que `AlertsFeed` está montado sin condición en `monitoreo/page.tsx` y hace `fetch` inmediato al montar + cada 30s a la ruta correcta (`GET /api/centinela/pestel/project/[projectId]/alerts`, existente y correcta) — hipótesis: throttling de timers en pestaña de fondo (comportamiento estándar del navegador). **Confirmado por Raúl con DevTools → Network:** la petición SÍ llega (`200 OK`), con la pestaña en foco — la duda queda cerrada, sin bug de polling. **Demostración del camino positivo, sin gastar una llamada nueva a Claude:** por pedido de Raúl ("ver la implementación funcionar, sin lanzar un nuevo análisis"), se bajó `alertas.vectorRiesgoUmbral` de ese proyecto (70 → 50, temporal, solo ese proyecto) y se recalculó `vectorRiesgo` importando **el mismo módulo de producción** (`calcularVectorRiesgoV2`/`dimensionAnalysisAVectorRiesgoInput` de `functions/src/pestel/risk/vectorRiesgoV2.ts`, no una reimplementación) contra las dimensiones REALES ya guardadas de `FlOLfyDYPiHd3OEmDZV5` — con umbral 50: `vectorRiesgo=69` sí dispara, y como hay 3 dimensiones en AMENAZA+ALTA (≥2) y `69 ≥ 50+15=65`, también dispara `isCrisis:true`. Se escribió el documento real `pestel_alerts/8FnbNdLQZMNqWeGJkXkI` (mismo shape exacto que produce el paso 9.5 de `generateAnalysisV2`, `analysisId` apuntando al análisis real, descripción marcada explícitamente `[PRUEBA DE VERIFICACIÓN E8 — umbral temporal de 50]` para no confundirse con una alerta orgánica). Raúl confirmó en navegador: contador de alertas, alerta en el feed y `CrisisBanner` rojo, los 3 visibles. **Decisión de Raúl: NO revertir** — el umbral bajado (50) y la alerta de prueba se quedan deliberadamente en ese proyecto (uno de prueba interno) como recordatorio vivo para cuando se retome la siguiente versión de PESTEL. **Con esto, E8 queda verificado de punta a punta en producción real**: fórmula (20 pruebas unitarias + backtesting de 141 análisis históricos + este cálculo en vivo), escritura en Firestore (alerta real generada por la fórmula real), y UI (`AlertsFeed`/`CrisisBanner` reflejando el estado real, polling confirmado funcional). Sin trabajo pendiente de esta verificación — quedan solo el `git push` y la confirmación de Vercel ya anotados en la fila anterior. |
| 26-09-22 | Seguridad — rotación de secretos en Vercel: 1 hallazgo crítico (llave de Firebase Admin comprometida en el pasado) + 1 bug de build preexistente descubierto en el proceso | Vercel marcó 4 variables como "looks like a secret... consider rotating": `FIREBASE_TOKEN_URI`, `GMAIL_APP_PASSWORD`, `RESEND_API_KEY`, `FIREBASE_PRIVATE_KEY`. Investigación de solo lectura por variable (dónde se usa, impacto de rotar, evidencia de exposición previa en `git log`, sin imprimir ningún valor real): **`FIREBASE_TOKEN_URI`** — falso positivo, es la URL pública fija de OAuth2 de Google (idéntica para cualquier proyecto GCP), ya con fallback hardcodeado en `lib/firebase-admin.ts`; sin acción. **`GMAIL_APP_PASSWORD`** (`lib/emailService.ts`, newsletter) y **`RESEND_API_KEY`** (`lib/email.ts`, contacto) — credenciales reales, un solo punto de consumo cada una, recomendado Sensitive + rotar, sin hallazgo de exposición previa (las 3 solo aparecen una vez en todo el historial de git, en `docs/PROJECT_AUDIT.md`, como nombres de variable con el valor vacío — un checklist, no un valor real). **`FIREBASE_PRIVATE_KEY` — HALLAZGO CRÍTICO:** `git log -S "BEGIN PRIVATE KEY" --all` encontró el marcador de contenido PEM real (no solo el nombre) en el commit `9252a71` (**2025-08-25**), archivo `app/secrets/eskemma-3c4c3-firebase-adminsdk-fbsvc-3d49abeed1.json` — nombre exacto del patrón que genera Firebase al descargar una llave real; `app/secrets/` ya estaba en `.gitignore` desde el primer commit, así que se coló casi con certeza por un `git add -f` manual. Ese commit **no es ancestro de ninguna rama actual** (local ni remota) — solo alcanzable por 2 refs locales de respaldo (`refs/original/refs/heads/main`, creado automáticamente por un `git filter-branch` anterior, y la rama `main-backup`), confirmando que alguna vez se limpió la historia de `main` con éxito; un 3er ref (`version-firebase`) resultó ser el mismo commit, no un hallazgo nuevo. Sin forma de confirmar desde el repo si llegó a estar en GitHub antes de la limpieza — Secret Scanning del repo está **deshabilitado**, así que tampoco hay esa señal. **Cloud Functions confirmado sin exposición**: `functions/src/index.ts` usa `admin.initializeApp()` sin argumentos (Application Default Credentials, identidad separada — `...-compute@developer.gserviceaccount.com`, cero referencias a `FIREBASE_PRIVATE_KEY` en `functions/src`); solo afecta Vercel/Next.js y ~12 scripts locales de mantenimiento (todos leen de `process.env`, ninguno hardcodeado, verificado). Recomendación entregada: rotar YA sin condicionar a nada más (la evidencia ya basta), guía completa paso a paso del procedimiento específico de GCP (generar nueva clave en Firebase Console → actualizar Vercel/`.env` → verificar con `/api/test-admin` → solo entonces revocar la vieja en IAM — a diferencia de Gmail/Resend, generar una clave nueva NO invalida la anterior automáticamente). Borrado de los refs dangling identificado pero explícitamente diferido hasta que Raúl confirme la rotación completa. **Hallazgo aparte, descubierto al intentar verificar la rotación con un deploy real de `develop` en Vercel:** el build falló por un error de TypeScript **sin relación con los secretos** — `scripts/check-geo-cf-sync.ts` (26-09-20) hace `import("../functions/src/utils/estadoCveMap")`, una ruta que existe en disco local pero que `.vercelignore` (desde 26-01-07) excluye del todo en Vercel; como el `tsconfig.json` raíz revisa con TypeScript TODOS los `.ts` del repo en cada `next build` (incluidos los de `scripts/`, aunque la app nunca los importe), este script arrastraba el error a todo el sitio — roto desde el 20 de septiembre, sin relación con ninguna ronda de esta sesión. **Mismo patrón ya usado hoy con `functions/tsconfig.build.json`/`vectorRiesgoV2.test.ts` — precedente para scripts futuros con el mismo problema:** un archivo en `scripts/` cuyo import alcanza algo fuera del alcance real de `next build` (código de `functions/`, u otro directorio excluido) rompe el build de la app aunque nunca se ejecute como parte de ella. **Fix:** agregado `scripts/check-geo-cf-sync.ts` al `exclude` de `tsconfig.json` (raíz) — el script sigue funcionando idéntico al correrlo directo (`npm run check-geo-cf`, motor de TypeScript propio de esa ejecución vía `tsx`), solo deja de ser parte del type-check de la app. Verificado: `npm run check-geo-cf` idéntico a antes, `tsc --noEmit` y `next build` (limpio, sin caché) limpios, 333 pruebas sin regresión. **Estado final (26-09-23):** la rotación de `FIREBASE_PRIVATE_KEY` se ejecutó, la llave comprometida quedó revocada en GCP, los 4 refs locales `refs/original/*` que aún contenían la llave se borraron y el objeto se purgó con `git gc --prune=now` (`main-backup`, verificado limpio con rigor, se dejó intacto), y el fix de `tsconfig.json` quedó commiteado (`5dfadd0`). Lo que pasó después de la rotación (fallos en Vercel por una llave distinta a la sobreviviente) y los pendientes que siguen abiertos están en la fila siguiente. |
| 26-09-23 | Seguridad — post-rotación de `FIREBASE_PRIVATE_KEY`: Vercel usaba una llave que ya no existía en Google (causa raíz, lección de verificación y pendientes abiertos) | **Síntomas (Preview y Production, local sin problema):** novedades del blog vacías en Home, Dashboard de Sefix sin datos, login por usuario y contraseña con "Error interno del servidor", login con Google con "dominio no autorizado", y la advertencia "looks like a secret" persistente. **Causa raíz de los primeros tres (una sola causa):** todos dependen de firebase-admin en el servidor — Home lee los posts con `adminDb` (`app/page.tsx`, con `catch` que devuelve `[]`, por eso la sección quedaba vacía sin error visible), el login por usuario pasa por `/api/auth/find-user` (`adminDb`) y Sefix lee de Admin Storage (`lib/sefix/storage.ts`). `/blog` seguía funcionando porque usa el SDK cliente (`lib/server/posts.server.ts`, `@/firebase/firebaseConfig`), no el Admin. **Evidencia que la confirmó:** (a) `/api/test-admin` devolvía `invalid_grant: Invalid JWT Signature` en ambos entornos — NO `DECODER routines::unsupported`. Con una llave desechable (sin secretos) se comprobó que una llave mal pegada (comillas literales o saltos convertidos en espacios) pasa `cert()` y falla con `DECODER routines::unsupported`, y una truncada o con doble escape falla al importar el módulo; `invalid_grant` significa que la llave se interpreta bien pero su firma no corresponde a ninguna clave activa. (b) La lista pública de claves activas de la cuenta de servicio (`https://www.googleapis.com/robot/v1/metadata/x509/<client_email>`, sin credenciales) mostraba 3 activas (`8c675a50fa`, `16e6f99524`, `aa4821bda6`; las 2 no propias son claves que Google administra), la comprometida `3d49abeed1` ya NO estaba activa, y la llave del `.env` local coincidía (comparando la clave pública) con `16e6f99524`, la única propia sobreviviente — por eso local funcionaba. (c) Raúl confirmó que el valor de Vercel no era el mismo que el del `.env`. Tras pegar en Vercel el valor del `.env` (sin comillas) y redeployar Preview y Production, `/api/test-admin` devolvió `success` en ambos. No se determinó cómo quedó en Vercel una llave distinta (varias generaciones de llave, una entrada duplicada de mayor alcance, o un valor anterior sin actualizar) — irrelevante para el arreglo. **Descartado con evidencia:** `FIREBASE_PRIVATE_KEY_ID` no interviene en la firma (firebase-admin no lo usa y a Firestore solo le pasa `private_key` y `client_email`), así que un ID desactualizado no era la causa. **Técnica de copiado verificada:** para pasar la llave del `.env` a Vercel sin verla ni tocarla a mano, un `node -e` lee la línea de `.env`, quita comillas envolventes, deja los `\n` como texto literal y lo manda a `pbcopy`; Vercel guarda el valor tal cual, así que las comillas del `.env` (que dotenv sí quita) NO deben pegarse. Se validó antes de usarlo que el resultado, tras el `.replace(/\\n/g, "\n")` de `lib/firebase-admin.ts`, coincide con la clave activa. **Síntoma 5 (Google, dominio no autorizado), independiente de la llave:** es `auth/unauthorized-domain` del SDK cliente (`context/AuthContext.tsx`), contra la lista Authentication → Settings → Authorized domains de Firebase, que NO admite comodines. Estaban `eskemma.com` y `www.eskemma.com`; fallaba al entrar por los alias de Vercel (`eskemma-git-develop-raulsansals-projects.vercel.app`, `eskemma-git-main-raulsansals-projects.vercel.app`). Se agregan esos dos alias estables de rama (uno cubre todos los previews de la rama; no agregar las URLs con hash por deployment). **Lección de verificación (aplica a toda rotación de credenciales):** `/api/test-admin`, o cualquier prueba de "¿funciona la credencial nueva?", NO confirma una rotación mientras la vieja siga activa — el éxito no distingue cuál de las dos se está usando. Aquí pasó en ambos entornos con la llave vieja o con una que después se borró, y el error solo apareció cuando la vieja se revocó. La verificación válida es probar DESPUÉS de que la vieja ya no pueda usarse (o con la vieja deliberadamente inválida), nunca mientras coexisten. Orden a seguir: (1) comprobar que la credencial nueva es válida por sí sola (por ejemplo desde local, o comparando su clave pública contra las claves activas), (2) ponerla en Vercel y redeployar, (3) revocar la vieja, (4) probar en el entorno real; si falla, la nueva sigue viva y basta volver a pegarla. **Pendientes explícitamente abiertos (no son olvidos):** (1) **Advertencia "looks like a secret" de `FIREBASE_PRIVATE_KEY` y `FIREBASE_TOKEN_URI` en Vercel** — se resuelve guardándolas como Sensitive ("Sensitive" y "rotar" son acciones distintas: la advertencia depende del tipo de almacenamiento, no del valor, y persiste aunque se haya rotado). Pospuesto a propósito para no volver a tocar el valor de la llave mientras todo está recién estabilizado, porque guardar como Sensitive implica re-ingresar el valor. Al hacerlo, repetir el procedimiento verificado (portapapeles, pegar sin comillas, redeploy de Preview y Production, `/api/test-admin`, que ahora sí es confiable porque la vieja está revocada) y comprobar en la documentación de Vercel si Sensitive aplica al entorno Development. Nota: `FIREBASE_TOKEN_URI` es la URL pública fija de OAuth2 de Google, no un secreto — el aviso es un falso positivo por el nombre, y `lib/firebase-admin.ts` ya trae ese valor como fallback, así que también podría eliminarse. (2) **Rotación de `GMAIL_APP_PASSWORD` y `RESEND_API_KEY`** (guías completas ya entregadas; consumidores: `lib/emailService.ts` para newsletter y `lib/email.ts` para contacto) — pausada por decisión de secuencia: se retoma cuando se trabaje la estrategia de comunicación del newsletter, en otra sesión. Sin evidencia de exposición previa de ninguna de las dos. Al retomarla, aplicar la lección de verificación de arriba. **Sin cambios de código en esta fila** (solo configuración en Vercel/Firebase y documentación). |
| 26-09-23 | Ronda de ajustes menores: guard de `createProject`, badges del hub de Moddulo, abreviaturas de estado unificadas | **1 — Seguridad:** `createProject` ya no escribe sobre un `pestel_projects` ajeno (lee y exige `userId === uid` antes de persistir; 404 en la ruta); regresión permanente (6 casos, verificados en negativo: sin el guard fallan 3) y escaneo de solo lectura de Firestore real con 0 enlaces cross-tenant; fixture `adminMocks.ts` gana `add()`. Detalle en Seguridad. **2 — Badges:** `draft` 2.23:1 → 6.20:1 claro / 6.56:1 oscuro (antes sin `dark:`); `archived` `dark:text` de `#9AAEBE` (4.26:1) a `#C7D6E0`. Quitado de "no tocado y ya defectuoso". **3 — Abreviaturas:** módulo puro `lib/geo/abreviaturasEstado.ts` (tabla de 32 códigos fijada por Raúl; `EDOMEX` y `COLI`, `MEX`/`COL` reservados a países) con 3 formas por contexto; migrados `OrigenCharts` (solo valores; llaves y orden de `RECEPTOR_ORDER`/`ORIGIN_SUFFIXES` intactos, fijados verbatim en test), `lib/moddulo/abreviaturaEstado.ts` (elimina `ABREVIATURA_ESTADO_POR_CVE`, sin importadores) y la prosa de `semanalUtils` (nombres completos salvo CDMX; `ESTADOS_ABBR` eliminada). Confirmado por grep que ningún proceso de lectura de datos usa estos códigos (solo display), por lo que Colima pudo pasar a `COLI`. Tests: `abreviaturasEstado.test.ts` (tabla definitiva, únicos, sin ISO3 conocido, 3 formas de una tabla, llaves/orden, ratchet de literales viejos); fixture de `normalizadoresSueltos.test.ts` actualizado (3 valores deliberados). Medición real en Chrome/Arimo 9 px: `EDOMEX` 39.02 px; columna de etiquetas de fila 44 → 48 px. Se descubrió al probar que JS ordena las llaves `"10".."32"` antes de `"01".."09"` (el test compara por lookup). Nota registrada, NO implementada: reconocimiento de entrada del Estado de México (Punto 2 de la agenda). `check-geo-cf` (copia de Cloud Functions intacta), `tsc`, `next build`, functions build/test (20) y 354 pruebas limpios; `check-docs-freshness` 0 desactualizadas. **Revisión de código:** corregidos 2 hallazgos propios (sort duplicado en vez de `ESTADOS_ALFABETICOS`; export sin uso). **Pendiente de Raúl (navegador):** hub de Moddulo con un proyecto en borrador y uno archivado, claro y oscuro; heatmap de origen de Sefix con `EDOMEX`/`COLI` en eje y filas; encabezado del padrón en Moddulo F2 ("…, COLI." si aplica). |

# Plan de Ingeniería de Software
## PESTEL - Sistema de Monitoreo PEST-L en Tiempo Real

**Eskemma**  
El ecosistema digital para tu proyecto político

**Versión:** 1.0  
**Fecha:** Marzo 2026

---


## 1. INFORMACIÓN GENERAL 

### 1.1 Nombre de la Aplicación 

**PESTEL** - Monitoreo Configurable de Contexto Político, Económico y Social en Tiempo Real

### 1.2 Objetivo 

Proveer análisis cruzado automatizado de coyunturas, tendencias y agenda pública con filtros multiescala (Nacional \> Estatal \> Municipal \> Distrito) para alimentar procesos de planeación estratégica y toma de decisiones en comunicación política.

**Alcance geográfico:** - **v1 (MVP)**: México únicamente - **v2**: Expansión a Iberoamérica con fuentes equivalentes por país

### 1.3 Beneficio para el Usuario Final 

-   **Visibilidad 360° del entorno**: Monitoreo continuo de variables PEST-L sin necesidad de consultar múltiples fuentes manualmente
-   **Detección temprana de riesgos**: Alertas sobre cambios en el clima social, presión mediática o indicadores económicos locales
-   **Decisiones basadas en datos**: Matriz PEST-L actualizada y vector de riesgo cuantificado por territorio
-   **Ahorro de tiempo**: Automatización del levantamiento de contexto que tradicionalmente requiere días de investigación

### 1.4 Beneficio para el Ecosistema Eskemma 

-   **Alimentación automática de Moddulo**: Inyecta contexto actualizado en las fases de Análisis Externo y Matriz FODA de la metodología Tercera Vía
-   **Base de conocimiento centralizada**: Repositorio histórico de tendencias para análisis longitudinales
-   **Diferenciador competitivo**: Capacidad única en el mercado iberoamericano de consultoría política
-   **Integración transversal**: Provee insumos para múltiples aplicaciones del ecosistema (FODA, Análisis de Riesgos, Monitoreo de Reputación)

## 2. ANÁLISIS DE NEGOCIO Y REQUISITOS 

### 2.1 Levantamiento 

#### Stakeholders 

1.  **Usuario Principal**: Consultor político / Equipo de campaña
2.  **Usuario Secundario**: Candidato / Servidor público (modo lectura)
3.  **Administrador del Sistema**: Equipo técnico Eskemma
4.  **Fuentes de Datos**: Medios locales, boletines oficiales, APIs de indicadores económicos públicos

#### Problema Principal 

Los consultores políticos carecen de una herramienta unificada que permita monitorear en tiempo real el contexto PEST-L a nivel multiescala, lo que resulta en análisis desactualizados, sesgo de confirmación por fuentes limitadas, y retraso en la detección de cambios coyunturales críticos.

### 2.2 Requerimientos Funcionales 

-   **RF-001**: El sistema debe permitir al usuario configurar un perímetro geográfico (Nacional, Estatal, Municipal, Distrito)

-   **RF-002**: El sistema debe ejecutar web scraping dinámico de medios locales y regionales a través de Google News RSS

-   **RF-003**: El sistema debe consumir APIs públicas de indicadores macroeconómicos (Banxico, INEGI) y microeconómicos locales

-   **RF-004**: El sistema debe rastrear tendencias territoriales usando Google Trends

-   **RF-005**: El sistema debe recopilar boletines oficiales de gobierno vía RSS del Diario Oficial de la Federación (DOF)

-   **RF-006**: El sistema debe clasificar automáticamente la información en categorías PEST-L usando Claude API

-   **RF-007**: El sistema debe generar una Matriz PEST-L con factores identificados, impacto y tendencia

-   **RF-008**: El sistema debe calcular un Vector de Riesgo de Entorno con índices de "Presión Social" y "Clima de Inversión" por territorio

-   **RF-009**: El sistema debe presentar un Dashboard de Coyuntura con visualizaciones interactivas (gráficos de tendencias, mapas de calor, líneas de tiempo)

-   **RF-010**: El sistema debe permitir la configuración de alertas personalizadas (umbral de noticias negativas, caída en indicadores económicos) con dos mecanismos de notificación: **(a) email** vía Firebase Extension "Trigger Email" y **(b) notificación in-app** visible en el dashboard al recargar

-   **RF-011**: El sistema debe exportar la Matriz PEST-L en formato JSON y PDF

-   **RF-012**: El sistema debe mantener un historial de análisis PEST-L para comparación temporal

-   **RF-013**: El usuario debe poder seleccionar entre "Modo Ciudadano" (enfoque en percepción ciudadana) y "Modo Gubernamental" (enfoque en gestión pública)

-   **RF-014**: El sistema debe inyectar automáticamente el análisis PEST-L en los módulos de Análisis Externo y Matriz FODA de Moddulo a través de pestel_feeds

-   **RF-015**: El sistema debe permitir la adición manual de factores PEST-L identificados por el usuario

### 2.3 Requerimientos No Funcionales 

-   **RNF-001**: El dashboard debe cargar en menos de 3 segundos con conexión estándar (50 Mbps)

-   **RNF-002**: El web scraping debe ejecutarse en Firebase Cloud Functions sin bloquear la interfaz de usuario

-   **RNF-003**: El sistema debe soportar al menos 100 usuarios concurrentes sin degradación de rendimiento

-   **RNF-004**: Los datos recopilados deben actualizarse con una frecuencia mínima de 6 horas mediante jobs programados

-   **RNF-005**: El sistema debe cumplir con GDPR y Ley Federal de Protección de Datos Personales (México) en el manejo de información

-   **RNF-006**: La API de scraping debe implementar rate limiting para evitar baneos de fuentes

-   **RNF-007**: El sistema debe ser responsive y funcional en dispositivos móviles (tablets, smartphones)

-   **RNF-008**: Los datos sensibles de configuración deben almacenarse encriptados en Firebase

-   **RNF-009**: El código debe seguir los estándares de TypeScript con ESLint configurado

-   **RNF-010**: El sistema debe mantener logs de auditoría de cambios en configuración de monitoreo

### 2.4 Historias de Usuario 

-   **HU-001**: Como usuario, quiero configurar mi perímetro geográfico de monitoreo, para enfocar el análisis en el territorio de mi campaña.

-   **HU-002**: Como usuario, quiero visualizar un dashboard con las tendencias PEST-L de la última semana, para identificar cambios coyunturales relevantes.

-   **HU-003**: Como usuario, quiero recibir alertas cuando el índice de "Presión Social" supere un umbral definido —por email y mediante un banner visible en el dashboard— para anticipar crisis reputacionales sin necesidad de revisar la app constantemente.

-   **HU-004**: Como usuario secundario, quiero ver un resumen ejecutivo de la Matriz PEST-L en formato visual, para comprender el contexto sin revisar datos técnicos.

-   **HU-005**: Como usuario, quiero comparar el Vector de Riesgo actual con el de hace 30 días, para medir la evolución del entorno.

-   **HU-006**: Como usuario de Moddulo, quiero que el análisis PEST-L se inyecte automáticamente en mi proyecto de comunicación a través de The Feed, para ahorrar tiempo en el levantamiento de contexto.

-   **HU-007**: Como usuario, quiero agregar manualmente un factor PEST-L que no fue detectado automáticamente, para completar el análisis con conocimiento local.

-   **HU-008**: Como administrador del sistema, quiero configurar las fuentes de scraping para un nuevo territorio, para expandir la cobertura geográfica del servicio.

-   **HU-009**: Como usuario, quiero exportar la Matriz PEST-L en PDF, para incluirla en presentaciones a clientes.

-   **HU-010**: Como usuario, quiero seleccionar "Modo Gubernamental", para recibir análisis enfocado en gestión pública en lugar de percepción ciudadana.

## 3. DISEÑO FUNCIONAL (CASOS DE USO) 

### 3.1 Diagrama de Casos de Uso 

**Actores principales:**

-   Consultor Político (Principal)

-   Candidato (Secundario - lectura)

-   Sistema (Automatización vía Firebase Cloud Functions)

-   Administrador Eskemma (Configuración)

**Casos de uso principales:**

-   Configurar Perímetro Geográfico

-   Definir Fuentes de Datos

-   Ejecutar Monitoreo Automático (Firebase Cloud Functions)

-   Clasificar en PEST-L (Claude API)

-   Generar Matriz PEST-L

-   Calcular Vector de Riesgo

-   Visualizar Dashboard

-   Configurar Alertas

-   Agregar Factor Manual

-   Exportar Matriz

-   Comparar Histórico

-   Inyectar en Moddulo vía The Feed

!{width="7.172916666666667in" height="2.4458333333333333in"}

!{width="3.513888888888889in" height="6.611111111111111in"}!{width="3.013888888888889in" height="7.166666666666667in"}

!{width="3.9583333333333335in" height="7.166666666666667in"}!{width="3.513888888888889in" height="7.347222222222222in"}

### 3.2 Narrativas de Casos de Uso 

#### CU-001: Configurar Monitoreo de Territorio 

**Actor Principal**: Consultor Político

**Precondiciones**: Usuario autenticado en Eskemma con suscripción Premium/Profesional

**Disparador**: Usuario accede a `/centinela/pestel` por primera vez o desea cambiar configuración

!{width="2.625in" height="5.097222222222222in"}**Flujo Principal (Camino Feliz)**:

1.  Usuario selecciona "Nuevo Monitoreo"

2.  Sistema presenta formulario de configuración

3.  Usuario selecciona perímetro geográfico

> (ej: "Jalisco \> Distrito 10")

4.  Usuario define indicadores económicos a monitorear (ej: "Inflación local", "Precio de gasolina")

5.  Usuario establece volumen de noticias negativas como alerta (ej: "\>5 noticias/día con sentimiento negativo")

6.  Usuario selecciona modo: "Ciudadano"

> o "Gubernamental"

7.  Sistema valida que el territorio tiene fuentes disponibles

8.  Sistema guarda configuración en `pestel_configs/{configId}`

9.  Sistema confirma configuración guardada

10. Sistema programa primer ciclo de monitoreo en Firebase Cloud Functions

**Flujos Alternos**:

-   **3a**: Si el territorio no tiene fuentes configuradas, el sistema ofrece contactar al administrador

-   **7a**: Si falta configurar APIs necesarias, el sistema solicita keys de APIs externas

**Postcondiciones**: Monitoreo configurado y ejecutándose cada 6 horas vía Cloud Scheduler

#### CU-002: Visualizar Dashboard de Coyuntura 

**Actor Principal**: Consultor Político\
**Precondiciones**: Al menos un ciclo de monitoreo completado (existe registro en `pestel_feeds`)\
**Disparador**: Usuario accede a `/centinela/pestel/dashboard`

**Flujo Principal**:

1.  Sistema carga datos del último análisis PEST-L desde `pestel_feeds`

2.  Sistema presenta 5 paneles principales:

-   **Panel Político**: Noticias clave, análisis de agenda gubernamental, actores políticos, escenarios electorales, agenda internacional, tendencias legislativas.

-   **Panel Económico**: Gráficos de indicadores (inflación, empleo), comparación vs nacional

-   **Panel Social**: Mapa de calor de tendencias Google, volumen de conversación por tema

-   **Panel Tecnológico**: innovaciones tecnológicas relevantes

-   **Panel Legal**: Cambios normativos DOF, proyectos de ley

3.  Sistema muestra Vector de Riesgo con semáforo (Verde/Amarillo/Rojo)

```{=html}
<!-- -->
```
5.  Usuario interactúa con gráficos (hover para detalles, click para profundizar)

6.  Usuario puede filtrar por rango de fechas

7.  Usuario puede descargar visualizaciones como PNG

**Flujos Alternos**:

-   **2a**: Si no hay datos recientes (\>24 horas), el sistema ofrece ejecutar análisis manual vía API trigger

-   **4a**: Si el usuario detecta información incorrecta, puede reportarla para revisión

**Postcondiciones**: Usuario tiene visibilidad del contexto actualizado

####  

#### CU-003: Generar y Exportar Matriz PEST-L 

**Actor Principal**: Consultor Político\
**Precondiciones**: Dashboard cargado con datos\
**Disparador**: Usuario selecciona "Generar Matriz PEST-L" en `/centinela/pestel/export`

**Flujo Principal**:

1.  Sistema recopila factores identificados en cada categoría PEST-L desde `pestel_feeds.pestl`

```{=html}
<!-- -->
```
1.  Sistema clasifica factores por impacto (Alto/Medio/Bajo) usando análisis de sentimiento Claude

2.  Sistema presenta matriz en formato tabla editable

3.  Usuario revisa factores automáticos

4.  Usuario agrega factores manuales (botón "+ Agregar Factor")

5.  Usuario ajusta clasificación de impacto si es necesario

6.  Usuario selecciona formato de exportación (PDF, JSON, CSV)

7.  Sistema genera documento con branding de Eskemma

8.  Sistema descarga archivo y guarda copia en historial del proyecto

**Flujos Alternos**:

-   **3a**: Si el sistema detecta menos de 3 factores en alguna categoría, muestra advertencia

-   **7a**: Si selecciona JSON, el sistema valida compatibilidad con esquema de Moddulo

-   **9a**: Si la exportación falla, el sistema guarda versión temporal en caché

**Postcondiciones**: Matriz PEST-L disponible para uso en Moddulo y presentaciones

*\
*

####  

#### CU-004: Inyección Automática en Moddulo vía The Feed 

**Actor Principal**: Sistema (automatizado)\
**Precondiciones**: Usuario tiene proyecto activo en Moddulo en Fase 2 (Exploración)\
**Disparador**: Ciclo de monitoreo completado en PESTEL (nuevo registro en `pestel_feeds`)

**Flujo Principal**:

1.  Firebase Cloud Function detecta nuevo feed en `pestel_feeds` (trigger onWrite)

2.  Sistema verifica si el usuario tiene proyectos activos en `moddulo_projects`

3.  Sistema marca feed como `syncedToModdulo: true`

4.  Moddulo F2 carga al abrir: `GET /api/centinela/pestel/feed?userId=X&territorio=Y`

5.  API retorna feed más reciente según territorio configurado en proyecto

6.  Sistema inyecta datos en `xpctoContext` de Moddulo

7.  Claude usa contexto PEST-L actualizado en análisis de Fase 2

8.  Widget "PESTEL" aparece en sección Político (patrón SefixWidget)

**Flujos Alternos**:

-   **2a**: Si el territorio no coincide, sistema no inyecta y espera siguiente análisis

-   **5a**: Si no hay feed reciente (\<48h), sistema retorna feed más antiguo con advertencia

**Postcondiciones**: Moddulo cuenta con análisis externo actualizado sin intervención manual

## 4. PROCESO DE DESARROLLO DE SOFTWARE 

### 4.1 Stack Tecnológico 

#### Frontend 

-   **Framework**: Next.js 16.1 (App Router)
-   **Library**: React 19
-   **Language**: TypeScript 5.x
-   **Styling**: Tailwind CSS 4.x + shadcn/ui
-   **Components**: Componentes reutilizables de Eskemma
-   **Charts**: Recharts / Chart.js
-   **State**: Zustand o React Context API

#### Backend 

-   **Runtime**: Next.js API Routes (Edge Functions) para endpoints públicos
-   **Background Processing**: Firebase Cloud Functions Gen2 (Node.js 20)
-   **Database**: Firebase Firestore
-   **Storage**: Firebase Storage
-   **Auth**: Firebase Auth (sesiones con cookies, ya configurado en Eskemma)
-   **Scheduler**: Cloud Scheduler para monitoreo cada 6 horas

#### Scraping & Procesamiento 

-   **Library**: Puppeteer (ya en package.json) ejecutado en Cloud Functions
-   **Queue**: Firebase Cloud Tasks para cola de scraping
-   **Clasificación**: Claude API (Sonnet 4) vía `@anthropic-ai/sdk` (ya instalado)
-   **Cache**: Firestore con TTL de 6 horas

#### APIs Externas (México v1 - GRATIS) 

  ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------
  Dimension PEST-L   Fuente                             Costo    Endpoint
  ------------------ ---------------------------------- -------- ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------
  Político           Google News RSS por territorio     Gratis   https://news.google.com/rss/search?q={query}+when:7d&hl=es-MX&gl=MX&ceid=MX:es-419` `

  Político           Scraping portales oficiales        Gratis   Congreso, INE, gobiernos estatales

  Económico          API REST de Banxico                Gratis   https://www.banxico.org.mx/SieAPIRest/service/v1/series/{serie}/datos` `

  Económico          API del INEGI (BIE)                Gratis   https://www.inegi.org.mx/app/api/indicadores/desarrolladores/jsonxml/INDICATOR/{id}

  Social             Google News RSS (temas sociales)   Gratis   Same as Político con queries específicas

  Tecnológico        Google Trends por territorio       Gratis   <https://trends.google.com/trends/trendingsearches/daily/rss?geo=MX>` ` *(RSS no oficial — fuente opcional/best-effort; puede fallar sin aviso; no bloquea MVP)*

  Legal              DOF RSS (Diario Oficial)           Gratis   <https://www.dof.gob.mx/rss/rss.php>` `
  ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------

**Nota**: Para v2 (Iberoamérica), cada país tendrá fuentes equivalentes (Bancos Centrales, gacetas oficiales, portales de congreso).

#### Deployment 

-   **Hosting**: Vercel (mismo proyecto que Eskemma)
-   **Domain**: `eskemma.com/centinela/``pestel` (rutas internas)
-   **CDN**: Vercel Edge Network
-   **Functions**: Firebase Cloud Functions desplegadas vía `firebase deploy --only functions`

### 4.2 Arquitectura de la Aplicación 

#### Estructura de Directorios 

    /app
    ├── /centinela
    │   ├── /pestel
    │   │   ├── page.tsx                    	# Dashboard principal
    │   │   ├── /configurar
    │   │   │   └── page.tsx                	# Configuración de monitoreo
    │   │   ├── /analisis
    │   │   │   └── id]/page.tsx           	# Historial de análisis
    │   │   └── /export
    │   │       └── page.tsx                	# Exportación de Matriz PEST-L
    │   └── page.tsx                        	# Página principal Centinela
    ├── /api
    │   ├── /centinela
    │   │   ├── /pestel
    │   │   │   ├── /feed
    │   │   │   │   └── route.ts            	# GET feed para Moddulo
    │   │   │   ├── /trigger
    │   │   │   │   └── route.ts            	# POST trigger manual
    │   │   │   └── /status
    │   │   │       └── route.ts            	# GET status de jobs
    │   │   └── /sefix                       	# Existing
    │   └── /moddulo                        	 # Existing

    /components
    ├── /centinela
    │   ├── /pestel
    │   │   ├── /dashboard
    │   │   │   ├── PESTLPanel.tsx
    │   │   │   ├── RiskVectorWidget.tsx
    │   │   │   └── TrendChart.tsx
    │   │   ├── /config
    │   │   │   └── TerritorioSelector.tsx
    │   │   └── /export
    │   │       └── MatrizExporter.tsx

    /lib
    ├── /centinela
    │   ├── /pestel
    │   │   ├── /scraper
    │   │   │   ├── googleNewsRSS.ts
    │   │   │   ├── inegi.ts
    │   │   │   ├── banxico.ts
    │   │   │   └── dof.ts
    │   │   ├── /classifier
    │   │   │   └── claudePESTL.ts          	# Claude API clasificación
    │   │   ├── /risk
    │   │   │   └── vectorCalculator.ts
    │   │   └── /types
    │   │       └── pestel.ts

    /functions
    ├── /src
    │   ├── /pestel
    │   │   ├── scrapeAndAnalyze.ts         	# Cloud Function principal
    │   │   ├── scheduledMonitor.ts         	# Trigger programado
    │   │   └── feedSync.ts                 		# Webhook Firestore → Moddulo
    │   └── index.ts                        		# Exports

#### Diagrama de Arquitectura: Flujo de Scraping 


    Next.js App (Vercel)                    Firebase Cloud Functions (Gen2)
         │                                           │
         │  POST /api/centinela/pestel/trigger     │
         │ ────────────────────────────────────────► │ scrapeAndAnalyze()
         │  { userId, configId }                    │
         │                                           │ 1. Lee pestel_configs
         │  { jobId: "xxx" }                        │ 2. Crea pestel_jobs (pending)
         │ ◄────────────────────────────────────────  │
         │                                           │ 3. Scraping en paralelo:
         │                                           │    - Google News RSS
         │                                           │    - INEGI API
         │                                           │    - Banxico API
         │                                           │    - DOF RSS
         │                                           │    - Google Trends
         │                                           │
         │                                           │ 4. Clasificación Claude API
         │                                           │    - Categoriza en P/E/S/T/L
         │                                           │    - Calcula Vector de Riesgo
         │                                           │
         │                                           │ 5. Guarda pestel_feeds
         │                                           │ 6. Actualiza pestel_jobs (completed)
         │                                           │
         │  GET /api/centinela/pestel/status        │
         │ ────────────────────────────────────────► │
         │  { status, feedId }                      │ Lee pestel_jobs
         │ ◄────────────────────────────────────────  │

!{width="5.441666666666666in" height="4.3125in"}

#### Diagrama de Arquitectura: Integración con Moddulo 


    PESTEL                           Firestore                      Moddulo F2 (Exploración)
        │                                   │                                 │
        │ 1. scrapeAndAnalyze()             │                                 │
        │ ─────────────────────────────────►│ pestel_feeds/{feedId}       │
        │   Guarda análisis PEST-L          │ { pestl, vectorRiesgo, ... }   │
        │                                   │                                 │
        │                                   │                                 │ 2. Usuario abre F2
        │                                   │                                 │
        │                                   │  GET /api/centinela/pestel/feed│
        │                                   │◄─────────────────────────────────│
        │                                   │  ?userId=X&territorio=Y         │
        │                                   │                                 │
        │                                   │  { pestl, vectorRiesgo, ... }   │
        │                                   │─────────────────────────────────►│
        │                                   │                                 │
        │                                   │                                 │ 3. Inyecta en xpctoContext
        │                                   │                                 │
        │                                   │                                 │ 4. Widget "PESTEL"
        │                                   │                                 │    en sección Político
        │                                   │                                 │    (patrón SefixWidget)

### !{width="5.190277777777778in" height="4.4944444444444445in"} 

### 4.3 Ambientes 

  ---------------------------------------------------------------------------------------------------------------------------------
  Ambiente         URL                                               Propósito                     Base de Datos
  ---------------- ------------------------------------------------- ----------------------------- --------------------------------
  **Desarrollo**   `http://localhost:3000/centinela/pestel`         Desarrollo local, pruebas     Firebase Emulator Suite

  **Staging**      `https://staging.eskemma.com/centinela/pestel`   Pruebas de integración, UAT   Firebase (proyecto staging)

  **Producción**   `https://eskemma.com/centinela/pestel`           Usuarios finales              Firebase (proyecto producción)
  ---------------------------------------------------------------------------------------------------------------------------------

**Variables de Entorno** (`.env.local`):

    # Firebase (ya configurado en Eskemma)
    NEXT_PUBLIC_FIREBASE_API_KEY=
    NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN=
    NEXT_PUBLIC_FIREBASE_PROJECT_ID=
    FIREBASE_ADMIN_SDK_KEY=

    # APIs Externas (México v1)
    INEGI_TOKEN=                          	# Token BIE INEGI
    BANXICO_TOKEN=                        # Token API Banxico

    # Claude API (ya configurado)
    ANTHROPIC_API_KEY=

    # Cloud Functions
    FIREBASE_FUNCTIONS_URL=https://us-central1-{project}.cloudfunctions.net

###  

### 4.4 Control de Versiones 

**Estrategia de Ramas (Git Flow Simplificado)**:

    Main (producción)
      ↑
    develop (integración)
      ↑
    feature/pestel-001-config-ui
    feature/pestel-002-scraper-functions
    feature/pestel-003-claude-classifier
    feature/pestel-004-dashboard-ui
    bugfix/pestel-101-scraper-timeout

**Convención de Commits**:

Formato: `YY-MM-DD. tipo(scope): descripción`

    26-03-25. feat(pestel/dashboard): add risk vector visualization
    26-03-26. fix(pestel/scraper): handle INEGI API timeout with retry logic
    26-03-27. docs(pestel): update integration README
    26-04-01. refactor(pestel/classifier): optimize Claude API batching
    26-04-02. test(pestel/pestl): add unit tests for matrix generation

**Pull Request (PR) Workflow**:

1.  Desarrollador crea feature branch desde `develop`

2.  Implementa funcionalidad con commits atómicos

3.  Ejecuta pruebas locales (`npm run test`)

4.  Crea PR hacia `develop` con descripción de cambios

5.  Revisión de código (code review) - opcional si equipo pequeño

6.  Merge a `develop` tras aprobación

7.  Deploy automático a Staging (Vercel)

8.  Tras UAT exitoso, merge `develop` → `main` (deploy a producción)

## 5. PLAN DE PRUEBAS (QA) 

### 5.1 Pruebas Unitarias 

**Framework**: Jest + React Testing Library\
**Cobertura Mínima**: 70% del código crítico

**Casos Prioritarios**:

    // tests/lib/pestel/classifier.test.ts
    describe('PEST-L Classifier (Claude API)', () => {
      test('should classify political news correctly', async () => {
        const newsItem = {
          title: "Presidente anuncia reforma electoral",
          content: "El gobierno propone cambios al sistema..."
        };
        const result = await classifyWithClaude(newsItem);
        expect(result.categories).toContain('Político');
      });

      test('should handle mixed categories', async () => {
        const newsItem = {
          title: "Nueva ley de impuestos afecta tecnológicas",
          content: "..."
        };
        const result = await classifyWithClaude(newsItem);
        expect(result.categories).toContain('Legal');
        expect(result.categories).toContain('Tecnológico');
      });
    });

    // tests/lib/pestel/risk.test.ts
    describe('Risk Vector Calculator', () => {
      test('should calculate high risk with negative sentiment spike', () => {
        const data = {
          negativeSentimentCount: 25,
          threshold: 10,
          economicIndicators: { inflation: 8.5 }
        };
        expect(calculateRiskVector(data).level).toBe('high');
      });
    });

    // tests/functions/pestel/scraper.test.ts
    describe('Google News RSS Scraper', () => {
      test('should parse RSS feed correctly', async () => {
        const feed = await fetchGoogleNewsRSS('Jalisco política');
        expect(feed.items).toHaveLength(greaterThan(0));
        expect(feed.items0]).toHaveProperty('title');
        expect(feed.items0]).toHaveProperty('link');
      });
    });

### 5.2 Pruebas de Humo (Smoke Tests) 

Ejecutar antes de cada deploy a Staging/Producción:

-   **ST-001**: Login con usuario de prueba → debe redirigir a `/centinela/pestel`

-   **ST-002**: Configurar nuevo monitoreo → debe guardar en `pestel_configs`

-   **ST-003**: Trigger scraping manual vía `/``api``/centinela/``pestel``/trigger` → debe crear job y retornar jobId

-   **ST-004**: Generar Matriz PEST-L → debe exportar PDF descargable

-   **ST-005**: Verificar inyección en Moddulo → GET `/api/centinela/pestel/feed` debe retornar datos válidos

**Herramienta**: Cypress o Playwright para E2E automatizados

    // cypress/e2e/pestel/smoke.cy.ts
    describe('Smoke Tests - PESTEL', () => {
      it('User can configure monitoring', () => {
        cy.login('test@eskemma.com', 'password');
        cy.visit('/centinela/pestel/configurar');
        cy.get('data-testid="territorio-select"]').select('Jalisco');
        cy.get('data-testid="save-config"]').click();
        cy.contains('Configuración guardada').should('be.visible');
      });

      it('Can trigger manual scraping', () => {
        cy.login('test@eskemma.com', 'password');
        cy.visit('/centinela/pestel');
        cy.get('data-testid="trigger-scraping"]').click();
        cy.contains('Análisis iniciado').should('be.visible');
      });
    });

### 5.3 Pruebas de Aceptación (UAT) 

**Participantes**: 2-3 consultores políticos (beta testers)\
**Duración**: 1 semana\
**Criterios de Aceptación**:

  ----------------------------------------------------------------------------------------------------------------------------------------------------------------
  ID        Criterio                                                                   Método de Validación
  --------- -------------------------------------------------------------------------- ---------------------------------------------------------------------------
  UAT-001   El dashboard muestra datos reales de territorio configurado                Verificación visual + comparación con fuentes originales (INEGI, Banxico)

  UAT-002   El Vector de Riesgo refleja cambios en el entorno (ej: paro de maestros)   Caso de prueba con evento real reciente

  UAT-003   La exportación PDF es profesional y legible en móvil                       Revisión de formato en 3 dispositivos

  UAT-004   Las alertas se reciben en menos de 30 minutos tras disparador              Simular caída de indicador económico

  UAT-005   La integración con Moddulo actualiza datos sin duplicados                  Revisar proyecto de prueba en Moddulo F2
  ----------------------------------------------------------------------------------------------------------------------------------------------------------------

**Formato de Reporte UAT**:

    Tester: Nombre]
    Fecha: DD/MM/YYYY]
    Criterio: UAT-002
    Status: ✅ Aprobado / ⚠️ Con observaciones / ❌ Rechazado
    Comentarios: "El vector detectó correctamente el paro, pero la 
    clasificación como 'Social' debería considerar también 'Político' 
    dado que involucra negociación con gobierno."
    Acción: Ajustar lógica de clasificación multi-categoría en Claude prompt.

### 5.4 Pruebas de Seguridad (Security Testing) 

**Checklist Básico**:

\ \] Validación de inputs en todos los formularios (prevención XSS)

\ \] Sanitización de URLs antes de scraping (prevención SSRF)

\ \] Almacenamiento encriptado de API tokens en Firebase

\ \] Rate limiting en endpoints de trigger (max 10 req/min por usuario)

\ \] Validación de tokens de sesión en cada request a `/api/centinela/pestel/*`

\ \] Firestore Security Rules: solo owner puede leer `pestel_configs`

**Herramientas**: OWASP ZAP (escaneo automático), revisión manual de código

## 6. DOCUMENTACIÓN DE ENTREGA 

### 6.1 Manual de Usuario (Base para Tutorial) 

**Estructura del Manual**:

#### Capítulo 1: Introducción 

-   ¿Qué es PESTEL?
-   Beneficios del monitoreo PEST-L automatizado
-   Requisitos técnicos (navegador, conexión)

#### Capítulo 2: Configuración Inicial 

-   **Paso 1**: Acceder a PESTEL desde `/centinela/pestel`
-   **Paso 2**: Seleccionar territorio a monitorear
    -   Screenshots con ejemplo: "Jalisco \> Zapopan \> Distrito 10"
-   **Paso 3**: Definir indicadores económicos
    -   Tabla de indicadores disponibles (INEGI, Banxico)
-   **Paso 4**: Configurar alertas
    -   Ejemplo: "Alertar si Vector de Riesgo \>70"
-   **Paso 5**: Elegir modo de análisis
    -   Diferencias entre "Modo Ciudadano" y "Modo Gubernamental"

#### Capítulo 3: Uso del Dashboard 

-   **3.1** Interpretación de la Matriz PEST-L
    -   Código de colores (impacto alto/medio/bajo)
    -   Ejemplo de factor político: "Reforma electoral aprobada"
-   **3.2** Comprensión del Vector de Riesgo
    -   Fórmula: `Riesgo = f(SentimientoNegativo, VolatilidadEconómica, EstabilidadPolítica)`
    -   Semáforo: Verde (0-30), Amarillo (31-70), Rojo (71-100)
-   **3.3** Interacción con gráficos
    -   Clic en barra de "Noticias Económicas" → detalle de fuentes

#### Capítulo 4: Exportación e Integración 

-   **4.1** Exportar Matriz PEST-L en PDF
    -   Botón "Exportar" → Seleccionar formato → Descargar
-   **4.2** Sincronización con Moddulo
    -   Verificar que el análisis se refleja en "Análisis Externo" de F2
    -   Widget "PESTEL" en sección Político

#### Capítulo 5: Resolución de Problemas 

-   **Problema**: "No se muestran datos en el dashboard"
    -   **Solución**: Verificar que el monitoreo se ejecutó (ver timestamp de última actualización)

```{=html}
<!-- -->
```
-   **Problema**: "El scraper falla en fuente X"
    -   **Solución**: Reportar a soporte técnico con captura de pantalla del error

**Formato**: PDF interactivo con índice clickeable, \~15-20 páginas

### 6.2 Diccionario de Datos 

#### Colección: `pestel_configs` 

Almacena configuraciones de monitoreo por usuario.

  ----------------------------------------------------------------------------------------------------------------------------------------------
  Campo                          Tipo        Descripción                          Ejemplo
  ------------------------------ ----------- ------------------------------------ --------------------------------------------------------------
  `userId`                       string      ID del usuario propietario           `"abc123xyz"`

  `territorio`                   object      Perímetro geográfico                 `{ nivel: "estatal", estado: "Jalisco", nombre: "Jalisco" }`

  `territorio.nivel`             enum        Nivel territorial                    `"nacional" \| "estatal" \| "municipal" \| "distrito"`

  `territorio.estado`            string?     Estado (si nivel \>= estatal)        `"Jalisco"`

  `territorio.municipio`         string?     Municipio (si nivel \>= municipal)   `"Zapopan"`

  `territorio.nombre`            string      Nombre completo del territorio       `"Jalisco > Zapopan > Distrito 10"`

  `modo`                         enum        Modo de análisis                     `"ciudadano" \| "gubernamental"`

  `isActive`                     boolean     Estado del monitoreo                 `true`

  `alertas`                        object      Configuración de alertas                              `{ vectorRiesgoUmbral: 70, notificarEmail: true, notificarInApp: true }`

  `alertas.vectorRiesgoUmbral`     number      Umbral de Vector de Riesgo (0-100) que dispara alerta   `70`

  `alertas.notificarEmail`         boolean     Enviar notificación por email (Firebase Trigger Email)   `true`

  `alertas.notificarInApp`         boolean     Mostrar banner de alerta en dashboard al recargar        `true`

  `createdAt`                    timestamp   Fecha de creación                    `2025-03-15T10:30:00Z`

  `updatedAt`                    timestamp   Última actualización                 `2025-03-20T14:22:00Z`
  ----------------------------------------------------------------------------------------------------------------------------------------------

**Índices de Firestore**: - `userId` (asc) + `isActive` (asc) - `territorio.estado` (asc) + `isActive` (asc)

#### Colección: `pestel_feeds` 

Almacena análisis PEST-L generados. Es la fuente que consume Moddulo.

  ----------------------------------------------------------------------------------------------------------------------------------------------------
  Campo                    Tipo           Descripción                                             Ejemplo
  ------------------------ -------------- ------------------------------------------------------- ----------------------------------------------------
  `configId`               string (ref)   Referencia a `pestel_configs`                        `"``config``_abc123"`

  `userId`                 string         ID del usuario (desnormalizado para queries directas)   `"abc123xyz"`

  `generadoEn`             timestamp      Fecha/hora de generación del análisis                   `2025-03-23T06:00:00Z`

  `territorio`             string         Territorio desnormalizado                               `"Jalisco"`

  `vigente`                boolean        Si el análisis es el más reciente                       `true`

  `pestl`                  object         Análisis estructurado por dimensión                     Ver subcampo `DimensionPESTL`

  `pestl.politico`         object         Dimensión Política                                      `{ contexto``, factores], tendencia, fuentes] }`

  `pestl.economico`        object         Dimensión Económica                                     `{ contexto``, factores], tendencia, fuentes] }`

  `pestl.social`           object         Dimensión Social                                        `{ contexto``, factores], tendencia, fuentes] }`

  `pestl.tecnologico`      object         Dimensión Tecnológica                                   `{ contexto``, factores], tendencia, fuentes] }`

  `pestl.legal`            object         Dimensión Legal                                         `{ contexto``, factores], tendencia, fuentes] }`

  `vectorRiesgo`           number         Vector de Riesgo global (0-100)                         `65`

  `indicePresionSocial`    number         Índice de Presión Social (0-100)                        `72`

  `indiceClimaInversion`   number         Índice de Clima de Inversión (0-100)                    `58`

  `syncedToModdulo`        boolean        Si fue consultado por Moddulo                           `true`
  ----------------------------------------------------------------------------------------------------------------------------------------------------

#####  

##### Subcampo: `DimensionPESTL` (dentro de `pestl.{dimension}`) 

  ----------------------------------------------------------------------------------------------------------------------------------------------
  Campo         Tipo     Descripción                                   Ejemplo
  ------------- -------- --------------------------------------------- -------------------------------------------------------------------------
  `contexto`    string   Resumen generado por Claude de la dimensión   `"El contexto político muestra estabilidad con ligera polarización..."`

  `factores`    array    Lista de factores identificados               Ver subcampo `Factor`

  `tendencia`   enum     Tendencia general                             `"creciente" \| "estable" \| "decreciente"`

  `fuentes`     array    URLs de fuentes consultadas                   `"https://inegi.org.mx/...", "https://google.com/news/..."]`
  ----------------------------------------------------------------------------------------------------------------------------------------------

##### Subcampo: `Factor` (dentro de `factores]`) 

  -----------------------------------------------------------------------------------------------------------------------------------
  Campo           Tipo      Descripción                          Ejemplo
  --------------- --------- ------------------------------------ --------------------------------------------------------------------
  `descripcion`   string    Descripción del factor               `"Aprobación de reforma electoral reduce representatividad local"`

  `impacto`       enum      Nivel de impacto                     `"alto" \| "medio" \| "bajo"`

  `sentiment`     number    Puntuación de sentimiento (-1 a 1)   `-0.7` (negativo)

  `fuente`        string    Fuente de información                `"Jornada Jalisco, 20/03/2025"`

  `isManual`      boolean   Agregado por usuario                 `false`
  -----------------------------------------------------------------------------------------------------------------------------------

**Índices de Firestore**: - `userId` (asc) + `generadoEn` (desc) - `userId` (asc) + `territorio` (asc) + `vigente` (asc)

#### Colección: `pestel_jobs` 

Almacena estado de jobs de scraping ejecutados en Cloud Functions.

  --------------------------------------------------------------------------------------------------------------------------------------
  Campo           Tipo           Descripción                                       Ejemplo
  --------------- -------------- ------------------------------------------------- -----------------------------------------------------
  `configId`      string (ref)   Referencia a `pestel_configs`                  `"``config``_abc123"`

  `userId`        string         ID del usuario                                    `"abc123xyz"`

  `status`        enum           Estado del job                                    `"pending" \| "running" \| "completed" \| "failed"`

  `startedAt`     timestamp      Hora de inicio                                    `2025-03-23T06:00:00Z`

  `completedAt`   timestamp?     Hora de finalización                              `2025-03-23T06:05:32Z`

  `error`         string?        Mensaje de error si `status: "failed"`            `"INEGI API timeout after 3 retries"`

  `feedId`        string?        ID del feed generado (si `status: "completed"`)   `"``feed``_xyz789"`
  --------------------------------------------------------------------------------------------------------------------------------------

**Índices de Firestore**: - `userId` (asc) + `startedAt` (desc) - `status` (asc) + `startedAt` (asc)

## CRONOGRAMA ESTIMADO 

  -------------------------------------------------------------------------------------------------------------------------------
  Fase                              Duración          Entregables
  --------------------------------- ----------------- ---------------------------------------------------------------------------
  **Fase 0: Setup**                 3 días            Rutas, tipos TypeScript, Firestore Security Rules, estructura de carpetas

  **Fase 1: Scraping**              2 semanas         Cloud Function + Google News RSS + INEGI API + Banxico API + DOF RSS

  **Fase 2: Clasificación**         1.5 semanas       Claude API → PEST-L → cálculo de Vector de Riesgo

  **Fase 3: UI Dashboard**          2 semanas         Diseño responsive, gráficos interactivos, exportación PDF

  **Fase 4: Integración Moddulo**   1 semana          Feed API → xpctoContext en F2 Exploración

  **Fase 5: Pruebas y QA**          1 semana          Pruebas unitarias, smoke tests, UAT

  **Fase 6: Documentación**         3 días            Manual de usuario, diccionario de datos

  **TOTAL**                         **\~9 semanas**   MVP funcional en producción
  -------------------------------------------------------------------------------------------------------------------------------

## 8. CONSIDERACIONES TÉCNICAS CRÍTICAS 

###  

### 8.1 Web Scraping en Firebase Cloud Functions 

**CRÍTICO**: El scraping NO puede correr en Next.js API Routes de Vercel debido al timeout de 60 segundos. Debe ejecutarse en Firebase Cloud Functions Gen2 sin límite de tiempo.

**Implementación**:

-   Puppeteer ya instalado en `package.json`

-   `firebase.json` ya configurado con Cloud Functions

-   Scraper corre en `/functions/``src``/``pestel``/``scrapeAndAnalyze.ts`

-   Next.js API Route solo **trigerea** el Cloud Function vía HTTP

**Best Practices**:

-   Implementar User-Agent rotation para evitar detección

-   Respetar `robots.txt` de sitios objetivo

-   Rate limiting: máximo 1 request cada 2 segundos por fuente

-   Timeout por fuente: 30 segundos

-   Retry logic: 3 intentos con backoff exponencial

-   Cache en Firestore: TTL de 6 horas para reducir requests redundantes

###  

### 8.2 Clasificación PEST-L con Claude API 

**Decisión Final**: Claude API (Sonnet 4) como motor de clasificación.

**Razones**:

-   `@anthropic-ai/sdk` ya instalado y configurado en Eskemma

-   Ya usado en todas las fases de Moddulo

-   Costo marginal aceptable: 200-500 tokens por noticia (≈\$0.003 USD)

-   Fine-tunar DistilBERT requeriría dataset en español + infraestructura ML

**Prompt Engineering**:


    const classificationPrompt = `
    Analiza la siguiente noticia y clasifícala en una o más categorías PEST-L:

    Título: "${newsTitle}"
    Contenido: "${newsContent}"

    Categorías posibles:
    - Político: Legislación, gobierno, elecciones, partidos políticos
    - Económico: Indicadores macro/micro, empleo, inversión, comercio
    - Social: Tendencias demográficas, cultura, salud pública, educación
    - Tecnológico: Innovación, infraestructura digital, regulación tech
    - Legal: Cambios normativos, jurisprudencia, reformas legales

    Responde ÚNICAMENTE en JSON con este formato:
    {
      "categories": "Político", "Legal"],
      "impact": "alto" | "medio" | "bajo",
      "sentiment": -1.0 a 1.0,
      "summary": "Resumen breve del factor identificado"
    }
    `;

**Optimización de Costos**:

-   Batching: procesar hasta 10 noticias en una sola llamada a Claude

-   Caché de clasificaciones: almacenar en Firestore con hash del contenido

-   Filtrado previo: solo clasificar noticias con \>100 caracteres

### 8.3 Sistema de Alertas

**Dos canales de notificación** (ambos configurables por usuario en `alertas`):

#### Canal A — Email (Firebase Extension "Trigger Email")

- Usar Firebase Extension oficial: `firestore-send-email`
- La Cloud Function, al detectar que `vectorRiesgo >= alertas.vectorRiesgoUmbral`, escribe un documento en la colección `mail` con `to`, `subject` y `html`
- Firebase Extension envía el email automáticamente vía SMTP configurado (SendGrid o Mailgun, gratis hasta 100/día)

```typescript
// En scrapeAndAnalyze.ts — después de guardar pestel_feeds
if (feedData.vectorRiesgo >= config.alertas.vectorRiesgoUmbral && config.alertas.notificarEmail) {
  await db.collection('mail').add({
    to: userEmail,
    message: {
      subject: `⚠️ Alerta PESTEL: Vector de Riesgo ${feedData.vectorRiesgo}/100 — ${config.territorio.nombre}`,
      html: `<p>El monitoreo de <b>${config.territorio.nombre}</b> superó el umbral configurado...</p>`
    }
  });
}
```

#### Canal B — In-App (banner en dashboard)

- Al guardar `pestel_feeds`, si el vector supera el umbral, escribir también en `pestel_alerts/{userId}/items/{alertId}`
- El dashboard lee esta subcolección al cargar y muestra un banner de alerta con semáforo rojo
- El usuario puede marcar la alerta como "vista" (`readAt: timestamp`)

**Esquema `pestel_alerts/{userId}/items/{alertId}`**:

| Campo | Tipo | Ejemplo |
|---|---|---|
| `feedId` | string | `"feed_xyz789"` |
| `territorio` | string | `"Jalisco"` |
| `vectorRiesgo` | number | `78` |
| `generadoEn` | timestamp | `2026-03-25T06:00:00Z` |
| `readAt` | timestamp? | `null` (no leída) |

###

### 8.4 Escalabilidad

**Limitaciones conocidas**:

-   Firebase Cloud Functions: máximo 3000 concurrent executions (plan Blaze)

-   Firestore: 10,000 writes/sec (suficiente para MVP)

-   Claude API: 50 requests/min (tier Free), 2000 req/min (tier Pro)

**Estrategia de escalabilidad**:

-   Uso de Firebase Cloud Functions con `maxInstances: 10` (control de costos)

-   Cola de scraping con Firebase Cloud Tasks (evitar timeouts)

-   Pagination en dashboard: cargar máximo 50 factores a la vez

-   Lazy loading de análisis históricos: cargar bajo demanda

**Monitoreo**:

-   Firebase Performance Monitoring para latencia de API

-   Cloud Logging para errores de Cloud Functions

-   Alertas en Cloud Monitoring si error rate \>5%

##  

## 9. INTEGRACIÓN CON MODDULO - THE FEED 

###  

### 9.1 Visión General 

PESTEL sigue el patrón de **fuente independiente** establecido por SefixWidget: genera análisis PEST-L que Moddulo consume **bajo demanda** a través de una API dedicada. NO escribe directamente en `moddulo_projects`.

###  

### 9.2 Arquitectura de Integración 

    ┌─────────────────────────────────────────────────────────────────┐
    │                    PESTEL → MODDULO                          │
    └─────────────────────────────────────────────────────────────────┘

    1. GENERACIÓN (PESTEL)
       ├─ Cloud Function: scrapeAndAnalyze()
       ├─ Clasificación Claude: PEST-L + Vector de Riesgo
       └─ Guarda: pestel_feeds/{feedId}
           {
             userId, territorio, pestl: { ... },
             vectorRiesgo, vigente: true
           }

    2. CONSUMO (Moddulo F2)
       ├─ Usuario abre Fase 2 (Exploración)
       ├─ Frontend: GET /api/centinela/pestel/feed
       │   Query params: { userId, territorio }
       └─ API retorna: Feed más reciente según territorio

    3. INYECCIÓN EN CONTEXTO
       ├─ Moddulo carga feed en xpctoContext
       ├─ Claude usa PEST-L en análisis de F2
       └─ Widget "PESTEL" muestra resumen visual
           (patrón idéntico a SefixWidget)

###  

###  

###  

### 9.3 Especificación de API: `/api/centinela/pestel/feed` 

**Endpoint**: `GET /``api``/centinela/``pestel``/feed`

**Query Parameters**:

  ---------------------------------------------------------------------------------------------------------------------------
  Parámetro       Tipo      Requerido   Descripción                                                           Ejemplo
  --------------- --------- ----------- --------------------------------------------------------------------- ---------------
  `userId`        string    Sí          ID del usuario autenticado                                            `"abc123xyz"`

  `territorio`    string    No          Filtro por territorio (si no se proporciona, retorna feed nacional)   `"Jalisco"`

  `V``igent``3`   boolean   No          Solo feeds vigentes (default: true)                                   `true`
  ---------------------------------------------------------------------------------------------------------------------------

**Response (200 OK)**:

    {
      "success": true,
      "feed": {
        "feedId": "feed_xyz789",
        "configId": "config_abc123",
        "generadoEn": "2025-03-23T06:00:00Z",
        "territorio": "Jalisco",
        "pestl": {
          "politico": {
            "contexto": "Estabilidad con polarización moderada...",
            "factores": 
              {
                "descripcion": "Reforma electoral aprobada",
                "impacto": "alto",
                "sentiment": -0.3,
                "fuente": "DOF 20/03/2025"
              }
            ],
            "tendencia": "estable",
            "fuentes": "https://dof.gob.mx/...", "https://news.google.com/..."]
          },
          "economico": { ... },
          "social": { ... },
          "tecnologico": { ... },
          "legal": { ... }
        },
        "vectorRiesgo": 65,
        "indicePesionSocial": 72,
        "indiceClimaInversion": 58
      }
    }

**Response (404 Not Found)**:

    {
      "success": false,
      "error": "No se encontró feed para el territorio especificado",
      "message": "Intenta ejecutar un análisis manual desde /centinela/pestel"
    }

###  

### 9.4 Formato de Datos para `xpctoContext` 

Cuando Moddulo F2 carga el feed, lo inyecta en `xpctoContext` con el siguiente formato:


    interface XpctoContextPESTEL {
      source: "pestel";
      timestamp: string; // ISO 8601
      territorio: string;
      analisis: {
        politico: string; // contexto de la dimensión
        economico: string;
        social: string;
        tecnologico: string;
        legal: string;
      };
      factoresClave: {
        categoria: "politico" | "economico" | "social" | "tecnologico" | "legal";
        descripcion: string;
        impacto: "alto" | "medio" | "bajo";
      }];
      riesgo: {
        vector: number; // 0-100
        presionSocial: number;
        climaInversion: number;
      };
    }

**Ejemplo de inyección en prompt de Claude (Moddulo F2)**:


    <context_pestel>

>     Análisis PEST-L actualizado para Jalisco (generado: 2025-03-23 06:00):
>
>     Político: Estabilidad con polarización moderada. Reforma electoral aprobada reduce representatividad local.
>
>     Económico: Inflación local en 4.2% (marzo), por debajo de media nacional (5.1%). Precio de gasolina estable.
>
>     Social: Tendencias demográficas muestran migración hacia zona metropolitana. Protestas por agua en aumento.
>
>     Tecnológico: Infraestructura digital en expansión. Jalisco lidera adopción de IoT en manufactura.
>
>     Legal: DOF publicó decreto sobre protección de datos personales (18/03). Impacto medio en empresas tech.
>
>     Vector de Riesgo: 65/100 (Amarillo)
>     Presión Social: 72/100
>     Clima de Inversión: 58/100

    </context_pestel>

###  

### 9.5 Widget "PESTEL" en Moddulo F2 

**Patrón SefixWidget**:

-   Componente: `/components/``moddulo``/widgets/``PESTELWidget.tsx`

-   Ubicación: Sección "Político" del panel de F2 (igual que SefixWidget en "Electoral")

-   Contenido: Badge con nivel de riesgo (Verde/Amarillo/Rojo)

-   Mini-gráfico de tendencias PEST-L

-   Link: "Ver análisis completo" → `/centinela/pestel/analisis/{feedId}`

**Código de ejemplo**:


    // components/moddulo/widgets/PESTELWidget.tsx
    export function PESTELWidget({ feed }: { feed: PESTELFeed }) {
      const riskColor = 
        feed.vectorRiesgo < 30 ? 'green' : 
        feed.vectorRiesgo < 70 ? 'yellow' : 'red';

      return (
        <Card className="border-l-4" style={{ borderLeftColor: riskColor }}>
          <CardHeader>
            <CardTitle className="text-sm">PESTEL - Contexto PEST-L</CardTitle>
            <CardDescription>
              Actualizado: {formatDistanceToNow(feed.generadoEn)} 
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="space-y-2">
              <div className="flex justify-between">
                <span>Vector de Riesgo:</span>
                <Badge variant={riskColor}>{feed.vectorRiesgo}/100</Badge>
              </div>
              <TrendMiniChart data={feed.pestl} />
            </div>
          </CardContent>
          <CardFooter>
            <Link href={`/centinela/pestel/analisis/${feed.feedId}`}>
              Ver análisis completo →
            </Link>
          </CardFooter>
        </Card>
      );
    }

###  

### 9.6 Flujo de Sincronización 

**Trigger automático** (Firestore onWrite):


    // functions/src/pestel/feedSync.ts
    export const onFeedCreated = onDocumentWritten(
      'pestel_feeds/{feedId}',
      async (event) => {
        const feed = event.data?.after.data();
        if (!feed) return;

        // Marcar feeds anteriores como no vigentes
        const previousFeeds = await db
          .collection('pestel_feeds')
          .where('userId', '==', feed.userId)
          .where('territorio', '==', feed.territorio)
          .where('vigente', '==', true)
          .get();

        const batch = db.batch();
        previousFeeds.docs.forEach(doc => {
          if (doc.id !== event.params.feedId) {
            batch.update(doc.ref, { vigente: false });
          }
        });

        await batch.commit();
        console.log(`Feed ${event.params.feedId} marcado como vigente`);
      }
    );

**Verificación manual**:

Usuario puede forzar refresh del feed desde Moddulo F2

-   Botón "Actualizar contexto" → llama nuevamente a `/api/centinela/pestel/feed`

###  

### 9.7 Consideraciones de Seguridad 

**Firestore Security Rules**:

    match /pestel_feeds/{feedId} {
      // Solo el owner puede leer sus feeds
      allow read: if request.auth.uid == resource.data.userId;
      
      // Solo Cloud Functions pueden escribir
      allow write: if false;
    }

**API Route Protection**:

    // app/api/centinela/pestel/feed/route.ts
    export async function GET(request: NextRequest) {
      const session = await getServerSession(authOptions);
      if (!session?.user?.id) {
        return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
      }

      const { searchParams } = new URL(request.url);
      const userId = searchParams.get('userId');

      // Verificar que el usuario solo acceda a sus propios feeds
      if (userId !== session.user.id) {
        return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
      }

      // ... resto de la lógica
    }

## 10. VERIFICACIÓN FINAL 

El plan de ingeniería es correcto si responde estas preguntas sin ambigüedad:

  ---------------------------------------------------------------------------------------------------------------------------------------------------
  Pregunta                                    Respuesta Correcta
  ------------------------------------------- -------------------------------------------------------------------------------------------------------
  ¿Dónde corre el scraper?                    **Firebase Cloud Functions Gen2** (NOT Vercel API Routes)

  ¿Cómo llegan los datos a Moddulo F2?        **Firestore** `pestel_feeds` **→ API** `/api/centinela/pestel/feed` **→** `xpctoContext`

  ¿Qué fuentes se usan en México v1?          **INEGI API, Banxico API, Google News RSS, DOF RSS, Google Trends** (todas gratis)

  ¿Dónde vive PESTEL en la URL?            `/centinela/pestel` (rutas internas de Eskemma, NO subdominio)

  ¿Qué clasifica el PEST-L?                   **Claude API (Sonnet 4)** vía `@anthropic-ai/sdk` (ya disponible)

  ¿Cuál es el modelo de datos de Firestore?   **3 colecciones**: `pestel_configs`, `pestel_feeds`, `pestel_jobs`

  ¿Cómo se integra con Moddulo?               **Patrón SefixWidget**: fuente independiente, widget en sección Político, inyección en `xpctoContext`
  ---------------------------------------------------------------------------------------------------------------------------------------------------


## PRÓXIMOS PASOS 

1.  ✅ **Aprobar este documento** con las correcciones aplicadas
2.  📋 Guardar como `_docs/pestel-engineering-plan.md` en el repositorio
3.  🚀 Iniciar implementación por fases:

-   **Fase 0 (Setup)**: Rutas, tipos TypeScript, Firestore, estructura de carpetas
-   **Fase 1 (Scraping)**: Cloud Function + fuentes mexicanas
-   **Fase 2 (Clasificación)**: Claude API → PEST-L
-   **Fase 3 (UI)**: Dashboard en `/centinela/pestel`
-   **Fase 4 (Integración)**: Feed → Moddulo F2

**Fin del Plan de Ingeniería de Software - PESTEL v1.0**

*Documento preparado para el desarrollo de PESTEL - Sistema de Monitoreo PEST-L*

**Eskemma**

El ecosistema digital para tu proyecto político

Marzo 2026

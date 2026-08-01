# Fontana (T10) — Arquitectura Funcional (Paso 3)

**Fecha de cierre original:** 28 de julio de 2026
**Versión:** v2 — ajustada el 29 de julio de 2026, tras el Paso 4 (prototipo interactivo)
**Ecosistema:** Eskemma — Centinela
**Prelación:** #2 (después de T06/Sefix-AI)
**Estado:** Paso 3 completo. Fontana es la primera app del ecosistema en implementar formalmente Canal 1 (`AppContractConfig`/`api-push`) y Canal 3 (`VincularFuenteForm`) de F3-Investigación, sentando el patrón que las 33 apps restantes del catálogo podrán reutilizar.

> **Nota de versión (v2):** el prototipo del Paso 4 identificó cuatro ajustes puntuales a este documento — marcados con 🔧 en su sección correspondiente y detallados en el resumen inmediato abajo. El resto del documento permanece sin cambios respecto a la v1. El diseño del agente conversacional (herramientas, `AgenteConversacionalConfig`) **no** se incorpora aquí porque nunca formó parte de la arquitectura de este Paso 3 — se documentará en el archivo de cierre del Paso 4, dedicado a esa capa.

### Resumen de cambios v1 → v2

| # | Sección | Cambio | Motivo |
|---|---|---|---|
| 1 | 2 — Componentes | Se añade el Canvas como componente de la interfaz propia | El agente conversacional genera salidas (gráficas, listados) que no pertenecen a ninguna de las 5 familias de indicadores y necesitan un espacio propio |
| 2 | 7 — `INDICATOR_REGISTRY.json` | Se añaden los campos opcionales `definicion` y `fuenteEtiqueta` a `IndicadorRegistro` | La interfaz del Paso 4 requiere mostrar una definición conceptual (tooltip) y una etiqueta de fuente legible por humanos, distintas del `fuenteSlug` técnico ya existente |
| 3 | 8.1 / 8.2 — Escenarios de uso | Se documenta el wizard de primer uso (precarga en (a), formulario completo en (b)/(c)) y la confirmación explícita previa a Canal 1 | Replica el patrón ya usado en PESTEL y evita una entrega "a ciegas" a F3 |
| 4 | 8.3 — `FontanaSesion` | Se añade el campo opcional `salidasAgente` | Las salidas del Canvas deben persistir entre aperturas de la app; se aclara explícitamente que **no** viajan en el payload a F3 |

---

## 1. Alcance y principios rectores (heredados del Paso 1/2, sin cambio)

Fontana procesa datos institucionales públicos de México (y, en fase posterior, de Iberoamérica) para producir datos estructurados que alimentan al ecosistema y su propia interfaz de visualización en Centinela. Fuentes no limitadas a un catálogo cerrado; solo APIs/tokens gratuitos; sin comparación forzada entre países (salvo Familia 4); México primero, Iberoamérica como parte de la misma app, no una v2.

Catálogo final: **84 indicadores** en 5 familias (ver documento de cierre del Paso 2, v2, para el detalle indicador por indicador con fuente, mecanismo y niveles geográficos).

---

## 2. Componentes de la arquitectura

```
Fontana
├── Módulo de Ingesta (por fuente)
│   ├── Conectores API con token (INEGI-BIE, Banxico-SIE, FMI, Banco Mundial, CEPALSTAT)
│   ├── Conectores de descarga directa (CONAPO, SESNSP, STPS, SIC, DENUE, SUN, INECC/ANVCC, CONAGUA)
│   ├── Conectores de descarga vía navegador headless (ENIGH, IDH-PNUD, ICMM) — patrón Playwright ya documentado
│   └── Módulo de curación manual (Familia 5, Grupo B — historia, personajes célebres)
├── Bodega de datos (versionada, sin sobrescritura)
│   ├── Carpetas por fuente/versión con convención de nomenclatura ya fijada
│   ├── _manifest.json por fuente
│   └── INDICATOR_REGISTRY.json (esquema fijado en este Paso 3; poblado indicador por indicador en el Paso 5)
├── Módulo de Validación (antes de aceptar cualquier actualización de fuente)
├── Módulo de Cálculo/Agregación
│   ├── Agregación territorial (sección→distrito cuando la fuente lo permite; municipio→distrito cuando no)
│   ├── Agregación estatal por suma/promedio de municipios cuando la fuente no la publica (ej. INECC/ANVCC) — siempre etiquetada "estimación agregada"
│   └── Nunca calcula indicadores electorales — esos se consumen de Sefix
├── Capa de Servicio (API interna) — sección 5
├── Módulo de Sesión — sección 8
└── Interfaz propia (Centinela)
    ├── Visualizaciones mobile-first (mapas, gráficas, tablas, cards)
    ├── Tabla comparativa por nivel geográfico, con indicadores mínimos del PIP no editables
    ├── Canvas del agente conversacional — espacio dedicado a salidas generadas por lenguaje natural
    │   (gráficas, listados, tablas), separado de las 5 familias de indicadores 🔧 v2
    └── Documento de notas metodológicas por familia + prontuario de naturaleza del dato (sección 6)
```

---

## 3. Flujo de datos — bidireccional, sin dependencia exclusiva

```
Fuentes externas → Ingesta → Validación → Bodega versionada → INDICATOR_REGISTRY.json
                                                    ↓
                                     Capa de Servicio (API interna de Fontana)
                                                    ↕
                    ┌───────────────────────────────┴───────────────────────────────┐
                    ↓                                                                 ↓
         Interfaz propia de Fontana                                    API interna de Sefix-AI
                                                                                     ↕
                                                          (Fontana CONSUME de Sefix: resultados
                                                           electorales brutos, MV, NEP/HHI, Pedersen
                                                           — F3-5 a F3-14 del catálogo)

                    Otras apps futuras del ecosistema pueden consumir la API
                    de Fontana, la de Sefix, o ambas — sin acoplamiento exclusivo.
```

Los cálculos electorales derivados nunca se duplican en Fontana — viven en Sefix-AI, y Fontana los consume vía este mismo canal cuando los necesita para un indicador de Familia 3.

---

## 4. `AppContractConfig` — contrato de Fontana con F3

```json
{
  "tecnicaId": "T10",
  "componente": "Centinela",
  "pipModulos": [
    "contexto_pestel_social",
    "contexto_pestel_economico",
    "contexto_pestel_politico",
    "contexto_pestel_ecologico",
    "contexto_pestel_tecnologico"
  ],
  "deliveryMechanism": "api-push",
  "payloadSchema": "FontanaContextoTerritorial"
}
```

Notas de diseño:
- **Legal (L) excluida deliberadamente** de `pipModulos` — ningún indicador de Fontana mide marco normativo, confirmado indicador por indicador (no asumido). Candidata a activarse solo si se incorpora un indicador de esa naturaleza al catálogo.
- `payloadSchema` se renombró de `FontanaContextoSocioeconomico` a `FontanaContextoTerritorial` — el primer nombre quedó obsoleto al ampliarse `pipModulos` de 2 a 5 dimensiones PESTEL; el segundo es neutral respecto a cuántas/cuáles dimensiones cubre.
- `deliveryMechanism: "api-push"` — nombre correcto del mecanismo técnico (no `"canal1_ecosistema"`, que describía el canal, no el mecanismo).
- `componente: "Centinela"` usa el tipo `AppConContrato = Extract<OrigenTrazabilidad["componente"], "sefix"|"centinela"|"recursos">`, ya corregido en `types/f3.types.ts` para derivar del catálogo real de 6 valores en vez de un union literal independiente.
- La Familia 5 completa (características territoriales) se integra dentro del **Vector Social (V1) del MVP** — no existe un "Vector Territorial" en el modelo de 6 vectores documentado; se corrigió la inconsistencia de la ficha original del MMEE.

---

## 5. Capa de Servicio — API interna de Fontana

### 5.1 Endpoints de consulta (uso interactivo del usuario dentro de Fontana)

```
GET /api/fontana/familia/:familiaId?territorio=&nivel=&indicadores=
GET /api/fontana/indicador/:id?territorio=
GET /api/fontana/sefix/electoral?territorio=&nivel=      // consumo de Sefix, dirección inversa
```

Diseño: **un endpoint por familia con filtro opcional de indicadores**, no uno por cada uno de los 84 indicadores — consistente con el `payloadSchema` anidado por familia y con el costo real de mantenimiento (5 endpoints, no 84).

### 5.2 Tabla comparativa por nivel geográfico

Combinación de dos criterios, no uno solo:
- **Tipo de proyecto** decide el patrón de columnas *ofrecido*: `Nacional|Estatal|Distrital|Municipal` (electoral, con el distrital calculado por agregación de secciones cuando la fuente llega a sección, o por promedio ponderado de municipios cuando no) vs. `Nacional|Estatal|Municipal|AGEB` (otros tipos de proyecto).
- **El indicador individual**, vía su propio `niveles[]` en `INDICATOR_REGISTRY.json`, decide qué columnas de ese patrón *muestran dato real* — nunca se presenta una columna vacía sin explicación; se omite o se marca explícitamente "no disponible a este nivel".

> **Nota de verificación (v2):** el prototipo del Paso 4 solo probó visualmente la variante electoral (`Nacional|Estatal|Distrital|Municipal`). La variante no-electoral queda pendiente de revisión visual antes del Paso 5 — ver `Fontana_T10_Paso4_Bitacora_Cambios.md`, sección 8.

### 5.3 Endpoint de entrega — Canal 1 (`api-push`)

```
POST /api/moddulo/f3/canal1/entregar
  Body: { modduloProjectId, tareaPipNumero, payload: FontanaContextoTerritorial }

  1. getSessionFromRequest() → 401 si no hay sesión válida
     (reutilizado tal cual de Canal 2/3 — genérico, sin nada específico de canal)
  2. getProject(modduloProjectId, session.uid) → 404 si no existe/no es del usuario
     (reutilizado tal cual; nota operativa: escribe lastAccessedAt en cada llamada)
  3. Validar que tareaPipNumero exista en el PIP real del proyecto → 400 si no existe
     (validación NUEVA — no hay nada que reutilizar de Canal 3, que resuelve
     un problema distinto: compatibilidad de datos SIN PIP de origen)
  4. Validar forma del payload contra FontanaContextoTerritorial → 400 si mal formado
  5. resultadoId = `canal1_${asignacionId}` — determinístico, deriva del
     asignacionId ya corregido para calcularse por contenido, no por posición
  6. .set() SIN el campo `aprobado` — así una re-entrega nunca "revive"
     silenciosamente una aprobación anterior; debe volver a pasar por M2
  7. → 200 { resultadoId, resultado }  (mismo patrón de respuesta que Canal 2/3)
```

**Sin autenticación de servicio a servicio** — Canal 1 en Fontana siempre opera en contexto de sesión de usuario (el clic en "Regresar a Moddulo F3 con resultados" dentro de la propia interfaz), nunca como llamada de fondo sin usuario presente. No hay precedente de auth servicio-a-servicio en el repo; este diseño evita necesitarlo.

Solo se usa cuando Fontana opera **dentro de un proyecto activo** (escenario a, sección 8). En uso independiente (escenarios b/c), Fontana no llama a este endpoint — usa Canal 3.

> **Nota de interfaz (v2):** antes de invocar este endpoint, la interfaz presenta un resumen de entrega (conteo de indicadores por familia y su estado — nunca enviada / modificada / sin cambios — respecto al último envío confirmado), que el usuario debe confirmar explícitamente. Ver sección 8.1.

---

## 6. Naturaleza del dato — taxonomía consolidada

Sustituye la distinción binaria "dato_origen / estimación_derivada" usada en versiones previas del diseño, por 5 categorías (detalle completo, con ejemplos del catálogo real, en `Fontana_Prontuario_Naturaleza_Dato.md`):

```typescript
type NaturalezaDato =
  | "dato_directo"
  | "calculo_directo"
  | "estimacion_modelada"
  | "estimacion_agregada"
  | "proxy_conceptual";
```

Se declara **por nivel geográfico**, no una sola vez por indicador — un mismo indicador puede ser dato directo a nivel estatal y estimación modelada a nivel municipal (ej. pobreza multidimensional, F2-1).

---

## 7. `INDICATOR_REGISTRY.json` — esquema fijado, sin poblar

```typescript
interface IndicadorRegistro {
  id: string;                    // "F1-11", "F2-18", etc.
  nombre: string;
  familia: 1 | 2 | 3 | 4 | 5;
  pestel: Array<"P" | "E" | "S" | "T" | "Ec" | "L">;

  fuenteSlug: string;             // identificador técnico de la fuente, usado por los conectores
  fuenteEtiqueta?: string;        // 🔧 v2 — nombre legible de la fuente para mostrar en la interfaz
                                  //         (ej. "CONEVAL/INEGI"), distinto de fuenteSlug
  definicion?: string;           // 🔧 v2 — definición conceptual breve del indicador, para el
                                  //         tooltip (i) de la interfaz. Formato: "<nombre>: <definición>."
                                  //         La fuente se añade aparte, vía fuenteEtiqueta.
  mecanismoAcceso:
    | "api_token"
    | "descarga_directa"
    | "descarga_navegador_headless"
    | "curacion_manual"
    | "consumo_interno_sefix";

  niveles: Array<{
    nivel: "nacional" | "estatal" | "distrital" | "municipal" | "ageb" | "seccional" | "localidad";
    naturaleza: NaturalezaDato;
    metodo?: string;             // obligatorio si naturaleza ≠ dato_directo
    estado: "confirmado" | "pendiente" | "no_viable";
  }>;

  frecuenciaActualizacion: string;
  ultimaVerificacion: string;
  confiabilidadPorCampo?: Record<string, "alta" | "media" | "baja">;  // ej. F4-6 (EIU)
  notas?: string;
}
```

**Decisión confirmada:** no se puebla ahora. Las tablas de recapitulación de las 5 familias (documento de cierre del Paso 2, v2) son la fuente de verdad provisional. El llenado real, indicador por indicador, ocurre en el Paso 5, como parte de que Code construya y verifique en vivo cada conector — evita transcripción manual que podría desactualizarse antes de usarse.

> **Nota (v2):** `definicion` y `fuenteEtiqueta` también deben poblarse en el Paso 5, junto con el resto del registro — no antes.

---

## 8. Los tres escenarios de uso y el modelo de sesión

### 8.1 Escenario (a) — dentro de proyecto activo en F3

Fontana recibe `moddulo_project_id`, `tarea_pip` y `modulo_pestel` por query param al abrirse (mismo mecanismo que PESTEL usa hacia F2, adaptado hacia F3). **Fontana ejecuta automáticamente, al abrirse, las consultas correspondientes a los indicadores mínimos que el PIP requiere** — el usuario ve de inmediato que lo indispensable ya está resuelto, sin tener que navegar primero. A partir de ahí puede explorar libremente indicadores adicionales.

🔧 **v2 — Wizard de primer uso:** la primera vez que el usuario abre Fontana desde este proyecto (mismo patrón ya aplicado en PESTEL), se muestra un wizard previo con los datos del proyecto precargados (nombre, ruta territorial, tarea PIP) y un resumen de cuántos indicadores mínimos se consultarán por familia. Solo al confirmar (botón "Consultar indicadores del proyecto") se ejecuta la carga automática descrita arriba. Aperturas posteriores del mismo proyecto omiten el wizard.

El botón **"Regresar a Moddulo F3 con resultados"** llama al endpoint de Canal 1 (sección 5.3).

🔧 **v2 — Confirmación previa a Canal 1:** antes de llamar al endpoint, la interfaz presenta un resumen de entrega (conteo de indicadores por familia y su estado respecto al último envío confirmado: nunca enviada / modificada / sin cambios) que el usuario debe confirmar explícitamente. Esto hace visible al usuario el mecanismo de `familiasModificadasDesdeUltimaExportacion` ya definido en la sección 8.3 — no introduce un cálculo nuevo, solo lo expone antes de ejecutar la entrega.

### 8.2 Escenarios (b)/(c) — uso independiente en Centinela

Sin proyecto activo, no hay PIP de referencia — pendiente de definir qué indicadores se muestran por default en este caso (no resuelto en este Paso 3; ver sección 10). El usuario, si decide que el resultado le sirve, usa los mismos dos botones que ya existen en PESTEL ("Iniciar proyecto en Moddulo" / "Vincular a proyecto existente"), pero el destino es **Canal 3** de F3 (`VincularFuenteForm`, evaluación de pertinencia/vigencia/territorio) — no el mecanismo `linkedSource` que usa PESTEL hacia F2.

🔧 **v2 — Wizard de primer uso:** al no existir un proyecto que precargar, el wizard debe requisitarse por completo (al menos: nombre de proyecto opcional, territorio) antes de iniciar. No hay resumen de mínimos que mostrar, porque no hay PIP de referencia.

### 8.3 Modelo de sesión — `FontanaSesion`

```typescript
interface FontanaSesion {
  sesionId: string;
  modduloProjectId?: string;
  tareaPipIds: string[];
  territorio: { cveGeo: string; nivel: NivelGeografico };

  indicadoresPorFamilia: Record<
    "F1" | "F2" | "F3" | "F4" | "F5",
    {
      minimos: string[];           // del PIP — NO editables ni eliminables en la interfaz
      seleccionUsuario: string[];  // añadidos libremente por el usuario
    }
  >;

  salidasAgente?: SalidaAgente[];  // 🔧 v2 — ver definición y regla abajo

  fechaUltimoGuardado: string;
  versionSesion: number;           // Fontana lleva su propio historial de versiones
  exportadoAF3?: {
    resultadoId: string;
    fechaExportacion: string;
    familiasModificadasDesdeUltimaExportacion?: string[];  // calculado por Fontana
  };
}

// 🔧 v2 — nuevo tipo, soporte del Canvas del agente conversacional
interface SalidaAgente {
  id: string;
  tipo: "grafica" | "listado" | "tabla";
  referencia: { indicadorId?: string; familiaId?: "F1" | "F2" | "F3" | "F4" | "F5" };
  timestamp: string;
}
```

Reglas de negocio:
- Los indicadores `minimos` nunca son editables/eliminables — deben distinguirse visualmente en el wireframe del Paso 4 (ej. candado/etiqueta "requerido"), sin control de "quitar" disponible.
- El usuario navega y guarda familia por familia; la sesión es un solo objeto.
- **La exportación a F3 siempre es del objeto completo — las 5 familias**, nunca parcial por familia. Si el usuario solo actualizó Familia 3 y 4 desde la última exportación, el payload sigue llevando las 5, con `familiasModificadasDesdeUltimaExportacion: ["F3","F4"]` calculado por Fontana — F3 nunca necesita comparar versiones, porque hoy no tiene ningún mecanismo para hacerlo (ver sección 9).
- 🔧 **v2 — `salidasAgente` nunca viaja en el payload a F3** (sección 8.4): es un recurso interno de Fontana para que el usuario no pierda sus gráficas/listados generados por el agente entre aperturas de la misma sesión. Se genera mediante la herramienta `generar_visualizacion` del agente conversacional (documentada en el archivo de cierre del Paso 4, no en este documento).

### 8.4 Forma del payload entregado — `FontanaContextoTerritorial`

```typescript
interface ValorPorNivel {
  nivel: "nacional" | "estatal" | "distrital" | "municipal" | "ageb" | "seccional" | "localidad";
  valor: number | string;
  unidad?: string;
  naturaleza: NaturalezaDato;
}

interface IndicadorEntregaF3 {
  id: string;
  nombre: string;
  valoresPorNivel: ValorPorNivel[];
  confiabilidad?: Record<string, "alta" | "media" | "baja">;
}

interface FontanaContextoTerritorial {
  familias: Record<"F1"|"F2"|"F3"|"F4"|"F5", IndicadorEntregaF3[]>;
  familiasModificadasDesdeUltimaExportacion?: string[];
  versionSesion: number;
}
```

Este objeto se anida como `payload` dentro de un `ResultadoF3<FontanaContextoTerritorial>` completo (con `moduloPIP`, `origen`, `cobertura`, `aprobado: undefined` al crearse) — nunca se entrega el payload suelto.

> **Nota (v2):** `salidasAgente` (sección 8.3) queda deliberadamente fuera de esta interfaz — el Canvas no es información que F3 necesite ni espere recibir.

Ejemplo de un indicador con varios niveles simultáneos:
```json
{
  "id": "F1-13",
  "nombre": "Población analfabeta",
  "valoresPorNivel": [
    { "nivel": "nacional", "valor": 15.3, "unidad": "%", "naturaleza": "dato_directo" },
    { "nivel": "estatal", "valor": 23.55, "unidad": "%", "naturaleza": "dato_directo" },
    { "nivel": "municipal", "valor": 32.33, "unidad": "%", "naturaleza": "dato_directo" },
    { "nivel": "distrital", "valor": 28.98, "unidad": "%", "naturaleza": "estimacion_agregada" }
  ]
}
```

---

## 9. Estado real de F3 — prerrequisitos investigados y resueltos

Fontana es la primera app en ejercitar Canal 1/Canal 3, y esto exigió resolver brechas reales de infraestructura compartida antes de poder diseñar con confianza:

| Prerrequisito | Estado | Resultado |
|---|---|---|
| Gap de catálogos `componente` (`f3.types.ts` vs `shared.types.ts`) | ✅ Resuelto y aplicado | `AppContractConfig.componente` deriva vía `Extract<>` de `OrigenTrazabilidad["componente"]`. No tocó PESTEL. |
| Manejo de resultados que se actualizan/reemplazan | ✅ Diagnosticado | Sin versionado de `ResultadoF3`; IDs aleatorios generan huérfanos; `phasePropagation.ts` solo registra F1→F2. Por esto, Fontana calcula el diff de versiones por su cuenta (sección 8.3) en vez de depender de F3 para eso. |
| Estabilidad de `asignacionId` | ✅ Resuelto y aplicado | Se calcula por contenido (`${numero}_${canal}_${tipo}[_${tecnicaId}]`), no por posición — verificado con 4 casos de prueba. Prerrequisito directo del `resultadoId` determinístico de Canal 1. |
| Mecanismo de diff/merge para regenerar `f3TareasPIP` sin perder avance | 📋 Documentado, no implementado | Infraestructura compartida de F3 (llenaría el par F2→F3 de `phasePropagation.ts`); queda como recomendación para el equipo de F3, no bloquea a Fontana. |
| Validación de infraestructura reutilizable para Canal 1 | ✅ Confirmado | `getSessionFromRequest`/`getProject` 100% reutilizables; validación de `moduloPIP` es trabajo nuevo (no hay nada que copiar de Canal 3); no existe ni se necesita auth de servicio a servicio; patrón de respuesta HTTP idéntico al de Canal 2/3. |

**Decisión de fondo tomada en este Paso 3:** Fontana no copia el patrón "a la medida" de PESTEL↔F2 (`linkedSource`, endpoints con nombre hardcodeado) — construye sobre Canal 1/Canal 3 tal como están diseñados en los tipos de F3, aceptando el costo de ser la primera en encontrar y resolver estas brechas, para no repetir la misma deuda técnica que ya tiene PESTEL. La eventual migración de PESTEL a este mismo patrón queda como nota para el futuro chat de T22, no como tarea de Fontana.

---

## 10. Pendientes explícitos para el Paso 4/5

- Definir qué indicadores se muestran por default cuando Fontana se usa de forma independiente, sin proyecto activo (escenarios b/c) — no resuelto en este documento. **Sigue sin resolverse tras el Paso 4.**
- ~~Diseño visual del wireframe: cómo se distinguen los indicadores mínimos...~~ 🔧 **Resuelto en el Paso 4** — ver prototipo y `Fontana_T10_Paso4_Bitacora_Cambios.md`.
- Poblar `INDICATOR_REGISTRY.json` con los 84 indicadores reales, en el Paso 5, junto con la construcción de cada conector — **incluye ahora también `definicion` y `fuenteEtiqueta` (🔧 v2)**.
- Subir el archivo de `TIPOSEC` (Estudios Censales de Participación 2009-2024) para resolver el nivel de sección electoral de F1-11.
- Autorizar en el chat de T06 el diff ya preparado de `CURATED_COLUMNS`/`ECEG_INDICATORS`.
- Recomendación documentada para el equipo de F3 (fuera del alcance de Fontana): construir el mecanismo de diff/merge de `f3TareasPIP` y conectar F3 a `phasePropagation.ts`.
- 🔧 **Nuevo (v2):** verificar visualmente la variante no-electoral de columnas de la tabla comparativa (`Nacional|Estatal|Municipal|AGEB`) antes del Paso 5 — no se probó en el prototipo.
- 🔧 **Nuevo (v2):** formalizar en el documento de cierre del Paso 4 las 4 herramientas del agente conversacional (`consultar_indicador`, `modificar_sesion`, `navegar_pestana`, `generar_visualizacion`) y el `AgenteConversacionalConfig` actualizado.

---

## 11. Próximo paso

Con la arquitectura funcional y el `AppContractConfig` cerrados, Fontana pasa al **Paso 4: prototipo interactivo con Artifacts**, tomando este documento como especificación de referencia. *(Nota v2: el Paso 4 está en curso; los ajustes de esta versión provienen de decisiones tomadas durante ese trabajo.)*

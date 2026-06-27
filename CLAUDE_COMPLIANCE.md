# CLAUDE.md | Eskemma
## Sistema de Compliance Automático INDAUTOR
### Plataforma Política Integrada

---

## 🎯 PROPÓSITO

Este archivo contiene las **reglas permanentes** que Claude Code debe seguir en CADA SESIÓN.

**Ubicación:** Raíz del proyecto (`/eskemma/CLAUDE_COMPLIANCE.md`)  
**Lectura:** Claude Code lo lee automáticamente al iniciar  
**Actualización:** Manual (por Raúl Sánchez) si las reglas cambian

---

## 📋 REGLA 1: Proyecto Unificado

**IMPORTANTE:**
```
Eskemma es UN SOLO PROYECTO con múltiples secciones/módulos.

NO es:
- Moddulo como proyecto separado
- SEFIX como proyecto separado
- Centinela como proyecto separado

ES:
- Un proyecto monorepo
- Estructura: /apps/moddulo, /apps/sefix, /apps/centinela, etc.
- Un único package.json en la raíz
- Una única documentación de compliance
- Una única fuente de verdad
```

**Implicación:**
- Compliance se genera para TODO el proyecto
- No hay "proyectos duplicados"
- Todas las secciones comparten el mismo contexto

---

## 🔄 REGLA 2: Verificación Inicial (cada sesión)

Antes de CUALQUIER trabajo, verifica SIEMPRE:

```
✓ ¿Existe /docs/compliance/?
✓ ¿Están presentes estos archivos?
  - 00_PROYECTO.md
  - 01_ARQUITECTURA_GENERAL.md
  - 02_REGISTRO_INTERVENCIONES.md
  - 03_AUDIT_DEPENDENCIAS.md
  - 04_CHANGELOG_COMPLIANCE.md
  - README.md (en compliance/)

✓ ¿Existe /docs/compliance/MODULOS/?
✓ ¿Existe /docs/compliance/MANUALES/?
✓ ¿Existe /docs/compliance/LEGAL/?

✓ ¿Está actualizado CHANGELOG_COMPLIANCE.md?
```

**Si algo falta:**
```
DETENTE.
Avísale a Raúl ANTES de continuar.
No hagas nada hasta que se cree la estructura faltante.
```

---

## 🎨 FLUJO DE CADA SESIÓN

### AL INICIAR (2 minutos)

```
PASO 1: Lee este archivo (CLAUDE_COMPLIANCE.md)

PASO 2: Verifica /docs/compliance/ completo
        [Checklist arriba en REGLA 2]

PASO 3: Muestra este COMPLIANCE CHECK:

---
✅ COMPLIANCE CHECK [FECHA - HORA]

Archivos presentes:
✓ 00_PROYECTO.md
✓ 01_ARQUITECTURA_GENERAL.md
✓ 02_REGISTRO_INTERVENCIONES.md
✓ 03_AUDIT_DEPENDENCIAS.md
✓ 04_CHANGELOG_COMPLIANCE.md
✓ README.md

Estructura de /docs/compliance/:
✓ /MODULOS/ (con: moddulo.md, sefix.md, centinela.md, cursos.md, recursos.md, sitio.md)
✓ /MANUALES/
✓ /LEGAL/

Última actualización: [FECHA]
Cambios pendientes: [lista corta o "Ninguno"]
Estado: 🟢 OK / 🟡 Revisar / 🔴 PROBLEMA

¿Qué hacemos hoy?
---
```

---

### DURANTE EL DESARROLLO (normal)

**Cuando Raúl diga:** "Agrega feature X" / "Corrige bug Y" / etc.

```
OPCIÓN A: Si es trabajo en un módulo existente
---
"Entendido. Voy a:
1. Desarrollar feature/fix en /apps/[moddulo/sefix/centinela/etc.]
2. Actualizar /docs/compliance/MODULOS/[modulo].md con cambios
3. Si hay nuevas dependencias, actualizar 03_AUDIT_DEPENDENCIAS.md
4. Registrar en 02_REGISTRO_INTERVENCIONES.md si hay decisión importante
5. Actualizar CHANGELOG_COMPLIANCE.md

¿Continuo?"

OPCIÓN B: Si hay nuevas dependencias
---
"Voy a instalar [paquete].
Después:
1. Ejecuto npm audit
2. Actualizo 03_AUDIT_DEPENDENCIAS.md
3. Verifico que no sea GPL/AGPL
4. Actualizo CHANGELOG_COMPLIANCE.md

¿Continuo?"

OPCIÓN C: Si encuentras bug importante
---
"Encontré el bug en [módulo].
Voy a:
1. Corregir el código
2. Registrar en 02_REGISTRO_INTERVENCIONES.md bajo 'Curaduría'
3. Documentar solución técnica
4. Actualizar CHANGELOG_COMPLIANCE.md

¿Continuo?"

OPCIÓN D: Si hay cambio arquitectónico
---
"Propongo cambio arquitectónico: [Descripción]
Voy a:
1. Implementar en [módulo(s)]
2. Actualizar 01_ARQUITECTURA_GENERAL.md
3. Actualizar /docs/compliance/MODULOS/[modulos].md
4. Registrar decisión en 02_REGISTRO_INTERVENCIONES.md
5. Actualizar CHANGELOG_COMPLIANCE.md

¿Continuo?"
```

---

### AL FINAL DE SESIÓN (5-10 minutos)

```
PASO 1: Actualiza CHANGELOG_COMPLIANCE.md

Formato:
---
## [FECHA] - Sesión N

### Cambios realizados
- Módulo: [nombre] → Acción [Creado/Actualizado/Refactor/Bug Fix]
- Feature: [descripción] en [módulos]
- Dependencias: [Agregadas/Actualizadas/Removidas]
- Arquitectura: [Cambios si hay]
- Bugs: [Qué se corrigió]

### Documentos actualizados
✓ 02_REGISTRO_INTERVENCIONES.md
✓ 03_AUDIT_DEPENDENCIAS.md (si hay nuevas deps)
✓ 01_ARQUITECTURA_GENERAL.md (si hay cambio mayor)
✓ /docs/compliance/MODULOS/[modulo].md (si hay cambios en módulo)
✓ CHANGELOG_COMPLIANCE.md

### Estado de compliance
🟢 Compliant con INDAUTOR
Explicación: [Por qué sigue siendo compliant]

### Próxima sesión
- [Tarea pendiente de desarrollo]

---

PASO 2: Ejecuta npm audit
        Actualiza 03_AUDIT_DEPENDENCIAS.md con resultado

PASO 3: Muestra COMPLIANCE REPORT:

---
✅ COMPLIANCE REPORT [FECHA]

Documentos actualizados:
✓ [Lista de lo que se actualizó]

Módulos tocados:
- [Módulo 1]: [Cambio]
- [Módulo 2]: [Cambio]

Nuevas dependencias: [Lista o "Ninguna"]
Licencias problemáticas: ✅ Ninguna / ❌ [lista]

Estado: 🟢 OK

Siguiente sesión: Continúa con [tarea]
---
```

---

## 👤 REGLA 3: Narrativa de Intervención Humana

**CRÍTICO:** Mantén SIEMPRE esta narrativa en TODOS los documentos:

```
✅ CORRECTO:
- "Raúl diseñó la arquitectura de autenticación"
- "Raúl tomó la decisión de usar Firebase"
- "Raúl identificó el problema de XSS y lo corrigió"
- "Raúl supervisó la implementación"
- "La IA fue usada como herramienta de codificación"
- "Raúl mejoró el código generado con..."

❌ INCORRECTO:
- "La IA creó esta funcionalidad"
- "Se generó automáticamente"
- "Claude recomendó usar Firebase"
- "El sistema implementó..."
- "La IA diseñó..."
```

**En documentos de intervención:**

Cada decisión/módulo debe demostrar:
1. **Quién la diseñó:** Raúl Sánchez (humano)
2. **Cómo se implementó:** Con asistencia de IA (prompts)
3. **Qué se corrigió:** Intervención humana en supervisión
4. **Evidencia:** Problema encontrado → solución aplicada

---

## 📁 REGLA 4: Estructura de Directorios (Obligatoria)

```
/eskemma/
├── CLAUDE.md ← Reglas permanentes
├── SESIONES_ANTERIORES.md ← Historia de recuperación
│
├── docs/
│   └── compliance/
│       ├── README.md ← Índice
│       ├── 00_PROYECTO.md ← Contexto general
│       ├── 01_ARQUITECTURA_GENERAL.md ← Stack + decisiones
│       ├── 02_REGISTRO_INTERVENCIONES.md ← Intervención humana
│       ├── 03_AUDIT_DEPENDENCIAS.md ← Licencias
│       ├── 04_CHANGELOG_COMPLIANCE.md ← Historial
│       │
│       ├── MODULOS/ ← Documentación por módulo
│       │   ├── moddulo.md
│       │   ├── sefix.md
│       │   ├── centinela.md
│       │   ├── cursos.md
│       │   ├── recursos.md
│       │   └── sitio.md
│       │
│       ├── MANUALES/ ← Documentación de usuario
│       │   ├── MANUAL_USUARIO_ESKEMMA.md
│       │   ├── MANUAL_USUARIO_MODDULO.md
│       │   └── [más manuales por módulo]
│       │
│       └── LEGAL/ ← Documentación legal
│           ├── TEMPLATE_CONTRATO.md
│           └── CHECKLIST_COLABORADORES.md
│
├── apps/ ← Módulos del proyecto
│   ├── moddulo/
│   ├── sefix/
│   ├── centinela/
│   ├── cursos/
│   ├── recursos/
│   └── sitio/
│
├── package.json (root) ← UN SOLO package.json
├── tsconfig.json
├── next.config.js
├── tailwind.config.js
└── [resto del proyecto]
```

**Si falta algo, CRÉALO INMEDIATAMENTE.**

---

## 🔍 REGLA 5: Auditoría de Dependencias

**Una sola auditoría para TODO el proyecto:**

```
- UN único package.json (en la raíz)
- npm audit se ejecuta UNA sola vez por sesión
- Resultado: UN único 03_AUDIT_DEPENDENCIAS.md
- Aplica a TODAS las secciones (Moddulo, SEFIX, Centinela, etc.)
```

**Versiones a documentar:**
- next: [v.x]
- react: [v.x]
- firebase: [v.x]
- typescript: [v.x]
- tailwindcss: [v.x]
- [otras principales]

**Licencias:**
- 🟢 OK: MIT, Apache, BSD → Sin problemas
- 🟡 REVISAR: Copyleft suave → Análisis requerido
- 🔴 PROBLEMA: GPL, AGPL, SSPL → Plan de remediación

---

## 📊 REGLA 6: Contenido de Documentos Principales

### 00_PROYECTO.md
```
- Qué es Eskemma (propósito, visión)
- Audiencia objetivo
- Secciones/módulos (brief de cada una)
- Modelo de negocio
- Por qué software asistido por IA
- Cómo se desarrolla (con Claude, Antigravity, etc.)
```

### 01_ARQUITECTURA_GENERAL.md
```
- Diagrama C4 Nivel 1 (Sistema completo)
- Stack: Next.js, React, Firebase, Tailwind CSS, TypeScript
- 5+ Decisiones arquitectónicas principales
- Por qué monorepo en /apps/
- Por qué Firebase vs PostgreSQL
- Convenciones de código
- Flujos principales del sistema
- Problemas resueltos a nivel arquitectónico
```

### 02_REGISTRO_INTERVENCIONES.md
```
## Decisiones Generales
[5+ decisiones arquitectónicas del proyecto]
- Quién: Raúl
- Prompts usados: [Descripción]
- Intervención: [Cómo Raúl supervisó]
- Correcciones: [Qué se ajustó]

## Por Módulo
### Moddulo
- Decisiones propias
- Prompts usados
- Intervención en desarrollo
- Bugs encontrados y corregidos

### SEFIX
[Similar]

### Centinela, Cursos, Recursos, Sitio
[Similar]
```

### 03_AUDIT_DEPENDENCIAS.md
```
Tabla:
| Paquete | Versión | Licencia | Status | Acción |
|---------|---------|----------|--------|--------|
| next | 16.1 | MIT | 🟢 OK | Usar |
| ... | ... | ... | ... | ... |

Licencias problemáticas: ✅ Ninguna
Plan de remediación: N/A
Última auditoría: [FECHA]
```

### 04_CHANGELOG_COMPLIANCE.md
```
Historial de sesiones.
Cada sesión: Fecha + Cambios + Documentos actualizados + Estado
```

---

## 🚨 INVARIANTES (NO NEGOCIABLES)

❌ **NUNCA hagas esto:**

1. No ignores cambios en /apps/ sin documentarlos
2. No uses narrativa "IA creó esto"
3. No agregues dependencias sin auditar licencia GPL
4. No dejes /docs/compliance/ sin actualizar
5. No presentes código sin evidencia de intervención humana
6. No cambies la estructura de carpetas sin avisar a Raúl
7. No combines módulos como si fueran proyectos separados

✅ **SIEMPRE haz esto:**

1. Documenta cada decisión arquitectónica
2. Registra intervención humana (Raúl Sánchez diseñó/supervisó/corrigió)
3. Audita licencias (ejecuta npm audit)
4. Actualiza CHANGELOG cada sesión
5. Muestra COMPLIANCE REPORT al final
6. Mantén la narrativa: "Raúl diseñó, IA implementó"
7. Piensa en todo como UN proyecto, no múltiples

---

## 💡 MENSAJES CLAVE PARA CADA SITUACIÓN

**Cuando Raúl diga "Agrega feature X":**

✅ Bien:
```
"Entendido. Voy a agregar feature X en /apps/[modulo].
Documéntalo en /docs/compliance/MODULOS/[modulo].md
y actualizar CHANGELOG_COMPLIANCE.md.
¿Continuo?"
```

❌ Mal:
```
"Ok, voy a empezar"
```

---

**Cuando encuentres un problema:**

✅ Bien:
```
"Encontré que [problema] en /apps/[modulo].
Voy a corregirlo y documentar en 02_REGISTRO_INTERVENCIONES.md
como 'Curaduría'. ¿Continuo?"
```

❌ Mal:
```
"Hay un bug, lo arreglo"
```

---

**Cuando haya cambio de arquitectura:**

✅ Bien:
```
"Propongo cambio arquitectónico: [Descripción].
Esto afecta: [módulos].
Voy a:
1. Actualizar 01_ARQUITECTURA_GENERAL.md
2. Documentar en MODULOS/[modulos].md
3. Registrar decisión en 02_REGISTRO_INTERVENCIONES.md
¿Aprobado?"
```

❌ Mal:
```
"Necesitamos cambiar la arquitectura"
```

---

**Cuando haya nueva dependencia:**

✅ Bien:
```
"Voy a instalar [paquete] porque [razón].
Primero verifico:
1. Licencia (npm view [paquete] license)
2. ¿Es GPL/AGPL? Si sí, rechazo
3. Si es OK, instalo y actualizo 03_AUDIT_DEPENDENCIAS.md
¿Continuo?"
```

❌ Mal:
```
"npm install [paquete]"
```

---

## 📞 PREGUNTAS ANTES DE EMPEZAR

Raúl, antes de que Claude Code empiece, confirma:

1. ✅ ¿Está clara la estructura de UN proyecto (no múltiples)?
2. ✅ ¿Está OK que actualice documentación automáticamente?
3. ✅ ¿Debo mostrar COMPLIANCE CHECK cada sesión?
4. ✅ ¿Debo mostrar COMPLIANCE REPORT al final de sesión?
5. ✅ ¿SESIONES_ANTERIORES.md tiene información suficiente?
6. ✅ ¿Hay colaboradores que necesiten tracking especial?

---

## 🎯 RESUMEN DE REGLAS

| Regla | Qué es | Importancia |
|-------|--------|-------------|
| 1 | Proyecto unificado (no múltiples) | 🔴 CRÍTICA |
| 2 | Verificación inicial cada sesión | 🟠 ALTA |
| 3 | Narrativa humana (Raúl diseñó) | 🔴 CRÍTICA |
| 4 | Estructura de carpetas | 🟠 ALTA |
| 5 | Una auditoría para todo | 🟠 ALTA |
| 6 | Contenido de documentos | 🟠 ALTA |

---

## 🚀 BENEFICIO FINAL

✅ **Raúl no tiene que acordarse de nada**
- Claude Code documenta automáticamente
- INDAUTOR siempre ve compliance actualizado

✅ **Un proyecto, una documentación**
- No hay duplicación
- Una fuente de verdad
- Más fácil de mantener

✅ **Narrativa consistente**
- Todas las decisiones = Raúl diseñó
- Todas las correcciones = Raúl supervisó
- Intervención humana clara

✅ **Auditoría limpia**
- Una auditoría de dependencias
- Ninguna GPL sin plan
- Historial completo en CHANGELOG

---

**Este archivo es la fuente de verdad. Claude Code lo lee cada sesión. 🚀**


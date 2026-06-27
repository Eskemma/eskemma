# 03_AUDIT_DEPENDENCIAS.md | Eskemma
## Auditoría de Dependencias para Registro INDAUTOR

**Fecha de auditoría:** 2026-04-10  
**Autor:** Raúl Sánchez Salgado  
**Versión:** 1.0

---

> **Nota:** Esta auditoría documenta las dependencias de terceros utilizadas en
> Eskemma, sus licencias y el resultado del análisis de vulnerabilidades.
> El objetivo es demostrar que ninguna dependencia impone restricciones de
> licencia incompatibles con el registro de propiedad intelectual.

---

## Resultado General

| Criterio | Estado |
|----------|--------|
| Licencias GPL / AGPL | 🟢 **Ninguna** — no existe dependencia con licencia viral |
| Licencias MIT | 🟢 Permitidas — sin restricciones de distribución |
| Licencias Apache 2.0 | 🟢 Permitidas — requieren atribución, permiten uso comercial |
| Vulnerabilidades críticas | 🟡 2 detectadas (en cadena puppeteer/firebase-admin — sin exposición directa) |
| Última auditoría `npm audit` | 2026-04-10 |

**Conclusión:** Ninguna dependencia de Eskemma tiene licencia GPL, LGPL o AGPL.
El código propietario de Eskemma no está sujeto a restricciones copyleft.

---

## Dependencias Directas — Producción

| Paquete | Versión | Licencia | Propósito | Estado |
|---------|---------|----------|-----------|--------|
| `next` | ^16.1.1 | MIT | Framework principal (App Router) | 🟢 OK |
| `react` | ^19.2.3 | MIT | UI library | 🟢 OK |
| `react-dom` | ^19.2.3 | MIT | DOM bindings de React | 🟢 OK |
| `typescript` | ^5.x | Apache 2.0 | Lenguaje de tipado | 🟢 OK |
| `@anthropic-ai/sdk` | ^0.78.0 | MIT | Integración con Claude AI | 🟢 OK |
| `firebase` | ^11.8.1 | Apache 2.0 | Firebase Auth + Firestore (cliente) | 🟢 OK |
| `firebase-admin` | ^13.6.0 | Apache 2.0 | Firebase Admin SDK (servidor) | 🟡 Vulns indirectas |
| `tailwindcss` | ^4.1.5 | MIT | Framework de estilos CSS | 🟢 OK |
| `recharts` | ^3.8.1 | MIT | Gráficas y visualizaciones | 🟢 OK |
| `@heroicons/react` | ^2.2.0 | MIT | Iconografía | 🟢 OK |
| `dompurify` | ^3.2.6 | Apache 2.0 / Mozilla PL | Sanitización HTML (XSS prevention) | 🟡 2 CVEs moderados |
| `isomorphic-dompurify` | ^2.26.0 | Apache 2.0 | DOMPurify en SSR | 🟢 OK |
| `nodemailer` | ^7.0.10 | MIT | Envío de email transaccional | 🟢 OK |
| `resend` | ^6.3.0 | MIT | API de email (Resend) | 🟢 OK |
| `puppeteer` | ^24.36.0 | Apache 2.0 | Scraping web para PESTEL | 🟡 Vulns en cadena |
| `date-fns` | ^4.1.0 | MIT | Utilidades de fecha | 🟢 OK |
| `react-markdown` | ^10.1.0 | MIT | Renderizado de Markdown en React | 🟢 OK |
| `remark` | ^15.0.1 | MIT | Procesamiento de Markdown | 🟢 OK |
| `remark-gfm` | ^4.0.1 | MIT | GitHub Flavored Markdown | 🟢 OK |
| `remark-html` | ^16.0.1 | MIT | Markdown → HTML | 🟢 OK |
| `gray-matter` | ^4.0.3 | MIT | Parsing de frontmatter en contenido | 🟢 OK |
| `mammoth` | ^1.12.0 | BSD 2-Clause | Conversión DOCX → HTML | 🟢 OK |
| `pdf-parse` | ^2.4.5 | MIT | Extracción de texto de PDFs | 🟢 OK |
| `docx` | ^9.5.1 | MIT | Generación de archivos DOCX | 🟢 OK |
| `browser-image-compression` | ^2.0.2 | MIT | Compresión de imágenes en cliente | 🟢 OK |
| `google-auth-library` | ^10.1.0 | Apache 2.0 | Autenticación Google APIs | 🟢 OK |
| `gaxios` | ^7.1.1 | Apache 2.0 | HTTP client (Google APIs) | 🟢 OK |
| `gtoken` | ^8.0.0 | MIT | Google token management | 🟢 OK |

---

## Dependencias Directas — Desarrollo

| Paquete | Versión | Licencia | Propósito | Estado |
|---------|---------|----------|-----------|--------|
| `tsx` | ^4.21.0 | MIT | Ejecución de TypeScript sin compilar | 🟢 OK |
| `csv-parse` | ^6.2.1 | MIT | Parsing de CSVs (script pregenerate) | 🟢 OK |
| `dotenv` | ^17.4.1 | BSD 2-Clause | Variables de entorno en scripts locales | 🟢 OK |
| `prettier` | ^3.5.3 | MIT | Formateador de código | 🟢 OK |
| `postcss` | ^8.5.3 | MIT | Procesamiento de CSS | 🟢 OK |
| `@tailwindcss/postcss` | ^4.1.5 | MIT | Plugin PostCSS para Tailwind | 🟢 OK |
| `@types/node` | ^20.x | MIT | Tipos TypeScript para Node.js | 🟢 OK |
| `@types/react` | ^19.x | MIT | Tipos TypeScript para React | 🟢 OK |
| `@types/react-dom` | ^19.x | MIT | Tipos TypeScript para ReactDOM | 🟢 OK |
| `@types/dompurify` | ^3.0.5 | MIT | Tipos TypeScript para DOMPurify | 🟢 OK |
| `@types/nodemailer` | ^7.0.4 | MIT | Tipos TypeScript para Nodemailer | 🟢 OK |
| `@types/pdf-parse` | ^1.1.5 | MIT | Tipos TypeScript para pdf-parse | 🟢 OK |
| `@types/sharp` | ^0.31.1 | MIT | Tipos TypeScript para sharp | 🟢 OK |

---

## Cloud Functions — Dependencias Adicionales

Las Cloud Functions tienen su propio `package.json` en `/functions/` con
dependencias adicionales para el scraping y procesamiento de PESTEL:

| Paquete | Licencia | Propósito |
|---------|----------|-----------|
| `firebase-functions` | Apache 2.0 | SDK de Cloud Functions |
| `firebase-admin` | Apache 2.0 | Firebase Admin (en Functions) |
| `@anthropic-ai/sdk` | MIT | Claude AI en Cloud Functions |
| `axios` | MIT | HTTP client para scrapers |
| `cheerio` | MIT | HTML parsing / scraping |
| `fast-xml-parser` | MIT | Parsing de RSS/XML | 
| `rss-parser` | MIT | Parsing de feeds RSS |

---

## Reporte de Vulnerabilidades (`npm audit`)

**Fecha:** 2026-04-10  
**Comando:** `npm audit`  
**Resultado:** 35 vulnerabilidades (8 low, 3 moderate, 22 high, 2 critical)

### Vulnerabilidades Críticas

| ID | Paquete | CVE | Descripción | Ruta de dependencia | Impacto en Eskemma |
|----|---------|-----|-------------|--------------------|--------------------|
| 1 | `basic-ftp` | — | Path traversal en cliente FTP | `puppeteer` → `@puppeteer/browsers` → `basic-ftp` | **Nulo** — `basic-ftp` es dependencia transitiva de puppeteer para descargar el binario de Chrome. No se usa FTP en Eskemma. |
| 2 | `fast-xml-parser` | CVE-2025-XXXX | Prototype pollution en parsing XML | `firebase-admin` → `@google-cloud/storage` → `fast-xml-parser` | **Bajo** — Solo afecta parsing de responses XML internas de Google Cloud Storage, no inputs de usuario. |

### Vulnerabilidades de Severidad Alta (resumen)

Las 22 vulnerabilidades de severidad alta provienen principalmente de:

1. **Cadena `firebase-admin`** → `@google-cloud/storage` → `@tootallnate/once` → `teeny-request`:
   - Afectan comunicaciones internas del SDK de Firebase Admin
   - No hay exposición directa a inputs del usuario
   - Corrección: `npm audit fix --force` (requiere downgrade a `firebase-admin@10.3.0`, que
     es incompatible con la versión actual de firebase-functions)

2. **Cadena `puppeteer`** (scrapers de PESTEL en Cloud Functions):
   - Afectan descarga del binario de Chrome y comunicaciones internas
   - Los scrapers corren en Cloud Functions, no en Vercel/cliente

### Vulnerabilidades Moderadas

| Paquete | CVE | Descripción | Acción |
|---------|-----|-------------|--------|
| `brace-expansion` | — | ReDoS en glob pattern expansion | Bajo riesgo — no hay inputs de usuario en globs |
| `dompurify` | CVE-2024-47875 | Bypass de sanitización en edge case | Mitigado: siempre usar `isomorphic-dompurify` en SSR; actualizar a ≥3.2.4 (ya en ^3.2.6) |
| `dompurify` | CVE-2025-XXXX | Bypass con ciertas configuraciones | Mitigado: no se usa config custom en Eskemma — solo `DOMPurify.sanitize(html)` |

### Plan de Remediación

| Prioridad | Paquete | Acción | Fecha objetivo |
|-----------|---------|--------|---------------|
| Alta | `dompurify` | Mantener en ^3.2.6 (ya parcheado) | ✅ Resuelto |
| Media | `firebase-admin` | Monitorear actualización del SDK que resuelva cadena | Q2 2026 |
| Baja | `puppeteer` | Actualizar cuando haya versión con `basic-ftp` parchado | Q2 2026 |
| Baja | `brace-expansion` | `npm audit fix` en próximo sprint | Q2 2026 |

---

## Análisis de Licencias — Conclusión Legal

### Categorías de licencias en uso

| Licencia | Paquetes | Restricciones |
|----------|----------|---------------|
| **MIT** | next, react, @anthropic-ai/sdk, recharts, date-fns, mammoth, csv-parse, tsx, dotenv, nodemailer, resend, gray-matter, pdf-parse, docx, tailwindcss... | Ninguna — uso comercial libre, distribución libre, sin copyleft |
| **Apache 2.0** | firebase, firebase-admin, typescript, google-auth-library, gaxios, puppeteer, isomorphic-dompurify... | Requieren conservar aviso de licencia. Sin copyleft. |
| **BSD 2-Clause** | mammoth, dotenv | Sin copyleft. Uso comercial libre. |
| **Mozilla PL 2.0** | dompurify (código JS) | Copyleft de archivo — aplica solo al archivo `purify.js`. No al código de Eskemma. |

### Por qué no hay restricciones de copyright

1. **Ninguna dependencia GPL/LGPL/AGPL:** Las licencias copyleft fuertes (GPL) exigen que
   el software derivado se libere bajo los mismos términos. Ninguna dependencia de Eskemma
   usa estas licencias.

2. **MIT y Apache 2.0 son permisivas:** Permiten uso en software comercial propietario sin
   imponer restricciones al código que las usa.

3. **DOMPurify (MPL 2.0):** La Mozilla Public License 2.0 es copyleft de archivo — solo
   exige que las modificaciones al archivo `purify.js` se liberen bajo MPL. El código de
   Eskemma que *usa* DOMPurify no está afectado.

4. **El código original de Eskemma es propiedad de Raúl Sánchez Salgado** y puede
   registrarse ante INDAUTOR sin restricción alguna derivada de las dependencias.

---

## Plataformas de Despliegue (licencias propietarias)

| Plataforma | Tipo de licencia | Relación con el código |
|------------|-----------------|----------------------|
| Vercel | SaaS propietario | Servicio de hosting — no afecta la propiedad del código |
| Google Cloud / Firebase | SaaS propietario (Apache 2.0 para SDKs) | Los SDKs son Apache 2.0; el servicio es propietario |
| GitHub | SaaS propietario | Repositorio privado — no afecta la propiedad del código |

---

*Documento generado bajo supervisión de Raúl Sánchez Salgado — 2026-04-10*

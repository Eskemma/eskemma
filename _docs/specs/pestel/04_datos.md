# Spec — Etapa 4: Recolección de datos e integración de fuentes

## Modo de operación

PESTEL opera en **modo mixto por defecto**: combina automático y
asistido. No existe un "modo solo automático" ni un "modo solo manual".

### Submodo automático (IA + APIs)

Fuentes de conexión directa prioritarias:
- Banco Mundial (indicadores económicos y de gobernanza)
- CEPALSTAT (estadísticas regionales)
- IDEA Internacional (datos electorales comparativos)
- Latinobarómetro (cuando disponible via API)
- Institutos de estadística nacionales (INEGI para México, IBGE para
  Brasil, DANE para Colombia, INE para Chile, INEI para Perú)
- Plataformas de social listening via API: Meltwater o Brandwatch
  (requiere credenciales del cliente)

La IA también realiza scraping de medios locales y monitoreo de redes
sociales según las palabras clave definidas para el territorio.

### Submodo asistido (carga manual + IA procesa)

El usuario puede subir:
- Encuestas propias (PDF, Excel)
- Reportes internos (Word, PDF)
- Notas de campo (texto libre)
- Entrevistas transcritas (texto)

La IA extrae los datos relevantes para cada dimensión PEST-L, los
clasifica y los integra al análisis. El usuario valida la clasificación.

---

## Semáforo de cobertura

La interfaz de esta etapa muestra un semáforo por dimensión que se
mantiene visible en las Etapas 5 y 6:

| Estado | Condición | Acción de PESTEL |
|--------|-----------|---------------------|
| 🟢 Verde | ≥ 3 variables con datos confiables | Proceder |
| 🟡 Amarillo | 1-2 variables con datos / confianza parcial | Advertencia (no bloqueo) |
| 🔴 Rojo | 0 variables con datos o confianza < 40% | Bloqueo — solicitar más datos |

---

## Trazabilidad de datos (obligatoria)

Cada dato en el sistema registra:
- `source`: nombre de la fuente
- `capturedAt`: fecha y hora de captura
- `reliabilityLevel`: `'HIGH' | 'MEDIUM' | 'LOW'`
- `isManual`: boolean

Los informes de la Etapa 7 incluyen la ficha completa de cada dato.

---


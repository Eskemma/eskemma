# Spec — Etapa 2: Definición del territorio y alcance

## Propósito

Define con precisión el espacio geográfico, institucional, electoral y
temporal que PESTEL va a analizar. Es la base sobre la que se
construyen todas las búsquedas de datos en la Etapa 4.

---

## Cuatro niveles de definición territorial

El usuario puede combinar estos niveles. Todos son opcionales excepto
el Geográfico.

### Nivel geográfico (obligatorio)

Selección jerárquica:
- País
- Estado / Departamento / Provincia
- Municipio / Alcaldía
- Distrito electoral federal
- Distrito electoral local

Granularidad importante: un PEST-L nacional en México es radicalmente
distinto a uno para el Estado de Oaxaca. PESTEL debe mostrar la
granularidad seleccionada como contexto en todas las etapas posteriores.

Mostrar como ejemplos al usuario: "País: México", "Estado: Oaxaca",
"Municipio: Oaxaca de Juárez", "Distrito federal 01 de Oaxaca".

### Nivel institucional (opcional)

El referente del análisis. Ejemplos a mostrar al usuario:
- Ejecutivo federal
- Legislativo (federal o local)
- Gobierno municipal
- Organismo autónomo
- Partido político específico
- Movimiento social
- Actor político específico (candidato, líder, etc.)

### Nivel electoral (condicional — solo si aplica)

Aparece cuando el tipo de proyecto es ELECTORAL.
Campos:
- Tipo de elección (presidencial, legislativa, municipal, etc.)
- Fecha del proceso electoral
- Organismo electoral principal (INE, TSE, CNE, etc. — según país)
- Normativa aplicable (varía por país, campo de texto libre)

### Nivel temporal

- Fecha de inicio del análisis (default: hoy)
- Fecha de corte para la "foto" inicial
- Frecuencia de actualización (semanal, quincenal, mensual)

PESTEL guarda una línea de tiempo del proyecto para comparar
versiones del PEST-L a lo largo del tiempo.

---

## Análisis previo del territorio

Al iniciar esta etapa, PESTEL consulta si existe un análisis previo
del mismo territorio en la plataforma (mismo país + estado + municipio).

Si existe:
- Ofrecer opción de importar datos base del análisis previo.
- El usuario puede seleccionar qué dimensiones importar.
- Los datos importados se marcan como "heredados" en la Etapa 4.

Si no existe: continuar con análisis nuevo.

---

## Estado persistido

```typescript
type TerritoryConfig = {
  projectId: string;
  geographic: {
    country: string;
    state?: string;
    municipality?: string;
    electoralDistrictFederal?: string;
    electoralDistrictLocal?: string;
  };
  institutional?: string;
  electoral?: {
    electionType: string;
    electionDate: Date;
    electoralBody: string;
    regulation: string;
  };
  temporal: {
    startDate: Date;
    snapshotDate: Date;
    updateFrequency: 'WEEKLY' | 'BIWEEKLY' | 'MONTHLY';
  };
  importedFromProjectId?: string;
}
```

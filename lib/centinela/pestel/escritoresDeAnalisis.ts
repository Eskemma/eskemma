// lib/centinela/pestel/escritoresDeAnalisis.ts
// T4: lista CERRADA de los archivos que escriben en Firestore y mencionan la colección `pestel_analyses`.
//
// POR QUÉ EXISTE: la huella de origen (`huellaOrigen.ts`) y la nota de T3 asumen que, una vez creado un análisis,
// lo único que cambia de su CONTENIDO (`dimensions`, `adjustments`) es la ruta `adjust`. El resto del documento
// (estado de revisión, alertas, cadenas, informes) no es contenido para F2. Si un escritor nuevo toca
// `dimensions`, `globalConfidence` o `version` de un análisis existente, esa suposición deja de ser cierta.
//
// `contratoEscritores.test.ts` (capa A) exige que todo archivo con una escritura que mencione la colección esté
// aquí; `contratoEscritores.capaB.test.ts` ejecuta cada ruta escritora y comprueba que solo toca lo declarado en
// `toca` y que `dimensions`, `globalConfidence` y `version` quedan intactos.
//
// `toca`: campos de `pestel_analyses/{id}` que el archivo escribe. `[]` = menciona la colección (para leerla) pero
// escribe OTRA. Un texto que empieza con «*» describe un efecto que no es "editar campos" (crear, borrar, copiar).

export interface EscritorDeAnalisis {
  archivo: string;
  toca: string[];
  nota: string;
}

/** Campos que ningún escritor de un análisis EXISTENTE puede tocar (son el contenido que F2 importa o su versión). */
export const CAMPOS_PROTEGIDOS_DE_ANALISIS = ["dimensions", "globalConfidence", "version"] as const;

const A = "app/api/centinela/pestel/analysis/[analysisId]";

export const ESCRITORES_DE_ANALISIS: EscritorDeAnalisis[] = [
  {
    archivo: "functions/src/pestel/generateFeed.ts",
    toca: ["*crea el documento", "vigente"],
    nota: "Cada análisis es un documento NUEVO; solo apaga `vigente` en los anteriores. Nunca edita dimensions de uno existente.",
  },
  {
    archivo: `${A}/adjust/route.ts`,
    toca: ["adjustments", "status", "updatedAt", "approvedAt", "approvedBy", "aprobacionJustificacion", "aprobacionConfianza", "aprobacionAnterior", "aprobacionRetirada"],
    nota: "Único escritor de `adjustments`. Retira la aprobación si el análisis estaba APPROVED.",
  },
  {
    archivo: `${A}/approve/route.ts`,
    toca: ["status", "approvedAt", "approvedBy", "aprobacionJustificacion", "aprobacionConfianza", "updatedAt"],
    nota: "Estado de revisión.",
  },
  {
    archivo: `${A}/acknowledge-bias/route.ts`,
    toca: ["biasAlerts", "status", "updatedAt"],
    nota: "Reconocimiento de sesgos.",
  },
  {
    archivo: `${A}/impact-chain/route.ts`,
    toca: ["impactChains", "updatedAt"],
    nota: "Cadenas de impacto del analista.",
  },
  {
    archivo: `${A}/informes/route.ts`,
    toca: ["informes"],
    nota: "Migración de informes desde localStorage.",
  },
  {
    archivo: `${A}/informes/[informeId]/route.ts`,
    toca: ["informes"],
    nota: "Edición de un informe.",
  },
  {
    archivo: `${A}/generate-report/route.ts`,
    toca: ["informes"],
    nota: "Agrega un informe generado (arrayUnion).",
  },
  {
    archivo: "app/api/centinela/pestel/project/[projectId]/route.ts",
    toca: ["*borra el documento"],
    nota: "DELETE del proyecto: borra en cascada sus análisis.",
  },
  {
    archivo: "scripts/migrate-centinela-to-pestel.ts",
    toca: ["*copia el documento"],
    nota: "Script de una sola vez (migración histórica); crea documentos, no edita existentes.",
  },
  {
    archivo: "app/api/moddulo/f2/generate-dvs/route.ts",
    toca: [],
    nota: "Lee el análisis (ruta legada); escribe moddulo_projects.",
  },
  {
    archivo: "app/api/centinela/pestel/project/[projectId]/link-moddulo/route.ts",
    toca: [],
    nota: "Lee el análisis vigente; escribe moddulo_projects y pestel_projects.",
  },
  {
    archivo: "app/api/moddulo/f2/import-pestel/route.ts",
    toca: [],
    nota: "Lee el análisis; escribe moddulo_projects y pestel_projects.",
  },
  {
    archivo: "app/api/centinela/pestel/export-to-moddulo/route.ts",
    toca: [],
    nota: "Lee el análisis; escribe moddulo_projects.",
  },
];

// lib/pestel/senalCampos.ts
// T7 C4 (N7 / H73): UNA sola regla para leer la fuente, la fecha de corte y el nivel de confianza de una señal al
// MOSTRARLA o SERIALIZARLA. Nunca se usa para guardar ni para la huella de origen: lo guardado no se toca.
//
//  - Ausente = ausente, vacío (o solo espacios) o el literal «sin fecha» (en la fecha; lo escribe el modelo cuando la
//    fuente no trae período; sin distinguir mayúsculas).
//  - El nivel solo es válido si es alto | medio | bajo (sin distinguir mayúsculas); cualquier otra cosa es «sin nivel».
//    Un nivel ausente NUNCA se interpreta como «bajo».
//  - Los textos fijos para decirlo al modelo o a la persona viven aquí: nadie los reescribe.
//
// Límite declarado: toda pieza de código que muestre o serialice fecha, fuente o nivel de una señal debe pasar por
// este módulo (lo vigila `senalCampos.recorrido.test.ts`, con una lista explícita de excepciones).

export const FUENTE_NO_REGISTRADA = "fuente no registrada";
export const FECHA_NO_REGISTRADA = "fecha no registrada";

export type NivelConfianza = "alto" | "medio" | "bajo";
const NIVELES: readonly string[] = ["alto", "medio", "bajo"];

const texto = (v: unknown): string => (typeof v === "string" ? v.trim() : "");

/** Fuente de la señal, o null si falta (vacía o solo espacios). */
export function fuenteLegible(s: { fuente?: unknown } | null | undefined): string | null {
  return texto(s?.fuente) || null;
}

/** Fecha de corte de la señal, o null si falta (vacía, espacios o el literal «sin fecha»). */
export function fechaLegible(s: { fechaCorte?: unknown } | null | undefined): string | null {
  const f = texto(s?.fechaCorte);
  return f && f.toLowerCase() !== "sin fecha" ? f : null;
}

/** Nivel de confianza normalizado (minúsculas), o null si falta o no es uno de los tres valores. */
export function nivelLegible(s: { nivelConfianza?: unknown } | null | undefined): NivelConfianza | null {
  const n = texto(s?.nivelConfianza).toLowerCase();
  return NIVELES.includes(n) ? (n as NivelConfianza) : null;
}

/** Cuenta, sobre una lista de señales, cuántas no tienen fuente, cuántas no tienen fecha y cuántas tienen alguna de las dos carencias. */
export function contarCarencias(senales: ReadonlyArray<{ fuente?: unknown; fechaCorte?: unknown }>): {
  total: number;
  sinFuente: number;
  sinFecha: number;
  incompletas: number;
} {
  let sinFuente = 0, sinFecha = 0, incompletas = 0;
  for (const s of senales) {
    const f = fuenteLegible(s) === null;
    const d = fechaLegible(s) === null;
    if (f) sinFuente++;
    if (d) sinFecha++;
    if (f || d) incompletas++;
  }
  return { total: senales.length, sinFuente, sinFecha, incompletas };
}

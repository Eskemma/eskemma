// lib/moddulo/extractedDataGrounding.ts
// Guard de grounding para los datos que el chat de Moddulo extrae y el
// servidor persiste (chat/[phaseId]/route.ts): descarta ANTES de la escritura
// a Firestore y de emitirlos al cliente cualquier valor con cifras o fechas
// que no aparezcan, en ninguna forma equivalente, en lo que el usuario dijo.
//
// Origen (forense 26-09-18, 11 proyectos reales): el modelo persistió
// "~170,000 representantes de casilla" sin que el usuario diera ninguna cifra,
// y "2030-06-01" cuando el usuario solo dijo "junio de 2030" (día inventado).
//
// Deliberadamente DETERMINISTA (sin segunda llamada al modelo): las
// invenciones que importan son cifras y fechas, que se verifican por
// aritmética/normalización sin latencia, sin costo por turno y sin un
// verificador que pueda alucinar; y es testeable de forma permanente. El
// límite conocido: no ve parafraseos sin cifras ni fechas (p. ej. un nombre de
// institución equivocado) ni la OMISIÓN de un dato que el usuario sí dio.
//
// Un chequeo numérico ingenuo daba ~93 % de falsos positivos sobre esos
// mismos datos; por eso se toleran las conversiones legítimas de formato:
//   - separadores de miles/decimales ("1,500,000", "1.500.000", "1.5")
//   - multiplicadores ("20 millones", "1.5 MDP", "50 mil", "tres millones")
//   - números escritos con palabras ("cincuenta millones")
//   - fechas en otro formato ("06/06/27" ↔ "2027-06-06" ↔ "6 de junio de 2027")
//   - fechas relativas ("4 meses" → "Diciembre 2026"), y la fecha de hoy
//   - sumas, productos y conteos derivados de cifras/listas que el usuario dio

const MESES: Record<string, number> = {
  enero: 1, febrero: 2, marzo: 3, abril: 4, mayo: 5, junio: 6, julio: 7,
  agosto: 8, septiembre: 9, setiembre: 9, octubre: 10, noviembre: 11,
  diciembre: 12,
};
const MES_RE = Object.keys(MESES).join("|");

/** Prefijos que el servidor persiste (route.ts) — solo esos se verifican. */
export const PREFIJOS_VERIFICADOS = ["xpcto.", "pestl.", "semaforo.", "hipotesis."];

/**
 * Cifra derivada por el sistema, no dicha por el usuario: se calcula a partir
 * de la fecha límite (verificado 16/16 coherente en datos reales). Se exime,
 * pero se descarta junto con su fecha si esta se rechaza.
 */
const CLAVE_DURACION = "xpcto.tiempo.duracionMeses";
const CLAVE_FECHA_LIMITE = "xpcto.tiempo.fechaLimite";

function normalizar(texto: string): string {
  return texto.toLowerCase().normalize("NFD").replace(/[̀-ͯ]/g, "");
}

// ==========================================
// FECHAS
// ==========================================

interface FechaRef {
  y: number;
  m: number;
  /** undefined → precisión de mes ("junio de 2030") */
  d?: number;
  raw: string;
}

const anio4 = (y: number) => (y < 100 ? 2000 + y : y);

/**
 * Extrae fechas de un texto YA normalizado y devuelve además el texto con esos
 * fragmentos enmascarados (para que sus partes no se re-cuenten como cifras).
 */
function extraerFechas(texto: string): { fechas: FechaRef[]; resto: string } {
  const fechas: FechaRef[] = [];
  let resto = texto;
  const patrones: { re: RegExp; make: (m: RegExpExecArray) => FechaRef | null }[] = [
    {
      re: /\b(\d{4})-(\d{1,2})-(\d{1,2})\b/g,
      make: (m) => ({ y: +m[1], m: +m[2], d: +m[3], raw: m[0] }),
    },
    {
      // dd/mm/aa(aa) — formato mexicano (día primero)
      re: /\b(\d{1,2})[/.-](\d{1,2})[/.-](\d{4}|\d{2})\b/g,
      make: (m) => ({ y: anio4(+m[3]), m: +m[2], d: +m[1], raw: m[0] }),
    },
    {
      re: new RegExp(`\\b(\\d{1,2})\\s+de\\s+(${MES_RE})\\s+(?:de|del)?\\s*(\\d{4})\\b`, "g"),
      make: (m) => ({ y: +m[3], m: MESES[m[2]], d: +m[1], raw: m[0] }),
    },
    {
      re: new RegExp(`\\b(${MES_RE})\\s+(?:de|del)?\\s*(\\d{4})\\b`, "g"),
      make: (m) => ({ y: +m[2], m: MESES[m[1]], raw: m[0] }),
    },
  ];
  for (const { re, make } of patrones) {
    const encontradas: { ini: number; fin: number }[] = [];
    let m: RegExpExecArray | null;
    while ((m = re.exec(resto)) !== null) {
      const f = make(m);
      if (f && f.m >= 1 && f.m <= 12 && (f.d === undefined || (f.d >= 1 && f.d <= 31))) {
        fechas.push(f);
        encontradas.push({ ini: m.index, fin: m.index + m[0].length });
      }
    }
    for (const { ini, fin } of encontradas) {
      resto = resto.slice(0, ini) + " ".repeat(fin - ini) + resto.slice(fin);
    }
  }
  return { fechas, resto };
}

// ==========================================
// CIFRAS
// ==========================================

interface CifraToken {
  /** Valores posibles (una cadena como "1.500" es ambigua: 1.5 ó 1500). */
  candidatos: number[];
  /** Factor de multiplicador escrito ("millones", "mdp", "mil"…); 1 si no hay. */
  factor: number;
  esPorcentaje: boolean;
  raw: string;
  ini: number;
  fin: number;
  /** true si vino de palabras ("cincuenta millones") */
  deLetras: boolean;
}

const MULTIPLICADORES: [RegExp, number][] = [
  [/^mil\s+millones\b/, 1e9],
  [/^millones\b|^millon\b/, 1e6],
  [/^mmdp\b/, 1e9],
  [/^mdp\b/, 1e6],
  [/^mil\b/, 1e3],
];

function candidatosDeLiteral(literal: string): number[] {
  if (/^\d+$/.test(literal)) return [Number(literal)];
  const tienePunto = literal.includes(".");
  const tieneComa = literal.includes(",");
  if (tienePunto && tieneComa) {
    // El separador que aparece al final es el decimal; el otro, de miles.
    const decimal = literal.lastIndexOf(".") > literal.lastIndexOf(",") ? "." : ",";
    const miles = decimal === "." ? "," : ".";
    return [Number(literal.split(miles).join("").replace(decimal, "."))];
  }
  const sep = tienePunto ? "." : ",";
  const partes = literal.split(sep);
  if (partes.length > 2) return [Number(partes.join(""))]; // 1,500,000
  const [entera, fraccion] = partes;
  if (fraccion.length === 3 && entera.length <= 3) {
    // "1.500": ¿1.5 o 1500? Se aceptan ambas lecturas.
    return [Number(entera + fraccion), Number(`${entera}.${fraccion}`)];
  }
  return [Number(`${entera}.${fraccion}`)];
}

const UNIDADES: Record<string, number> = {
  cero: 0, uno: 1, un: 1, una: 1, dos: 2, tres: 3, cuatro: 4, cinco: 5,
  seis: 6, siete: 7, ocho: 8, nueve: 9, diez: 10, once: 11, doce: 12,
  trece: 13, catorce: 14, quince: 15, dieciseis: 16, diecisiete: 17,
  dieciocho: 18, diecinueve: 19, veinte: 20, veintiuno: 21, veintiun: 21,
  veintidos: 22, veintitres: 23, veinticuatro: 24, veinticinco: 25,
  veintiseis: 26, veintisiete: 27, veintiocho: 28, veintinueve: 29,
};
const DECENAS: Record<string, number> = {
  treinta: 30, cuarenta: 40, cincuenta: 50, sesenta: 60, setenta: 70,
  ochenta: 80, noventa: 90,
};
const CENTENAS: Record<string, number> = {
  cien: 100, ciento: 100, doscientos: 200, trescientos: 300,
  cuatrocientos: 400, quinientos: 500, seiscientos: 600, setecientos: 700,
  ochocientos: 800, novecientos: 900,
};

/** Números escritos con palabras ("tres millones quinientos mil"). */
function extraerCifrasEnPalabras(texto: string): CifraToken[] {
  const palabras = [...texto.matchAll(/[a-zñ]+/g)].map((m) => ({
    w: m[0], ini: m.index!, fin: m.index! + m[0].length,
  }));
  const out: CifraToken[] = [];
  let i = 0;
  while (i < palabras.length) {
    let j = i;
    let millones = 0, miles = 0, actual = 0, hayNumero = false, hayCompuesto = false;
    while (j < palabras.length) {
      const w = palabras[j].w;
      const siguiente = palabras[j + 1]?.w;
      if (w in UNIDADES) { actual += UNIDADES[w]; hayNumero = true; }
      else if (w in DECENAS) { actual += DECENAS[w]; hayNumero = hayCompuesto = true; }
      else if (w in CENTENAS) { actual += CENTENAS[w]; hayNumero = hayCompuesto = true; }
      else if (w === "y" && hayNumero && siguiente && siguiente in UNIDADES) { j++; continue; }
      // "mil" solo cuenta tras otro número en palabras ("dos mil"): tras dígitos
      // ("50 mil") ya lo resuelve el parser de dígitos y aquí duplicaría la cifra.
      else if (w === "mil" && hayNumero) {
        miles += (actual || 1) * 1000; actual = 0; hayNumero = hayCompuesto = true;
      } else if ((w === "millon" || w === "millones") && hayNumero) {
        millones += (actual + miles || 1) * 1e6; miles = 0; actual = 0; hayCompuesto = true;
      } else break;
      j++;
    }
    const total = millones + miles + actual;
    // Solo cifras "de palabra" que importan: >= 10 y no un simple "un/una".
    if (hayNumero && hayCompuesto && total >= 10) {
      const fin = palabras[j - 1].fin;
      out.push({
        candidatos: [total], factor: 1, raw: texto.slice(palabras[i].ini, fin),
        esPorcentaje: /^\s*por\s+ciento/.test(texto.slice(fin)),
        ini: palabras[i].ini, fin, deLetras: true,
      });
      i = j;
    } else if (hayNumero && total >= 10 && j > i) {
      const fin = palabras[j - 1].fin; // p. ej. "veinte", "quince"
      out.push({
        candidatos: [total], factor: 1, raw: texto.slice(palabras[i].ini, fin),
        esPorcentaje: /^\s*por\s+ciento/.test(texto.slice(fin)),
        ini: palabras[i].ini, fin, deLetras: true,
      });
      i = j;
    } else {
      i = Math.max(j, i + 1);
    }
  }
  return out;
}

function extraerCifras(texto: string): CifraToken[] {
  const tokens: CifraToken[] = [];
  const re = /(?<![a-z\d])(\d{1,3}(?:[.,]\d{3})+(?:[.,]\d+)?|\d+(?:[.,]\d+)?)/g;
  let m: RegExpExecArray | null;
  while ((m = re.exec(texto)) !== null) {
    const literal = m[1];
    let fin = m.index + literal.length;
    let factor = 1;
    let esPorcentaje = false;
    const cola = texto.slice(fin);
    const pct = cola.match(/^\s*%/);
    if (pct) {
      esPorcentaje = true;
      fin += pct[0].length;
    } else {
      const cola2 = cola.replace(/^\s+/, "");
      const desplaza = cola.length - cola2.length;
      for (const [mre, f] of MULTIPLICADORES) {
        const mm = cola2.match(mre);
        if (mm) { factor = f; fin += desplaza + mm[0].length; break; }
      }
      if (factor === 1 && /^k\b/.test(cola)) { factor = 1e3; fin += 1; }
    }
    tokens.push({
      candidatos: candidatosDeLiteral(literal), factor, esPorcentaje,
      raw: texto.slice(m.index, fin), ini: m.index, fin, deLetras: false,
    });
  }
  // Rango con la unidad elíptica: "$1.5 a $2.5 MDP" → la unidad aplica a ambas.
  for (let i = 0; i < tokens.length - 1; i++) {
    const [a, b] = [tokens[i], tokens[i + 1]];
    if (
      a.factor === 1 && !a.esPorcentaje && b.factor !== 1 &&
      /^\s*(?:a|al|hasta|y|-|–|—)\s*\$?\s*$/.test(texto.slice(a.fin, b.ini))
    ) {
      a.factor = b.factor;
    }
  }
  return [...tokens, ...extraerCifrasEnPalabras(texto)].sort((x, y) => x.ini - y.ini);
}

const esAnio = (t: CifraToken) =>
  !t.deLetras && t.factor === 1 && !t.esPorcentaje &&
  t.candidatos.length === 1 && Number.isInteger(t.candidatos[0]) &&
  t.candidatos[0] >= 1900 && t.candidatos[0] <= 2100 && /^\d{4}$/.test(t.raw);

// ==========================================
// CORPUS (lo que el usuario sí dijo)
// ==========================================

interface Corpus {
  atomos: Set<number>;
  anios: Set<number>;
  fechasCompletas: Set<string>;
  fechasMes: Set<string>;
  /** Secuencias de cifras por línea/oración — para sumas, productos y conteos. */
  secuencias: number[][];
  /** Nº de elementos de cada enumeración ("a, b, c y d" → 4). */
  conteosDeListas: Set<number>;
  /** Duraciones relativas dichas por el usuario, en meses ("4 meses", "2 años"). */
  mesesRelativos: number[];
}

function construirCorpus(textos: string[]): Corpus {
  const corpus: Corpus = {
    atomos: new Set(), anios: new Set(), fechasCompletas: new Set(),
    fechasMes: new Set(), secuencias: [], conteosDeListas: new Set(),
    mesesRelativos: [],
  };
  for (const original of textos) {
    const norm = normalizar(original);
    const { fechas, resto } = extraerFechas(norm);
    for (const f of fechas) {
      corpus.anios.add(f.y);
      corpus.fechasMes.add(`${f.y}-${f.m}`);
      if (f.d !== undefined) corpus.fechasCompletas.add(`${f.y}-${f.m}-${f.d}`);
    }
    // Una línea/oración a la vez (para sumas y conteos derivados).
    for (const segmento of resto.split(/[\n.;:]+(?=\s|$)/)) {
      const tokens = extraerCifras(segmento);
      const secuencia: number[] = [];
      for (const t of tokens) {
        if (esAnio(t)) { corpus.anios.add(t.candidatos[0]); continue; }
        for (const c of t.candidatos) {
          corpus.atomos.add(c);
          if (t.factor !== 1) corpus.atomos.add(c * t.factor);
        }
        secuencia.push(t.candidatos[0] * t.factor);
        const despues = segmento.slice(t.fin).match(/^\s*(meses|mes|anos|ano|semanas|semana)\b/);
        if (despues) {
          const n = t.candidatos[0];
          corpus.mesesRelativos.push(
            despues[1].startsWith("mes") ? n : despues[1].startsWith("an") ? n * 12 : Math.round(n / 4.345)
          );
        }
      }
      if (secuencia.length >= 2) corpus.secuencias.push(secuencia);
      const items = segmento.split(/[,;]|\s+y\s+|\s+e\s+/).map((s) => s.trim()).filter(Boolean);
      if (items.length >= 3) corpus.conteosDeListas.add(items.length);
      // Enumeración de cifras seguidas ("Distritos 8, 9, 11, 13 y 14" → 5).
      const corridas = segmento.match(/\d+(?:\s*(?:,|y|e)\s*\d+)+/g) ?? [];
      for (const c of corridas) corpus.conteosDeListas.add((c.match(/\d+/g) ?? []).length);
    }
  }
  return corpus;
}

const casiIgual = (a: number, b: number) => Math.abs(a - b) <= Math.max(1e-9, Math.abs(b) * 1e-9);

/** ¿La cifra es suma/producto/conteo derivado de lo que el usuario dio? */
function esDerivada(valor: number, corpus: Corpus): boolean {
  for (const seq of corpus.secuencias) {
    const n = Math.min(seq.length, 14);
    for (let i = 0; i < n; i++) {
      let suma = 0;
      for (let j = i; j < n; j++) {
        suma += seq[j];
        if (j > i && casiIgual(suma, valor)) return true;
      }
      if (i + 1 < n && casiIgual(seq[i] * seq[i + 1], valor)) return true;
    }
  }
  return Number.isInteger(valor) && valor <= 30 && corpus.conteosDeListas.has(valor);
}

// ==========================================
// VERIFICACIÓN
// ==========================================

function mesesEntre(ahora: Date, y: number, m: number): number {
  return (y - ahora.getUTCFullYear()) * 12 + (m - (ahora.getUTCMonth() + 1));
}

/** Detalle de las partes de un valor sin respaldo, para mostrar al usuario. */
function atomosSinRespaldo(texto: string, corpus: Corpus, ahora: Date): string[] {
  const sinRespaldo: string[] = [];
  const norm = normalizar(texto);
  const { fechas, resto } = extraerFechas(norm);
  const hoy = { y: ahora.getUTCFullYear(), m: ahora.getUTCMonth() + 1, d: ahora.getUTCDate() };

  for (const f of fechas) {
    if (f.d !== undefined) {
      const ok =
        corpus.fechasCompletas.has(`${f.y}-${f.m}-${f.d}`) ||
        (f.y === hoy.y && f.m === hoy.m && f.d === hoy.d);
      if (!ok) sinRespaldo.push(f.raw);
    } else {
      const ok =
        corpus.fechasMes.has(`${f.y}-${f.m}`) ||
        (f.y === hoy.y && f.m === hoy.m) ||
        corpus.mesesRelativos.some((r) => Math.abs(mesesEntre(ahora, f.y, f.m) - r) <= 1);
      if (!ok) sinRespaldo.push(f.raw);
    }
  }

  for (const t of extraerCifras(resto)) {
    if (esAnio(t)) {
      const y = t.candidatos[0];
      const ok =
        corpus.anios.has(y) || y === hoy.y ||
        corpus.mesesRelativos.some((r) => Math.abs(mesesEntre(ahora, y, 6) - r) <= 7);
      if (!ok) sinRespaldo.push(t.raw);
      continue;
    }
    // Sin factor escrito: cualquiera de las lecturas del literal. Con factor
    // ("MDP", "millones"): SOLO el valor multiplicado — así "$1,500,000 MDP"
    // (error de unidad ×10⁶) no se valida contra "1.5 MDP".
    const candidatos = t.factor === 1 ? t.candidatos : t.candidatos.map((c) => c * t.factor);
    if (!t.esPorcentaje && candidatos.every((c) => Number.isInteger(c) && c >= 0 && c < 10)) continue;
    const ok = candidatos.some((c) => corpus.atomos.has(c) || esDerivada(c, corpus));
    if (!ok) sinRespaldo.push(t.raw.trim());
  }
  return sinRespaldo;
}

function recolectarTextos(valor: unknown, out: string[] = []): string[] {
  if (typeof valor === "string") out.push(valor);
  else if (typeof valor === "number") out.push(String(valor));
  else if (Array.isArray(valor)) valor.forEach((v) => recolectarTextos(v, out));
  else if (valor && typeof valor === "object") Object.values(valor).forEach((v) => recolectarTextos(v, out));
  return out;
}

/** Confirmaciones cortas del usuario a una propuesta del asistente ("sí, esa es"). */
const RE_CONFIRMACION =
  /^(?:si|correcto|exacto|asi es|efectivamente|confirmo|de acuerdo|esta bien|ok|perfecto|ese es|esa es|esos son|esas son|claro)\b/;

export function esConfirmacion(mensaje: string): boolean {
  const n = normalizar(mensaje).trim();
  return n.length <= 120 && RE_CONFIRMACION.test(n);
}

export interface FuentesGrounding {
  /** Mensajes previos del usuario en la misma fase (del historial PERSISTIDO en el servidor). */
  mensajesUsuarioPrevios: string[];
  mensajeActual: string;
  /** Texto extraído de los adjuntos del turno actual. */
  textoAdjuntos?: string[];
  /** Contexto que el propio sistema inyectó (XPCTO del servidor, datos de Sefix…). */
  textosContexto?: string[];
  /** Último mensaje del asistente — solo cuenta si el usuario lo CONFIRMA. */
  ultimoMensajeAsistente?: string;
  ahora?: Date;
}

export interface ValorRechazado {
  clave: string;
  /** Fragmentos (cifras/fechas) sin respaldo en lo que el usuario dijo. */
  sinRespaldo: string[];
}

export interface ResultadoGrounding {
  aceptados: Record<string, unknown>;
  rechazados: ValorRechazado[];
}

export function filtrarExtraccionSinRespaldo(
  extraido: Record<string, unknown>,
  fuentes: FuentesGrounding
): ResultadoGrounding {
  const ahora = fuentes.ahora ?? new Date();
  const textos = [
    ...fuentes.mensajesUsuarioPrevios,
    fuentes.mensajeActual,
    ...(fuentes.textoAdjuntos ?? []),
    ...(fuentes.textosContexto ?? []),
  ];
  if (fuentes.ultimoMensajeAsistente && esConfirmacion(fuentes.mensajeActual)) {
    // Sin el JSON del propio asistente: no puede autorizarse a sí mismo.
    textos.push(fuentes.ultimoMensajeAsistente.replace(/```json[\s\S]*?```/g, " "));
  }
  const corpus = construirCorpus(textos);

  const aceptados: Record<string, unknown> = {};
  const rechazados: ValorRechazado[] = [];

  for (const [clave, valor] of Object.entries(extraido)) {
    const verificable = PREFIJOS_VERIFICADOS.some((p) => clave.startsWith(p));
    if (!verificable || clave === CLAVE_DURACION) {
      aceptados[clave] = valor;
      continue;
    }
    const sinRespaldo = recolectarTextos(valor).flatMap((t) => atomosSinRespaldo(t, corpus, ahora));
    if (sinRespaldo.length > 0) rechazados.push({ clave, sinRespaldo });
    else aceptados[clave] = valor;
  }

  // La duración se deriva de la fecha límite: si esta se descartó, se descarta también.
  if (rechazados.some((r) => r.clave === CLAVE_FECHA_LIMITE) && CLAVE_DURACION in aceptados) {
    delete aceptados[CLAVE_DURACION];
  }
  return { aceptados, rechazados };
}

// ==========================================
// AVISO AL USUARIO
// ==========================================

const ETIQUETAS: Record<string, string> = {
  "xpcto.hito": "Hito",
  "xpcto.sujeto": "Sujeto",
  "xpcto.capacidades.financiero": "Capacidades (financiero)",
  "xpcto.capacidades.humano": "Capacidades (humano)",
  "xpcto.capacidades.logistico": "Capacidades (logístico)",
  "xpcto.tiempo.fechaLimite": "Fecha límite",
  "xpcto.tiempo.fechaInicio": "Fecha de inicio",
  "xpcto.tiempo.hitos": "Hitos intermedios",
  "xpcto.justificacion": "Justificación",
};

/**
 * Aviso en lenguaje llano para el usuario: sin él, el modelo habría dicho que
 * registró un dato que nunca se guardó (la misma clase de falla que se evita
 * en Fontana con AFIRMA_RESULTADO).
 */
export function construirAvisoRechazo(rechazados: ValorRechazado[]): string {
  const partes = rechazados.map((r) => {
    const etiqueta = ETIQUETAS[r.clave] ?? r.clave.split(".").slice(1).join(" › ") ?? r.clave;
    return `«${etiqueta}» (${[...new Set(r.sinRespaldo)].join(", ")})`;
  });
  return (
    "\n\n_Nota del sistema: no registré " + partes.join("; ") +
    " porque incluye datos que no aparecen en lo que me has compartido. " +
    "Si son correctos, confírmamelos con tus palabras y los registro._"
  );
}

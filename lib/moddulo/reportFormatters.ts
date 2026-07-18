// lib/moddulo/reportFormatters.ts
// Formateadores markdown determinísticos para los documentos descargables de
// cada fase — no llaman a Claude ni a ningún endpoint: transforman datos ya
// generados/aprobados en pantalla. Cada uno es defensivo por diseño: nunca
// asume que los campos vienen completos (un proyecto puede estar a medio
// camino) — secciones/dimensiones faltantes se marcan explícitamente en vez
// de fallar o imprimirse vacías en silencio.

import type {
  ChatMessage,
  XPCTO,
  DVSF2,
  MapaPESTEL,
} from "@/types/moddulo.types";

// ─────────────────────────────────────────────────────────────
// F1 — Historial del chat
// ─────────────────────────────────────────────────────────────

export function formatChatHistory(messages: ChatMessage[], phaseLabel: string): string {
  if (messages.length === 0) return "";
  const body = messages
    .map((m) => `**${m.role === "assistant" ? "Moddulo" : "Consultor"}**\n\n${m.content}`)
    .join("\n\n---\n\n");
  return `# Historial del chat — ${phaseLabel}\n\n${body}\n`;
}

// ─────────────────────────────────────────────────────────────
// F1 — Formulario XPCTO (5 variables crudas, sin Dictamen)
// ─────────────────────────────────────────────────────────────

export function formatXpctoForm(xpcto: XPCTO): string {
  const lines = [
    "# Formulario XPCTO",
    "",
    "## X — Hito",
    xpcto.hito || "_(sin definir)_",
    "",
    "## P — Sujeto",
    xpcto.sujeto || "_(sin definir)_",
    "",
    "## C — Capacidades",
    `- **Financiero:** ${xpcto.capacidades?.financiero || "_(sin definir)_"}`,
    `- **Humano:** ${xpcto.capacidades?.humano || "_(sin definir)_"}`,
    `- **Logístico:** ${xpcto.capacidades?.logistico || "_(sin definir)_"}`,
    "",
    "## T — Tiempo",
    `- **Fecha límite:** ${xpcto.tiempo?.fechaLimite || "_(sin definir)_"}`,
    `- **Duración:** ${xpcto.tiempo?.duracionMeses != null ? `${xpcto.tiempo.duracionMeses} meses` : "_(sin definir)_"}`,
    "",
    "## O — Justificación",
    xpcto.justificacion || "_(sin definir)_",
  ];
  return lines.join("\n") + "\n";
}

// ─────────────────────────────────────────────────────────────
// F2 — Reporte Exploratorio (desde DVSF2)
// ─────────────────────────────────────────────────────────────

const CONTRASTE_DIM_LABEL: Record<string, string> = {
  X: "Hito", P: "Sujeto", C: "Capacidades", T: "Tiempo", O: "Justificación",
};
const VEREDICTO_LABEL: Record<string, string> = {
  coherente: "Coherente",
  requiere_ajuste: "Requiere ajuste",
  requiere_investigacion: "Requiere investigación",
};
const NIVEL_RIESGO_LABEL: Record<string, string> = { rojo: "🔴 Rojo", ambar: "🟡 Ámbar", verde: "🟢 Verde" };
const URGENCIA_LABEL: Record<string, string> = { alta: "Alta", media: "Media", baja: "Baja" };

export function formatF2Report(dvs: DVSF2): string {
  const sections: string[] = ["# Reporte F2 — Exploración", ""];

  // HEI
  const hei = dvs.hei;
  const heiHasContent = !!(hei?.tensionCentral || hei?.contexto || hei?.premisaEstrategica);
  sections.push("## Hipótesis Estratégica Inicial");
  if (heiHasContent) {
    if (hei.contexto) sections.push(`**Contexto:** ${hei.contexto}`, "");
    if (hei.tensionCentral) sections.push(`**Tensión central:** ${hei.tensionCentral}`, "");
    if (hei.condicionesFavorables?.length) {
      sections.push("**Condiciones favorables:**", ...hei.condicionesFavorables.map((c) => `- ${c}`), "");
    }
    if (hei.condicionesAdversas?.length) {
      sections.push("**Condiciones adversas:**", ...hei.condicionesAdversas.map((c) => `- ${c}`), "");
    }
    if (hei.premisaEstrategica) sections.push(`**Premisa estratégica:** ${hei.premisaEstrategica}`, "");
  } else {
    sections.push("_(Sección pendiente — motor M5 no generado aún)_", "");
  }

  // M2 — Contraste XPCTO
  sections.push("## Contraste XPCTO-Entorno");
  if (dvs.contrasteXPCTO?.length) {
    for (const c of dvs.contrasteXPCTO) {
      sections.push(`### ${CONTRASTE_DIM_LABEL[c.dimension] ?? c.dimension} — ${VEREDICTO_LABEL[c.veredicto] ?? c.veredicto}`);
      if (c.argumentacion) sections.push(c.argumentacion);
      if (c.senalesPESTEL?.length) sections.push("", ...c.senalesPESTEL.map((s) => `- ${s}`));
      sections.push("");
    }
  } else {
    sections.push("_(Sección pendiente — motor M2 no generado aún)_", "");
  }

  // M3 — Semáforo de Veto
  sections.push("## Semáforo de Riesgo de Veto");
  if (dvs.semaforo?.length) {
    for (const a of dvs.semaforo) {
      sections.push(`- **${a.nombre}** (${a.tipo}) — ${NIVEL_RIESGO_LABEL[a.nivelRiesgo] ?? a.nivelRiesgo}${a.requiereInvestigacion ? " · requiere investigación" : ""}`);
      if (a.motivacion) sections.push(`  ${a.motivacion}`);
    }
    sections.push("");
  } else {
    sections.push("_(Sección pendiente — motor M3 no generado aún)_", "");
  }

  // M4 — Incertidumbres
  sections.push("## Mapa de Incertidumbres Estratégicas");
  if (dvs.incertidumbres?.length) {
    for (const inc of dvs.incertidumbres) {
      sections.push(`- ${inc.descripcion} _(urgencia: ${URGENCIA_LABEL[inc.urgencia] ?? inc.urgencia}, resolución: ${URGENCIA_LABEL[inc.resolucion] ?? inc.resolucion}, destino: ${inc.destino})_`);
    }
    sections.push("");
  } else {
    sections.push("_(Sección pendiente — motor M4 no generado aún)_", "");
  }

  // M5 — PIP
  sections.push("## Programa de Investigación Profunda (PIP)");
  if (dvs.pip?.length) {
    const ordered = [...dvs.pip].sort((a, b) => a.orden - b.orden);
    for (const item of ordered) {
      sections.push(`${item.orden}. **${item.pregunta}**`);
      sections.push(`   - Método: ${item.metodo} · Profundidad: ${item.profundidad}`);
      sections.push(`   - Vínculo con el hito: ${item.vinculoHito}`);
    }
    sections.push("");
  } else {
    sections.push("_(Sección pendiente — motor M5 no generado aún)_", "");
  }

  return sections.join("\n") + "\n";
}

// ─────────────────────────────────────────────────────────────
// F2 — Análisis PESTEL (desde MapaPESTEL)
// ─────────────────────────────────────────────────────────────

const PESTEL_DIM_ORDER = ["P", "E", "S", "T", "Ec", "L"];
const PESTEL_DIM_FALLBACK_LABEL: Record<string, string> = {
  P: "Político", E: "Económico", S: "Social", T: "Tecnológico", Ec: "Ecológico", L: "Legal",
};

function formatSenales(label: string, senales: { descripcion: string; fuente: string; fechaCorte: string }[] | undefined): string[] {
  if (!senales || senales.length === 0) return [];
  const out = [`**${label}:**`];
  for (const s of senales) {
    const meta = [s.fuente, s.fechaCorte].filter(Boolean).join(", ");
    out.push(`- ${s.descripcion}${meta ? ` _(Fuente: ${meta})_` : ""}`);
  }
  out.push("");
  return out;
}

export function formatPestelAnalysis(mapaPESTEL: MapaPESTEL): string {
  const sections: string[] = ["# Análisis PESTEL", ""];
  const missing: string[] = [];

  for (const code of PESTEL_DIM_ORDER) {
    const dim = mapaPESTEL[code];
    if (!dim) {
      missing.push(PESTEL_DIM_FALLBACK_LABEL[code] ?? code);
      continue;
    }
    sections.push(`## ${dim.label || PESTEL_DIM_FALLBACK_LABEL[code] || code} — ${dim.clasificacion}`);
    if (dim.narrativa) sections.push(dim.narrativa, "");
    sections.push(...formatSenales("Señales favorables", dim.senalesFavorables));
    sections.push(...formatSenales("Señales adversas", dim.senalesAdversas));
    sections.push(...formatSenales("Señales inciertas", dim.senalesInciertas));
  }

  if (missing.length > 0) {
    sections.push("---", "", `_(Dimensiones no generadas aún: ${missing.join(", ")})_`, "");
  }

  return sections.join("\n") + "\n";
}

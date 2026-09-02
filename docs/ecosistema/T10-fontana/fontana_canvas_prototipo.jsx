import React, { useState, useRef, useEffect } from "react";
import {
  ChevronLeft, ChevronDown, Menu, Bell, X, Plus, MessageCircle, Send,
  Info, Sparkles, Paperclip, Terminal, LayoutGrid, BarChart3, Table2,
  FileText, Lock,
} from "lucide-react";

/* ────────────────────────────────────────────────────────────
   NOTA DE ALCANCE DE ESTE PROTOTIPO (léase antes de revisar)
   ────────────────────────────────────────────────────────────
   1. Reutiliza el sistema de diseño y el patrón de agente ya
      aprobados en el prototipo anterior de Fontana (tokens de
      color, sidebar desktop / bottom sheet mobile, burbuja
      persistente, composer tipo Moddulo).
   2. Asume acordeón de UNA familia abierta a la vez (patrón
      acordeón clásico). Si se prefiere que varias familias
      puedan estar expandidas simultáneamente, es un cambio de
      una línea — se marca en el código con AC-1.
   3. No se incluye el ícono de "folder" mencionado (posición del
      ícono de Fontana "por arriba del folder") porque ese
      elemento no está definido todavía en este chat — la burbuja
      se deja en la esquina inferior derecha, lista para
      reposicionarse en cuanto definamos ese elemento vecino.
   4. Los indicadores y valores son el mismo catálogo mock usado
      en el prototipo anterior — no se reconstruyen desde cero.
   ──────────────────────────────────────────────────────────── */

const C = {
  blue: "#248cc1",
  orange: "#db6015",
  bluegreen: "#026988",
  white: "#f7fafb",
  gray: "#cccccc",
  black: "#2b2b2b",
  yellow: "#ffd14a",
  green: "#649941",
  red: "#d10f3f",
  bandDark: "#04333f",
};

const SIDEBAR_WIDTH = 400;

const PROYECTO = {
  nombre: "Teresa Estrada (PAN)",
  territorio: "Puerto Vallarta, Jalisco",
  ruta: "Jalisco › Distrito Electoral Federal V › Puerto Vallarta",
};

const NATURALEZA_META = {
  dato_directo: { label: "Dato directo", color: C.green, text: "#fff" },
  calculo_directo: { label: "Cálculo directo", color: C.blue, text: "#fff" },
  estimacion_modelada: { label: "Estimación modelada", color: C.yellow, text: C.black },
  estimacion_agregada: { label: "Estimación agregada", color: C.orange, text: "#fff" },
  proxy_conceptual: { label: "Proxy conceptual", color: C.gray, text: C.black },
};

const FAMILIES = [
  { id: "F1", short: "F1", label: "Sociodemográficos", color: C.blue,
    blurb: "Estructura poblacional, edad, lengua indígena y vivienda del territorio." },
  { id: "F2", short: "F2", label: "Socioeconómicos", color: C.bluegreen,
    blurb: "Pobreza, marginación, desigualdad e informalidad laboral." },
  { id: "F3", short: "F3", label: "Geopolíticos", color: C.orange,
    blurb: "Seguridad, participación electoral, gasto federalizado y paz." },
  { id: "F4", short: "F4", label: "Comparación internacional", color: C.green,
    blurb: "México frente a referencias internacionales — sin desagregación subnacional." },
  { id: "F5", short: "F5", label: "Características territoriales", color: C.yellow,
    blurb: "Geografía, clima, tradiciones y actividad económica del territorio." },
];

const LEVELS = ["Nacional", "Estatal", "Distrital", "Municipal"];
const FAMILY_LABEL = Object.fromEntries(FAMILIES.map((f) => [f.id, f.label]));

const INDICATOR_DB = {
  F1: [
    { id: "F1-1", nombre: "Población total (POBTOT)", confiabilidad: "alta",
      descripcion: "Total de habitantes registrados por el Censo de Población y Vivienda para el territorio y nivel geográfico seleccionados.",
      niveles: { Nacional: { v: "129.8M", n: "dato_directo" }, Estatal: { v: "8.4M", n: "dato_directo" }, Distrital: { v: "412,300", n: "dato_directo" }, Municipal: { v: "298,450", n: "dato_directo" } } },
    { id: "F1-3", nombre: "% Población indígena", confiabilidad: "alta",
      descripcion: "Proporción de población que se autoidentifica como indígena o habla alguna lengua originaria, según el Censo 2020.",
      niveles: { Nacional: { v: "19.4%", n: "dato_directo" }, Estatal: { v: "12.1%", n: "dato_directo" }, Distrital: { v: "8.7%", n: "estimacion_agregada" }, Municipal: { v: "7.9%", n: "dato_directo" } } },
    { id: "F1-9", nombre: "Promedio de ocupantes por cuarto", confiabilidad: "alta",
      descripcion: "Número promedio de personas que habitan cada cuarto de la vivienda; funciona como proxy de hacinamiento habitacional.",
      niveles: { Nacional: { v: "0.87", n: "dato_directo" }, Estatal: { v: "0.81", n: "dato_directo" }, Distrital: { v: "0.79", n: "estimacion_agregada" }, Municipal: { v: "0.76", n: "dato_directo" } } },
  ],
  F2: [
    { id: "F2-1", nombre: "Pobreza multidimensional (%)", confiabilidad: "alta",
      descripcion: "Porcentaje de población en pobreza multidimensional, que combina carencias sociales e ingreso insuficiente, según metodología CONEVAL/INEGI-PM.",
      niveles: { Nacional: { v: "36.3%", n: "dato_directo" }, Estatal: { v: "31.8%", n: "dato_directo" }, Distrital: { v: null, motivo: "No calculado a nivel distrital electoral" }, Municipal: { v: "29.4%", n: "dato_directo" } } },
    { id: "F2-2", nombre: "Pobreza extrema (%)", confiabilidad: "alta",
      descripcion: "Porcentaje de población en pobreza extrema: ingreso muy bajo y tres o más carencias sociales simultáneas.",
      niveles: { Nacional: { v: "7.1%", n: "dato_directo" }, Estatal: { v: "5.4%", n: "dato_directo" }, Distrital: { v: null, motivo: "No calculado a nivel distrital electoral" }, Municipal: { v: "4.9%", n: "dato_directo" } } },
    { id: "F2-6", nombre: "Gini (ENIGH, por hogar)", confiabilidad: "media",
      descripcion: "Coeficiente de Gini calculado por hogar a partir de la ENIGH; mide la desigualdad en la distribución del ingreso.",
      niveles: { Nacional: { v: "0.391", n: "dato_directo" }, Estatal: { v: "0.372", n: "estimacion_modelada" }, Distrital: { v: null, motivo: "ENIGH no tiene representatividad distrital" }, Municipal: { v: null, motivo: "ENIGH no tiene representatividad municipal" } } },
  ],
  F3: [
    { id: "F3-1", nombre: "Homicidios dolosos (SESNSP)", confiabilidad: "media",
      descripcion: "Tasa de homicidios dolosos por cada 100 mil habitantes, reportada por el Secretariado Ejecutivo del Sistema Nacional de Seguridad Pública.",
      niveles: { Nacional: { v: "24.7 x100k", n: "dato_directo" }, Estatal: { v: "19.3 x100k", n: "dato_directo" }, Distrital: { v: null, motivo: "SESNSP no desagrega a nivel distrital electoral" }, Municipal: { v: "21.1 x100k", n: "dato_directo" } } },
    { id: "F3-4", nombre: "Percepción de inseguridad (ENSU)", confiabilidad: "media",
      descripcion: "Porcentaje de población que percibe inseguro su municipio o alcaldía, según la Encuesta Nacional de Seguridad Pública Urbana.",
      niveles: { Nacional: { v: "61.2%", n: "estimacion_modelada" }, Estatal: { v: "58.9%", n: "estimacion_modelada" }, Distrital: { v: "56.4%", n: "estimacion_agregada" }, Municipal: { v: "55.1%", n: "estimacion_modelada" } } },
    { id: "F3-16", nombre: "Huelgas y paros laborales (STPS)", confiabilidad: "alta",
      descripcion: "Número de huelgas y paros laborales registrados, reportado por la Secretaría del Trabajo y Previsión Social.",
      niveles: { Nacional: { v: "9", n: "dato_directo" }, Estatal: { v: "3", n: "dato_directo" }, Distrital: { v: null, motivo: "STPS no desagrega a nivel distrital electoral" }, Municipal: { v: null, motivo: "STPS no desagrega a nivel municipal" } } },
  ],
  F5: [
    { id: "F5-1", nombre: "Factores geográficos (Marco Geoestadístico)", confiabilidad: "alta",
      descripcion: "Límites y geometría oficial del territorio según el Marco Geoestadístico Nacional del INEGI.",
      niveles: { Nacional: { v: "Ver mapa", n: "dato_directo" }, Estatal: { v: "Ver mapa", n: "dato_directo" }, Distrital: { v: "Ver mapa", n: "dato_directo" }, Municipal: { v: "Ver mapa", n: "dato_directo" } } },
    { id: "F5-3", nombre: "Clima (CONAGUA, Normales 91-20)", confiabilidad: "alta",
      descripcion: "Condiciones climáticas normales del periodo 1991-2020 reportadas por CONAGUA.",
      niveles: { Nacional: { v: "Ver normales", n: "dato_directo" }, Estatal: { v: "Ver normales", n: "dato_directo" }, Distrital: { v: "Ver normales", n: "estimacion_agregada" }, Municipal: { v: "Ver normales", n: "dato_directo" } } },
  ],
};

const F4_DATA = [
  { id: "F4-1", nombre: "PIB per cápita PPA", mexico: "$22,140 USD", referencia: "OCDE: $47,800 USD", fuente: "FMI / Banco Mundial" },
  { id: "F4-2", nombre: "Gini internacional (per cápita)", mexico: "0.43", referencia: "Distinto del Gini INEGI por hogar (0.391)", fuente: "CEPALSTAT / Banco Mundial", nota: "Metodología distinta — nunca comparar directamente con F2-6." },
  { id: "F4-7", nombre: "CPI — Transparencia Internacional", mexico: "31/100 · Posición 126/180", referencia: "Promedio OCDE: 65/100", fuente: "Transparencia Internacional" },
];

/* ────────────────────────────────────────────────────────────
   UI base
   ──────────────────────────────────────────────────────────── */
function EskemmaLogo() {
  return (
    <div className="flex items-center gap-2 select-none">
      <div className="relative w-6 h-6">
        <div className="absolute inset-0 rotate-45" style={{ background: C.blue, clipPath: "polygon(50% 0,100% 50%,50% 100%,0 50%)" }} />
        <div className="absolute inset-0 rotate-45 translate-x-1" style={{ background: C.orange, clipPath: "polygon(50% 0,100% 50%,50% 100%,0 50%)", opacity: 0.85 }} />
      </div>
      <span className="text-lg font-bold tracking-tight">
        <span style={{ color: C.blue }}>Es</span>
        <span style={{ color: C.black }}>kemma</span>
      </span>
    </div>
  );
}

function NaturalezaTag({ n }) {
  if (!n) return null;
  const meta = NATURALEZA_META[n];
  return (
    <span className="text-[10px] px-1.5 py-0.5 rounded-full font-medium whitespace-nowrap" style={{ background: meta.color, color: meta.text }}>
      {meta.label}
    </span>
  );
}

function ComparativeTable({ indicadores, familyColor }) {
  return (
    <div className="overflow-x-auto rounded-xl border border-gray-200">
      <table className="w-full text-sm min-w-[640px]">
        <thead>
          <tr className="bg-gray-50 text-left text-gray-500 text-xs uppercase tracking-wide">
            <th className="px-3 py-2 font-medium">Indicador</th>
            {LEVELS.map((l) => <th key={l} className="px-3 py-2 font-medium whitespace-nowrap">{l}</th>)}
          </tr>
        </thead>
        <tbody>
          {indicadores.map((ind, idx) => (
            <tr key={ind.id} className={idx % 2 ? "bg-white" : "bg-gray-50/40"}>
              <td className="px-3 py-2.5 min-w-0">
                <div className="flex items-center gap-2 min-w-0">
                  <div className="w-2 h-2 rounded-full shrink-0" style={{ background: familyColor }} />
                  <span className="truncate font-medium text-gray-700">{ind.nombre}</span>
                </div>
              </td>
              {LEVELS.map((l) => {
                const cell = ind.niveles[l];
                return (
                  <td key={l} className="px-3 py-2.5 align-top">
                    {cell.v ? (
                      <div className="flex flex-col gap-1">
                        <span className="text-gray-800 font-medium">{cell.v}</span>
                        <NaturalezaTag n={cell.n} />
                      </div>
                    ) : (
                      <span className="text-[11px] text-gray-400 italic leading-snug block max-w-[160px]">No aplica — {cell.motivo}</span>
                    )}
                  </td>
                );
              })}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function F4Panel() {
  return (
    <div className="space-y-3">
      <div className="flex items-start gap-2 text-xs text-gray-500 bg-gray-50 border border-gray-200 rounded-lg p-3">
        <Info size={14} className="shrink-0 mt-0.5" />
        <p>Familia 4 es la única con perspectiva internacional — sin desagregación subnacional y sin forzar comparaciones entre países.</p>
      </div>
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
        {F4_DATA.map((d) => (
          <div key={d.id} className="rounded-xl border border-gray-200 bg-white p-4">
            <p className="text-sm font-medium text-gray-800 mb-2">{d.nombre}</p>
            <div className="grid grid-cols-2 gap-3 text-sm">
              <div>
                <p className="text-[11px] text-gray-400 uppercase tracking-wide">México</p>
                <p className="font-semibold text-gray-800">{d.mexico}</p>
              </div>
              <div>
                <p className="text-[11px] text-gray-400 uppercase tracking-wide">Referencia</p>
                <p className="font-semibold text-gray-800">{d.referencia}</p>
              </div>
            </div>
            <p className="text-[11px] text-gray-400 mt-2">Fuente: {d.fuente}</p>
            {d.nota && <p className="text-[11px] text-orange-600 mt-1">{d.nota}</p>}
          </div>
        ))}
      </div>
    </div>
  );
}

/* ────────────────────────────────────────────────────────────
   PESTAÑA "INDICADORES" — acordeón horizontal de 5 familias
   ──────────────────────────────────────────────────────────── */
function IndicadoresTab({ expandedFamily, setExpandedFamily }) {
  return (
    <div className="px-4 md:px-8 py-6 space-y-0">
      {/* Fila de encabezados tipo segmented control */}
      <div className="flex flex-wrap gap-2 mb-1">
        {FAMILIES.map((f) => {
          const active = expandedFamily === f.id;
          return (
            <button
              key={f.id}
              onClick={() => setExpandedFamily(active ? null : f.id) /* AC-1: una sola familia abierta a la vez */}
              className="flex items-center gap-2 px-3.5 py-2.5 rounded-xl text-sm font-medium border transition-colors"
              style={active
                ? { background: f.color, color: "#fff", borderColor: f.color }
                : { background: "#fff", color: C.black, borderColor: "#e5e7eb" }}
            >
              <span className="w-5 h-5 rounded-full text-[10px] flex items-center justify-center font-bold shrink-0"
                style={{ background: active ? "rgba(255,255,255,0.25)" : f.color, color: "#fff" }}>
                {f.short}
              </span>
              {f.label}
              <ChevronDown size={14} className="transition-transform" style={{ transform: active ? "rotate(180deg)" : "rotate(0deg)" }} />
            </button>
          );
        })}
      </div>

      {/* Panel expandido de la familia seleccionada */}
      {expandedFamily ? (
        (() => {
          const family = FAMILIES.find((f) => f.id === expandedFamily);
          const items = INDICATOR_DB[family.id] || [];
          return (
            <div className="mt-4 border-t-2 rounded-b-xl bg-white border border-gray-100 p-4 md:p-5" style={{ borderTopColor: family.color }}>
              <div className="flex items-center gap-2 mb-1">
                <h3 className="text-base font-semibold text-gray-800">{family.label}</h3>
                <span className="text-[11px] text-gray-400">{items.length} indicadores en este prototipo</span>
              </div>
              <p className="text-sm text-gray-500 mb-4">{family.blurb}</p>
              {family.id === "F4" ? <F4Panel /> : <ComparativeTable indicadores={items} familyColor={family.color} />}
            </div>
          );
        })()
      ) : (
        <div className="mt-4 text-sm text-gray-400 border border-dashed border-gray-200 rounded-xl p-8 text-center">
          Selecciona una familia para ver su tabla comparativa.
        </div>
      )}
    </div>
  );
}

/* ────────────────────────────────────────────────────────────
   PESTAÑA "FONTANA" (Canvas) — lienzo de salidas del chat
   ──────────────────────────────────────────────────────────── */
function CanvasEmptyState() {
  return (
    <div className="text-center py-16 px-6">
      <div className="w-14 h-14 rounded-2xl mx-auto mb-4 flex items-center justify-center" style={{ background: `linear-gradient(135deg, ${C.blue}, ${C.bluegreen})` }}>
        <Sparkles size={22} className="text-white" />
      </div>
      <p className="text-gray-600 font-medium mb-1">Este es tu Canvas.</p>
      <p className="text-sm text-gray-400 max-w-sm mx-auto">
        Aquí aparecerán las gráficas, tablas y resúmenes que Fontana genere al responder tus preguntas. Prueba preguntando, por ejemplo:
        «¿Cuáles son los indicadores socioeconómicos en mi distrito?» o «Muéstrame una gráfica de percepción de inseguridad».
      </p>
    </div>
  );
}

function CanvasItemCard({ item }) {
  const icon = item.tipo === "grafica" ? BarChart3 : item.tipo === "tabla" ? Table2 : FileText;
  const Icon = icon;
  return (
    <div className="rounded-xl border border-gray-200 bg-white p-4">
      <div className="flex items-center gap-2 mb-3">
        <div className="w-7 h-7 rounded-lg flex items-center justify-center text-white shrink-0" style={{ background: item.color || C.blue }}>
          <Icon size={14} />
        </div>
        <div>
          <p className="text-sm font-semibold text-gray-800 leading-none">{item.titulo}</p>
          <p className="text-[11px] text-gray-400 mt-1">Generado desde el chat · {FAMILY_LABEL[item.familia] || "Fontana"}</p>
        </div>
      </div>

      {item.tipo === "grafica" && (
        <div className="space-y-2">
          {item.barras.map((b) => (
            <div key={b.label} className="flex items-center gap-2">
              <span className="text-xs text-gray-500 w-20 shrink-0">{b.label}</span>
              <div className="flex-1 h-4 rounded-full bg-gray-100 overflow-hidden">
                <div className="h-full rounded-full" style={{ width: `${b.pct}%`, background: item.color || C.blue }} />
              </div>
              <span className="text-xs text-gray-600 w-16 shrink-0 text-right">{b.valor}</span>
            </div>
          ))}
        </div>
      )}

      {item.tipo === "resumen" && (
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
          {item.filas.map((r) => (
            <div key={r.nombre} className="rounded-lg bg-gray-50 border border-gray-100 px-3 py-2">
              <p className="text-[11px] text-gray-400">{r.nombre}</p>
              <div className="flex items-center gap-1.5 mt-0.5">
                <p className="text-sm font-semibold text-gray-800">{r.valor}</p>
                <NaturalezaTag n={r.naturaleza} />
              </div>
            </div>
          ))}
        </div>
      )}

      {item.tipo === "tabla" && <ComparativeTable indicadores={item.indicadores} familyColor={item.color || C.blue} />}
    </div>
  );
}

function CanvasTab({ items }) {
  return (
    <div className="px-4 md:px-8 py-6">
      {items.length === 0 ? <CanvasEmptyState /> : (
        <div className="space-y-4">
          {items.map((item) => <CanvasItemCard key={item.id} item={item} />)}
        </div>
      )}
    </div>
  );
}

/* ────────────────────────────────────────────────────────────
   AGENTE — lógica de tool use simulada, conectada a INDICATOR_DB
   (nunca a una búsqueda externa)
   ──────────────────────────────────────────────────────────── */
function findIndicatorByText(text) {
  const all = Object.entries(INDICATOR_DB).flatMap(([fam, arr]) => arr.map((i) => ({ ...i, fam })));
  const t = text.toLowerCase();
  return all.find((i) => i.nombre.toLowerCase().split(" ").some((w) => w.length > 4 && t.includes(w)));
}

function findFamilyByText(text) {
  const t = text.toLowerCase();
  const map = { f1: "F1", sociodemo: "F1", f2: "F2", socioecon: "F2", f3: "F3", geopolit: "F3", segur: "F3", inseguridad: "F3", f4: "F4", internacional: "F4", f5: "F5", territorial: "F5", clima: "F5" };
  for (const [k, v] of Object.entries(map)) if (t.includes(k)) return v;
  return null;
}

const NATURALEZA_EXPLICACIONES = {
  "estimacion agregada": "Una estimación agregada es un valor que Fontana calcula sumando o promediando datos de un nivel geográfico distinto (normalmente municipal), porque la fuente original no publica el dato directamente en ese nivel.",
  "estimacion modelada": "Una estimación modelada se obtiene de una encuesta o modelo estadístico (por ejemplo ENSU o SEBLUP), no de un registro administrativo directo — por eso lleva la insignia ámbar y no la verde.",
  "dato directo": "Un dato directo viene tal cual de la fuente oficial para ese nivel geográfico específico, sin ningún cálculo intermedio de Fontana.",
};

function generateAgentReply({ text, session }) {
  const t = text.toLowerCase();
  const out = { steps: [], canvasItem: null, switchToCanvas: false, expandFamily: null, switchToIndicadores: false };

  const explKey = Object.keys(NATURALEZA_EXPLICACIONES).find((k) => t.includes(k));
  if (explKey) {
    out.steps.push({ role: "agent", text: NATURALEZA_EXPLICACIONES[explKey] });
    return out;
  }

  if (/(ve a|abre|muestra la familia|navega|ir a).*(indicador|familia|f1|f2|f3|f4|f5)/.test(t)) {
    const fam = findFamilyByText(t);
    if (fam) {
      out.steps.push({ role: "tool_call", text: `navegar_pestana({ pestana: "Indicadores", familiaId: "${fam}" })` });
      out.steps.push({ role: "agent", text: `Abrí la familia ${FAMILY_LABEL[fam]} en la pestaña Indicadores.` });
      out.expandFamily = fam;
      out.switchToIndicadores = true;
      return out;
    }
  }

  // generar_visualizacion: resumen de familia
  if (/(resumen|resúmeme|indicadores de|dame los indicadores)/.test(t)) {
    const fam = findFamilyByText(t) || "F2";
    const items = INDICATOR_DB[fam] || [];
    const family = FAMILIES.find((f) => f.id === fam);
    out.steps.push({ role: "tool_call", text: `generar_visualizacion({ tipo: "resumen", familiaId: "${fam}" })` });
    out.steps.push({ role: "agent", text: `Consulté la base de indicadores de Fontana (familia ${family.label}, ${items.length} indicadores) y agregué el resumen a Canvas — no necesité buscar nada en internet, es el mismo registro que alimenta la tabla comparativa.`, canvas: true });
    out.canvasItem = {
      id: `c-${Date.now()}`, tipo: "resumen", familia: fam, color: family.color,
      titulo: `Resumen — ${family.label} en ${PROYECTO.territorio}`,
      filas: items.map((i) => ({ nombre: i.nombre, valor: i.niveles.Estatal.v ?? "Sin dato", naturaleza: i.niveles.Estatal.n })),
    };
    out.switchToCanvas = true;
    return out;
  }

  // generar_visualizacion: grafica de un indicador especifico por niveles
  if (/(gráfica|grafica|compara|comparativo)/.test(t)) {
    const ind = findIndicatorByText(t) || INDICATOR_DB.F3[1];
    const fam = ind.fam || "F3";
    const family = FAMILIES.find((f) => f.id === fam);
    const vals = LEVELS.map((l) => ind.niveles[l]).filter((c) => c.v);
    const nums = vals.map((c) => parseFloat(String(c.v).replace(/[^0-9.]/g, "")) || 0);
    const max = Math.max(...nums, 1);
    out.steps.push({ role: "tool_call", text: `generar_visualizacion({ tipo: "grafica", indicadorId: "${ind.id}" })` });
    out.steps.push({ role: "agent", text: `Armé la comparación de «${ind.nombre}» por nivel geográfico en Canvas, con los mismos valores de la tabla comparativa.`, canvas: true });
    out.canvasItem = {
      id: `c-${Date.now()}`, tipo: "grafica", familia: fam, color: family.color,
      titulo: ind.nombre,
      barras: LEVELS.map((l, idx) => ind.niveles[l].v ? { label: l, valor: ind.niveles[l].v, pct: Math.max(8, (nums[idx] / max) * 100) } : null).filter(Boolean),
    };
    out.switchToCanvas = true;
    return out;
  }

  // generar_visualizacion: tabla completa de una familia
  if (/(listado|tabla completa|todos los indicadores)/.test(t)) {
    const fam = findFamilyByText(t) || "F1";
    const family = FAMILIES.find((f) => f.id === fam);
    out.steps.push({ role: "tool_call", text: `generar_visualizacion({ tipo: "tabla", familiaId: "${fam}" })` });
    out.steps.push({ role: "agent", text: `Agregué la tabla completa de ${family.label} a Canvas.`, canvas: true });
    out.canvasItem = { id: `c-${Date.now()}`, tipo: "tabla", familia: fam, color: family.color, titulo: `Tabla comparativa — ${family.label}`, indicadores: INDICATOR_DB[fam] || [] };
    out.switchToCanvas = true;
    return out;
  }

  // consultar_indicador — respuesta directa desde el registry, sin generar Canvas
  if (/(cuál es|consulta|muestra el valor|dato de|qué valor tiene)/.test(t)) {
    const ind = findIndicatorByText(t);
    if (ind) {
      out.steps.push({ role: "tool_call", text: `consultar_indicador({ indicadorId: "${ind.id}", nivel: "Estatal" })` });
      const cell = ind.niveles.Estatal;
      out.steps.push({
        role: "result", titulo: ind.nombre, valor: cell.v, nivel: "estatal",
        naturaleza: cell.n ? NATURALEZA_META[cell.n]?.label : null, motivo: cell.motivo, descripcion: ind.descripcion,
      });
      return out;
    }
  }

  out.steps.push({ role: "agent", text: "Puedo consultar un indicador de cualquiera de las 5 familias, armar un resumen o gráfica en Canvas, o llevarte directo a una familia en Indicadores. Prueba: \"¿Cuál es la pobreza extrema?\", \"Resumen de familia 2\" o \"Gráfica de percepción de inseguridad\"." });
  return out;
}

/* ────────────────────────────────────────────────────────────
   MENSAJES Y COMPOSER DEL CHAT (patrón ya aprobado)
   ──────────────────────────────────────────────────────────── */
function ToolCallLine({ text }) {
  return (
    <div className="flex items-start gap-1.5 text-[11px] font-mono text-gray-500 bg-white border border-dashed border-gray-300 rounded-lg px-2.5 py-1.5 max-w-[92%]">
      <Terminal size={12} className="shrink-0 mt-0.5 text-gray-400" />
      <span>{text}</span>
    </div>
  );
}

function ResultCard({ m }) {
  const territorio = PROYECTO.territorio;
  return (
    <div className="max-w-[92%] rounded-2xl px-3.5 py-3 text-sm bg-white border border-gray-200 text-gray-700">
      <p className="font-semibold text-gray-800">{m.titulo}</p>
      {m.valor ? (
        <>
          <p className="mt-1">
            En {territorio}, el valor a nivel {m.nivel} es <strong>{m.valor}</strong>.
            {m.naturaleza && <> Naturaleza del dato: {m.naturaleza}.</>}
          </p>
          {m.descripcion && <p className="text-xs text-gray-400 mt-1.5 leading-snug">{m.descripcion}</p>}
        </>
      ) : (
        <p className="mt-1 text-gray-600">No hay dato disponible a nivel {m.nivel} para {territorio}: {m.motivo}.</p>
      )}
    </div>
  );
}

function ChatBubbleMsg({ m, onVerCanvas }) {
  const isUser = m.role === "user";
  return (
    <div className={`flex ${isUser ? "justify-end" : "justify-start"}`}>
      <div className={`max-w-[85%] rounded-2xl px-3 py-2 text-sm ${isUser ? "text-white" : "bg-white border border-gray-200 text-gray-700"}`} style={isUser ? { background: C.blue } : {}}>
        {m.text}
        {m.canvas && (
          <button onClick={onVerCanvas} className="block mt-1.5 text-xs font-medium underline" style={{ color: C.bluegreen }}>
            Ver en Canvas →
          </button>
        )}
      </div>
    </div>
  );
}

function Composer({ onSend }) {
  const [value, setValue] = useState("");
  const [attachNote, setAttachNote] = useState(false);
  const textareaRef = useRef(null);

  const handleSend = () => {
    if (!value.trim()) return;
    onSend(value);
    setValue("");
    if (textareaRef.current) textareaRef.current.style.height = "auto";
  };

  const handleKeyDown = (e) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  };

  const handleChange = (e) => {
    setValue(e.target.value);
    const el = textareaRef.current;
    if (el) {
      el.style.height = "auto";
      el.style.height = Math.min(el.scrollHeight, 120) + "px";
    }
  };

  const handleAttachClick = () => {
    setAttachNote(true);
    setTimeout(() => setAttachNote(false), 2200);
  };

  return (
    <div className="border-t border-gray-100 bg-white p-3 shrink-0">
      {attachNote && <p className="text-[11px] text-gray-400 mb-1.5 px-1">Adjuntar archivo no está disponible en este prototipo.</p>}
      <div className="flex items-end gap-2 border border-gray-200 rounded-2xl px-2 py-1.5 focus-within:border-gray-300">
        <button onClick={handleAttachClick} className="shrink-0 p-1.5 text-gray-400 hover:text-gray-600 rounded-full" title="Adjuntar archivo">
          <Paperclip size={17} />
        </button>
        <textarea
          ref={textareaRef}
          rows={1}
          value={value}
          onChange={handleChange}
          onKeyDown={handleKeyDown}
          placeholder="Escribe tu pregunta..."
          className="flex-1 text-sm resize-none focus:outline-none py-1.5 max-h-[120px] leading-snug"
        />
        <button onClick={handleSend} disabled={!value.trim()} className="shrink-0 w-8 h-8 rounded-full flex items-center justify-center text-white disabled:opacity-30 transition-opacity" style={{ background: C.blue }} title="Enviar">
          <Send size={14} />
        </button>
      </div>
      <p className="text-[10px] text-gray-300 mt-1 px-1">Enter para enviar · Shift + Enter para salto de línea</p>
    </div>
  );
}

function AgentPanelBody({ messages, onSend, onClose, scrollRef, suggestions, onVerCanvas }) {
  return (
    <div className="flex flex-col h-full">
      <div className="flex items-center justify-between px-4 py-3 text-white shrink-0" style={{ background: `linear-gradient(135deg, ${C.blue}, ${C.bluegreen})` }}>
        <div className="flex items-center gap-2">
          <Sparkles size={16} />
          <div>
            <p className="text-sm font-semibold leading-none">Fontana</p>
            <p className="text-[11px] text-white/70 leading-none mt-1">Asistente de datos abiertos</p>
          </div>
        </div>
        <button onClick={onClose} className="text-white/80 hover:text-white" title="Cerrar"><X size={18} /></button>
      </div>

      <div ref={scrollRef} className="flex-1 overflow-y-auto px-3 py-3 space-y-2 bg-gray-50">
        {messages.map((m, i) => {
          if (m.role === "tool_call") return <ToolCallLine key={i} text={m.text} />;
          if (m.role === "result") return <ResultCard key={i} m={m} />;
          return <ChatBubbleMsg key={i} m={m} onVerCanvas={onVerCanvas} />;
        })}
      </div>

      <div className="px-3 pt-2 flex gap-1.5 flex-wrap shrink-0 bg-white border-t border-gray-100">
        {suggestions.map((s) => (
          <button key={s} onClick={() => onSend(s)} className="text-[11px] px-2.5 py-1 rounded-full border border-gray-200 text-gray-500 hover:border-gray-300 whitespace-nowrap">
            {s}
          </button>
        ))}
      </div>

      <Composer onSend={onSend} />
    </div>
  );
}

const SUGGESTIONS = ["Resumen de los indicadores socioeconómicos", "¿Cuál es la pobreza extrema?", "Listado completo de indicadores sociodemográficos"];

/* ────────────────────────────────────────────────────────────
   APP PRINCIPAL
   ──────────────────────────────────────────────────────────── */
export default function FontanaCanvasPrototipo() {
  const [activeTab, setActiveTab] = useState("fontana"); // "fontana" (Canvas) | "indicadores"
  const [expandedFamily, setExpandedFamily] = useState(null);
  const [canvasItems, setCanvasItems] = useState([]);

  const [agentOpen, setAgentOpen] = useState(false);
  const [isDesktop, setIsDesktop] = useState(true);
  const [messages, setMessages] = useState([
    { role: "agent", text: "Hola, soy Fontana. Puedo consultar indicadores de datos abiertos para tu proyecto político. ¿En qué te ayudo?" },
  ]);
  const scrollRef = useRef(null);
  const containerRef = useRef(null);

  useEffect(() => {
    const el = containerRef.current;
    const check = () => {
      const w = el ? el.getBoundingClientRect().width : window.innerWidth;
      setIsDesktop(w >= 720);
    };
    check();
    window.addEventListener("resize", check);
    return () => window.removeEventListener("resize", check);
  }, []);

  useEffect(() => {
    if (scrollRef.current) scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
  }, [messages, agentOpen]);

  const handleSend = (text) => {
    setMessages((prev) => [...prev, { role: "user", text }]);
    setTimeout(() => {
      const reply = generateAgentReply({ text });
      setMessages((prev) => [...prev, ...reply.steps]);
      if (reply.canvasItem) setCanvasItems((prev) => [reply.canvasItem, ...prev]);
      if (reply.switchToCanvas) setActiveTab("fontana");
      if (reply.switchToIndicadores) setActiveTab("indicadores");
      if (reply.expandFamily) setExpandedFamily(reply.expandFamily);
    }, 300);
  };

  const sidebarOpenDesktop = agentOpen && isDesktop;
  const sidebarOpenMobile = agentOpen && !isDesktop;

  const TabButton = ({ id, label, icon: Icon }) => {
    const active = activeTab === id;
    return (
      <button
        onClick={() => setActiveTab(id)}
        className="flex items-center gap-2 px-4 py-2.5 text-sm font-semibold border-b-2 transition-colors"
        style={active ? { borderColor: C.blue, color: C.black } : { borderColor: "transparent", color: "#9ca3af" }}
      >
        <Icon size={15} /> {label}
      </button>
    );
  };

  return (
    <div ref={containerRef} className="relative w-full" style={{ background: "#f2f4f5", fontFamily: "Arimo, ui-sans-serif, system-ui" }}>
      <div style={{ display: "flex", minHeight: "100vh" }}>
        <div style={{ flex: 1, minWidth: 0, transition: "margin-right .3s ease", marginRight: sidebarOpenDesktop ? SIDEBAR_WIDTH : 0 }}>
          <header className="flex items-center justify-between px-4 md:px-8 py-3 bg-white border-b border-gray-100 sticky top-0 z-20">
            <EskemmaLogo />
            <div className="flex items-center gap-4 text-gray-500">
              <Menu size={20} />
              <div className="w-8 h-8 rounded-full" style={{ background: `linear-gradient(135deg, ${C.orange}, ${C.blue})` }} />
              <Bell size={20} />
            </div>
          </header>

          <div className="relative px-4 md:px-8 py-5 md:py-6 overflow-hidden" style={{ background: `linear-gradient(120deg, ${C.bandDark}, #06424f)` }}>
            <button className="text-white/70 text-sm flex items-center gap-1 mb-3 hover:text-white transition-colors">
              <ChevronLeft size={14} /> Centinela
            </button>
            <h1 className="text-white text-2xl md:text-3xl font-bold">Fontana</h1>
            <p className="text-white/75 text-sm mt-1">{PROYECTO.ruta} · {PROYECTO.nombre}</p>
          </div>

          {/* Pestañas principales: Fontana (Canvas) / Indicadores */}
          <div className="flex gap-1 px-4 md:px-8 bg-white border-b border-gray-100">
            <TabButton id="fontana" label="Fontana" icon={Sparkles} />
            <TabButton id="indicadores" label="Indicadores" icon={LayoutGrid} />
          </div>

          <main className="pb-28">
            {activeTab === "fontana"
              ? <CanvasTab items={canvasItems} />
              : <IndicadoresTab expandedFamily={expandedFamily} setExpandedFamily={setExpandedFamily} />}
          </main>
        </div>

        {sidebarOpenDesktop && (
          <div className="fixed top-0 right-0 bottom-0 bg-white border-l border-gray-200 shadow-xl z-30" style={{ width: SIDEBAR_WIDTH }}>
            <AgentPanelBody messages={messages} onSend={handleSend} onClose={() => setAgentOpen(false)} scrollRef={scrollRef} suggestions={SUGGESTIONS} onVerCanvas={() => setActiveTab("fontana")} />
          </div>
        )}
      </div>

      {sidebarOpenMobile && (
        <div className="fixed inset-x-0 bottom-0 h-[75vh] bg-white rounded-t-2xl shadow-2xl z-30 border-t border-gray-200 overflow-hidden">
          <AgentPanelBody messages={messages} onSend={handleSend} onClose={() => setAgentOpen(false)} scrollRef={scrollRef} suggestions={SUGGESTIONS} onVerCanvas={() => setActiveTab("fontana")} />
        </div>
      )}

      {/* Burbuja de Fontana — persistente, esquina inferior derecha */}
      <button
        onClick={() => setAgentOpen((v) => !v)}
        className="fixed bottom-5 right-5 z-40 w-14 h-14 rounded-full shadow-lg flex items-center justify-center text-white"
        style={{ background: `linear-gradient(135deg, ${C.blue}, ${C.bluegreen})` }}
        title={agentOpen ? "Ocultar chat" : "Mostrar chat"}
      >
        <MessageCircle size={24} />
      </button>
    </div>
  );
}

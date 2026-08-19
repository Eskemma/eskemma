"use client";

// app/centinela/fontana/CoberturaAdvertencia.tsx
// Advertencia de cobertura de datos — sección→distrito federal
// (cartografía 2025 vs. censo 2020). Chip compacto con el texto
// completo solo al hacer clic (reutiliza InfoTooltip — mismo mecanismo
// de posicionamiento fixed + clamp al viewport que ya usan los badges
// de naturaleza, en vez de duplicar esa lógica).
//
// 3 contextos que miden cosas DISTINTAS — nunca comparten texto (cierre
// 2026-08-06, revisado con Raúl uno por uno, nunca aplicado a ciegas):
// - "distrito": el distrito YA se conoce (es el territorio del propio
//   proyecto) y SÍ se muestra un valor — la duda es si ese valor está
//   completo o subestima la población real del distrito (secciones
//   censales 2020 sin vincular a la cartografía electoral vigente).
// - "municipio" (dentro del modal, distrito→municipios): el valor del
//   indicador en sí es confiable (viene de municipios/{estado}.json,
//   gap 0.000%, verificado) — lo que no se puede confirmar es qué
//   fracción de ese municipio pertenece a ESTE distrito específico.
//   Nunca debe leerse como una duda sobre el dato, solo sobre el
//   reparto geográfico. No cita el % de reparto (pctPobtot) porque ese
//   número depende del mismo cruce de cartografías que ya sabemos que
//   falló — mostrarlo daría una falsa sensación de precisión.
// - "municipio_propio" (columnas inversas, proyectos Municipal): el
//   municipio DEL PROYECTO mismo tiene cobertura incompleta — no hay
//   ningún valor que mostrar (a diferencia de "municipio" arriba, que
//   siempre muestra el dato completo del municipio) porque ni siquiera
//   se puede confiar en A QUÉ distrito asignarlo.
//
// Las 3 variantes integran tipoDistrito ("federal"/"local") en su
// propio texto — un proyecto Municipal puede tener ambas columnas
// (Distrito Federal y Distrito Local) visibles a la vez (ej.
// Cuernavaca), así que cada tooltip debe identificarse sin ambigüedad.
//
// border-blue-eske (no yellow-eske): esto NUNCA es la misma categoría
// que "fragmentación real sin distrito dominante" del modal (esa sí usa
// amarillo + ▲) — son 2 problemas distintos y deben leerse distinto de
// un vistazo, no solo por el texto.

import InfoTooltip from "@/app/components/ui/InfoTooltip";

type Props =
  | { nivel: "distrito"; tipoDistrito: "federal" | "local"; coberturaPct: number }
  | { nivel: "municipio"; tipoDistrito: "federal" | "local" }
  | { nivel: "municipio_propio"; tipoDistrito: "federal" | "local"; coberturaPct: number }
  | { nivel: "fuente_mixta" };

// 100 - pct, mismo decimal que pct (ej. 97.9 -> 2.1) — evita el error de
// float directo (100 - 97.9 = 2.099999999999998 en JS).
function complemento(pct: number): number {
  return Math.round((100 - pct) * 10) / 10;
}

const CHIP_CLASS =
  "mt-1.5 inline-flex items-center gap-1 px-1.5 py-1 rounded border border-blue-eske " +
  "text-[10px] text-black-eske-80 dark:text-[#9AAEBE] cursor-pointer";

export default function CoberturaAdvertencia(props: Props) {
  const etiqueta =
    props.nivel === "distrito" ? "Cobertura incompleta" : props.nivel === "fuente_mixta" ? "Nota sobre la fuente" : "Nota sobre cobertura";
  // Un proyecto Municipal puede tener ambas columnas (Federal y Local)
  // visibles a la vez (ej. Cuernavaca) — cada tooltip se identifica sin
  // ambigüedad (cierre 2026-08-06). "fuente_mixta" no tiene distrito
  // asociado (aplica a Nacional/Estatal), no necesita `tipo`.
  const tipo = props.nivel === "fuente_mixta" ? null : props.tipoDistrito;

  const contenido =
    props.nivel === "fuente_mixta" ? (
      <>
        Este valor es de 2024 (INEGI). El desglose por municipio/distrito de este indicador usa datos de 2020
        (CONEVAL) — INEGI todavía no publica pobreza multidimensional a nivel municipal en esta edición. Los 2
        niveles no son directamente comparables entre sí.
      </>
    ) : props.nivel === "distrito" ? (
      <>
        El valor mostrado es la suma de las secciones censales 2020 que sí lograron vincularse a este distrito{" "}
        {tipo}. El <strong>{complemento(props.coberturaPct)}%</strong> restante no pudo asignarse porque la
        cartografía electoral vigente no coincide exactamente con los límites del Censo 2020 en esta zona. Por eso
        esta cifra puede subestimar la población real de este distrito.
      </>
    ) : props.nivel === "municipio" ? (
      <>
        El valor mostrado es el dato completo de este municipio, no una fracción — esta advertencia no pone en duda
        esa cifra. No es posible calcular con precisión qué porción corresponde específicamente a este distrito{" "}
        {tipo}, porque la cartografía electoral vigente no coincide con los límites del Censo 2020 en esta zona. Por
        eso ese reparto no se muestra como un dato confiable.
      </>
    ) : (
      <>
        No se muestra un valor de distrito {tipo} porque no es posible asignar con certeza el{" "}
        <strong>{complemento(props.coberturaPct)}%</strong> de la población de este municipio a un distrito
        específico. La cartografía electoral vigente no coincide exactamente con los límites del Censo 2020 en esta
        zona. Mostrar el dato implicaría afirmar algo que no se puede confirmar con precisión.
      </>
    );

  return (
    <InfoTooltip
      content={contenido}
      trigger={
        <>
          <span aria-hidden="true" className="text-blue-eske text-xs leading-none">▲</span>
          {etiqueta}
        </>
      }
      triggerClassName={CHIP_CLASS}
    />
  );
}

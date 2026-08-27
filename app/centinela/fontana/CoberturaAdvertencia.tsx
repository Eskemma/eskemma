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
  | { nivel: "fuente_mixta" }
  // Familia 4 (F4-1/F4-5) — el FMI está bloqueado a nivel de
  // infraestructura de red (Akamai "Access Denied", verificado
  // 2026-08-21) — solo Banco Mundial disponible. Mismo patrón que
  // "fuente_mixta" (chip + tooltip), condicionado por indicador en
  // FontanaF4Panel.tsx.
  | { nivel: "fmi_no_disponible" }
  // Familia 5, F5-7 (SUN) — el valor mostrado no es exclusivo del
  // municipio: es el de la Ciudad/Zona Metropolitana completa a la que
  // pertenece (SEDATU/CONAPO no publica por municipio individual).
  // `prorrateo` solo aplica en la celda Estatal de las 15 de 218 ZM que
  // cruzan más de un estado (Grupo F, Ronda 11) — cuando está ausente,
  // el valor es el total completo de la ZM sin prorratear.
  | { nivel: "zona_metropolitana"; nombreZona: string; numMunicipios: number; prorrateo?: { pctEstado: number; numEstados: number } }
  // Familia 3, F3-4 (ENSU) — el valor mostrado es del Área Urbana de
  // Interés de la ENSU completa (marco muestral propio de INEGI), NUNCA
  // llamado "Zona Metropolitana" ni atribuido a SEDATU/CONAPO — no se
  // verificó que la definición coincida exactamente en los 24 casos
  // multi-municipio reales (2026-08-27). `prorrateo` solo en las 2 áreas
  // que cruzan estado (La Laguna, Tampico, confirmadas en 2026-T2).
  | { nivel: "area_ensu"; nombreArea: string; numMunicipios: number; prorrateo?: { pctEstado: number; numEstados: number } };

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
    props.nivel === "distrito" ? "Cobertura incompleta"
    : props.nivel === "fuente_mixta" || props.nivel === "fmi_no_disponible" ? "Nota sobre la fuente"
    : props.nivel === "zona_metropolitana" ? "Valor de zona metropolitana"
    : props.nivel === "area_ensu" ? "Valor de área urbana ENSU"
    : "Nota sobre cobertura";
  // Un proyecto Municipal puede tener ambas columnas (Federal y Local)
  // visibles a la vez (ej. Cuernavaca) — cada tooltip se identifica sin
  // ambigüedad (cierre 2026-08-06). "fuente_mixta"/"fmi_no_disponible"/
  // "zona_metropolitana"/"area_ensu" no tienen distrito asociado, no
  // necesitan `tipo`.
  const tipo =
    props.nivel === "fuente_mixta" || props.nivel === "fmi_no_disponible" || props.nivel === "zona_metropolitana" || props.nivel === "area_ensu"
      ? null
      : props.tipoDistrito;

  const contenido =
    props.nivel === "zona_metropolitana" ? (
      <>
        Este valor corresponde a la Zona Metropolitana de <strong>{props.nombreZona}</strong>, que incluye{" "}
        {props.numMunicipios} municipios — no es un dato exclusivo de este municipio.
        {props.prorrateo && (
          <>
            {" "}Esta zona cruza {props.prorrateo.numEstados} estados; el valor mostrado es solo la porción real
            correspondiente a este estado (<strong>{props.prorrateo.pctEstado}%</strong> del total de la zona),
            prorrateada por población de sus localidades.
          </>
        )}
      </>
    ) : props.nivel === "area_ensu" ? (
      <>
        Este valor corresponde al área urbana de interés de la ENSU: <strong>{props.nombreArea}</strong>, que incluye{" "}
        {props.numMunicipios} municipios — no es un dato exclusivo de este municipio.
        {props.prorrateo && (
          <>
            {" "}Esta área cruza {props.prorrateo.numEstados} estados; el valor de población mostrado en el reparto es
            solo la porción correspondiente a este estado (<strong>{props.prorrateo.pctEstado}%</strong> del total del
            área), prorrateada por población de sus municipios.
          </>
        )}
      </>
    ) : props.nivel === "fmi_no_disponible" ? (
      <>
        Solo Banco Mundial disponible — el FMI, fuente secundaria de este indicador, está bloqueado a nivel de
        infraestructura de red desde el 26-08-21. Se pierde la comparación entre ambas fuentes y la distinción entre
        datos históricos y proyecciones.
      </>
    ) : props.nivel === "fuente_mixta" ? (
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

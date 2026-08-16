"use client";

// app/centinela/fontana/FontanaComparativeTable.tsx
// Tabla comparativa por nivel geográfico — columnas dinámicas según el
// tipo de proyecto (Documentación Técnica §5.2). Mínimos con candado (sin
// control de quitar), selección libre removible, cada celda con
// naturaleza del dato + fuente o motivo explícito si no hay valor.
// Mobile-first: lista de tarjetas apiladas en mobile, tabla en pantallas
// medianas o mayores (ambas leen los mismos datos).
//
// Confiabilidad: no es un elemento nuevo — el borde del badge de
// naturaleza (que ya existía) deja de estar fijo a un color y pasa a
// reflejar alta/media/baja, derivada de esa misma naturaleza. Paleta con
// variante distinta por modo claro/oscuro (no solo un tono más oscuro),
// mismo criterio ya verificado en PESTLPanelV2.tsx (nivelConfianza).

import { useState } from "react";
import InfoTooltip from "@/app/components/ui/InfoTooltip";
import type { CeldaTablaFontana, NivelTablaFontana } from "@/lib/fontana/tablaColumnas";
import { NOMBRE_NIVEL_TABLA } from "@/lib/fontana/tablaColumnas";
import NaturalezaBadge from "./NaturalezaBadge";
import CoberturaAdvertencia from "./CoberturaAdvertencia";
import FontanaMunicipiosModal, { type TipoElementoNacional, type TipoDistrito, type ElementoAgregacionPluralUI } from "./FontanaMunicipiosModal";
import type { NivelTerritorial } from "@/types/shared.types";

// Fase 3 del rediseño de territorio (26-08-17) — "Ver X" según el nivel
// REAL del territorio del proyecto (no de la celda, que puede ser
// estatal/municipal/distrital según el caso) — mismo criterio ya usado
// para los demás botones de desglose de este archivo.
const ETIQUETA_VER_AGREGACION_PLURAL: Record<NivelTerritorial, string> = {
  nacional: "Ver valores",
  estatal: "Ver valores estatales",
  municipal: "Ver valores municipales",
  distrito: "Ver valores distritales",
  distrito_federal: "Ver valores distritales",
  distrito_local: "Ver valores distritales",
};

const UMBRAL_COBERTURA = 99;

const ETIQUETA_BOTON_DESGLOSE: Record<TipoElementoNacional, string> = {
  estados: "Ver estados",
  municipios: "Ver municipios",
  distritos_fed: "Ver distritos federales",
  distritos_loc: "Ver distritos locales",
};

const TIPO_ELEMENTO_A_TIPO_DISTRITO: Record<"distritos_fed" | "distritos_loc", TipoDistrito> = {
  distritos_fed: "federal",
  distritos_loc: "local",
};

interface ModalConfig {
  indicadorId: string;
  scope: "distrito" | "estado" | "municipio" | "nacional" | "seleccion";
  tipoElemento?: TipoElementoNacional;
  tipoDistrito?: TipoDistrito;
  // Solo scope="seleccion" (Fase 3, 26-08-17) — el desglose ya viene
  // RESUELTO desde el backend (resolverAgregacionPlural), a diferencia
  // de los demás scopes, que hacen su propio fetch al abrir el modal.
  desglosePorUnidad?: ElementoAgregacionPluralUI[];
}

export interface IndicadorFilaFontana {
  id: string;
  nombre: string;
  definicion?: string;
  fuenteEtiqueta?: string;
  esMinimo: boolean;
  celdas: CeldaTablaFontana[];
}

interface Props {
  sesionId: string;
  columnas: NivelTablaFontana[];
  indicadores: IndicadorFilaFontana[];
  onQuitar: (indicadorId: string) => void;
  quitando?: string | null;
  // Nivel del territorio del proyecto — necesario porque las celdas
  // "distrital_federal"/"distrital_local" tienen la MISMA forma
  // (motivo + desglosesEstado) tanto en proyectos Municipal (columnas
  // inversas, "sin dominante") como en proyectos Nacional — no se puede
  // distinguir por el contenido de la celda, hace falta el contexto
  // del proyecto (cierre 2026-08-06).
  territorioNivel: NivelTerritorial;
}

function BotonesDesgloseEstado({
  celda,
  onAbrir,
}: {
  celda: CeldaTablaFontana;
  onAbrir: (tipoElemento: TipoElementoNacional) => void;
}) {
  if (!celda.desglosesEstado || celda.desglosesEstado.length === 0) return null;
  return (
    <>
      {celda.desglosesEstado.map((d) => (
        <button
          key={d.tipo}
          type="button"
          onClick={() => onAbrir(d.tipo)}
          className="block text-[11px] text-bluegreen-eske dark:text-blue-eske-20 hover:underline"
        >
          {ETIQUETA_BOTON_DESGLOSE[d.tipo]} ({d.total})
        </button>
      ))}
    </>
  );
}

// Fase 3 del rediseño de territorio (26-08-17) — bloque de valor
// combinado + botón de desglose, agnóstico de si `celda.valor` existe o
// no (aditivo/tasa_ponderada muestran un valor combinado; no_agregable
// muestra solo el desglose, sin valor combinado — aprobado por Raúl).
function BloqueAgregacionPlural({
  agregacionPlural,
  onVer,
}: {
  agregacionPlural: NonNullable<CeldaTablaFontana["agregacionPlural"]>;
  onVer: () => void;
}) {
  const { valorAgregado, desglosePorUnidad } = agregacionPlural;
  const tieneValor = valorAgregado && "valor" in valorAgregado;
  return (
    <div className="mt-1.5 pt-1.5 border-t border-dashed border-gray-eske-30 dark:border-white/10">
      <p className="text-[10px] uppercase tracking-wide text-bluegreen-eske dark:text-blue-eske-20">
        Combinado ({desglosePorUnidad.length} unidades)
      </p>
      {tieneValor ? (
        <p className="text-sm font-semibold text-black-eske dark:text-[#EAF2F8]">
          {valorAgregado.valor.toLocaleString("es-MX")}
          {valorAgregado.unidad ? <span className="ml-1 font-normal text-xs text-black-eske-80 dark:text-[#9AAEBE]">{valorAgregado.unidad}</span> : null}
        </p>
      ) : (
        <p className="text-xs italic text-black-eske-80 dark:text-[#9AAEBE]">
          {valorAgregado?.motivo ?? "Sin valor combinado disponible para este indicador"}
        </p>
      )}
      {desglosePorUnidad.length > 0 && (
        <button
          type="button"
          onClick={onVer}
          className="block text-[11px] text-bluegreen-eske dark:text-blue-eske-20 hover:underline"
        >
          Ver valores por unidad ({desglosePorUnidad.length})
        </button>
      )}
    </div>
  );
}

function Celda({
  celda,
  territorioNivel,
  onVerMunicipios,
  onVerDesgloseEstado,
  onVerDesgloseMunicipio,
  onVerDesgloseNacional,
  onVerAgregacionPlural,
}: {
  celda: CeldaTablaFontana;
  territorioNivel: NivelTerritorial;
  onVerMunicipios?: () => void;
  onVerDesgloseEstado: (tipoElemento: TipoElementoNacional) => void;
  onVerDesgloseMunicipio: (tipoDistrito: TipoDistrito) => void;
  onVerDesgloseNacional: (tipoElemento: TipoElementoNacional) => void;
  onVerAgregacionPlural: () => void;
}) {
  const mostrarBotonMunicipios =
    celda.nivel === "municipal" && (celda.municipiosEnDistrito ?? 0) > 1;
  // Bug real (2026-08-06, encontrado en verificación visual): "estatal"/
  // "municipal"/"distrital_federal"/"distrital_local" tienen la MISMA
  // forma (motivo + desglosesEstado) tanto en proyectos Estatal/Municipal
  // como en proyectos Nacional — el destino del botón de desglose
  // ("estado → sus X" vs. "país → todos sus X") se decide por
  // territorioNivel PRIMERO, nunca por el nivel de la celda ni por su
  // contenido (indistinguibles entre ambos casos). Antes solo se
  // corregía para distrital_federal/local — estatal/municipal quedaban
  // enrutados siempre a scope="estado", causando cve duplicados entre
  // los 32 estados (React "same key" en el modal).
  const esColumnaDistritalInvertida = celda.nivel === "distrital_federal" || celda.nivel === "distrital_local";
  const onAbrirDesglose: (tipo: TipoElementoNacional) => void =
    territorioNivel === "nacional"
      ? onVerDesgloseNacional
      : esColumnaDistritalInvertida && territorioNivel === "municipal"
        ? (tipo) => {
            if (tipo === "distritos_fed" || tipo === "distritos_loc") onVerDesgloseMunicipio(TIPO_ELEMENTO_A_TIPO_DISTRITO[tipo]);
          }
        : onVerDesgloseEstado;

  if (celda.valor !== undefined) {
    return (
      <div className="space-y-1">
        <p className="text-sm font-semibold text-black-eske dark:text-[#EAF2F8]">
          {celda.valor.toLocaleString("es-MX")}
          {celda.unidad ? <span className="ml-1 font-normal text-xs text-black-eske-80 dark:text-[#9AAEBE]">{celda.unidad}</span> : null}
        </p>
        {celda.naturaleza && <NaturalezaBadge naturaleza={celda.naturaleza} />}
        {celda.fuenteEtiqueta && <p className="text-[10px] text-black-eske-80 dark:text-[#9AAEBE]">{celda.fuenteEtiqueta}</p>}
        {celda.nivel === "distrital" && celda.coberturaPct !== undefined && celda.coberturaPct < UMBRAL_COBERTURA && celda.tipoDistritoPropio && (
          <CoberturaAdvertencia nivel="distrito" tipoDistrito={celda.tipoDistritoPropio} coberturaPct={celda.coberturaPct} />
        )}
        {esColumnaDistritalInvertida && celda.municipioEnDistritoPct !== undefined && celda.municipioEnDistritoPct < 99.95 && (
          <p className="text-[10px] italic text-gray-eske-60 dark:text-[#6D8294]">
            {celda.municipioEnDistritoPct}% de este municipio pertenece a este distrito.
          </p>
        )}
        {mostrarBotonMunicipios && (
          <button
            type="button"
            onClick={onVerMunicipios}
            className="block text-[11px] text-bluegreen-eske dark:text-blue-eske-20 hover:underline"
          >
            Ver datos municipales ({celda.municipiosEnDistrito})
          </button>
        )}
        <BotonesDesgloseEstado celda={celda} onAbrir={onAbrirDesglose} />
        {celda.agregacionPlural && (
          <BloqueAgregacionPlural agregacionPlural={celda.agregacionPlural} onVer={onVerAgregacionPlural} />
        )}
      </div>
    );
  }
  return (
    <div className="space-y-1">
      <p className="text-xs text-black-eske-80 dark:text-[#9AAEBE] italic">{celda.motivo}</p>
      {esColumnaDistritalInvertida && celda.municipioCoberturaPct !== undefined && (
        <CoberturaAdvertencia
          nivel="municipio_propio"
          tipoDistrito={celda.nivel === "distrital_federal" ? "federal" : "local"}
          coberturaPct={celda.municipioCoberturaPct}
        />
      )}
      {mostrarBotonMunicipios && (
        <button
          type="button"
          onClick={onVerMunicipios}
          className="block text-[11px] text-bluegreen-eske dark:text-blue-eske-20 hover:underline"
        >
          Ver datos municipales ({celda.municipiosEnDistrito})
        </button>
      )}
      <BotonesDesgloseEstado celda={celda} onAbrir={onAbrirDesglose} />
      {celda.agregacionPlural && (
        <BloqueAgregacionPlural agregacionPlural={celda.agregacionPlural} onVer={onVerAgregacionPlural} />
      )}
    </div>
  );
}

export default function FontanaComparativeTable({ sesionId, columnas, indicadores, onQuitar, quitando, territorioNivel }: Props) {
  // Configuración del modal de desglose abierto — un modal a la vez,
  // cada apertura es independiente (fetch propio, nunca comparte estado
  // entre indicadores). scope="distrito" (Ver datos municipales) o
  // scope="estado" (Ver municipios/distritos del estado, Encargo 2).
  const [modalConfig, setModalConfig] = useState<ModalConfig | null>(null);
  const indicadorModal = indicadores.find((i) => i.id === modalConfig?.indicadorId);
  if (indicadores.length === 0) {
    return (
      <div className="p-4 rounded-lg border border-gray-eske-20 dark:border-white/10 bg-gray-eske-10/40 dark:bg-[#112230] text-center">
        <p className="text-xs lg:text-sm text-black-eske-80 dark:text-[#9AAEBE]">
          Aún no hay indicadores en esta sesión. Usa &quot;Añadir indicador&quot; para empezar a explorar.
        </p>
      </div>
    );
  }

  return (
    <>
      {/* Mobile — tarjetas apiladas */}
      <div className="md:hidden space-y-3">
        {indicadores.map((ind) => (
          <div key={ind.id} className="rounded-lg border border-gray-eske-20 dark:border-white/10 p-3 bg-white-eske dark:bg-[#18324A]">
            <div className="flex items-start justify-between gap-2">
              <div className="flex items-center gap-1.5 min-w-0">
                {ind.esMinimo && (
                  <span aria-label="Indicador mínimo del PIP" title="Indicador mínimo del PIP">
                    <LockIcon />
                  </span>
                )}
                <p className="text-sm font-semibold text-black-eske dark:text-[#EAF2F8] truncate">{ind.nombre}</p>
                {ind.definicion && (
                  <InfoTooltip content={ind.definicion ?? ""} fuente={ind.fuenteEtiqueta} />
                )}
              </div>
              {!ind.esMinimo && (
                <button
                  type="button"
                  onClick={() => onQuitar(ind.id)}
                  disabled={quitando === ind.id}
                  className="text-xs text-red-eske hover:underline shrink-0 disabled:opacity-50"
                >
                  Quitar
                </button>
              )}
            </div>
            <div className="mt-2 grid grid-cols-2 gap-3">
              {columnas.map((nivel) => {
                const celda = ind.celdas.find((c) => c.nivel === nivel);
                if (!celda) return null;
                return (
                  <div key={nivel}>
                    <p className="text-[10px] uppercase tracking-wide text-black-eske-80 dark:text-[#9AAEBE] mb-1">
                      {NOMBRE_NIVEL_TABLA[nivel]}
                    </p>
                    <Celda
                      celda={celda}
                      territorioNivel={territorioNivel}
                      onVerMunicipios={() => setModalConfig({ indicadorId: ind.id, scope: "distrito" })}
                      onVerDesgloseEstado={(tipoElemento) => setModalConfig({ indicadorId: ind.id, scope: "estado", tipoElemento })}
                      onVerDesgloseMunicipio={(tipoDistrito) => setModalConfig({ indicadorId: ind.id, scope: "municipio", tipoDistrito })}
                      onVerDesgloseNacional={(tipoElemento) => setModalConfig({ indicadorId: ind.id, scope: "nacional", tipoElemento })}
                      onVerAgregacionPlural={() => setModalConfig({ indicadorId: ind.id, scope: "seleccion", desglosePorUnidad: celda.agregacionPlural!.desglosePorUnidad })}
                    />
                  </div>
                );
              })}
            </div>
          </div>
        ))}
      </div>

      {/* Desktop — tabla */}
      <div className="hidden md:block overflow-x-auto rounded-lg border border-gray-eske-20 dark:border-white/10">
        <table className="w-full text-left">
          <thead className="bg-gray-eske-10/60 dark:bg-[#112230]">
            <tr>
              <th className="px-3 py-2 text-xs font-semibold text-black-eske-80 dark:text-[#9AAEBE]">Indicador</th>
              {columnas.map((nivel) => (
                <th key={nivel} className="px-3 py-2 text-xs font-semibold text-black-eske-80 dark:text-[#9AAEBE]">
                  {NOMBRE_NIVEL_TABLA[nivel]}
                </th>
              ))}
              <th className="px-3 py-2 w-16" />
            </tr>
          </thead>
          <tbody>
            {indicadores.map((ind) => (
              <tr key={ind.id} className="border-t border-gray-eske-20 dark:border-white/10">
                <td className="px-3 py-2 align-top">
                  <div className="flex items-center gap-1.5 min-w-0">
                    {ind.esMinimo && (
                      <span aria-label="Indicador mínimo del PIP" title="Indicador mínimo del PIP">
                        <LockIcon />
                      </span>
                    )}
                    <p className="text-sm font-medium text-black-eske dark:text-[#EAF2F8]">{ind.nombre}</p>
                    {ind.definicion && (
                      <InfoTooltip content={ind.definicion ?? ""} fuente={ind.fuenteEtiqueta} />
                    )}
                  </div>
                </td>
                {columnas.map((nivel) => {
                  const celda = ind.celdas.find((c) => c.nivel === nivel);
                  return (
                    <td key={nivel} className="px-3 py-2 align-top">
                      {celda ? (
                        <Celda
                          celda={celda}
                          territorioNivel={territorioNivel}
                          onVerMunicipios={() => setModalConfig({ indicadorId: ind.id, scope: "distrito" })}
                          onVerDesgloseEstado={(tipoElemento) => setModalConfig({ indicadorId: ind.id, scope: "estado", tipoElemento })}
                          onVerDesgloseMunicipio={(tipoDistrito) => setModalConfig({ indicadorId: ind.id, scope: "municipio", tipoDistrito })}
                          onVerDesgloseNacional={(tipoElemento) => setModalConfig({ indicadorId: ind.id, scope: "nacional", tipoElemento })}
                          onVerAgregacionPlural={() => setModalConfig({ indicadorId: ind.id, scope: "seleccion", desglosePorUnidad: celda.agregacionPlural!.desglosePorUnidad })}
                        />
                      ) : null}
                    </td>
                  );
                })}
                <td className="px-3 py-2 align-top text-right">
                  {!ind.esMinimo && (
                    <button
                      type="button"
                      onClick={() => onQuitar(ind.id)}
                      disabled={quitando === ind.id}
                      className="text-xs text-red-eske hover:underline disabled:opacity-50"
                    >
                      Quitar
                    </button>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {indicadorModal && modalConfig && (
        <FontanaMunicipiosModal
          sesionId={sesionId}
          indicadorId={indicadorModal.id}
          indicadorNombre={indicadorModal.nombre}
          scope={modalConfig.scope}
          tipoElemento={modalConfig.tipoElemento}
          tipoDistrito={modalConfig.tipoDistrito}
          desglosePorUnidad={modalConfig.desglosePorUnidad}
          etiquetaSeleccion={ETIQUETA_VER_AGREGACION_PLURAL[territorioNivel]}
          onClose={() => setModalConfig(null)}
        />
      )}
    </>
  );
}

function LockIcon() {
  return (
    <svg className="w-3.5 h-3.5 text-black-eske-80 dark:text-[#9AAEBE] shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden="true">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v2" />
    </svg>
  );
}

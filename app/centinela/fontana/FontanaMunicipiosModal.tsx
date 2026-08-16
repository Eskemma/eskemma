"use client";

// app/centinela/fontana/FontanaMunicipiosModal.tsx
// Modal "Ver datos municipales" — desglose por municipio de un
// indicador dentro del distrito electoral federal del proyecto. Mismo
// esqueleto ya consolidado en PESTEL
// (app/components/centinela/pestel/interpretacion/AdjustmentModal.tsx):
// overlay fixed inset-0 z-50 + backdrop, panel con useFocusTrap +
// useEscapeKey, animación fade-in/zoom-in-95. Sin componente Modal
// genérico (no existe uno en el repo, confirmado).
//
// Un solo patrón de modal para cualquier tamaño de distrito (2 a 119
// municipios, caso real Oaxaca) — búsqueda siempre visible, lista con
// scroll interno, sin paginación (sin evidencia de que 119 filas la
// requiera — no se agrega por adelantado).
//
// Advertencia de fragmentación — 3 niveles, con una señal visual que
// NUNCA reutiliza CONFIABILIDAD_BORDE (NaturalezaBadge): ese color ya
// significa "naturaleza del dato" en toda la tabla; un municipio
// fragmentado sin dominante usa borde amarillo + ícono ▲ (nunca fondo
// relleno, para mantener la misma estética de solo-borde de la tabla),
// combinación que no aparece en ningún otro badge — la diferencia con
// confiabilidad "media" (que también puede rendear borde amarillo en
// modo oscuro) la da el ícono, nunca el color solo.
//
// Cobertura incompleta (4ª categoría, prioridad sobre las 3 de
// fragmentación) — problema DISTINTO: cuando coberturaMunicipioPct <
// 99%, el % de fragmentación de esta fila no es confiable (secciones
// del municipio no lograron vincularse a NINGÚN distrito, ver nota en
// scripts/eceg-data-pipeline.ts) — usa CoberturaAdvertencia
// (border-blue-eske), nunca el texto/color de "sin distrito dominante".
//
// Encargo 2 (cierre 2026-08-04) — modo dual, mismo componente:
// scope="distrito" (default, sin cambio de comportamiento) es el modal
// de arriba. scope="estado" es nuevo: desglose de TODOS los municipios/
// distritos del ESTADO del proyecto — sin fragmentación que advertir
// (cada elemento pertenece íntegro al estado). Si el conteo real supera
// UMBRAL_PRECARGA_COMPLETA (Oaxaca: 570 municipios), el servidor regresa
// solo el índice ligero (cve+nombre) — el usuario filtra, selecciona con
// checkboxes, y pide los valores de su selección en un solo POST batch
// (nunca N requests).
//
// Columnas inversas (cierre 2026-08-05) — 3er modo, scope="municipio":
// inverso de scope="distrito" — en vez de "distrito → sus municipios",
// aquí es "municipio → los distritos (federal o local, tipoDistrito)
// que lo tocan". Solo se abre cuando el municipio del proyecto NO tiene
// distrito dominante (ver botón en FontanaComparativeTable.tsx) —
// confirmado con datos reales de los 32 estados que esto nunca supera
// 12 elementos, siempre precarga completa, nunca modo buscador.
//
// Columnas Nacional (cierre 2026-08-06) — 4º ámbito, scope="nacional":
// mismo componente ModalEstado (generalizado, no uno nuevo) — comparte
// ~90% de la lógica (búsqueda, checkboxes, "Seleccionar todos"/"Limpiar
// seleccionados", carga por lote). 3 diferencias reales: (1) clave de
// selección compuesta `estadoCve:cve` (un mismo cve, ej. municipio
// "001", existe en los 32 estados — una clave plana colisionaría); (2)
// cada fila muestra "{nombre} ({estadoNombre})" para desambiguar; (3) el
// body del POST manda {estadoCve,cve}[] en vez de cve[] plano. El
// indicador de carga (input deshabilitado + placeholder "Cargando…" en
// rojo mientras se resuelve el índice) aplica al componente compartido,
// así que también mejora el caso Estatal existente (Oaxaca) — decisión
// explícita, no acotada solo a Nacional.

import { useEffect, useState, type RefObject } from "react";
import { useFocusTrap } from "@/app/hooks/useFocusTrap";
import { useEscapeKey } from "@/app/hooks/useEscapeKey";
import { familiaDeIndicador } from "@/types/fontana.types";
import NaturalezaBadge from "./NaturalezaBadge";
import CoberturaAdvertencia from "./CoberturaAdvertencia";
import type { CeldaFontana } from "@/lib/fontana/ingesta/types";

interface MunicipioDesglose {
  municipioCve: string;
  nombre: string;
  pctPobtot: number;
  coberturaMunicipioPct: number;
  valor?: number;
  unidad?: string;
  naturaleza?: string;
  fuenteEtiqueta?: string;
  motivo?: string;
}

export type TipoElementoEstado = "municipios" | "distritos_fed" | "distritos_loc";
export type TipoElementoNacional = "estados" | TipoElementoEstado;

interface ElementoEstado {
  cve: string;
  nombre: string;
  valor?: number;
  unidad?: string;
  naturaleza?: string;
  fuenteEtiqueta?: string;
  motivo?: string;
  // Solo ámbito Nacional (municipios/distritos_fed/distritos_loc, nunca
  // "estados") — para desambiguar nombres repetidos entre estados (ej.
  // varios "SAN JUAN") y para reconstruir la clave de selección compuesta.
  estadoCve?: string;
  estadoNombre?: string;
}

const TITULO_TIPO_ELEMENTO: Record<TipoElementoNacional, string> = {
  estados: "estados",
  municipios: "municipios",
  distritos_fed: "distritos electorales federales",
  distritos_loc: "distritos electorales locales",
};

export type TipoDistrito = "federal" | "local";

interface DistritoDeMunicipio {
  distritoCve: string;
  nombre: string;
  pctPobtot: number;
  valor?: number;
  unidad?: string;
  naturaleza?: string;
  fuenteEtiqueta?: string;
  motivo?: string;
}

const TITULO_TIPO_DISTRITO: Record<TipoDistrito, string> = {
  federal: "distritos electorales federales",
  local: "distritos electorales locales",
};

// Fase 3 del rediseño de territorio (26-08-17) — shape EXACTA de
// desglosePorUnidad tal como lo produce resolverAgregacionPlural()
// (lib/fontana/ingesta/index.ts) y lo serializa route.ts — import
// type-only de lib/fontana/ingesta/types.ts, seguro para bundle de
// cliente (sin runtime de firebase-admin, ver comentario en ese archivo).
export interface ElementoAgregacionPluralUI {
  cve: string;
  nombre: string;
  estado: string;
  celda: CeldaFontana;
}

interface Props {
  sesionId: string;
  indicadorId: string;
  indicadorNombre: string;
  scope?: "distrito" | "estado" | "municipio" | "nacional" | "seleccion";
  tipoElemento?: TipoElementoNacional; // requerido cuando scope === "estado"|"nacional"
  tipoDistrito?: TipoDistrito; // requerido cuando scope === "municipio"
  // Solo scope === "seleccion" — desglose YA RESUELTO por el backend, sin
  // fetch propio del modal (a diferencia de los demás scopes).
  desglosePorUnidad?: ElementoAgregacionPluralUI[];
  etiquetaSeleccion?: string; // título del modal, ej. "Ver valores municipales"
  onClose: () => void;
}

// >= 99.95% se trata como 100% (redondeo del cálculo de % en el
// pipeline, que guarda 1 decimal) — nunca mostrar "99.9%" como si fuera
// una fragmentación real.
const UMBRAL_COMPLETO = 99.95;
const UMBRAL_DOMINANTE = 50;
// Mismo umbral que la advertencia de cobertura en la tabla principal
// (99%) — criterio técnico: no introducir un segundo número sin
// justificación adicional.
const UMBRAL_COBERTURA = 99;

function normalizar(s: string): string {
  return s.toLowerCase().normalize("NFD").replace(/[̀-ͯ]/g, "");
}

// Router — cada modo llama sus propios hooks en su propio componente
// (nunca condicionalmente dentro de uno solo), scope="distrito" preserva
// el comportamiento exacto ya en producción, sin cambio.
export default function FontanaMunicipiosModal(props: Props) {
  if (props.scope === "estado" || props.scope === "nacional") {
    if (!props.tipoElemento) {
      throw new Error(`FontanaMunicipiosModal: tipoElemento es requerido cuando scope='${props.scope}'`);
    }
    return <ModalEstado {...props} tipoElemento={props.tipoElemento} ambito={props.scope} />;
  }
  if (props.scope === "municipio") {
    if (!props.tipoDistrito) {
      throw new Error("FontanaMunicipiosModal: tipoDistrito es requerido cuando scope='municipio'");
    }
    return <ModalMunicipio {...props} tipoDistrito={props.tipoDistrito} />;
  }
  if (props.scope === "seleccion") {
    if (!props.desglosePorUnidad) {
      throw new Error("FontanaMunicipiosModal: desglosePorUnidad es requerido cuando scope='seleccion'");
    }
    return <ModalSeleccion {...props} desglosePorUnidad={props.desglosePorUnidad} />;
  }
  return <ModalDistrito {...props} />;
}

// Fase 3 del rediseño de territorio (26-08-17) — desglose de las
// unidades territoriales PLURALES que el usuario seleccionó
// explícitamente (2+ municipios/estados/distritos peer-a-peer), NO de
// "todo el estado/nación" como los demás modos. Sin fetch propio: el
// desglose ya llega resuelto (resolverAgregacionPlural, calculado por
// route.ts junto con el resto de la celda) — evita pedirle al backend un
// catálogo completo cuando solo hacen falta las N unidades ya elegidas.
function ModalSeleccion({
  indicadorNombre,
  desglosePorUnidad,
  etiquetaSeleccion,
  onClose,
}: Props & { desglosePorUnidad: ElementoAgregacionPluralUI[] }) {
  const [busqueda, setBusqueda] = useState("");
  const containerRef = useFocusTrap(true);
  useEscapeKey(true, onClose);

  const filtrados = desglosePorUnidad.filter(
    (e) => normalizar(e.nombre).includes(normalizar(busqueda)) || normalizar(e.estado).includes(normalizar(busqueda))
  );

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4"
      role="dialog"
      aria-modal="true"
      aria-labelledby="seleccion-modal-title"
    >
      <div
        className="absolute inset-0 bg-black-eske/40 motion-safe:animate-in motion-safe:fade-in motion-safe:duration-150"
        aria-hidden="true"
        onClick={onClose}
      />
      <div
        ref={containerRef as RefObject<HTMLDivElement>}
        className="relative z-10 bg-white-eske dark:bg-[#18324A] rounded-xl shadow-lg
          border border-gray-eske-20 dark:border-white/10 w-full max-w-lg max-h-[80vh] p-6 flex flex-col gap-4
          motion-safe:animate-in motion-safe:zoom-in-95 motion-safe:duration-150"
      >
        <div className="flex items-start justify-between gap-2">
          <div>
            <h2 id="seleccion-modal-title" className="text-base font-semibold text-black-eske dark:text-[#EAF2F8]">
              {etiquetaSeleccion ?? "Ver valores por unidad"} — <span className="text-bluegreen-eske dark:text-blue-eske-20">{indicadorNombre}</span>
            </h2>
            <p className="text-xs text-black-eske-80 dark:text-[#9AAEBE] mt-0.5">
              Valor individual de cada unidad territorial que seleccionaste para este proyecto.
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label="Cerrar"
            className="shrink-0 w-7 h-7 flex items-center justify-center rounded-full text-black-eske-80 dark:text-[#9AAEBE] hover:bg-gray-eske-10 dark:hover:bg-white/5"
          >
            ✕
          </button>
        </div>

        {desglosePorUnidad.length > 5 && (
          <input
            type="text"
            value={busqueda}
            onChange={(e) => setBusqueda(e.target.value)}
            placeholder="Buscar…"
            autoFocus
            className="w-full px-3 py-2 border border-gray-eske-30 dark:border-white/10 rounded-lg
              text-sm bg-white-eske dark:bg-[#112230] text-black-eske dark:text-[#EAF2F8]
              focus:outline-none focus-visible:ring-2 focus-visible:ring-bluegreen-eske
              placeholder:text-gray-eske-50 dark:placeholder:text-[#6D8294]"
          />
        )}

        <div className="overflow-y-auto flex-1 -mx-1 px-1">
          {filtrados.length === 0 && (
            <p className="text-sm text-black-eske-80 dark:text-[#9AAEBE]">
              {busqueda ? "Ninguna unidad coincide con la búsqueda." : "Sin unidades para mostrar."}
            </p>
          )}
          {filtrados.length > 0 && (
            <ul className="divide-y divide-gray-eske-20 dark:divide-white/10">
              {filtrados.map((e) => (
                <FilaSeleccion key={`${e.estado}-${e.cve}`} elemento={e} />
              ))}
            </ul>
          )}
        </div>
      </div>
    </div>
  );
}

function FilaSeleccion({ elemento }: { elemento: ElementoAgregacionPluralUI }) {
  const { nombre, estado, celda } = elemento;
  return (
    <li className="py-2.5 flex items-start justify-between gap-3">
      <div>
        <p className="text-sm text-black-eske dark:text-[#EAF2F8]">{nombre}</p>
        <p className="text-[11px] text-black-eske-80 dark:text-[#9AAEBE]">{estado}</p>
      </div>
      <div className="text-right shrink-0">
        {"valor" in celda ? (
          <>
            <p className="text-sm font-semibold text-black-eske dark:text-[#EAF2F8]">
              {celda.valor.toLocaleString("es-MX")}
              {celda.unidad ? <span className="ml-1 font-normal text-xs text-black-eske-80 dark:text-[#9AAEBE]">{celda.unidad}</span> : null}
            </p>
            {celda.naturaleza && (
              <div className="mt-1 flex justify-end">
                <NaturalezaBadge naturaleza={celda.naturaleza} />
              </div>
            )}
            {celda.fuenteEtiqueta && <p className="text-[10px] text-black-eske-80 dark:text-[#9AAEBE] mt-0.5">{celda.fuenteEtiqueta}</p>}
          </>
        ) : (
          <p className="text-xs text-black-eske-80 dark:text-[#9AAEBE] italic">{celda.motivo}</p>
        )}
      </div>
    </li>
  );
}

function ModalDistrito({ sesionId, indicadorId, indicadorNombre, onClose }: Props) {
  const [municipios, setMunicipios] = useState<MunicipioDesglose[] | null>(null);
  // tipoDistrito viene en la misma respuesta (route.ts ya lo calcula
  // desde territorio.nivel) — necesario para que CoberturaAdvertencia
  // identifique "federal"/"local" en su texto (cierre 2026-08-06).
  const [tipoDistrito, setTipoDistrito] = useState<TipoDistrito | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [busqueda, setBusqueda] = useState("");

  const containerRef = useFocusTrap(true);
  useEscapeKey(true, onClose);

  useEffect(() => {
    const controller = new AbortController();
    setMunicipios(null);
    setError(null);

    fetch(`/api/fontana/familia/${familiaDeIndicador(indicadorId)}/municipios?sesionId=${sesionId}&indicadorId=${indicadorId}`, {
      signal: controller.signal,
    })
      .then(async (res) => {
        const data = await res.json();
        if (!res.ok) throw new Error(data.mensaje ?? data.error ?? "No se pudo cargar el desglose municipal");
        setMunicipios(data.municipios);
        setTipoDistrito(data.tipoDistrito ?? null);
      })
      .catch((err) => {
        if (err.name !== "AbortError") setError(err.message);
      });

    return () => controller.abort();
  }, [sesionId, indicadorId]);

  const filtrados = municipios?.filter((m) => normalizar(m.nombre).includes(normalizar(busqueda))) ?? [];

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4"
      role="dialog"
      aria-modal="true"
      aria-labelledby="municipios-modal-title"
    >
      <div
        className="absolute inset-0 bg-black-eske/40 motion-safe:animate-in
          motion-safe:fade-in motion-safe:duration-150"
        aria-hidden="true"
        onClick={onClose}
      />

      <div
        ref={containerRef as RefObject<HTMLDivElement>}
        className="relative z-10 bg-white-eske dark:bg-[#18324A] rounded-xl shadow-lg
          border border-gray-eske-20 dark:border-white/10 w-full max-w-lg max-h-[80vh] p-6 flex flex-col gap-4
          motion-safe:animate-in motion-safe:zoom-in-95 motion-safe:duration-150"
      >
        <div className="flex items-start justify-between gap-2">
          <div>
            <h2 id="municipios-modal-title" className="text-base font-semibold text-black-eske dark:text-[#EAF2F8]">
              Datos municipales — <span className="text-bluegreen-eske dark:text-blue-eske-20">{indicadorNombre}</span>
            </h2>
            <p className="text-xs text-black-eske-80 dark:text-[#9AAEBE] mt-0.5">
              Valor por cada municipio que compone el distrito electoral del proyecto.
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label="Cerrar"
            className="shrink-0 w-7 h-7 flex items-center justify-center rounded-full text-black-eske-80 dark:text-[#9AAEBE] hover:bg-gray-eske-10 dark:hover:bg-white/5"
          >
            ✕
          </button>
        </div>

        <input
          type="text"
          value={busqueda}
          onChange={(e) => setBusqueda(e.target.value)}
          placeholder="Buscar municipio…"
          autoFocus
          className="w-full px-3 py-2 border border-gray-eske-30 dark:border-white/10 rounded-lg
            text-sm bg-white-eske dark:bg-[#112230] text-black-eske dark:text-[#EAF2F8]
            focus:outline-none focus-visible:ring-2 focus-visible:ring-bluegreen-eske
            placeholder:text-gray-eske-50 dark:placeholder:text-[#6D8294]"
        />

        <div className="overflow-y-auto flex-1 -mx-1 px-1">
          {error && <p className="text-sm text-red-eske">{error}</p>}

          {!error && !municipios && (
            <p className="text-sm text-red-eske">Cargando…</p>
          )}

          {!error && municipios && filtrados.length === 0 && (
            <p className="text-sm text-black-eske-80 dark:text-[#9AAEBE]">
              {busqueda ? "Ningún municipio coincide con la búsqueda." : "Sin municipios para mostrar."}
            </p>
          )}

          {!error && filtrados.length > 0 && tipoDistrito && (
            <ul className="divide-y divide-gray-eske-20 dark:divide-white/10">
              {filtrados.map((m) => (
                <FilaMunicipio key={m.municipioCve} municipio={m} tipoDistrito={tipoDistrito} />
              ))}
            </ul>
          )}
        </div>
      </div>
    </div>
  );
}

function FilaMunicipio({ municipio, tipoDistrito }: { municipio: MunicipioDesglose; tipoDistrito: TipoDistrito }) {
  const { nombre, pctPobtot, coberturaMunicipioPct, valor, unidad, naturaleza, fuenteEtiqueta, motivo } = municipio;
  const coberturaIncompleta = coberturaMunicipioPct < UMBRAL_COBERTURA;
  // La fragmentación de esta fila solo es confiable si la cobertura del
  // municipio es completa — si no, ni siquiera se evalúa (categoría 4
  // tiene prioridad, ver nota arriba).
  const completo = !coberturaIncompleta && pctPobtot >= UMBRAL_COMPLETO;
  const dominante = !coberturaIncompleta && !completo && pctPobtot >= UMBRAL_DOMINANTE;
  const sinDominante = !coberturaIncompleta && !completo && !dominante;

  return (
    <li className="py-2.5 flex items-start justify-between gap-3">
      <p className="text-sm text-black-eske dark:text-[#EAF2F8]">{nombre}</p>
      <div className="text-right shrink-0">
        {valor !== undefined ? (
          <>
            <p className="text-sm font-semibold text-black-eske dark:text-[#EAF2F8]">
              {valor.toLocaleString("es-MX")}
              {unidad ? <span className="ml-1 font-normal text-xs text-black-eske-80 dark:text-[#9AAEBE]">{unidad}</span> : null}
            </p>
            {naturaleza && (
              <div className="mt-1 flex justify-end">
                <NaturalezaBadge naturaleza={naturaleza} />
              </div>
            )}
            {fuenteEtiqueta && <p className="text-[10px] text-black-eske-80 dark:text-[#9AAEBE] mt-0.5">{fuenteEtiqueta}</p>}
          </>
        ) : (
          <p className="text-xs text-black-eske-80 dark:text-[#9AAEBE] italic">{motivo}</p>
        )}

        {coberturaIncompleta && (
          <CoberturaAdvertencia nivel="municipio" tipoDistrito={tipoDistrito} />
        )}
        {dominante && (
          <p className="text-[10px] italic text-gray-eske-60 dark:text-[#6D8294] mt-1 max-w-[220px]">
            {pctPobtot}% de este municipio pertenece a este distrito.
          </p>
        )}
        {sinDominante && (
          <div className="mt-1.5 inline-flex items-start gap-1 px-1.5 py-1 rounded border border-yellow-eske text-left max-w-[240px]">
            <span aria-hidden="true" className="text-yellow-eske text-xs leading-none mt-0.5">▲</span>
            <p className="text-[10px] text-black-eske-80 dark:text-[#9AAEBE]">
              Solo el <strong>{pctPobtot}%</strong> de este municipio pertenece a este distrito — el valor mostrado
              corresponde a TODO el municipio, no a esta fracción.
            </p>
          </div>
        )}
      </div>
    </li>
  );
}

// ── scope="estado"|"nacional" — desglose de TODOS los municipios/
// distritos del estado del proyecto, o de todo el país. 2 modos según
// lo que regrese el servidor (decidido ahí contra
// UMBRAL_PRECARGA_COMPLETA, nunca en el cliente): "precarga-completa"
// (≤119, sin fragmentación) o "buscador" (>119 — índice ligero +
// selección múltiple + carga de valores en un solo POST batch).
interface ElementoIndice {
  cve: string;
  nombre: string;
  estadoCve?: string;
  estadoNombre?: string;
}
type RespuestaEstado =
  | { modo: "precarga-completa"; elementos: ElementoEstado[] }
  | { modo: "buscador"; indice: ElementoIndice[] };

// Clave de selección — plana (solo cve) en ámbito Estatal, compuesta
// (`estadoCve:cve`) en ámbito Nacional, porque un mismo cve (ej.
// municipio "001") existe en los 32 estados y una clave plana
// colisionaría entre ellos.
function claveSeleccion(el: { cve: string; estadoCve?: string }, ambito: "estado" | "nacional"): string {
  return ambito === "nacional" ? `${el.estadoCve}:${el.cve}` : el.cve;
}

function ModalEstado({
  sesionId,
  indicadorId,
  indicadorNombre,
  tipoElemento,
  ambito,
  onClose,
}: Props & { tipoElemento: TipoElementoNacional; ambito: "estado" | "nacional" }) {
  const [respuesta, setRespuesta] = useState<RespuestaEstado | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [busqueda, setBusqueda] = useState("");
  const [seleccion, setSeleccion] = useState<Set<string>>(new Set());
  const [valoresCargados, setValoresCargados] = useState<Map<string, ElementoEstado>>(new Map());
  const [cargandoSeleccion, setCargandoSeleccion] = useState(false);
  const [errorSeleccion, setErrorSeleccion] = useState<string | null>(null);

  const containerRef = useFocusTrap(true);
  useEscapeKey(true, onClose);

  useEffect(() => {
    const controller = new AbortController();
    setRespuesta(null);
    setError(null);
    setSeleccion(new Set());
    setValoresCargados(new Map());

    fetch(`/api/fontana/familia/${familiaDeIndicador(indicadorId)}/municipios?sesionId=${sesionId}&indicadorId=${indicadorId}&tipoElemento=${tipoElemento}`, {
      signal: controller.signal,
    })
      .then(async (res) => {
        const data = await res.json();
        if (!res.ok) throw new Error(data.mensaje ?? data.error ?? "No se pudo cargar el desglose");
        setRespuesta(data as RespuestaEstado);
      })
      .catch((err) => {
        if (err.name !== "AbortError") setError(err.message);
      });

    return () => controller.abort();
  }, [sesionId, indicadorId, tipoElemento]);

  const tituloTipo = TITULO_TIPO_ELEMENTO[tipoElemento];
  const esBuscador = respuesta?.modo === "buscador";

  const elementosPrecarga = respuesta?.modo === "precarga-completa" ? respuesta.elementos : null;
  const indiceBuscador = respuesta?.modo === "buscador" ? respuesta.indice : null;

  const filtradosPrecarga = elementosPrecarga?.filter((e) => normalizar(e.nombre).includes(normalizar(busqueda))) ?? [];
  const filtradosIndice = indiceBuscador?.filter((e) => normalizar(e.nombre).includes(normalizar(busqueda))) ?? [];

  function toggleSeleccion(clave: string) {
    setSeleccion((prev) => {
      const next = new Set(prev);
      if (next.has(clave)) next.delete(clave);
      else next.add(clave);
      return next;
    });
  }

  // "Seleccionar todos" aplica al UNIVERSO COMPLETO del índice, no solo
  // a lo que el filtro de búsqueda muestra en ese momento — decisión
  // explícita: el caso de uso real es cargar/comparar TODO el estado
  // (ej. los 570 municipios de Oaxaca) o todo el país, no solo una
  // búsqueda parcial.
  function seleccionarTodos() {
    if (!indiceBuscador) return;
    setSeleccion(new Set(indiceBuscador.map((e) => claveSeleccion(e, ambito))));
  }

  // "Limpiar" vuelve el modal al mismo estado que tenía recién abierto:
  // desmarca las casillas Y descarta los valores ya cargados en
  // pantalla — no solo deshabilita "Cargar valores".
  function limpiarSeleccion() {
    setSeleccion(new Set());
    setValoresCargados(new Map());
  }

  async function cargarValoresSeleccion() {
    setCargandoSeleccion(true);
    setErrorSeleccion(null);
    try {
      // Ámbito Nacional: la selección puede cruzar hasta 32 estados — el
      // body manda {estadoCve, cve}[] (reconstruido desde la clave
      // compuesta), no cve[] plano como en ámbito Estatal (un solo
      // estado, siempre implícito).
      const body =
        ambito === "nacional"
          ? { sesionId, indicadorId, tipoElemento, seleccion: [...seleccion].map((clave) => {
              const [estadoCve, cve] = clave.split(":");
              return { estadoCve, cve };
            }) }
          : { sesionId, indicadorId, tipoElemento, seleccion: [...seleccion] };

      const res = await fetch(`/api/fontana/familia/${familiaDeIndicador(indicadorId)}/municipios`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.mensaje ?? data.error ?? "No se pudieron cargar los valores");
      setValoresCargados((prev) => {
        const next = new Map(prev);
        for (const el of data.valores as ElementoEstado[]) next.set(claveSeleccion(el, ambito), el);
        return next;
      });
    } catch (err) {
      setErrorSeleccion(err instanceof Error ? err.message : "Error al cargar los valores");
    } finally {
      setCargandoSeleccion(false);
    }
  }

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4"
      role="dialog"
      aria-modal="true"
      aria-labelledby="estado-modal-title"
    >
      <div
        className="absolute inset-0 bg-black-eske/40 motion-safe:animate-in
          motion-safe:fade-in motion-safe:duration-150"
        aria-hidden="true"
        onClick={onClose}
      />

      <div
        ref={containerRef as RefObject<HTMLDivElement>}
        className="relative z-10 bg-white-eske dark:bg-[#18324A] rounded-xl shadow-lg
          border border-gray-eske-20 dark:border-white/10 w-full max-w-lg max-h-[80vh] p-6 flex flex-col gap-4
          motion-safe:animate-in motion-safe:zoom-in-95 motion-safe:duration-150"
      >
        <div className="flex items-start justify-between gap-2">
          <div>
            <h2 id="estado-modal-title" className="text-base font-semibold text-black-eske dark:text-[#EAF2F8]">
              {tituloTipo.charAt(0).toUpperCase() + tituloTipo.slice(1)} —{" "}
              <span className="text-bluegreen-eske dark:text-blue-eske-20">{indicadorNombre}</span>
            </h2>
            <p className="text-xs text-black-eske-80 dark:text-[#9AAEBE] mt-0.5">
              {esBuscador
                ? `Busca y selecciona ${tituloTipo} para cargar su valor.`
                : ambito === "nacional"
                  ? `Valor por cada uno de los ${tituloTipo} del país.`
                  : `Valor por cada uno de los ${tituloTipo} del estado del proyecto.`}
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label="Cerrar"
            className="shrink-0 w-7 h-7 flex items-center justify-center rounded-full text-black-eske-80 dark:text-[#9AAEBE] hover:bg-gray-eske-10 dark:hover:bg-white/5"
          >
            ✕
          </button>
        </div>

        <input
          type="text"
          value={busqueda}
          onChange={(e) => setBusqueda(e.target.value)}
          placeholder={respuesta ? `Buscar ${tituloTipo}…` : "Cargando…"}
          disabled={!respuesta}
          autoFocus
          className="w-full px-3 py-2 border border-gray-eske-30 dark:border-white/10 rounded-lg
            text-sm bg-white-eske dark:bg-[#112230] text-black-eske dark:text-[#EAF2F8]
            focus:outline-none focus-visible:ring-2 focus-visible:ring-bluegreen-eske
            disabled:opacity-60 disabled:cursor-not-allowed
            placeholder:text-gray-eske-50 dark:placeholder:text-[#6D8294]
            disabled:placeholder:text-red-eske"
        />

        {esBuscador && (
          <div className="flex items-center gap-3 -mt-1">
            <button
              type="button"
              onClick={seleccionarTodos}
              disabled={!indiceBuscador || indiceBuscador.length === 0}
              className="text-[11px] text-bluegreen-eske dark:text-blue-eske-20 underline underline-offset-2 hover:text-bluegreen-eske-70
                disabled:opacity-50 disabled:cursor-not-allowed cursor-pointer"
            >
              Seleccionar todos
            </button>
            <button
              type="button"
              onClick={limpiarSeleccion}
              disabled={seleccion.size === 0}
              className="text-[11px] text-bluegreen-eske dark:text-blue-eske-20 underline underline-offset-2 hover:text-bluegreen-eske-70
                disabled:opacity-50 disabled:cursor-not-allowed cursor-pointer"
            >
              Limpiar seleccionados
            </button>
          </div>
        )}

        <div className="overflow-y-auto flex-1 -mx-1 px-1">
          {error && <p className="text-sm text-red-eske">{error}</p>}

          {!error && !respuesta && (
            <p className="text-sm text-red-eske">Cargando…</p>
          )}

          {!error && elementosPrecarga && filtradosPrecarga.length === 0 && (
            <p className="text-sm text-black-eske-80 dark:text-[#9AAEBE]">
              {busqueda ? `Ningún ${tituloTipo.slice(0, -1)} coincide con la búsqueda.` : "Sin elementos para mostrar."}
            </p>
          )}

          {!error && filtradosPrecarga.length > 0 && (
            <ul className="divide-y divide-gray-eske-20 dark:divide-white/10">
              {filtradosPrecarga.map((el) => (
                <FilaElementoPrecarga key={el.cve} elemento={el} />
              ))}
            </ul>
          )}

          {!error && indiceBuscador && filtradosIndice.length === 0 && (
            <p className="text-sm text-black-eske-80 dark:text-[#9AAEBE]">
              {busqueda ? `Ningún ${tituloTipo.slice(0, -1)} coincide con la búsqueda.` : "Sin elementos para mostrar."}
            </p>
          )}

          {!error && filtradosIndice.length > 0 && (
            <ul className="divide-y divide-gray-eske-20 dark:divide-white/10">
              {filtradosIndice.map((el) => {
                const clave = claveSeleccion(el, ambito);
                return (
                  <FilaElementoBuscador
                    key={clave}
                    nombre={el.nombre}
                    estadoNombre={el.estadoNombre}
                    seleccionado={seleccion.has(clave)}
                    onToggle={() => toggleSeleccion(clave)}
                    valorCargado={valoresCargados.get(clave)}
                  />
                );
              })}
            </ul>
          )}
        </div>

        {esBuscador && (
          <div className="flex items-center justify-between gap-2 pt-2 border-t border-gray-eske-20 dark:border-white/10">
            <p className="text-xs text-black-eske-80 dark:text-[#9AAEBE]">
              {seleccion.size} seleccionado{seleccion.size === 1 ? "" : "s"}
              {errorSeleccion && <span className="block text-red-eske">{errorSeleccion}</span>}
            </p>
            <button
              type="button"
              onClick={cargarValoresSeleccion}
              disabled={seleccion.size === 0 || cargandoSeleccion}
              className="shrink-0 px-3 py-1.5 rounded-lg text-xs font-medium text-white-eske bg-bluegreen-eske
                hover:bg-bluegreen-eske-70 disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {cargandoSeleccion ? <span className="text-red-eske">Cargando…</span> : `Cargar valores (${seleccion.size})`}
            </button>
          </div>
        )}
      </div>
    </div>
  );
}

function FilaElementoPrecarga({ elemento }: { elemento: ElementoEstado }) {
  const { nombre, valor, unidad, naturaleza, fuenteEtiqueta, motivo } = elemento;
  return (
    <li className="py-2.5 flex items-start justify-between gap-3">
      <p className="text-sm text-black-eske dark:text-[#EAF2F8]">{nombre}</p>
      <div className="text-right shrink-0">
        {valor !== undefined ? (
          <>
            <p className="text-sm font-semibold text-black-eske dark:text-[#EAF2F8]">
              {valor.toLocaleString("es-MX")}
              {unidad ? <span className="ml-1 font-normal text-xs text-black-eske-80 dark:text-[#9AAEBE]">{unidad}</span> : null}
            </p>
            {naturaleza && (
              <div className="mt-1 flex justify-end">
                <NaturalezaBadge naturaleza={naturaleza} />
              </div>
            )}
            {fuenteEtiqueta && <p className="text-[10px] text-black-eske-80 dark:text-[#9AAEBE] mt-0.5">{fuenteEtiqueta}</p>}
          </>
        ) : (
          <p className="text-xs text-black-eske-80 dark:text-[#9AAEBE] italic">{motivo}</p>
        )}
      </div>
    </li>
  );
}

function FilaElementoBuscador({
  nombre,
  estadoNombre,
  seleccionado,
  onToggle,
  valorCargado,
}: {
  nombre: string;
  estadoNombre?: string;
  seleccionado: boolean;
  onToggle: () => void;
  valorCargado?: ElementoEstado;
}) {
  return (
    <li className="py-2.5 flex items-start justify-between gap-3">
      <label className="flex items-start gap-2 min-w-0 cursor-pointer">
        <input
          type="checkbox"
          checked={seleccionado}
          onChange={onToggle}
          className="mt-0.5 shrink-0 accent-bluegreen-eske"
          aria-label={`Seleccionar ${nombre}`}
        />
        <span className="text-sm text-black-eske dark:text-[#EAF2F8]">
          {nombre}
          {estadoNombre && <span className="text-black-eske-80 dark:text-[#9AAEBE]"> ({estadoNombre})</span>}
        </span>
      </label>
      {valorCargado && (
        <div className="text-right shrink-0">
          {valorCargado.valor !== undefined ? (
            <>
              <p className="text-sm font-semibold text-black-eske dark:text-[#EAF2F8]">
                {valorCargado.valor.toLocaleString("es-MX")}
                {valorCargado.unidad ? (
                  <span className="ml-1 font-normal text-xs text-black-eske-80 dark:text-[#9AAEBE]">{valorCargado.unidad}</span>
                ) : null}
              </p>
              {valorCargado.naturaleza && (
                <div className="mt-1 flex justify-end">
                  <NaturalezaBadge naturaleza={valorCargado.naturaleza} />
                </div>
              )}
              {valorCargado.fuenteEtiqueta && (
                <p className="text-[10px] text-black-eske-80 dark:text-[#9AAEBE] mt-0.5">{valorCargado.fuenteEtiqueta}</p>
              )}
            </>
          ) : (
            <p className="text-xs text-black-eske-80 dark:text-[#9AAEBE] italic">{valorCargado.motivo}</p>
          )}
        </div>
      )}
    </li>
  );
}

// ── scope="municipio" — columnas inversas: distritos (federal o local)
// que tocan el municipio del proyecto, con su % y valor. Siempre
// precarga completa (máximo real nacional: 12, muy por debajo de
// UMBRAL_PRECARGA_COMPLETA) — sin modo buscador, sin triage de
// dominante/sin-dominante/cobertura por fila (ya se resolvió ANTES de
// abrir este modal: solo se llega aquí cuando el municipio no tiene
// dominante y su cobertura ya es >= 99%, ver
// celdaDesdeDistritalMunicipio en app/api/fontana/familia/[familiaId]/route.ts).
function ModalMunicipio({ sesionId, indicadorId, indicadorNombre, tipoDistrito, onClose }: Props & { tipoDistrito: TipoDistrito }) {
  const [distritos, setDistritos] = useState<DistritoDeMunicipio[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [busqueda, setBusqueda] = useState("");

  const containerRef = useFocusTrap(true);
  useEscapeKey(true, onClose);

  useEffect(() => {
    const controller = new AbortController();
    setDistritos(null);
    setError(null);

    fetch(`/api/fontana/familia/${familiaDeIndicador(indicadorId)}/municipios?sesionId=${sesionId}&indicadorId=${indicadorId}&tipoDistrito=${tipoDistrito}`, {
      signal: controller.signal,
    })
      .then(async (res) => {
        const data = await res.json();
        if (!res.ok) throw new Error(data.mensaje ?? data.error ?? "No se pudo cargar el desglose de distritos");
        setDistritos(data.distritos);
      })
      .catch((err) => {
        if (err.name !== "AbortError") setError(err.message);
      });

    return () => controller.abort();
  }, [sesionId, indicadorId, tipoDistrito]);

  const tituloTipo = TITULO_TIPO_DISTRITO[tipoDistrito];
  const filtrados = distritos?.filter((d) => normalizar(d.nombre).includes(normalizar(busqueda))) ?? [];

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4"
      role="dialog"
      aria-modal="true"
      aria-labelledby="municipio-modal-title"
    >
      <div
        className="absolute inset-0 bg-black-eske/40 motion-safe:animate-in
          motion-safe:fade-in motion-safe:duration-150"
        aria-hidden="true"
        onClick={onClose}
      />

      <div
        ref={containerRef as RefObject<HTMLDivElement>}
        className="relative z-10 bg-white-eske dark:bg-[#18324A] rounded-xl shadow-lg
          border border-gray-eske-20 dark:border-white/10 w-full max-w-lg max-h-[80vh] p-6 flex flex-col gap-4
          motion-safe:animate-in motion-safe:zoom-in-95 motion-safe:duration-150"
      >
        <div className="flex items-start justify-between gap-2">
          <div>
            <h2 id="municipio-modal-title" className="text-base font-semibold text-black-eske dark:text-[#EAF2F8]">
              {tituloTipo.charAt(0).toUpperCase() + tituloTipo.slice(1)} —{" "}
              <span className="text-bluegreen-eske dark:text-blue-eske-20">{indicadorNombre}</span>
            </h2>
            <p className="text-xs text-black-eske-80 dark:text-[#9AAEBE] mt-0.5">
              Este municipio no tiene un distrito dominante — valor por cada {tituloTipo.slice(0, -1)} que lo toca.
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label="Cerrar"
            className="shrink-0 w-7 h-7 flex items-center justify-center rounded-full text-black-eske-80 dark:text-[#9AAEBE] hover:bg-gray-eske-10 dark:hover:bg-white/5"
          >
            ✕
          </button>
        </div>

        <input
          type="text"
          value={busqueda}
          onChange={(e) => setBusqueda(e.target.value)}
          placeholder={`Buscar ${tituloTipo}…`}
          autoFocus
          className="w-full px-3 py-2 border border-gray-eske-30 dark:border-white/10 rounded-lg
            text-sm bg-white-eske dark:bg-[#112230] text-black-eske dark:text-[#EAF2F8]
            focus:outline-none focus-visible:ring-2 focus-visible:ring-bluegreen-eske
            placeholder:text-gray-eske-50 dark:placeholder:text-[#6D8294]"
        />

        <div className="overflow-y-auto flex-1 -mx-1 px-1">
          {error && <p className="text-sm text-red-eske">{error}</p>}

          {!error && !distritos && (
            <p className="text-sm text-red-eske">Cargando…</p>
          )}

          {!error && distritos && filtrados.length === 0 && (
            <p className="text-sm text-black-eske-80 dark:text-[#9AAEBE]">
              {busqueda ? `Ningún ${tituloTipo.slice(0, -1)} coincide con la búsqueda.` : "Sin distritos para mostrar."}
            </p>
          )}

          {!error && filtrados.length > 0 && (
            <ul className="divide-y divide-gray-eske-20 dark:divide-white/10">
              {filtrados.map((d) => (
                <FilaDistritoDeMunicipio key={d.distritoCve} distrito={d} />
              ))}
            </ul>
          )}
        </div>
      </div>
    </div>
  );
}

function FilaDistritoDeMunicipio({ distrito }: { distrito: DistritoDeMunicipio }) {
  const { nombre, pctPobtot, valor, unidad, naturaleza, fuenteEtiqueta, motivo } = distrito;
  return (
    <li className="py-2.5 flex items-start justify-between gap-3">
      <p className="text-sm text-black-eske dark:text-[#EAF2F8]">{nombre}</p>
      <div className="text-right shrink-0">
        {valor !== undefined ? (
          <>
            <p className="text-sm font-semibold text-black-eske dark:text-[#EAF2F8]">
              {valor.toLocaleString("es-MX")}
              {unidad ? <span className="ml-1 font-normal text-xs text-black-eske-80 dark:text-[#9AAEBE]">{unidad}</span> : null}
            </p>
            {naturaleza && (
              <div className="mt-1 flex justify-end">
                <NaturalezaBadge naturaleza={naturaleza} />
              </div>
            )}
            {fuenteEtiqueta && <p className="text-[10px] text-black-eske-80 dark:text-[#9AAEBE] mt-0.5">{fuenteEtiqueta}</p>}
          </>
        ) : (
          <p className="text-xs text-black-eske-80 dark:text-[#9AAEBE] italic">{motivo}</p>
        )}
        <p className="text-[10px] italic text-gray-eske-60 dark:text-[#6D8294] mt-1 max-w-[220px]">
          {pctPobtot}% del municipio pertenece a este distrito.
        </p>
      </div>
    </li>
  );
}

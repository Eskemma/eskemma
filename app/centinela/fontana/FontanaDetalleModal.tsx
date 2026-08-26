"use client";

// app/centinela/fontana/FontanaDetalleModal.tsx
// Modal "Ver detalle" — Modo B (2026-08-24): componente ÚNICO,
// parametrizado por `indicadorId`, para F5-6 (top de giros DENUE) y
// F5-8 (localidades GACP en accesibilidad Bajo/Muy bajo). Nunca se
// duplica — mismo esqueleto ya consolidado (overlay + useFocusTrap +
// useEscapeKey, ver FontanaF4PaisesModal.tsx/FontanaMunicipiosModal.tsx),
// solo cambia el render de cada fila y el mapeo de la respuesta del
// endpoint según el tipo.
//
// Paginación SIEMPRE del lado del servidor (nunca se trae la lista
// completa para truncarla en el cliente — medido en vivo: DENUE hasta
// 730 giros distintos por municipio, GACP hasta 1,039 localidades en
// el caso nacional más grande) — "Ver más" pide la siguiente página al
// backend (`/api/fontana/familia/F5/detalle`), incremento fijo
// PAGE_SIZE (15, mismo tamaño que la página inicial), nunca "todos los
// restantes".
//
// Selector de municipio (territorio plural) — mobile-first: ≤5
// municipios se muestran como pills con scroll horizontal; más de 5
// cambia a un `<select>` nativo (más ergonómico al tacto en viewports
// angostos que forzar scroll horizontal con muchas pills — caso real
// que motivó el umbral: la Zona Metropolitana de Guadalajara con 10
// municipios). El municipio principal (`municipioInicial`, resuelto
// por el caller vía el mismo criterio que `resolverPrimerMunicipio()`)
// es la pestaña/opción activa por defecto.

import { useEffect, useState, type RefObject } from "react";
import { useFocusTrap } from "@/app/hooks/useFocusTrap";
import { useEscapeKey } from "@/app/hooks/useEscapeKey";

const PAGE_SIZE = 15;
const UMBRAL_PILLS = 5;

export interface MunicipioDetalleOption {
  estado: string;
  municipio: string;
}

interface Props {
  sesionId: string;
  indicadorId: "F5-6" | "F5-8";
  indicadorNombre: string;
  municipios: MunicipioDetalleOption[];
  municipioInicial: MunicipioDetalleOption;
  onClose: () => void;
}

interface GiroItem {
  giro: string;
  conteo: number;
}
interface LocalidadItem {
  nombre: string;
  poblacion: number;
  grado: string;
}
type DetalleItem = GiroItem | LocalidadItem;

interface DetalleRespuesta {
  items: DetalleItem[];
  total: number;
  offset: number;
  hasMore: boolean;
}

function esGiro(item: DetalleItem): item is GiroItem {
  return "giro" in item;
}

const TITULOS: Record<"F5-6" | "F5-8", { encabezado: string; vacio: string; columnaValor: string }> = {
  "F5-6": {
    encabezado: "Giros y actividades más frecuentes",
    vacio: "No se registraron unidades económicas para este municipio en DENUE.",
    columnaValor: "Unidades",
  },
  "F5-8": {
    encabezado: "Localidades con accesibilidad baja o muy baja",
    vacio: "Este municipio no tiene localidades con accesibilidad Bajo o Muy bajo — toda su población está en un rango de accesibilidad mejor.",
    columnaValor: "Población 2020",
  },
};

export default function FontanaDetalleModal({ sesionId, indicadorId, indicadorNombre, municipios, municipioInicial, onClose }: Props) {
  const containerRef = useFocusTrap(true);
  useEscapeKey(true, onClose);

  const [municipioActivo, setMunicipioActivo] = useState<MunicipioDetalleOption>(municipioInicial);
  const [items, setItems] = useState<DetalleItem[]>([]);
  const [total, setTotal] = useState(0);
  const [hasMore, setHasMore] = useState(false);
  const [cargando, setCargando] = useState(true);
  const [cargandoMas, setCargandoMas] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const config = TITULOS[indicadorId];

  async function cargarPagina(offset: number, modo: "reemplazar" | "agregar") {
    if (modo === "reemplazar") {
      setCargando(true);
      setError(null);
    } else {
      setCargandoMas(true);
    }
    try {
      const params = new URLSearchParams({
        sesionId,
        indicadorId,
        estado: municipioActivo.estado,
        municipio: municipioActivo.municipio,
        offset: String(offset),
      });
      const res = await fetch(`/api/fontana/familia/F5/detalle?${params}`);
      if (!res.ok) throw new Error("No se pudo cargar el detalle");
      const data: DetalleRespuesta = await res.json();
      setItems((prev) => (modo === "reemplazar" ? data.items : [...prev, ...data.items]));
      setTotal(data.total);
      setHasMore(data.hasMore);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Error inesperado");
    } finally {
      setCargando(false);
      setCargandoMas(false);
    }
  }

  useEffect(() => {
    cargarPagina(0, "reemplazar");
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [sesionId, indicadorId, municipioActivo.estado, municipioActivo.municipio]);

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4" role="dialog" aria-modal="true" aria-labelledby="f5-detalle-modal-title">
      <div
        className="absolute inset-0 bg-black-eske/40 motion-safe:animate-in motion-safe:fade-in motion-safe:duration-150"
        aria-hidden="true"
        onClick={onClose}
      />
      <div
        ref={containerRef as RefObject<HTMLDivElement>}
        className="relative z-10 bg-white-eske dark:bg-[#18324A] rounded-xl shadow-lg
          border border-gray-eske-20 dark:border-white/10 w-full max-w-lg max-h-[80vh] p-6 flex flex-col gap-3
          motion-safe:animate-in motion-safe:zoom-in-95 motion-safe:duration-150"
      >
        <div className="flex items-start justify-between gap-2">
          <div>
            <h2 id="f5-detalle-modal-title" className="text-base font-semibold text-bluegreen-eske dark:text-blue-eske-20">
              {indicadorNombre}
            </h2>
            <p className="text-xs text-black-eske-80 dark:text-[#9AAEBE] mt-1">{config.encabezado}</p>
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

        {municipios.length > 1 && (
          municipios.length <= UMBRAL_PILLS ? (
            <div className="flex gap-1.5 overflow-x-auto -mx-1 px-1 pb-1">
              {municipios.map((m) => (
                <button
                  key={`${m.estado}|${m.municipio}`}
                  type="button"
                  onClick={() => setMunicipioActivo(m)}
                  className={`shrink-0 px-2.5 py-1 rounded-full text-xs font-medium border whitespace-nowrap ${
                    m.municipio === municipioActivo.municipio && m.estado === municipioActivo.estado
                      ? "border-bluegreen-eske bg-bluegreen-eske/10 text-bluegreen-eske dark:text-blue-eske-20"
                      : "border-gray-eske-20 dark:border-white/10 text-black-eske-80 dark:text-[#9AAEBE]"
                  }`}
                >
                  {m.municipio}
                </button>
              ))}
            </div>
          ) : (
            <select
              value={`${municipioActivo.estado}|${municipioActivo.municipio}`}
              onChange={(e) => {
                const [estado, municipio] = e.target.value.split("|");
                setMunicipioActivo({ estado, municipio });
              }}
              className="px-3 py-2 rounded-lg border border-gray-eske-20 dark:border-white/10 bg-white-eske dark:bg-[#112230] text-sm text-black-eske dark:text-[#EAF2F8]"
            >
              {municipios.map((m) => (
                <option key={`${m.estado}|${m.municipio}`} value={`${m.estado}|${m.municipio}`}>
                  {m.municipio}
                </option>
              ))}
            </select>
          )
        )}

        {error && <p className="text-xs text-red-eske">{error}</p>}

        <div className="overflow-y-auto flex-1 -mx-1 px-1">
          {cargando ? (
            <p className="text-sm text-black-eske-80 dark:text-[#9AAEBE]">Cargando…</p>
          ) : items.length === 0 ? (
            <p className="text-sm text-black-eske-80 dark:text-[#9AAEBE]">{config.vacio}</p>
          ) : (
            <>
              <ol className="flex flex-col gap-2">
                {items.map((item, i) => (
                  <li key={i} className="flex items-start justify-between gap-3 py-1.5 border-b border-gray-eske-20 dark:border-white/10 last:border-0">
                    {esGiro(item) ? (
                      <>
                        <span className="text-sm text-black-eske dark:text-[#EAF2F8]">
                          <span className="text-black-eske-60 dark:text-[#6D8294] mr-1.5">{i + 1}.</span>
                          {item.giro}
                        </span>
                        <span className="text-sm font-semibold text-black-eske dark:text-[#EAF2F8] shrink-0">
                          {item.conteo.toLocaleString("es-MX")}
                        </span>
                      </>
                    ) : (
                      <>
                        <span className="text-sm text-black-eske dark:text-[#EAF2F8]">
                          <span className="text-black-eske-60 dark:text-[#6D8294] mr-1.5">{i + 1}.</span>
                          {item.nombre}
                          <span className="block text-[10px] italic text-black-eske-80 dark:text-[#9AAEBE]">{item.grado}</span>
                        </span>
                        <span className="text-sm font-semibold text-black-eske dark:text-[#EAF2F8] shrink-0">
                          {item.poblacion.toLocaleString("es-MX")} hab.
                        </span>
                      </>
                    )}
                  </li>
                ))}
              </ol>
              {hasMore && (
                <button
                  type="button"
                  onClick={() => cargarPagina(items.length, "agregar")}
                  disabled={cargandoMas}
                  className="mt-3 text-sm text-bluegreen-eske dark:text-blue-eske-20 hover:underline disabled:opacity-50"
                >
                  {cargandoMas ? "Cargando…" : `Ver más (${total - items.length} restantes)`}
                </button>
              )}
            </>
          )}
        </div>
      </div>
    </div>
  );
}

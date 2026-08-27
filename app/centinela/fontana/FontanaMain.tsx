"use client";

// app/centinela/fontana/FontanaMain.tsx
// Contenedor principal post-wizard — generalizado a familia activa
// (2026-08-07, habilitación del tab F2): antes solo renderizaba Familia 1
// hardcodeada; ahora recibe la familia activa como estado LOCAL (no
// prop — page.tsx no necesita conocerla) y deriva catálogo/fetch/PATCH de
// esa familia. F3-F5 siguen sin conector real — sus tabs se muestran
// deshabilitadas (ver FontanaFamiliaTabs.tsx).

import { useCallback, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import type { FamiliaFontanaId, FontanaSesion } from "@/types/fontana.types";
import type { NivelTablaFontana } from "@/lib/fontana/tablaColumnas";
import FontanaComparativeTable, { type IndicadorFilaFontana } from "./FontanaComparativeTable";
import FontanaF4Panel, { type IndicadorFilaF4 } from "./FontanaF4Panel";
import FontanaFamiliaTabs from "./FontanaFamiliaTabs";
import { FAMILIA1_ORDEN, FAMILIA1_NOMBRES, FAMILIA1_DIFERIDOS } from "@/lib/fontana/familia1Catalogo";
import { FAMILIA2_ORDEN, FAMILIA2_NOMBRES, FAMILIA2_DIFERIDOS } from "@/lib/fontana/familia2Catalogo";
import { FAMILIA3_ORDEN, FAMILIA3_NOMBRES, FAMILIA3_DIFERIDOS } from "@/lib/fontana/familia3Catalogo";
import { FAMILIA4_ORDEN, FAMILIA4_NOMBRES, FAMILIA4_DIFERIDOS, PAISES_REFERENCIA_F4, MEXICO_ISO3 } from "@/lib/fontana/familia4Catalogo";
import { FAMILIA5_ORDEN, FAMILIA5_NOMBRES, FAMILIA5_DIFERIDOS } from "@/lib/fontana/familia5Catalogo";
import { isMexico } from "@/lib/centinela/pestel/utils/country";
import InfoTooltip from "@/app/components/ui/InfoTooltip";
import FontanaModduloButton from "./FontanaModduloButton";
import FontanaCanal1Button from "./FontanaCanal1Button";

interface Props {
  sesion: FontanaSesion;
  onSesionActualizada: (sesion: FontanaSesion) => void;
  // Ronda 9 (26-08-18) — para el enlace "Resolver en Moddulo" del modal de
  // ambigüedad, que necesita saber a dónde traer de vuelta al usuario.
  retornoUrl?: string;
}

interface FamiliaCatalogo {
  orden: string[];
  nombres: Record<string, string>;
  diferidos: Set<string>;
  titulo: string;
  descripcion: string;
  color: string;
  // Solo F5 (amarillo #FFD14A) — en modo claro ese amarillo no tiene
  // suficiente contraste sobre fondo blanco (mismo problema ya resuelto
  // en otras partes del sitio, ej. DimensionStatusGrid.tsx,
  // PESTLPanelV2.tsx: texto café/`brown-eske-60` en claro, amarillo en
  // oscuro). Cuando está presente, sustituye el `style={{color}}` en
  // línea (que no puede expresar `dark:`) por estas clases de Tailwind.
  tituloClassName?: string;
}

// Mismos colores ya aprobados en FontanaFamiliaTabs.tsx (Fontana_T10_Cierre_Paso4.md §5).
const CATALOGO_POR_FAMILIA: Partial<Record<FamiliaFontanaId, FamiliaCatalogo>> = {
  F1: {
    orden: FAMILIA1_ORDEN,
    nombres: FAMILIA1_NOMBRES,
    diferidos: FAMILIA1_DIFERIDOS,
    titulo: "Familia 1 — Sociodemográficos",
    descripcion: "Indicadores derivados del Censo de Población y Vivienda 2020 (INEGI).",
    color: "#026988",
  },
  F2: {
    orden: FAMILIA2_ORDEN,
    nombres: FAMILIA2_NOMBRES,
    diferidos: FAMILIA2_DIFERIDOS,
    titulo: "Familia 2 — Socioeconómicos",
    descripcion: "Indicadores de pobreza, marginación, bienestar y acceso a servicios — fuentes oficiales (CONAPO, Bienestar, INEGI).",
    color: "#DB6015",
  },
  F3: {
    orden: FAMILIA3_ORDEN,
    nombres: FAMILIA3_NOMBRES,
    diferidos: FAMILIA3_DIFERIDOS,
    titulo: "Familia 3 — Geopolíticos",
    descripcion: "Seguridad pública, gasto federalizado y organizaciones sociales — SESNSP, INEGI, SHCP, DOF y RFOSC. 8 indicadores electorales quedan reservados hasta que Sefix-AI esté disponible.",
    color: "#D10F3F",
  },
  F4: {
    orden: FAMILIA4_ORDEN,
    nombres: FAMILIA4_NOMBRES,
    diferidos: FAMILIA4_DIFERIDOS,
    titulo: "Familia 4 — Comparación internacional",
    descripcion: "México frente a un set fijo de países de referencia de América Latina — Banco Mundial, CEPALSTAT, PNUD, RSF y Transparencia Internacional.",
    color: "#248CC1",
  },
  F5: {
    orden: FAMILIA5_ORDEN,
    nombres: FAMILIA5_NOMBRES,
    diferidos: FAMILIA5_DIFERIDOS,
    titulo: "Familia 5 — Características territoriales",
    descripcion: "Clima, tradiciones, actividad económica, zonas urbanas y riesgos ambientales del municipio — CONAGUA, INEGI/DENUE, SEDATU/CONAPO, CONEVAL e INECC.",
    color: "#FFD14A",
    tituloClassName: "text-brown-eske-60 dark:text-yellow-eske",
  },
};

export default function FontanaMain({ sesion, onSesionActualizada, retornoUrl }: Props) {
  const router = useRouter();
  const [familiaActiva, setFamiliaActiva] = useState<FamiliaFontanaId>("F1");
  const [indicadores, setIndicadores] = useState<IndicadorFilaFontana[] | null>(null);
  const [columnas, setColumnas] = useState<NivelTablaFontana[]>([]);
  // Familia 4 — shape de respuesta distinto (fila por país, no celdas por
  // nivel geográfico), estado separado en vez de forzarlo en `indicadores`.
  const [indicadoresF4, setIndicadoresF4] = useState<IndicadorFilaF4[] | null>(null);
  const [paisesReferenciaF4, setPaisesReferenciaF4] = useState<{ iso3: string; nombre: string }[]>(PAISES_REFERENCIA_F4);
  const [paisPrincipalF4, setPaisPrincipalF4] = useState<{ iso3: string; nombre: string }>({ iso3: MEXICO_ISO3, nombre: "México" });
  const [cargando, setCargando] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [quitando, setQuitando] = useState<string | null>(null);
  const [agregando, setAgregando] = useState(false);
  const [seleccionAgregar, setSeleccionAgregar] = useState("");

  // BUG REAL corregido (2026-08-23): el fallback anterior (?? CATALOGO_POR_FAMILIA.F1!)
  // reutilizaba en SILENCIO el catálogo completo de F1 (título,
  // descripción, orden de indicadores) para cualquier familia sin
  // entrada — pasó desapercibido cuando F5 se habilitó en
  // FontanaFamiliaTabs.tsx antes de que esta tabla se completara.
  // Nunca reutilizar datos de OTRA familia real como fallback — un
  // catálogo faltante debe fallar de forma visible, no disfrazarse.
  const catalogo: FamiliaCatalogo = CATALOGO_POR_FAMILIA[familiaActiva] ?? {
    orden: [],
    nombres: {},
    diferidos: new Set(),
    titulo: `Familia ${familiaActiva} — catálogo no configurado`,
    descripcion: "Esta familia todavía no tiene un catálogo de indicadores configurado en la UI.",
    color: "#6D8294",
  };

  const cargarIndicadores = useCallback(async () => {
    setCargando(true);
    setError(null);
    try {
      const res = await fetch(`/api/fontana/familia/${familiaActiva}?sesionId=${sesion.sesionId}`);
      if (!res.ok) throw new Error(`No se pudieron cargar los indicadores de ${catalogo.titulo}`);
      if (familiaActiva === "F4") {
        const data = (await res.json()) as {
          indicadores: IndicadorFilaF4[];
          paisPrincipal: { iso3: string; nombre: string };
          paisesReferencia: { iso3: string; nombre: string }[];
        };
        setIndicadoresF4(data.indicadores);
        setPaisPrincipalF4(data.paisPrincipal);
        setPaisesReferenciaF4(data.paisesReferencia);
      } else {
        const data = (await res.json()) as { indicadores: IndicadorFilaFontana[]; columnas: NivelTablaFontana[] };
        setIndicadores(data.indicadores);
        setColumnas(data.columnas);
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "Error inesperado");
    } finally {
      setCargando(false);
    }
    // catalogo.titulo depende solo de familiaActiva — no se agrega como
    // dependencia extra para no recalcular el callback en cada render.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [sesion.sesionId, familiaActiva]);

  useEffect(() => {
    setSeleccionAgregar("");
    cargarIndicadores();
  }, [cargarIndicadores]);

  async function modificarSesion(accion: "agregar" | "quitar", indicadorId: string) {
    const res = await fetch(`/api/fontana/sesion/${sesion.sesionId}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ accion, familiaId: familiaActiva, indicadorId }),
    });
    if (!res.ok) {
      const err = (await res.json()) as { mensaje?: string; error?: string };
      throw new Error(err.mensaje ?? err.error ?? "No se pudo actualizar la sesión");
    }
    const { sesion: actualizada } = (await res.json()) as { sesion: FontanaSesion };
    onSesionActualizada(actualizada);
    await cargarIndicadores();
  }

  async function handleQuitar(indicadorId: string) {
    setQuitando(indicadorId);
    try {
      await modificarSesion("quitar", indicadorId);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Error inesperado");
    } finally {
      setQuitando(null);
    }
  }

  async function handleAgregar() {
    if (!seleccionAgregar) return;
    setAgregando(true);
    try {
      await modificarSesion("agregar", seleccionAgregar);
      setSeleccionAgregar("");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Error inesperado");
    } finally {
      setAgregando(false);
    }
  }

  const familia = sesion.indicadoresPorFamilia[familiaActiva];
  const idsEnSesion = new Set([...familia.minimos, ...familia.seleccionUsuario]);
  // Excluye diferidos del selector manual — solo indicadores con conector
  // real son ofrecidos como opción de "+ Añadir" (decisión confirmada
  // 2026-08-07, sin precedente real de Familia 1 que copiar — investigado
  // que FAMILIA1_DIFERIDOS nunca tuvo consumidor en este repo).
  const disponiblesParaAgregar = catalogo.orden.filter((id) => !idsEnSesion.has(id) && !catalogo.diferidos.has(id));

  // Punto D, Ronda 6 (2026-08-22) — F1/F2/F3/F5 dependen exclusivamente
  // de fuentes de México (INEGI/CONEVAL/CONAPO/SESNSP/SHCP/etc., 73 de 84
  // indicadores del catálogo completo) — ninguna tiene cobertura de otro
  // país. F4 nunca se deshabilita por país (es la familia comparativa,
  // siempre disponible). Reusa isMexico() (lib/centinela/pestel/utils/country.ts),
  // mismo criterio de respaldo ya establecido en el ecosistema para
  // territorio.pais ausente — no se inventa un fallback distinto aquí.
  const proyectoEsMexico = isMexico(sesion.territorio.pais);
  const motivoDeshabilitadaPorFamilia: Partial<Record<FamiliaFontanaId, string>> = proyectoEsMexico
    ? {}
    : {
        F1: "Esta familia solo cubre México — el proyecto está definido para otro país.",
        F2: "Esta familia solo cubre México — el proyecto está definido para otro país.",
        F3: "Esta familia solo cubre México — el proyecto está definido para otro país.",
        F5: "Esta familia solo cubre México — el proyecto está definido para otro país.",
      };

  const conteosPorFamilia: Record<FamiliaFontanaId, number> = {
    F1: new Set([...sesion.indicadoresPorFamilia.F1.minimos, ...sesion.indicadoresPorFamilia.F1.seleccionUsuario]).size,
    F2: new Set([...sesion.indicadoresPorFamilia.F2.minimos, ...sesion.indicadoresPorFamilia.F2.seleccionUsuario]).size,
    F3: new Set([...sesion.indicadoresPorFamilia.F3.minimos, ...sesion.indicadoresPorFamilia.F3.seleccionUsuario]).size,
    F4: new Set([...sesion.indicadoresPorFamilia.F4.minimos, ...sesion.indicadoresPorFamilia.F4.seleccionUsuario]).size,
    F5: new Set([...sesion.indicadoresPorFamilia.F5.minimos, ...sesion.indicadoresPorFamilia.F5.seleccionUsuario]).size,
  };

  return (
    <div>
      {/* Header, mismo patrón visual que las páginas internas de PESTEL
          (app/centinela/pestel/[projectId]/informes/page.tsx, etc.):
          banner bg-bluegreen-eske de ancho completo, breadcrumb de
          regreso al hub arriba a la izquierda, título + subtitilo,
          acción(es) a la derecha. */}
      <div className="bg-bluegreen-eske text-white px-6 py-5">
        <div className="max-w-5xl mx-auto">
          <button
            type="button"
            onClick={() => router.push("/centinela/fontana")}
            className="text-sm text-white/70 hover:text-white mb-2 flex items-center gap-1 transition-colors"
            aria-label="Volver a Fontana"
          >
            ← Fontana
          </button>
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
            <div>
              <h1 className="text-2xl font-semibold">{sesion.nombre || "Fontana"}</h1>
              <p className="text-white/80 text-sm mt-0.5">
                {sesion.territorio.nombre || [sesion.territorio.estado, sesion.territorio.municipio].filter(Boolean).join(" › ")}
              </p>
            </div>
            {/* w-full flex justify-center en mobile: centra el/los botón(es)
                de cierre de la fila en vez de dejarlos alineados a la
                izquierda por defecto (align-items:stretch de la fila en
                flex-col). */}
            {sesion.modduloProjectId && sesion.tareaPipIds.length > 0 ? (
              <FontanaCanal1Button sesion={sesion} onSesionActualizada={onSesionActualizada} />
            ) : sesion.modduloProjectId ? (
              <div className="w-full flex justify-center gap-2 sm:w-fit sm:justify-start">
                <button
                  type="button"
                  onClick={() => router.push(`/moddulo/proyecto/${sesion.modduloProjectId}/investigacion`)}
                  className="px-4 py-2 border border-white/30 text-white text-sm rounded-lg hover:bg-white/10 transition-colors"
                >
                  Regresar a Moddulo F3
                </button>
              </div>
            ) : (
              <FontanaModduloButton sesion={sesion} />
            )}
          </div>
        </div>
      </div>

      <div className="max-w-5xl mx-auto px-4 py-6 md:py-10">
      <FontanaFamiliaTabs
        familiaActiva={familiaActiva}
        conteos={conteosPorFamilia}
        motivoDeshabilitadaPorFamilia={motivoDeshabilitadaPorFamilia}
        onCambiar={setFamiliaActiva}
      />

      <h2
        className={`text-base md:text-lg font-semibold mt-4 mb-1 ${catalogo.tituloClassName ?? ""}`}
        style={catalogo.tituloClassName ? undefined : { color: catalogo.color }}
      >
        {catalogo.titulo}
      </h2>
      <p className="text-xs md:text-sm text-black-eske-80 dark:text-[#9AAEBE] mb-4">
        {catalogo.descripcion}
      </p>

      {/* + Añadir indicador */}
      {disponiblesParaAgregar.length > 0 && (
        <div className="flex flex-col sm:flex-row gap-2 mb-4">
          <select
            value={seleccionAgregar}
            onChange={(e) => setSeleccionAgregar(e.target.value)}
            className="flex-1 px-3 py-2 rounded-lg border border-gray-eske-20 dark:border-white/10 bg-white-eske dark:bg-[#112230] text-sm text-black-eske dark:text-[#EAF2F8]"
          >
            <option value="">+ Añadir indicador…</option>
            {disponiblesParaAgregar.map((id) => (
              <option key={id} value={id}>{catalogo.nombres[id]}</option>
            ))}
          </select>
          <button
            type="button"
            onClick={handleAgregar}
            disabled={!seleccionAgregar || agregando}
            className="px-4 py-2 rounded-lg bg-bluegreen-eske text-white-eske text-sm font-medium hover:bg-bluegreen-eske-60 disabled:opacity-60 shrink-0"
          >
            {agregando ? "Añadiendo…" : "Añadir"}
          </button>
        </div>
      )}

      {error && (
        <p className="text-xs md:text-sm text-red-eske mb-3">{error}</p>
      )}

      <h3 className="text-sm md:text-base font-semibold text-black-eske dark:text-[#EAF2F8] mb-2 max-sm:text-center">
        {familiaActiva === "F4" ? "Comparación por país" : "Tabla comparativa por nivel"}
      </h3>
      {cargando ? (
        <p className="text-sm text-red-eske">Cargando indicadores…</p>
      ) : familiaActiva === "F4" ? (
        <FontanaF4Panel sesionId={sesion.sesionId} indicadores={indicadoresF4 ?? []} paisPrincipal={paisPrincipalF4} paisesReferencia={paisesReferenciaF4} onQuitar={handleQuitar} quitando={quitando} />
      ) : (
        <FontanaComparativeTable sesionId={sesion.sesionId} columnas={columnas} indicadores={indicadores ?? []} onQuitar={handleQuitar} quitando={quitando} territorioNivel={sesion.territorio.nivel} territorio={sesion.territorio} modduloProjectId={sesion.modduloProjectId} retornoUrl={retornoUrl} />
      )}

      <div className="mt-6 text-[11px] text-black-eske-80 dark:text-[#9AAEBE] flex items-center gap-1">
        <span>Los indicadores con candado son requeridos por el Programa de Investigación Profunda de tu proyecto.</span>
        <InfoTooltip content="Los indicadores mínimos no pueden eliminarse de la sesión — Fontana los identifica a partir de la pregunta de investigación asignada en tu proyecto." />
      </div>
      </div>
    </div>
  );
}

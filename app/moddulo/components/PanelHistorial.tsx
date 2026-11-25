"use client";

// C4a-2b — panel «Historial» (SOLO LECTURA): modal en todos los tamaños (centrado en escritorio, hoja inferior en móvil).
// Accesibilidad (R1–R4): `role="dialog" aria-modal aria-labelledby`; trampa de foco PROPIA (`siguienteEnCiclo`, recalcula
// los enfocables en CADA Tab; NO usa `useFocusTrap` ni `ResponsivePanel`); Escape y Tab se capturan UNA vez en `document`
// (fase de captura, `stopPropagation`; funciona aunque el foco esté en `body`); foco inicial y tras «Actualizar» en el título (`tabIndex={-1}`).
// Sin animaciones (respeta prefers-reduced-motion). Objetivos táctiles de 44 px en móvil. Sin «Volver»: la fila declara
// un slot de acciones (`renderAcciones`) que hoy nadie pasa.

import { useEffect, useId, useRef, type ReactNode } from "react";
import { entradaDePanel, type EstadoHistorial } from "@/lib/moddulo/versionado/estadoHookHistorial";
import {
  TEXTOS_PANEL, avisoDerivaVigente, debePedirDeriva, decidirEstadoPanel, dondeVaElFoco, marcasDeFila, siguienteEnCiclo, type ClaveMarca, type DestinoFoco,
} from "@/lib/moddulo/versionado/estadoPanelHistorial";
import { formatearFechaFila } from "@/lib/moddulo/versionado/textosHistorial";
import type { FaseConHistorial, FilaHistorial } from "@/lib/versionado/lectura";

interface Props {
  fase: FaseConHistorial;
  estado: EstadoHistorial;
  onCerrar: () => void;
  onActualizar: () => void;
  onCargarMas: () => void;
  onComprobarDeriva: () => void;
  /** Slot de acciones por fila (reservado para «Volver», C4b/C4c). Hoy vacío. */
  renderAcciones?: (fila: FilaHistorial) => ReactNode;
}

const ENFOCABLES = 'a[href], button:not([disabled]), input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])';
const FOCO = "focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-bluegreen-eske dark:focus-visible:outline-blue-eske-30";
const BOTON = `inline-flex min-h-[44px] items-center justify-center rounded-lg border border-bluegreen-eske px-3 text-sm font-medium text-bluegreen-eske transition-colors hover:bg-bluegreen-eske/10 disabled:opacity-50 sm:min-h-[36px] dark:border-blue-eske-30 dark:text-blue-eske-30 dark:hover:bg-blue-eske-30/10 ${FOCO}`;
const TEXTO_PROCESO = "text-sm text-red-eske-60 dark:text-red-eske-10";
const CAJA_AVISO = "rounded-lg border border-yellow-eske/40 bg-yellow-eske/10 px-3 py-2 text-sm text-brown-eske-60 dark:text-yellow-eske";
const CAJA_ERROR = "rounded-lg bg-red-eske/10 px-3 py-2 text-sm text-red-eske-60 dark:text-red-eske-10";
const SECUNDARIO = "text-black-eske-20 dark:text-[#9AAEBE]";
const MARCA_CLASE: Record<ClaveMarca, string> = {
  vigente: "font-semibold text-bluegreen-eske dark:text-blue-eske-30",
  cambio_nuevo: "text-brown-eske-60 dark:text-yellow-eske",
  deriva_antes: "text-brown-eske-60 dark:text-yellow-eske",
  parcial: "text-brown-eske-60 dark:text-yellow-eske",
  no_conservada: "text-brown-eske-60 dark:text-yellow-eske",
  no_comprobada: "text-brown-eske-60 dark:text-yellow-eske",
};

export default function PanelHistorial({ fase, estado, onCerrar, onActualizar, onCargarMas, onComprobarDeriva, renderAcciones }: Props) {
  const idTitulo = useId();
  const dialogoRef = useRef<HTMLDivElement>(null);
  const tituloRef = useRef<HTMLHeadingElement>(null);
  const masRef = useRef<HTMLButtonElement>(null);
  const cierreRef = useRef(onCerrar);
  cierreRef.current = onCerrar;

  const entrada = entradaDePanel(estado);
  const panel = decidirEstadoPanel(entrada);
  const enVuelo = estado.cargando || estado.cargandoMas || estado.actualizando;
  const aviso = avisoDerivaVigente(estado.primera, fase, estado.derivaF3Pedida);
  const puedeCargarMas = panel.tipo === "filas" && panel.puedeCargarMas;

  // Foco inicial: el título.
  useEffect(() => {
    if (dondeVaElFoco("abrir") === "titulo") tituloRef.current?.focus();
  }, []);

  // El foco NUNCA debe quedar fuera del diálogo (H-V65): al empezar una carga (1.ª página, «Reintentar», «Actualizar»,
  // «Cargar más») el botón que lo tenía se desmonta o se deshabilita, así que se queda en el diálogo; al terminar va al
  // título (o a «Cargar más» si sigue habiendo páginas). Todo lo decide `dondeVaElFoco`.
  const previo = useRef({ mas: estado.cargandoMas, act: estado.actualizando, carg: estado.cargando });
  useEffect(() => {
    const p = previo.current;
    const enfocar = (d: DestinoFoco) => {
      if (d === "dialogo") dialogoRef.current?.focus();
      else if (d === "cargar_mas") masRef.current?.focus();
      else tituloRef.current?.focus();
    };
    if ((estado.cargandoMas && !p.mas) || (estado.actualizando && !p.act) || (estado.cargando && !p.carg)) enfocar(dondeVaElFoco("cargando_inicio"));
    if (p.carg && !estado.cargando) enfocar(dondeVaElFoco("cargado"));
    if (p.act && !estado.actualizando) enfocar(dondeVaElFoco("actualizado"));
    if (p.mas && !estado.cargandoMas) enfocar(dondeVaElFoco("cargado_mas", puedeCargarMas));
    previo.current = { mas: estado.cargandoMas, act: estado.actualizando, carg: estado.cargando };
  }, [estado.cargandoMas, estado.actualizando, estado.cargando, puedeCargarMas]);

  // Escape y Tab: UN solo listener nativo en `document`, en fase de captura, mientras el panel está montado. Así funcionan
  // aunque el foco esté en `body`, y un mismo Escape no llega a los demás listeners (el de un modal de página, por ejemplo).
  useEffect(() => {
    const alTeclear = (ev: KeyboardEvent) => {
      if (ev.key === "Escape") {
        ev.stopPropagation();
        ev.preventDefault();
        cierreRef.current();
        return;
      }
      if (ev.key !== "Tab") return;
      const els = Array.from(dialogoRef.current?.querySelectorAll<HTMLElement>(ENFOCABLES) ?? []);
      const i = els.indexOf(document.activeElement as HTMLElement);
      const d = siguienteEnCiclo(els.map((_, k) => String(k)), i === -1 ? null : String(i), ev.shiftKey);
      if (!d.prevenir) return;
      ev.preventDefault();
      (d.destino === null ? dialogoRef.current : els[Number(d.destino)])?.focus();
    };
    document.addEventListener("keydown", alTeclear, true);
    return () => document.removeEventListener("keydown", alTeclear, true);
  }, []);

  return (
    <div
      className="fixed inset-0 z-[60] flex items-end justify-center bg-black/50 sm:items-center sm:p-4"
      onMouseDown={(e) => {
        if (e.target === e.currentTarget) onCerrar();
      }}
    >
      <div
        ref={dialogoRef}
        role="dialog"
        aria-modal="true"
        aria-labelledby={idTitulo}
        tabIndex={-1}
        className="flex max-h-[85dvh] w-full flex-col rounded-t-2xl bg-white-eske pb-[env(safe-area-inset-bottom)] shadow-2xl outline-none sm:max-h-[80vh] sm:max-w-xl sm:rounded-xl dark:bg-[#18324A]"
      >
        <div className="flex items-start justify-between gap-2 px-4 pt-4">
          <div className="min-w-0">
            <h2 id={idTitulo} ref={tituloRef} tabIndex={-1} className="text-base font-bold text-black-eske outline-none dark:text-[#EAF2F8]">
              {TEXTOS_PANEL.titulo}
            </h2>
            {panel.tipo === "filas" && <p className={`text-sm ${SECUNDARIO}`}>{TEXTOS_PANEL.total(panel.totalCambios)}</p>}
          </div>
          <div className="flex shrink-0 items-center gap-1">
            {panel.tipo !== "cargando" && (
              <button type="button" onClick={onActualizar} disabled={enVuelo} className={BOTON}>
                {estado.actualizando ? TEXTOS_PANEL.actualizando : TEXTOS_PANEL.actualizar}
              </button>
            )}
            <button
              type="button"
              onClick={onCerrar}
              aria-label={TEXTOS_PANEL.cerrar}
              className={`inline-flex min-h-[44px] min-w-[44px] items-center justify-center rounded-lg ${SECUNDARIO} hover:bg-gray-eske-10 sm:min-h-[36px] sm:min-w-[36px] dark:hover:bg-white/5 ${FOCO}`}
            >
              <svg className="h-5 w-5" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden="true">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
          </div>
        </div>

        <div className="flex-1 space-y-3 overflow-y-auto overscroll-contain px-4 pb-4 pt-3">
          {estado.actualizando && <p role="status" className={TEXTO_PROCESO}>{TEXTOS_PANEL.actualizando}</p>}
          {estado.errorAlActualizar && (
            <div role="alert" className={CAJA_ERROR}>
              <p>{estado.errorAlActualizar}</p>
              <button type="button" onClick={onActualizar} disabled={enVuelo} className={`${BOTON} mt-2`}>{TEXTOS_PANEL.reintentar}</button>
            </div>
          )}

          {(panel.tipo === "cargando") && <p role="status" className={TEXTO_PROCESO}>{panel.texto}</p>}
          {(panel.tipo === "error" || panel.tipo === "indice_no_listo") && (
            <div role="alert" className={CAJA_ERROR}>
              <p>{panel.texto}</p>
              <button type="button" onClick={onActualizar} disabled={enVuelo} className={`${BOTON} mt-2`}>{TEXTOS_PANEL.reintentar}</button>
            </div>
          )}
          {panel.tipo === "vacio" && <p className={`text-sm ${SECUNDARIO}`}>{panel.texto}</p>}

          {fase === "investigacion" && debePedirDeriva(fase, true) && !estado.derivaF3Pedida && panel.tipo === "filas" && (
            <div className="space-y-1">
              <button type="button" onClick={onComprobarDeriva} disabled={enVuelo} aria-describedby={`${idTitulo}-ayuda`} className={BOTON}>
                {TEXTOS_PANEL.comprobarDeriva}
              </button>
              <p id={`${idTitulo}-ayuda`} className={`text-sm ${SECUNDARIO}`}>{TEXTOS_PANEL.ayudaComprobarDeriva}</p>
            </div>
          )}
          {aviso && (aviso.tipo === "cambio" ? <p role="status" className={CAJA_AVISO}>{aviso.texto}</p> : <p role="status" className={`text-sm ${SECUNDARIO}`}>{aviso.texto}</p>)}

          {panel.tipo === "filas" && (
            <>
              {panel.avisos.map((t) => <p key={t} role="status" className={CAJA_AVISO}>{t}</p>)}
              <ol className="space-y-3">
                {panel.filas.map((f) => (
                  <li key={f.revisionN} className="border-b border-gray-eske-20 pb-3 last:border-b-0 dark:border-white/10">
                    <p className="text-sm font-medium text-black-eske dark:text-[#EAF2F8]">{f.titulo}</p>
                    <p className={`text-sm ${SECUNDARIO}`}>{f.quien} · {formatearFechaFila(f.en)}</p>
                    {f.detalleTexto && <p className={`text-sm ${SECUNDARIO}`}>{f.detalleTexto}</p>}
                    <ul className="mt-1 space-y-0.5">
                      {marcasDeFila(f).map((m) => <li key={m.clave} className={`text-sm ${MARCA_CLASE[m.clave]}`}>{m.texto}</li>)}
                    </ul>
                    {renderAcciones?.(f)}
                  </li>
                ))}
              </ol>
              {estado.cargandoMas && <p role="status" className={TEXTO_PROCESO}>{TEXTOS_PANEL.cargandoMas}</p>}
              {panel.errorAlCargarMas && <p role="alert" className={CAJA_ERROR}>{panel.errorAlCargarMas}</p>}
              {puedeCargarMas && (
                <button ref={masRef} type="button" onClick={onCargarMas} disabled={enVuelo} className={BOTON}>
                  {panel.errorAlCargarMas ? TEXTOS_PANEL.reintentar : TEXTOS_PANEL.cargarMas}
                </button>
              )}
              {panel.estadoFinal && <p role="status" className={CAJA_AVISO}>{panel.estadoFinal}</p>}
            </>
          )}
        </div>
      </div>
    </div>
  );
}

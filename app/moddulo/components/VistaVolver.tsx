"use client";

// C4b-2b — vista «Volver a esta versión» DENTRO del diálogo del panel «Historial» (no es un segundo diálogo: el
// `role="dialog"`, `aria-modal`, la trampa de foco y el Escape son los del panel). Solo pinta lo que decide
// `estadoVolver`; no tiene lógica propia. Sin reintento a ciegas: la única acción de confirmar existe en «confirmando».

import type { Ref } from "react";
import {
  ofreceConfirmar, ofreceVerHistorial, TEXTOS_VISTA_VOLVER, type EstadoVolver,
} from "@/lib/moddulo/versionado/estadoVolver";
import { BOTON, CAJA_AVISO, CAJA_ERROR, SECUNDARIO, TEXTO_PROCESO } from "./estilosPanel";

interface Props {
  estado: EstadoVolver;
  idTitulo: string;
  tituloRef: Ref<HTMLHeadingElement>;
  onConfirmar: () => void;
  onCancelar: () => void;
  onVerHistorial: () => void;
}

export default function VistaVolver({ estado, idTitulo, tituloRef, onConfirmar, onCancelar, onVerHistorial }: Props) {
  const { fase, objetivo, nombre, lineas, avisoHuella, mensajeError } = estado;
  return (
    <section className="space-y-3">
      <h2 id={idTitulo} ref={tituloRef} tabIndex={-1} className="text-base font-bold text-black-eske outline-none dark:text-[#EAF2F8]">
        {TEXTOS_VISTA_VOLVER.titulo}
      </h2>

      {fase === "preguntando" && <p role="status" className={TEXTO_PROCESO}>{TEXTOS_VISTA_VOLVER.preguntando}</p>}

      {(fase === "confirmando" || fase === "volviendo") && (
        <>
          {avisoHuella && <p role="status" className={CAJA_AVISO}>{TEXTOS_VISTA_VOLVER.avisoHuella}</p>}
          <p className="text-sm text-black-eske dark:text-[#EAF2F8]">{TEXTOS_VISTA_VOLVER.apertura(nombre, objetivo?.fechaTexto ?? null)}</p>
          {lineas.length > 0 && (
            <ul className={`list-disc space-y-1 pl-5 text-sm ${SECUNDARIO}`}>
              {lineas.map((l) => <li key={l}>{l}</li>)}
            </ul>
          )}
        </>
      )}

      {fase === "volviendo" && <p role="status" className={TEXTO_PROCESO}>{TEXTOS_VISTA_VOLVER.volviendo}</p>}

      {fase === "exito" && (
        <p role="status" className="text-sm text-black-eske dark:text-[#EAF2F8]">{TEXTOS_VISTA_VOLVER.exito(objetivo?.fechaTexto ?? null)}</p>
      )}

      {fase === "error" && mensajeError && <p role="alert" className={CAJA_ERROR}>{mensajeError}</p>}

      <div className="flex flex-wrap gap-2">
        {ofreceConfirmar(estado) && (
          <>
            <button type="button" onClick={onCancelar} className={BOTON}>{TEXTOS_VISTA_VOLVER.cancelar}</button>
            <button type="button" onClick={onConfirmar} className={`${BOTON} font-semibold`}>{TEXTOS_VISTA_VOLVER.confirmar}</button>
          </>
        )}
        {fase === "exito" && <button type="button" onClick={onCancelar} className={BOTON}>{TEXTOS_VISTA_VOLVER.cerrar}</button>}
        {fase === "error" && (
          <>
            {ofreceVerHistorial(estado) && <button type="button" onClick={onVerHistorial} className={`${BOTON} font-semibold`}>{TEXTOS_VISTA_VOLVER.verHistorial}</button>}
            <button type="button" onClick={onCancelar} className={BOTON}>{TEXTOS_VISTA_VOLVER.cerrar}</button>
          </>
        )}
      </div>
    </section>
  );
}

// VincularFuenteForm.tsx — Canal 3, mini-flujo de 2 pasos: paso 1
// reutiliza TerritorySelector tal cual fue diseñado (con su propia
// navegación Atrás/Continuar), paso 2 trae el resto de los campos y el
// flujo evaluar→confirmar advertencias→vincular contra /canal3/evaluar
// y /canal3/vincular.
//
// Extraído de F3TareasPIP.tsx (2026-08-19) para 2 usos: (a) dentro de
// una asignación canal3 de una tarea PIP (como siempre), y (b) el nuevo
// botón "Vincular resultado externo" (fuera del loop de tareas, sin
// depender de M1 — el backend nunca exigió asignacionId, solo la UI lo
// gateaba así). El modo Fontana (prop `fontanaSesionId`) se activa
// cuando este form se abre desde el banner de un resultado de Fontana
// pendiente (fontanaPendiente) — en vez de pedir un archivo, arma y sube
// el FontanaContextoTerritorial de esa sesión automáticamente.
"use client";

import { useState } from "react";
import { uploadMedia } from "@/firebase/storageUtils";
import type { ProjectType, Territorio } from "@/types/moddulo.types";
import type { FamiliaMetodologica } from "@/types/f3.types";
import type { EvaluacionCompatibilidad } from "@/types/shared.types";
import { sugerirFamiliaMetodologica } from "@/lib/moddulo/sugerirFamiliaMetodologica";
import { subirContextoTerritorial } from "@/lib/fontana/exportarContextoTerritorial";
import type { FontanaContextoTerritorial } from "@/types/fontana.types";
import PillButton from "@/app/moddulo/components/PillButton";
import TerritorySelector from "@/app/components/shared/TerritorySelector";
import { FieldLabel, FileSelectButton, inputClass } from "./F3FormHelpers";

export default function VincularFuenteForm({
  projectId, moduloPIP, projectType, projectTerritory, fontanaSesionId, onDone, onCancel,
}: {
  projectId: string;
  moduloPIP: string;
  projectType: ProjectType;
  projectTerritory: Territorio | null;
  // Modo Fontana (2026-08-19) — sin esto, comportamiento idéntico al
  // original (archivo elegido a mano). Con esto, paso 2 no pide archivo:
  // trae el contexto de esta sesión de /api/fontana/sesion/[id]/contexto
  // y lo sube como el "archivo" a vincular.
  fontanaSesionId?: string;
  onDone: () => void;
  onCancel: () => void;
}) {
  const [step, setStep] = useState<1 | 2>(1);
  const [territorio, setTerritorio] = useState<Territorio | null>(projectTerritory);

  const [file, setFile] = useState<File | null>(null);
  const [nombreHerramienta, setNombreHerramienta] = useState(fontanaSesionId ? "Fontana" : "");
  const [fechaObtencion, setFechaObtencion] = useState("");
  const [tipoProyectoDeclarado, setTipoProyectoDeclarado] = useState<ProjectType>(projectType);
  const [metodoDeclarado, setMetodoDeclarado] = useState(
    fontanaSesionId ? "Consulta de datos abiertos vía Fontana" : ""
  );
  const [familiaMetodologica, setFamiliaMetodologica] = useState<FamiliaMetodologica>(
    fontanaSesionId ? "documental" : "mixta"
  );
  const [familiaTocadaManualmente, setFamiliaTocadaManualmente] = useState(false);
  const [loading, setLoading] = useState(false);
  const [evaluando, setEvaluando] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [compatibilidad, setCompatibilidad] = useState<EvaluacionCompatibilidad | null>(null);
  const [confirmarTerritorio, setConfirmarTerritorio] = useState(false);
  const [confirmarVigencia, setConfirmarVigencia] = useState(false);
  const [archivoVinculado, setArchivoVinculado] = useState<string | null>(null);

  function handleMetodoChange(value: string) {
    setMetodoDeclarado(value);
    if (!familiaTocadaManualmente) setFamiliaMetodologica(sugerirFamiliaMetodologica(value));
  }

  const metadatosFuente = territorio
    ? { nombreHerramienta, territorioDeclarado: territorio, fechaObtencion, tipoProyectoDeclarado, metodoDeclarado, familiaMetodologica }
    : null;

  async function handleEvaluar() {
    if (!metadatosFuente || !nombreHerramienta || !fechaObtencion || !metodoDeclarado) return;
    setEvaluando(true);
    setError(null);
    try {
      const res = await fetch("/api/moddulo/f3/canal3/evaluar", {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ projectId, metadatosFuente }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.message ?? "No se pudo evaluar la compatibilidad");
      setCompatibilidad(data.compatibilidad);
      setConfirmarTerritorio(false);
      setConfirmarVigencia(false);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Error inesperado");
    } finally {
      setEvaluando(false);
    }
  }

  const puedeVincular = !!compatibilidad
    && compatibilidad.pertinencia.cumple
    && (!compatibilidad.pertinencia.territorioRequiereConfirmacion || confirmarTerritorio)
    && (compatibilidad.vigencia.cumple || confirmarVigencia)
    && (fontanaSesionId ? true : !!file);

  async function handleVincular() {
    if (!metadatosFuente || !puedeVincular) return;
    setLoading(true);
    setError(null);
    try {
      let storagePath: string;
      let nombreArchivo: string;
      let tipoArchivo: string;

      if (fontanaSesionId) {
        const resContexto = await fetch(`/api/fontana/sesion/${fontanaSesionId}/contexto`);
        if (!resContexto.ok) throw new Error("No se pudo preparar el resultado de Fontana.");
        const { contexto } = (await resContexto.json()) as { contexto: FontanaContextoTerritorial };
        storagePath = await subirContextoTerritorial(projectId, contexto);
        nombreArchivo = "fontana-contexto.json";
        tipoArchivo = "application/json";
      } else {
        if (!file) return;
        const ru = await fetch("/api/moddulo/f3/request-upload", {
          method: "POST", headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ projectId, formato: "documento", filename: file.name }),
        });
        if (!ru.ok) throw new Error("No se pudo reservar la subida");
        const data = await ru.json();
        storagePath = data.storagePath;
        await uploadMedia(file, storagePath);
        nombreArchivo = file.name;
        tipoArchivo = file.type || "application/octet-stream";
      }

      const resultadoId = storagePath.split("/").filter(Boolean).at(-2) ?? crypto.randomUUID();
      const res = await fetch("/api/moddulo/f3/canal3/vincular", {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          projectId, resultadoId, storagePath, nombre: nombreArchivo, tipo: tipoArchivo,
          metadatosFuente, moduloPIP, cobertura: { completa: true },
          confirmarPeseATerritorio: confirmarTerritorio, confirmarPeseAVigencia: confirmarVigencia,
          fontanaSesionId,
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.message ?? "No se pudo vincular la fuente");
      setArchivoVinculado(nombreArchivo);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Error inesperado");
    } finally {
      setLoading(false);
    }
  }

  if (archivoVinculado) {
    return (
      <div className="space-y-2">
        <p className="text-xs lg:text-sm text-green-eske font-medium">
          ✓ Fuente vinculada: {archivoVinculado} — apruébala en M2 (Resultados Recibidos) para vincularla a esta tarea.
        </p>
        <PillButton variant="solid" onClick={onDone}>Cerrar</PillButton>
      </div>
    );
  }

  if (step === 1) {
    return (
      <TerritorySelector
        territorio={territorio}
        onChange={setTerritorio}
        onNext={() => setStep(2)}
        onBack={onCancel}
        label="¿Qué territorio declara cubrir esta fuente/herramienta?"
      />
    );
  }

  return (
    <div className="space-y-2">
      {!fontanaSesionId && (
        <div>
          <FieldLabel>Archivo</FieldLabel>
          <FileSelectButton file={file} onChange={setFile} />
        </div>
      )}
      <div>
        <FieldLabel>Nombre de la herramienta/estudio</FieldLabel>
        <input value={nombreHerramienta} onChange={(e) => setNombreHerramienta(e.target.value)} className={inputClass} />
      </div>
      <div>
        <FieldLabel>Fecha de obtención</FieldLabel>
        <input type="date" onChange={(e) => setFechaObtencion(e.target.value ? new Date(e.target.value).toISOString() : "")} className={inputClass} />
      </div>
      <div>
        <FieldLabel>Tipo de proyecto declarado</FieldLabel>
        <select value={tipoProyectoDeclarado} onChange={(e) => setTipoProyectoDeclarado(e.target.value as ProjectType)} className={inputClass}>
          <option value="electoral">Electoral</option>
          <option value="gubernamental">Gubernamental</option>
          <option value="legislativo">Legislativo</option>
          <option value="ciudadano">Ciudadano</option>
        </select>
      </div>
      <div>
        <FieldLabel>Método declarado</FieldLabel>
        <input
          placeholder="Ej. Encuesta cara a cara, contratada con terceros"
          value={metodoDeclarado}
          onChange={(e) => handleMetodoChange(e.target.value)}
          className={inputClass}
        />
      </div>
      <div>
        <FieldLabel>Familia metodológica (sugerida, editable)</FieldLabel>
        <select
          value={familiaMetodologica}
          onChange={(e) => { setFamiliaMetodologica(e.target.value as FamiliaMetodologica); setFamiliaTocadaManualmente(true); }}
          className={inputClass}
        >
          <option value="cuantitativa">Cuantitativa</option>
          <option value="cualitativa">Cualitativa</option>
          <option value="documental">Documental</option>
          <option value="mixta">Mixta</option>
        </select>
      </div>

      {error && <p className="text-xs lg:text-sm text-yellow-eske-70">{error}</p>}

      {!compatibilidad && (
        <div className="flex gap-2">
          <PillButton
            variant="solid"
            onClick={handleEvaluar}
            disabled={evaluando || !nombreHerramienta || !fechaObtencion || !metodoDeclarado}
          >
            {evaluando ? "Evaluando…" : "Evaluar compatibilidad"}
          </PillButton>
          <PillButton onClick={onCancel} disabled={evaluando} className="dark:border-blue-eske-20 dark:text-blue-eske-20">Cancelar</PillButton>
        </div>
      )}

      {compatibilidad && !compatibilidad.pertinencia.cumple && (
        <div className="space-y-2">
          <p className="text-xs lg:text-sm text-red-eske">{compatibilidad.pertinencia.detalle}</p>
          <div className="flex gap-2">
            <PillButton onClick={() => setCompatibilidad(null)} className="dark:border-blue-eske-20 dark:text-blue-eske-20">Editar y reintentar</PillButton>
            <PillButton onClick={onCancel} className="dark:border-blue-eske-20 dark:text-blue-eske-20">Cancelar</PillButton>
          </div>
        </div>
      )}

      {compatibilidad && compatibilidad.pertinencia.cumple && (
        <div className="space-y-2 rounded-md border border-gray-eske-20 dark:border-white/10 p-2">
          <p className="text-xs lg:text-sm text-black-eske-80 dark:text-[#9AAEBE]">{compatibilidad.pertinencia.detalle}</p>
          {compatibilidad.pertinencia.territorioRequiereConfirmacion && (
            <label className="flex items-start gap-2 text-xs lg:text-sm text-yellow-eske-70">
              <input type="checkbox" checked={confirmarTerritorio} onChange={(e) => setConfirmarTerritorio(e.target.checked)} className="mt-0.5" />
              <span>{compatibilidad.pertinencia.territorioDetalle} Confirmo que es el mismo territorio pese a la diferencia.</span>
            </label>
          )}
          {!compatibilidad.vigencia.cumple && (
            <label className="flex items-start gap-2 text-xs lg:text-sm text-yellow-eske-70">
              <input type="checkbox" checked={confirmarVigencia} onChange={(e) => setConfirmarVigencia(e.target.checked)} className="mt-0.5" />
              <span>{compatibilidad.vigencia.detalle} Confirmo que quiero usar este dato pese a la fecha.</span>
            </label>
          )}
          <p className="text-xs lg:text-sm text-black-eske-80 dark:text-[#9AAEBE]">{compatibilidad.compatibilidadMetodologica.detalle}</p>

          <div className="flex gap-2">
            <PillButton variant="solid" onClick={handleVincular} disabled={loading || !puedeVincular}>
              {loading ? (fontanaSesionId ? "Subiendo…" : "Vinculando…") : "Vincular fuente"}
            </PillButton>
            <PillButton onClick={() => setCompatibilidad(null)} disabled={loading} className="dark:border-blue-eske-20 dark:text-blue-eske-20">
              Volver a evaluar
            </PillButton>
            <PillButton onClick={onCancel} disabled={loading} className="dark:border-blue-eske-20 dark:text-blue-eske-20">Cancelar</PillButton>
          </div>
        </div>
      )}
    </div>
  );
}

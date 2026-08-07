// F3Tablero.tsx — contenedor del "Ver tablero": resumen heredado de F2 +
// secciones M1-M4. Con `readOnly`, es el mismo componente usado como
// "Tablero de investigación" congelado en el Estado Lista — no hay un
// segundo componente.
"use client";

import { useState } from "react";
import type {
  PIPItem, IncertidumbreF2, HEIF2, ActorVetoF2, TareaPIP, SintesisF3, VeredictoHEI,
  ProjectType, Territorio,
} from "@/types/moddulo.types";
import F3TareasPIP from "./F3TareasPIP";
import F3ResultadosRecibidos from "./F3ResultadosRecibidos";
import F3Sintesis from "./F3Sintesis";
import F3Veredicto from "./F3Veredicto";
import InfoTooltip from "@/app/components/ui/InfoTooltip";
import { useFocusTrap } from "@/app/hooks/useFocusTrap";
import { useEscapeKey } from "@/app/hooks/useEscapeKey";
import type { PipCambio } from "@/lib/moddulo/pipPropagation";
import PillButton from "@/app/moddulo/components/PillButton";

const URGENCIA_LABEL: Record<string, string> = { alta: "Alta", media: "Media", baja: "Baja" };
const NIVEL_RIESGO_LABEL: Record<string, string> = { rojo: "🔴 Rojo", ambar: "🟡 Ámbar", verde: "🟢 Verde" };

// Copy verbatim de los tooltips M1-M4, dado por el usuario — no parafrasear.
const MOTOR_TOOLTIP: Record<"M1" | "M2" | "M3" | "M4", string> = {
  M1: "Cada tarea corresponde a una pregunta del Plan de Investigación (PIP) heredado de tu Reporte F2. Si alguna aplicación del ecosistema Eskemma contribuye a responderla, aparece primero como \"App\". Cuando la pregunta requiere gestión directa tuya, aparece como \"Acción a realizar\" (carga manual o vinculación de una herramienta externa). Puedes activar o desactivar cada vía de forma independiente desde su propio selector. Una vía desactivada deja de contar para avanzar, pero conserva su progreso y puedes reactivarla cuando quieras.",
  M2: "Aquí llegan los resultados de cada tarea. Revísalos y apruébalos antes de que formen parte de la síntesis. Ningún resultado se usa sin tu aprobación explícita.",
  M3: "Una vez que las preguntas principales tengan respuesta, aquí se resume qué confirman, qué contradicen entre sí, y qué preguntas quedaron sin resolver. También muestra un primer acercamiento a tu FODA frente al entorno y el FODA de tus adversarios.",
  M4: "Con la síntesis lista, aquí se evalúa si tu Hipótesis Estratégica Inicial (HEI) se confirma, se ajusta o se descarta con la evidencia recabada. Este es el cierre de la fase de investigación.",
};

function InfoListModal({ title, onClose, children }: { title: string; onClose: () => void; children: React.ReactNode }) {
  const modalRef = useFocusTrap(true);
  useEscapeKey(true, onClose);

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black-eske/50">
      <div
        ref={modalRef as React.RefObject<HTMLDivElement>}
        role="dialog"
        aria-modal="true"
        aria-labelledby="f3-info-modal-title"
        className="bg-white-eske dark:bg-[#18324A] rounded-2xl shadow-2xl w-full max-w-lg max-h-[80vh] flex flex-col"
      >
        <div className="shrink-0 flex items-center justify-between px-5 py-3 border-b border-gray-eske-20 dark:border-white/10">
          <h2 id="f3-info-modal-title" className="font-bold text-sm text-black-eske dark:text-[#EAF2F8]">{title}</h2>
          <button onClick={onClose} className="p-1.5 rounded-lg hover:bg-gray-eske-10 dark:hover:bg-white/10 transition-colors" aria-label="Cerrar">
            <svg className="w-5 h-5 text-gray-eske-60 dark:text-[#9AAEBE]" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>
        <div className="flex-1 overflow-y-auto px-5 py-4 space-y-3">
          {children}
        </div>
      </div>
    </div>
  );
}

interface ResultadoDoc {
  resultadoId: string;
  moduloPIP: string;
  origen: { sourceKind: string; componente: string; fechaEntrega: string };
  cobertura: { completa: boolean; detalle?: string };
  aprobado?: boolean;
  notasUsuario?: string;
}

interface Props {
  projectId: string;
  projectType: ProjectType;
  projectTerritory: Territorio | null;
  pip: PIPItem[];
  incertidumbres: IncertidumbreF2[];
  hei: HEIF2 | undefined;
  semaforo: ActorVetoF2[];
  tareas: TareaPIP[];
  resultados: ResultadoDoc[];
  sintesis: SintesisF3 | undefined;
  veredicto: VeredictoHEI | undefined;
  readOnly?: boolean;
  onGenerarTareas: (confirmar?: boolean) => Promise<void>;
  conflictoRegenerar: {
    mensaje: string;
    resumen: { conResultadoAprobado: number; desactivadas: number; tareasAfectadas: { numero: number; pregunta: string; motivos: string[] }[] };
  } | null;
  onCancelarConflicto: () => void;
  pipStaleChanges: PipCambio[];
  sincronizandoPip: boolean;
  onSincronizarTablero: () => Promise<void>;
  onRefresh: () => void;
  onGenerarSintesis: () => Promise<void>;
  onGenerarVeredicto: () => Promise<void>;
  onAprobarVeredicto: () => Promise<void>;
  generandoTareas: boolean;
  generandoSintesis: boolean;
  generandoVeredicto: boolean;
  aprobandoVeredicto: boolean;
}

export default function F3Tablero({
  projectId, projectType, projectTerritory, pip, incertidumbres, hei, semaforo,
  tareas, resultados, sintesis, veredicto, readOnly,
  onGenerarTareas, conflictoRegenerar, onCancelarConflicto, pipStaleChanges, sincronizandoPip, onSincronizarTablero,
  onRefresh, onGenerarSintesis, onGenerarVeredicto, onAprobarVeredicto,
  generandoTareas, generandoSintesis, generandoVeredicto, aprobandoVeredicto,
}: Props) {
  const [modalAbierto, setModalAbierto] = useState<"incertidumbres" | "semaforo" | null>(null);
  const incertidumbresF3 = incertidumbres.filter((i) => i.destino === "F3");

  return (
    <div className="flex-1 overflow-y-auto p-3 sm:p-4 space-y-6">
      {/* Propagación PIP(F2)→tablero(F3) — mismo estilo visual que el
          banner de staleness XPCTO en exploracion/page.tsx. Solo tiene
          sentido mostrarlo cuando ya hay tablero generado (readOnly o no):
          si el tablero está vacío, "Generar tablero" ya cubre el PIP
          vigente completo. */}
      {!readOnly && pipStaleChanges.length > 0 && tareas.length > 0 && (
        <div className="shrink-0 bg-yellow-eske-10 dark:bg-yellow-eske-80/10 border border-yellow-eske-30 dark:border-yellow-eske-60/40 rounded-lg p-3">
          <div className="flex items-start justify-between gap-3">
            <div className="min-w-0">
              <p className="text-sm font-medium text-black-eske dark:text-[#EAF2F8] mb-1">
                El PIP cambió desde que se generó el tablero de investigación.
              </p>
              <ul className="text-xs text-black-eske dark:text-[#C7D6E0] space-y-0.5">
                {pipStaleChanges.slice(0, 3).map((c) => (
                  <li key={c.pipItemId}>
                    {c.tipo === "agregada" && <>Pregunta agregada: <span className="font-medium">{c.pregunta}</span></>}
                    {c.tipo === "editada" && <>Pregunta editada: <span className="line-through opacity-60">{c.preguntaAnterior.slice(0, 40)}</span> {" → "}{c.pregunta.slice(0, 40)}</>}
                    {c.tipo === "eliminada" && <>Pregunta eliminada: <span className="line-through opacity-60">{c.preguntaAnterior}</span></>}
                  </li>
                ))}
                {pipStaleChanges.length > 3 && (
                  <li className="opacity-60">+{pipStaleChanges.length - 3} cambios más</li>
                )}
              </ul>
              <p className="text-xs text-black-eske/50 dark:text-[#9AAEBE] mt-1.5">
                Las tareas no afectadas conservan su progreso (asignaciones, resultados aprobados, vías desactivadas). Las preguntas editadas se regeneran desde cero.
              </p>
            </div>
            <PillButton
              variant="solid"
              onClick={onSincronizarTablero}
              disabled={sincronizandoPip}
              className="shrink-0 whitespace-nowrap"
            >
              {sincronizandoPip ? "Sincronizando…" : "Sincronizar tablero ↺"}
            </PillButton>
          </div>
        </div>
      )}

      {/* Resumen heredado de F2 */}
      <section>
        <h2 className="text-xs lg:text-sm font-bold uppercase tracking-widest text-black-eske-80 dark:text-[#9AAEBE] mb-2">
          Heredado de F2
        </h2>
        <div className="text-xs lg:text-sm text-black-eske-80 dark:text-[#C5D8E8] space-y-1">
          <p><strong>Hipótesis Estratégica Inicial (HEI):</strong> {hei?.premisaEstrategica ?? "Sin HEI disponible"}</p>
          <p><strong>PIP:</strong> {pip.length} necesidades de información</p>
          <p className="flex items-center gap-1.5">
            <strong>Incertidumbres (→F3):</strong> {incertidumbresF3.length}
            <button
              type="button"
              onClick={() => setModalAbierto("incertidumbres")}
              aria-label="Ver detalle de incertidumbres"
              className="inline-flex items-center justify-center w-4 h-4 rounded-full text-[10px] font-bold leading-none bg-bluegreen-eske/10 text-bluegreen-eske hover:bg-bluegreen-eske/20 transition-colors cursor-pointer"
            >
              i
            </button>
          </p>
          <p className="flex items-center gap-1.5">
            <strong>Semáforo de Veto:</strong> {semaforo.length} actores
            <button
              type="button"
              onClick={() => setModalAbierto("semaforo")}
              aria-label="Ver detalle del semáforo de veto"
              className="inline-flex items-center justify-center w-4 h-4 rounded-full text-[10px] font-bold leading-none bg-bluegreen-eske/10 text-bluegreen-eske hover:bg-bluegreen-eske/20 transition-colors cursor-pointer"
            >
              i
            </button>
          </p>
        </div>
      </section>

      {/* M1 */}
      <section>
        <h2 className="text-xs lg:text-sm font-bold uppercase tracking-widest text-bluegreen-eske mb-2 flex items-center gap-1.5">
          M1 · Tablero de tareas
          <InfoTooltip content={MOTOR_TOOLTIP.M1} />
        </h2>
        <F3TareasPIP
          projectId={projectId}
          pip={pip}
          tareas={tareas}
          projectType={projectType}
          projectTerritory={projectTerritory}
          readOnly={readOnly}
          onGenerar={onGenerarTareas}
          conflictoRegenerar={conflictoRegenerar}
          onCancelarConflicto={onCancelarConflicto}
          onRefresh={onRefresh}
          generando={generandoTareas}
        />
      </section>

      {/* M2 */}
      <section>
        <h2 className="text-xs lg:text-sm font-bold uppercase tracking-widest text-bluegreen-eske mb-2 flex items-center gap-1.5">
          M2 · Resultados recibidos
          <InfoTooltip content={MOTOR_TOOLTIP.M2} />
        </h2>
        <F3ResultadosRecibidos
          resultados={resultados}
          tareas={tareas}
          pip={pip}
          projectId={projectId}
          readOnly={readOnly}
          onAprobado={onRefresh}
        />
      </section>

      {/* M3 */}
      <section>
        <h2 className="text-xs lg:text-sm font-bold uppercase tracking-widest text-bluegreen-eske mb-2 flex items-center gap-1.5">
          M3 · Síntesis de hallazgos
          <InfoTooltip content={MOTOR_TOOLTIP.M3} />
        </h2>
        <F3Sintesis
          sintesis={sintesis}
          actoresVeto={semaforo}
          readOnly={readOnly}
          onGenerar={onGenerarSintesis}
          generando={generandoSintesis}
          puedeGenerar={resultados.some((r) => r.aprobado)}
        />
      </section>

      {/* M4 */}
      <section>
        <h2 className="text-xs lg:text-sm font-bold uppercase tracking-widest text-bluegreen-eske mb-2 flex items-center gap-1.5">
          M4 · Veredicto HEI
          <InfoTooltip content={MOTOR_TOOLTIP.M4} />
        </h2>
        <F3Veredicto
          veredicto={veredicto}
          tareas={tareas}
          readOnly={readOnly}
          onGenerar={onGenerarVeredicto}
          onAprobar={onAprobarVeredicto}
          generando={generandoVeredicto}
          aprobando={aprobandoVeredicto}
        />
      </section>

      {modalAbierto === "incertidumbres" && (
        <InfoListModal title="Incertidumbres heredadas de F2" onClose={() => setModalAbierto(null)}>
          {incertidumbresF3.length === 0 ? (
            <p className="text-xs lg:text-sm text-black-eske-80 dark:text-[#9AAEBE]">Sin incertidumbres registradas.</p>
          ) : incertidumbresF3.map((inc, i) => (
            <div key={i} className="rounded-lg border border-gray-eske-20 dark:border-white/10 p-2.5">
              <p className="text-xs lg:text-sm text-black-eske dark:text-[#EAF2F8]">{i + 1}. {inc.descripcion}</p>
              <p className="text-[11px] lg:text-xs text-black-eske-80 dark:text-[#9AAEBE] mt-1">
                Urgencia: {URGENCIA_LABEL[inc.urgencia] ?? inc.urgencia} · Resolución: {URGENCIA_LABEL[inc.resolucion] ?? inc.resolucion}
              </p>
            </div>
          ))}
        </InfoListModal>
      )}

      {modalAbierto === "semaforo" && (
        <InfoListModal title="Semáforo de Riesgo de Veto" onClose={() => setModalAbierto(null)}>
          {semaforo.length === 0 ? (
            <p className="text-xs lg:text-sm text-black-eske-80 dark:text-[#9AAEBE]">Sin actores registrados.</p>
          ) : semaforo.map((a, i) => (
            <div key={i} className="rounded-lg border border-gray-eske-20 dark:border-white/10 p-2.5">
              <p className="text-xs lg:text-sm font-semibold text-black-eske dark:text-[#EAF2F8]">
                {a.nombre} ({a.tipo}) — {NIVEL_RIESGO_LABEL[a.nivelRiesgo] ?? a.nivelRiesgo}
              </p>
              <p className="text-[11px] lg:text-xs text-black-eske-80 dark:text-[#9AAEBE] mt-1">{a.motivacion}</p>
            </div>
          ))}
        </InfoListModal>
      )}
    </div>
  );
}

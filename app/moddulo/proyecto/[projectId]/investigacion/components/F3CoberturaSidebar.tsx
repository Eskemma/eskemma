// F3CoberturaSidebar.tsx — semáforo de cobertura por módulo del PIP, en
// tiempo real. El botón de RDA ya vive en PhaseNav (sidebar izquierdo,
// siempre visible) — no se duplica aquí.
"use client";

import Link from "next/link";
import type { TareaPIP, SintesisF3, PIPItem, AsignacionCanal } from "@/types/moddulo.types";
import { tareaCubierta } from "@/lib/moddulo/f3Suficiencia";
import { asignacionNombreCorto, asignacionPrefijoCorto } from "@/lib/moddulo/asignacionLabel";

// Solo T10 (Fontana) tiene una ruta real de navegación en este incremento
// — mismo patrón que F3TareasPIP.tsx (Paso 5, Fontana). "/ecosistema/{id}"
// no existe en el proyecto; no se usa como fallback genérico. `estadoApp`
// ya llega recalculado en vivo desde getProject() (lib/moddulo/project.ts),
// nunca es un valor congelado del momento de generación del tablero.
function asignacionHref(a: AsignacionCanal, projectId: string, tareaNumero: number): string | undefined {
  if (a.canal !== "canal1" || a.tecnicaId !== "T10" || a.estadoApp !== "disponible") return undefined;
  return `/centinela/fontana?moddulo_project_id=${projectId}&tarea_pip=${tareaNumero}`;
}

// Mismo esquema de 3 colores que ESTADO_COLORS en F3TareasPIP.tsx: naranja
// (pendiente), amarillo (en curso), verde (recibido/derivado/cubierta).
const ESTADO_DOT: Record<AsignacionCanal["estado"], string> = {
  pendiente: "bg-orange-eske",
  en_curso: "bg-yellow-eske",
  recibido: "bg-green-eske",
  derivado: "bg-green-eske",
};

function semaforo(t: TareaPIP, sintesis: SintesisF3 | undefined): { icon: string; label: string } {
  if (tareaCubierta(t)) return { icon: "🟢", label: "Cubierta" };
  const asignaciones = t.asignaciones ?? [];
  const activaEnCurso = asignaciones.some((a) => a.activada && a.estado === "en_curso");
  if (activaEnCurso) return { icon: "🟡", label: "En curso" };
  return { icon: "🟠", label: "Pendiente" };
}

export default function F3CoberturaSidebar({ pip, tareas, sintesis, projectId }: {
  pip: PIPItem[];
  tareas: TareaPIP[];
  sintesis: SintesisF3 | undefined;
  projectId: string;
}) {
  return (
    <div className="flex-1 min-h-0 overflow-y-auto p-3 space-y-2">
      <p className="text-xs lg:text-sm font-bold uppercase tracking-widest text-black-eske-80 dark:text-[#9AAEBE]">
        Cobertura del PIP
      </p>
      {tareas.length === 0 ? (
        <p className="text-xs lg:text-sm text-black-eske-80 dark:text-[#9AAEBE]">Sin tablero generado todavía.</p>
      ) : (
        <ul className="space-y-2">
          {tareas.map((t) => {
            const item = pip.find((p) => p.numero === t.numero);
            const s = semaforo(t, sintesis);
            return (
              <li key={t.numero} className="rounded-lg border border-gray-eske-20 dark:border-white/10 p-2.5 bg-white-eske dark:bg-[#18324A]">
                <div className="flex items-start gap-2 text-xs lg:text-sm">
                  <span aria-hidden="true">{s.icon}</span>
                  <span className="min-w-0 flex-1">
                    <span className="block text-bluegreen-eske dark:text-bluegreen-eske-20 font-semibold">P{t.numero} {item?.pregunta ?? ""}</span>
                    <span className="text-black-eske-80 dark:text-[#9AAEBE]">Estado: {s.label}</span>
                    <span className="block mt-0.5 space-y-0.5">
                      {(t.asignaciones ?? []).map((a) => {
                        const nombre = asignacionNombreCorto(a);
                        const href = asignacionHref(a, projectId, t.numero);
                        const prefijo = asignacionPrefijoCorto(a);
                        // Desactivada: burbuja y texto en gris neutro, sin
                        // mostrar la palabra de estado real aunque exista
                        // internamente — solo el sufijo Activada/Desactivada.
                        const colorTexto = a.activada ? "text-black-eske-80 dark:text-[#9AAEBE]" : "text-gray-eske-50 dark:text-[#6D8294]";
                        const colorDot = a.activada ? ESTADO_DOT[a.estado] : "bg-gray-eske-40";
                        return (
                          <span key={a.asignacionId} className={`flex items-center gap-1.5 ${colorTexto}`}>
                            <span className={`inline-block w-2 h-2 rounded-full shrink-0 ${colorDot}`} aria-hidden="true" />
                            <span>
                              {prefijo} {href ? <Link href={href} className="text-bluegreen-eske dark:text-bluegreen-eske-20 hover:underline">{nombre}</Link> : nombre}
                              {" — "}{a.activada ? "Activada" : "Desactivada"}
                            </span>
                          </span>
                        );
                      })}
                    </span>
                  </span>
                </div>
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}

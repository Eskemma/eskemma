// app/api/moddulo/projects/[projectId]/complete-phase/route.ts
import { NextRequest, NextResponse } from "next/server";
import { getSessionFromRequest } from "@/lib/server/auth-helpers";
import { adminDb } from "@/lib/firebase-admin";
import { FieldValue } from "firebase-admin/firestore";
import { getProject, normalizarProyectoLeido } from "@/lib/moddulo/project";
import { PHASE_ORDER } from "@/types/moddulo.types";
import type { ModduloProject, PhaseId } from "@/types/moddulo.types";
import { planRDAUpdate } from "@/lib/moddulo/rda";
import { analizarM1, proyectoConMapaParaCriterios, type ExploracionParaM1 } from "@/lib/moddulo/m1Servidor";
import { motivoNoCerrarF2 } from "@/lib/moddulo/pantallaM1";
import { aplicarVersion, prepararVersion } from "@/lib/versionado";
import {
  AMBITO_CIERRE, MOTIVO_CIERRE, detalleCierre, estadoAbierto, estadoCierre, nombreCierre, punteroFase, vivoCierre, type FaseCruda,
} from "@/lib/moddulo/versionado/artefactosCierre";
import { respuestaDeErrorHistorial } from "@/lib/moddulo/versionado/respuestaHistorial";

interface CompletePhaseBody {
  phaseId: PhaseId;
  reportText?: string; // markdown generado por Claude
}

/**
 * Reconciliación del RDA (acumulativo, barre TODAS las fases con evaluador) sobre la vista del documento releído.
 * Devuelve las claves a escribir (`rda.<id>…`) y cuántos ítems nuevos y resueltos trae el plan. Pura salvo por los
 * marcadores de servidor; sin lecturas: es el mismo documento que la transacción ya leyó.
 */
function reconciliarRDA(vista: ModduloProject): { updates: Record<string, unknown>; nuevos: number; resueltos: number } {
  const plan = planRDAUpdate(proyectoConMapaParaCriterios(vista));
  const updates: Record<string, unknown> = {};
  for (const item of plan.nuevos) {
    updates[`rda.${item.id}`] = { ...item, fechaCreacion: FieldValue.serverTimestamp() };
  }
  for (const id of plan.resueltos) {
    updates[`rda.${id}.estado`] = "resuelto";
    updates[`rda.${id}.fechaResolucion`] = FieldValue.serverTimestamp();
    updates[`rda.${id}.resueltoPor`] = "sistema";
  }
  return { updates, nuevos: plan.nuevos.length, resueltos: plan.resueltos.length };
}

type ResultadoCierre =
  | { t: "no_encontrado" }
  | { t: "ya_cerrada"; nuevos: number; resueltos: number }
  | { t: "bloqueado"; motivo: string }
  | { t: "ok" };

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ projectId: string }> }
) {
  try {
    const session = await getSessionFromRequest(request);
    if (!session) return NextResponse.json({ error: "No autorizado" }, { status: 401 });

    const { projectId } = await params;
    const body: CompletePhaseBody = await request.json();
    const { phaseId, reportText } = body;

    if (!phaseId || !PHASE_ORDER.includes(phaseId)) {
      return NextResponse.json({ error: "phaseId inválido" }, { status: 400 });
    }

    // `getProject` solo sirve de ACCESO y de ROL (colaborador no analista/cliente). Todo lo que depende del estado del
    // proyecto se decide DENTRO de la transacción, sobre el documento releído (C1b-3a, H-V20): antes la decisión, el
    // plan de RDA y las escrituras salían de la lectura previa y una reapertura o edición entre ambas dejaba cerrar la
    // Fase 2 con un M1 sin aprobar.
    const project = await getProject(projectId, session.uid);
    if (!project) return NextResponse.json({ error: "Proyecto no encontrado" }, { status: 404 });

    const collaborator = project.collaborators.find((c) => c.uid === session.uid);
    if (!collaborator || collaborator.role === "analyst" || collaborator.role === "client") {
      return NextResponse.json({ error: "Sin permisos" }, { status: 403 });
    }

    const phaseIndex = PHASE_ORDER.indexOf(phaseId);
    const nextPhase = PHASE_ORDER[phaseIndex + 1] ?? phaseId;
    const ref = adminDb.collection("moddulo_projects").doc(projectId);

    // El callback puede reintentarse: lee primero, no tiene efectos externos, devuelve un resultado y la respuesta
    // HTTP se arma fuera. Una sola transacción escribe el cierre, el RDA y, si es la 9.ª fase, el estado del proyecto
    // (H-V22: antes un `update` aparte tras la transacción).
    let resultado: ResultadoCierre;
    try {
    resultado = await adminDb.runTransaction(async (tx): Promise<ResultadoCierre> => {
      const snap = await tx.get(ref);
      if (!snap.exists || snap.data()?.deletedAt) return { t: "no_encontrado" };
      const crudo = snap.data() as ModduloProject;

      // Idempotente en TODAS las fases (H-V21): una fase ya cerrada no se vuelve a cerrar (no se reescriben
      // `completedAt`, `currentPhase`, el RDA ni el texto del reporte). Lo único que un reintento puede completar es
      // `data.aprobadoEn` de la Fase 2 (se escribe en la misma transacción del cierre; solo puede faltar en proyectos
      // cerrados antes de eso), y solo si falta. Presente = cero escrituras.
      if (crudo.phases?.[phaseId]?.status === "completed") {
        const actualizaciones: Record<string, unknown> = {};
        if (phaseId === "exploracion") {
          const exp = crudo.phases.exploracion;
          if (!exp?.data?.aprobadoEn) {
            actualizaciones["phases.exploracion.data.aprobadoEn"] = exp?.completedAt ?? new Date().toISOString();
          }
        }
        // Reconciliación del RDA (C1b-3a, decisión de Raúl): `complete-phase` es el ÚNICO llamador de `planRDAUpdate`,
        // así que re-cerrar una fase tras editarla (p. ej. «Editar variables» de la Fase 1) era la única forma de
        // refrescar el RDA. La rama «ya cerrada» NO toca `completedAt`, `currentPhase`, `reportText`,
        // `fasesCompletadas` ni `faseActual`, pero sí reconcilia el RDA sobre el documento releído y escribe SOLO si
        // el plan trae ítems nuevos o resueltos (sin cambios en el plan: cero escrituras). Aplica a las 9 fases.
        const vistaCerrada = normalizarProyectoLeido(snap.id, crudo);
        const rdaCerrada = reconciliarRDA(vistaCerrada);
        const hayCambiosRDA = rdaCerrada.nuevos + rdaCerrada.resueltos > 0;
        if (hayCambiosRDA) {
          Object.assign(actualizaciones, rdaCerrada.updates);
          actualizaciones.updatedAt = FieldValue.serverTimestamp();
        }
        if (Object.keys(actualizaciones).length > 0) tx.update(ref, actualizaciones);
        return { t: "ya_cerrada", nuevos: rdaCerrada.nuevos, resueltos: rdaCerrada.resueltos };
      }

      // Estado actual del proyecto con la misma vista que entrega `getProject` (backfills de lectura).
      const estadoActual = crudo.status;
      const vista = normalizarProyectoLeido(snap.id, crudo);

      // La Fase 2 solo cierra con un Reporte F2 FINALIZADO y, si el proyecto tiene un `m1` bajo revisión, con ese M1
      // APROBADO y el Reporte F2 generado de él. Un proyecto sin `m1` (anterior a la revisión) o sin payload no
      // necesita una aprobación que nunca podrá tener: solo su Reporte F2.
      if (phaseId === "exploracion") {
        const exploracion = vista.phases?.exploracion as ExploracionParaM1 | undefined;
        const a = analizarM1(exploracion);
        const estado = a.m1 ? a.estado.estado : a.payload ? "anterior" : "sin_m1";
        const motivo = motivoNoCerrarF2({
          estado,
          hayDvs: !!exploracion?.dvs,
          motoresSinGenerar: a.estado.motoresSinGenerar,
          // El Reporte F2 debe salir de ESTA aprobación (sello de finalización o la regla de compatibilidad).
          dvsDeOtroAnalisis: a.estado.dvsDeOtroAnalisis,
        });
        if (motivo) return { t: "bloqueado", motivo };
      }

      // UN solo instante por operación (H-V25): `completedAt` del vivo y `aprobacion.en` de la versión salen de aquí.
      const ahora = new Date().toISOString();
      const updates: Record<string, unknown> = {
        [`phases.${phaseId}.status`]: "completed",
        [`phases.${phaseId}.completedAt`]: ahora,
        currentPhase: nextPhase,
        updatedAt: FieldValue.serverTimestamp(),
      };

      // Fase 2: la fecha de aprobación va en la misma escritura del cierre (por clave: pestl/semaforo/hipotesis quedan).
      if (phaseId === "exploracion") {
        updates["phases.exploracion.data.aprobadoEn"] = ahora;
      }

      if (reportText) {
        updates[`phases.${phaseId}.reportText`] = reportText;
      }

      if (phaseId === "proposito") {
        updates.fasesCompletadas = FieldValue.arrayUnion(1);
        updates.faseActual = 2;
      }

      // RDA — ítems nuevos + reconciliación automática barriendo todas las fases con evaluador (no solo la que se
      // cierra). Evaluado server-side contra el documento releído DENTRO de la transacción (sin lecturas extra:
      // es el mismo documento): nada calculado por el cliente.
      const rda = reconciliarRDA(vista);
      Object.assign(updates, rda.updates);

      // Cierre automático del proyecto cuando las 9 fases quedan completas (H-V22: en esta MISMA escritura).
      const fasesCerradas = PHASE_ORDER.every((p) => (p === phaseId ? true : vista.phases?.[p]?.status === "completed"));
      if (fasesCerradas && estadoActual !== "completed") {
        updates.status = "completed";
      }

      // C1b-3b — historial: el cierre deja una versión de `cierre:{fase}` en la MISMA transacción (previa «abierta» con
      // el borrador de `reportText` que se pisa, siempre que el artefacto aún no esté en el manifiesto vigente; el
      // núcleo lo decide). Todas las lecturas (proyecto, manifiesto) van antes de la primera escritura.
      const faseAntes = crudo.phases?.[phaseId] as unknown as FaseCruda | undefined;
      const faseDespues: FaseCruda = {
        ...faseAntes,
        status: "completed",
        completedAt: ahora,
        ...(reportText ? { reportText } : {}),
        ...(phaseId === "exploracion" ? { data: { ...(faseAntes?.data ?? {}), aprobadoEn: ahora } } : {}),
      };
      const previoTexto = typeof faseAntes?.reportText === "string" && faseAntes.reportText.length > 0 ? faseAntes.reportText : null;
      const plan = await prepararVersion(tx, {
        raiz: ref,
        datosRaiz: crudo as unknown as Record<string, unknown>,
        punteroCampo: punteroFase(phaseId),
        ambito: AMBITO_CIERRE,
        fase: phaseId,
        tipoCambio: "ajuste_manual",
        por: session.uid,
        fuente: "usuario",
        motivo: MOTIVO_CIERRE,
        cierre: { por: session.uid },
        detalle: detalleCierre({
          reporteNuevo: !!reportText,
          reporteSustituido: !!reportText && previoTexto !== null && previoTexto !== reportText,
          rdaNuevos: rda.nuevos,
          rdaResueltos: rda.resueltos,
          proyectoCompletado: updates.status === "completed",
        }),
        artefactos: [
          {
            artefacto: nombreCierre(phaseId),
            ...estadoCierre(phaseId, faseDespues, { por: session.uid, en: ahora }),
            vivo: vivoCierre(phaseId, faseDespues),
            estadoPrevio: estadoAbierto(phaseId, faseAntes),
            vivoPrevio: vivoCierre(phaseId, faseAntes),
          },
        ],
      });
      Object.assign(updates, aplicarVersion(tx, plan).updatesRaiz);

      tx.update(ref, updates);
      return { t: "ok" };
    });
    } catch (err) {
      const respuesta = respuestaDeErrorHistorial(err, { projectId, fase: phaseId, ruta: "complete-phase" });
      if (respuesta) return respuesta;
      throw err;
    }

    if (resultado.t === "no_encontrado") return NextResponse.json({ error: "Proyecto no encontrado" }, { status: 404 });
    if (resultado.t === "bloqueado") return NextResponse.json({ error: resultado.motivo }, { status: 409 });
    if (resultado.t === "ya_cerrada") {
      // `rda` solo aparece cuando la reconciliación aplicó ítems (ausente = ninguno): la respuesta sin cambios es la de siempre.
      const hayRDA = resultado.nuevos + resultado.resueltos > 0;
      return NextResponse.json({
        success: true,
        yaCerrada: true,
        nextPhase,
        ...(hayRDA ? { rda: { nuevos: resultado.nuevos, resueltos: resultado.resueltos } } : {}),
      });
    }
    return NextResponse.json({ success: true, nextPhase });
  } catch (error) {
    console.error("[complete-phase] Error:", error);
    return NextResponse.json({ error: "Error al completar la fase" }, { status: 500 });
  }
}

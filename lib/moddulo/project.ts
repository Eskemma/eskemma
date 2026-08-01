// lib/moddulo/project.ts
import { adminDb } from "@/lib/firebase-admin";
import { FieldValue } from "firebase-admin/firestore";
import type {
  ModduloProject,
  CreateProjectInput,
  UpdateProjectInput,
  PhaseId,
  PhaseState,
  PhaseStatus,
  XPCTO,
  LinkedSourceRef,
  TareaPIP,
  AsignacionCanal,
} from "@/types/moddulo.types";
import { PHASE_ORDER } from "@/types/moddulo.types";
import { APP_TO_F3_CONTRACTS } from "@/types/f3.types";
import type { TecnicaId } from "@/types/shared.types";

const COLLECTION = "moddulo_projects";

// estadoApp de una asignación canal1 se calculó una sola vez, al generar
// el tablero (tareas/generar/route.ts), contra el APP_TO_F3_CONTRACTS
// vigente EN ESE MOMENTO — y quedó persistido en Firestore. Como
// APP_TO_F3_CONTRACTS crece con el tiempo (cada app nueva que completa su
// desarrollo), un tablero generado antes de que una técnica se agregue
// queda con estadoApp: "proximamente" para siempre si se confía en el
// valor guardado. Se recalcula aquí, en cada lectura, contra el registro
// ACTUAL — mismo criterio que el resto de esta función (nunca fabricar un
// valor con significado, pero tampoco confiar en un snapshot congelado
// cuando la fuente de verdad puede haber cambiado desde entonces). Bug
// real detectado en producción con Fontana (T10) — primera app en poblar
// APP_TO_F3_CONTRACTS después de que existieran tableros ya generados;
// aplica igual a cualquiera de las 34 técnicas restantes del catálogo.
function recalcularEstadoApp(a: AsignacionCanal): AsignacionCanal {
  if (a.canal !== "canal1" || !a.tecnicaId) return a;
  const estadoApp = APP_TO_F3_CONTRACTS[a.tecnicaId as TecnicaId] ? "disponible" : "proximamente";
  return { ...a, estadoApp };
}

// Forma de TareaPIP anterior al rediseño de multi-asignación (un solo canal
// por tarea, campos planos en vez de asignaciones[]). Proyectos reales
// creados antes de ese cambio siguen así en Firestore — normalizeTareaPIP
// los reacomoda al leer, sin fabricar datos: reconstruye una única
// asignación primaria a partir de los campos planos que sí existen.
interface LegacyTareaPIP {
  numero: number;
  canalAsignado?: "canal1" | "canal2" | "canal3";
  tecnicaId?: string;
  estado?: "pendiente" | "en_curso" | "recibido" | "derivado";
  justificacion?: string;
  resultadoId?: string;
  asignaciones?: TareaPIP["asignaciones"];
}

function normalizeTareaPIP(t: LegacyTareaPIP): TareaPIP {
  if (Array.isArray(t.asignaciones)) {
    // Defensivo: asignaciones de antes de la Ronda 5 (activar/desactivar
    // por asignación) no traen el campo `activada` — se normaliza a `true`
    // (mismo criterio que el resto de este archivo: nunca fabricar un
    // valor con significado, solo el default seguro).
    return {
      numero: t.numero,
      asignaciones: t.asignaciones.map((a) => recalcularEstadoApp({ ...a, activada: a.activada ?? true })),
    };
  }
  return {
    numero: t.numero,
    asignaciones: [
      recalcularEstadoApp({
        asignacionId: `${t.numero}-0`,
        tipo: "primaria",
        canal: t.canalAsignado ?? "canal2",
        ...(t.tecnicaId ? { tecnicaId: t.tecnicaId as TareaPIP["asignaciones"][number]["tecnicaId"] } : {}),
        justificacion: t.justificacion ?? "",
        estado: t.estado ?? "pendiente",
        ...(t.resultadoId ? { resultadoId: t.resultadoId } : {}),
        activada: true,
      }),
    ],
  };
}

// ==========================================
// ESTADO INICIAL DE UNA FASE
// ==========================================

function emptyPhaseState(): PhaseState {
  return {
    status: "not-started",
    data: {},
    chatHistory: [],
  };
}

function initialPhases(): Record<PhaseId, PhaseState> {
  return PHASE_ORDER.reduce(
    (acc, phaseId) => ({ ...acc, [phaseId]: emptyPhaseState() }),
    {} as Record<PhaseId, PhaseState>
  );
}

function emptyXPCTO(): XPCTO {
  return {
    hito: "",
    sujeto: "",
    capacidades: { financiero: "", humano: "", logistico: "" },
    tiempo: { fechaLimite: "", duracionMeses: 0 },
    justificacion: "",
  };
}

// ==========================================
// CREAR PROYECTO
// ==========================================

export async function createProject(
  userId: string,
  input: CreateProjectInput
): Promise<ModduloProject> {
  const now = FieldValue.serverTimestamp();
  const nowDate = new Date().toISOString(); // Para campos dentro de arrays

  const data: Record<string, unknown> = {
    userId,
    type: input.type,
    name: input.name,
    description: input.description ?? "",
    xpcto: { ...emptyXPCTO(), ...input.xpcto },
    currentPhase: "proposito" as PhaseId,
    phases: initialPhases(),
    collaborators: [
      {
        uid: userId,
        email: "",
        role: "owner",
        addedAt: nowDate, // FieldValue no permitido dentro de arrays
        addedBy: userId,
      },
    ],
    status: "draft",
    settings: {
      aiLevel: "balanced",
      language: "es",
    },
    createdAt: now,
    updatedAt: now,
    lastAccessedAt: now,
  };

  data.color = input.color ?? "#026988";

  if (input.territorio) {
    data.territorio = input.territorio;
  }

  if (input.pestelProjectId) {
    data.pestelProjectId = input.pestelProjectId;
    const linkedSource: LinkedSourceRef = {
      kind: "T22",
      componente: "centinela",
      sourceId: input.pestelProjectId,
      ...(input.pestAnalysisId ? { sourceAnalysisId: input.pestAnalysisId } : {}),
    };
    (data.phases as Record<string, unknown>).exploracion = {
      ...((data.phases as Record<string, Record<string, unknown>>).exploracion ?? emptyPhaseState()),
      linkedSource,
    };
  }

  const ref = await adminDb.collection(COLLECTION).add(data);

  if (input.pestelProjectId) {
    try {
      await adminDb
        .collection("pestel_projects")
        .doc(input.pestelProjectId)
        .update({
          modduloProjectId: ref.id,
          updatedAt: FieldValue.serverTimestamp(),
        });
    } catch (err) {
      console.error(
        `[createProject] write-back a pestel_projects/${input.pestelProjectId} falló:`,
        err
      );
    }
  }

  const snap = await ref.get();
  return { id: ref.id, ...snap.data() } as ModduloProject;
}

// ==========================================
// OBTENER PROYECTO (con control de acceso)
// ==========================================

export async function getProject(
  projectId: string,
  userId: string
): Promise<ModduloProject | null> {
  const snap = await adminDb.collection(COLLECTION).doc(projectId).get();
  if (!snap.exists) return null;

  const data = snap.data() as ModduloProject;

  // Verificar que el usuario tiene acceso
  const isCollaborator = data.collaborators?.some((c) => c.uid === userId);
  if (!isCollaborator) return null;

  // Actualizar lastAccessedAt
  await snap.ref.update({ lastAccessedAt: FieldValue.serverTimestamp() });

  const { id: _id, ...rest } = data as ModduloProject & { id?: string };

  // Normaliza f3TareasPIP heredado del esquema anterior (un canal por
  // tarea) al esquema actual (asignaciones[]) — proyectos reales creados
  // antes del rediseño de F3 siguen con el formato viejo en Firestore.
  const f3Tareas = rest.phases?.investigacion?.f3TareasPIP as unknown as LegacyTareaPIP[] | undefined;
  if (Array.isArray(f3Tareas)) {
    rest.phases.investigacion.f3TareasPIP = f3Tareas.map(normalizeTareaPIP);
  }

  return { id: snap.id, ...rest };
}

// ==========================================
// LISTAR PROYECTOS DEL USUARIO
// ==========================================

export async function listUserProjects(
  userId: string,
  options?: { status?: ModduloProject["status"]; limit?: number }
): Promise<ModduloProject[]> {
  let query = adminDb
    .collection(COLLECTION)
    .where("collaborators", "array-contains-any", [{ uid: userId }]);

  // Firestore no soporta filtro directo en array de objetos para campo anidado,
  // usamos userId como campo directo también
  query = adminDb
    .collection(COLLECTION)
    .where("userId", "==", userId)
    .orderBy("updatedAt", "desc");

  if (options?.limit) {
    query = query.limit(options.limit) as typeof query;
  }

  const snap = await query.get();
  return snap.docs.map((doc) => ({ id: doc.id, ...doc.data() } as ModduloProject));
}

// ==========================================
// ACTUALIZAR PROYECTO
// ==========================================

export async function updateProject(
  projectId: string,
  userId: string,
  input: UpdateProjectInput
): Promise<void> {
  const project = await getProject(projectId, userId);
  if (!project) throw new Error("Proyecto no encontrado o sin acceso.");

  const collaborator = project.collaborators.find((c) => c.uid === userId);
  if (!collaborator || collaborator.role === "analyst" || collaborator.role === "client") {
    throw new Error("Sin permisos para editar este proyecto.");
  }

  await adminDb.collection(COLLECTION).doc(projectId).update({
    ...input,
    updatedAt: FieldValue.serverTimestamp(),
  });
}

// ==========================================
// ACTUALIZAR DATOS DE UNA FASE
// ==========================================

export async function updatePhaseData(
  projectId: string,
  userId: string,
  phaseId: PhaseId,
  data: Record<string, unknown>,
  status?: PhaseStatus
): Promise<void> {
  const project = await getProject(projectId, userId);
  if (!project) throw new Error("Proyecto no encontrado o sin acceso.");

  const collaborator = project.collaborators.find((c) => c.uid === userId);
  if (!collaborator || collaborator.role === "analyst" || collaborator.role === "client") {
    throw new Error("Sin permisos para editar fases.");
  }

  // Nunca degradar una fase ya "completed" de vuelta a "in-progress" solo
  // porque este guardado de datos no especificó status explícitamente.
  // Bug real detectado (26-07-19): handleClosePhase en F2 llama a
  // complete-phase (marca "completed"), y justo después dispara —sin
  // esperar— un PATCH fire-and-forget de propagación (PIP/incertidumbres
  // hacia F3) que cae aquí sin `status`, sobreescribiendo "completed" de
  // vuelta a "in-progress" segundos después. Esta protección cubre ese
  // call site y CUALQUIER fase futura (F3+) que agregue su propio PATCH
  // de propagación fire-and-forget tras su complete-phase — mismo patrón
  // que F2 ya usa hoy — sin que vuelva a reintroducir este bug.
  const currentStatus = project.phases?.[phaseId]?.status;
  const updates: Record<string, unknown> = {
    [`phases.${phaseId}.data`]: data,
    [`phases.${phaseId}.status`]: status ?? (currentStatus === "completed" ? "completed" : "in-progress"),
    updatedAt: FieldValue.serverTimestamp(),
  };

  await adminDb.collection(COLLECTION).doc(projectId).update(updates);
}

// ==========================================
// GUARDAR BORRADOR DE REPORTE (sin completar la fase)
// ==========================================

export async function savePhaseReportDraft(
  projectId: string,
  userId: string,
  phaseId: PhaseId,
  reportText: string
): Promise<void> {
  const project = await getProject(projectId, userId);
  if (!project) throw new Error("Proyecto no encontrado o sin acceso.");

  const collaborator = project.collaborators.find((c) => c.uid === userId);
  if (!collaborator || collaborator.role === "analyst" || collaborator.role === "client") {
    throw new Error("Sin permisos para editar fases.");
  }

  await adminDb.collection(COLLECTION).doc(projectId).update({
    [`phases.${phaseId}.reportText`]: reportText,
    updatedAt: FieldValue.serverTimestamp(),
  });
}

// ==========================================
// GUARDAR MENSAJE DE CHAT EN UNA FASE
// ==========================================

export async function appendChatMessage(
  projectId: string,
  phaseId: PhaseId,
  message: { id: string; role: "assistant" | "user"; content: string; timestamp: string; extractedData?: Record<string, unknown> }
): Promise<void> {
  await adminDb.collection(COLLECTION).doc(projectId).update({
    [`phases.${phaseId}.chatHistory`]: FieldValue.arrayUnion(message),
    [`phases.${phaseId}.status`]: "in-progress",
    updatedAt: FieldValue.serverTimestamp(),
  });
}

// ==========================================
// COMPLETAR UNA FASE (con reporte)
// ==========================================

export async function completePhase(
  projectId: string,
  userId: string,
  phaseId: PhaseId,
  report: ModduloProject["phases"][PhaseId]["report"]
): Promise<void> {
  const project = await getProject(projectId, userId);
  if (!project) throw new Error("Proyecto no encontrado.");

  const phaseIndex = PHASE_ORDER.indexOf(phaseId);
  const nextPhase = PHASE_ORDER[phaseIndex + 1] ?? phaseId;

  await adminDb.collection(COLLECTION).doc(projectId).update({
    [`phases.${phaseId}.status`]: "completed",
    [`phases.${phaseId}.completedAt`]: new Date().toISOString(),
    [`phases.${phaseId}.report`]: report,
    currentPhase: nextPhase,
    updatedAt: FieldValue.serverTimestamp(),
  });
}

// ==========================================
// CAMBIAR ESTADO DEL PROYECTO
// ==========================================

export async function archiveProject(projectId: string, userId: string): Promise<void> {
  await updateProject(projectId, userId, { status: "archived" });
}

export async function restoreProject(projectId: string, userId: string): Promise<void> {
  await updateProject(projectId, userId, { status: "active" });
}

export async function deleteProject(projectId: string, userId: string): Promise<void> {
  const project = await getProject(projectId, userId);
  if (!project) throw new Error("Proyecto no encontrado.");

  const collaborator = project.collaborators.find((c) => c.uid === userId);
  if (collaborator?.role !== "owner") throw new Error("Solo el dueño puede eliminar el proyecto.");

  // Solo un vínculo real de Centinela (kind "T22") tiene una contraparte en
  // pestel_projects que limpiar — el sourceId de un vínculo "express" es el
  // propio ID del proyecto Moddulo, no un documento de Centinela.
  const explorarLink = project.phases?.["exploracion"]?.linkedSource;
  const pestProjectId = explorarLink?.kind === "T22" ? explorarLink.sourceId : undefined;

  await adminDb.collection(COLLECTION).doc(projectId).delete();

  // Non-fatal cleanup: remove the back-link in Centinela after the Moddulo project is gone.
  // If this fails, OrphanRecoveryView handles the stale link gracefully.
  if (pestProjectId) {
    try {
      await adminDb.collection("pestel_projects").doc(pestProjectId).update({
        modduloProjectId: FieldValue.delete(),
      });
    } catch (err) {
      console.error("[deleteProject] write-back cleanup falló para pestProjectId:", pestProjectId, err);
    }
  }
}

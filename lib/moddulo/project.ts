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
} from "@/types/moddulo.types";
import { PHASE_ORDER } from "@/types/moddulo.types";

const COLLECTION = "moddulo_projects";

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
    (data.phases as Record<string, unknown>).exploracion = {
      ...((data.phases as Record<string, Record<string, unknown>>).exploracion ?? emptyPhaseState()),
      pestProjectId: input.pestelProjectId,
      ...(input.pestAnalysisId ? { pestAnalysisId: input.pestAnalysisId } : {}),
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

  const updates: Record<string, unknown> = {
    [`phases.${phaseId}.data`]: data,
    [`phases.${phaseId}.status`]: status ?? "in-progress",
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

  const pestProjectId = project.phases?.["exploracion"]?.pestProjectId;

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

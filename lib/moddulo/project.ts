// lib/moddulo/project.ts
import { getPestelProjectPropio } from "@/lib/centinela/pestel/projectPropio";
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
  PIPItem,
  VacioResidual,
  ActorVetoF2,
} from "@/types/moddulo.types";
import { PHASE_ORDER } from "@/types/moddulo.types";
import { ProyectoNoEncontradoError, SinPermisosError } from "@/lib/moddulo/projectErrors";
import {
  validarPatchProyecto,
  validarPhaseData,
  validarReportDraft,
} from "@/lib/moddulo/projectPatch";
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
  pipItemId?: string;
  canalAsignado?: "canal1" | "canal2" | "canal3";
  tecnicaId?: string;
  estado?: "pendiente" | "en_curso" | "recibido" | "derivado";
  justificacion?: string;
  resultadoId?: string;
  asignaciones?: TareaPIP["asignaciones"];
}

// Id sintético determinístico para PIPItem/TareaPIP/VacioResidual legados
// que no tienen pipItemId todavía — mismo criterio que el resto de este
// archivo: nunca fabricar un valor con significado nuevo, solo el
// equivalente seguro de lo que ya existía (numero era la única correlación
// disponible antes de este campo). Determinístico y estable entre lecturas
// (no aleatorio) para que dos generaciones/lecturas del mismo documento
// legado sigan correlacionando igual, incluyendo el snapshot de propagación
// PIP→tablero (lib/moddulo/pipPropagation.ts).
function legacyPipItemId(numero: number): string {
  return `legacy-${numero}`;
}

function normalizeTareaPIP(t: LegacyTareaPIP): TareaPIP {
  const pipItemId = t.pipItemId ?? legacyPipItemId(t.numero);
  if (Array.isArray(t.asignaciones)) {
    // Defensivo: asignaciones de antes de la Ronda 5 (activar/desactivar
    // por asignación) no traen el campo `activada` — se normaliza a `true`
    // (mismo criterio que el resto de este archivo: nunca fabricar un
    // valor con significado, solo el default seguro).
    return {
      pipItemId,
      asignaciones: t.asignaciones.map((a) => recalcularEstadoApp({ ...a, activada: a.activada ?? true })),
    };
  }
  return {
    pipItemId,
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

// Backfill de pipItemId en el PIP de F2 — mismo criterio determinístico que
// normalizeTareaPIP. Se hace en lectura, nunca se escribe de vuelta a
// Firestore aquí (igual que el resto de esta normalización).
function normalizePIPItem(p: PIPItem & { pipItemId?: string }): PIPItem {
  return { ...p, pipItemId: p.pipItemId ?? legacyPipItemId(p.numero) };
}

function normalizeVacioResidual(v: VacioResidual & { pipItemId?: string }): VacioResidual {
  // v.numero siempre viene poblado en datos legados (era campo requerido
  // antes de esta migración) — el fallback a 0 es solo para satisfacer el
  // tipo ahora que numero es opcional (adjuntado en lectura de aquí en más).
  return { ...v, pipItemId: v.pipItemId ?? legacyPipItemId(v.numero ?? 0) };
}

// Adjunta `numero` (número de despliegue) a cada TareaPIP/VacioResidual
// según la posición ACTUAL de su pipItemId dentro del PIP vigente — nunca
// se persiste este valor de vuelta a Firestore (ver comentario en
// TareaPIP.numero/VacioResidual.numero, types/moddulo.types.ts). Un
// pipItemId que ya no existe en el PIP vigente (huérfano — no debería
// ocurrir tras pasar por tareas/sincronizar, pero es posible en proyectos
// que aún no se han sincronizado) se deja sin numero en vez de fabricar uno.
export function attachNumero<T extends { pipItemId: string }>(items: T[], pip: PIPItem[]): (T & { numero?: number })[] {
  const posicionPorPipItemId = new Map(pip.map((p, idx) => [p.pipItemId, idx + 1]));
  return items.map((item) => ({ ...item, numero: posicionPorPipItemId.get(item.pipItemId) }));
}

// Backfill de actorId en el Semáforo de Veto — mismo criterio determinístico
// que legacyPipItemId (basado en el único dato que sí existía antes: el
// nombre). Actores legados que se rendericen dos veces con el mismo nombre
// obtienen el mismo id sintético — no es un problema porque solo importa
// para correlacionar con SintesisF3.fodaAdversariosInsumo generado ANTES de
// este campo, cuyas claves ya eran el nombre crudo.
function normalizeActorVeto(a: ActorVetoF2 & { actorId?: string }): ActorVetoF2 {
  return { ...a, actorId: a.actorId ?? `legacy-${a.nombre}` };
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

/**
 * The pestelProjectId does not exist or belongs to another user. Deliberately
 * one error for both cases so the caller (and the client) cannot use it to
 * probe which pestel_projects ids exist.
 */
export class PestelProjectNoPropioError extends Error {
  constructor() {
    super("Proyecto de PESTEL no encontrado");
    this.name = "PestelProjectNoPropioError";
  }
}

// §11.5 del plan de papelera (26-09-29, Punto 1 de la fase c). Sin este
// guard, OrphanRecoveryView -> createProject podía crear un SEGUNDO
// proyecto Moddulo apuntando al mismo pestelProjectId mientras el
// original seguía existiendo (vivo o en papelera) — el back-link de
// PESTEL quedaba apuntando solo al nuevo, y al restaurar el original
// (que conserva su propio linkedSource.sourceId intacto, la papelera no
// toca vínculos) quedaban 2 proyectos reclamando el mismo análisis.
// link-moddulo/route.ts ya bloqueaba este caso del otro lado
// (pestel_already_linked) — createProject era el único camino sin
// protección. Deliberadamente el mismo error/mensaje para "ya vinculado
// a otro Moddulo vivo" y "ya vinculado a otro Moddulo en papelera": a
// quien llama no le sirve distinguir los dos casos, y no revela el
// estado del proyecto ajeno.
export class PestelYaVinculadoError extends Error {
  constructor() {
    super("Este proyecto de PESTEL ya está vinculado a otro proyecto de Moddulo.");
    this.name = "PestelYaVinculadoError";
  }
}

export async function createProject(
  userId: string,
  input: CreateProjectInput
): Promise<ModduloProject> {
  // Ownership guard (26-09-23). pestelProjectId comes from the request body and
  // is used below with the Admin SDK (which ignores firestore.rules) to persist
  // a linkedSource and to write modduloProjectId into pestel_projects/{id}.
  // Without this read, any authenticated user could stamp a foreign PESTEL
  // project. It runs BEFORE anything is built or written, so a foreign id is
  // never persisted in pestelProjectId / linkedSource either.
  if (input.pestelProjectId) {
    const pestelProject = await getPestelProjectPropio(input.pestelProjectId, userId);
    if (!pestelProject) {
      throw new PestelProjectNoPropioError();
    }
    // Doble-vínculo guard (26-09-29): pestelProject ya viene con
    // modduloProjectId en el objeto devuelto por getPestelProjectPropio —
    // ninguna lectura nueva de Firestore del lado PESTEL. Solo se lee
    // moddulo_projects/{existingId} (con o sin deletedAt: un proyecto en
    // papelera SIGUE contando como "ya vinculado" — la papelera no libera
    // el vínculo, solo la purga lo hace) para decidir si bloquear.
    if (pestelProject.modduloProjectId) {
      const existingSnap = await adminDb
        .collection(COLLECTION)
        .doc(pestelProject.modduloProjectId)
        .get();
      if (existingSnap.exists) {
        throw new PestelYaVinculadoError();
      }
    }
  }

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

  // Papelera (26-09-28): un proyecto en papelera NUNCA es visible aquí, para NADIE —
  // ni para el dueño. Esta función es el lector general que usan ~35 puntos del
  // código (rutas de mutación F2/F3, el layout, los enlaces cruzados con PESTEL/
  // Fontana); todos deben comportarse como si el proyecto no existiera. Para ver un
  // proyecto en papelera (solo el dueño, solo para restaurarlo) usar
  // `getProjectPapelera`, nunca esta función.
  if (data.deletedAt) return null;

  // Verificar que el usuario tiene acceso
  const isCollaborator = data.collaborators?.some((c) => c.uid === userId);
  if (!isCollaborator) return null;

  // Actualizar lastAccessedAt
  await snap.ref.update({ lastAccessedAt: FieldValue.serverTimestamp() });

  const { id: _id, ...rest } = data as ModduloProject & { id?: string };

  // Backfill de pipItemId en el PIP de F2 — proyectos creados antes de este
  // campo no lo tienen. Debe ocurrir ANTES de normalizar f3TareasPIP/
  // vaciosResiduales para que ambos lados correlacionen con el mismo
  // esquema sintético determinístico (legacyPipItemId).
  const dvs = rest.phases?.exploracion?.dvs;
  const pip = dvs?.pip as unknown as (PIPItem & { pipItemId?: string })[] | undefined;
  if (dvs && Array.isArray(pip)) {
    dvs.pip = pip.map(normalizePIPItem);
  }
  const pipVigente = (rest.phases?.exploracion?.dvs?.pip ?? []) as PIPItem[];

  // Backfill de actorId en el Semáforo de Veto — mismo momento/criterio que
  // el backfill de pipItemId de arriba.
  const semaforo = dvs?.semaforo as unknown as (ActorVetoF2 & { actorId?: string })[] | undefined;
  if (dvs && Array.isArray(semaforo)) {
    dvs.semaforo = semaforo.map(normalizeActorVeto);
  }

  // Normaliza f3TareasPIP heredado del esquema anterior (un canal por
  // tarea) al esquema actual (asignaciones[]) — proyectos reales creados
  // antes del rediseño de F3 siguen con el formato viejo en Firestore.
  // También adjunta `numero` (nunca persistido) según la posición vigente
  // del pipItemId en el PIP actual — ver attachNumero().
  const f3Tareas = rest.phases?.investigacion?.f3TareasPIP as unknown as LegacyTareaPIP[] | undefined;
  if (Array.isArray(f3Tareas)) {
    rest.phases.investigacion.f3TareasPIP = attachNumero(f3Tareas.map(normalizeTareaPIP), pipVigente);
  }

  // Mismo backfill + adjunto de numero para los vacíos residuales de la
  // síntesis (M3) — alimentan el id del RDA (lib/moddulo/criterios-investigacion.ts)
  // y deben sobrevivir a una reindexación del PIP igual que f3TareasPIP.
  const vacios = rest.phases?.investigacion?.f3Sintesis?.vaciosResiduales as unknown as (VacioResidual & { pipItemId?: string })[] | undefined;
  if (Array.isArray(vacios)) {
    rest.phases.investigacion.f3Sintesis!.vaciosResiduales = attachNumero(vacios.map(normalizeVacioResidual), pipVigente);
  }

  return { id: snap.id, ...rest };
}

/**
 * Lectura de SOLO LECTURA de lo mínimo que necesita el prellenado entre apps (Paso 4b): mismo criterio de
 * acceso que `getProject` (colaborador), pero sin `lastAccessedAt` ni backfills — un prellenado no debe
 * mutar el proyecto origen. Null si no existe o el usuario no colabora (no distingue los dos casos).
 */
export async function getProjectParaPrellenado(
  projectId: string,
  userId: string
): Promise<Pick<ModduloProject, "name" | "type" | "color" | "territorio"> | null> {
  const snap = await adminDb.collection(COLLECTION).doc(projectId).get();
  if (!snap.exists) return null;
  const data = snap.data() as ModduloProject;
  // Papelera (26-09-28): mismo criterio que getProject — un proyecto en papelera no
  // se usa como origen de prellenado, ni para su propio dueño.
  if (data.deletedAt) return null;
  if (!data.collaborators?.some((c) => c.uid === userId)) return null;
  return { name: data.name, type: data.type, color: data.color, territorio: data.territorio };
}

/**
 * Papelera (26-09-28): variante que SÍ ve un proyecto con `deletedAt` seteado — usada
 * ÚNICAMENTE por la ruta de restaurar y la vista de Papelera, ambas ya acotadas al
 * dueño (`collaborator.role === "owner"`) en el llamador; esta función solo exige
 * colaborador, igual que `getProject`. NUNCA usar esto donde iría `getProject` — un
 * proyecto en papelera debe ser invisible en cualquier otro punto del código.
 */
export async function getProjectPapelera(
  projectId: string,
  userId: string
): Promise<ModduloProject | null> {
  const snap = await adminDb.collection(COLLECTION).doc(projectId).get();
  if (!snap.exists) return null;
  const data = snap.data() as ModduloProject;
  if (!data.deletedAt) return null;
  if (!data.collaborators?.some((c) => c.uid === userId)) return null;
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

  const snap = await query.get();
  // Papelera (26-09-28): filtrado EN MEMORIA (sin índice compuesto nuevo — mismo
  // criterio que CLAUDE.md ya recomienda para volúmenes chicos, < 100 docs por
  // usuario). Un proyecto en papelera nunca aparece en el listado general.
  //
  // El límite se aplica DESPUÉS de filtrar deletedAt, nunca en la query de
  // Firestore — un `.limit(N)` a nivel de query se aplicaría sobre los N
  // documentos más recientes ANTES de saber cuáles están en papelera, así que
  // podría devolver menos de N proyectos activos aunque existan más (hallazgo
  // real, 26-09-28: `GET /api/moddulo/projects?limit=` pasa un límite
  // controlado por el cliente hasta aquí).
  const activos = snap.docs
    .map((doc) => ({ id: doc.id, ...doc.data() } as ModduloProject))
    .filter((p) => !p.deletedAt);
  return options?.limit ? activos.slice(0, options.limit) : activos;
}

/**
 * Papelera (26-09-28): lista SOLO los proyectos del usuario con `deletedAt` seteado —
 * usada únicamente por la vista de Papelera. Mismo filtrado en memoria que
 * `listUserProjects`, invertido.
 */
export async function listProyectosPapelera(userId: string): Promise<ModduloProject[]> {
  const snap = await adminDb.collection(COLLECTION).where("userId", "==", userId).get();
  return snap.docs
    .map((doc) => ({ id: doc.id, ...doc.data() } as ModduloProject))
    .filter((p) => !!p.deletedAt);
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
  if (!project) throw new ProyectoNoEncontradoError();

  const collaborator = project.collaborators.find((c) => c.uid === userId);
  if (!collaborator || collaborator.role === "analyst" || collaborator.role === "client") {
    throw new SinPermisosError("Sin permisos para editar este proyecto.");
  }

  // H-M5 (26-10-07): antes `update({...input})` — el `as UpdateProjectInput` de la ruta no
  // validaba nada en ejecución y Firestore interpreta las claves con punto como rutas de campo
  // (collaborators, userId, deletedAt, phases.*.dvs…). Ahora solo pasa lo que valida la lista
  // blanca; esta función es la ÚNICA línea de defensa, así que ningún llamador futuro puede
  // reabrir el agujero. `input` es `unknown` a propósito.
  const { update } = validarPatchProyecto(input);

  await adminDb.collection(COLLECTION).doc(projectId).update({
    ...update,
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
  if (!project) throw new ProyectoNoEncontradoError();

  const collaborator = project.collaborators.find((c) => c.uid === userId);
  if (!collaborator || collaborator.role === "analyst" || collaborator.role === "client") {
    throw new SinPermisosError("Sin permisos para editar fases.");
  }

  // H-M5 (26-10-07): `phaseId` venía del cliente sin validar (`phases.${phaseId}.data` aceptaba
  // "exploracion.dvs" o fases inventadas) y `data` REEMPLAZABA phases.X.data completo: cerrar F2
  // enviaba `{aprobadoEn}` y borraba el formulario PESTL (10 de 10 proyectos con F2 cerrada).
  const valida = validarPhaseData({ phaseId, data });

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
    [`phases.${phaseId}.status`]: status ?? (currentStatus === "completed" ? "completed" : "in-progress"),
    updatedAt: FieldValue.serverTimestamp(),
  };
  // FUSIÓN POR CLAVE de primer nivel (misma convención que el chat, que ya escribe
  // `phases.X.data.<clave>`): las claves enviadas reemplazan esa clave completa; las demás se
  // conservan. Un `data` vacío no borra nada.
  for (const [k, v] of Object.entries(valida.data ?? {})) {
    updates[`phases.${phaseId}.data.${k}`] = v;
  }

  await adminDb.collection(COLLECTION).doc(projectId).update(updates);
}

// ==========================================
// MARCAR UNA FASE COMO INICIADA
// ==========================================

/**
 * `phaseData: { phaseId, started: true }`. Antes vivía inline en la ruta, sin comprobación de
 * rol y sin la protección de "no degradar": ponía `status: "in-progress"` incondicionalmente, así
 * que podía revertir una fase `completed`. Ahora: mismo guard de rol que las demás mutaciones y
 * el estado solo avanza desde `not-started`. El paso `draft → active` del proyecto se conserva.
 */
export async function marcarFaseIniciada(projectId: string, userId: string, phaseId: PhaseId): Promise<void> {
  const project = await getProject(projectId, userId);
  if (!project) throw new ProyectoNoEncontradoError("Proyecto no encontrado o sin acceso.");

  const collaborator = project.collaborators.find((c) => c.uid === userId);
  if (!collaborator || collaborator.role === "analyst" || collaborator.role === "client") {
    throw new SinPermisosError("Sin permisos para editar fases.");
  }

  const valida = validarPhaseData({ phaseId, started: true });
  const faseActual = project.phases?.[valida.phaseId]?.status;
  // `started` es una marca idempotente (la pantalla de bienvenida se oculta con ella): se escribe
  // siempre. El ESTADO solo avanza desde `not-started`; nunca degrada `in-progress`/`completed`.
  const updates: Record<string, unknown> = {
    updatedAt: FieldValue.serverTimestamp(),
    [`phases.${valida.phaseId}.started`]: true,
  };
  if (faseActual === undefined || faseActual === "not-started") {
    updates[`phases.${valida.phaseId}.status`] = "in-progress";
  }
  // draft → active cuando el usuario inicia la primera fase
  if (project.status === "draft") updates.status = "active";

  await adminDb.collection(COLLECTION).doc(projectId).update(updates);
}

export async function savePhaseReportDraft(
  projectId: string,
  userId: string,
  phaseId: PhaseId,
  reportText: string
): Promise<void> {
  const project = await getProject(projectId, userId);
  if (!project) throw new ProyectoNoEncontradoError();

  const collaborator = project.collaborators.find((c) => c.uid === userId);
  if (!collaborator || collaborator.role === "analyst" || collaborator.role === "client") {
    throw new SinPermisosError("Sin permisos para editar fases.");
  }

  // H-M5 (26-10-07): `phaseId` sin validar se usaba como ruta de campo; `reportText` sin tipo ni tope.
  const valido = validarReportDraft({ phaseId, reportText });

  await adminDb.collection(COLLECTION).doc(projectId).update({
    [`phases.${valido.phaseId}.reportText`]: valido.reportText,
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

// Papelera (26-09-28, fase b): "eliminar" ya NO borra físicamente — mueve el
// proyecto a papelera (deletedAt/deletedBy). El back-link de PESTEL,
// linkedSource y las sesiones de Fontana vinculadas NO se tocan aquí — eso es
// responsabilidad exclusiva de la purga programada de la fase (c) (ver §11.1
// del plan: orden idempotente, documento al final). Mover a papelera y
// restaurar son operaciones simétricas y baratas — ningún vínculo se rompe ni
// se reconstruye en ninguna de las dos, por diseño (§3 del plan).
export async function deleteProject(projectId: string, userId: string): Promise<void> {
  const project = await getProject(projectId, userId);
  if (!project) throw new Error("Proyecto no encontrado.");

  const collaborator = project.collaborators.find((c) => c.uid === userId);
  if (collaborator?.role !== "owner") throw new Error("Solo el dueño puede eliminar el proyecto.");

  await adminDb.collection(COLLECTION).doc(projectId).update({
    deletedAt: FieldValue.serverTimestamp(),
    deletedBy: userId,
  });
}

// Nombre deliberadamente distinto de `restoreProject` (arriba, línea 563) —
// esa función es el mecanismo VIEJO y decorativo de `status: "archived" ↔
// "active"` (un badge, nunca filtrado de listUserProjects). Esta es la
// restauración REAL de la papelera (deletedAt/deletedBy). Los dos nombres
// conviven a propósito: no hay que unificarlos, son conceptos distintos.
export async function restoreProjectFromPapelera(projectId: string, userId: string): Promise<void> {
  const project = await getProjectPapelera(projectId, userId);
  if (!project) throw new Error("Proyecto no encontrado o no está en la papelera.");

  // Chequeo de owner EXPLÍCITO y SEPARADO del de getProjectPapelera (que solo
  // exige ser colaborador) — pedido explícito de Raúl: restaurar es una
  // operación tan sensible como eliminar, mismo criterio de propiedad.
  const collaborator = project.collaborators.find((c) => c.uid === userId);
  if (collaborator?.role !== "owner") throw new Error("Solo el dueño puede restaurar el proyecto.");

  await adminDb.collection(COLLECTION).doc(projectId).update({
    deletedAt: FieldValue.delete(),
    deletedBy: FieldValue.delete(),
  });
}

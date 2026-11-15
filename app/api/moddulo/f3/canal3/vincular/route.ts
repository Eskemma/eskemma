// app/api/moddulo/f3/canal3/vincular/route.ts
// POST { projectId, resultadoId, storagePath, nombre, tipo, metadatosFuente,
//        moduloPIP, cobertura, confirmarPeseATerritorio?, confirmarPeseAVigencia? }
// Vincula una fuente externa real (Canal 3) tras evaluar compatibilidad.
// resultadoId/storagePath vienen de /api/moddulo/f3/request-upload (mismo
// endpoint que Canal 2, sin cambios — es agnóstico de canal).

import { type NextRequest, NextResponse } from "next/server";
import { getSessionFromRequest } from "@/lib/server/auth-helpers";
import { getProject } from "@/lib/moddulo/project";
import { adminDb, adminStorage } from "@/lib/firebase-admin";
import { FieldValue } from "firebase-admin/firestore";
import { extractTextPerFile } from "@/lib/moddulo/attachments";
import { esStoragePathDeUsuario } from "@/lib/moddulo/storagePathAuth";
import { evaluarCompatibilidad } from "@/lib/moddulo/canal3Evaluation";
import { extraerTerritorioEscalar } from "@/lib/territorio/staleness";
import type { ModduloProject } from "@/types/moddulo.types";
import type { MetadatosFuenteExterna, ResultadoFuenteExterna } from "@/types/f3.types";
import type { CoberturaDeclarada } from "@/types/shared.types";

interface VincularBody {
  projectId?: string;
  resultadoId?: string;
  storagePath?: string;
  nombre?: string;
  tipo?: string;
  metadatosFuente?: MetadatosFuenteExterna;
  moduloPIP?: string;
  cobertura?: CoberturaDeclarada;
  confirmarPeseATerritorio?: boolean;
  confirmarPeseAVigencia?: boolean;
  // Pieza 2 del plan de escenarios (b)/(c) (2026-08-19) — presente solo
  // cuando esta vinculación resuelve el banner de fontanaPendiente. Se
  // limpia ese marcador aquí mismo, en la misma escritura, en vez de un
  // 2° endpoint/llamada aparte desde el cliente.
  fontanaSesionId?: string;
  // Opción A (26-09-09) — storagePath del .md con el reporte interpretativo
  // de Fontana (solo cuando la fuente externa es una sesión de Fontana).
  // Opcional; capa adicional para la revisión humana en M2.
  reporteStoragePath?: string;
}

export async function POST(request: NextRequest) {
  const session = await getSessionFromRequest(request);
  if (!session) {
    return NextResponse.json({ error: "No autorizado" }, { status: 401 });
  }

  let body: VincularBody;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "JSON inválido" }, { status: 400 });
  }

  const {
    projectId, resultadoId, storagePath, nombre, tipo, metadatosFuente,
    moduloPIP, cobertura, confirmarPeseATerritorio, confirmarPeseAVigencia, fontanaSesionId,
    reporteStoragePath,
  } = body;
  if (!projectId || !resultadoId || !storagePath || !nombre || !tipo || !metadatosFuente || !moduloPIP || !cobertura) {
    return NextResponse.json(
      { error: "projectId, resultadoId, storagePath, nombre, tipo, metadatosFuente, moduloPIP y cobertura son requeridos" },
      { status: 400 }
    );
  }

  if (
    !esStoragePathDeUsuario(storagePath, session.uid, projectId) ||
    (reporteStoragePath && !esStoragePathDeUsuario(reporteStoragePath, session.uid, projectId))
  ) {
    return NextResponse.json({ error: "storagePath no autorizado" }, { status: 403 });
  }

  const project = await getProject(projectId, session.uid);
  if (!project) {
    return NextResponse.json({ error: "Proyecto no encontrado" }, { status: 404 });
  }

  const compatibilidad = evaluarCompatibilidad(project, metadatosFuente);

  // Tipo: bloqueo duro, sin bypass posible.
  if (!compatibilidad.pertinencia.cumple) {
    return NextResponse.json(
      { error: "pertinencia_rechazada", message: compatibilidad.pertinencia.detalle },
      { status: 422 }
    );
  }

  // Territorio: bloqueo suave con su propio flag — no comparte confirmación con vigencia.
  if (compatibilidad.pertinencia.territorioRequiereConfirmacion && !confirmarPeseATerritorio) {
    return NextResponse.json(
      {
        error: "territorio_requiere_confirmacion",
        message: compatibilidad.pertinencia.territorioDetalle,
      },
      { status: 422 }
    );
  }

  // Vigencia (fecha): bloqueo suave con su propio flag.
  if (!compatibilidad.vigencia.cumple && !confirmarPeseAVigencia) {
    return NextResponse.json(
      { error: "vigencia_rechazada", message: compatibilidad.vigencia.detalle },
      { status: 422 }
    );
  }

  // Guard de existencia: mismo criterio que confirm/route.ts de Canal 2 —
  // extractTextPerFile no lanza si el archivo no existe.
  const [exists] = await adminStorage.bucket().file(storagePath).exists();
  if (!exists) {
    return NextResponse.json(
      { error: "file_not_found", message: "El archivo no existe en Storage. Sube el archivo antes de vincular." },
      { status: 404 }
    );
  }

  const extractoTexto = await extractTextPerFile({ nombre, tipo, url: "", storagePath });

  // 7b-7 (H25): resultado y borrado del marcador `fontanaPendiente` en UNA transacción (antes eran
  // 2 escrituras sueltas). La compatibilidad (evaluarCompatibilidad es PURA: solo lee tipo,
  // territorio y xpcto del proyecto) se evalúa de nuevo DENTRO con el proyecto releído, de modo que
  // un cambio de territorio o de fecha límite entre el pre-chequeo y la escritura da el mismo 422
  // que habría dado de haber llegado un instante después. El pre-chequeo de arriba se conserva solo
  // para ordenar las respuestas (422 antes de tocar Storage). Callback sin efectos externos.
  const proyectoRef = adminDb.collection("moddulo_projects").doc(projectId);
  const fechaEntrega = new Date().toISOString();

  const salida = await adminDb.runTransaction(async (tx) => {
    const proyectoTx = await tx.get(proyectoRef);
    const proyectoActual = proyectoTx.data() as
      | (Pick<ModduloProject, "type" | "territorio" | "xpcto"> & {
          deletedAt?: unknown;
          phases?: ModduloProject["phases"];
        })
      | undefined;
    // Un proyecto enviado a la papelera (o purgado) entre el pre-chequeo y la escritura cuenta como
    // inexistente, igual que en getProject (antes se escribía el resultado de todos modos).
    if (!proyectoTx.exists || !proyectoActual || proyectoActual.deletedAt) {
      return { tipo: "rechazo" as const, status: 404, cuerpo: { error: "Proyecto no encontrado" } };
    }

    const compatibilidadTx = evaluarCompatibilidad(proyectoActual, metadatosFuente);
    if (!compatibilidadTx.pertinencia.cumple) {
      return {
        tipo: "rechazo" as const,
        status: 422,
        cuerpo: { error: "pertinencia_rechazada", message: compatibilidadTx.pertinencia.detalle },
      };
    }
    if (compatibilidadTx.pertinencia.territorioRequiereConfirmacion && !confirmarPeseATerritorio) {
      return {
        tipo: "rechazo" as const,
        status: 422,
        cuerpo: {
          error: "territorio_requiere_confirmacion",
          message: compatibilidadTx.pertinencia.territorioDetalle,
        },
      };
    }
    if (!compatibilidadTx.vigencia.cumple && !confirmarPeseAVigencia) {
      return {
        tipo: "rechazo" as const,
        status: 422,
        cuerpo: { error: "vigencia_rechazada", message: compatibilidadTx.vigencia.detalle },
      };
    }

    const resultado: ResultadoFuenteExterna = {
      moduloPIP,
      origen: {
        sourceKind: "external",
        componente: "external",
        analisisId: resultadoId,
        fechaEntrega,
      },
      cobertura,
      payload: {
        archivoUrl: storagePath,
        extractoTexto,
        ...(reporteStoragePath ? { reporteInterpretativoUrl: reporteStoragePath } : {}),
      },
      metadatosFuente,
      compatibilidad: compatibilidadTx,
      // Ronda 13 (26-08-18) — propagación de cambios de territorio. 7b-7 (N3): la clave se OMITE
      // cuando el proyecto no tiene territorio; el Admin SDK rechaza `undefined`.
      ...(proyectoActual.territorio
        ? { proyectoTerritorioSnapshotAtVinculacion: JSON.stringify(extraerTerritorioEscalar(proyectoActual.territorio)) }
        : {}),
    };

    tx.set(proyectoRef.collection("f3Resultados").doc(resultadoId), {
      ...resultado,
      createdAt: FieldValue.serverTimestamp(),
    });

    // El marcador se decide con el documento leído en la transacción, no con la copia de getProject.
    if (fontanaSesionId && proyectoActual.phases?.investigacion?.fontanaPendiente?.sesionId === fontanaSesionId) {
      tx.update(proyectoRef, {
        "phases.investigacion.fontanaPendiente": FieldValue.delete(),
        updatedAt: FieldValue.serverTimestamp(),
      });
    }

    return { tipo: "ok" as const, resultado };
  });

  if (salida.tipo === "rechazo") {
    return NextResponse.json(salida.cuerpo, { status: salida.status });
  }
  return NextResponse.json({ resultadoId, resultado: salida.resultado }, { status: 200 });
}

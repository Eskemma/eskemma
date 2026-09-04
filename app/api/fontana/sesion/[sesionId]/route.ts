// app/api/fontana/sesion/[sesionId]/route.ts
// PATCH { accion: "agregar"|"quitar", familiaId, indicadorId } — rechaza
// "quitar" si el indicador está en minimos (candado del PIP).
// PATCH { nombre?, territorio?, tipoProyecto?, color?, archivada? } —
// edición de metadatos de una sesión suelta (Punto 1b, hub,
// 2026-08-19), rama separada (sin `accion`) del mismo endpoint —
// mismo patrón de branching por forma del body que ya usa sesion/route.ts.
// PATCH { desvincular: true } — corta el vínculo de una sesión ya
// vinculada a un proyecto de Moddulo (Investigación 2, 2026-08-21).
// Limitado a sesiones de Flujo 1/2 (tareaPipIds vacío) — Escenario (a)
// no puede desvincularse desde aquí. Limpia también
// phases.investigacion.fontanaPendiente del proyecto SI sigue
// apuntando a esta sesión — nunca borra algo que ya no aplica.
// DELETE — borra una sesión suelta. Rechaza si tiene modduloProjectId
// (seguridad en profundidad — el hub nunca ofrece esta acción para una
// sesión vinculada, pero el endpoint no confía solo en eso).
// PATCH { canvasItemId, eliminarCanvasItem: true } — borrado SUAVE de un
// item de Canvas (26-09-05): marca `eliminado: true`, nunca borra el
// elemento del array (append-only, trazabilidad con los mensajes de chat
// que lo generaron — algunos traen un enlace "Ver en Canvas").

import { type NextRequest, NextResponse } from "next/server";
import { getSessionFromRequest } from "@/lib/server/auth-helpers";
import { cargarSesionConTerritorioActual } from "@/lib/fontana/sesionTerritorio";
import { adminDb } from "@/lib/firebase-admin";
import { FieldValue } from "firebase-admin/firestore";
import type { FontanaSesion, FamiliaFontanaId } from "@/types/fontana.types";
import type { ProjectType, Territorio } from "@/types/moddulo.types";
import { FAMILIA1_ORDEN } from "@/lib/fontana/familia1Catalogo";
import { FAMILIA2_ORDEN } from "@/lib/fontana/familia2Catalogo";
import { FAMILIA3_ORDEN } from "@/lib/fontana/familia3Catalogo";
import { FAMILIA4_ORDEN } from "@/lib/fontana/familia4Catalogo";
import { FAMILIA5_ORDEN } from "@/lib/fontana/familia5Catalogo";

const FAMILIAS_VALIDAS: FamiliaFontanaId[] = ["F1", "F2", "F3", "F4", "F5"];

const CATALOGO_ORDEN: Record<FamiliaFontanaId, string[]> = {
  F1: FAMILIA1_ORDEN,
  F2: FAMILIA2_ORDEN,
  F3: FAMILIA3_ORDEN,
  F4: FAMILIA4_ORDEN,
  F5: FAMILIA5_ORDEN,
};

interface EditarMetadatosBody {
  nombre?: string;
  territorio?: Territorio;
  tipoProyecto?: ProjectType;
  color?: string;
  archivada?: boolean;
}

export async function PATCH(
  request: NextRequest,
  context: { params: Promise<{ sesionId: string }> }
) {
  const session = await getSessionFromRequest(request);
  if (!session) {
    return NextResponse.json({ error: "No autorizado" }, { status: 401 });
  }

  const { sesionId } = await context.params;

  let body: {
    accion?: "agregar" | "quitar" | "agregar_todos" | "quitar_todos";
    familiaId?: FamiliaFontanaId;
    indicadorId?: string;
    desvincular?: boolean;
    canvasItemId?: string;
    eliminarCanvasItem?: boolean;
  } & EditarMetadatosBody;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "JSON inválido" }, { status: 400 });
  }

  // Borrado suave de un item de Canvas (26-09-05) — rama propia, antes de
  // desvincular/metadatos/accion.
  if (body.eliminarCanvasItem === true) {
    if (!body.canvasItemId) {
      return NextResponse.json({ error: "canvasItemId es requerido" }, { status: 400 });
    }
    const cargada = await cargarSesionConTerritorioActual(sesionId, session.uid);
    if (!cargada) {
      return NextResponse.json({ error: "Sesión no encontrada" }, { status: 404 });
    }
    const { sesion, ref } = cargada;
    const canvasItems = sesion.canvasItems ?? [];
    const idx = canvasItems.findIndex((it) => it.id === body.canvasItemId);
    if (idx === -1) {
      return NextResponse.json({ error: "Item de Canvas no encontrado" }, { status: 404 });
    }
    // Firestore no permite update parcial de un elemento de array por
    // índice — se lee el array completo y se escribe de vuelta.
    const nuevoCanvasItems = canvasItems.map((it, i) => (i === idx ? { ...it, eliminado: true } : it));
    const nowIso = new Date().toISOString();
    await ref.update({ canvasItems: nuevoCanvasItems, fechaUltimoGuardado: nowIso });
    return NextResponse.json({ ok: true }, { status: 200 });
  }

  // Desvincular (Investigación 2) — rama propia, antes de la de metadatos.
  if (body.desvincular === true) {
    const cargada = await cargarSesionConTerritorioActual(sesionId, session.uid);
    if (!cargada) {
      return NextResponse.json({ error: "Sesión no encontrada" }, { status: 404 });
    }
    const { sesion, ref } = cargada;

    if (!sesion.modduloProjectId) {
      return NextResponse.json({ error: "sesion_no_vinculada", message: "Esta sesión no está vinculada a ningún proyecto." }, { status: 400 });
    }
    // Seguridad en profundidad: el hub nunca ofrece "Desvincular" para
    // una sesión de Escenario (a) (tareaPipIds no vacío), pero el
    // servidor lo rechaza explícitamente de todas formas.
    if (sesion.tareaPipIds.length > 0) {
      return NextResponse.json(
        { error: "escenario_a_no_desvinculable", message: "Una sesión de Escenario (a) no puede desvincularse desde aquí." },
        { status: 409 }
      );
    }

    const proyectoRef = adminDb.collection("moddulo_projects").doc(sesion.modduloProjectId);
    const proyectoSnap = await proyectoRef.get();
    // Nunca borrar fontanaPendiente si ya no apunta a ESTA sesión — solo
    // si el marcador sigue siendo el que esta sesión escribió.
    if (proyectoSnap.exists && proyectoSnap.data()?.phases?.investigacion?.fontanaPendiente?.sesionId === sesionId) {
      await proyectoRef.update({ "phases.investigacion.fontanaPendiente": FieldValue.delete() });
    }

    await ref.update({ modduloProjectId: FieldValue.delete(), fechaUltimoGuardado: new Date().toISOString() });
    return NextResponse.json({ ok: true }, { status: 200 });
  }

  // Edición de metadatos (Editar/Archivar del hub) — sin `accion`.
  if (!body.accion) {
    const { nombre, territorio, tipoProyecto, color, archivada } = body;
    if (nombre === undefined && territorio === undefined && tipoProyecto === undefined && color === undefined && archivada === undefined) {
      return NextResponse.json({ error: "Nada que actualizar" }, { status: 400 });
    }
    const cargada = await cargarSesionConTerritorioActual(sesionId, session.uid);
    if (!cargada) {
      return NextResponse.json({ error: "Sesión no encontrada" }, { status: 404 });
    }
    const { sesion, ref } = cargada;

    const updates: Record<string, unknown> = { fechaUltimoGuardado: new Date().toISOString() };
    if (nombre !== undefined) updates.nombre = nombre;
    if (territorio !== undefined) updates.territorio = territorio;
    if (tipoProyecto !== undefined) updates.tipoProyecto = tipoProyecto;
    if (color !== undefined) updates.color = color;
    if (archivada !== undefined) updates.archivada = archivada;
    await ref.update(updates);

    const sesionActualizada: FontanaSesion = { ...sesion, ...updates, sesionId } as FontanaSesion;
    return NextResponse.json({ sesion: sesionActualizada }, { status: 200 });
  }

  const { accion, familiaId, indicadorId } = body;

  // Bulk (Punto 1, 26-09-05): "Añadir todos los indicadores" / "Limpiar
  // indicadores" por familia — rama propia, sin indicadorId. `minimos`
  // vive en un array separado de `seleccionUsuario`, así que "quitar_todos"
  // nunca necesita filtrar candados: solo vacía seleccionUsuario.
  if (accion === "agregar_todos" || accion === "quitar_todos") {
    if (!familiaId || !FAMILIAS_VALIDAS.includes(familiaId)) {
      return NextResponse.json({ error: "familiaId (F1-F5) es requerido" }, { status: 400 });
    }
    const cargada = await cargarSesionConTerritorioActual(sesionId, session.uid);
    if (!cargada) {
      return NextResponse.json({ error: "Sesión no encontrada" }, { status: 404 });
    }
    const { sesion, ref } = cargada;
    const familia = sesion.indicadoresPorFamilia[familiaId];

    const nuevaSeleccion =
      accion === "agregar_todos"
        ? [...new Set([...familia.seleccionUsuario, ...CATALOGO_ORDEN[familiaId]])].filter(
            (id) => !familia.minimos.includes(id)
          )
        : [];

    const nowIso = new Date().toISOString();
    await ref.update({
      [`indicadoresPorFamilia.${familiaId}.seleccionUsuario`]: nuevaSeleccion,
      fechaUltimoGuardado: nowIso,
    });

    const sesionActualizada: FontanaSesion = {
      ...sesion,
      sesionId,
      indicadoresPorFamilia: {
        ...sesion.indicadoresPorFamilia,
        [familiaId]: { ...familia, seleccionUsuario: nuevaSeleccion },
      },
      fechaUltimoGuardado: nowIso,
    };
    return NextResponse.json({ sesion: sesionActualizada }, { status: 200 });
  }

  if (!accion || !familiaId || !indicadorId || !FAMILIAS_VALIDAS.includes(familiaId)) {
    return NextResponse.json(
      { error: "accion, familiaId (F1-F5) e indicadorId son requeridos" },
      { status: 400 }
    );
  }
  if (accion !== "agregar" && accion !== "quitar") {
    return NextResponse.json({ error: "accion debe ser 'agregar' o 'quitar'" }, { status: 400 });
  }

  const cargada = await cargarSesionConTerritorioActual(sesionId, session.uid);
  if (!cargada) {
    return NextResponse.json({ error: "Sesión no encontrada" }, { status: 404 });
  }
  const { sesion, ref } = cargada;

  const familia = sesion.indicadoresPorFamilia[familiaId];

  if (accion === "quitar" && familia.minimos.includes(indicadorId)) {
    return NextResponse.json(
      {
        error: "indicador_es_minimo",
        mensaje: `No se puede quitar: ${indicadorId} es un indicador mínimo del PIP para este proyecto.`,
      },
      { status: 409 }
    );
  }

  const nuevaSeleccion =
    accion === "agregar"
      ? [...new Set([...familia.seleccionUsuario, indicadorId])]
      : familia.seleccionUsuario.filter((id) => id !== indicadorId);

  const nowIso = new Date().toISOString();
  await ref.update({
    [`indicadoresPorFamilia.${familiaId}.seleccionUsuario`]: nuevaSeleccion,
    fechaUltimoGuardado: nowIso,
  });

  const sesionActualizada: FontanaSesion = {
    ...sesion,
    sesionId,
    indicadoresPorFamilia: {
      ...sesion.indicadoresPorFamilia,
      [familiaId]: { ...familia, seleccionUsuario: nuevaSeleccion },
    },
    fechaUltimoGuardado: nowIso,
  };

  return NextResponse.json({ sesion: sesionActualizada }, { status: 200 });
}

export async function DELETE(
  request: NextRequest,
  context: { params: Promise<{ sesionId: string }> }
) {
  const session = await getSessionFromRequest(request);
  if (!session) {
    return NextResponse.json({ error: "No autorizado" }, { status: 401 });
  }

  const { sesionId } = await context.params;

  const cargada = await cargarSesionConTerritorioActual(sesionId, session.uid);
  if (!cargada) {
    return NextResponse.json({ error: "Sesión no encontrada" }, { status: 404 });
  }
  const { sesion, ref } = cargada;

  // Seguridad en profundidad: el hub solo lista sesiones sueltas y nunca
  // ofrece "Eliminar" para una ya vinculada — el servidor lo rechaza
  // explícitamente de todas formas, sin confiar solo en la UI.
  if (sesion.modduloProjectId) {
    return NextResponse.json(
      { error: "sesion_vinculada", message: "No se puede eliminar una sesión ya vinculada a un proyecto de Moddulo." },
      { status: 409 }
    );
  }

  // recursiveDelete arrastra las subcolecciones `mensajes` y `adjuntos` —
  // antes `ref.delete()` las dejaba huérfanas en Firestore (hallazgo de la
  // auditoría de adjuntos, 2026-09-01). El texto de los adjuntos es dato
  // político sensible: no puede sobrevivir a la sesión.
  await adminDb.recursiveDelete(ref);
  return NextResponse.json({ ok: true }, { status: 200 });
}

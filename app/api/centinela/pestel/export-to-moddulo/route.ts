// app/api/centinela/pestel/export-to-moddulo/route.ts
// RETIRED (T8a). It answered POST { analysisId, modduloProjectId? } and wrote linkedSource by sub-paths, without a
// payload and without resetting M1. Nothing in the repo called it (bitácora N5). It now answers 410 and counts the
// calls in retiros_rutas/export-to-moddulo (total, sinSesion, ultimaLlamada: no uid, no IP, no payload).
// The 410 does not read the body and does not depend on the counter: a failed write never changes the response.
// The counter is written inside after(), so the response does not wait for Firestore.
// Final deletion of this route is a later, separate cut (after 30 days of measurement).

import { after, type NextRequest, NextResponse } from "next/server";
import { FieldValue } from "firebase-admin/firestore";
import { adminDb } from "@/lib/firebase-admin";
import { getSessionFromRequest } from "@/lib/server/auth-helpers";
import {
  RETIRO_COLECCION,
  RETIRO_EXPORT_TO_MODDULO,
  MENSAJE_RETIRO_EXPORT_TO_MODDULO,
  camposContador,
  crearLimitador,
  cuerpoRetiro,
} from "@/lib/centinela/pestel/retiroRuta";

const limitador = crearLimitador(1000);

export async function POST(request: NextRequest) {
  after(async () => {
    let pendiente: { total: number; sinSesion: number } | null = null;
    try {
      // Without a cookie there is no read at all; with one, a single session check (never the body).
      const session = await getSessionFromRequest(request).catch(() => null);
      pendiente = limitador.registrar(!session);
      if (!pendiente) return;
      await adminDb
        .collection(RETIRO_COLECCION)
        .doc(RETIRO_EXPORT_TO_MODDULO)
        .set(
          camposContador(pendiente, {
            increment: (n) => FieldValue.increment(n),
            ahora: FieldValue.serverTimestamp(),
          }),
          { merge: true }
        );
    } catch {
      if (pendiente) limitador.devolver(pendiente);
      console.warn("[retiro-ruta][export-to-moddulo] no se pudo actualizar el contador");
    }
  });
  return NextResponse.json(cuerpoRetiro(MENSAJE_RETIRO_EXPORT_TO_MODDULO), { status: 410 });
}

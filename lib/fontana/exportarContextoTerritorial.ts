// lib/fontana/exportarContextoTerritorial.ts
// Construcción y subida del payload FontanaContextoTerritorial — usado
// por Canal 1 (canal1/entregar) y Canal 3 (VincularFuenteForm, "Vincular
// resultado externo") — un solo criterio de qué se incluye (TODO lo
// seleccionado en la sesión, CeldaTablaFontana completo sin aplanar, sin
// filtrar a "mínimos"), un solo mecanismo de subida. Siempre va a
// Storage (nunca embebido en el documento de Firestore de
// f3Resultados) — medido en vivo: territorio plural amplio + varios
// indicadores puede superar el límite de 1 MB por documento.

import { uploadMedia } from "@/firebase/storageUtils";
import type { Territorio } from "@/types/shared.types";
import type { FontanaContextoTerritorial } from "@/types/fontana.types";
import type { CeldaTablaFontana } from "@/lib/fontana/tablaColumnas";

export function construirContextoTerritorial(
  territorio: Territorio,
  indicadores: { id: string; nombre: string; celdas: CeldaTablaFontana[] }[]
): FontanaContextoTerritorial {
  return {
    territorio,
    indicadores: indicadores.map(({ id, nombre, celdas }) => ({ id, nombre, celdas })),
  };
}

// Reserva storagePath (request-upload, formato "datos") y sube el JSON —
// mismo flujo que CargaManualForm/VincularFuenteForm ya usan para
// archivos. Regresa el storagePath para que el caller lo mande a
// canal1/entregar o canal3/vincular.
export async function subirContextoTerritorial(
  projectId: string,
  contexto: FontanaContextoTerritorial
): Promise<string> {
  const filename = `fontana-contexto-${Date.now()}.json`;
  const resUpload = await fetch("/api/moddulo/f3/request-upload", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ projectId, formato: "datos", filename }),
  });
  if (!resUpload.ok) {
    throw new Error("No se pudo preparar la subida del resultado de Fontana.");
  }
  const { storagePath } = (await resUpload.json()) as { storagePath: string };

  const blob = new Blob([JSON.stringify(contexto)], { type: "application/json" });
  const file = new File([blob], filename, { type: "application/json" });
  try {
    await uploadMedia(file, storagePath);
  } catch {
    throw new Error("No se pudo subir el resultado de Fontana a Moddulo.");
  }
  return storagePath;
}

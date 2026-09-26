// lib/territorio/fetchOrigen.ts
// Cliente de GET /api/territorio/origen para los wizards de creación (Paso 4b). Devuelve null ante
// cualquier fallo: el prellenado nunca bloquea el wizard (queda vacío y editable, como antes).

import type { AppOrigen, OrigenTerritorio } from "@/lib/territorio/origenTerritorio";

export async function fetchTerritorioOrigen(app: AppOrigen, id: string): Promise<OrigenTerritorio | null> {
  try {
    const res = await fetch(`/api/territorio/origen?app=${app}&id=${encodeURIComponent(id)}`, { credentials: "include" });
    if (!res.ok) return null;
    return (await res.json()) as OrigenTerritorio;
  } catch {
    return null;
  }
}

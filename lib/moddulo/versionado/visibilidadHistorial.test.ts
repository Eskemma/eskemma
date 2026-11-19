// C4a-1 — la visibilidad del historial vive en UNA función (panel) y otra (detalle y nombres). Hoy todos los
// colaboradores ven todo; esta prueba documenta esa política (cambiarla es cambiar una línea del módulo y esta prueba).
import { describe, expect, it } from "vitest";
import type { CollaboratorRole } from "@/types/moddulo.types";
import { puedeVerDetalleHistorial, puedeVerPanelHistorial } from "./visibilidadHistorial";

const ROLES: CollaboratorRole[] = ["owner", "co-consultant", "analyst", "client"];

describe("visibilidad del historial (política de hoy)", () => {
  it.each(ROLES)("%s ve el panel y el detalle", (rol) => {
    expect(puedeVerPanelHistorial(rol)).toBe(true);
    expect(puedeVerDetalleHistorial(rol)).toBe(true);
  });
});

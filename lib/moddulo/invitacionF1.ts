// lib/moddulo/invitacionF1.ts
// PURE. The yellow strip of F2 that invites the user to complete F1-Propósito (XPCTO form). It is an
// invitation, not a block: the motors are generated without F1 (the XPCTO contrast just comes out generic).
// It shows only while it can still help: an imported analysis exists, F1 is not completed, and F2 is NOT
// closed (a closed phase is read-only: it must not invite to anything).

export function debeInvitarCompletarF1(i: {
  hayMapaPestel: boolean;
  /** `phases.proposito.status`; null/undefined while unknown or not recorded. */
  estadoF1: string | null | undefined;
  f2Cerrada: boolean;
}): boolean {
  return i.hayMapaPestel && i.estadoF1 !== "completed" && !i.f2Cerrada;
}

export const TEXTO_INVITACION_F1 =
  "Antes de continuar en F2, entra a F1-Propósito y completa el formulario del XPCTO. Después, sigue las instrucciones del sistema.";
export const BOTON_INVITACION_F1 = "Ir a F1-Propósito →";

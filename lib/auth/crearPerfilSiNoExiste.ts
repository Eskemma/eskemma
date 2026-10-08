// lib/auth/crearPerfilSiNoExiste.ts
// Body of the "create if absent" transaction for a brand-new user's profile.
// Idempotent: if the document already exists (another tab / a concurrent load
// created it first) it is returned UNTOUCHED, so createdAt, profileCompleted
// and showOnboardingModal are never overwritten.

export interface TransaccionMin<R> {
  get: (ref: R) => Promise<{ exists: () => boolean; data: () => unknown }>;
  set: (ref: R, data: unknown) => void;
}

export interface ResultadoPerfil {
  creado: boolean;
  data: unknown;
}

export async function crearPerfilSiNoExiste<R>(
  tx: TransaccionMin<R>,
  ref: R,
  perfilInicial: unknown
): Promise<ResultadoPerfil> {
  const actual = await tx.get(ref);
  if (actual.exists()) return { creado: false, data: actual.data() };
  tx.set(ref, perfilInicial);
  return { creado: true, data: perfilInicial };
}

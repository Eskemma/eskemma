// lib/moddulo/storagePathAuth.ts
// Valida que un storagePath de F3 (Storage) recibido del cliente pertenezca
// al usuario autenticado y al proyecto de la petición, antes de pasarlo a
// adminStorage (que no aplica storage.rules). request-upload/route.ts es la
// única fuente legítima de estos paths: siempre
// `moddulo/${session.uid}/${projectId}/...` — cualquier otro valor es un
// path ajeno o inventado.

export function esStoragePathDeUsuario(
  storagePath: string,
  uid: string,
  projectId: string
): boolean {
  return storagePath.startsWith(`moddulo/${uid}/${projectId}/`);
}

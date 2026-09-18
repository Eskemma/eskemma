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

// Variante para el chat de Moddulo (attachments[] de ChatRequest), donde el
// cliente manda un ARREGLO y storagePath es opcional en el tipo. extractTextPerFile
// cae a fetch(attachment.url) cuando falta storagePath, así que validar solo
// "los que vienen" dejaría el guard saltable omitiendo el campo: aquí se exige.
// Fail-closed: cualquier forma inesperada (no-arreglo, elemento no-objeto,
// storagePath ausente o no-string) devuelve false.
export function sonAdjuntosDeUsuario(
  adjuntos: unknown,
  uid: string,
  projectId: string
): boolean {
  if (!Array.isArray(adjuntos)) return false;
  return adjuntos.every((a) => {
    if (typeof a !== "object" || a === null) return false;
    const storagePath = (a as { storagePath?: unknown }).storagePath;
    return typeof storagePath === "string" && esStoragePathDeUsuario(storagePath, uid, projectId);
  });
}

// Allow-list para el fallback fetch(attachment.url) de extractTextPerFile.
// La url de un adjunto se persiste tal cual la manda el cliente (chat route →
// archivosAdjuntos) y se vuelve a descargar del lado servidor
// (import-moddulo-attachments, cuando textoExtraido es corto): sin filtro es
// un SSRF encadenado (p. ej. http://169.254.169.254/ — metadatos de la nube).
// Se eligió allow-list y no deny-list de rangos IP: la deny-list es evadible
// (DNS rebinding entre validar y fetch, IPv6/IPv4-mapeado, IPs en decimal/
// octal, redirects) y además dejaría al servidor como proxy de cualquier host
// público. La única url legítima es la de descarga de NUESTRO bucket
// (getDownloadURL de uploadMedia). Fail-closed: bucket ausente/vacío → false.
const FIREBASE_STORAGE_HOST = "firebasestorage.googleapis.com";

export function esUrlDeDescargaDelBucket(url: unknown, bucket: string | undefined): boolean {
  if (typeof url !== "string" || !bucket) return false;
  let parsed: URL;
  try {
    parsed = new URL(url);
  } catch {
    return false;
  }
  return (
    parsed.protocol === "https:" &&
    parsed.hostname === FIREBASE_STORAGE_HOST &&
    parsed.port === "" &&
    parsed.username === "" &&
    parsed.password === "" &&
    parsed.pathname.startsWith(`/v0/b/${bucket}/o/`)
  );
}

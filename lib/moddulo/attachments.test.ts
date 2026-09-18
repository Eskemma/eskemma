// lib/moddulo/attachments.test.ts
// Regresión del SSRF encadenado en extractTextPerFile: la url de un adjunto
// se persiste tal cual la manda el cliente y se re-descarga del lado servidor
// (import-moddulo-attachments). Se prueba en el sink (no en cada ruta) porque
// es el único punto que hace fetch(url): que una url fuera del bucket no
// dispare NINGÚN fetch, y que la url legítima del bucket siga funcionando.

import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("@/lib/firebase-admin", () => ({ adminStorage: { bucket: vi.fn() } }));
vi.mock("@/lib/ai/claude", () => ({
  anthropic: { messages: { create: vi.fn() } },
}));

import { extractTextPerFile } from "./attachments";

const BUCKET = "eskemma-test.appspot.com";
const URL_LEGITIMA =
  `https://firebasestorage.googleapis.com/v0/b/${BUCKET}/o/` +
  `moddulo%2FuidA%2FprojA%2Ffases%2Fexploracion%2Fattachments%2Fuuid-nota.txt?alt=media&token=abc`;
const FALLO = "[No se pudo acceder a nota.txt]";

const adjunto = (url: string) => ({ nombre: "nota.txt", url, tipo: "text/plain" });

describe("extractTextPerFile — fallback fetch(url) (anti-SSRF)", () => {
  const fetchMock = vi.fn();

  beforeEach(() => {
    vi.clearAllMocks();
    vi.stubGlobal("fetch", fetchMock);
    vi.stubEnv("NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET", BUCKET);
    vi.spyOn(console, "warn").mockImplementation(() => undefined);
  });
  afterEach(() => {
    vi.unstubAllGlobals();
    vi.unstubAllEnvs();
    vi.restoreAllMocks();
  });

  it.each([
    ["metadatos de la nube (IMDS)", "http://169.254.169.254/latest/meta-data/"],
    ["loopback", "http://127.0.0.1:3000/api/admin"],
    ["red privada", "http://10.0.0.5/secret"],
    ["host público arbitrario (open proxy)", "https://example.com/x.txt"],
    ["http plano al host de Firebase", URL_LEGITIMA.replace("https:", "http:")],
  ])("no hace fetch y devuelve el placeholder de error: %s", async (_caso, url) => {
    const texto = await extractTextPerFile(adjunto(url));
    expect(texto).toBe(FALLO);
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("no filtra la url ni el token en el log de rechazo", async () => {
    await extractTextPerFile(adjunto("http://169.254.169.254/latest/meta-data/"));
    const logueado = JSON.stringify(vi.mocked(console.warn).mock.calls);
    expect(logueado).not.toContain("169.254");
  });

  it("descarga y extrae la url legítima del bucket (camino feliz), sin seguir redirects", async () => {
    fetchMock.mockResolvedValue(new Response("contenido del archivo", { status: 200 }));
    const texto = await extractTextPerFile(adjunto(URL_LEGITIMA));
    expect(texto).toContain("contenido del archivo");
    expect(fetchMock).toHaveBeenCalledTimes(1);
    expect(fetchMock).toHaveBeenCalledWith(URL_LEGITIMA, { redirect: "error" });
  });

  it("si la url legítima redirige (fetch lanza con redirect:error) devuelve el placeholder, no lanza", async () => {
    fetchMock.mockRejectedValue(new TypeError("fetch failed"));
    await expect(extractTextPerFile(adjunto(URL_LEGITIMA))).resolves.toBe(FALLO);
  });

  it("con la variable del bucket ausente rechaza (fail-closed) aunque la url parezca legítima", async () => {
    vi.stubEnv("NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET", "");
    const texto = await extractTextPerFile(adjunto(URL_LEGITIMA));
    expect(texto).toBe(FALLO);
    expect(fetchMock).not.toHaveBeenCalled();
  });
});

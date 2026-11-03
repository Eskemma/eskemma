import { describe, expect, it } from "vitest";
import { renderToStaticMarkup } from "react-dom/server";
import { AvisoOrigenPestel } from "./AvisoOrigenPestel";

describe("AvisoOrigenPestel", () => {
  it("con aviso: role=status, el texto, el enlace a Centinela y NINGÚN control para descartarlo", () => {
    const h = renderToStaticMarkup(<AvisoOrigenPestel aviso={{ tipo: "version_nueva", texto: "Hay una versión más nueva." }} pestProjectId="pest1" />);
    expect(h).toContain('role="status"');
    expect(h).toContain("Hay una versión más nueva.");
    expect(h).toContain('href="/centinela/pestel/pest1/analisis"');
    expect(h).toContain("Ver en Centinela");
    // Decisión de producto: describe un estado del proyecto, no se descarta (se quita al actualizar el análisis).
    expect(h).not.toContain("<button");
    expect(h).not.toMatch(/Cerrar|Descartar|Ocultar/);
    expect(h).toContain("bg-brown-eske-60/10");
  });
  it("sin aviso no pinta nada; sin proyecto PESTEL no hay enlace", () => {
    expect(renderToStaticMarkup(<AvisoOrigenPestel aviso={{ tipo: "ninguno" }} pestProjectId="pest1" />)).toBe("");
    expect(renderToStaticMarkup(<AvisoOrigenPestel aviso={{ tipo: "cambio_contenido", texto: "x" }} pestProjectId={null} />)).not.toContain("href=");
  });
});

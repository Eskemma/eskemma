import { describe, expect, it } from "vitest";
import { renderToStaticMarkup } from "react-dom/server";
import { PendientePestel, TEXTO_PENDIENTE, TEXTO_PENDIENTE_ARCHIVADO, TEXTO_PENDIENTE_HUERFANO, TOOLTIP_FASE_CERRADA } from "./PendientePestel";

const base = { pestelId: "p1", etapa: 4 as number | null, archivado: false, huerfano: false, f2Cerrada: false, cancelando: false, onCancelar: () => {} };
const h = (o: Partial<typeof base> = {}) => renderToStaticMarkup(<PendientePestel {...base} {...o} />);

describe("PendientePestel", () => {
  it("normal: leyenda, enlace por etapa (datos antes de la 5, análisis desde la 5) y botón habilitado", () => {
    const x = h();
    expect(x).toContain(TEXTO_PENDIENTE);
    expect(x).toContain('href="/centinela/pestel/p1/datos"');
    expect(x).toContain("Ir a Centinela →");
    expect(x).toContain("Cancelar vínculo pendiente");
    expect(x).not.toMatch(/<button[^>]*disabled=""/);
    expect(h({ etapa: 6 })).toContain('href="/centinela/pestel/p1/analisis"');
    expect(h({ etapa: null })).toContain("/datos");
  });
  it("PESTEL archivado: lo dice y el enlace sigue (el proyecto existe)", () => {
    const x = h({ archivado: true });
    expect(x).toContain(TEXTO_PENDIENTE_ARCHIVADO);
    expect(x).toContain("Ir a Centinela →");
  });
  it("PESTEL borrado (huérfano): SIN enlace (no hay destino) pero se puede cancelar", () => {
    const x = h({ huerfano: true });
    expect(x).toContain(TEXTO_PENDIENTE_HUERFANO);
    expect(x).not.toContain("href=");
    expect(x).not.toMatch(/<button[^>]*disabled=""/);
  });
  it("Fase 2 cerrada: lo dice y la cancelación queda deshabilitada con su tooltip", () => {
    const x = h({ f2Cerrada: true });
    expect(x).toContain("la fase está cerrada: no se puede importar ni cancelar");
    expect(x).toMatch(/<button[^>]*disabled=""/);
    expect(x).toContain(`title="${TOOLTIP_FASE_CERRADA}"`);
  });
  it("cancelando: botón deshabilitado y su texto", () => {
    const x = h({ cancelando: true });
    expect(x).toContain("Cancelando…");
    expect(x).toMatch(/<button[^>]*disabled=""/);
  });
});

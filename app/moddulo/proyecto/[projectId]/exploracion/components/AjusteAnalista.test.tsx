// El ajuste del analista en la tarjeta de F2 (T3): desplegable accesible, cerrado por defecto. Sin DOM en la suite:
// se comprueba el marcado (renderToStaticMarkup), como SenalesGrupo.test.tsx. El clic se verifica en navegador.
import { describe, expect, it } from "vitest";
import { renderToStaticMarkup } from "react-dom/server";
import AjusteAnalista from "./AjusteAnalista";

const ajuste = {
  clasificacionOriginal: "AMENAZA" as const, clasificacionAjustada: "OPORTUNIDAD" as const,
  justificacion: "La coalición opositora se fracturó.\nSegundo párrafo de la justificación.", ajustadoEn: "2026-10-20T15:30:00.000Z",
};

describe("AjusteAnalista", () => {
  it("cerrado por defecto: botón «Ver el ajuste» con aria-expanded=false y sin la justificación en el marcado", () => {
    const h = renderToStaticMarkup(<AjusteAnalista ajuste={ajuste} />);
    expect(h).toContain("Ver el ajuste");
    expect(h).toContain('aria-expanded="false"');
    expect(h).toMatch(/<button[^>]*type="button"/);
    expect(h).not.toContain("coalición");
    expect(h).not.toContain("title=");
  });
  it("abierto: original → ajustada, justificación completa (con saltos) y la fecha; aria-expanded=true ligado a la región", () => {
    const h = renderToStaticMarkup(<AjusteAnalista ajuste={ajuste} abiertoInicial />);
    expect(h).toContain('aria-expanded="true"');
    expect(h).toContain("Ocultar el ajuste");
    expect(h).toContain("AMENAZA → OPORTUNIDAD");
    expect(h).toContain("La coalición opositora se fracturó.\nSegundo párrafo de la justificación.");
    expect(h).toContain("whitespace-pre-wrap");
    expect(h).toContain("Ajustado el 20 de octubre de 2026");
    const id = /aria-controls="([^"]+)"/.exec(h)![1];
    expect(h).toContain(`id="${id}"`);
  });
  it("sin fecha (o ilegible): no muestra la línea de fecha", () => {
    const h = renderToStaticMarkup(<AjusteAnalista ajuste={{ ...ajuste, ajustadoEn: undefined }} abiertoInicial />);
    expect(h).not.toContain("Ajustado el");
    expect(renderToStaticMarkup(<AjusteAnalista ajuste={{ ...ajuste, ajustadoEn: "no es fecha" }} abiertoInicial />)).not.toContain("Ajustado el");
  });
});

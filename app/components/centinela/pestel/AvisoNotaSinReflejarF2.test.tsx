// T7 C3b: marcado del aviso de la nota junto al botón. Sin DOM en la suite: renderToStaticMarkup no ejecuta efectos, así que
// el primer render equivale al estado «cargando»: NADA visible (sin parpadeo). El flujo con datos se prueba en
// `avisoNotaCentinela.test.ts` (lógica pura y carga silenciosa); la aparición tras el GET se verifica en navegador.
import { describe, expect, it } from "vitest";
import { renderToStaticMarkup } from "react-dom/server";
import AvisoNotaSinReflejarF2, { AvisoNotaSinReflejarF2Vista } from "./AvisoNotaSinReflejarF2";
import { TEXTO_NOTA_SIN_REFLEJAR_F2 } from "@/lib/centinela/pestel/notaAprobacion";

const APROBADO_39 = { id: "a1", status: "APPROVED", globalConfidence: 39, aprobacionJustificacion: "Con reservas documentadas." };

describe("AvisoNotaSinReflejarF2Vista", () => {
  it("visible: role=status con el texto que nombra el botón; no visible: nada", () => {
    const h = renderToStaticMarkup(<AvisoNotaSinReflejarF2Vista visible />);
    expect(h).toContain('role="status"');
    expect(h).toContain(TEXTO_NOTA_SIN_REFLEJAR_F2);
    expect(h).toContain("«Regresar a Moddulo F2 con resultados»");
    expect(h).not.toContain("<button");
    expect(renderToStaticMarkup(<AvisoNotaSinReflejarF2Vista visible={false} />)).toBe("");
  });
});

describe("AvisoNotaSinReflejarF2 (componente)", () => {
  it("mientras carga (primer render) no muestra nada, aunque vaya a preguntar: sin parpadeo", () => {
    expect(renderToStaticMarkup(<AvisoNotaSinReflejarF2 projectId="pest1" moddulo="m1" analysis={APROBADO_39} />)).toBe("");
  });
  it("sin vínculo, sin nota o sin análisis: nada", () => {
    expect(renderToStaticMarkup(<AvisoNotaSinReflejarF2 projectId="pest1" moddulo={null} analysis={APROBADO_39} />)).toBe("");
    expect(renderToStaticMarkup(<AvisoNotaSinReflejarF2 projectId="pest1" moddulo="m1" analysis={{ ...APROBADO_39, globalConfidence: 80 }} />)).toBe("");
    expect(renderToStaticMarkup(<AvisoNotaSinReflejarF2 projectId="pest1" moddulo="m1" analysis={null} />)).toBe("");
  });
});

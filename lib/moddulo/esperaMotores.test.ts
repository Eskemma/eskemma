import { describe, expect, it } from "vitest";
import { estadoEsperaMotores, LIMITE_ABORTAR_S, LIMITE_NORMAL_S, MENSAJE_ESPERA_EXCEDIDA, TEXTO_PROCESANDO_MOTORES } from "./esperaMotores";

describe("estadoEsperaMotores", () => {
  it("≤ 240 s normal; 240–310 s lenta; > 310 s excedida (bordes exactos)", () => {
    expect(estadoEsperaMotores(0)).toBe("normal");
    expect(estadoEsperaMotores(165)).toBe("normal");
    expect(estadoEsperaMotores(247)).toBe("lenta"); // peor caso con reintento de M5: ya es «lenta»
    expect(estadoEsperaMotores(LIMITE_NORMAL_S)).toBe("normal");
    expect(estadoEsperaMotores(LIMITE_NORMAL_S + 0.1)).toBe("lenta");
    expect(estadoEsperaMotores(LIMITE_ABORTAR_S)).toBe("lenta");
    expect(estadoEsperaMotores(LIMITE_ABORTAR_S + 0.1)).toBe("excedida");
    expect(estadoEsperaMotores(10_000)).toBe("excedida");
  });
  it("el límite de abortar queda por encima de los 300 s de la plataforma (el servidor corta primero)", () => {
    expect(LIMITE_ABORTAR_S).toBeGreaterThan(300);
  });
  it("el aviso persistente no afirma que el servidor no guardó, y ofrece las dos acciones", () => {
    expect(MENSAJE_ESPERA_EXCEDIDA).toContain("No se pudo CONFIRMAR que haya terminado");
    expect(MENSAJE_ESPERA_EXCEDIDA).not.toMatch(/no se guardó|sigue como estaba/i);
    expect(MENSAJE_ESPERA_EXCEDIDA).toContain("Revisar estado");
    expect(MENSAJE_ESPERA_EXCEDIDA).toContain("Reintentar generación");
  });
  it("el texto de proceso no nombra al proveedor del modelo", () => {
    expect(TEXTO_PROCESANDO_MOTORES).toBe("Generando análisis por motores…");
    expect(TEXTO_PROCESANDO_MOTORES).not.toMatch(/claude|anthropic/i);
  });
});

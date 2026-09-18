// lib/moddulo/extractedDataGrounding.test.ts
// Regresión del guard de grounding del chat de Moddulo. Los casos "real:"
// recrean, con el texto del usuario y el valor que el modelo persistió, los
// hallazgos del forense sobre conversaciones reales (26-09-18); los casos
// "formato legítimo" son los falsos positivos que un chequeo numérico ingenuo
// habría bloqueado (~93 %) y que el guard debe dejar pasar.

import { describe, expect, it } from "vitest";
import {
  construirAvisoRechazo,
  esConfirmacion,
  filtrarExtraccionSinRespaldo,
} from "./extractedDataGrounding";

const AHORA = new Date("2026-08-05T12:00:00Z");

/** Atajo: un turno con los mensajes del usuario y una extracción del modelo. */
function verificar(
  extraido: Record<string, unknown>,
  usuario: string[],
  extra: Partial<Parameters<typeof filtrarExtraccionSinRespaldo>[1]> = {}
) {
  const previos = usuario.slice(0, -1);
  const actual = usuario[usuario.length - 1] ?? "";
  return filtrarExtraccionSinRespaldo(extraido, {
    mensajesUsuarioPrevios: previos,
    mensajeActual: actual,
    ahora: AHORA,
    ...extra,
  });
}

const claves = (r: ReturnType<typeof verificar>) => r.rechazados.map((x) => x.clave);

// ------------------------------------------------------------------
describe("real: invenciones que el forense encontró y el guard debe bloquear", () => {
  // YgKs7M — el usuario describió la defensa del voto SIN dar ninguna cifra.
  const usuarioYgKs7M = [
    "Obtener la victoria en la elección presidencial de junio de 2030 mediante una pluralidad o mayoría relativa de votos (con una meta mínima estimada del 20-25% del total de la votación emitida).",
    "* War Room Estratégico: Equipo de estrategia política, dirección de datos/inteligencia electoral, área jurídica y coordinación de vocería/ComPol. * Estructura Territorial: Despliegue en las 32 entidades federativas y los 300 distritos electorales federales. * Defensa del Voto: Cobertura del 100% de las casillas en el país con Representantes de Casilla (RC) y Representantes Generales (RG) capacitados.",
    "(Día D): Junio de 2030. Fases Operativas: * Consolidación Posicional (2026–2028): Posicionamiento legislativo desde el Senado. * Campaña Federal (2030): Despliegue masivo en medios/redes.",
  ];

  it("bloquea '~170,000 representantes de casilla' (cifra que el usuario nunca dio)", () => {
    const r = verificar(
      {
        "xpcto.capacidades.humano":
          "War Room Estratégico (estrategia política, datos/inteligencia electoral, área jurídica, coordinación de vocería/ComPol). Estructura territorial en 32 entidades y 300 distritos electorales federales. Defensa del Voto con cobertura del 100% de casillas (~170,000 representantes de casilla).",
      },
      usuarioYgKs7M
    );
    expect(claves(r)).toEqual(["xpcto.capacidades.humano"]);
    expect(r.rechazados[0].sinRespaldo.join(" ")).toContain("170,000");
    expect(r.aceptados).toEqual({});
  });

  it("la MISMA descripción sin la cifra inventada sí pasa (32, 300 y 100% los dijo el usuario)", () => {
    const r = verificar(
      {
        "xpcto.capacidades.humano":
          "War Room Estratégico. Estructura territorial en 32 entidades y 300 distritos electorales federales. Defensa del Voto con cobertura del 100% de casillas. Cuantificación pendiente.",
      },
      usuarioYgKs7M
    );
    expect(r.rechazados).toEqual([]);
  });

  it("bloquea el día inventado: el usuario dijo 'junio de 2030' y se persistió 2030-06-01", () => {
    const r = verificar({ "xpcto.tiempo.fechaLimite": "2030-06-01" }, usuarioYgKs7M);
    expect(claves(r)).toEqual(["xpcto.tiempo.fechaLimite"]);
    expect(r.rechazados[0].sinRespaldo).toEqual(["2030-06-01"]);
  });

  it("eyfCma — 'No, la elección para Senadores está programada para Junio de 2030.' → 2030-06-01 bloqueado", () => {
    const r = verificar(
      { "xpcto.tiempo.fechaLimite": "2030-06-01", "xpcto.tiempo.duracionMeses": 46 },
      ["Ganar la senaduría de mayoría relativa de Oaxaca con un margen mayor al 20%.", "No, la elección para Senadores está programada para Junio de 2030."]
    );
    expect(claves(r)).toEqual(["xpcto.tiempo.fechaLimite"]);
    // duracionMeses se deriva de la fecha: si esta se descarta, también.
    expect(r.aceptados).toEqual({});
  });

  it("la fecha con precisión de mes ('2030-06' escrita como junio de 2030) sí pasa", () => {
    const r = verificar({ "xpcto.tiempo.fechaLimite": "Junio de 2030" }, usuarioYgKs7M);
    expect(r.rechazados).toEqual([]);
  });

  it("0MJW5m — 'MDP' con la cifra ya expandida ($1,500,000 MDP = error de unidad ×10⁶) se bloquea", () => {
    const usuario = ["Fondo inicial de inversión comunitaria (presupuesto estimado de operación: $1.5 a $2.5 MDP para la primera fase)."];
    const malo = verificar(
      { "xpcto.capacidades.financiero": "Presupuesto estimado de operación: $1,500,000 a $2,500,000 MDP para la primera fase." },
      usuario
    );
    expect(claves(malo)).toEqual(["xpcto.capacidades.financiero"]);
    // La versión corregida que el modelo emitió después sí es válida.
    const bueno = verificar(
      { "xpcto.capacidades.financiero": "Presupuesto estimado de operación: $1,500,000 a $2,500,000 MXN para la primera fase." },
      usuario
    );
    expect(bueno.rechazados).toEqual([]);
  });
});

// ------------------------------------------------------------------
describe("formato legítimo: falsos positivos del chequeo ingenuo que NO deben bloquearse", () => {
  it("'20 millones de pesos' ↔ 20,000,000", () => {
    const r = verificar(
      { "xpcto.capacidades.financiero": "Presupuesto estimado de 20,000,000 de pesos. Financiamiento predominantemente público." },
      ["Presupuesto estimado de 20 millones de pesos. Financiamiento predominantemente público."]
    );
    expect(r.rechazados).toEqual([]);
  });

  it.each([
    ["3 millones", "3,000,000"],
    ["50 millones de pesos", "50,000,000"],
    ["90 millones de pesos", "90,000,000"],
    ["10 millones de pesos", "10,000,000"],
    ["50 mil pesos", "50,000"],
    ["cincuenta millones de pesos", "50,000,000"],
    ["tres millones quinientos mil pesos", "3,500,000"],
    ["1.500.000 pesos", "1,500,000"],
    ["2.5 millones", "2,500,000"],
  ])("'%s' ↔ %s", (dicho, persistido) => {
    const r = verificar({ "xpcto.capacidades.financiero": `Presupuesto de ${persistido} pesos.` }, [`Tenemos ${dicho}.`]);
    expect(r.rechazados).toEqual([]);
  });

  it("fechas: '06/06/27' ↔ 2027-06-06 y '6 de junio de 2027' ↔ 2027-06-06", () => {
    expect(verificar({ "xpcto.tiempo.fechaLimite": "2027-06-06" }, ["06/06/27"]).rechazados).toEqual([]);
    expect(verificar({ "xpcto.tiempo.fechaLimite": "2027-06-06" }, ["Elecciones el 6 de junio de 2027"]).rechazados).toEqual([]);
    expect(verificar({ "xpcto.tiempo.fechaLimite": "2027-06-06" }, ["Fecha de la Elección (Día D): 06/06/27 (o la fecha oficial)"]).rechazados).toEqual([]);
  });

  it("fechas de inicio/fin dadas en dd/mm/aa ('01/09/26 al 28/02/28')", () => {
    const r = verificar(
      { "xpcto.tiempo.fechaInicio": "2026-09-01", "xpcto.tiempo.fechaLimite": "2028-02-28" },
      ["Horizonte de operación: 01/09/26 al 28/02/28"]
    );
    expect(r.rechazados).toEqual([]);
  });

  it("fecha relativa: '4 meses' → 'Diciembre 2026' (inferida desde la fecha actual)", () => {
    const r = verificar(
      { "xpcto.tiempo.fechaLimite": "Diciembre 2026", "xpcto.tiempo.duracionMeses": 4 },
      ["Horizonte de la Campaña: 4 meses (previo a la dictaminación)."],
      { ahora: new Date("2026-08-14T12:00:00Z") }
    );
    expect(r.rechazados).toEqual([]);
    expect(r.aceptados["xpcto.tiempo.duracionMeses"]).toBe(4);
  });

  it("fecha relativa NO justifica un día concreto ni un mes lejano", () => {
    const lejano = verificar({ "xpcto.tiempo.fechaLimite": "Junio 2029" }, ["Horizonte: 4 meses."], { ahora: new Date("2026-08-14T12:00:00Z") });
    expect(claves(lejano)).toEqual(["xpcto.tiempo.fechaLimite"]);
    const conDia = verificar({ "xpcto.tiempo.fechaLimite": "2026-12-15" }, ["Horizonte: 4 meses."], { ahora: new Date("2026-08-14T12:00:00Z") });
    expect(claves(conDia)).toEqual(["xpcto.tiempo.fechaLimite"]);
  });

  it("la fecha de hoy (fechaInicio = hoy) está respaldada por el propio sistema", () => {
    const r = verificar({ "xpcto.tiempo.fechaInicio": "2026-08-05" }, ["Empezamos ya."]);
    expect(r.rechazados).toEqual([]);
  });

  it("suma derivada de una lista que el usuario dio: 'Total: 20 personas' (nZvpYu)", () => {
    const r = verificar(
      { "xpcto.capacidades.humano": "Equipo multidisciplinario: 2 informáticos, 2 analistas de datos, 1 abogado, 1 contador, 5 personas con experiencia operativa y 9 voluntarios. Total: 20 personas." },
      ["Equipo: 2 informáticos, 2 analistas de datos, 1 abogado, 1 contador, 5 personas con experiencia en campañas y 9 voluntarios."]
    );
    expect(r.rechazados).toEqual([]);
  });

  it("producto derivado: '10 brigadas de 6' → 60 brigadistas", () => {
    const r = verificar(
      { "xpcto.capacidades.humano": "10 brigadas de promoción del voto de 6 integrantes (60 brigadistas)." },
      ["Estructura de campo: 10 brigadas de promoción del voto de 6 integrantes cada una."]
    );
    expect(r.rechazados).toEqual([]);
  });

  it("conteo derivado de una lista: '12 distritos' contados de 12 números dados", () => {
    const r = verificar(
      { "xpcto.capacidades.humano": "Estructura territorial en 12 distritos locales." },
      ["Coordinaciones en los distritos 1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11 y 12."]
    );
    expect(r.rechazados).toEqual([]);
  });

  it("años y rangos que el usuario escribió ('2021-2024', 'PEF 2024')", () => {
    const r = verificar(
      { "xpcto.sujeto": "Candidata. Ex diputada federal (2021-2024). Referencia: tope de gastos del PEF 2024." },
      ["Fue diputada federal (2021-2024). Presupuesto con referencia al tope de gastos del PEF 2024."]
    );
    expect(r.rechazados).toEqual([]);
  });

  it("duracionMeses no se verifica (la deriva el sistema) mientras su fecha sea válida", () => {
    const r = verificar(
      { "xpcto.tiempo.fechaLimite": "2027-06-06", "xpcto.tiempo.duracionMeses": 11 },
      ["06/06/27"],
      { ahora: new Date("2026-07-14T12:00:00Z") }
    );
    expect(r.rechazados).toEqual([]);
    expect(r.aceptados["xpcto.tiempo.duracionMeses"]).toBe(11);
  });

  it("cifras de un dígito no se verifican (conteos derivados triviales)", () => {
    const r = verificar({ "xpcto.capacidades.logistico": "Casa de campaña, bodega, 3 vehículos, 5 zonas." }, ["Tenemos casa de campaña y bodega."]);
    expect(r.rechazados).toEqual([]);
  });
});

// ------------------------------------------------------------------
describe("fuentes de respaldo y alcance", () => {
  it("los mensajes ANTERIORES del usuario en la fase también cuentan", () => {
    const r = verificar({ "xpcto.capacidades.financiero": "Presupuesto de 3,000,000 de pesos." }, [
      "Presupuesto estimado de 3 millones de pesos.",
      "Equipo de campaña coordinado por Omar.",
    ]);
    expect(r.rechazados).toEqual([]);
  });

  it("el texto de los adjuntos y el contexto inyectado por el sistema cuentan", () => {
    const conAdjunto = verificar({ "xpcto.capacidades.financiero": "Presupuesto de 3,000,000 de pesos." }, ["Toma los datos del documento."], {
      textoAdjuntos: ["[Archivo: plan.pdf]\nPresupuesto total estimado: $3,000,000 MXN"],
    });
    expect(conAdjunto.rechazados).toEqual([]);
    const conContexto = verificar({ "pestl.social.contexto": "Padrón de 1,200,345 electores." }, ["Sigue."], {
      textosContexto: ['{"sefix":{"padron":{"listaNominal":1200345}}}'],
    });
    expect(conContexto.rechazados).toEqual([]);
  });

  it("la confirmación corta del usuario ('sí, esa es') respalda lo que PROPUSO el asistente", () => {
    const propuesta = "Entonces la fecha límite es el 6 de junio de 2027, ¿correcto?\n```json\n{\"xpcto.tiempo.fechaLimite\":\"2031-01-01\"}\n```";
    const confirmada = verificar({ "xpcto.tiempo.fechaLimite": "2027-06-06" }, ["Sí, esa es la fecha."], { ultimoMensajeAsistente: propuesta });
    expect(confirmada.rechazados).toEqual([]);
    // Sin confirmación (el usuario dice otra cosa) la propuesta del asistente NO cuenta.
    const sinConfirmar = verificar({ "xpcto.tiempo.fechaLimite": "2027-06-06" }, ["Hablemos del presupuesto."], { ultimoMensajeAsistente: propuesta });
    expect(claves(sinConfirmar)).toEqual(["xpcto.tiempo.fechaLimite"]);
  });

  it("el JSON del propio asistente no puede autorizarse a sí mismo, ni siquiera con un 'sí'", () => {
    const propuesta = 'Registro esto.\n```json\n{"xpcto.tiempo.fechaLimite":"2031-01-01"}\n```';
    const r = verificar({ "xpcto.tiempo.fechaLimite": "2031-01-01" }, ["Sí."], { ultimoMensajeAsistente: propuesta });
    expect(claves(r)).toEqual(["xpcto.tiempo.fechaLimite"]);
  });

  it("solo se verifican los prefijos que el servidor persiste; el resto pasa intacto", () => {
    const r = verificar({ "investigacion.insightsClave": "Cobertura del 87.3%", "__action": "start_express", "__reasoning": "…12345…" }, ["Hola"]);
    expect(r.rechazados).toEqual([]);
    expect(Object.keys(r.aceptados)).toHaveLength(3);
  });

  it("una clave rechazada no arrastra a las válidas del mismo turno", () => {
    const r = verificar(
      { "xpcto.hito": "Ganar la elección de Guadalajara.", "xpcto.capacidades.financiero": "Presupuesto de 9,999,999 de pesos." },
      ["Ganar la elección de Guadalajara."]
    );
    expect(claves(r)).toEqual(["xpcto.capacidades.financiero"]);
    expect(r.aceptados).toEqual({ "xpcto.hito": "Ganar la elección de Guadalajara." });
  });

  it("verifica valores estructurados (arreglos/objetos como semaforo.actores)", () => {
    const r = verificar(
      { "semaforo.actores": [{ nombre: "Gobernador", nivel: "alto", descripcion: "Controla 47 de 60 curules" }] },
      ["El gobernador es un actor de veto."]
    );
    expect(claves(r)).toEqual(["semaforo.actores"]);
  });
});

// ------------------------------------------------------------------
describe("esConfirmacion y aviso", () => {
  it.each(["sí, esa es la fecha correcta.", "Correcto", "Sí, esos son los datos del proyecto.", "ok"])("'%s' es confirmación", (m) => {
    expect(esConfirmacion(m)).toBe(true);
  });
  it.each(["Hablemos del presupuesto", "no, es otra fecha", "Sí, pero cambia el presupuesto a 5 millones y además agrega a todo el equipo de la campaña anterior que ya conoces bien de otras elecciones porque fue muy importante para el resultado final"])(
    "'%s' NO es confirmación", (m) => { expect(esConfirmacion(m)).toBe(false); }
  );

  it("el aviso nombra el campo en lenguaje llano y la cifra sin respaldo", () => {
    const aviso = construirAvisoRechazo([{ clave: "xpcto.capacidades.humano", sinRespaldo: ["~170,000".replace("~", "")] }]);
    expect(aviso).toContain("Capacidades (humano)");
    expect(aviso).toContain("170,000");
    expect(aviso).not.toContain("xpcto.");
  });
});

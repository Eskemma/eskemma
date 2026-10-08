import { describe, expect, it } from "vitest";
import { crearCargadorSesion, type DepsCargador } from "./cargadorSesion";
import { TOPE_INTENTOS } from "./decidirSesionTrasError";

type U = { uid: string };
const err = (code: string) => Object.assign(new Error(code), { code });

function montar(opts: { leer: (u: U) => Promise<string | null> }) {
  const eventos: string[] = [];
  const timers: { fn: () => void; ms: number; cancelado: boolean }[] = [];
  const logs = { info: [] as unknown[][], warn: [] as unknown[][], error: [] as unknown[][] };
  let actual: U | null = { uid: "u1" };
  const deps: DepsCargador<U, string> = {
    leer: opts.leer,
    alVerificar: async (d) => { eventos.push(`verificar:${d}`); },
    alCerrar: async () => { eventos.push("cerrar"); },
    alUsuarioAusente: () => { eventos.push("ausente"); },
    alPendiente: () => { eventos.push("pendiente"); },
    alAgotar: () => { eventos.push("agotar"); },
    alErrorDesconocido: () => { eventos.push("desconocido"); },
    obtenerUsuarioActual: () => actual,
    programar: (fn, ms) => { const t = { fn, ms, cancelado: false }; timers.push(t); return t; },
    cancelarTimer: (h) => { (h as { cancelado: boolean }).cancelado = true; },
    log: {
      info: (...a) => logs.info.push(a),
      warn: (...a) => logs.warn.push(a),
      error: (...a) => logs.error.push(a),
    },
  };
  const c = crearCargadorSesion(deps);
  const activos = () => timers.filter((t) => !t.cancelado);
  const disparar = async () => { const t = activos()[0]; t.cancelado = true; t.fn(); await Promise.resolve(); await Promise.resolve(); await new Promise((r) => setImmediate(r)); };
  return { c, eventos, timers, logs, activos, disparar, setActual: (u: U | null) => { actual = u; } };
}

describe("cargadorSesion — errores", () => {
  it("transitorio: pendiente + warn (nunca error) + un solo temporizador de 2 s", async () => {
    const m = montar({ leer: async () => { throw err("auth/network-request-failed"); } });
    await m.c.cargar({ uid: "u1" });
    expect(m.eventos).toEqual(["pendiente"]);
    expect(m.logs.warn).toHaveLength(1);
    expect(m.logs.error).toHaveLength(0);
    expect(m.activos().map((t) => t.ms)).toEqual([2000]);
    expect(m.c.estado()).toBe("pendiente");
  });

  it("desconocido: como hoy (loading=false vía alErrorDesconocido) con console.error, sin reintento ni warn", async () => {
    const m = montar({ leer: async () => { throw err("auth/internal-error"); } });
    await m.c.cargar({ uid: "u1" });
    expect(m.eventos).toEqual(["desconocido"]);
    expect(m.logs.error).toHaveLength(1);
    expect(m.logs.warn).toHaveLength(0);
    expect(m.activos()).toHaveLength(0);
    expect(m.c.estado()).toBe("idle");
  });

  it("sesión inválida: cierra, sin reintento, sin error", async () => {
    const m = montar({ leer: async () => { throw err("auth/user-disabled"); } });
    await m.c.cargar({ uid: "u1" });
    expect(m.eventos).toEqual(["cerrar"]);
    expect(m.activos()).toHaveLength(0);
    expect(m.logs.error).toHaveLength(0);
  });

  it("sin usuario al leer → alUsuarioAusente", async () => {
    const m = montar({ leer: async () => null });
    await m.c.cargar({ uid: "u1" });
    expect(m.eventos).toEqual(["ausente"]);
  });
});

describe("cargadorSesion — reintentos", () => {
  it("backoff 2/5/10/20/30 s, tope y agotamiento (auto-recupera sin evento online)", async () => {
    const m = montar({ leer: async () => { throw err("unavailable"); } });
    await m.c.cargar({ uid: "u1" });
    const esperas = [m.activos()[0].ms];
    for (let i = 0; i < TOPE_INTENTOS - 1; i++) { await m.disparar(); esperas.push(m.activos()[0]?.ms ?? -1); }
    expect(esperas.slice(0, 5)).toEqual([2000, 5000, 10000, 20000, 30000]);
    expect(m.eventos.filter((e) => e === "agotar")).toHaveLength(0);
    await m.disparar(); // fallo número TOPE+1
    expect(m.eventos[m.eventos.length - 1]).toBe("agotar");
    expect(m.c.estado()).toBe("agotada");
    expect(m.activos()).toHaveLength(0);
  });

  it("too-many-requests usa 30 s y luego 60 s", async () => {
    const m = montar({ leer: async () => { throw err("auth/too-many-requests"); } });
    await m.c.cargar({ uid: "u1" });
    expect(m.activos()[0].ms).toBe(30000);
    await m.disparar();
    expect(m.activos()[0].ms).toBe(60000);
  });

  it("el reintento repite SOLO la lectura y la escritura corre una vez al tener éxito", async () => {
    let llamadas = 0;
    const m = montar({ leer: async () => { llamadas++; if (llamadas < 3) throw err("auth/network-request-failed"); return "datos"; } });
    await m.c.cargar({ uid: "u1" });
    await m.disparar();
    await m.disparar();
    expect(llamadas).toBe(3);
    expect(m.eventos.filter((e) => e.startsWith("verificar"))).toEqual(["verificar:datos"]);
    expect(m.c.estado()).toBe("idle");
    expect(m.activos()).toHaveLength(0);
  });

  it("un fallo tras armar el usuario no programa reintento", async () => {
    let n = 0;
    const m = montar({ leer: async () => { n++; if (n === 1) return "ok"; throw err("unavailable"); } });
    await m.c.cargar({ uid: "u1" });          // verifica
    await m.c.cargar({ uid: "u1" });          // nueva lectura falla transitoriamente
    expect(m.eventos).toEqual(["verificar:ok"]);
    expect(m.activos()).toHaveLength(0);
    expect(m.logs.warn).toHaveLength(1);
  });

  it("agotada: reintentarAhora (botón / online) reinicia el ciclo y vuelve a pendiente", async () => {
    let falla = true;
    const m = montar({ leer: async () => { if (falla) throw err("unavailable"); return "ok"; } });
    await m.c.cargar({ uid: "u1" });
    for (let i = 0; i < TOPE_INTENTOS; i++) await m.disparar();
    expect(m.c.estado()).toBe("agotada");
    falla = false;
    await m.c.reintentarAhora();
    expect(m.eventos).toContain("verificar:ok");
    expect(m.eventos.filter((e) => e === "pendiente").length).toBeGreaterThan(TOPE_INTENTOS - 1);
    expect(m.c.estado()).toBe("idle");
  });

  it("reintentarAhora no hace nada si no hay nada pendiente", async () => {
    const m = montar({ leer: async () => "ok" });
    await m.c.cargar({ uid: "u1" });
    await m.c.reintentarAhora();
    expect(m.eventos).toEqual(["verificar:ok"]);
  });
});

describe("cargadorSesion — concurrencia y cancelación", () => {
  it("una carga vieja que termina tarde no pisa a la nueva", async () => {
    let resolverVieja: (v: string) => void = () => {};
    let n = 0;
    const m = montar({
      leer: (u) => { n++; return n === 1 ? new Promise<string>((r) => { resolverVieja = r; }) : Promise.resolve("nueva"); },
    });
    const vieja = m.c.cargar({ uid: "u1" });
    await m.c.cargar({ uid: "u1" });
    resolverVieja("vieja");
    await vieja;
    expect(m.eventos).toEqual(["verificar:nueva"]);
  });

  it("un fallo viejo tras una carga nueva no programa nada ni marca pendiente", async () => {
    let rechazarVieja: (e: unknown) => void = () => {};
    let n = 0;
    const m = montar({
      leer: () => { n++; return n === 1 ? new Promise<string>((_, rej) => { rechazarVieja = rej; }) : Promise.resolve("nueva"); },
    });
    const vieja = m.c.cargar({ uid: "u1" });
    await m.c.cargar({ uid: "u1" });
    rechazarVieja(err("unavailable"));
    await vieja;
    expect(m.eventos).toEqual(["verificar:nueva"]);
    expect(m.activos()).toHaveLength(0);
  });

  it("cancelar() (cerrar sesión) con un reintento pendiente: no resucita la sesión", async () => {
    let n = 0;
    const m = montar({ leer: async () => { n++; if (n === 1) throw err("unavailable"); return "ok"; } });
    await m.c.cargar({ uid: "u1" });
    expect(m.activos()).toHaveLength(1);
    m.c.cancelar();
    expect(m.activos()).toHaveLength(0);
    expect(m.c.estado()).toBe("idle");
    expect(n).toBe(1);
    expect(m.eventos).toEqual(["pendiente"]);
  });

  it("si al disparar el reintento ya no hay usuario actual, no lee ni verifica", async () => {
    let n = 0;
    const m = montar({ leer: async () => { n++; throw err("unavailable"); } });
    await m.c.cargar({ uid: "u1" });
    m.setActual(null);
    await m.disparar();
    expect(n).toBe(1);
    expect(m.c.estado()).toBe("idle");
  });

  it("nunca hay más de un temporizador activo", async () => {
    const m = montar({ leer: async () => { throw err("unavailable"); } });
    await m.c.cargar({ uid: "u1" });
    await m.c.cargar({ uid: "u1" });
    await m.c.cargar({ uid: "u1" });
    expect(m.activos()).toHaveLength(1);
  });
});

describe("comportamiento ACTUAL (todo error → log + loading=false, sin signOut ni reintento)", () => {
  it("el nuevo cargador difiere en red y en sesión inválida", async () => {
    const actual = (_e: unknown) => ["desconocido"];
    for (const code of ["auth/network-request-failed", "auth/too-many-requests", "unavailable"]) {
      const m = montar({ leer: async () => { throw err(code); } });
      await m.c.cargar({ uid: "u1" });
      expect(m.eventos).not.toEqual(actual(code));
      expect(m.activos()).toHaveLength(1);
    }
    const m = montar({ leer: async () => { throw err("auth/user-token-expired"); } });
    await m.c.cargar({ uid: "u1" });
    expect(m.eventos).toEqual(["cerrar"]);
  });
});

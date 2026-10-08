import { describe, expect, it } from "vitest";
import {
  TOPE_INTENTOS,
  codigoDeError,
  conLimite,
  decidirSesionTrasError,
  esCargaVigente,
  esperaReintentoMs,
} from "./decidirSesionTrasError";

const err = (code: string) => Object.assign(new Error(code), { code });

describe("decidirSesionTrasError — tabla de códigos", () => {
  it.each([
    "auth/user-token-expired",
    "auth/user-disabled",
    "auth/invalid-user-token",
    "auth/user-not-found",
  ])("%s → cerrar, sin reintento", (code) => {
    expect(decidirSesionTrasError(err(code))).toEqual({ accion: "cerrar", reintentar: false, espera: "normal" });
  });

  it.each(["auth/network-request-failed", "unavailable", "deadline-exceeded"])(
    "%s → mantener y reintentar",
    (code) => {
      expect(decidirSesionTrasError(err(code))).toEqual({ accion: "mantener", reintentar: true, espera: "normal" });
    }
  );

  it("too-many-requests → mantener, reintentar con esperas largas", () => {
    expect(decidirSesionTrasError(err("auth/too-many-requests"))).toEqual({
      accion: "mantener", reintentar: true, espera: "larga",
    });
  });

  it("el prefijo firestore/ se normaliza", () => {
    expect(decidirSesionTrasError(err("firestore/unavailable")).reintentar).toBe(true);
  });

  it.each(["auth/internal-error", "permission-denied", "auth/requires-recent-login", "algo-raro"])(
    "%s (desconocido) → mantener SIN reintento",
    (code) => {
      expect(decidirSesionTrasError(err(code))).toEqual({ accion: "mantener", reintentar: false, espera: "normal" });
    }
  );
});

describe("decidirSesionTrasError — entradas que no son FirebaseError", () => {
  it("objeto plano {code} se clasifica por su código", () => {
    expect(decidirSesionTrasError({ code: "auth/network-request-failed" }).reintentar).toBe(true);
    expect(decidirSesionTrasError({ code: "auth/user-disabled" }).accion).toBe("cerrar");
  });
  it.each([null, undefined, "auth/user-disabled", 42, {}, { code: 7 }, [], new Error("sin code")])(
    "%j → mantener sin reintento (nunca cierra por un valor que no trae código)",
    (valor) => {
      expect(decidirSesionTrasError(valor)).toEqual({ accion: "mantener", reintentar: false, espera: "normal" });
    }
  );
  it("codigoDeError devuelve null sin código string", () => {
    expect(codigoDeError({ code: 1 })).toBeNull();
    expect(codigoDeError("x")).toBeNull();
  });
});

describe("comportamiento ACTUAL vs nuevo", () => {
  // Antes: cualquier error → console.error + setLoading(false); nunca signOut,
  // nunca reintento. El catch no distinguía nada.
  const antes = () => ({ cierra: false, reintenta: false, sueltaLoading: true });
  const ahora = (e: unknown) => {
    const d = decidirSesionTrasError(e);
    return { cierra: d.accion === "cerrar", reintenta: d.reintentar, sueltaLoading: !d.reintentar && d.accion !== "cerrar" };
  };
  it("difiere en red (reintenta y NO suelta loading) y en sesión inválida (cierra)", () => {
    for (const code of ["auth/network-request-failed", "unavailable", "auth/too-many-requests"]) {
      expect(ahora(err(code))).toEqual({ cierra: false, reintenta: true, sueltaLoading: false });
      expect(antes()).not.toEqual(ahora(err(code)));
    }
    for (const code of ["auth/user-disabled", "auth/user-token-expired"]) {
      expect(ahora(err(code)).cierra).toBe(true);
      expect(antes()).not.toEqual(ahora(err(code)));
    }
  });
  it("coincide con el comportamiento de hoy solo para errores desconocidos", () => {
    expect(ahora(err("auth/internal-error"))).toEqual(antes());
  });
});

describe("backoff", () => {
  it("2/5/10/20/30 s y luego 30 s hasta el tope", () => {
    expect([1, 2, 3, 4, 5, 6, 7, 8].map((i) => esperaReintentoMs(i, "normal"))).toEqual([
      2000, 5000, 10000, 20000, 30000, 30000, 30000, 30000,
    ]);
  });
  it("too-many-requests: 30 s y luego 60 s", () => {
    expect([1, 2, 3, 8].map((i) => esperaReintentoMs(i, "larga"))).toEqual([30000, 60000, 60000, 60000]);
  });
  it("tope: el intento TOPE_INTENTOS+1 ya no tiene espera; entradas inválidas tampoco", () => {
    expect(TOPE_INTENTOS).toBe(8);
    expect(esperaReintentoMs(TOPE_INTENTOS + 1, "normal")).toBeNull();
    expect(esperaReintentoMs(0, "normal")).toBeNull();
    expect(esperaReintentoMs(1.5, "normal")).toBeNull();
  });
});

describe("esCargaVigente", () => {
  it("solo la carga más reciente es vigente", () => {
    expect(esCargaVigente(3, 3)).toBe(true);
    expect(esCargaVigente(2, 3)).toBe(false);
  });
});

describe("conLimite (una escritura sin red no cuelga la carga)", () => {
  it("rechaza con deadline-exceeded si la promesa nunca resuelve", async () => {
    const colgada = new Promise<void>(() => {});
    await expect(conLimite(colgada, 20)).rejects.toMatchObject({ code: "deadline-exceeded" });
  });
  it("deja pasar el valor y el error de la promesa original", async () => {
    await expect(conLimite(Promise.resolve(5), 1000)).resolves.toBe(5);
    await expect(conLimite(Promise.reject(err("x")), 1000)).rejects.toMatchObject({ code: "x" });
  });
  it("el error de timeout es transitorio para la decisión (reintenta)", async () => {
    const e = await conLimite(new Promise<void>(() => {}), 10).catch((x) => x);
    expect(decidirSesionTrasError(e).reintentar).toBe(true);
  });
});

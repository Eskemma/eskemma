// lib/moddulo/storagePathAuth.test.ts
// Regresión del fix de IDOR de storagePath cross-tenant en F3
// (canal1/entregar, canal3/vincular — 2026-09-15). Antes de este fix,
// ambos endpoints aceptaban storagePath/reporteStoragePath del cliente
// sin validar que perteneciera al uid+projectId de la petición.

import { describe, expect, it } from "vitest";
import {
  esStoragePathDeUsuario,
  esUrlDeDescargaDelBucket,
  sonAdjuntosDeUsuario,
} from "./storagePathAuth";

const UID = "uidA";
const OTHER_UID = "uidB";
const PROJECT_ID = "projectA";
const OTHER_PROJECT_ID = "projectB";

describe("esStoragePathDeUsuario", () => {
  it("acepta el path propio del usuario en su propio proyecto", () => {
    const path = `moddulo/${UID}/${PROJECT_ID}/f3/resultado1/archivo.json`;
    expect(esStoragePathDeUsuario(path, UID, PROJECT_ID)).toBe(true);
  });

  it("rechaza el path de otro uid, aunque el projectId coincida", () => {
    const path = `moddulo/${OTHER_UID}/${PROJECT_ID}/f3/resultado1/archivo.json`;
    expect(esStoragePathDeUsuario(path, UID, PROJECT_ID)).toBe(false);
  });

  it("rechaza el path de otro projectId del mismo uid", () => {
    const path = `moddulo/${UID}/${OTHER_PROJECT_ID}/f3/resultado1/archivo.json`;
    expect(esStoragePathDeUsuario(path, UID, PROJECT_ID)).toBe(false);
  });

  it("rechaza un path vacío", () => {
    expect(esStoragePathDeUsuario("", UID, PROJECT_ID)).toBe(false);
  });

  it("rechaza un path malformado sin el prefijo moddulo/", () => {
    const path = "otra-coleccion/uidA/projectA/archivo.json";
    expect(esStoragePathDeUsuario(path, UID, PROJECT_ID)).toBe(false);
  });
});

// Chat de Moddulo (attachments[]): el cliente manda un arreglo y storagePath
// es opcional en el tipo — el helper es fail-closed, exige storagePath.
describe("sonAdjuntosDeUsuario", () => {
  const propio = `moddulo/${UID}/${PROJECT_ID}/fases/exploracion/attachments/abc-doc.pdf`;
  const ajeno = `moddulo/${OTHER_UID}/${PROJECT_ID}/fases/exploracion/attachments/abc-doc.pdf`;
  const otroProyecto = `moddulo/${UID}/${OTHER_PROJECT_ID}/fases/exploracion/attachments/abc-doc.pdf`;

  it("acepta un arreglo donde todos los adjuntos son propios", () => {
    const adjuntos = [{ storagePath: propio }, { storagePath: propio }];
    expect(sonAdjuntosDeUsuario(adjuntos, UID, PROJECT_ID)).toBe(true);
  });

  it("rechaza si UN solo adjunto es de otro uid, aunque los demás sean propios", () => {
    const adjuntos = [{ storagePath: propio }, { storagePath: ajeno }];
    expect(sonAdjuntosDeUsuario(adjuntos, UID, PROJECT_ID)).toBe(false);
  });

  it("rechaza un adjunto de otro projectId del mismo uid", () => {
    expect(sonAdjuntosDeUsuario([{ storagePath: otroProyecto }], UID, PROJECT_ID)).toBe(false);
  });

  it("rechaza un adjunto SIN storagePath (evita el fallback a fetch(url))", () => {
    expect(sonAdjuntosDeUsuario([{ url: "http://interno/algo" }], UID, PROJECT_ID)).toBe(false);
  });

  it("rechaza un storagePath que no es string", () => {
    expect(sonAdjuntosDeUsuario([{ storagePath: 123 }], UID, PROJECT_ID)).toBe(false);
  });

  it("rechaza formas inesperadas: no-arreglo, elemento null, elemento no-objeto", () => {
    expect(sonAdjuntosDeUsuario("no soy arreglo", UID, PROJECT_ID)).toBe(false);
    expect(sonAdjuntosDeUsuario({ length: 1 }, UID, PROJECT_ID)).toBe(false);
    expect(sonAdjuntosDeUsuario([null], UID, PROJECT_ID)).toBe(false);
    expect(sonAdjuntosDeUsuario(["texto"], UID, PROJECT_ID)).toBe(false);
  });
});

describe("esUrlDeDescargaDelBucket (allow-list anti-SSRF)", () => {
  const BUCKET = "eskemma-test.appspot.com";
  const OK = `https://firebasestorage.googleapis.com/v0/b/${BUCKET}/o/moddulo%2FuidA%2Fdoc.pdf?alt=media&token=t`;

  it("acepta la url de descarga de Firebase Storage del bucket propio", () => {
    expect(esUrlDeDescargaDelBucket(OK, BUCKET)).toBe(true);
  });

  it.each([
    ["http plano", OK.replace("https:", "http:")],
    ["otro host", `https://example.com/v0/b/${BUCKET}/o/x`],
    ["userinfo que disfraza el host", `https://firebasestorage.googleapis.com@evil.com/v0/b/${BUCKET}/o/x`],
    ["subdominio engañoso", `https://firebasestorage.googleapis.com.evil.com/v0/b/${BUCKET}/o/x`],
    ["bucket ajeno", "https://firebasestorage.googleapis.com/v0/b/otro-bucket/o/x"],
    ["prefijo de bucket parcial", `https://firebasestorage.googleapis.com/v0/b/${BUCKET}-evil/o/x`],
    ["puerto explícito", `https://firebasestorage.googleapis.com:8443/v0/b/${BUCKET}/o/x`],
    ["IMDS de la nube", "http://169.254.169.254/latest/meta-data/"],
    ["loopback", "http://127.0.0.1/"],
    ["IP decimal", "http://2130706433/"],
    ["basura", "no es una url"],
    ["vacía", ""],
  ])("rechaza: %s", (_caso, url) => {
    expect(esUrlDeDescargaDelBucket(url, BUCKET)).toBe(false);
  });

  it("rechaza valores que no son string (fail-closed)", () => {
    expect(esUrlDeDescargaDelBucket(undefined, BUCKET)).toBe(false);
    expect(esUrlDeDescargaDelBucket(null, BUCKET)).toBe(false);
    expect(esUrlDeDescargaDelBucket({ href: OK }, BUCKET)).toBe(false);
  });

  it("rechaza todo si el bucket no está configurado (fail-closed)", () => {
    expect(esUrlDeDescargaDelBucket(OK, undefined)).toBe(false);
    expect(esUrlDeDescargaDelBucket(OK, "")).toBe(false);
  });
});

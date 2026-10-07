// lib/moddulo/projectErrors.ts
// Errores tipados de las mutaciones de proyecto (H-M5, 26-10-07). Mismos mensajes que los
// `Error` genéricos que reemplazan; la ruta los traduce a 404 / 403 en vez de un 500 genérico.

export class ProyectoNoEncontradoError extends Error {
  constructor(message = "Proyecto no encontrado o sin acceso.") {
    super(message);
    this.name = "ProyectoNoEncontradoError";
  }
}

export class SinPermisosError extends Error {
  constructor(message = "Sin permisos para editar este proyecto.") {
    super(message);
    this.name = "SinPermisosError";
  }
}

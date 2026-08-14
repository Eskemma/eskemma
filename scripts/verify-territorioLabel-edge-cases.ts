import { extraerCiudadCabecera } from "../lib/moddulo/territorioLabel";

console.log("Legado con frase:", extraerCiudadCabecera("Distrito Electoral Federal V, con cabecera en Puerto Vallarta, Jalisco, México."));
console.log("Nuevo (nombre limpio):", extraerCiudadCabecera("IZTAPALAPA"));
console.log("null:", extraerCiudadCabecera(null));
console.log("undefined:", extraerCiudadCabecera(undefined));
console.log("string vacío:", JSON.stringify(extraerCiudadCabecera("")));
console.log("solo espacios:", JSON.stringify(extraerCiudadCabecera("   ")));

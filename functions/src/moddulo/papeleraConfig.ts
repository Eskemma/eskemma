// functions/src/moddulo/papeleraConfig.ts
// Copia manual de lib/moddulo/papelera.ts (DIAS_RETENCION_PROYECTOS) —
// functions/ no puede importar lib/ (Regla de Oro del repo). A diferencia de
// functions/src/utils/country.ts (deuda conocida, sin guard), esta copia
// tiene guard desde el día uno: lib/moddulo/papeleraConfig.test.ts falla si
// este número diverge del de lib/moddulo/papelera.ts.
export const DIAS_RETENCION_PROYECTOS = 30;

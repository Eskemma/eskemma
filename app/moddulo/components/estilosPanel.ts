// C4b-2b — clases compartidas por el panel «Historial» y su vista «Volver» (mismos pares de color ya medidos en
// `contrastePanelHistorial.test.ts`; la vista no introduce colores nuevos).
export const ENFOCABLES = 'a[href], button:not([disabled]), input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])';
export const FOCO = "focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-bluegreen-eske dark:focus-visible:outline-blue-eske-30";
export const BOTON = `inline-flex min-h-[44px] items-center justify-center rounded-lg border border-bluegreen-eske px-3 text-sm font-medium text-bluegreen-eske transition-colors hover:bg-bluegreen-eske/10 disabled:opacity-50 sm:min-h-[36px] dark:border-blue-eske-30 dark:text-blue-eske-30 dark:hover:bg-blue-eske-30/10 ${FOCO}`;
export const TEXTO_PROCESO = "text-sm text-red-eske-60 dark:text-red-eske-10";
export const CAJA_AVISO = "rounded-lg border border-yellow-eske/40 bg-yellow-eske/10 px-3 py-2 text-sm text-brown-eske-60 dark:text-yellow-eske";
export const CAJA_ERROR = "rounded-lg bg-red-eske/10 px-3 py-2 text-sm text-red-eske-60 dark:text-red-eske-10";
export const SECUNDARIO = "text-black-eske-20 dark:text-[#9AAEBE]";

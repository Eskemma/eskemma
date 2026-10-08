// Panel de error para listas que no cargaron (hubs de Moddulo, PESTEL, Fontana).
// Una carga fallida nunca se presenta como lista vacía. Contraste medido:
// 5.93:1 claro / 5.42:1 oscuro sobre el tinte bg-red-eske/10.

export default function ErrorCarga({
  mensaje,
  onReintentar,
  compacto = false,
}: {
  mensaje: string | null;
  onReintentar: () => void;
  compacto?: boolean;
}) {
  return (
    <div
      role="alert"
      className={`flex flex-wrap items-center gap-3 rounded-xl border border-red-eske/30 bg-red-eske/10 ${
        compacto ? "px-4 py-2.5 mb-6 text-xs" : "p-8 mb-12 justify-center text-sm"
      } text-red-eske-60 dark:text-red-eske-10`}
    >
      <span>{mensaje ?? "No se pudo cargar la lista."}</span>
      <button
        type="button"
        onClick={onReintentar}
        className="font-semibold underline underline-offset-2 hover:opacity-80 focus-visible:outline focus-visible:outline-2"
      >
        Reintentar
      </button>
    </div>
  );
}

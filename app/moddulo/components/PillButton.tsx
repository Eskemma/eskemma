// app/moddulo/components/PillButton.tsx
// Botón pill compartido — variantes outline (acciones secundarias) y solid
// (acción de cierre de fase). Mismas clases que F1/F2 ya usan como
// constantes locales (btnBase/btnClose) — extraído aquí para que F3 no sea
// una tercera copia-pega. F1/F2 no se tocan.

interface PillButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: "outline" | "solid";
}

export default function PillButton({ variant = "outline", className = "", ...props }: PillButtonProps) {
  const base = "px-2.5 py-1.5 rounded-full text-xs font-semibold disabled:opacity-30 disabled:cursor-not-allowed transition-colors";
  const variantClass =
    variant === "solid"
      ? "bg-bluegreen-eske-60 text-white-eske"
      : "border border-bluegreen-eske-60 text-bluegreen-eske-60 bg-transparent hover:bg-bluegreen-eske/5";

  return <button className={`${base} ${variantClass} ${className}`} {...props} />;
}

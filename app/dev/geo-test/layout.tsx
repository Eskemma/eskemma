// app/dev/geo-test/layout.tsx
// Página de prueba SOLO para desarrollo local. En producción el 404 real lo da
// proxy.ts (matcher "/dev/:path*"); esta guarda es la segunda capa: si el proxy
// no la interceptara, la página mostraría «no encontrada» (con estado HTTP 200,
// porque un notFound() de layout no fija el 404 en este árbol).
// Basta en el layout porque esta página no lee ningún secreto; una página de
// /dev que sí los lea debe llevar la guarda en su propio page.tsx.
import { notFound } from "next/navigation";
import type { ReactNode } from "react";

export default function GeoTestLayout({ children }: { children: ReactNode }) {
  if (process.env.NODE_ENV === "production") notFound();
  return <>{children}</>;
}

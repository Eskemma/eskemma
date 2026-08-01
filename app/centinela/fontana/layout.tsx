// app/centinela/fontana/layout.tsx
// Metadata for the Fontana section — all routes are authenticated, noindex.
// Mismo criterio que app/centinela/pestel/layout.tsx.
import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Centinela Fontana | Eskemma",
  robots: { index: false, follow: false },
};

export default function FontanaLayout({ children }: { children: React.ReactNode }) {
  return <>{children}</>;
}

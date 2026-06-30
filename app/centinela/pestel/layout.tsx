// app/centinela/pestel/layout.tsx
// Metadata for the PESTEL section — all routes are authenticated, noindex.
import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Centinela PESTEL | Eskemma",
  robots: { index: false, follow: false },
};

export default function PESTELLayout({ children }: { children: React.ReactNode }) {
  return <>{children}</>;
}

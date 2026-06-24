import { ReactNode } from "react";

export default function SefixLayout({ children }: { children: ReactNode }) {
  return (
    <>
      <link rel="stylesheet" href="/leaflet.css" />
      {children}
    </>
  );
}

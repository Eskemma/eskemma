// lib/shared/extractHeadings.ts
// Extrae encabezados de un string Markdown crudo para armar un índice de
// navegación (Tabla de Contenidos) — misma lógica que ya usaba
// lib/posts.ts (blog) para sus TableOfContents, generalizada aquí para que
// cualquier consumidor compartido (MethodologyDocView, futuros documentos
// estáticos de otras apps del ecosistema) la use sin duplicarla.
//
// El `id` que calcula (slug simple, minúsculas + guiones) debe coincidir
// exactamente con el `id` que el renderer de markdown asigna a cada
// heading — ver MethodologyDocView.tsx, que usa este mismo `slugifyHeading`
// para los componentes h2/h3 de react-markdown.

export interface HeadingInfo {
  level: number;
  text: string;
  id: string;
}

/** Normaliza el texto de un heading al mismo slug usado como `id` del DOM. */
export function slugifyHeading(text: string): string {
  return text
    .toLowerCase()
    .replace(/[^a-z0-9áéíóúñ\s-]/g, "")
    .replace(/\s+/g, "-");
}

/** Quita marcado inline (negritas, cursivas, code, tachado) de un heading. */
function limpiarMarcado(text: string): string {
  return text
    .replace(/\*\*/g, "")
    .replace(/\*/g, "")
    .replace(/`/g, "")
    .replace(/~~(.*?)~~/g, "$1")
    .trim();
}

export function extractHeadings(content: string): HeadingInfo[] {
  const headingRegex = /^(#{1,6})\s+(.+)$/gm;
  const headings: HeadingInfo[] = [];
  let match;

  while ((match = headingRegex.exec(content)) !== null) {
    const level = match[1].length;
    const text = limpiarMarcado(match[2].trim());
    const id = slugifyHeading(text);
    headings.push({ level, text, id });
  }

  return headings;
}

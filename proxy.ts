// proxy.ts
// Fase 3 — Middleware de protección de rutas (renombrado de middleware.ts a proxy.ts en Next.js 16)
//
// Intercepta rutas protegidas y verifica la cookie de sesión antes de
// permitir el acceso. Usa Firebase Admin SDK (Node.js runtime).

import { NextRequest, NextResponse } from "next/server";
import { getSession } from "@/lib/session";
import { SESSION_CONFIG } from "@/lib/session-config";
import { ROLE_HIERARCHY } from "@/utils/courseAccessUtils";
import type { UserRole } from "@/types/subscription.types";

// ─────────────────────────────────────────────────────────────
// Tabla de rutas protegidas y rol mínimo requerido
// ─────────────────────────────────────────────────────────────
const PROTECTED_ROUTES: Array<{ pattern: RegExp; requiredRole: UserRole }> = [
  // ✅ Fase 3 — Admin
  { pattern: /^\/admin/, requiredRole: "admin" },
  { pattern: /^\/blog\/admin/, requiredRole: "admin" },

  // ✅ Fase 4 — Usuarios autenticados
  // { pattern: /^\/moddulo/, requiredRole: "user" },
  // { pattern: /^\/profile/, requiredRole: "registered" },
  // { pattern: /^\/cursos/, requiredRole: "user" },
  // /sefix es público — sin restricción de rol
  // { pattern: /^\/centinela/, requiredRole: "user" },
  // { pattern: /^\/recursos/, requiredRole: "user" },
];

// ─────────────────────────────────────────────────────────────
// Helper: compara el rol del usuario contra el rol requerido
// usando la jerarquía definida en courseAccessUtils.ts
// ─────────────────────────────────────────────────────────────
function hasRequiredRole(userRole: UserRole, requiredRole: UserRole): boolean {
  const userLevel = ROLE_HIERARCHY[userRole] ?? -1;
  const requiredLevel = ROLE_HIERARCHY[requiredRole] ?? 0;
  return userLevel >= requiredLevel;
}

// ─────────────────────────────────────────────────────────────
// Proxy principal (equivalente al middleware en Next.js < 16)
// ─────────────────────────────────────────────────────────────
export async function proxy(request: NextRequest) {
  const { pathname } = request.nextUrl;

  const rule = PROTECTED_ROUTES.find((r) => r.pattern.test(pathname));

  if (!rule) {
    return NextResponse.next();
  }

  const cookieValue = request.cookies.get(SESSION_CONFIG.COOKIE_NAME)?.value;

  if (!cookieValue) {
    console.warn(`[proxy] Acceso sin sesión bloqueado: ${pathname}`);
    return NextResponse.redirect(new URL("/", request.url));
  }

  // getSession() verifica la cookie Y lee el rol desde Firestore,
  // garantizando que siempre refleje el estado actual del usuario
  // aunque el JWT interno tenga claims desactualizados.
  const { session } = await getSession(cookieValue);

  if (!session) {
    console.warn(`[proxy] Cookie inválida o expirada en: ${pathname}`);
    const response = NextResponse.redirect(new URL("/", request.url));
    response.cookies.set(SESSION_CONFIG.COOKIE_NAME, "", { maxAge: 0, path: "/" });
    return response;
  }

  if (!hasRequiredRole(session.role, rule.requiredRole)) {
    console.warn(
      `[proxy] Acceso denegado a ${pathname} — rol: ${session.role}, requerido: ${rule.requiredRole}`
    );
    return NextResponse.redirect(new URL("/", request.url));
  }

  return NextResponse.next();
}

// ─────────────────────────────────────────────────────────────
// Matcher: rutas que el proxy intercepta
// ─────────────────────────────────────────────────────────────
export const config = {
  matcher: [
    "/admin/:path*",
    "/blog/admin/:path*",
    "/moddulo/:path*",
    "/profile/:path*",
    "/cursos/:path*",
    // /sefix no está en el matcher — acceso público sin interceptar
    "/centinela/:path*",
    "/recursos/:path*",
  ],
};

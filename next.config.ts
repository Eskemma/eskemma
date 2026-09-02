import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Imágenes permitidas
  images: {
    remotePatterns: [
      {
        protocol: "https",
        hostname: "images.unsplash.com",
        port: "",
        pathname: "/**",
      },
      {
        protocol: "https",
        hostname: "plus.unsplash.com",
        port: "",
        pathname: "/**",
      },
      {
        protocol: "https",
        hostname: "firebasestorage.googleapis.com",
        port: "",
        pathname: "/**",
      },
      {
        protocol: "https",
        hostname: "lh3.googleusercontent.com",
        port: "",
        pathname: "/**",
      },
    ],
  },

  // Redirect 301 — renombrado de URL
  async redirects() {
    return [
      {
        source: '/condiciones-asesorias-gratuitas',
        destination: '/condiciones-sesiones-diagnostico-gratuitas',
        permanent: true,
      },
    ];
  },

  // Headers de seguridad, SEO y caché
  async headers() {
    const isProduction = process.env.NEXT_PUBLIC_ENVIRONMENT === 'production';

    return [
      {
        // Caché de larga duración para assets estáticos de /public/
        source: '/:path(icons|images)/:file*',
        headers: [
          {
            key: 'Cache-Control',
            value: 'public, max-age=31536000, immutable',
          },
        ],
      },
      {
        // Headers globales para todas las rutas
        source: '/:path*',
        headers: [
          // Control de indexación
          {
            key: 'X-Robots-Tag',
            value: isProduction ? 'index, follow' : 'noindex, nofollow',
          },
          // Seguridad
          {
            key: 'X-Frame-Options',
            value: 'SAMEORIGIN',
          },
          {
            key: 'X-Content-Type-Options',
            value: 'nosniff',
          },
          {
            key: 'Referrer-Policy',
            value: 'strict-origin-when-cross-origin',
          },
          {
            key: 'Permissions-Policy',
            value: 'camera=(), microphone=(), geolocation=()',
          },
        ],
      },
      {
        // Permitir iframe de Shiny Apps SOLO en /sefix
        source: '/sefix',
        headers: [
          {
            key: 'Content-Security-Policy',
            value: "frame-src 'self' https://*.shinyapps.io https://kj6hbt-ra0l-s0nchez.shinyapps.io;",
          },
        ],
      },
      {
        // Dictado de voz del chat de Fontana (Web Speech API): necesita el
        // micrófono. Solo esta ruta lo habilita; el resto del sitio mantiene
        // el `microphone=()` global de arriba. Va DESPUÉS del bloque global
        // para que gane esta entrada (Next.js: última coincidencia con la
        // misma `key` prevalece).
        source: '/centinela/fontana',
        headers: [
          {
            key: 'Permissions-Policy',
            value: 'camera=(), microphone=(self), geolocation=()',
          },
        ],
      },
    ];
  },

  // TypeScript estricto
  typescript: {
    ignoreBuildErrors: false,
  },
  
  // Optimizaciones
  compress: true,
  poweredByHeader: false,
};

export default nextConfig;


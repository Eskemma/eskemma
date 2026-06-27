// app/robots.ts
import { MetadataRoute } from 'next';

export default function robots(): MetadataRoute.Robots {
  const isProduction = process.env.NEXT_PUBLIC_ENVIRONMENT === 'production';
  const baseUrl = process.env.NEXT_PUBLIC_SITE_URL || 'https://eskemma.com';
  
  // Bloquear indexación en desarrollo/staging
  if (!isProduction) {
    return {
      rules: {
        userAgent: '*',
        disallow: '/',
      },
    };
  }

  // Permitir indexación en producción (rutas autenticadas bloqueadas)
  return {
    rules: [
      {
        userAgent: '*',
        allow: '/',
        disallow: [
          '/api/',
          '/admin/',
          '/blog/admin/',
          '/_next/',
          '/private/',
          // Rutas de trabajo autenticado — no indexables
          '/moddulo/proyecto/',
          '/centinela/pestel/',
          '/sefix/dashboard/',
        ],
      },
      {
        userAgent: 'Googlebot',
        allow: '/',
        disallow: [
          '/api/',
          '/admin/',
          '/blog/admin/',
          '/moddulo/proyecto/',
          '/centinela/pestel/',
          '/sefix/dashboard/',
        ],
      },
    ],
    sitemap: `${baseUrl}/sitemap.xml`,
  };
}

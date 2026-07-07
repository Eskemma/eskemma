// app/politica-de-cookies/page.tsx
import Link from "next/link";
import Button from "../components/Button";
import TableOfContents, { TocItem } from "../components/legal/TableOfContents";
import LegalSection from "../components/legal/LegalSection";
import LegalHero from "../components/legal/LegalHero";
import CookieConfigButton from "../components/legal/CookieConfigButton";
import CloseModalsOnMount from "../components/legal/CloseModalsOnMount";

export const metadata = {
  title: "Política de Cookies | Eskemma",
  description: "Información detallada sobre el uso de cookies en Eskemma",
};

// Índice de secciones
const tocItems: TocItem[] = [
  { id: "que-son-cookies", title: "1. ¿Qué son las Cookies?" },
  { id: "cookies-que-usamos", title: "2. Cookies que Utilizamos" },
  { id: "cookies-esenciales", title: "3. Cookies Esenciales", level: 2 },
  { id: "cookies-analiticas", title: "4. Cookies Analíticas", level: 2 },
  { id: "cookies-marketing", title: "5. Cookies de Marketing", level: 2 },
  { id: "gestion-cookies", title: "6. Gestión de Cookies" },
  {
    id: "configurar-cookies",
    title: "7. Cómo Configurar tus Cookies",
    level: 2,
  },
  {
    id: "desactivar-navegador",
    title: "8. Desactivar desde tu Navegador",
    level: 2,
  },
  { id: "duracion-cookies", title: "9. Duración de las Cookies" },
  { id: "actualizaciones", title: "10. Actualizaciones de esta Política" },
  { id: "contacto", title: "11. Contacto" },
];

export default function PoliticaDeCookiesPage() {
  return (
    <div className="min-h-screen bg-white-eske dark:bg-[#0B1620]">
      <CloseModalsOnMount />
      {/* Hero Section */}
      <LegalHero
        title="Política de Cookies"
        subtitle="En Eskemma utilizamos cookies para mejorar tu experiencia de navegación y ofrecerte servicios personalizados. Aquí te explicamos qué son, cómo las usamos y cómo puedes gestionarlas."
        lastUpdated="12 de diciembre de 2025"
      />

      <div className="w-[90%] max-w-screen-xl mx-auto py-12">
        {/* Botón de Configuración Rápida */}
        <div className="mb-12 p-6 bg-bluegreen-eske-10 dark:bg-[#112230] border-2 border-bluegreen-eske dark:border-[#4791B3] rounded-lg">
          <div className="flex flex-col md:flex-row items-center justify-between gap-4">
            <div className="flex-1">
              <h3 className="text-[18px] font-bold text-bluegreen-eske dark:text-blue-eske-40 mb-2">
                Configuración de Cookies
              </h3>
              <p className="text-[14px] text-black-eske-20 dark:text-[#C7D6E0]">
                Puedes cambiar tus preferencias de cookies en cualquier momento.
                Haz clic en el botón para abrir el panel de configuración.
              </p>
            </div>
            <CookieConfigButton />
          </div>
        </div>

        {/* Layout con TableOfContents */}
        <div className="lg:grid lg:grid-cols-[280px_1fr] lg:gap-8">
          {/* Table of Contents */}
          <TableOfContents items={tocItems} title="Contenido" />

          {/* Contenido Principal */}
          <div className="lg:col-start-2">
            {/* 1. ¿Qué son las Cookies? */}
            <LegalSection id="que-son-cookies" title="1. ¿Qué son las Cookies?">
              <p className="mb-4">
                Las cookies son pequeños archivos de texto que se almacenan en
                tu dispositivo (ordenador, tablet o móvil) cuando visitas un
                sitio web. Estos archivos permiten que el sitio web recuerde
                información sobre tu visita, como tus preferencias de idioma, tu
                sesión de usuario, y otros datos que facilitan tu navegación.
              </p>
              <p className="mb-4">
                Las cookies pueden ser establecidas por el sitio web que estás
                visitando (cookies propias) o por terceros que ofrecen servicios
                al sitio web (cookies de terceros).
              </p>
              <div className="bg-gray-eske-10 dark:bg-[#112230] p-4 rounded-lg border-l-4 border-bluegreen-eske">
                <p className="text-[14px] text-black-eske-20 dark:text-[#C7D6E0]">
                  <strong className="text-bluegreen-eske dark:text-blue-eske-40">
                    💡 Importante:
                  </strong>{" "}
                  Las cookies NO son virus ni programas maliciosos. Son
                  simplemente archivos de texto que no pueden ejecutar código en
                  tu dispositivo.
                </p>
              </div>
            </LegalSection>

            {/* 2. Cookies que Utilizamos */}
            <LegalSection
              id="cookies-que-usamos"
              title="2. Cookies que Utilizamos"
            >
              <p className="mb-4">
                En Eskemma utilizamos diferentes tipos de cookies según su
                finalidad y duración. A continuación, te explicamos cada
                categoría en detalle:
              </p>

              <div className="space-y-4 mb-6">
                <div className="flex items-start gap-3 p-4 bg-green-eske-10 dark:bg-green-900/20 border-2 border-green-eske dark:border-green-700 rounded-lg">
                  <span className="text-2xl flex-shrink-0">🔒</span>
                  <div>
                    <h4 className="font-bold text-[16px] text-black-eske dark:text-[#EAF2F8] mb-1">
                      Cookies Esenciales
                    </h4>
                    <p className="text-[14px] text-black-eske-20 dark:text-[#C7D6E0]">
                      Necesarias para el funcionamiento básico del sitio. No se
                      pueden desactivar.
                    </p>
                  </div>
                </div>

                <div className="flex items-start gap-3 p-4 bg-gray-eske-10 dark:bg-[#21425E] border-2 border-gray-eske-40 dark:border-white/10 rounded-lg">
                  <span className="text-2xl flex-shrink-0">📈</span>
                  <div>
                    <h4 className="font-bold text-[16px] text-black-eske dark:text-[#EAF2F8] mb-1">
                      Cookies Analíticas
                    </h4>
                    <p className="text-[14px] text-black-eske-20 dark:text-[#C7D6E0]">
                      Nos ayudan a entender cómo usas el sitio para mejorarlo.
                      Totalmente opcionales.
                    </p>
                  </div>
                </div>

                <div className="flex items-start gap-3 p-4 bg-gray-eske-10 dark:bg-[#21425E] border-2 border-gray-eske-40 dark:border-white/10 rounded-lg">
                  <span className="text-2xl flex-shrink-0">📢</span>
                  <div>
                    <h4 className="font-bold text-[16px] text-black-eske dark:text-[#EAF2F8] mb-1">
                      Cookies de Marketing
                    </h4>
                    <p className="text-[14px] text-black-eske-20 dark:text-[#C7D6E0]">
                      Permiten mostrarte anuncios relevantes en otras
                      plataformas. Totalmente opcionales.
                    </p>
                  </div>
                </div>
              </div>
            </LegalSection>

            {/* 3. Cookies Esenciales */}
            <LegalSection
              id="cookies-esenciales"
              title="3. Cookies Esenciales"
              level={2}
            >
              <p className="mb-4">
                Las cookies esenciales son necesarias para el funcionamiento
                básico del sitio web y no se pueden desactivar. Sin estas
                cookies, no podríamos ofrecerte servicios básicos como la
                autenticación de usuario o la seguridad del sitio.
              </p>

              <div className="overflow-x-auto mb-6">
                <table className="w-full border-2 border-gray-eske-40 rounded-lg overflow-hidden">
                  <thead className="bg-bluegreen-eske-20 dark:bg-[#112230]">
                    <tr>
                      <th className="text-left p-3 border-b-2 border-gray-eske-40 text-[14px] font-bold">
                        Cookie
                      </th>
                      <th className="text-left p-3 border-b-2 border-gray-eske-40 text-[14px] font-bold">
                        Finalidad
                      </th>
                      <th className="text-left p-3 border-b-2 border-gray-eske-40 text-[14px] font-bold">
                        Duración
                      </th>
                    </tr>
                  </thead>
                  <tbody>
                    <tr className="border-b border-gray-eske-40">
                      <td className="p-3 text-[13px] font-mono bg-gray-eske-10 dark:bg-[#112230]">
                        session_token
                      </td>
                      <td className="p-3 text-[14px]">
                        Mantiene tu sesión activa después de iniciar sesión
                      </td>
                      <td className="p-3 text-[14px]">7 días</td>
                    </tr>
                    <tr className="border-b border-gray-eske-40">
                      <td className="p-3 text-[13px] font-mono bg-gray-eske-10 dark:bg-[#112230]">
                        csrf_token
                      </td>
                      <td className="p-3 text-[14px]">
                        Protege contra ataques de falsificación de solicitudes
                        (CSRF)
                      </td>
                      <td className="p-3 text-[14px]">Sesión</td>
                    </tr>
                    <tr className="border-b border-gray-eske-40">
                      <td className="p-3 text-[13px] font-mono bg-gray-eske-10 dark:bg-[#112230]">
                        cookie_consent
                      </td>
                      <td className="p-3 text-[14px]">
                        Almacena tus preferencias de cookies
                      </td>
                      <td className="p-3 text-[14px]">1 año</td>
                    </tr>
                    <tr>
                      <td className="p-3 text-[13px] font-mono bg-gray-eske-10 dark:bg-[#112230]">
                        language_preference
                      </td>
                      <td className="p-3 text-[14px]">
                        Recuerda tu idioma preferido
                      </td>
                      <td className="p-3 text-[14px]">1 año</td>
                    </tr>
                  </tbody>
                </table>
              </div>

              <div className="bg-green-eske-10 dark:bg-green-900/20 p-4 rounded-lg border-l-4 border-green-eske dark:border-green-700">
                <p className="text-[14px] text-black-eske-20 dark:text-[#C7D6E0]">
                  <strong className="text-green-eske-20">
                    Siempre Activas:
                  </strong>{" "}
                  Estas cookies son necesarias para el funcionamiento del sitio
                  y no requieren tu consentimiento explícito según la
                  legislación de cookies.
                </p>
              </div>
            </LegalSection>

            {/* 4. Cookies Analíticas */}
            <LegalSection
              id="cookies-analiticas"
              title="4. Cookies Analíticas"
              level={2}
            >
              <p className="mb-4">
                Las cookies analíticas nos ayudan a entender cómo los usuarios
                interactúan con nuestro sitio web. Esta información nos permite
                mejorar la experiencia de usuario y optimizar nuestros
                servicios. <strong>Todos los datos se anonimizan</strong> antes
                de ser analizados.
              </p>

              <div className="overflow-x-auto mb-6">
                <table className="w-full border-2 border-gray-eske-40 rounded-lg overflow-hidden">
                  <thead className="bg-bluegreen-eske-20 dark:bg-[#112230]">
                    <tr>
                      <th className="text-left p-3 border-b-2 border-gray-eske-40 text-[14px] font-bold">
                        Cookie
                      </th>
                      <th className="text-left p-3 border-b-2 border-gray-eske-40 text-[14px] font-bold">
                        Proveedor
                      </th>
                      <th className="text-left p-3 border-b-2 border-gray-eske-40 text-[14px] font-bold">
                        Finalidad
                      </th>
                      <th className="text-left p-3 border-b-2 border-gray-eske-40 text-[14px] font-bold">
                        Duración
                      </th>
                    </tr>
                  </thead>
                  <tbody>
                    <tr className="border-b border-gray-eske-40">
                      <td className="p-3 text-[13px] font-mono bg-gray-eske-10 dark:bg-[#112230]">
                        _ga
                      </td>
                      <td className="p-3 text-[14px]">Google Analytics</td>
                      <td className="p-3 text-[14px]">
                        Distingue usuarios únicos de forma anónima
                      </td>
                      <td className="p-3 text-[14px]">2 años</td>
                    </tr>
                    <tr className="border-b border-gray-eske-40">
                      <td className="p-3 text-[13px] font-mono bg-gray-eske-10 dark:bg-[#112230]">
                        _ga_*
                      </td>
                      <td className="p-3 text-[14px]">Google Analytics</td>
                      <td className="p-3 text-[14px]">
                        Almacena y cuenta las vistas de página
                      </td>
                      <td className="p-3 text-[14px]">2 años</td>
                    </tr>
                    <tr>
                      <td className="p-3 text-[13px] font-mono bg-gray-eske-10 dark:bg-[#112230]">
                        _gid
                      </td>
                      <td className="p-3 text-[14px]">Google Analytics</td>
                      <td className="p-3 text-[14px]">
                        Distingue usuarios para estadísticas de corto plazo
                      </td>
                      <td className="p-3 text-[14px]">24 horas</td>
                    </tr>
                  </tbody>
                </table>
              </div>

              <div className="bg-bluegreen-eske-10 dark:bg-[#112230] p-4 rounded-lg border-l-4 border-bluegreen-eske mb-4">
                <p className="text-[14px] text-black-eske-20 mb-2">
                  <strong className="text-bluegreen-eske dark:text-blue-eske-40">
                    Información recopilada:
                  </strong>
                </p>
                <ul className="list-disc list-inside space-y-1 text-[14px] text-black-eske-20 dark:text-[#C7D6E0] ml-4">
                  <li>Páginas visitadas y tiempo de permanencia</li>
                  <li>Flujo de navegación entre páginas</li>
                  <li>Tipo de dispositivo y navegador (anonimizado)</li>
                  <li>País y ciudad de origen (anonimizado)</li>
                  <li>Fuente de referencia (cómo llegaste al sitio)</li>
                </ul>
              </div>

              <p className="text-[14px] text-black-eske-20 dark:text-[#C7D6E0]">
                <strong>Privacidad:</strong> Google Analytics está configurado
                con anonimización de IP activada, lo que significa que tu
                dirección IP se acorta antes de ser procesada, cumpliendo con
                GDPR y CCPA.
              </p>
            </LegalSection>

            {/* 5. Cookies de Marketing */}
            <LegalSection
              id="cookies-marketing"
              title="5. Cookies de Marketing"
              level={2}
            >
              <p className="mb-4">
                Las cookies de marketing nos permiten mostrarte anuncios
                relevantes en otras plataformas basados en tu interacción con
                nuestro sitio web. Estas cookies también nos ayudan a medir la
                efectividad de nuestras campañas publicitarias.
              </p>

              <div className="overflow-x-auto mb-6">
                <table className="w-full border-2 border-gray-eske-40 rounded-lg overflow-hidden">
                  <thead className="bg-bluegreen-eske-20 dark:bg-[#112230]">
                    <tr>
                      <th className="text-left p-3 border-b-2 border-gray-eske-40 text-[14px] font-bold">
                        Cookie
                      </th>
                      <th className="text-left p-3 border-b-2 border-gray-eske-40 text-[14px] font-bold">
                        Proveedor
                      </th>
                      <th className="text-left p-3 border-b-2 border-gray-eske-40 text-[14px] font-bold">
                        Finalidad
                      </th>
                      <th className="text-left p-3 border-b-2 border-gray-eske-40 text-[14px] font-bold">
                        Duración
                      </th>
                    </tr>
                  </thead>
                  <tbody>
                    <tr className="border-b border-gray-eske-40">
                      <td className="p-3 text-[13px] font-mono bg-gray-eske-10 dark:bg-[#112230]">
                        _fbp
                      </td>
                      <td className="p-3 text-[14px]">Facebook Pixel</td>
                      <td className="p-3 text-[14px]">
                        Seguimiento de conversiones y remarketing
                      </td>
                      <td className="p-3 text-[14px]">90 días</td>
                    </tr>
                    <tr className="border-b border-gray-eske-40">
                      <td className="p-3 text-[13px] font-mono bg-gray-eske-10 dark:bg-[#112230]">
                        _gcl_au
                      </td>
                      <td className="p-3 text-[14px]">Google Ads</td>
                      <td className="p-3 text-[14px]">
                        Conversiones y remarketing de Google Ads
                      </td>
                      <td className="p-3 text-[14px]">90 días</td>
                    </tr>
                    <tr>
                      <td className="p-3 text-[13px] font-mono bg-gray-eske-10 dark:bg-[#112230]">
                        fr
                      </td>
                      <td className="p-3 text-[14px]">Facebook</td>
                      <td className="p-3 text-[14px]">
                        Publicidad dirigida y medición
                      </td>
                      <td className="p-3 text-[14px]">90 días</td>
                    </tr>
                  </tbody>
                </table>
              </div>

              <div className="bg-orange-100 dark:bg-orange-900/20 p-4 rounded-lg border-l-4 border-orange-500">
                <p className="text-[14px] text-black-eske-20 dark:text-[#C7D6E0]">
                  <strong className="text-orange-600 dark:text-orange-eske-30">
                    Consentimiento Requerido:
                  </strong>{" "}
                  Estas cookies solo se activan si das tu consentimiento
                  explícito. Puedes cambiar tus preferencias en cualquier
                  momento.
                </p>
              </div>
            </LegalSection>

            {/* 6. Gestión de Cookies */}
            <LegalSection id="gestion-cookies" title="6. Gestión de Cookies">
              <p className="mb-4">
                Tienes control total sobre las cookies que utilizamos en nuestro
                sitio web. Puedes gestionar tus preferencias de diferentes
                formas:
              </p>

              <div className="space-y-4">
                <div className="p-4 bg-bluegreen-eske-10 dark:bg-[#112230] border-2 border-bluegreen-eske dark:border-[#4791B3] rounded-lg">
                  <h4 className="font-bold text-[16px] text-bluegreen-eske dark:text-blue-eske-40 mb-2 flex items-center gap-2">
                    Panel de Configuración de Eskemma
                  </h4>
                  <p className="text-[14px] text-black-eske-20 dark:text-[#C7D6E0] mb-3">
                    La forma más sencilla de gestionar tus cookies es a través
                    de nuestro panel de configuración. Puedes activar o
                    desactivar cada categoría de cookies según tus preferencias.
                  </p>
                  <CookieConfigButton variant="compact" />
                </div>

                <div className="p-4 bg-gray-eske-10 dark:bg-[#21425E] border-2 border-gray-eske-40 dark:border-white/10 rounded-lg">
                  <h4 className="font-bold text-[16px] text-black-eske dark:text-[#EAF2F8] mb-2 flex items-center gap-2">
                    Configuración del Navegador
                  </h4>
                  <p className="text-[14px] text-black-eske-20 dark:text-[#C7D6E0]">
                    También puedes gestionar las cookies directamente desde la
                    configuración de tu navegador. Consulta la sección siguiente
                    para obtener instrucciones específicas según tu navegador.
                  </p>
                </div>
              </div>
            </LegalSection>

            {/* 7. Cómo Configurar tus Cookies */}
            <LegalSection
              id="configurar-cookies"
              title="7. Cómo Configurar tus Cookies"
              level={2}
            >
              <p className="mb-4">
                Desde nuestro panel de configuración puedes:
              </p>

              <div className="grid md:grid-cols-2 gap-4 mb-6">
                <div className="p-4 bg-white-eske dark:bg-[#18324A] border-2 border-bluegreen-eske-20 dark:border-white/10 rounded-lg">
                  <div className="flex items-start gap-3 mb-2">
                    <span className="text-2xl">✅</span>
                    <div>
                      <h5 className="font-bold text-[14px] text-bluegreen-eske dark:text-blue-eske-40 mb-1">
                        Aceptar Todo
                      </h5>
                      <p className="text-[13px] text-black-eske-20 dark:text-[#C7D6E0]">
                        Activa todas las categorías de cookies para una
                        experiencia completa
                      </p>
                    </div>
                  </div>
                </div>

                <div className="p-4 bg-white-eske dark:bg-[#18324A] border-2 border-bluegreen-eske-20 dark:border-white/10 rounded-lg">
                  <div className="flex items-start gap-3 mb-2">
                    <span className="text-2xl">🔒</span>
                    <div>
                      <h5 className="font-bold text-[14px] text-bluegreen-eske dark:text-blue-eske-40 mb-1">
                        Solo Esenciales
                      </h5>
                      <p className="text-[13px] text-black-eske-20 dark:text-[#C7D6E0]">
                        Mantén solo las cookies necesarias para el
                        funcionamiento básico
                      </p>
                    </div>
                  </div>
                </div>

                <div className="p-4 bg-white-eske dark:bg-[#18324A] border-2 border-bluegreen-eske-20 dark:border-white/10 rounded-lg">
                  <div className="flex items-start gap-3 mb-2">
                    <span className="text-2xl">⚙️</span>
                    <div>
                      <h5 className="font-bold text-[14px] text-bluegreen-eske dark:text-blue-eske-40 mb-1">
                        Configuración Personalizada
                      </h5>
                      <p className="text-[13px] text-black-eske-20 dark:text-[#C7D6E0]">
                        Elige específicamente qué categorías deseas activar o
                        desactivar
                      </p>
                    </div>
                  </div>
                </div>

                <div className="p-4 bg-white-eske dark:bg-[#18324A] border-2 border-bluegreen-eske-20 dark:border-white/10 rounded-lg">
                  <div className="flex items-start gap-3 mb-2">
                    <span className="text-2xl">🔄</span>
                    <div>
                      <h5 className="font-bold text-[14px] text-bluegreen-eske dark:text-blue-eske-40 mb-1">
                        Cambiar en Cualquier Momento
                      </h5>
                      <p className="text-[13px] text-black-eske-20 dark:text-[#C7D6E0]">
                        Tus preferencias se pueden modificar cuando quieras
                      </p>
                    </div>
                  </div>
                </div>
              </div>

              <div className="p-4 bg-bluegreen-eske-10 dark:bg-[#112230] rounded-lg">
                <p className="text-[14px] text-black-eske-20 dark:text-[#C7D6E0] mb-3">
                  <strong>¿Listo para configurar tus cookies?</strong> Haz clic
                  en el botón de abajo para abrir el panel de configuración:
                </p>
                <CookieConfigButton />
              </div>
            </LegalSection>

            {/* 8. Desactivar desde tu Navegador */}
            <LegalSection
              id="desactivar-navegador"
              title="8. Desactivar desde tu Navegador"
              level={2}
            >
              <p className="mb-4">
                Si prefieres gestionar las cookies directamente desde tu
                navegador, aquí te explicamos cómo hacerlo en los navegadores
                más populares:
              </p>

              <div className="space-y-4">
                {/* Chrome */}
                <details className="border-2 border-gray-eske-40 rounded-lg overflow-hidden">
                  <summary className="p-4 bg-gray-eske-10 dark:bg-[#21425E] cursor-pointer hover:bg-gray-eske-20 dark:hover:bg-[#2C5273] transition-colors font-bold text-[15px] flex items-center gap-2 dark:text-[#EAF2F8]">
                    <span>🟢</span> Google Chrome
                  </summary>
                  <div className="p-4 text-[14px] text-black-eske-20 dark:text-[#C7D6E0]">
                    <ol className="list-decimal list-inside space-y-2">
                      <li>
                        Haz clic en el menú (⋮) en la esquina superior derecha
                      </li>
                      <li>
                        Selecciona <strong>Configuración</strong>
                      </li>
                      <li>
                        Ve a <strong>Privacidad y seguridad</strong>
                      </li>
                      <li>
                        Haz clic en{" "}
                        <strong>Cookies y otros datos de sitios</strong>
                      </li>
                      <li>Elige tu preferencia de cookies</li>
                    </ol>
                    <p className="mt-3 text-[13px]">
                      <a
                        href="https://support.google.com/chrome/answer/95647"
                        target="_blank"
                        rel="noopener noreferrer"
                        className="text-blue-600 underline hover:text-blue-800 dark:text-blue-eske-40 hover:dark:text-blue-eske-10 focus-ring-primary rounded"
                      >
                        Ver guía completa de Google →
                        <span className="sr-only">
                          {" "}
                          (se abre en nueva ventana)
                        </span>
                      </a>
                    </p>
                  </div>
                </details>

                {/* Firefox */}
                <details className="border-2 border-gray-eske-40 rounded-lg overflow-hidden">
                  <summary className="p-4 bg-gray-eske-10 dark:bg-[#21425E] cursor-pointer hover:bg-gray-eske-20 dark:hover:bg-[#2C5273] transition-colors font-bold text-[15px] flex items-center gap-2 dark:text-[#EAF2F8]">
                    <span>🟠</span> Mozilla Firefox
                  </summary>
                  <div className="p-4 text-[14px] text-black-eske-20 dark:text-[#C7D6E0]">
                    <ol className="list-decimal list-inside space-y-2">
                      <li>
                        Haz clic en el menú (≡) en la esquina superior derecha
                      </li>
                      <li>
                        Selecciona <strong>Configuración</strong>
                      </li>
                      <li>
                        Ve a la sección <strong>Privacidad y seguridad</strong>
                      </li>
                      <li>
                        En "Cookies y datos del sitio", haz clic en{" "}
                        <strong>Gestionar permisos</strong>
                      </li>
                      <li>Configura tus preferencias</li>
                    </ol>
                    <p className="mt-3 text-[13px]">
                      <a
                        href="https://support.mozilla.org/es/kb/cookies-informacion-que-los-sitios-web-guardan-en-"
                        target="_blank"
                        rel="noopener noreferrer"
                        className="text-blue-600 underline hover:text-blue-800 dark:text-blue-eske-40 hover:dark:text-blue-eske-10 focus-ring-primary rounded"
                      >
                        Ver guía completa de Firefox →
                        <span className="sr-only">
                          {" "}
                          (se abre en nueva ventana)
                        </span>
                      </a>
                    </p>
                  </div>
                </details>

                {/* Safari */}
                <details className="border-2 border-gray-eske-40 rounded-lg overflow-hidden">
                  <summary className="p-4 bg-gray-eske-10 dark:bg-[#21425E] cursor-pointer hover:bg-gray-eske-20 dark:hover:bg-[#2C5273] transition-colors font-bold text-[15px] flex items-center gap-2 dark:text-[#EAF2F8]">
                    <span>🔵</span> Safari
                  </summary>
                  <div className="p-4 text-[14px] text-black-eske-20 dark:text-[#C7D6E0]">
                    <ol className="list-decimal list-inside space-y-2">
                      <li>
                        Haz clic en <strong>Safari</strong> en la barra de menú
                      </li>
                      <li>
                        Selecciona <strong>Preferencias</strong>
                      </li>
                      <li>
                        Ve a la pestaña <strong>Privacidad</strong>
                      </li>
                      <li>Configura "Cookies y datos de sitios web"</li>
                    </ol>
                    <p className="mt-3 text-[13px]">
                      <a
                        href="https://support.apple.com/es-es/guide/safari/sfri11471/mac"
                        target="_blank"
                        rel="noopener noreferrer"
                        className="text-blue-600 underline hover:text-blue-800 dark:text-blue-eske-40 hover:dark:text-blue-eske-10 focus-ring-primary rounded"
                      >
                        Ver guía completa de Apple →
                        <span className="sr-only">
                          {" "}
                          (se abre en nueva ventana)
                        </span>
                      </a>
                    </p>
                  </div>
                </details>

                {/* Edge */}
                <details className="border-2 border-gray-eske-40 rounded-lg overflow-hidden">
                  <summary className="p-4 bg-gray-eske-10 dark:bg-[#21425E] cursor-pointer hover:bg-gray-eske-20 dark:hover:bg-[#2C5273] transition-colors font-bold text-[15px] flex items-center gap-2 dark:text-[#EAF2F8]">
                    <span>🟣</span> Microsoft Edge
                  </summary>
                  <div className="p-4 text-[14px] text-black-eske-20 dark:text-[#C7D6E0]">
                    <ol className="list-decimal list-inside space-y-2">
                      <li>
                        Haz clic en el menú (…) en la esquina superior derecha
                      </li>
                      <li>
                        Selecciona <strong>Configuración</strong>
                      </li>
                      <li>
                        Ve a <strong>Cookies y permisos del sitio</strong>
                      </li>
                      <li>
                        Haz clic en <strong>Cookies y datos del sitio</strong>
                      </li>
                      <li>Configura tus preferencias</li>
                    </ol>
                    <p className="mt-3 text-[13px]">
                      <a
                        href="https://support.microsoft.com/es-es/microsoft-edge/eliminar-las-cookies-en-microsoft-edge-63947406-40ac-c3b8-57b9-2a946a29ae09"
                        target="_blank"
                        rel="noopener noreferrer"
                        className="text-blue-600 underline hover:text-blue-800 dark:text-blue-eske-40 hover:dark:text-blue-eske-10 focus-ring-primary rounded"
                      >
                        Ver guía completa de Microsoft →
                        <span className="sr-only">
                          {" "}
                          (se abre en nueva ventana)
                        </span>
                      </a>
                    </p>
                  </div>
                </details>
              </div>

              <div className="mt-6 bg-orange-100 p-4 rounded-lg border-l-4 border-orange-500">
                <p className="text-[14px] text-black-eske-20">
                  <strong className="text-orange-600 dark:text-orange-eske-30 ">⚠️ Advertencia:</strong>{" "}
                  Si desactivas todas las cookies, algunas funciones del sitio
                  web podrían no funcionar correctamente, como el inicio de
                  sesión o la personalización de tu experiencia.
                </p>
              </div>
            </LegalSection>

            {/* 9. Duración de las Cookies */}
            <LegalSection
              id="duracion-cookies"
              title="9. Duración de las Cookies"
            >
              <p className="mb-4">
                Las cookies que utilizamos tienen diferentes duraciones según su
                finalidad:
              </p>

              <div className="grid md:grid-cols-2 gap-4">
                <div className="p-4 bg-white-eske dark:bg-[#18324A] border-2 border-bluegreen-eske-20 dark:border-white/10 rounded-lg">
                  <h4 className="font-bold text-[16px] text-bluegreen-eske dark:text-blue-eske-40 mb-2 flex items-center gap-2">
                    Cookies de Sesión
                  </h4>
                  <p className="text-[14px] text-black-eske-20 dark:text-[#C7D6E0] mb-2">
                    Se eliminan automáticamente cuando cierras el navegador.
                  </p>
                  <p className="text-[13px] text-black-eske-30 dark:text-[#9AAEBE]">
                    <strong>Ejemplo:</strong> csrf_token
                  </p>
                </div>

                <div className="p-4 bg-white-eske dark:bg-[#18324A] border-2 border-bluegreen-eske-20 dark:border-white/10 rounded-lg">
                  <h4 className="font-bold text-[16px] text-bluegreen-eske dark:text-blue-eske-40 mb-2 flex items-center gap-2">
                    Cookies Persistentes
                  </h4>
                  <p className="text-[14px] text-black-eske-20 dark:text-[#C7D6E0] mb-2">
                    Permanecen en tu dispositivo durante un tiempo determinado.
                  </p>
                  <p className="text-[13px] text-black-eske-30 dark:text-[#9AAEBE]">
                    <strong>Duración:</strong> Desde 24 horas hasta 2 años
                  </p>
                </div>
              </div>

              <div className="mt-6 p-4 bg-bluegreen-eske-10 rounded-lg">
                <p className="text-[14px] text-black-eske-20 dark:text-black-eske">
                  Todas nuestras cookies tienen una duración limitada y se
                  eliminan automáticamente al cumplir su plazo de expiración.
                  Puedes eliminar las cookies manualmente en cualquier momento
                  desde tu navegador.
                </p>
              </div>
            </LegalSection>

            {/* 10. Actualizaciones de esta Política */}
            <LegalSection
              id="actualizaciones"
              title="10. Actualizaciones de esta Política"
            >
              <p className="mb-4">
                Podemos actualizar esta Política de Cookies periódicamente para
                reflejar cambios en las cookies que utilizamos o por razones
                legales, operativas o regulatorias.
              </p>
              <p className="mb-4">
                Te recomendamos que revises esta página regularmente para estar
                informado sobre cómo utilizamos las cookies. La fecha de la
                última actualización se encuentra en la parte superior de esta
                página.
              </p>
              <div className="bg-bluegreen-eske-10 dark:bg-[#112230] p-4 rounded-lg border-l-4 border-bluegreen-eske">
                <p className="text-[14px] text-black-eske-20 dark:text-[#C7D6E0]">
                  <strong className="text-bluegreen-eske dark:text-blue-eske-40">
                    Te notificaremos:
                  </strong>{" "}
                  Si realizamos cambios importantes en esta política, te
                  notificaremos a través de un aviso visible en nuestro sitio
                  web o por correo electrónico (si tienes una cuenta con
                  nosotros).
                </p>
              </div>
            </LegalSection>

            {/* 11. Contacto */}
            <LegalSection id="contacto" title="11. Contacto">
              <p className="mb-4">
                Si tienes alguna pregunta sobre nuestra Política de Cookies o
                sobre cómo gestionamos tus datos, no dudes en contactarnos:
              </p>

              <div className="space-y-3">
                <div className="flex items-center gap-3 p-3 bg-white-eske dark:bg-[#18324A] border-2 border-bluegreen-eske-20 dark:border-white/10 rounded-lg">
                  <div>
                    <p className="text-[13px] text-black-eske-30 dark:text-[#9AAEBE] mb-1">
                      Correo electrónico
                    </p>
                    <a
                      href="mailto:privacidad@eskemma.com"
                      className="text-[15px] font-semibold text-bluegreen-eske hover:text-bluegreen-eske-70 transition-colors dark:text-blue-eske-40 hover:dark:text-blue-eske-10 focus-ring-primary rounded"
                    >
                      privacidad@eskemma.com
                    </a>
                  </div>
                </div>

                <div className="flex items-center gap-3 p-3 bg-white-eske dark:bg-[#18324A] border-2 border-bluegreen-eske-20 dark:border-white/10 rounded-lg">
                  <div>
                    <p className="text-[13px] text-black-eske-30 dark:text-[#9AAEBE] mb-1">
                      Dirección postal
                    </p>
                    <p className="text-[15px] font-semibold text-black-eske dark:text-[#EAF2F8]">
                      Eskemma
                      <br />
                      Atención: Departamento de Privacidad
                      <br />
                      [Tu dirección completa]
                    </p>
                  </div>
                </div>
              </div>

              <div className="mt-6 p-4 bg-gray-eske-10 dark:bg-[#112230] rounded-lg">
                <p className="text-[14px] text-black-eske-20 dark:text-[#C7D6E0]">
                  <strong>Tiempo de respuesta:</strong> Nos comprometemos a
                  responder a tu consulta en un plazo máximo de 30 días desde su
                  recepción.
                </p>
              </div>
            </LegalSection>

            {/* Call to Action Final */}
            <div className="mt-12 p-6 bg-gray-eske-30 dark:bg-[#21425E] rounded-lg text-white-eske text-center">
              <h3 className="text-2xl font-bold text-black-eske dark:text-[#EAF2F8] mb-3">
                ¿Quieres gestionar tus cookies?
              </h3>
              <p className="text-[16px] text-black-eske dark:text-[#C7D6E0] mb-6">
                Configura tus preferencias en cualquier momento con un solo clic
              </p>
              <div className="flex flex-col sm:flex-row gap-4 justify-center max-w-md mx-auto">
                <Link href="/" className="flex-1">
                  <Button label="Volver al Inicio" variant="primary" />
                </Link>
                <CookieConfigButton variant="compact" />
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

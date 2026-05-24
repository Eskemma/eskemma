// app/components/Footer.tsx
import Link from "next/link";

const Footer = () => {
  const currentYear = new Date().getFullYear();
  return (
    <footer>
      {/* Primera sección: Fondo bluegreen-eske */}
      <div className="bg-bluegreen-eske dark:bg-bluegreen-eske-70 text-white-eske py-12 max-sm:py-8 px-4 sm:px-6 md:px-8">
        <div className="w-[90%] mx-auto max-w-screen-xl">
          {/* Contenedor para Logotipo e Íconos de Redes Sociales */}
          <div className="flex flex-col md:flex-row items-center justify-between mb-8 max-sm:mb-6">
            {/* Logotipo */}
            <div className="flex-shrink-0">
              <img
                src="/images/esk_log_wsm.svg"
                alt="Eskemma Logo"
                className="h-14 max-sm:h-10 w-auto"
              />
            </div>
            {/* Íconos de redes sociales */}
            <nav aria-label="Redes sociales de Eskemma">
              <ul className="flex space-x-4 max-sm:space-x-3 mt-4 md:mt-0">
                <li>
                  <a
                    href="https://twitter.com/eskemma"
                    target="_blank"
                    rel="noopener noreferrer"
                    className="hover:text-blue-eske-10 transition-colors duration-300 focus-ring-light rounded"
                    aria-label="Visitar nuestro Twitter (se abre en nueva ventana)"
                  >
                    <img
                      src="/icons/twitter.svg"
                      alt=""
                      className="w-12 h-12 max-sm:w-9 max-sm:h-9"
                      aria-hidden="true"
                    />
                  </a>
                </li>
                <li>
                  <a
                    href="https://linkedin.com/company/eskemma"
                    target="_blank"
                    rel="noopener noreferrer"
                    className="hover:text-blue-eske-10 transition-colors duration-300 focus-ring-light rounded"
                    aria-label="Visitar nuestro LinkedIn (se abre en nueva ventana)"
                  >
                    <img
                      src="/icons/linkedin.svg"
                      alt=""
                      className="w-12 h-12 max-sm:w-9 max-sm:h-9"
                      aria-hidden="true"
                    />
                  </a>
                </li>
                <li>
                  <a
                    href="https://www.youtube.com/@eskemma"
                    target="_blank"
                    rel="noopener noreferrer"
                    className="hover:text-blue-eske-10 transition-colors duration-300 focus-ring-light rounded"
                    aria-label="Visitar nuestro YouTube (se abre en nueva ventana)"
                  >
                    <img
                      src="/icons/youtube.svg"
                      alt=""
                      className="w-12 h-12 max-sm:w-9 max-sm:h-9"
                      aria-hidden="true"
                    />
                  </a>
                </li>
                <li>
                  <a
                    href="https://www.tiktok.com/@eskemma"
                    target="_blank"
                    rel="noopener noreferrer"
                    className="hover:text-blue-eske-10 transition-colors duration-300 focus-ring-light rounded"
                    aria-label="Visitar nuestro TikTok (se abre en nueva ventana)"
                  >
                    <img
                      src="/icons/tiktok.svg"
                      alt=""
                      className="w-12 h-12 max-sm:w-9 max-sm:h-9"
                      aria-hidden="true"
                    />
                  </a>
                </li>
                <li>
                  <a
                    href="https://www.facebook.com/eskemma"
                    target="_blank"
                    rel="noopener noreferrer"
                    className="hover:text-blue-eske-10 transition-colors duration-300 focus-ring-light rounded"
                    aria-label="Visitar nuestro Facebook (se abre en nueva ventana)"
                  >
                    <img
                      src="/icons/facebook.svg"
                      alt=""
                      className="w-12 h-12 max-sm:w-9 max-sm:h-9"
                      aria-hidden="true"
                    />
                  </a>
                </li>
                <li>
                  <a
                    href="https://www.instagram.com/eskemma"
                    target="_blank"
                    rel="noopener noreferrer"
                    className="hover:text-blue-eske-10 transition-colors duration-300 focus-ring-light rounded"
                    aria-label="Visitar nuestro Instagram (se abre en nueva ventana)"
                  >
                    <img
                      src="/icons/instagram.svg"
                      alt=""
                      className="w-12 h-12 max-sm:w-9 max-sm:h-9"
                      aria-hidden="true"
                    />
                  </a>
                </li>
              </ul>
            </nav>
          </div>
          {/* Línea divisoria después de redes sociales (móvil) */}
          <hr className="hidden max-sm:block border-t border-white-eske max-sm:my-4" />
          {/* Contenedor de columnas */}
          <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-6 max-sm:gap-4 mx-auto max-w-screen-xl">
            {/* Columna 1: Navegación - OPTIMIZADA CON 2 COLUMNAS EN MOBILE */}
            <nav aria-label="Navegación principal del sitio">
              <h3 className="text-[14px] max-sm:text-sm font-semibold mb-4 max-sm:mb-3 max-sm:text-center">
                Navegación
              </h3>
              <ul className="space-y-2 max-sm:space-y-1.5">
                <li>
                  <Link
                    href="/"
                    className="hover:text-blue-eske-10 transition-colors duration-300 text-sm max-sm:text-xs focus-ring-light rounded"
                  >
                    Inicio
                  </Link>
                </li>
                <li>
                  <Link
                    href="/blog"
                    className="hover:text-blue-eske-10 transition-colors duration-300 text-sm max-sm:text-xs focus-ring-light rounded"
                  >
                    El Baúl de Fouché
                  </Link>
                </li>
                <li>
                  <Link
                    href="/sefix"
                    className="hover:text-blue-eske-10 transition-colors duration-300 text-sm max-sm:text-xs focus-ring-light rounded"
                  >
                    Sefix
                  </Link>
                </li>
                <li>
                  <Link
                    href="/servicios"
                    className="hover:text-blue-eske-10 transition-colors duration-300 text-sm max-sm:text-xs focus-ring-light rounded"
                  >
                    Servicios
                  </Link>
                </li>
                <li>
                  <Link
                    href="/contacto"
                    className="hover:text-blue-eske-10 transition-colors duration-300 text-sm max-sm:text-xs focus-ring-light rounded"
                  >
                    Contacto
                  </Link>
                </li>
                <li>
                  <Link
                    href="/faq"
                    className="hover:text-blue-eske-10 transition-colors duration-300 text-sm max-sm:text-xs focus-ring-light rounded"
                  >
                    Preguntas frecuentes
                  </Link>
                </li>
              </ul>
            </nav>
            {/* Línea divisoria después de Navegación (móvil) */}
            <hr className="hidden max-sm:block border-t border-white-eske max-sm:my-4" />

            {/* Columna 2: Legal - SIN MODIFICACIONES */}
            <nav aria-label="Enlaces legales">
              <h3 className="text-[14px] max-sm:text-sm font-semibold mb-4 max-sm:mb-3 max-sm:text-center">
                Legal
              </h3>
              <ul className="space-y-2 max-sm:space-y-1.5">
                <li>
                  <Link
                    href="/politica-de-privacidad"
                    className="hover:text-blue-eske-10 transition-colors duration-300 text-sm max-sm:text-xs focus-ring-light rounded"
                  >
                    Política de Privacidad
                  </Link>
                </li>
                <li>
                  <Link
                    href="/condiciones-de-uso"
                    className="hover:text-blue-eske-10 transition-colors duration-300 text-sm max-sm:text-xs focus-ring-light rounded"
                  >
                    Condiciones de uso
                  </Link>
                </li>
                <li>
                  <Link
                    href="/politica-de-cookies"
                    className="hover:text-blue-eske-10 transition-colors duration-300 text-sm max-sm:text-xs focus-ring-light rounded"
                  >
                    Política de cookies
                  </Link>
                </li>
                <li>
                  <Link
                    href="/condiciones-asesorias-gratuitas"
                    className="hover:text-blue-eske-10 transition-colors duration-300 text-sm max-sm:text-xs focus-ring-light rounded"
                  >
                    Condiciones de uso para asesorías gratuitas
                  </Link>
                </li>
              </ul>
            </nav>
            {/* Línea divisoria después de Legal (móvil) */}
            <hr className="hidden max-sm:block border-t border-white-eske max-sm:my-4" />

            {/* Columna 3: Sitios de interés - OPTIMIZADA CON 2 COLUMNAS EN MOBILE */}
            <nav aria-label="Sitios de interés recomendados">
              <h3 className="text-[14px] max-sm:text-sm font-semibold mb-4 max-sm:mb-3 max-sm:text-center">
                Sitios de interés
              </h3>
              {/* Grid con 2 columnas en mobile, 1 columna en desktop */}
              <div className="grid grid-cols-1 max-sm:grid-cols-2 gap-2 max-sm:gap-x-3 max-sm:gap-y-1.5">
                {/* Primera columna - Primeros 4 links */}
                <ul className="space-y-2 max-sm:space-y-1.5">
                  <li>
                    <a
                      href="https://ine.mx"
                      target="_blank"
                      rel="noopener noreferrer"
                      className="hover:text-blue-eske-10 transition-colors duration-300 text-sm max-sm:text-xs focus-ring-light rounded"
                    >
                      INE
                      <span className="sr-only"> (se abre en nueva ventana)</span>
                    </a>
                  </li>
                  <li>
                    <a
                      href="https://www.inegi.org.mx"
                      target="_blank"
                      rel="noopener noreferrer"
                      className="hover:text-blue-eske-10 transition-colors duration-300 text-sm max-sm:text-xs focus-ring-light rounded"
                    >
                      INEGI
                      <span className="sr-only"> (se abre en nueva ventana)</span>
                    </a>
                  </li>
                  <li>
                    <a
                      href="https://www.scjn.gob.mx"
                      target="_blank"
                      rel="noopener noreferrer"
                      className="hover:text-blue-eske-10 transition-colors duration-300 text-sm max-sm:text-xs focus-ring-light rounded"
                    >
                      SCJN
                      <span className="sr-only"> (se abre en nueva ventana)</span>
                    </a>
                  </li>
                  <li>
                    <a
                      href="https://www.te.gob.mx/"
                      target="_blank"
                      rel="noopener noreferrer"
                      className="hover:text-blue-eske-10 transition-colors duration-300 text-sm max-sm:text-xs focus-ring-light rounded"
                    >
                      TEPJF
                      <span className="sr-only"> (se abre en nueva ventana)</span>
                    </a>
                  </li>
                </ul>
                {/* Segunda columna - Últimos 4 links */}
                <ul className="space-y-2 max-sm:space-y-1.5">
                  <li>
                    <a
                      href="https://www.diputados.gob.mx"
                      target="_blank"
                      rel="noopener noreferrer"
                      className="hover:text-blue-eske-10 transition-colors duration-300 text-sm max-sm:text-xs focus-ring-light rounded"
                    >
                      H. Cámara de Diputados
                      <span className="sr-only"> (se abre en nueva ventana)</span>
                    </a>
                  </li>
                  <li>
                    <a
                      href="https://www.senado.gob.mx"
                      target="_blank"
                      rel="noopener noreferrer"
                      className="hover:text-blue-eske-10 transition-colors duration-300 text-sm max-sm:text-xs focus-ring-light rounded"
                    >
                      Senado de la República
                      <span className="sr-only"> (se abre en nueva ventana)</span>
                    </a>
                  </li>
                  <li>
                    <a
                      href="https://biblioteca.colmex.mx/"
                      target="_blank"
                      rel="noopener noreferrer"
                      className="hover:text-blue-eske-10 transition-colors duration-300 text-sm max-sm:text-xs focus-ring-light rounded"
                    >
                      Biblioteca del COLMEX
                      <span className="sr-only"> (se abre en nueva ventana)</span>
                    </a>
                  </li>
                  <li>
                    <a
                      href="https://www.bidi.unam.mx/"
                      target="_blank"
                      rel="noopener noreferrer"
                      className="hover:text-blue-eske-10 transition-colors duration-300 text-sm max-sm:text-xs focus-ring-light rounded"
                    >
                      Biblioteca Digital UNAM
                      <span className="sr-only"> (se abre en nueva ventana)</span>
                    </a>
                  </li>
                </ul>
              </div>
            </nav>
          </div>
        </div>
      </div>
      {/* Segunda sección: Fondo bluegreen-eske-80 */}
      <div className="bg-bluegreen-eske-80 text-white-eske py-6 max-sm:py-4 px-4 sm:px-6 md:px-8 text-center font-light text-[11px] max-sm:text-[7px]">
        <div className="w-[90%] mx-auto max-w-screen-xl">
          <p>
            Eskemma | {currentYear} | © Todos los derechos reservados |{" "}
            <Link
              href="/condiciones-de-uso"
              className="hover:text-blue-eske-10 transition-colors duration-300 focus-ring-light rounded"
            >
              Condiciones de uso
            </Link>{" "}
            |{" "}
            <Link
              href="/politica-de-cookies"
              className="hover:text-blue-eske-10 transition-colors duration-300 focus-ring-light rounded"
            >
              Política de cookies
            </Link>{" "}
            |{" "}
            <Link
              href="/politica-de-privacidad"
              className="hover:text-blue-eske-10 transition-colors duration-300 focus-ring-light rounded"
            >
              Política de privacidad
            </Link>{" "}
            |{" "}
            <Link
              href="/condiciones-asesorias-gratuitas"
              className="hover:text-blue-eske-10 transition-colors duration-300 focus-ring-light rounded"
            >
              Condiciones de uso para Asesorías Gratuitas
            </Link>
          </p>
        </div>
      </div>
    </footer>
  );
};

export default Footer;

// app/condiciones-de-uso/page.tsx
import type { Metadata } from "next";
import Link from "next/link";
import LegalHero from "../components/legal/LegalHero";
import LegalSection from "../components/legal/LegalSection";
import TableOfContents, { TocItem } from "../components/legal/TableOfContents";
import Button from "../components/Button";

export const metadata: Metadata = {
  title: "Condiciones de Uso | Eskemma",
  description:
    "Términos y condiciones para el uso de la plataforma Eskemma. Derechos y obligaciones.",
  robots: "index, follow",
};

export default function CondicionesDeUso() {
  // Definir el índice de contenidos
  const tocItems: TocItem[] = [
    { id: "objeto", title: "1. Objeto y Alcance" },
    { id: "registro", title: "2. Registro y Cuenta de Usuario" },
    { id: "uso-plataforma", title: "3. Uso de la Plataforma" },
    { id: "suscripciones", title: "4. Suscripciones y Pagos" },
    { id: "conducta", title: "5. Conducta del Usuario" },
    { id: "limitacion", title: "6. Limitación de Responsabilidad" },
    { id: "ley-aplicable", title: "7. Ley Aplicable y Controversias" },
    { id: "accesibilidad", title: "8. Compromiso de Accesibilidad" },
    { id: "contacto", title: "9. Contacto" },
  ];

  return (
    <div className="min-h-screen bg-white-eske dark:bg-[#0B1620]">
      {/* Hero Section */}
      <LegalHero
        title="Condiciones de Uso"
        subtitle="Términos que rigen el uso de nuestra plataforma"
        lastUpdated="Diciembre de 2025"
      />

      {/* Main Content con TableOfContents */}
      <div className="w-[90%] max-w-screen-xl mx-auto py-12 px-4 sm:px-6">
        {/* Layout con Grid: TOC (sidebar) + Contenido */}
        <div className="lg:grid lg:grid-cols-[280px_1fr] lg:gap-8">
          {/* TableOfContents - Sidebar Sticky */}
          <TableOfContents items={tocItems} title="Contenido" />

          {/* Contenido Principal */}
          <div className="lg:col-start-2">
            {/* Introducción */}
            <div className="mb-8 text-[16px] max-sm:text-[14px] text-black-eske-10 dark:text-[#C7D6E0] leading-relaxed">
              <p className="mb-4">
                Bienvenido a Eskemma (en adelante, "la Plataforma"), operada por{" "}
                <strong>Eskemma S.A.P.I. de C.V.</strong>
                Al acceder o utilizar nuestro sitio web y nuestros servicios,
                aceptas cumplir con estas Condiciones de Uso.
              </p>
              <p className="font-semibold text-bluegreen-eske dark:text-blue-eske-40 ">
                Si no estás de acuerdo con algún término, te pedimos que no
                utilices la Plataforma.
              </p>
            </div>

            {/* Sección 1: Objeto y Alcance */}
            <LegalSection id="objeto" title="1. Objeto y Alcance">
              <p className="mb-4">Estas Condiciones regulan el uso de:</p>
              <ul className="list-disc list-inside space-y-2 ml-4 mb-4">
                <li>El sitio web de Eskemma (www.eskemma.com)</li>
                <li>
                  Las herramientas digitales (Sefix, Moddulo, Centinela, y otras
                  que se incorporen)
                </li>
                <li>
                  Los contenidos, recursos y servicios de pago o gratuitos
                  disponibles en la Plataforma
                </li>
              </ul>

              <div className="mt-6 mb-6 bg-yellow-eske-10 dark:bg-yellow-900/20 p-4 rounded-lg">
                <p className="font-semibold mb-2">Nota importante:</p>
                <p>
                  Las sesiones de diagnóstico gratuitas se rigen por sus propias{" "}
                  <Link
                    href="/condiciones-sesiones-diagnostico-gratuitas"
                    className="text-bluegreen-eske hover:text-bluegreen-eske-70 dark:text-blue-eske-40 hover:dark:text-blue-eske-10 underline focus-ring-primary rounded"
                  >
                    Condiciones de Uso para Sesiones de Diagnóstico Gratuitas
                  </Link>
                </p>
              </div>

              <div className="mt-6 mb-6">
                <h4 className="text-[16px] font-semibold text-black-eske dark:text-[#EAF2F8] mb-2">
                  1.1. Aceptación de los Términos
                </h4>
                <p className="mb-2">
                  Al crear una cuenta, realizar una compra o simplemente navegar
                  por Eskemma, aceptas estar legalmente vinculado por estos
                  Términos y por nuestra{" "}
                  <Link
                    href="/politica-de-privacidad"
                    className="text-bluegreen-eske hover:text-bluegreen-eske-70 dark:text-blue-eske-40  hover:dark:text-blue-eske-10 underline focus-ring-primary rounded"
                  >
                    Política de Privacidad
                  </Link>
                  .
                </p>
              </div>
            </LegalSection>

            {/* Sección 2: Registro y Cuenta */}
            <LegalSection id="registro" title="2. Registro y Cuenta de Usuario">
              <div className="mt-6 mb-6">
                <h4 className="text-[16px] font-semibold text-black-eske dark:text-[#EAF2F8] mb-2">
                  2.1. Requisitos para el Registro
                </h4>
                <p className="mb-2">Para crear una cuenta en Eskemma debes:</p>
                <ul className="list-disc list-inside space-y-1 ml-4">
                  <li>
                    Ser mayor de 18 años o contar con la autorización de un
                    tutor legal
                  </li>
                  <li>
                    Proporcionar información veraz, exacta y completa durante el
                    registro
                  </li>
                  <li>
                    Mantener actualizada tu información de contacto y perfil
                  </li>
                </ul>
              </div>

              <div className="mt-6 mb-6">
                <h4 className="text-[16px] font-semibold text-black-eske dark:text-[#EAF2F8] mb-2">
                  2.2. Seguridad de tu Cuenta
                </h4>
                <p className="mb-2 font-semibold">Eres responsable de:</p>
                <ul className="list-disc list-inside space-y-1 ml-4 mb-4">
                  <li>Mantener la confidencialidad de tu contraseña</li>
                  <li>Todas las actividades realizadas bajo tu cuenta</li>
                  <li>
                    Notificarnos inmediatamente si sospechas de un acceso no
                    autorizado
                  </li>
                </ul>

                <div className="bg-red-eske-10 dark:bg-red-900/20 p-4 rounded-lg mt-4">
                  <p className="font-semibold mb-2 text-black-eske dark:text-[#EAF2F8]">
                    Para reportar accesos no autorizados:
                  </p>
                  <p className="text-black-eske dark:text-[#C7D6E0]">
                    Envía un correo a:{" "}
                    <a
                      href="mailto:soporte@eskemma.com"
                      className="text-bluegreen-eske dark:text-blue-eske-40  hover:dark:text-blue-eske-10 underline hover:text-bluegreen-eske-70 focus-ring-primary rounded"
                    >
                      soporte@eskemma.com
                    </a>{" "}
                    con el asunto "Acceso no autorizado - URGENTE"
                  </p>
                </div>
              </div>

              <div className="mt-6 mb-6">
                <h4 className="text-[16px] font-semibold text-black-eske dark:text-[#EAF2F8] mb-2">
                  2.3. Suspensión o Cancelación de Cuenta
                </h4>
                <p className="mb-2">
                  Eskemma puede suspender o cancelar tu cuenta si:
                </p>
                <ul className="list-disc list-inside space-y-1 ml-4">
                  <li>
                    Violas estas Condiciones o nuestra Política de Privacidad
                  </li>
                  <li>
                    Realizas actividades fraudulentas, ilegales o perjudiciales
                  </li>
                  <li>
                    No pagas las suscripciones correspondientes (si aplica)
                  </li>
                  <li>Suplantas la identidad de otra persona o entidad</li>
                  <li>
                    Intentas acceder a áreas restringidas sin autorización
                  </li>
                </ul>
              </div>
            </LegalSection>

            {/* Sección 3: Uso de la Plataforma */}
            <LegalSection
              id="uso-plataforma"
              title="3. Uso de la Plataforma y Herramientas"
            >
              <div className="mt-6 mb-6">
                <h4 className="text-[16px] font-semibold text-black-eske dark:text-[#EAF2F8] mb-2">
                  3.1. Licencia de Uso
                </h4>
                <p className="mb-4">
                  Eskemma te otorga una licencia personal, no exclusiva, no
                  transferible y revocable para utilizar la Plataforma y sus
                  herramientas, únicamente para fines políticos y electorales
                  lícitos.
                </p>

                <p className="font-semibold mb-2 text-red-eske">
                  Está expresamente prohibido:
                </p>
                <ul className="list-disc list-inside space-y-1 ml-4">
                  <li>
                    Copiar, modificar, distribuir o vender el contenido sin
                    autorización
                  </li>
                  <li>
                    Realizar ingeniería inversa, descompilar o extraer código
                    fuente
                  </li>
                  <li>Utilizar la Plataforma para actividades ilegales</li>
                  <li>
                    Acceder a áreas restringidas mediante hacking o métodos no
                    autorizados
                  </li>
                  <li>
                    Interferir con el funcionamiento de la Plataforma (ej:
                    ataques DDoS)
                  </li>
                  <li>Crear cuentas automatizadas (bots) sin autorización</li>
                  <li>
                    Recopilar información de otros usuarios sin su
                    consentimiento (scraping)
                  </li>
                </ul>
              </div>

              <div className="mt-6 mb-6">
                <h4 className="text-[16px] font-semibold text-black-eske dark:text-[#EAF2F8] mb-2">
                  3.2. Contenido Generado por el Usuario
                </h4>
                <p className="mb-2 font-semibold">
                  Eres el único responsable del contenido que subas o generes en
                  la Plataforma, incluyendo:
                </p>
                <ul className="list-disc list-inside space-y-1 ml-4 mb-4">
                  <li>
                    Análisis políticos y estrategias creadas en Sefix o Moddulo
                  </li>
                  <li>Datos demográficos, electorales o de cualquier tipo</li>
                  <li>Comentarios, mensajes o comunicaciones</li>
                </ul>

                <p className="mb-2 font-semibold">
                  Al subir contenido, garantizas que:
                </p>
                <ul className="list-disc list-inside space-y-1 ml-4">
                  <li>
                    Tienes todos los derechos necesarios sobre dicho contenido
                  </li>
                  <li>
                    No infringe derechos de autor, marcas registradas ni
                    propiedad intelectual de terceros
                  </li>
                  <li>
                    No es difamatorio, ofensivo, discriminatorio ni ilegal
                  </li>
                </ul>
              </div>

              <div className="mt-6 mb-6">
                <h4 className="text-[16px] font-semibold text-black-eske dark:text-[#EAF2F8] mb-2">
                  3.3. Propiedad Intelectual
                </h4>
                <p className="mb-4 font-semibold text-bluegreen-eske dark:text-blue-eske-40">
                  Todo el contenido de Eskemma es propiedad exclusiva de Eskemma
                  o de sus licenciantes, incluyendo:
                </p>
                <ul className="list-disc list-inside space-y-1 ml-4">
                  <li>Textos, artículos, tutoriales y guías</li>
                  <li>Diseños gráficos, logos, marcas y elementos visuales</li>
                  <li>Software, código fuente, algoritmos y bases de datos</li>
                  <li>Metodologías y frameworks (Sefix, Moddulo, Centinela)</li>
                  <li>Vídeos, imágenes, iconos y recursos multimedia</li>
                </ul>
              </div>
            </LegalSection>

            {/* Sección 4: Suscripciones y Pagos */}
            <LegalSection id="suscripciones" title="4. Suscripciones y Pagos">
              <div className="mt-6 mb-6">
                <h4 className="text-[16px] font-semibold text-black-eske dark:text-[#EAF2F8] mb-2">
                  4.1. Planes y Precios
                </h4>
                <p className="mb-2">
                  Eskemma ofrece los siguientes planes de suscripción:
                </p>
                <ul className="list-disc list-inside space-y-1 ml-4 mb-4">
                  <li>Plan Básico: Acceso a un producto (mensual)</li>
                  <li>
                    Plan Premium: Acceso completo al ecosistema (mensual/anual)
                  </li>
                  <li>
                    Plan Grupal: Para equipos de hasta 6 personas
                    (mensual/anual)
                  </li>
                </ul>

                <div className="bg-yellow-eske-10 dark:bg-yellow-900/20 p-4 rounded-lg">
                  <p className="font-semibold mb-2">
                    Importante sobre precios:
                  </p>
                  <ul className="list-disc list-inside space-y-1 ml-4">
                    <li>
                      Los precios NO incluyen impuestos (IVA u otros aplicables
                      según tu país)
                    </li>
                    <li>
                      Los impuestos se calcularán al momento del pago según tu
                      ubicación
                    </li>
                    <li>
                      Te notificaremos con 30 días de antelación antes de
                      aplicar aumentos
                    </li>
                  </ul>
                </div>
              </div>

              <div className="mt-6 mb-6">
                <h4 className="text-[16px] font-semibold text-black-eske dark:text-[#EAF2F8] mb-2">
                  4.2. Proceso de Pago
                </h4>
                <p className="mb-2">Métodos de pago aceptados:</p>
                <ul className="list-disc list-inside space-y-1 ml-4 mb-4">
                  <li>
                    Tarjetas de crédito/débito (Visa, MasterCard, American
                    Express)
                  </li>
                  <li>PayPal</li>
                  <li>Stripe</li>
                </ul>

                <p className="mb-2 font-semibold">Importante:</p>
                <ul className="list-disc list-inside space-y-1 ml-4">
                  <li>
                    Los pagos son procesados por pasarelas de pago certificadas
                    PCI DSS
                  </li>
                  <li>
                    Eskemma NO almacena números de tarjeta completos ni códigos
                    de seguridad (CVV)
                  </li>
                  <li>
                    El cobro de suscripciones es automático y recurrente, salvo
                    que canceles tu plan
                  </li>
                </ul>
              </div>

              <div className="mt-6 mb-6">
                <h4 className="text-[16px] font-semibold text-black-eske dark:text-[#EAF2F8] mb-3">
                  4.3. Reembolsos y Cancelaciones
                </h4>

                <div className="bg-blue-eske-10 p-4 rounded-lg mb-4 text-black-eske">
                  <p className="font-semibold mb-2">Política General:</p>
                  <p>
                    NO ofrecemos reembolsos por suscripciones ya iniciadas o
                    periodos de facturación ya transcurridos, excepto cuando
                    aplique una garantía específica promocional o por errores de
                    facturación comprobables atribuibles a Eskemma.
                  </p>
                </div>

                <div className="mt-4 mb-4">
                  <h5 className="text-[15px] font-semibold text-black-eske dark:text-[#EAF2F8] mb-2">
                    Para Usuarios en la Unión Europea (Derecho de Desistimiento)
                  </h5>
                  <p className="mb-2">
                    De acuerdo con la Directiva 2011/83/UE, tienes un derecho de
                    desistimiento de 14 días naturales desde la contratación del
                    servicio.
                  </p>
                  <p className="mb-2 font-semibold text-red-eske">
                    IMPORTANTE - Renuncia al derecho de desistimiento:
                  </p>
                  <p className="mb-2">
                    Al contratar, aceptas el inicio inmediato del servicio antes
                    del vencimiento del plazo de desistimiento. Esto constituye
                    una renuncia expresa a tu derecho de desistimiento.
                  </p>
                  <p className="mb-2">
                    ¿Cómo ejercer el derecho de desistimiento? (solo si NO has
                    comenzado a usar el servicio)
                  </p>
                  <ul className="list-disc list-inside space-y-1 ml-4">
                    <li>
                      Envía un correo a:{" "}
                      <a
                        href="mailto:reembolsos@eskemma.com"
                        className="text-bluegreen-eske dark:text-blue-eske-40 hover:dark:text-blue-eske-10 underline hover:text-bluegreen-eske-70 focus-ring-primary rounded"
                      >
                        reembolsos@eskemma.com
                      </a>
                    </li>
                    <li>Asunto: "Desistimiento UE - [Tu nombre completo]"</li>
                    <li>Incluye: número de pedido, fecha de contratación</li>
                    <li>Plazo para reembolso: 14 días desde tu solicitud</li>
                  </ul>
                </div>

                <div className="mt-4 mb-4">
                  <h5 className="text-[15px] font-semibold text-black-eske dark:text-[#EAF2F8] mb-2">
                    Cancelación de Suscripción (sin reembolso)
                  </h5>
                  <p className="mb-2">
                    Puedes cancelar tu suscripción en cualquier momento:
                  </p>
                  <ul className="list-disc list-inside space-y-1 ml-4">
                    <li>
                      Desde tu panel de usuario → Configuración → Suscripciones
                      → Cancelar
                    </li>
                    <li>
                      O enviando un correo a:{" "}
                      <a
                        href="mailto:cancelaciones@eskemma.com"
                        className="text-bluegreen-eske dark:text-blue-eske-40 hover:dark:text-blue-eske-10 underline hover:text-bluegreen-eske-70 focus-ring-primary rounded"
                      >
                        cancelaciones@eskemma.com
                      </a>
                    </li>
                  </ul>
                  <p className="mt-2 font-semibold text-bluegreen-eske dark:text-blue-eske-40">
                    Tu acceso continúa hasta el fin del período pagado. No se
                    emitirán reembolsos por el tiempo restante.
                  </p>
                </div>
              </div>
            </LegalSection>

            {/* Sección 5: Conducta del Usuario */}
            <LegalSection id="conducta" title="5. Conducta del Usuario">
              <p className="mb-4">Al usar Eskemma, te comprometes a:</p>

              <div className="mb-6">
                <p className="font-semibold text-green-eske mb-2">
                  ✅ Conductas Esperadas:
                </p>
                <ul className="list-disc list-inside space-y-1 ml-4">
                  <li>Utilizar la plataforma de manera lícita y ética</li>
                  <li>
                    Respetar los derechos de propiedad intelectual de Eskemma y
                    terceros
                  </li>
                  <li>Mantener la confidencialidad de tu cuenta</li>
                  <li>Proporcionar información veraz y actualizada</li>
                  <li>Respetar la privacidad de otros usuarios</li>
                  <li>Cumplir con las leyes aplicables en tu jurisdicción</li>
                </ul>
              </div>

              <div className="mb-6">
                <p className="font-semibold text-red-eske mb-2">
                  ❌ Queda Estrictamente Prohibido:
                </p>

                <p className="font-medium mt-3 mb-1">
                  Actividades fraudulentas:
                </p>
                <ul className="list-disc list-inside space-y-1 ml-4 mb-3">
                  <li>
                    Compartir cuentas individuales (salvo Plan Grupal
                    autorizado)
                  </li>
                  <li>Eludir pagos mediante métodos no autorizados</li>
                  <li>Usar tarjetas de crédito robadas o no autorizadas</li>
                </ul>

                <p className="font-medium mt-3 mb-1">
                  Ataques a la plataforma:
                </p>
                <ul className="list-disc list-inside space-y-1 ml-4 mb-3">
                  <li>Realizar ataques DDoS, DoS o similares</li>
                  <li>Intentar acceder a sistemas o datos mediante hacking</li>
                  <li>Explotar vulnerabilidades de seguridad</li>
                  <li>
                    Introducir virus, malware o cualquier código malicioso
                  </li>
                </ul>

                <p className="font-medium mt-3 mb-1">Contenido inapropiado:</p>
                <ul className="list-disc list-inside space-y-1 ml-4">
                  <li>Enviar spam o mensajes masivos no solicitados</li>
                  <li>
                    Publicar contenido difamatorio, discriminatorio u obsceno
                  </li>
                  <li>Acosar, amenazar o intimidar a otros usuarios</li>
                  <li>Infringir derechos de autor o propiedad intelectual</li>
                </ul>
              </div>

              <div className="bg-red-eske-10 dark:bg-red-900/20 p-4 rounded-lg">
                <p className="font-semibold mb-2 text-black-eske dark:text-[#EAF2F8]">
                  Consecuencias:
                </p>
                <p className="mb-2 text-black-eske dark:text-[#C7D6E0]">
                  Eskemma se reserva el derecho de:
                </p>
                <ul className="list-disc list-inside space-y-1 ml-4 text-black-eske dark:text-[#C7D6E0]">
                  <li>Suspender o eliminar cuentas que violen estas reglas</li>
                  <li>
                    Reportar actividades ilegales a las autoridades competentes
                  </li>
                  <li>Emprender acciones legales por daños causados</li>
                </ul>
              </div>
            </LegalSection>

            {/* Sección 6: Limitación de Responsabilidad */}
            <LegalSection
              id="limitacion"
              title="6. Limitación de Responsabilidad"
            >
              <div className="mt-6 mb-6">
                <h4 className="text-[16px] font-semibold text-black-eske dark:text-[#EAF2F8] mb-2">
                  6.1. Disponibilidad del Servicio
                </h4>
                <p className="mb-2 font-semibold">
                  Eskemma no garantiza que la Plataforma:
                </p>
                <ul className="list-disc list-inside space-y-1 ml-4 mb-4">
                  <li>Esté libre de errores o bugs</li>
                  <li>Funcione ininterrumpidamente 24/7</li>
                  <li>
                    Sea compatible con todos los dispositivos o navegadores
                  </li>
                  <li>Esté disponible en todo momento</li>
                </ul>

                <p className="mb-2">Causas de interrupción:</p>
                <ul className="list-disc list-inside space-y-1 ml-4">
                  <li>
                    Mantenimiento programado (te notificaremos con anticipación)
                  </li>
                  <li>
                    Fallas técnicas, de servidores o de proveedores de hosting
                  </li>
                  <li>Ataques cibernéticos o eventos de fuerza mayor</li>
                  <li>
                    Problemas de conectividad de internet (fuera de nuestro
                    control)
                  </li>
                </ul>
              </div>

              <div className="mt-6 mb-6">
                <h4 className="text-[16px] font-semibold text-black-eske dark:text-[#EAF2F8] mb-2">
                  6.2. Exclusiones de Responsabilidad
                </h4>

                <p className="mb-2 font-semibold">
                  Eskemma NO será responsable por:
                </p>

                <div className="mb-4">
                  <p className="font-medium mb-1">
                    Daños indirectos o consecuenciales:
                  </p>
                  <ul className="list-disc list-inside space-y-1 ml-4">
                    <li>Lucro cesante, pérdida de oportunidades electorales</li>
                    <li>Daño a la reputación política</li>
                    <li>
                      Pérdida de datos no atribuible a negligencia grave de
                      Eskemma
                    </li>
                  </ul>
                </div>

                <div className="mb-4">
                  <p className="font-medium mb-1">Resultados electorales:</p>
                  <ul className="list-disc list-inside space-y-1 ml-4">
                    <li>
                      Las herramientas de Eskemma son auxiliares para diseño de
                      estrategias
                    </li>
                    <li>
                      El éxito de tu proyecto político depende de múltiples
                      factores externos
                    </li>
                    <li>
                      No garantizamos resultados específicos (victorias
                      electorales, incremento de popularidad, etc.)
                    </li>
                  </ul>
                </div>
              </div>

              <div className="mt-6 mb-6 bg-yellow-eske-10 dark:bg-yellow-900/20 p-4 rounded-lg">
                <h4 className="text-[16px] font-semibold text-black-eske dark:text-[#EAF2F8] mb-2">
                  6.3. Limitación Monetaria de Responsabilidad
                </h4>
                <p className="mb-2 font-semibold">
                  En ningún caso la responsabilidad total de Eskemma excederá:
                </p>
                <ul className="list-disc list-inside space-y-1 ml-4">
                  <li>El monto pagado por ti en los últimos 12 meses, O</li>
                  <li>
                    $10,000 MXN (o equivalente en tu moneda), lo que sea menor
                  </li>
                </ul>
              </div>

              <div className="mt-6 mb-6">
                <h4 className="text-[16px] font-semibold text-black-eske dark:text-[#EAF2F8] mb-2">
                  6.4. Para Usuarios en la Unión Europea
                </h4>
                <p className="mb-2 font-semibold text-bluegreen-eske dark:text-blue-eske-40">
                  Derechos del consumidor protegidos:
                </p>
                <p className="mb-2">
                  Nada en estos términos limita tus derechos a:
                </p>
                <ul className="list-disc list-inside space-y-1 ml-4">
                  <li>Servicios conforme a la descripción proporcionada</li>
                  <li>
                    Servicios de calidad satisfactoria y libres de defectos
                  </li>
                  <li>
                    Garantías legales bajo tu legislación nacional (Directiva
                    2011/83/UE)
                  </li>
                </ul>
                <p className="mt-2 font-semibold">
                  Nuestras exclusiones NO aplican a:
                </p>
                <ul className="list-disc list-inside space-y-1 ml-4">
                  <li>
                    Muerte o daños personales causados por nuestra negligencia
                  </li>
                  <li>Fraude o declaraciones fraudulentas</li>
                </ul>
              </div>
            </LegalSection>

            {/* Sección 7: Ley Aplicable */}
            <LegalSection
              id="ley-aplicable"
              title="7. Ley Aplicable y Resolución de Controversias"
            >
              <div className="space-y-6">
                <div>
                  <h4 className="text-[16px] font-semibold text-black-eske dark:text-[#EAF2F8] mb-2">
                    7.1. Para Usuarios en México
                  </h4>
                  <p className="mb-2">
                    <strong>Ley aplicable:</strong> Leyes de los Estados Unidos
                    Mexicanos
                    <br />
                    <strong>Jurisdicción:</strong> Tribunales competentes de
                    Ciudad de México, México
                  </p>
                </div>

                <div>
                  <h4 className="text-[16px] font-semibold text-black-eske dark:text-[#EAF2F8] mb-2">
                    7.2. Para Usuarios en la Unión Europea
                  </h4>
                  <p className="mb-2">
                    <strong>Ley aplicable:</strong> Reglamento (CE) nº 593/2008
                    (Roma I) y Reglamento (UE) nº 1215/2012 (Bruselas I bis)
                  </p>
                  <p className="mb-2 font-semibold text-bluegreen-eske dark:text-blue-eske-40">
                    Protección del consumidor:
                  </p>
                  <p className="mb-2">
                    Los usuarios consumidores de la UE mantienen sus derechos
                    bajo las leyes de protección al consumidor de su país de
                    residencia habitual.
                  </p>
                  <p className="mb-2">
                    <strong>Jurisdicción:</strong> Puedes presentar
                    reclamaciones ante los tribunales de tu lugar de residencia
                    o ante los tribunales de Ciudad de México (opcional).
                  </p>
                </div>

                <div>
                  <h4 className="text-[16px] font-semibold text-black-eske dark:text-[#EAF2F8] mb-2">
                    7.3. Para Usuarios en Estados Unidos
                  </h4>
                  <p className="mb-2">
                    <strong>Ley aplicable:</strong> Leyes del Estado de Delaware
                    <br />
                    <strong>Jurisdicción:</strong> Tribunales estatales y
                    federales ubicados en Wilmington, Delaware
                  </p>

                  <div className="bg-blue-eske-10 p-4 rounded-lg mt-4 text-black-eske">
                    <p className="font-semibold mb-2">
                      Cláusula de Arbitraje (disputas menores a $10,000 USD):
                    </p>
                    <p className="mb-2">
                      Para disputas menores a $10,000 USD, acordamos resolver
                      controversias mediante arbitraje vinculante en lugar de
                      tribunales.
                    </p>
                    <p className="mb-2 font-semibold">
                      Derecho a opt-out (renunciar al arbitraje):
                    </p>
                    <ul className="list-disc list-inside space-y-1 ml-4">
                      <li>Puedes optar por NO participar en arbitraje</li>
                      <li>
                        Envía un correo a:{" "}
                        <a
                          href="mailto:legal@eskemma.com"
                          className="text-bluegreen-eske underline hover:text-bluegreen-eske-70 focus-ring-primary rounded"
                        >
                          legal@eskemma.com
                        </a>
                      </li>
                      <li>
                        Plazo: Dentro de 30 días de aceptar estos Términos
                      </li>
                    </ul>
                  </div>
                </div>
              </div>
            </LegalSection>

            {/* Sección 8: Compromiso de Accesibilidad */}
            <LegalSection
              id="accesibilidad"
              title="8. Compromiso de Accesibilidad"
            >
              <p className="mb-4">
                Eskemma se esfuerza por hacer que nuestra plataforma sea
                accesible para todas las personas, incluyendo aquellas con
                discapacidades.
              </p>

              <div className="mt-6 mb-6">
                <h4 className="text-[16px] font-semibold text-black-eske dark:text-[#EAF2F8] mb-2">
                  8.1. Estándares de Accesibilidad
                </h4>
                <p className="mb-2">Trabajamos para cumplir con:</p>
                <ul className="list-disc list-inside space-y-1 ml-4">
                  <li>
                    WCAG 2.1 nivel AA (Web Content Accessibility Guidelines)
                  </li>
                  <li>
                    Americans with Disabilities Act (ADA) - para usuarios en USA
                  </li>
                  <li>
                    Directiva (UE) 2016/2102 - para usuarios en la Unión Europea
                  </li>
                </ul>
              </div>

              <div className="mt-6 mb-6 bg-blue-eske-10 p-4 rounded-lg text-black-eske">
                <h4 className="text-[16px] font-semibold text-black-eske mb-2">
                  8.2. Solicitud de Ajustes Razonables
                </h4>
                <p className="mb-2">
                  Si experimentas dificultades de accesibilidad:
                </p>
                <p>
                  <strong>Contacta a:</strong>{" "}
                  <a
                    href="mailto:accesibilidad@eskemma.com"
                    className="text-bluegreen-eske underline hover:text-bluegreen-eske-70 focus-ring-primary rounded"
                  >
                    accesibilidad@eskemma.com
                  </a>
                  <br />
                  <strong>Responderemos en:</strong> 5 días hábiles
                </p>
              </div>
            </LegalSection>

            {/* Sección 9: Contacto */}
            <LegalSection id="contacto" title="9. Contacto">
              <p className="mb-4">
                Si tienes dudas sobre estas Condiciones, contáctanos en:
              </p>

              <div className="bg-bluegreen-eske-10 dark:bg-[#112230] p-4 rounded-lg">
                <p className="mb-2 text-black-eske dark:text-[#C7D6E0]">
                  <strong>Correo general:</strong>{" "}
                  <a
                    href="mailto:contacto@eskemma.com"
                    className="text-bluegreen-eske dark:text-blue-eske-40 hover:dark:text-blue-eske-10 underline hover:text-bluegreen-eske-70 focus-ring-primary rounded"
                  >
                    contacto@eskemma.com
                  </a>
                  <br />
                  <strong>Soporte técnico:</strong>{" "}
                  <a
                    href="mailto:soporte@eskemma.com"
                    className="text-bluegreen-eske dark:text-blue-eske-40 hover:dark:text-blue-eske-10 underline hover:text-bluegreen-eske-70 focus-ring-primary rounded"
                  >
                    soporte@eskemma.com
                  </a>
                  <br />
                  <strong>Asuntos legales:</strong>{" "}
                  <a
                    href="mailto:legal@eskemma.com"
                    className="text-bluegreen-eske dark:text-blue-eske-40 hover:dark:text-blue-eske-10 underline hover:text-bluegreen-eske-70 focus-ring-primary rounded"
                  >
                    legal@eskemma.com
                  </a>
                  <br />
                  <strong>Cancelaciones:</strong>{" "}
                  <a
                    href="mailto:cancelaciones@eskemma.com"
                    className="text-bluegreen-eske dark:text-blue-eske-40 hover:dark:text-blue-eske-10 underline hover:text-bluegreen-eske-70 focus-ring-primary rounded"
                  >
                    cancelaciones@eskemma.com
                  </a>
                  <br />
                  <strong>Accesibilidad:</strong>{" "}
                  <a
                    href="mailto:accesibilidad@eskemma.com"
                    className="text-bluegreen-eske dark:text-blue-eske-40 hover:dark:text-blue-eske-10 underline hover:text-bluegreen-eske-70 focus-ring-primary rounded"
                  >
                    accesibilidad@eskemma.com
                  </a>
                </p>
                <p className="mt-2 text-black-eske dark:text-[#C7D6E0]">
                  <strong>Horario de atención:</strong>
                  <br />
                  Lunes a Viernes, 9:00 AM - 6:00 PM (Hora del Centro de México)
                </p>
              </div>
            </LegalSection>

            {/* CTA Final */}
            <div className="mt-12 p-6 bg-gray-eske-30 dark:bg-[#21425E] rounded-lg text-white-eske text-center">
              <h3 className="text-2xl font-bold text-black-eske dark:text-[#EAF2F8] mb-4">
                ¿Listo para comenzar?
              </h3>
              <p className="text-[16px] text-black-eske dark:text-[#C7D6E0] mb-6">
                Al usar Eskemma, confirmas que has leído y aceptado estas
                Condiciones de Uso.
              </p>
              <div className="flex flex-col sm:flex-row gap-4 justify-center max-w-md mx-auto">
                <Link href="/" className="flex-1">
                  <Button label="Volver al Inicio" variant="primary" />
                </Link>
                <Link href="/politica-de-privacidad" className="flex-1">
                  <Button
                    label="Ver Política de Privacidad"
                    variant="secondary"
                  />
                </Link>
              </div>
            </div>

            {/* Nota final */}
            <div className="mt-8 text-center text-[12px] text-black-eske-30 dark:text-[#6D8294]">
              <p>
                Estas Condiciones son complementarias a nuestra Política de Privacidad.
              </p>
              <p>
                Te recomendamos leer ambos documentos para entender completamente tus derechos y obligaciones al usar Eskemma.
              </p>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

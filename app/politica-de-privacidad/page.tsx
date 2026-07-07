// app/politica-de-privacidad/page.tsx
import type { Metadata } from "next";
import Link from "next/link";
import LegalHero from "../components/legal/LegalHero";
import LegalSection from "../components/legal/LegalSection";
import TableOfContents, { TocItem } from "../components/legal/TableOfContents";
import Button from "../components/Button";
import CloseModalsOnMount from "../components/legal/CloseModalsOnMount";

export const metadata: Metadata = {
  title: "Política de Privacidad | Eskemma",
  description:
    "Conoce cómo Eskemma protege tus datos personales. Cumplimiento GDPR, CCPA, LFPDPPP.",
  robots: "index, follow",
};

export default function PoliticaPrivacidad() {
  // Definir el índice de contenidos
  const tocItems: TocItem[] = [
    { id: "responsable", title: "1. Responsable del Tratamiento" },
    { id: "datos-recopilados", title: "2. ¿Qué Datos Recopilamos?" },
    { id: "uso-datos", title: "3. ¿Para Qué Usamos Tus Datos?" },
    { id: "proteccion", title: "4. ¿Cómo Protegemos Tus Datos?" },
    { id: "compartir-datos", title: "5. ¿Compartimos Tus Datos?" },
    { id: "derechos", title: "6. Tus Derechos sobre Tus Datos" },
    { id: "retencion", title: "7. Retención de Datos" },
    { id: "cookies", title: "8. Cookies y Tecnologías" },
    { id: "menores", title: "9. Protección de Menores" },
    { id: "brechas", title: "10. Notificación de Brechas" },
    { id: "contacto", title: "11. Contacto" },
    { id: "ley-aplicable", title: "12. Jurisdicción y Ley Aplicable" },
  ];

  return (
    <div className="min-h-screen bg-white-eske dark:bg-[#0B1620]">
      <CloseModalsOnMount />
      {/* Hero Section */}
      <LegalHero
        title="Política de Privacidad"
        subtitle="Tu privacidad es nuestra prioridad"
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
                En Eskemma, valoramos tu privacidad y nos comprometemos a
                proteger tus datos personales. Esta Política de Privacidad
                explica cómo recopilamos, usamos, compartimos y protegemos la
                información que nos proporcionas al utilizar nuestros servicios,
                herramientas y plataforma. Al acceder o usar Eskemma, aceptas
                los términos descritos en este documento.
              </p>
            </div>

            {/* Sección 1: Responsable del Tratamiento */}
            <LegalSection
              id="responsable"
              title="1. Responsable del Tratamiento de Datos"
            >
              <p className="mb-4">
                <strong>Eskemma S.A.P.I. de C.V.</strong>
                <br />
                <strong>Correo electrónico general:</strong>{" "}
                <a
                  href="mailto:contacto@eskemma.com"
                  className="text-bluegreen-eske underline hover:text-bluegreen-eske-70 dark:text-blue-eske-40 hover:dark:text-blue-eske-10 focus-ring-primary rounded"
                >
                  contacto@eskemma.com
                </a>
                <br />
                <strong>Correo para privacidad:</strong>{" "}
                <a
                  href="mailto:privacidad@eskemma.com"
                  className="text-bluegreen-eske underline hover:text-bluegreen-eske-70 dark:text-blue-eske-40 hover:dark:text-blue-eske-10 focus-ring-primary rounded"
                >
                  privacidad@eskemma.com
                </a>
              </p>

              <div className="mt-4">
                <h4 className="text-[16px] font-semibold text-black-eske dark:text-[#EAF2F8] mb-2">
                  1.1. Delegado de Protección de Datos (para usuarios de la
                  Unión Europea)
                </h4>
                <p>
                  Para consultas relacionadas con el Reglamento General de
                  Protección de Datos (GDPR):
                  <br />
                  <strong>Email:</strong>{" "}
                  <a
                    href="mailto:dpo@eskemma.com"
                    className="text-bluegreen-eske underline hover:text-bluegreen-eske-70 dark:text-blue-eske-40 hover:dark:text-blue-eske-10 focus-ring-primary rounded"
                  >
                    dpo@eskemma.com
                  </a>
                </p>
              </div>
            </LegalSection>

            {/* Sección 2: Datos Recopilados */}
            <LegalSection
              id="datos-recopilados"
              title="2. ¿Qué Datos Personales Recopilamos?"
            >
              <p className="mb-4">
                Recopilamos información que nos proporcionas directamente al
                registrarte, suscribirte o utilizar nuestros servicios. Esto
                puede incluir:
              </p>

              <div className="mt-6 mb-6">
                <h4 className="text-[16px] font-semibold text-black-eske dark:text-[#EAF2F8] mb-2">
                  2.1. Datos de Identificación
                </h4>
                <ul className="list-disc list-inside space-y-1 ml-4">
                  <li>Nombre completo</li>
                  <li>Correo electrónico</li>
                  <li>Número de teléfono (opcional)</li>
                  <li>Nombre de usuario y contraseña (cifrada)</li>
                  <li>
                    Información de facturación (si aplica): RFC, razón social,
                    domicilio fiscal
                  </li>
                </ul>
              </div>

              <div className="mt-6 mb-6">
                <h4 className="text-[16px] font-semibold text-black-eske dark:text-[#EAF2F8] mb-2">
                  2.2. Datos de Uso
                </h4>
                <ul className="list-disc list-inside space-y-1 ml-4">
                  <li>
                    Información sobre cómo interactúas con nuestra plataforma
                  </li>
                  <li>Dirección IP y datos de navegación</li>
                  <li>
                    Información del dispositivo (tipo de navegador, sistema
                    operativo)
                  </li>
                </ul>
              </div>

              <div className="mt-6 mb-6">
                <h4 className="text-[16px] font-semibold text-black-eske dark:text-[#EAF2F8] mb-2">
                  2.3. Datos de Pago
                </h4>
                <ul className="list-disc list-inside space-y-1 ml-4">
                  <li>
                    Información de tarjetas de crédito/débito (procesada por
                    pasarelas de pago seguras)
                  </li>
                  <li>
                    <strong>IMPORTANTE:</strong> No almacenamos números de
                    tarjeta completos ni códigos de seguridad (CVV)
                  </li>
                  <li>Historial de transacciones y facturación</li>
                </ul>
              </div>

              <div className="mt-6 mb-6">
                <h4 className="text-[16px] font-semibold text-black-eske dark:text-[#EAF2F8] mb-2">
                  2.4. Datos de Proyectos Políticos
                </h4>
                <p className="mb-2">
                  Información que ingreses en herramientas como Sefix o Moddulo
                  (análisis, estrategias, datos demográficos).
                </p>
                <p className="font-semibold text-bluegreen-eske dark:text-blue-eske-40">
                  Estos datos son estrictamente confidenciales y solo se
                  utilizan para brindarte el servicio.
                </p>
              </div>
            </LegalSection>

            {/* Sección 3: Uso de Datos */}
            <LegalSection id="uso-datos" title="3. ¿Para Qué Usamos Tus Datos?">
              <p className="mb-4">
                Utilizamos tu información para los siguientes fines:
              </p>

              <div className="mt-6 mb-6">
                <h4 className="text-[16px] font-semibold text-black-eske dark:text-[#EAF2F8] mb-3">
                  3.1. Base Legal para el Tratamiento de Datos
                </h4>
                <p className="mb-2">
                  Procesamos tus datos personales bajo las siguientes bases
                  legales (aplicables a usuarios de la Unión Europea conforme al
                  GDPR):
                </p>
                <ul className="list-disc list-inside space-y-2 ml-4">
                  <li>
                    <strong>Ejecución de contrato</strong> (Art. 6(1)(b) GDPR):
                    Para proveer los servicios que contrataste
                  </li>
                  <li>
                    <strong>Consentimiento</strong> (Art. 6(1)(a) GDPR): Para
                    envío de comunicaciones de marketing y boletines
                  </li>
                  <li>
                    <strong>Interés legítimo</strong> (Art. 6(1)(f) GDPR): Para
                    mejorar nuestros servicios y prevenir fraude
                  </li>
                  <li>
                    <strong>Obligación legal</strong> (Art. 6(1)(c) GDPR): Para
                    cumplir con requerimientos fiscales y legales
                  </li>
                </ul>
              </div>

              <div className="mt-6 mb-6">
                <h4 className="text-[16px] font-semibold text-black-eske dark:text-[#EAF2F8] mb-2">
                  3.2. Fines Específicos
                </h4>

                <p className="font-semibold mb-2">
                  Proveer y mejorar nuestros servicios:
                </p>
                <ul className="list-disc list-inside space-y-1 ml-4 mb-4">
                  <li>Permitir el acceso a tu cuenta y herramientas</li>
                  <li>Procesar pagos y gestionar suscripciones</li>
                  <li>Ofrecer soporte técnico</li>
                  <li>Personalizar tu experiencia en la plataforma</li>
                </ul>

                <p className="font-semibold mb-2">Comunicación:</p>
                <ul className="list-disc list-inside space-y-1 ml-4 mb-4">
                  <li>Enviar notificaciones sobre tu cuenta</li>
                  <li>Responder a tus consultas</li>
                  <li>
                    Enviar boletines informativos (solo con tu consentimiento)
                  </li>
                </ul>

                <p className="font-semibold mb-2">
                  Seguridad y cumplimiento legal:
                </p>
                <ul className="list-disc list-inside space-y-1 ml-4 mb-4">
                  <li>Detectar y prevenir actividades fraudulentas</li>
                  <li>Cumplir con obligaciones fiscales y regulatorias</li>
                  <li>Proteger nuestros derechos y los de otros usuarios</li>
                </ul>
              </div>
            </LegalSection>

            {/* Sección 4: Protección de Datos */}
            <LegalSection
              id="proteccion"
              title="4. ¿Cómo Protegemos Tus Datos?"
            >
              <p className="mb-4">
                Implementamos medidas técnicas y organizativas para garantizar
                la seguridad de tu información:
              </p>

              <div className="mt-6 mb-6">
                <h4 className="text-[16px] font-semibold text-black-eske dark:text-[#EAF2F8] mb-2">
                  4.1. Medidas Técnicas
                </h4>
                <ul className="list-disc list-inside space-y-1 ml-4">
                  <li>
                    <strong>Cifrado de datos:</strong> SSL/TLS para datos en
                    tránsito, cifrado AES-256 para datos en reposo
                  </li>
                  <li>
                    <strong>Autenticación segura:</strong> Contraseñas hasheadas
                    con algoritmos bcrypt/argon2
                  </li>
                  <li>Firewalls y sistemas de detección de intrusos</li>
                  <li>Backups cifrados automáticos con retención de 30 días</li>
                  <li>Certificados de seguridad actualizados (SSL/TLS)</li>
                </ul>
              </div>

              <div className="mt-6 mb-6">
                <h4 className="text-[16px] font-semibold text-black-eske dark:text-[#EAF2F8] mb-2">
                  4.2. Medidas Organizativas
                </h4>
                <ul className="list-disc list-inside space-y-1 ml-4">
                  <li>
                    Acceso restringido: Solo personal autorizado puede acceder a
                    datos personales
                  </li>
                  <li>
                    Capacitación continua del personal en protección de datos
                  </li>
                  <li>
                    Políticas internas de manejo de información confidencial
                  </li>
                  <li>Auditorías de seguridad periódicas</li>
                  <li>
                    Pasarelas de pago certificadas PCI DSS (Stripe, PayPal)
                  </li>
                </ul>
              </div>

              <div className="mt-6 mb-6">
                <h4 className="text-[16px] font-semibold text-black-eske dark:text-[#EAF2F8] mb-2">
                  4.3. Cumplimiento Normativo
                </h4>
                <ul className="list-disc list-inside space-y-1 ml-4">
                  <li>
                    <strong>LFPDPPP</strong> (México): Ley Federal de Protección
                    de Datos Personales
                  </li>
                  <li>
                    <strong>GDPR</strong> (Unión Europea): Reglamento General de
                    Protección de Datos
                  </li>
                  <li>
                    <strong>CCPA</strong> (California, USA): California Consumer
                    Privacy Act
                  </li>
                </ul>
              </div>
            </LegalSection>

            {/* Sección 5: Compartir Datos */}
            <LegalSection
              id="compartir-datos"
              title="5. ¿Compartimos Tus Datos con Terceros?"
            >
              <p className="mb-4 font-bold text-bluegreen-eske dark:text-blue-eske-40">
                No vendemos ni alquilamos tu información personal bajo ninguna
                circunstancia.
              </p>
              <p className="mb-4">
                Solo compartimos datos en los siguientes casos:
              </p>

              <div className="mt-6 mb-6">
                <h4 className="text-[16px] font-semibold text-black-eske dark:text-[#EAF2F8] mb-2">
                  5.1. Proveedores de Servicios
                </h4>
                <p className="mb-2">
                  Empresas que nos ayudan a operar la plataforma. Estos
                  proveedores están obligados contractualmente a proteger tu
                  información:
                </p>
                <ul className="list-disc list-inside space-y-1 ml-4">
                  <li>Hosting y almacenamiento</li>
                  <li>Pasarelas de pago: Stripe, PayPal</li>
                  <li>
                    Herramientas de análisis: Google Analytics (datos
                    anonimizados)
                  </li>
                  <li>Servicios de email</li>
                </ul>
              </div>

              <div className="mt-6 mb-6">
                <h4 className="text-[16px] font-semibold text-black-eske dark:text-[#EAF2F8] mb-2">
                  5.2. Transferencias Internacionales de Datos (importante para
                  usuarios de la UE)
                </h4>
                <p className="mb-2">
                  Si resides en la Unión Europea, ten en cuenta que:
                </p>
                <ul className="list-disc list-inside space-y-2 ml-4">
                  <li>
                    Tus datos pueden ser transferidos y procesados en{" "}
                    <strong>
                      México y otros países fuera del Espacio Económico Europeo
                      (EEE)
                    </strong>
                  </li>
                  <li>
                    Implementamos{" "}
                    <strong>Cláusulas Contractuales Estándar (SCC)</strong>{" "}
                    aprobadas por la Comisión Europea
                  </li>
                  <li>
                    Puedes solicitar información detallada sobre las garantías
                    específicas en:{" "}
                    <a
                      href="mailto:dpo@eskemma.com"
                      className="text-bluegreen-eske underline hover:text-bluegreen-eske-70 dark:text-blue-eske-40 hover:dark:text-blue-eske-10 focus-ring-primary rounded"
                    >
                      dpo@eskemma.com
                    </a>
                  </li>
                </ul>
              </div>
            </LegalSection>

            {/* Sección 6: Derechos del Usuario */}
            <LegalSection id="derechos" title="6. Tus Derechos sobre Tus Datos">
              <div className="mt-6 mb-6">
                <h4 className="text-[16px] font-semibold text-black-eske dark:text-[#EAF2F8] mb-3">
                  6.1. Para Usuarios en la Unión Europea (GDPR)
                </h4>
                <p className="mb-2">
                  Tienes los siguientes derechos bajo el Reglamento General de
                  Protección de Datos:
                </p>
                <ul className="list-disc list-inside space-y-2 ml-4">
                  <li>
                    <strong>Acceso (Art. 15 GDPR):</strong> Solicitar una copia
                    de tus datos personales
                  </li>
                  <li>
                    <strong>Rectificación (Art. 16 GDPR):</strong> Corregir
                    información inexacta
                  </li>
                  <li>
                    <strong>
                      Supresión / Derecho al olvido (Art. 17 GDPR):
                    </strong>{" "}
                    Solicitar eliminación de tus datos
                  </li>
                  <li>
                    <strong>Limitación del tratamiento (Art. 18 GDPR):</strong>{" "}
                    Restringir temporalmente el procesamiento
                  </li>
                  <li>
                    <strong>Portabilidad (Art. 20 GDPR):</strong> Recibir tus
                    datos en formato estructurado
                  </li>
                  <li>
                    <strong>Oposición (Art. 21 GDPR):</strong> Oponerte al
                    procesamiento basado en interés legítimo
                  </li>
                  <li>
                    <strong>Presentar queja:</strong> Ante tu autoridad de
                    protección de datos nacional
                  </li>
                </ul>
              </div>

              <div className="mt-6 mb-6">
                <h4 className="text-[16px] font-semibold text-black-eske dark:text-[#EAF2F8] mb-3">
                  6.2. Para Usuarios en California, USA (CCPA)
                </h4>
                <ul className="list-disc list-inside space-y-2 ml-4">
                  <li>
                    <strong>Derecho a saber:</strong> Qué categorías de datos
                    recopilamos y con quién los compartimos
                  </li>
                  <li>
                    <strong>Derecho a eliminar:</strong> Solicitar eliminación
                    de tus datos
                  </li>
                  <li>
                    <strong>Derecho a opt-out:</strong> Optar por que no
                    vendamos tus datos
                    <br />
                    <span className="font-semibold text-bluegreen-eske dark:text-blue-eske-40">
                      NOTA: Eskemma NO vende datos personales
                    </span>
                  </li>
                  <li>
                    <strong>Derecho a no discriminación:</strong> No recibirás
                    trato discriminatorio
                  </li>
                </ul>
              </div>

              <div className="mt-6 mb-6">
                <h4 className="text-[16px] font-semibold text-black-eske dark:text-[#EAF2F8] mb-3">
                  6.3. Para Usuarios en México (LFPDPPP)
                </h4>
                <p className="mb-2">Tienes los siguientes derechos ARCO:</p>
                <ul className="list-disc list-inside space-y-1 ml-4">
                  <li>
                    <strong>Acceso:</strong> Conocer qué datos personales
                    tenemos sobre ti
                  </li>
                  <li>
                    <strong>Rectificación:</strong> Solicitar corrección de
                    datos inexactos
                  </li>
                  <li>
                    <strong>Cancelación:</strong> Solicitar eliminación de tus
                    datos
                  </li>
                  <li>
                    <strong>Oposición:</strong> Oponerte al uso de tus datos
                    para fines específicos
                  </li>
                </ul>
              </div>

              <div className="mt-6 mb-6 bg-blue-eske-10 p-4 rounded-lg text-black-eske">
                <h4 className="text-[16px] font-semibold text-black-eske mb-2">
                  6.4. ¿Cómo Ejercer Estos Derechos?
                </h4>
                <p className="mb-2">
                  <strong>Envía un correo a:</strong>{" "}
                  <a
                    href="mailto:privacidad@eskemma.com"
                    className="text-bluegreen-eske underline hover:text-bluegreen-eske-70 focus-ring-primary rounded"
                  >
                    privacidad@eskemma.com
                  </a>
                  <br />
                  <strong>Asunto:</strong> "Solicitud de Derechos ARCO" / "GDPR
                  Request" / "CCPA Request"
                </p>
                <p className="mb-2">
                  <strong>Incluye:</strong>
                </p>
                <ul className="list-disc list-inside space-y-1 ml-4 mb-2">
                  <li>Copia de tu identificación oficial</li>
                  <li>Descripción clara de tu solicitud</li>
                  <li>Dirección de email asociada a tu cuenta</li>
                </ul>
                <p className="mb-2">
                  <strong>Plazos de respuesta:</strong>
                </p>
                <ul className="list-disc list-inside space-y-1 ml-4">
                  <li>GDPR (UE): 1 mes</li>
                  <li>CCPA (California): 45 días</li>
                  <li>LFPDPPP (México): 20 días hábiles</li>
                </ul>
                <p className="font-semibold text-bluegreen-eske mt-2">
                  El ejercicio de estos derechos es GRATUITO.
                </p>
              </div>
            </LegalSection>

            {/* Sección 7: Retención de Datos */}
            <LegalSection id="retencion" title="7. Retención de Datos">
              <p className="mb-4">
                Conservamos tu información mientras mantengas una cuenta activa
                en Eskemma o según sea necesario para cumplir con obligaciones
                legales.
              </p>

              <div className="mt-6 mb-6">
                <h4 className="text-[16px] font-semibold text-black-eske dark:text-[#EAF2F8] mb-2">
                  7.1. Después de Cancelar tu Suscripción
                </h4>
                <ul className="list-disc list-inside space-y-2 ml-4">
                  <li>
                    <strong>Datos de cuenta:</strong> Se eliminan después de 6
                    meses, salvo obligaciones legales
                  </li>
                  <li>
                    <strong>Datos de proyectos:</strong> Puedes solicitar una
                    copia antes de cancelar. Se eliminan después de 6 meses de
                    inactividad
                  </li>
                  <li>
                    <strong>Datos de facturación:</strong> Se conservan por 5
                    años para cumplir con obligaciones fiscales en México
                  </li>
                  <li>
                    <strong>Datos de comunicaciones:</strong> Se conservan por 2
                    años
                  </li>
                </ul>
              </div>

              <div className="mt-6 mb-6">
                <h4 className="text-[16px] font-semibold text-black-eske dark:text-[#EAF2F8] mb-2">
                  7.2. Eliminación Segura
                </h4>
                <p>
                  Cuando eliminamos datos, lo hacemos de forma permanente
                  utilizando métodos seguros que impiden su recuperación
                  (borrado seguro, sobrescritura de datos).
                </p>
              </div>
            </LegalSection>

            {/* Sección 8: Cookies */}
            <LegalSection
              id="cookies"
              title="8. Cookies y Tecnologías Similares"
            >
              <p className="mb-4">
                Usamos cookies y tecnologías similares para mejorar tu
                experiencia, analizar el uso de la plataforma y mostrar
                contenido relevante.
              </p>

              <div className="mt-6 mb-6">
                <h4 className="text-[16px] font-semibold text-black-eske dark:text-[#EAF2F8] mb-2">
                  8.1. Tipos de Cookies
                </h4>

                <p className="font-semibold mb-2">
                  Cookies Esenciales (obligatorias):
                </p>
                <ul className="list-disc list-inside space-y-1 ml-4 mb-4">
                  <li>Autenticación de sesión</li>
                  <li>Seguridad</li>
                  <li>Funcionalidad básica</li>
                  <li>Duración: Solo durante la sesión</li>
                </ul>

                <p className="font-semibold mb-2">
                  Cookies Analíticas (opcionales):
                </p>
                <ul className="list-disc list-inside space-y-1 ml-4 mb-4">
                  <li>Google Analytics (datos anonimizados)</li>
                  <li>Duración: Hasta 2 años</li>
                  <li>Finalidad: Mejorar la experiencia de usuario</li>
                </ul>

                <p className="font-semibold mb-2">
                  Cookies de Marketing (opcionales):
                </p>
                <ul className="list-disc list-inside space-y-1 ml-4 mb-4">
                  <li>Facebook Pixel, Google Ads</li>
                  <li>Duración: Hasta 90 días</li>
                  <li>Finalidad: Mostrarte anuncios relevantes</li>
                </ul>
              </div>

              <div className="mt-6 mb-6 bg-yellow-eske-10 dark:bg-yellow-900/20 p-4 rounded-lg">
                <h4 className="text-[16px] font-semibold text-black-eske dark:text-[#EAF2F8] mb-2">
                  8.2. Gestión de Cookies
                </h4>
                <p className="mb-2">
                  Puedes configurar tus preferencias de cookies en cualquier
                  momento haciendo clic en el banner que aparece al acceder a
                  Eskemma por primera vez, o desde la configuración de tu
                  navegador.
                </p>
                <p>
                  <Link
                    href="/politica-de-cookies"
                    className="text-bluegreen-eske hover:text-bluegreen-eske-70 underline font-medium dark:text-blue-eske-40 hover:dark:text-blue-eske-10 focus-ring-primary rounded"
                  >
                    Ver Política de Cookies completa →
                  </Link>
                </p>
              </div>
            </LegalSection>

            {/* Sección 9: Protección de Menores */}
            <LegalSection id="menores" title="9. Protección de Menores">
              <p className="mb-4 font-semibold">
                Eskemma NO está dirigido a menores de 18 años. No recopilamos
                intencionalmente información de menores.
              </p>

              <div className="mt-6 mb-6">
                <h4 className="text-[16px] font-semibold text-black-eske dark:text-[#EAF2F8] mb-2">
                  9.1. Para Usuarios en Estados Unidos (COPPA)
                </h4>
                <ul className="list-disc list-inside space-y-1 ml-4">
                  <li>
                    No recopilamos intencionalmente información de menores de 13
                    años
                  </li>
                  <li>
                    Si eres padre/tutor y descubres que tu hijo ha proporcionado
                    información, contacta:{" "}
                    <a
                      href="mailto:privacidad@eskemma.com"
                      className="text-bluegreen-eske underline hover:text-bluegreen-eske-70 dark:text-blue-eske-40 hover:dark:text-blue-eske-10 focus-ring-primary rounded"
                    >
                      privacidad@eskemma.com
                    </a>
                  </li>
                  <li>
                    Eliminaremos la información del menor en un plazo de 48
                    horas
                  </li>
                </ul>
              </div>

              <div className="mt-6 mb-6">
                <h4 className="text-[16px] font-semibold text-black-eske dark:text-[#EAF2F8] mb-2">
                  9.2. Para Usuarios en la Unión Europea (GDPR)
                </h4>
                <p className="mb-2">
                  Menores de 16 años (o la edad aplicable en tu país según Art.
                  8 GDPR) requieren consentimiento parental verificable.
                </p>
              </div>

              <div className="mt-6 mb-6">
                <h4 className="text-[16px] font-semibold text-black-eske dark:text-[#EAF2F8] mb-2">
                  9.3. Para Usuarios en México (LFPDPPP)
                </h4>
                <p>Menores de 18 años requieren autorización de padre/tutor.</p>
              </div>
            </LegalSection>

            {/* Sección 10: Notificación de Brechas */}
            <LegalSection
              id="brechas"
              title="10. Notificación de Brechas de Seguridad"
            >
              <p className="mb-4">
                A pesar de nuestras medidas de seguridad, ningún sistema es 100%
                infalible. En caso de una brecha de seguridad que afecte tus
                datos personales:
              </p>

              <div className="mt-6 mb-6">
                <h4 className="text-[16px] font-semibold text-black-eske dark:text-[#EAF2F8] mb-2">
                  10.1. Para Usuarios en la Unión Europea (GDPR Art. 33-34)
                </h4>
                <ul className="list-disc list-inside space-y-2 ml-4">
                  <li>
                    Notificación a la autoridad de protección de datos dentro de
                    72 horas
                  </li>
                  <li>
                    Notificación a los usuarios afectados sin demora indebida si
                    existe alto riesgo
                  </li>
                  <li>
                    Información sobre: naturaleza de la brecha, datos afectados,
                    medidas tomadas
                  </li>
                </ul>
              </div>

              <div className="mt-6 mb-6">
                <h4 className="text-[16px] font-semibold text-black-eske dark:text-[#EAF2F8] mb-2">
                  10.2. Para Usuarios en California, USA
                </h4>
                <p>
                  Notificación sin demora injustificada según Cal. Civ. Code §
                  1798.82
                </p>
              </div>
            </LegalSection>

            {/* Sección 11: Contacto */}
            <LegalSection id="contacto" title="11. Contacto">
              <p className="mb-4">
                Si tienes preguntas, dudas o preocupaciones sobre tu privacidad
                o esta política:
              </p>

              <div className="bg-bluegreen-eske-10 dark:bg-[#112230] p-4 rounded-lg">
                <p className="mb-2 text-black-eske dark:text-[#C7D6E0]">
                  <strong>Correo general:</strong>{" "}
                  <a
                    href="mailto:contacto@eskemma.com"
                    className="text-bluegreen-eske underline hover:text-bluegreen-eske-70 dark:text-blue-eske-40 hover:dark:text-blue-eske-10 focus-ring-primary rounded"
                  >
                    contacto@eskemma.com
                  </a>
                  <br />
                  <strong>Correo para privacidad:</strong>{" "}
                  <a
                    href="mailto:privacidad@eskemma.com"
                    className="text-bluegreen-eske underline hover:text-bluegreen-eske-70 dark:text-blue-eske-40 hover:dark:text-blue-eske-10 focus-ring-primary rounded"
                  >
                    privacidad@eskemma.com
                  </a>
                  <br />
                  <strong>Delegado de Protección de Datos (UE):</strong>{" "}
                  <a
                    href="mailto:dpo@eskemma.com"
                    className="text-bluegreen-eske underline hover:text-bluegreen-eske-70 dark:text-blue-eske-40 hover:dark:text-blue-eske-10 focus-ring-primary rounded"
                  >
                    dpo@eskemma.com
                  </a>
                </p>
                <p className="mt-2 text-[14px] text-black-eske dark:text-[#C7D6E0]">
                  <strong>Horario de atención:</strong>
                  <br />
                  Lunes a Viernes, 9:00 AM - 6:00 PM (Hora del Centro de México)
                </p>
              </div>
            </LegalSection>

            {/* Sección 12: Ley Aplicable */}
            <LegalSection
              id="ley-aplicable"
              title="12. Jurisdicción y Ley Aplicable"
            >
              <div className="space-y-4">
                <div>
                  <h4 className="text-[16px] font-semibold text-black-eske dark:text-[#EAF2F8] mb-2">
                    12.1. Para Usuarios en México
                  </h4>
                  <p>
                    Esta Política se rige por la Ley Federal de Protección de
                    Datos Personales en Posesión de los Particulares (LFPDPPP) y
                    su Reglamento.
                  </p>
                </div>

                <div>
                  <h4 className="text-[16px] font-semibold text-black-eske dark:text-[#EAF2F8] mb-2">
                    12.2. Para Usuarios en la Unión Europea
                  </h4>
                  <p>
                    Aplicable el Reglamento (UE) 2016/679 (GDPR) y legislación
                    nacional de cada Estado miembro.
                  </p>
                </div>

                <div>
                  <h4 className="text-[16px] font-semibold text-black-eske dark:text-[#EAF2F8] mb-2">
                    12.3. Para Usuarios en California, USA
                  </h4>
                  <p>
                    Aplicable la California Consumer Privacy Act (CCPA) y
                    California Privacy Rights Act (CPRA).
                  </p>
                </div>
              </div>
            </LegalSection>

            {/* CTA Final */}
            <div className="mt-12 p-6 bg-gray-eske-30 dark:bg-[#21425E] rounded-lg text-white-eske text-center">
              <h3 className="text-2xl font-bold text-black-eske dark:text-[#EAF2F8] mb-4">
                ¿Tienes dudas sobre tu privacidad?
              </h3>
              <p className="text-[16px] text-black-eske dark:text-[#C7D6E0] mb-6">
                Estamos aquí para ayudarte. Contáctanos o revisa nuestros otros
                documentos legales.
              </p>
              <div className="flex flex-col sm:flex-row gap-4 justify-center max-w-md mx-auto">
                <Link href="/contacto" className="flex-1">
                  <Button label="Contactar Soporte" variant="primary" />
                </Link>
                <Link href="/condiciones-de-uso" className="flex-1">
                  <Button label="Ver Condiciones de Uso" variant="secondary" />
                </Link>
              </div>
            </div>

            {/* Nota final */}
            <div className="mt-8 text-center text-[12px] text-black-eske-30 dark:text-[#6D8294]">
              <p>
                Esta Política de Privacidad se aplica únicamente a los servicios de Eskemma.
              </p>
              <p>
                Si accedes a enlaces de terceros, te recomendamos revisar sus propias políticas de privacidad.
              </p>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

// app/condiciones-sesiones-diagnostico-gratuitas/page.tsx
"use client";

import { useState } from "react";
import type { Metadata } from "next";
import Link from "next/link";
import LegalHero from "../components/legal/LegalHero";
import LegalSection from "../components/legal/LegalSection";
import TableOfContents, { TocItem } from "../components/legal/TableOfContents";
import Button from "../components/Button";
import ScheduleDate from "../components/componentsHome/ScheduleDate";
import ResponseDate from "../components/componentsHome/ReponseDate";

// Nota: metadata no funciona en Client Components, se movería a layout.tsx si es necesario
// export const metadata: Metadata = {
//   title: "Condiciones de Sesiones de Diagnóstico Gratuitas | Eskemma",
//   description: "Términos y condiciones para las sesiones de diagnóstico gratuitas de Eskemma. Conoce tus derechos y obligaciones.",
//   robots: "index, follow",
// };

export default function CondicionesSessionesDiagnosticoGratuitas() {
  // Estados para los modales
  const [isScheduleModalOpen, setIsScheduleModalOpen] = useState(false);
  const [isResponseModalOpen, setIsResponseModalOpen] = useState(false);
  const [formData, setFormData] = useState({
    fullName: "",
    email: "",
    dateTime: "",
  });

  // Definir el índice de contenidos
  const tocItems: TocItem[] = [
    { id: "objeto", title: "1. Objeto y Alcance del Servicio" },
    { id: "elegibilidad", title: "2. Elegibilidad y Requisitos" },
    { id: "proceso", title: "3. Proceso de Solicitud y Reserva" },
    { id: "duracion", title: "4. Duración y Formato" },
    { id: "grabacion", title: "5. Grabación de Sesiones" },
    {
      id: "consentimiento-grabacion",
      title: "6. Consentimiento para Grabación",
      level: 2,
    },
    {
      id: "proteccion-menores",
      title: "7. Protección de Menores (COPPA)",
      level: 2,
    },
    { id: "naturaleza", title: "8. Naturaleza del Servicio" },
    { id: "limitaciones", title: "9. Limitaciones y Exclusiones" },
    { id: "cancelacion", title: "10. Cancelación y Reprogramación" },
    { id: "conducta", title: "11. Conducta Durante las Sesiones" },
    { id: "confidencialidad", title: "12. Confidencialidad y Privacidad" },
    { id: "responsabilidad", title: "13. Limitación de Responsabilidad" },
    { id: "modificaciones", title: "14. Modificaciones de estas Condiciones" },
    { id: "contacto", title: "15. Contacto" },
  ];

  return (
    <div className="min-h-screen bg-white-eske dark:bg-[#0B1620]">
      {/* Hero Section */}
      <LegalHero
        title="Condiciones de Uso para Sesiones de Diagnóstico Gratuitas"
        subtitle="Términos específicos que rigen nuestro servicio de sesiones de diagnóstico gratuitas de 30 minutos"
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
                Bienvenido al servicio de sesiones de diagnóstico gratuitas de{" "}
                <strong>Eskemma</strong>. Estas Condiciones complementan
                nuestras{" "}
                <Link
                  href="/condiciones-de-uso"
                  className="text-bluegreen-eske hover:text-bluegreen-eske-70 underline dark:text-blue-eske-40 hover:dark:text-blue-eske-10 focus-ring-primary rounded"
                >
                  Condiciones de Uso Generales
                </Link>{" "}
                y regulan específicamente el acceso y uso de nuestras sesiones
                de sesión de diagnóstico gratuita.
              </p>
              <div className="bg-bluegreen-eske-10 dark:bg-[#112230] p-4 rounded-lg">
                <p className="font-semibold mb-2">Importante:</p>
                <p>
                  Al solicitar o participar en una sesión de diagnóstico gratuita, aceptas
                  cumplir con estas Condiciones, así como con nuestra{" "}
                  <Link
                    href="/politica-de-privacidad"
                    className="text-bluegreen-eske hover:text-bluegreen-eske-70 underline dark:text-blue-eske-40 hover:dark:text-blue-eske-10 focus-ring-primary rounded"
                  >
                    Política de Privacidad
                  </Link>
                  .
                </p>
              </div>
            </div>

            {/* 1. Objeto y Alcance */}
            <LegalSection id="objeto" title="1. Objeto y Alcance del Servicio">
              <p className="mb-4">
                Eskemma ofrece un servicio de{" "}
                <strong>sesiones de diagnóstico gratuitas de 30 minutos</strong> para:
              </p>
              <ul className="list-disc list-inside space-y-2 ml-4 mb-4">
                <li>
                  <strong>Orientación inicial:</strong> Resolver dudas generales
                  sobre nuestras herramientas (Sefix, Moddulo, Centinela)
                </li>
                <li>
                  <strong>Consulta exploratoria:</strong> Evaluar si nuestros
                  servicios se ajustan a las necesidades de tu proyecto político
                </li>
                <li>
                  <strong>Demostración básica:</strong> Conocer las
                  funcionalidades principales de la plataforma
                </li>
              </ul>

              <div className="bg-yellow-eske-10 dark:bg-yellow-900/20 p-4 rounded-lg mt-4">
                <p className="font-semibold mb-2">Nota importante:</p>
                <p className="mb-2">Este servicio NO sustituye:</p>
                <ul className="list-disc list-inside space-y-1 ml-4">
                  <li>
                    Asesorías profesionales de estrategia política pagadas
                  </li>
                  <li>
                    Soporte técnico especializado de nuestros planes Premium
                  </li>
                  <li>Consultoría electoral integral</li>
                  <li>Análisis de datos detallados o personalizados</li>
                </ul>
              </div>
            </LegalSection>

            {/* 2. Elegibilidad */}
            <LegalSection
              id="elegibilidad"
              title="2. Elegibilidad y Requisitos"
            >
              <div className="mt-6 mb-6">
                <h4 className="text-[16px] font-semibold text-black-eske dark:text-[#EAF2F8] mb-2">
                  2.1. Quién Puede Solicitar una Asesoría
                </h4>
                <p className="mb-2">Pueden solicitar sesiones de diagnóstico gratuitas:</p>
                <ul className="list-disc list-inside space-y-1 ml-4 mb-4">
                  <li>Personas mayores de 18 años</li>
                  <li>
                    Candidatos políticos, equipos de campaña o partidos
                    políticos
                  </li>
                  <li>
                    Organizaciones sin fines de lucro relacionadas con
                    participación ciudadana
                  </li>
                  <li>
                    Estudiantes o investigadores de ciencias políticas (previa
                    verificación)
                  </li>
                </ul>

                <div className="bg-red-eske-10 dark:bg-red-900/20 p-4 rounded-lg mt-4">
                  <p className="font-semibold mb-2 text-black-eske dark:text-[#EAF2F8]">
                    Restricción de edad - Menores de 18 años:
                  </p>
                  <p className="text-black-eske dark:text-[#C7D6E0]">
                    Si eres menor de 18 años, necesitas el{" "}
                    <strong>
                      consentimiento de un padre, madre o tutor legal
                    </strong>{" "}
                    para participar. Consulta la sección{" "}
                    <a
                      href="#proteccion-menores"
                      className="text-bluegreen-eske underline dark:text-blue-eske-40 hover:dark:text-blue-eske-10 focus-ring-primary rounded"
                    >
                      Protección de Menores (COPPA)
                    </a>
                    .
                  </p>
                </div>
              </div>

              <div className="mt-6 mb-6">
                <h4 className="text-[16px] font-semibold text-black-eske dark:text-[#EAF2F8] mb-2">
                  2.2. Límites por Usuario
                </h4>
                <p className="mb-2">
                  Cada persona u organización tiene derecho a:
                </p>
                <ul className="list-disc list-inside space-y-1 ml-4">
                  <li>
                    <strong>Una (1) sesión gratuita por año calendario</strong>
                  </li>
                  <li>La sesión NO es transferible a terceros</li>
                  <li>
                    Se identificará a los usuarios mediante correo electrónico,
                    número de teléfono o datos fiscales
                  </li>
                </ul>

                <p className="mt-4 font-semibold text-bluegreen-eske dark:text-blue-eske-40">
                  Excepción:
                </p>
                <p className="mb-2">
                  Si contratas un plan de suscripción de Eskemma, podrás
                  solicitar sesiones de diagnóstico adicionales según tu plan (consulta
                  términos de cada plan).
                </p>
              </div>

              <div className="mt-6 mb-6">
                <h4 className="text-[16px] font-semibold text-black-eske dark:text-[#EAF2F8] mb-2">
                  2.3. Información Requerida
                </h4>
                <p className="mb-2">
                  Para reservar tu sesión, deberás proporcionar:
                </p>
                <ul className="list-disc list-inside space-y-1 ml-4">
                  <li>
                    <strong>Nombre completo</strong>
                  </li>
                  <li>
                    <strong>Correo electrónico válido</strong>
                  </li>
                  <li>
                    <strong>Número de teléfono de contacto</strong> (formato:
                    +[código país] seguido de 7-15 dígitos)
                  </li>
                  <li>
                    <strong>Tema de interés:</strong> Descripción de tu proyecto
                    o consulta (campo de texto libre)
                  </li>
                  <li>
                    <strong>Fecha y hora preferida</strong> para la sesión
                  </li>
                  <li>
                    <strong>Documento adjunto</strong> (opcional): Puedes enviar
                    archivos relevantes para la sesión de diagnóstico
                  </li>
                </ul>
              </div>
            </LegalSection>

            {/* 3. Proceso de Solicitud */}
            <LegalSection
              id="proceso"
              title="3. Proceso de Solicitud y Reserva"
            >
              <div className="space-y-6">
                <div>
                  <h4 className="text-[16px] font-semibold text-black-eske dark:text-[#EAF2F8] mb-2">
                    Paso 1: Solicitud mediante Formulario
                  </h4>
                  <p className="mb-2">
                    Completa el formulario de solicitud haciendo clic en el
                    botón
                    <strong> "Solicitar sesión de diagnóstico"</strong> disponible en:
                  </p>
                  <ul className="list-disc list-inside space-y-1 ml-4 mb-4">
                    <li>
                      Página de inicio de Eskemma (botón "AGENDAR ASESORÍA
                      GRATUITA")
                    </li>
                    <li>
                      Esta página de Condiciones (botón al final del documento)
                    </li>
                  </ul>
                  <p className="text-[14px] text-black-eske-20 dark:text-[#C7D6E0]">
                    El formulario te solicitará: nombre completo, email,
                    teléfono, tema de interés, fecha/hora deseada y
                    opcionalmente un documento adjunto.
                  </p>
                </div>

                <div>
                  <h4 className="text-[16px] font-semibold text-black-eske dark:text-[#EAF2F8] mb-2">
                    Paso 2: Confirmación Inmediata
                  </h4>
                  <p className="mb-2">
                    Al enviar el formulario, recibirás{" "}
                    <strong>inmediatamente</strong>:
                  </p>
                  <ul className="list-disc list-inside space-y-1 ml-4 mb-4">
                    <li>
                      Un <strong>modal de confirmación</strong> en pantalla con
                      los detalles de tu cita
                    </li>
                    <li>
                      Un <strong>correo electrónico de confirmación</strong> a
                      la dirección proporcionada
                    </li>
                    <li>
                      Información del <strong>asesor asignado</strong> a tu
                      sesión
                    </li>
                    <li>Instrucciones detalladas para la videollamada</li>
                  </ul>

                  <div className="bg-bluegreen-eske-10 dark:bg-[#112230] p-4 rounded-lg">
                    <p className="font-semibold mb-2">Asesor asignado:</p>
                    <p className="mb-1">
                      <strong>Nombre:</strong> Enrique Rouaix B.
                    </p>
                    <p className="mb-1">
                      <strong>Email:</strong>{" "}
                      <a
                        href="mailto:enrique.rouaix@eskemma.com"
                        className="text-bluegreen-eske underline hover:text-bluegreen-eske-70 dark:text-blue-eske-40 hover:dark:text-blue-eske-10 focus-ring-primary rounded"
                      >
                        enrique.rouaix@eskemma.com
                      </a>
                    </p>
                    <p className="text-[14px] mt-2">
                      Para cualquier información sobre tu sesión, puedes
                      contactar directamente a tu asesor.
                    </p>
                  </div>
                </div>

                <div>
                  <h4 className="text-[16px] font-semibold text-black-eske dark:text-[#EAF2F8] mb-2">
                    Paso 3: Preparación para la Sesión
                  </h4>
                  <p className="mb-2">Antes de tu sesión de diagnóstico:</p>
                  <ul className="list-disc list-inside space-y-1 ml-4">
                    <li>
                      <strong>Revisa tu correo de confirmación:</strong>{" "}
                      Contiene indicaciones importantes para concluir la agenda
                    </li>
                    <li>
                      <strong>Envía documentación adicional</strong> (si lo
                      deseas): Utiliza el link proporcionado en el correo de
                      confirmación
                    </li>
                    <li>
                      <strong>Conéctate 5 minutos antes:</strong> Esto te
                      permitirá verificar tu conexión y equipos
                    </li>
                  </ul>
                </div>

                <div className="bg-blue-eske-10 p-4 rounded-lg">
                  <h4 className="text-[16px] font-semibold text-black-eske dark:text-black-eske mb-2">
                    Disponibilidad y Tiempos
                  </h4>
                  <p className="mb-2 dark:text-black-eske">
                    <strong>Confirmación:</strong> Inmediata al enviar el
                    formulario
                  </p>
                  <p className="mb-2 dark:text-black-eske">
                    <strong>Fecha de la sesión:</strong> Según tu selección en
                    el formulario (sujeto a disponibilidad del asesor)
                  </p>
                  <p className="text-[14px] text-black-eske-20 dark:text-black-eske">
                    Si la fecha solicitada no está disponible, nos comunicaremos
                    contigo para reprogramar en el horario más cercano posible.
                  </p>
                </div>
              </div>
            </LegalSection>

            {/* 4. Duración y Formato */}
            <LegalSection
              id="duracion"
              title="4. Duración y Formato de las Sesiones"
            >
              <div className="space-y-6">
                <div>
                  <h4 className="text-[16px] font-semibold text-black-eske dark:text-[#EAF2F8] mb-2">
                    4.1. Duración
                  </h4>
                  <ul className="list-disc list-inside space-y-1 ml-4">
                    <li>
                      <strong>Duración estándar:</strong> 30 minutos
                    </li>
                    <li>
                      <strong>Tolerancia máxima:</strong> 5 minutos adicionales
                      (a discreción del asesor)
                    </li>
                    <li>
                      No se garantiza extensión de tiempo más allá de 35 minutos
                    </li>
                  </ul>
                </div>

                <div>
                  <h4 className="text-[16px] font-semibold text-black-eske dark:text-[#EAF2F8] mb-2">
                    4.2. Modalidad
                  </h4>
                  <p className="mb-2">Todas las sesiones son:</p>
                  <ul className="list-disc list-inside space-y-1 ml-4 mb-4">
                    <li>
                      <strong>100% virtuales</strong> (videollamada)
                    </li>
                    <li>
                      <strong>Plataformas utilizadas:</strong> Zoom, Google
                      Meet, Microsoft Teams o la que mejor se adapte a tu
                      disponibilidad tecnológica
                    </li>
                    <li>
                      Se requiere <strong>cámara encendida</strong> (salvo
                      impedimento técnico justificado)
                    </li>
                  </ul>

                  <p className="font-semibold mb-2">
                    Requisitos técnicos mínimos:
                  </p>
                  <ul className="list-disc list-inside space-y-1 ml-4">
                    <li>
                      Conexión a internet estable (mínimo 2 Mbps de
                      subida/bajada)
                    </li>
                    <li>
                      Computadora, tablet o smartphone con cámara y micrófono
                    </li>
                    <li>
                      Navegador actualizado o app de videollamadas instalada
                    </li>
                  </ul>
                </div>

                <div className="bg-yellow-eske-10 dark:bg-yellow-900/20 p-4 rounded-lg">
                  <h4 className="text-[16px] font-semibold text-black-eske dark:text-[#EAF2F8] mb-2">
                    Puntualidad
                  </h4>
                  <p className="mb-2">
                    <strong>Si llegas más de 10 minutos tarde,</strong> Eskemma
                    se reserva el derecho de:
                  </p>
                  <ul className="list-disc list-inside space-y-1 ml-4">
                    <li>Reducir la duración de la sesión al tiempo restante</li>
                    <li>Cancelar la sesión sin derecho a reprogramación</li>
                  </ul>
                  <p className="mt-2 font-semibold text-bluegreen-eske dark:text-blue-eske-40">
                    Recomendación: Conéctate 5 minutos antes para verificar tu
                    conexión.
                  </p>
                </div>
              </div>
            </LegalSection>

            {/* 5. Grabación */}
            <LegalSection id="grabacion" title="5. Grabación de Sesiones">
              <p className="mb-4">
                Para garantizar la calidad del servicio, fines de capacitación
                interna y cumplimiento legal,
                <strong> Eskemma puede grabar las sesiones de diagnóstico</strong>.
              </p>

              <div className="space-y-6">
                <div>
                  <h4 className="text-[16px] font-semibold text-black-eske dark:text-[#EAF2F8] mb-2">
                    5.1. Propósito de la Grabación
                  </h4>
                  <p className="mb-2">
                    Las grabaciones se utilizan exclusivamente para:
                  </p>
                  <ul className="list-disc list-inside space-y-1 ml-4">
                    <li>
                      <strong>Control de calidad:</strong> Evaluar el desempeño
                      de nuestros asesores
                    </li>
                    <li>
                      <strong>Capacitación:</strong> Entrenar a nuevos miembros
                      del equipo
                    </li>
                    <li>
                      <strong>Resolución de disputas:</strong> En caso de
                      reclamaciones o malentendidos
                    </li>
                    <li>
                      <strong>Cumplimiento normativo:</strong> GDPR, CCPA y
                      otras regulaciones de protección de datos
                    </li>
                  </ul>
                </div>

                <div>
                  <h4 className="text-[16px] font-semibold text-black-eske dark:text-[#EAF2F8] mb-2">
                    5.2. Almacenamiento y Retención
                  </h4>
                  <ul className="list-disc list-inside space-y-1 ml-4">
                    <li>
                      <strong>Duración de almacenamiento:</strong> Hasta 2 años
                      desde la fecha de la sesión
                    </li>
                    <li>
                      <strong>Ubicación:</strong> Servidores seguros en la nube
                      (cifrado AES-256)
                    </li>
                    <li>
                      <strong>Acceso restringido:</strong> Solo personal
                      autorizado de Eskemma
                    </li>
                    <li>
                      Las grabaciones NO se compartirán con terceros sin tu
                      consentimiento expreso
                    </li>
                  </ul>
                </div>

                <div>
                  <h4 className="text-[16px] font-semibold text-black-eske dark:text-[#EAF2F8] mb-2">
                    5.3. Derechos del Usuario sobre la Grabación
                  </h4>
                  <p className="mb-2">Tienes derecho a:</p>
                  <ul className="list-disc list-inside space-y-1 ml-4">
                    <li>
                      <strong>Solicitar una copia:</strong> Envía un correo a{" "}
                      <a
                        href="mailto:privacidad@eskemma.com"
                        className="text-bluegreen-eske underline hover:text-bluegreen-eske-70 dark:text-blue-eske-40 hover:dark:text-blue-eske-10 focus-ring-primary rounded"
                      >
                        privacidad@eskemma.com
                      </a>{" "}
                      (respuesta en 30 días)
                    </li>
                    <li>
                      <strong>Solicitar la eliminación:</strong> Después de 30
                      días de la sesión, puedes pedir que borremos la grabación
                      (salvo que exista una obligación legal de conservarla)
                    </li>
                    <li>
                      <strong>Oponerte a la grabación:</strong> Si no deseas ser
                      grabado, puedes rechazar la sesión de diagnóstico antes de que inicie
                      (ver sección siguiente)
                    </li>
                  </ul>
                </div>
              </div>
            </LegalSection>

            {/* 6. Consentimiento para Grabación */}
            <LegalSection
              id="consentimiento-grabacion"
              title="6. Consentimiento Informado para Grabación"
              level={2}
            >
              <div className="bg-bluegreen-eske-10 dark:bg-[#112230] p-6 rounded-lg mb-6">
                <h4 className="text-[18px] font-bold text-bluegreen-eske dark:text-blue-eske-40 mb-3">
                  Consentimiento Explícito Requerido
                </h4>
                <p className="mb-4">
                  <strong>Al inicio de cada sesión,</strong> nuestro asesor te
                  informará verbalmente que la sesión será grabada y te
                  solicitará tu <strong>consentimiento explícito</strong>.
                </p>
                <p className="font-semibold mb-2">Tienes dos opciones:</p>
                <ul className="list-disc list-inside space-y-2 ml-4">
                  <li>
                    <strong>Aceptar la grabación:</strong> La sesión continuará
                    normalmente y se grabará
                  </li>
                  <li>
                    <strong>Rechazar la grabación:</strong> La sesión terminará
                    inmediatamente sin penalización. Podrás reprogramar si lo
                    deseas, pero deberás aceptar la grabación en la nueva
                    sesión.
                  </li>
                </ul>
              </div>

              <div className="space-y-6">
                <div>
                  <h4 className="text-[16px] font-semibold text-black-eske dark:text-[#EAF2F8] mb-2">
                    6.1. Cumplimiento con GDPR (Usuarios en la Unión Europea)
                  </h4>
                  <p className="mb-2">
                    De acuerdo con el Reglamento General de Protección de Datos
                    (GDPR):
                  </p>
                  <ul className="list-disc list-inside space-y-1 ml-4">
                    <li>
                      <strong>Base legal:</strong> Consentimiento explícito
                      (Art. 6.1.a GDPR) y/o interés legítimo (Art. 6.1.f GDPR)
                      para control de calidad
                    </li>
                    <li>
                      <strong>Derecho a retirar el consentimiento:</strong>{" "}
                      Puedes solicitar la eliminación de la grabación en
                      cualquier momento
                    </li>
                    <li>
                      <strong>Transferencias internacionales:</strong> Si
                      almacenamos datos en servidores fuera de la UE, utilizamos
                      cláusulas contractuales tipo aprobadas por la Comisión
                      Europea
                    </li>
                  </ul>
                </div>

                <div>
                  <h4 className="text-[16px] font-semibold text-black-eske dark:text-[#EAF2F8] mb-2">
                    6.2. Cumplimiento con CCPA (Usuarios en California, USA)
                  </h4>
                  <p className="mb-2">
                    De acuerdo con la California Consumer Privacy Act (CCPA):
                  </p>
                  <ul className="list-disc list-inside space-y-1 ml-4">
                    <li>
                      <strong>Derecho a saber:</strong> Tienes derecho a saber
                      qué información personal recopilamos (incluidas
                      grabaciones)
                    </li>
                    <li>
                      <strong>Derecho a eliminar:</strong> Puedes solicitar la
                      eliminación de tu grabación (salvo excepciones legales)
                    </li>
                    <li>
                      <strong>No venta de datos:</strong> Eskemma NO vende
                      grabaciones ni datos personales a terceros
                    </li>
                  </ul>
                  <p className="mt-2">
                    <strong>Para ejercer tus derechos bajo CCPA:</strong> Envía
                    un correo a{" "}
                    <a
                      href="mailto:privacidad@eskemma.com"
                      className="text-bluegreen-eske underline hover:text-bluegreen-eske-70 dark:text-blue-eske-40 hover:dark:text-blue-eske-10 focus-ring-primary rounded"
                    >
                      privacidad@eskemma.com
                    </a>{" "}
                    con asunto "Solicitud CCPA"
                  </p>
                </div>
              </div>
            </LegalSection>

            {/* 7. Protección de Menores */}
            <LegalSection
              id="proteccion-menores"
              title="7. Protección de Menores de Edad (COPPA Compliance)"
              level={2}
            >
              <div className="bg-red-eske-10 dark:bg-red-900/20 p-6 rounded-lg mb-6">
                <h4 className="text-[18px] font-bold text-black-eske dark:text-[#EAF2F8] mb-3">
                  Restricción de Edad: Menores de 18 Años
                </h4>
                <p className="mb-4 text-black-eske dark:text-[#C7D6E0]">
                  Nuestro servicio de asesorías está diseñado para adultos.{" "}
                  <strong>Si eres menor de 18 años, </strong>
                  necesitas el consentimiento de un padre, madre o tutor legal
                  para participar.
                </p>
              </div>

              <div className="space-y-6">
                <div>
                  <h4 className="text-[16px] font-semibold text-black-eske dark:text-[#EAF2F8] mb-2">
                    7.1. Cumplimiento con COPPA (Children's Online Privacy
                    Protection Act - USA)
                  </h4>
                  <p className="mb-2">
                    Para menores de 13 años en Estados Unidos, aplicamos medidas
                    especiales según COPPA:
                  </p>
                  <ul className="list-disc list-inside space-y-2 ml-4">
                    <li>
                      <strong>Consentimiento parental verificable:</strong>{" "}
                      Requerimos que un padre o tutor:
                      <ul className="list-circle list-inside ml-6 mt-1 space-y-1">
                        <li>Complete un formulario de consentimiento</li>
                        <li>
                          Envíe una identificación oficial (para verificar que
                          es adulto)
                        </li>
                        <li>
                          Proporcione su correo electrónico y número de teléfono
                        </li>
                      </ul>
                    </li>
                    <li>
                      <strong>Presencia parental obligatoria:</strong> Un padre
                      o tutor DEBE estar presente durante toda la sesión
                    </li>
                    <li>
                      <strong>Limitación de recopilación de datos:</strong> Solo
                      recopilaremos el mínimo necesario (nombre, edad, correo
                      del tutor)
                    </li>
                  </ul>
                </div>

                <div>
                  <h4 className="text-[16px] font-semibold text-black-eske dark:text-[#EAF2F8] mb-2">
                    7.2. Para Menores entre 13 y 17 Años
                  </h4>
                  <p className="mb-2">Si tienes entre 13 y 17 años:</p>
                  <ul className="list-disc list-inside space-y-1 ml-4">
                    <li>
                      Necesitas el <strong>consentimiento escrito</strong> de un
                      padre o tutor
                    </li>
                    <li>
                      Recomendamos (pero no es obligatorio) que un adulto esté
                      presente
                    </li>
                    <li>
                      El padre o tutor puede solicitar una copia de la grabación
                      en cualquier momento
                    </li>
                  </ul>
                </div>

                <div>
                  <h4 className="text-[16px] font-semibold text-black-eske dark:text-[#EAF2F8] mb-2">
                    7.3. Derechos de los Padres o Tutores
                  </h4>
                  <p className="mb-2">
                    Si tu hijo menor de edad participa en una sesión de diagnóstico, tienes
                    derecho a:
                  </p>
                  <ul className="list-disc list-inside space-y-1 ml-4">
                    <li>
                      Revisar la información personal recopilada sobre tu hijo
                    </li>
                    <li>Solicitar la eliminación de datos personales</li>
                    <li>Retirar el consentimiento en cualquier momento</li>
                    <li>
                      Solicitar que NO se recopile más información sobre tu hijo
                    </li>
                  </ul>
                  <p className="mt-2 font-semibold">
                    Para ejercer estos derechos: Envía un correo a{" "}
                    <a
                      href="mailto:privacidad@eskemma.com"
                      className="text-bluegreen-eske underline hover:text-bluegreen-eske-70 dark:text-blue-eske-40 hover:dark:text-blue-eske-10 focus-ring-primary rounded"
                    >
                      privacidad@eskemma.com
                    </a>{" "}
                    con asunto "Derechos Parentales - COPPA"
                  </p>
                </div>
              </div>
            </LegalSection>

            {/* 8. Naturaleza del Servicio */}
            <LegalSection
              id="naturaleza"
              title="8. Naturaleza del Servicio y Descargos de Responsabilidad"
            >
              <div className="bg-yellow-eske-10 dark:bg-yellow-900/20 p-6 rounded-lg mb-6">
                <h4 className="text-[18px] font-bold text-black-eske dark:text-[#EAF2F8] mb-3">
                  Servicio Informativo, NO Vinculante
                </h4>
                <p className="mb-4">
                  Las sesiones de diagnóstico gratuitas tienen un carácter{" "}
                  <strong>orientativo y educativo</strong>. La información
                  proporcionada:
                </p>
                <ul className="list-disc list-inside space-y-2 ml-4">
                  <li>
                    Es de naturaleza general y no constituye asesoría
                    profesional vinculante
                  </li>
                  <li>
                    NO sustituye la consultoría política, legal o estratégica
                    especializada
                  </li>
                  <li>
                    Se basa en la información limitada que puedas proporcionar
                    en 30 minutos
                  </li>
                </ul>
              </div>

              <div className="space-y-6">
                <div>
                  <h4 className="text-[16px] font-semibold text-black-eske dark:text-[#EAF2F8] mb-2">
                    8.1. No Somos Consultores Políticos Certificados
                  </h4>
                  <p className="mb-4">
                    Aunque nuestro equipo tiene experiencia en estrategia
                    política y herramientas digitales, las sesiones de diagnóstico gratuitas
                    NO equivalen a:
                  </p>
                  <ul className="list-disc list-inside space-y-1 ml-4">
                    <li>Consultoría electoral profesional certificada</li>
                    <li>Asesoría jurídica sobre leyes electorales</li>
                    <li>Auditoría financiera de campañas</li>
                    <li>Estudios de opinión pública o encuestas formales</li>
                    <li>Diseño de estrategias de comunicación complejas</li>
                  </ul>
                </div>

                <div>
                  <h4 className="text-[16px] font-semibold text-black-eske dark:text-[#EAF2F8] mb-2">
                    8.2. Uso Bajo tu Propio Riesgo
                  </h4>
                  <p className="mb-2">
                    Cualquier decisión que tomes basándote en la información de
                    la sesión de diagnóstico es
                    <strong> bajo tu exclusiva responsabilidad</strong>. Eskemma
                    NO se hace responsable de:
                  </p>
                  <ul className="list-disc list-inside space-y-1 ml-4">
                    <li>Resultados electorales adversos</li>
                    <li>
                      Pérdidas económicas derivadas de estrategias sugeridas
                    </li>
                    <li>Daños a la reputación política</li>
                    <li>Consecuencias legales por mal uso de la información</li>
                  </ul>
                </div>

                <div>
                  <h4 className="text-[16px] font-semibold text-black-eske dark:text-[#EAF2F8] mb-2">
                    8.3. Sin Garantía de Resultados
                  </h4>
                  <p className="mb-4">
                    <strong>No garantizamos</strong> que las recomendaciones,
                    sugerencias o información proporcionada:
                  </p>
                  <ul className="list-disc list-inside space-y-1 ml-4">
                    <li>
                      Produzcan resultados específicos (victorias electorales,
                      mejora de imagen, etc.)
                    </li>
                    <li>Sean aplicables a todas las situaciones políticas</li>
                    <li>
                      Estén actualizadas al momento de su uso (las leyes
                      electorales cambian frecuentemente)
                    </li>
                  </ul>
                </div>
              </div>
            </LegalSection>

            {/* 9. Limitaciones y Exclusiones */}
            <LegalSection
              id="limitaciones"
              title="9. Limitaciones y Exclusiones de Responsabilidad"
            >
              <div className="space-y-6">
                <div>
                  <h4 className="text-[16px] font-semibold text-black-eske dark:text-[#EAF2F8] mb-2">
                    9.1. Temas NO Cubiertos
                  </h4>
                  <p className="mb-2 font-semibold text-red-eske">
                    Eskemma NO proporciona asesoría sobre:
                  </p>
                  <ul className="list-disc list-inside space-y-1 ml-4">
                    <li>
                      Interpretación de leyes electorales (consulta a un abogado
                      especializado)
                    </li>
                    <li>
                      Fiscalización de recursos de campaña (consulta a un
                      contador público)
                    </li>
                    <li>
                      Estrategias que puedan violar normativas electorales
                    </li>
                    <li>
                      Uso de datos personales sin consentimiento (violación de
                      GDPR/CCPA/LFPDPPP)
                    </li>
                    <li>
                      Técnicas de desinformación, fake news o manipulación
                      electoral
                    </li>
                  </ul>
                </div>

                <div className="bg-red-eske-10 dark:bg-red-900/20 p-4 rounded-lg">
                  <h4 className="text-[16px] font-semibold text-black-eske dark:text-[#EAF2F8] mb-2">
                    9.2. Rechazo de Sesiones
                  </h4>
                  <p className="mb-2 text-black-eske dark:text-[#C7D6E0]">
                    Eskemma se reserva el derecho de rechazar, cancelar o
                    terminar una sesión de diagnóstico si:
                  </p>
                  <ul className="list-disc list-inside space-y-1 ml-4 text-black-eske dark:text-[#C7D6E0]">
                    <li>
                      El solicitante tiene antecedentes de conductas abusivas o
                      fraudulentas
                    </li>
                    <li>
                      La consulta involucra actividades ilegales o antiéticas
                    </li>
                    <li>Se detecta información falsa en la solicitud</li>
                    <li>
                      El usuario viola estas Condiciones durante la sesión
                    </li>
                  </ul>
                </div>
              </div>
            </LegalSection>

            {/* 10. Cancelación y Reprogramación */}
            <LegalSection
              id="cancelacion"
              title="10. Cancelación y Reprogramación de Sesiones"
            >
              <div className="space-y-6">
                <div>
                  <h4 className="text-[16px] font-semibold text-black-eske dark:text-[#EAF2F8] mb-2">
                    10.1. Cancelación por el Usuario
                  </h4>
                  <p className="mb-2">Si necesitas cancelar tu sesión:</p>
                  <ul className="list-disc list-inside space-y-2 ml-4">
                    <li>
                      <strong>Con más de 24 horas de anticipación:</strong>{" "}
                      Puedes reprogramar sin penalización. Utiliza el link
                      "Cancelar sesión de diagnóstico" proporcionado en tu correo de
                      confirmación, o envía un correo a{" "}
                      <a
                        href="mailto:asesorias@eskemma.com"
                        className="text-bluegreen-eske underline hover:text-bluegreen-eske-70 dark:text-blue-eske-40 hover:dark:text-blue-eske-10 focus-ring-primary rounded"
                      >
                        asesorias@eskemma.com
                      </a>
                    </li>
                    <li>
                      <strong>Con menos de 24 horas:</strong> La sesión se
                      considera utilizada y NO podrás reprogramar (pierdes tu
                      cupo anual)
                    </li>
                    <li>
                      <strong>Inasistencia (No-Show):</strong> Si no te
                      presentas sin avisar, pierdes tu derecho a una sesión
                      gratuita ese año
                    </li>
                  </ul>
                </div>

                <div>
                  <h4 className="text-[16px] font-semibold text-black-eske dark:text-[#EAF2F8] mb-2">
                    10.2. Cancelación por Eskemma
                  </h4>
                  <p className="mb-2">
                    Eskemma puede cancelar una sesión por causas de fuerza mayor
                    (enfermedad del asesor, problemas técnicos, emergencias). En
                    estos casos:
                  </p>
                  <ul className="list-disc list-inside space-y-1 ml-4">
                    <li>
                      Te notificaremos con al menos 6 horas de anticipación
                      (cuando sea posible)
                    </li>
                    <li>Tendrás prioridad para reprogramar</li>
                    <li>Tu cupo anual NO se afectará</li>
                  </ul>
                </div>

                <div className="bg-blue-eske-10 p-4 rounded-lg">
                  <h4 className="text-[16px] font-semibold text-black-eske dark:text-black-eske mb-2">
                    10.3. Emergencias o Circunstancias Especiales
                  </h4>
                  <p className="mb-2 dark:text-black-eske">
                    Si tienes una emergencia genuina (enfermedad grave,
                    accidente, fallecimiento familiar):
                  </p>
                  <ul className="list-disc list-inside space-y-1 ml-4 dark:text-black-eske">
                    <li>
                      Contacta a{" "}
                      <a
                        href="mailto:asesorias@eskemma.com"
                        className="text-bluegreen-eske underline hover:text-bluegreen-eske-70 focus-ring-primary rounded"
                      >
                        asesorias@eskemma.com
                      </a>{" "}
                      explicando tu situación
                    </li>
                    <li>Evaluaremos tu caso individualmente</li>
                    <li>Podemos hacer excepciones a la política de 24 horas</li>
                  </ul>
                </div>
              </div>
            </LegalSection>

            {/* 11. Conducta Durante las Sesiones */}
            <LegalSection
              id="conducta"
              title="11. Conducta Esperada Durante las Sesiones"
            >
              <div className="space-y-6">
                <div>
                  <h4 className="text-[16px] font-semibold text-black-eske dark:text-[#EAF2F8] mb-2">
                    11.1. Código de Conducta
                  </h4>
                  <p className="mb-2 font-semibold text-green-eske dark:text-green-eske-30">
                    Durante la sesión, se espera que:
                  </p>
                  <ul className="list-disc list-inside space-y-1 ml-4 mb-4">
                    <li>Seas respetuoso y profesional con nuestro equipo</li>
                    <li>Te presentes puntualmente</li>
                    <li>
                      Tengas tu cámara encendida (salvo impedimento técnico)
                    </li>
                    <li>
                      Evites distracciones (silencia notificaciones, busca un
                      lugar tranquilo)
                    </li>
                    <li>
                      Formules preguntas claras y específicas para aprovechar el
                      tiempo
                    </li>
                  </ul>

                  <p className="mb-2 font-semibold text-red-eske">
                    Queda estrictamente prohibido:
                  </p>
                  <ul className="list-disc list-inside space-y-1 ml-4">
                    <li>Lenguaje ofensivo, discriminatorio o abusivo</li>
                    <li>Acoso sexual o cualquier tipo de hostigamiento</li>
                    <li>Grabación no autorizada de la sesión por tu parte</li>
                    <li>Compartir el enlace de la sesión con terceros</li>
                    <li>
                      Intentar obtener información confidencial de Eskemma
                    </li>
                  </ul>
                </div>

                <div className="bg-red-eske-10 dark:bg-red-900/20 p-4 rounded-lg">
                  <h4 className="text-[16px] font-semibold text-black-eske dark:text-[#EAF2F8] mb-2">
                    11.2. Consecuencias por Mala Conducta
                  </h4>
                  <p className="mb-2 text-black-eske dark:text-[#C7D6E0]">
                    Si violas el código de conducta, Eskemma puede:
                  </p>
                  <ul className="list-disc list-inside space-y-1 ml-4 text-black-eske dark:text-[#C7D6E0]">
                    <li>
                      Terminar la sesión inmediatamente sin derecho a
                      reprogramación
                    </li>
                    <li>
                      Bloquear tu acceso a futuras asesorías (gratuitas o de
                      pago)
                    </li>
                    <li>
                      Reportar conductas ilegales a las autoridades competentes
                    </li>
                    <li>Emprender acciones legales por daños o perjuicios</li>
                  </ul>
                </div>
              </div>
            </LegalSection>

            {/* 12. Confidencialidad */}
            <LegalSection
              id="confidencialidad"
              title="12. Confidencialidad y Privacidad"
            >
              <div className="space-y-6">
                <div>
                  <h4 className="text-[16px] font-semibold text-black-eske dark:text-[#EAF2F8] mb-2">
                    12.1. Confidencialidad de tu Información
                  </h4>
                  <p className="mb-4">
                    Eskemma se compromete a mantener la{" "}
                    <strong>confidencialidad</strong> de la información que
                    compartas durante la sesión, excepto cuando:
                  </p>
                  <ul className="list-disc list-inside space-y-1 ml-4">
                    <li>
                      Exista una obligación legal de divulgarla (orden judicial,
                      investigación criminal)
                    </li>
                    <li>
                      Detectemos actividades ilegales que debamos reportar a
                      autoridades
                    </li>
                    <li>
                      Nos autorices explícitamente a compartirla (por escrito)
                    </li>
                  </ul>
                </div>

                <div>
                  <h4 className="text-[16px] font-semibold text-black-eske dark:text-[#EAF2F8] mb-2">
                    12.2. Política de Privacidad Aplicable
                  </h4>
                  <p className="mb-2">
                    El tratamiento de tus datos personales se rige por nuestra{" "}
                    <Link
                      href="/politica-de-privacidad"
                      className="text-bluegreen-eske hover:text-bluegreen-eske-70 underline dark:text-blue-eske-40 hover:dark:text-blue-eske-10 focus-ring-primary rounded"
                    >
                      Política de Privacidad
                    </Link>
                    , que incluye:
                  </p>
                  <ul className="list-disc list-inside space-y-1 ml-4">
                    <li>
                      Qué datos recopilamos (nombre, correo, grabación de video)
                    </li>
                    <li>Cómo los utilizamos y protegemos</li>
                    <li>Tus derechos bajo GDPR, CCPA y LFPDPPP (México)</li>
                    <li>
                      Cómo ejercer tus derechos (acceso, rectificación,
                      eliminación, oposición)
                    </li>
                  </ul>
                </div>

                <div className="bg-bluegreen-eske-10 dark:bg-[#112230] p-4 rounded-lg">
                  <h4 className="text-[16px] font-semibold text-bluegreen-eske dark:text-blue-eske-40 mb-2">
                    12.3. Uso de Testimonios
                  </h4>
                  <p className="mb-2">
                    Si después de la sesión deseamos usar tu caso como{" "}
                    <strong>testimonio o caso de estudio</strong> (sin revelar
                    tu identidad):
                  </p>
                  <ul className="list-disc list-inside space-y-1 ml-4">
                    <li>Te solicitaremos consentimiento por escrito</li>
                    <li>Puedes aceptar o rechazar sin consecuencias</li>
                    <li>
                      Siempre anonimizaremos la información (salvo que aceptes
                      que usemos tu nombre)
                    </li>
                  </ul>
                </div>
              </div>
            </LegalSection>

            {/* 13. Limitación de Responsabilidad */}
            <LegalSection
              id="responsabilidad"
              title="13. Limitación de Responsabilidad"
            >
              <div className="bg-yellow-eske-10 dark:bg-yellow-900/20 p-6 rounded-lg mb-6">
                <p className="font-semibold mb-2">
                  Servicio "TAL CUAL" (As-Is):
                </p>
                <p className="mb-4">
                  Las sesiones de diagnóstico gratuitas se proporcionan{" "}
                  <strong>"tal cual"</strong> y
                  <strong> "según disponibilidad"</strong>, sin garantías de
                  ningún tipo, expresas o implícitas.
                </p>
              </div>

              <div className="space-y-6">
                <div>
                  <h4 className="text-[16px] font-semibold text-black-eske dark:text-[#EAF2F8] mb-2">
                    13.1. Exclusión de Garantías
                  </h4>
                  <p className="mb-2">Eskemma NO garantiza que:</p>
                  <ul className="list-disc list-inside space-y-1 ml-4">
                    <li>La asesoría cumpla con tus expectativas específicas</li>
                    <li>
                      La información proporcionada sea completa o actualizada en
                      todo momento
                    </li>
                    <li>
                      Los consejos sean aplicables a tu situación particular
                    </li>
                    <li>
                      La sesión esté libre de errores técnicos (cortes de
                      internet, fallos de plataforma)
                    </li>
                  </ul>
                </div>

                <div>
                  <h4 className="text-[16px] font-semibold text-black-eske dark:text-[#EAF2F8] mb-2">
                    13.2. Daños NO Cubiertos
                  </h4>
                  <p className="mb-2 font-semibold">
                    Eskemma NO será responsable por:
                  </p>
                  <ul className="list-disc list-inside space-y-1 ml-4">
                    <li>
                      Daños directos, indirectos, incidentales o consecuenciales
                    </li>
                    <li>Lucro cesante, pérdida de oportunidades electorales</li>
                    <li>Daños a la reputación política</li>
                    <li>Pérdida de datos debido a fallas técnicas externas</li>
                    <li>
                      Decisiones tomadas basándote en la información de la
                      asesoría
                    </li>
                  </ul>
                </div>

                <div>
                  <h4 className="text-[16px] font-semibold text-black-eske dark:text-[#EAF2F8] mb-2">
                    13.3. Límite Monetario de Responsabilidad
                  </h4>
                  <p className="mb-4">
                    Dado que el servicio es <strong>gratuito</strong>, en ningún
                    caso la responsabilidad total de Eskemma excederá{" "}
                    <strong>$0 USD/MXN/EUR</strong>.
                  </p>
                  <p className="font-semibold text-bluegreen-eske dark:text-blue-eske-40">
                    Excepción para usuarios en la UE:
                  </p>
                  <p className="mb-2">
                    Nada en estas condiciones limita tu derecho a reclamaciones
                    por:
                  </p>
                  <ul className="list-disc list-inside space-y-1 ml-4">
                    <li>
                      Muerte o daños personales causados por nuestra negligencia
                      grave
                    </li>
                    <li>Fraude o declaraciones fraudulentas</li>
                  </ul>
                </div>
              </div>
            </LegalSection>

            {/* 14. Modificaciones */}
            <LegalSection
              id="modificaciones"
              title="14. Modificaciones de estas Condiciones"
            >
              <p className="mb-4">
                Eskemma se reserva el derecho de modificar estas Condiciones en
                cualquier momento. Los cambios serán efectivos:
              </p>
              <ul className="list-disc list-inside space-y-2 ml-4 mb-4">
                <li>
                  <strong>Para asesorías futuras:</strong> Desde la fecha de
                  publicación de las nuevas Condiciones
                </li>
                <li>
                  <strong>Notificación:</strong> Te avisaremos por correo
                  electrónico al menos 15 días antes de que entren en vigor
                </li>
              </ul>

              <div className="bg-blue-eske-10 p-4 rounded-lg">
                <p className="font-semibold mb-2 dark:text-black-eske">
                  Tu derecho a rechazar cambios:
                </p>
                <p className="mb-2 dark:text-black-eske">
                  Si no estás de acuerdo con las nuevas Condiciones, puedes:
                </p>
                <ul className="list-disc list-inside space-y-1 ml-4 dark:text-black-eske">
                  <li>Cancelar tu sesión agendada sin penalización</li>
                  <li>No solicitar futuras asesorías</li>
                </ul>
                <p className="mt-2 font-semibold dark:text-black-eske">
                  Si participas en una sesión después de la fecha de entrada en
                  vigor, se considerará que aceptas las nuevas Condiciones.
                </p>
              </div>
            </LegalSection>

            {/* 15. Contacto */}
            <LegalSection id="contacto" title="15. Contacto y Soporte">
              <p className="mb-4">
                Si tienes dudas sobre estas Condiciones o necesitas ayuda con tu
                asesoría:
              </p>

              <div className="space-y-3">
                <div className="bg-white-eske border-2 border-bluegreen-eske-20 rounded-lg p-4">
                  <p className="font-semibold text-bluegreen-eske mb-2">
                    Sesiones de Diagnóstico y Reservas:
                  </p>
                  <p className="mb-1 dark:text-black-eske">
                    <strong>Correo:</strong>{" "}
                    <a
                      href="mailto:asesorias@eskemma.com"
                      className="text-bluegreen-eske hover:text-bluegreen-eske-70 underline focus-ring-primary rounded"
                    >
                      asesorias@eskemma.com
                    </a>
                  </p>
                  <p className="dark:text-black-eske">
                    <strong>Horario:</strong> Lunes a Viernes, 9:00 AM - 6:00 PM
                    (Hora del Centro de México)
                  </p>
                </div>

                <div className="bg-white-eske border-2 border-bluegreen-eske-20 rounded-lg p-4">
                  <p className="font-semibold text-bluegreen-eske mb-2">
                    Privacidad y Protección de Datos:
                  </p>
                  <p className="mb-1 dark:text-black-eske">
                    <strong>Correo:</strong>{" "}
                    <a
                      href="mailto:privacidad@eskemma.com"
                      className="text-bluegreen-eske hover:text-bluegreen-eske-70 underline focus-ring-primary rounded"
                    >
                      privacidad@eskemma.com
                    </a>
                  </p>
                  <p className="text-[14px] text-black-eske-20 dark:text-black-eske">
                    (Para ejercer derechos GDPR, CCPA, COPPA o LFPDPPP)
                  </p>
                </div>

                <div className="bg-white-eske border-2 border-bluegreen-eske-20 rounded-lg p-4">
                  <p className="font-semibold text-bluegreen-eske mb-2">
                    Asuntos Legales:
                  </p>
                  <p className="mb-1 dark:text-black-eske">
                    <strong>Correo:</strong>{" "}
                    <a
                      href="mailto:legal@eskemma.com"
                      className="text-bluegreen-eske hover:text-bluegreen-eske-70 underline focus-ring-primary rounded"
                    >
                      legal@eskemma.com
                    </a>
                  </p>
                </div>

                <div className="bg-white-eske border-2 border-bluegreen-eske-20 rounded-lg p-4">
                  <p className="font-semibold text-bluegreen-eske mb-2">
                    Soporte Técnico General:
                  </p>
                  <p className="mb-1 dark:text-black-eske">
                    <strong>Correo:</strong>{" "}
                    <a
                      href="mailto:soporte@eskemma.com"
                      className="text-bluegreen-eske hover:text-bluegreen-eske-70 underline focus-ring-primary rounded"
                    >
                      soporte@eskemma.com
                    </a>
                  </p>
                </div>
              </div>

              <div className="mt-6 p-4 bg-gray-eske-10 rounded-lg">
                <p className="text-[14px] text-black-eske dark:text-black-eske">
                  <strong>Tiempo de respuesta:</strong> Nos comprometemos a
                  responder todas las consultas en un plazo máximo de 3 días
                  hábiles.
                </p>
              </div>
            </LegalSection>

            {/* CTA Final */}
            <div className="mt-12 p-6 bg-gray-eske-30 dark:bg-[#21425E] rounded-lg text-white-eske text-center">
              <h3 className="text-2xl text-black-eske dark:text-[#EAF2F8] font-bold mb-4">
                ¿Listo para solicitar tu sesión de diagnóstico gratuita?
              </h3>
              <p className="text-[16px] text-black-eske dark:text-[#C7D6E0] mb-6 opacity-90">
                Al solicitar una sesión, confirmas que has leído y aceptado
                estas Condiciones Específicas para Sesiones de Diagnóstico Gratuitas.
              </p>
              <div className="flex flex-col sm:flex-row gap-4 justify-center max-w-md mx-auto">
                <div className="flex-1">
                  <Button
                    label="Solicitar sesión de diagnóstico"
                    variant="primary"
                    onClick={() => setIsScheduleModalOpen(true)}
                  />
                </div>
                <Link href="/condiciones-de-uso" className="flex-1">
                  <Button
                    label="Ver Condiciones Generales"
                    variant="primary"
                  />
                </Link>
              </div>
            </div>

            {/* Nota final */}
            <div className="mt-8 text-center text-[12px] text-black-eske-30 dark:text-[#C7D6E0]">
              <p className="mb-2">
                Estas Condiciones son complementarias a nuestras{" "}
                <Link
                  href="/condiciones-de-uso"
                  className="text-bluegreen-eske hover:text-bluegreen-eske-70 dark:text-blue-eske-40 hover:dark:text-blue-eske-10 underline focus-ring-primary rounded"
                >
                  Condiciones de Uso Generales
                </Link>{" "}
                y nuestra{" "}
                <Link
                  href="/politica-de-privacidad"
                  className="text-bluegreen-eske hover:text-bluegreen-eske-70 dark:text-blue-eske-40 hover:dark:text-blue-eske-10 underline focus-ring-primary rounded"
                >
                  Política de Privacidad
                </Link>
                .
              </p>
              <p>
                Te recomendamos leer los tres documentos para entender
                completamente tus derechos y obligaciones al usar los servicios
                de Eskemma.
              </p>
            </div>
          </div>
        </div>
      </div>

      {/* Modales */}
      <ScheduleDate
        isOpen={isScheduleModalOpen}
        onClose={() => setIsScheduleModalOpen(false)}
        onSubmitSuccess={(data) => {
          setFormData(data);
          setIsScheduleModalOpen(false);
          setIsResponseModalOpen(true);
        }}
      />

      {isResponseModalOpen && (
        <ResponseDate
          isOpen={isResponseModalOpen}
          onClose={() => setIsResponseModalOpen(false)}
          fullName={formData.fullName}
          email={formData.email}
          dateTime={formData.dateTime}
        />
      )}
    </div>
  );
}

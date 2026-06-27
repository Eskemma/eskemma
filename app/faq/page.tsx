// app/faq/page.tsx
"use client";

import { useState } from "react";
import Link from "next/link";
import Image from "next/image";
import { useAuth } from "../../context/AuthContext";
import ScheduleDate from "../components/componentsHome/ScheduleDate";
import Button from "../components/Button";
import { generateFAQStructuredData } from "@/lib/seo";

const FAQ_SCHEMA_ITEMS = [
  { question: "¿Qué es Eskemma y cómo puede ayudarme en mi proyecto político?", answer: "Eskemma es un ecosistema digital diseñado para impulsar tu proyecto político con tecnología y datos estratégicos. Te acompañamos en el diseño, ejecución y evaluación de tu estrategia, ofreciéndote soluciones personalizadas para que logres tus objetivos con mayor eficacia y confianza." },
  { question: "¿Por qué debería elegir Eskemma en lugar de otras opciones gratuitas o tradicionales?", answer: "Aunque existen recursos gratuitos, Eskemma te ofrece información procesada, actualizada y herramientas digitales fáciles de usar, diseñadas para el éxito de tu proyecto político. Esto te permite ahorrar tiempo, dinero y esfuerzo, evitando la improvisación y actuando con estrategia." },
  { question: "¿Cómo garantizan que las herramientas y datos sean útiles para mi contexto político?", answer: "Nuestras herramientas están basadas en metodologías probadas y adaptadas a las necesidades de políticos y militantes en Iberoamérica. Además, ofrecemos acompañamiento personalizado para que puedas aplicar los recursos a tu entorno específico." },
  { question: "¿Qué tipo de proyectos políticos pueden beneficiarse de Eskemma?", answer: "Desde campañas locales hasta proyectos estatales o nacionales, Eskemma es útil para candidatos, equipos de campaña, militantes y organizaciones sociales o políticas que buscan profesionalizar su estrategia de comunicación política y maximizar su impacto." },
  { question: "¿Qué herramientas incluye Eskemma y cómo puedo acceder a ellas?", answer: "Eskemma ofrece herramientas como Sefix (bases de datos y dashboards para análisis político-electoral) y Moddulo (para diseñar tu estrategia política y evaluar su impacto). Puedes acceder a versiones freemium para probar su utilidad antes de suscribirte." },
  { question: "¿Necesito conocimientos técnicos para usar las herramientas de Eskemma?", answer: "No. Nuestras herramientas están diseñadas para ser intuitivas y fáciles de usar. Además, ofrecemos tutoriales y soporte técnico para que puedas sacarle el máximo provecho sin complicaciones." },
  { question: "¿Puedo probar las herramientas antes de comprar?", answer: "Sí. Ofrecemos versiones de prueba gratuitas de Sefix y Moddulo, para que puedas explorar su funcionalidad y decidir con confianza." },
  { question: "¿Cuáles son los planes de suscripción disponibles y qué incluyen?", answer: "Ofrecemos planes mensuales y anuales (individual o grupal), con acceso a herramientas, datos, asesorías y recursos exclusivos. Puedes comparar los planes en nuestra sección de Suscripciones y elegir el que mejor se adapte a tu presupuesto y necesidades." },
  { question: "¿Puedo pagar en cuotas o mensualidades?", answer: "Sí. En México, puedes pagar a 12 meses sin intereses con tarjetas de crédito. Para otros países, contáctanos o escríbenos a teamsupport@eskemma.com para evaluar opciones de pago flexibles." },
  { question: "¿El cobro de la suscripción es automático?", answer: "Sí, pero si hay algún problema con el pago, te notificaremos de inmediato. Usamos pasarelas de pago seguras y no almacenamos tus datos financieros." },
  { question: "¿Qué pasa si quiero cancelar mi suscripción?", answer: "Puedes cancelar en cualquier momento desde tu panel de usuario. Si tienes dudas, nuestro equipo de soporte está disponible para ayudarte." },
  { question: "¿Mis datos personales están seguros con Eskemma?", answer: "Sí. Cumplimos con la Ley de Datos Personales y utilizamos protocolos de seguridad avanzados para proteger tu información. Puedes consultar nuestra Política de Privacidad para más detalles." },
  { question: "¿Puedo compartir mi cuenta con otras personas?", answer: "Las cuentas individuales son personales. Si necesitas acceso para un equipo, te recomendamos nuestro plan Grupal, diseñado para equipos de trabajo." },
  { question: "¿Cómo maneja Eskemma la confidencialidad de la información de mis proyectos políticos?", answer: "Tu información es confidencial y solo será utilizada para mejorar tu experiencia en la plataforma. No compartimos datos con terceros sin tu consentimiento." },
  { question: "¿Qué tipo de soporte ofrecen si tengo dudas o problemas técnicos?", answer: "Ofrecemos soporte técnico 24/7 a través de nuestro formulario de contacto, WhatsApp y redes sociales. También contamos con tutoriales y guías para resolver dudas comunes. Puedes escribirnos directamente a teamsupport@eskemma.com" },
  { question: "¿Puedo recibir asesoría personalizada para mi proyecto político?", answer: "Sí. Ofrecemos asesorías por hora o paquetes de acompañamiento. Puedes agendar una sesión gratuita para explorar cómo podemos ayudarte." },
  { question: "¿Por qué debería pagar por información si hay recursos gratuitos disponibles?", answer: "Eskemma no solo te ofrece información, sino datos procesados, herramientas prácticas y acompañamiento experto para que puedas aplicarlos de manera efectiva. La diferencia está en el ahorro de tiempo, la precisión y el impacto en tu proyecto." },
  { question: "¿Cómo sé que Eskemma es la mejor opción para mi proyecto político?", answer: "Eskemma está respaldado por años de experiencia en proyectos políticos en Iberoamérica. Nuestros clientes han logrado ventajas competitivas gracias a nuestras herramientas y metodologías." },
  { question: "¿Qué pasa si no veo resultados inmediatos?", answer: "La estrategia política es un proceso, pero con nuestras herramientas podrás identificar oportunidades y tomar decisiones basadas en evidencia desde el primer día. Te acompañamos para que veas resultados tangibles en el corto y mediano plazo." },
  { question: "¿Cómo funciona el proceso de compra y activación de mi cuenta?", answer: "El proceso es sencillo: elige tu plan, completa el pago con tarjeta o Stripe, y tu cuenta se activará de inmediato. Si pagas con depósito o transferencia, la activación puede tardar hasta 24 horas." },
  { question: "¿Qué medios de pago aceptan?", answer: "Aceptamos tarjetas de crédito/débito (Visa, MasterCard), Stripe y pagos offline en algunos países." },
];

// ✅ Tipos actualizados para soportar múltiples CTAs
interface FaqCTA {
  text: string;
  link?: string;
  action?: () => void;
}

interface FaqItem {
  question: string;
  answer: string | React.ReactNode;
  cta?: FaqCTA | FaqCTA[]; // ✅ Ahora puede ser un CTA o un array de CTAs
}

interface FaqCategory {
  general: FaqItem[];
  herramientas: FaqItem[];
  suscripciones: FaqItem[];
  seguridad: FaqItem[];
  soporte: FaqItem[];
  objeciones: FaqItem[];
  compra: FaqItem[];
}

export default function FaqPage() {
  const [openDropdown, setOpenDropdown] = useState<number | null>(null);
  const [isScheduleModalOpen, setIsScheduleModalOpen] = useState(false);
  
  const { setIsSignInModalOpen } = useAuth();

  const toggleDropdown = (index: number) => {
    setOpenDropdown(openDropdown === index ? null : index);
  };

  const handleKeyDown = (index: number, e: React.KeyboardEvent) => {
    if (e.key === 'Enter' || e.key === ' ') {
      e.preventDefault();
      toggleDropdown(index);
    }
  };

  const handleOpenSignUp = () => {
    setIsSignInModalOpen(true);
  };

  const handleOpenSchedule = () => {
    setIsScheduleModalOpen(true);
  };

  const handleSubmitSuccess = (data: { fullName: string; email: string; dateTime: string }) => {
    console.log('Asesoría agendada:', data);
    setIsScheduleModalOpen(false);
  };

  const faqData: FaqCategory = {
    general: [
      {
        question:
          "¿Qué es Eskemma y cómo puede ayudarme en mi proyecto político?",
        answer:
          "Eskemma es un ecosistema digital diseñado para impulsar tu proyecto político con tecnología y datos estratégicos. Te acompañamos en el diseño, ejecución y evaluación de tu estrategia, ofreciéndote soluciones personalizadas para que logres tus objetivos con mayor eficacia y confianza.",
      },
      {
        question:
          "¿Por qué debería elegir Eskemma en lugar de otras opciones gratuitas o tradicionales?",
        answer:
          "Aunque existen recursos gratuitos, Eskemma te ofrece información procesada, actualizada y herramientas digitales fáciles de usar, diseñadas para el éxito de tu proyecto político. Esto te permite ahorrar tiempo, dinero y esfuerzo, evitando la improvisación y actuando con estrategia.",
      },
      {
        question:
          "¿Cómo garantizan que las herramientas y datos sean útiles para mi contexto político?",
        answer:
          "Nuestras herramientas están basadas en metodologías probadas y adaptadas a las necesidades de políticos y militantes en Iberoamérica. Además, ofrecemos acompañamiento personalizado para que puedas aplicar los recursos a tu entorno específico.",
      },
      {
        question:
          "¿Qué tipo de proyectos políticos pueden beneficiarse de Eskemma?",
        answer:
          "Desde campañas locales hasta proyectos estatales o nacionales, Eskemma es útil para candidatos, equipos de campaña, militantes y organizaciones sociales o políticas que buscan profesionalizar su estrategia de comunicación política y maximizar su impacto.",
      },
    ],
    herramientas: [
      {
        question:
          "¿Qué herramientas incluye Eskemma y cómo puedo acceder a ellas?",
        answer:
          "Eskemma ofrece herramientas como Sefix (bases de datos y dashboards para análisis político-electoral) y Moddulo (para diseñar tu estrategia política y evaluar su impacto). Puedes acceder a versiones freemium para probar su utilidad antes de suscribirte.",
        cta: [
          { text: "Explorar Sefix", link: "/sefix" },
          { text: "Explorar Moddulo", link: "/moddulo" } 
        ],
      },
      {
        question:
          "¿Necesito conocimientos técnicos para usar las herramientas de Eskemma?",
        answer:
          "No. Nuestras herramientas están diseñadas para ser intuitivas y fáciles de usar. Además, ofrecemos tutoriales y soporte técnico para que puedas sacarle el máximo provecho sin complicaciones.",
      },
      {
        question:
          "¿Cómo puedo asegurarme de que las herramientas son actualizadas y confiables?",
        answer:
          "Nuestro equipo actualiza constantemente las bases de datos y herramientas para garantizar que la información sea precisa y relevante. Trabajamos con fuentes oficiales y metodologías validadas.",
      },
      {
        question: "¿Puedo probar las herramientas antes de comprar?",
        answer:
          "¡Claro! Ofrecemos versiones de prueba gratuitas de Sefix y Moddulo, para que puedas explorar su funcionalidad y decidir con confianza.",
        cta: { 
          text: "Registrarme gratis", 
          action: handleOpenSignUp
        },
      },
    ],
    suscripciones: [
      {
        question:
          "¿Cuáles son los planes de suscripción disponibles y qué incluyen?",
        answer:
          "Ofrecemos planes mensuales y anuales (individual o grupal), con acceso a herramientas, datos, asesorías y recursos exclusivos. Puedes comparar los planes en nuestra sección de Suscripciones y elegir el que mejor se adapte a tu presupuesto y necesidades.",
        cta: { text: "Ver planes", link: "/#suscripciones" },
      },
      {
        question: "¿Puedo pagar en cuotas o mensualidades?",
        answer: (
          <>
            Sí. En México, puedes pagar a 12 meses sin intereses con tarjetas de
            crédito. Para otros países,{" "}
            <Link
              href="/contacto"
              className="text-bluegreen-eske font-medium underline hover:text-bluegreen-eske-70 focus-ring-primary rounded"
            >
              contáctanos
            </Link>{" "}
            o escríbenos a{" "}
            <a
              href="mailto:teamsupport@eskemma.com"
              className="text-bluegreen-eske font-medium underline hover:text-bluegreen-eske-70 focus-ring-primary rounded"
            >
              teamsupport@eskemma.com
            </a>{" "}
            para evaluar opciones de pago flexibles.
          </>
        ),
      },
      {
        question: "¿El cobro de la suscripción es automático?",
        answer:
          "Sí, pero si hay algún problema con el pago, te notificaremos de inmediato. Usamos pasarelas de pago seguras y no almacenamos tus datos financieros.",
      },
      {
        question: "¿Qué pasa si quiero cancelar mi suscripción?",
        answer:
          "Puedes cancelar en cualquier momento desde tu panel de usuario. Si tienes dudas, nuestro equipo de soporte está disponible para ayudarte.",
      },
      {
        question: "¿Ofrecen descuentos o promociones especiales?",
        answer: (
          <>
            Sí. Si abandonas la página de compra, te invitamos a dejar tus datos
            para notificarte sobre promociones. También ofrecemos descuentos por
            referidos y planes grupales.{" "}
            <Link
              href="/contacto"
              className="text-bluegreen-eske font-medium underline hover:text-bluegreen-eske-70 focus-ring-primary rounded"
            >
              Contáctanos
            </Link>{" "}
            o escríbenos a{" "}
            <a
              href="mailto:teamselling@eskemma.com"
              className="text-bluegreen-eske font-medium underline hover:text-bluegreen-eske-70 focus-ring-primary rounded"
            >
              teamselling@eskemma.com
            </a>{" "}
            para mayor información sobre promociones especiales.
          </>
        ),
      },
    ],
    seguridad: [
      {
        question: "¿Mis datos personales están seguros con Eskemma?",
        answer:
          "Sí. Cumplimos con la Ley de Datos Personales y utilizamos protocolos de seguridad avanzados para proteger tu información. Puedes consultar nuestra Política de Privacidad para más detalles.",
        cta: {
          text: "Ver política de privacidad",
          link: "/politica-de-privacidad",
        },
      },
      {
        question: "¿Puedo compartir mi cuenta con otras personas?",
        answer:
          "Las cuentas individuales son personales. Si necesitas acceso para un equipo, te recomendamos nuestro plan Grupal, diseñado para equipos de trabajo.",
      },
      {
        question:
          "¿Cómo maneja Eskemma la confidencialidad de la información de mis proyectos políticos?",
        answer:
          "Tu información es confidencial y solo será utilizada para mejorar tu experiencia en la plataforma. No compartimos datos con terceros sin tu consentimiento.",
      },
    ],
    soporte: [
      {
        question:
          "¿Qué tipo de soporte ofrecen si tengo dudas o problemas técnicos?",
        answer: (
          <>
            Ofrecemos soporte técnico 24/7 a través de nuestro{" "}
            <Link
              href="/contacto"
              className="text-bluegreen-eske font-medium underline hover:text-bluegreen-eske-70 focus-ring-primary rounded"
            >
              formulario de contacto
            </Link>
            , WhatsApp y redes sociales. También contamos con tutoriales y guías
            para resolver dudas comunes. Si prefieres, puedes escribirnos
            directamente a{" "}
            <a
              href="mailto:teamsupport@eskemma.com"
              className="text-bluegreen-eske font-medium underline hover:text-bluegreen-eske-70 focus-ring-primary rounded"
            >
              teamsupport@eskemma.com
            </a>
          </>
        ),
        cta: { text: "Contactar soporte", link: "/contacto" },
      },
      {
        question:
          "¿Puedo recibir asesoría personalizada para mi proyecto político?",
        answer:
          "Sí. Ofrecemos asesorías por hora o paquetes de acompañamiento. Puedes agendar una sesión gratuita para explorar cómo podemos ayudarte.",
        cta: { 
          text: "Agendar asesoría gratis", 
          action: handleOpenSchedule
        },
      },
      {
        question:
          "¿Cómo puedo contactar directamente a Eskemma para resolver dudas?",
        answer: (
          <>
            Puedes escribirnos a través de nuestro{" "}
            <Link
              href="/contacto"
              className="text-bluegreen-eske font-medium underline hover:text-bluegreen-eske-70 focus-ring-primary rounded"
            >
              formulario de contacto
            </Link>
            , WhatsApp, redes sociales, o directamente por correo. También
            puedes agendar una llamada con nuestro equipo.
          </>
        ),
      },
      {
        question:
          "¿Qué pasa si no sé cómo usar una herramienta o necesito ayuda adicional?",
        answer:
          "Además de los tutoriales, ofrecemos sesiones de capacitación y acompañamiento inicial para que domines las herramientas sin problemas.",
      },
    ],
    objeciones: [
      {
        question:
          "¿Por qué debería pagar por información si hay recursos gratuitos disponibles?",
        answer:
          "Eskemma no solo te ofrece información, sino datos procesados, herramientas prácticas y acompañamiento experto para que puedas aplicarlos de manera efectiva. La diferencia está en el ahorro de tiempo, la precisión y el impacto en tu proyecto.",
      },
      {
        question:
          "¿Cómo sé que Eskemma es la mejor opción para mi proyecto político?",
        answer:
          "Eskemma está respaldado por años de experiencia en proyectos políticos en Iberoamérica. Nuestros clientes han logrado ventajas competitivas gracias a nuestras herramientas y metodologías.",
      },
      {
        question: "¿Qué pasa si no veo resultados inmediatos?",
        answer:
          "La estrategia política es un proceso, pero con nuestras herramientas podrás identificar oportunidades y tomar decisiones basadas en evidencia desde el primer día. Te acompañamos para que veas resultados tangibles en el corto y mediano plazo.",
      },
      {
        question:
          "¿Puedo confiar en que Eskemma entenderá las particularidades de mi contexto político?",
        answer:
          "Sí. Nuestro equipo está compuesto por expertos en estrategia política y comunicación política que conocen los desafíos de Iberoamérica. Trabajamos contigo para adaptar las soluciones al entorno de tu proyecto político.",
      },
    ],
    compra: [
      {
        question:
          "¿Cómo funciona el proceso de compra y activación de mi cuenta?",
        answer:
          "El proceso es sencillo: elige tu plan, completa el pago con tarjeta o Stripe, y tu cuenta se activará de inmediato. Si pagas con depósito o transferencia, la activación puede tardar hasta 24 horas.",
      },
      {
        question: "¿Qué medios de pago aceptan?",
        answer:
          "Aceptamos tarjetas de crédito/débito (Visa, MasterCard), Stripe y pagos offline en algunos países.",
      },
      {
        question:
          "¿Qué pasa si no recibo el correo de activación después de pagar?",
        answer: (
          <>
            Revisa tu bandeja de spam o{" "}
            <Link
              href="/contacto"
              className="text-bluegreen-eske font-medium underline hover:text-bluegreen-eske-70 focus-ring-primary rounded"
            >
              contáctanos
            </Link>{" "}
            con tu comprobante de pago. También puedes escribirnos a{" "}
            <a
              href="mailto:teamsupport@eskemma.com"
              className="text-bluegreen-eske font-medium underline hover:text-bluegreen-eske-70 focus-ring-primary rounded"
            >
              teamsupport@eskemma.com
            </a>
            . Te ayudaremos a activar tu cuenta de inmediato.
          </>
        ),
      },
      {
        question: "¿Puedo solicitar una factura fiscal por mi suscripción?",
        answer: (
          <>
            Sí. Si realizas un depósito local en México o Colombia,{" "}
            <Link
              href="/contacto"
              className="text-bluegreen-eske font-medium underline hover:text-bluegreen-eske-70 focus-ring-primary rounded"
            >
              contáctanos
            </Link>{" "}
            o envíanos un correo a{" "}
            <a
              href="mailto:teamsupport@eskemma.com"
              className="text-bluegreen-eske font-medium underline hover:text-bluegreen-eske-70 focus-ring-primary rounded"
            >
              teamsupport@eskemma.com
            </a>{" "}
            con el asunto "Solicitud de factura" y te guiaremos en el proceso.
          </>
        ),
      },
    ],
  };

  const categories = [
    { id: "general", title: "Información General", icon: "🔶" },
    { id: "herramientas", title: "Herramientas y Funcionalidades", icon: "🔶" },
    { id: "suscripciones", title: "Planes y Suscripciones", icon: "🔶" },
    { id: "seguridad", title: "Seguridad y Privacidad", icon: "🔶" },
    { id: "soporte", title: "Soporte y Asesoría", icon: "🔶" },
    { id: "objeciones", title: "Dudas Comunes", icon: "🔶" },
    { id: "compra", title: "Proceso de Compra", icon: "🔶" },
  ];

  let questionCounter = 0;

  // ✅ Helper para renderizar CTAs (soporta uno o múltiples)
  const renderCTAs = (cta: FaqCTA | FaqCTA[]) => {
    const ctas = Array.isArray(cta) ? cta : [cta];
    
    return (
      <div className="mt-4 max-sm:mt-2 flex flex-wrap gap-3 max-sm:gap-2">
        {ctas.map((ctaItem, index) => (
          <div key={index} className="w-full max-w-[250px]">
            {ctaItem.link ? (
              <Link href={ctaItem.link}>
                <Button label={ctaItem.text} variant="primary" />
              </Link>
            ) : ctaItem.action ? (
              <Button
                label={ctaItem.text}
                variant="primary"
                onClick={ctaItem.action}
              />
            ) : null}
          </div>
        ))}
      </div>
    );
  };

  const faqSchema = generateFAQStructuredData(FAQ_SCHEMA_ITEMS);

  return (
    <main className="min-h-screen bg-gray-eske-10 dark:bg-[#0B1620]">
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(faqSchema) }}
      />
      {/* Hero Section - HOMOLOGADO CON SERVICIOS */}
      <section className="relative min-h-[200px] max-sm:min-h-[150px] w-full flex items-center justify-center bg-bluegreen-eske overflow-hidden">
        <Image
          src="/images/yanmin_yang.jpg"
          alt=""
          fill
          style={{ objectFit: "cover" }}
          className="object-cover"
          priority
          aria-hidden="true"
        />
        <div className="absolute inset-0 bg-bluegreen-eske opacity-75" aria-hidden="true"></div>
        <div className="relative z-10 text-center text-white-eske px-4 sm:px-6 md:px-8 max-w-screen-xl mx-auto w-full">
          <h1 className="text-[36px] max-sm:text-2xl leading-tight font-bold">
            Preguntas Frecuentes
          </h1>
          <p className="mt-4 max-sm:mt-2 text-[18px] max-sm:text-base leading-relaxed font-light">
            Encuentra respuestas a las dudas más comunes sobre Eskemma
          </p>
        </div>
      </section>

      {/* FAQ Content */}
      <section className="py-12 max-sm:py-8 px-4 sm:px-6 md:px-8">
        <div className="w-[90%] mx-auto max-w-screen-xl">
          {/* Intro */}
          <div className="text-center mb-12 max-sm:mb-8">
            <p className="text-[18px] max-sm:text-base text-black-eske dark:text-[#C7D6E0] max-w-3xl mx-auto">
              ¿No encuentras la respuesta que buscas?{" "}
            </p>
            <p className="text-[16px] max-sm:text-sm text-black-eske dark:text-[#C7D6E0] max-w-3xl mt-2 max-sm:mt-1 mx-auto">
              Contáctanos directamente y nuestro equipo te ayudará.
            </p>
            <div className="max-w-[300px] mx-auto mt-6 max-sm:mt-4">
              <Link href="/contacto">
                <Button label="CONTACTAR CON ESKEMMA" variant="secondary" />
              </Link>
            </div>
          </div>

          {/* FAQ por categorías */}
          {categories.map((category) => (
            <div key={category.id} className="mb-12 max-sm:mb-8">
              <h2 className="text-2xl max-sm:text-xl font-bold text-bluegreen-eske mb-6 max-sm:mb-4 flex items-center">
                <span className="text-3xl max-sm:text-2xl mr-3 max-sm:mr-2">{category.icon}</span>
                {category.title}
              </h2>

              <div className="space-y-4 max-sm:space-y-3">
                {faqData[category.id as keyof FaqCategory].map((faq) => {
                  const currentIndex = questionCounter++;
                  return (
                    <div
                      key={currentIndex}
                      className="bg-white-eske dark:bg-[#18324A] rounded-lg shadow-md hover:shadow-xl transition-shadow duration-300 p-6 max-sm:p-4"
                    >
                      <button
                        className="flex items-center justify-between w-full text-left focus-ring-primary rounded"
                        onClick={() => toggleDropdown(currentIndex)}
                        onKeyDown={(e) => handleKeyDown(currentIndex, e)}
                        aria-expanded={openDropdown === currentIndex}
                        aria-controls={`faq-answer-${currentIndex}`}
                        id={`faq-question-${currentIndex}`}
                      >
                        <span className="text-lg max-sm:text-base font-medium text-bluegreen-eske pr-4 max-sm:pr-2">
                          {faq.question}
                        </span>
                        <svg
                          className={`w-6 h-6 max-sm:w-5 max-sm:h-5 text-bluegreen-eske transform transition-transform duration-300 ease-in-out flex-shrink-0 ${
                            openDropdown === currentIndex ? "rotate-180" : ""
                          }`}
                          xmlns="http://www.w3.org/2000/svg"
                          fill="none"
                          viewBox="0 0 24 24"
                          stroke="currentColor"
                          aria-hidden="true"
                        >
                          <path
                            strokeLinecap="round"
                            strokeLinejoin="round"
                            strokeWidth={2}
                            d="M19 9l-7 7-7-7"
                          />
                        </svg>
                      </button>

                      {openDropdown === currentIndex && (
                        <div 
                          id={`faq-answer-${currentIndex}`}
                          role="region"
                          aria-labelledby={`faq-question-${currentIndex}`}
                          className="mt-4 max-sm:mt-2"
                        >
                          <div className="text-[16px] max-sm:text-sm text-black-eske dark:text-[#C7D6E0] leading-relaxed">
                            {faq.answer}
                          </div>

                          {/* ✅ Renderizado de CTAs (soporta uno o múltiples) */}
                          {faq.cta && renderCTAs(faq.cta)}
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            </div>
          ))}

          {/* CTA Final */}
          <div className="mt-16 max-sm:mt-12 text-center bg-blue-eske-80 rounded-lg p-12 max-sm:p-6">
            <h2 className="text-3xl max-sm:text-xl font-bold text-white-eske mb-4 max-sm:mb-3">
              ¿Quieres impulsar tu proyecto político?
            </h2>
            <p className="text-xl max-sm:text-base text-white-eske-90 mb-8 max-sm:mb-6 max-w-2xl mx-auto">
              Únete a Eskemma y accede a nuestro ecosistema digital profesional.
            </p>
            <div className="flex flex-col sm:flex-row gap-4 max-sm:gap-3 justify-center items-center">
              <div className="max-w-[250px] w-full">
                <Link href="/#suscripciones">
                  <Button label="VER PLANES" variant="secondary" />
                </Link>
              </div>
              <div className="max-w-[250px] w-full">
                <Button 
                  label="AGENDAR ASESORÍA" 
                  variant="primary"
                  onClick={handleOpenSchedule}
                />
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* ✅ Modal de Agendar Asesoría */}
      {isScheduleModalOpen && (
        <ScheduleDate 
          isOpen={isScheduleModalOpen}
          onClose={() => setIsScheduleModalOpen(false)} 
          onSubmitSuccess={handleSubmitSuccess} 
        />
      )}
    </main>
  );
}

// app/sefix/components/SefixFeedbackBanner.tsx
export function SefixFeedbackBanner() {
  return (
    <section aria-label="Feedback Sefix" className="bg-bluegreen-eske-80 mt-8">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 md:px-8 py-5 text-center">
        <p className="text-white text-[10px] sm:text-base">
          ¡Gracias por utilizar Sefix! Ayúdanos a mejorar reportando errores,
          sugerencias o comentarios a:{" "}
          <a
            href="mailto:sefix@eskemma.com?subject=Feedback%20Sefix%20-%20Soporte%20Usuario"
            className="font-semibold underline underline-offset-2 hover:text-blue-eske-10 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white"
          >
            sefix@eskemma.com
          </a>
          . ¡Nos encanta escucharte!
        </p>
      </div>
    </section>
  );
}
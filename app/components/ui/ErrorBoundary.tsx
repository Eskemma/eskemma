"use client";

// app/components/ui/ErrorBoundary.tsx
// Red de seguridad genérica: si un componente hijo truena durante el render
// (ej. datos con una forma inesperada), muestra un mensaje recuperable en
// vez de dejar la pantalla en blanco — React no tiene un equivalente en
// hooks para esto, solo funciona como clase.

import { Component, type ReactNode } from "react";

interface Props {
  children: ReactNode;
  /** Texto mostrado sobre el botón de recuperación — describe qué se estaba mostrando. */
  fallbackLabel?: string;
}

interface State {
  hasError: boolean;
}

export default class ErrorBoundary extends Component<Props, State> {
  state: State = { hasError: false };

  static getDerivedStateFromError(): State {
    return { hasError: true };
  }

  componentDidCatch(error: unknown) {
    // eslint-disable-next-line no-console
    console.error("[ErrorBoundary]", error);
  }

  render() {
    if (this.state.hasError) {
      return (
        <div className="p-4 rounded-lg border border-red-eske/30 bg-red-eske/5 text-center">
          <p className="text-xs lg:text-sm text-black-eske-80 dark:text-[#9AAEBE] mb-3">
            {this.props.fallbackLabel ?? "Algo salió mal al mostrar esta sección."}
          </p>
          <button
            type="button"
            onClick={() => this.setState({ hasError: false })}
            className="px-2.5 py-1.5 rounded-full text-xs font-semibold border border-bluegreen-eske-60 text-bluegreen-eske-60 hover:bg-bluegreen-eske/5 transition-colors"
          >
            Reintentar
          </button>
        </div>
      );
    }
    return this.props.children;
  }
}

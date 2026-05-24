import Link from "next/link";
import UnderConstructionPage from "./components/UnderConstructionPage";

export default function NotFound() {
  return (
    <div className="flex flex-col items-center">
      <UnderConstructionPage title="Página no encontrada" />
      <div className="mt-6 mb-12">
        <Link
          href="/"
          className="bg-bluegreen-eske text-white-eske px-6 py-3 rounded-lg font-medium hover:bg-bluegreen-eske-70 transition-all duration-300 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-bluegreen-eske"
        >
          Ir a la página de inicio
        </Link>
      </div>
    </div>
  );
}

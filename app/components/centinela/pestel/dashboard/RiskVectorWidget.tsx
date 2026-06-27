
interface RiskVectorWidgetProps {
  vectorRiesgo: number;
  indicePresionSocial: number;
  indiceClimaInversion: number;
}

interface KpiCardProps {
  label: string;
  value: number;
  description: string;
  invertColor?: boolean;
}

function riskLevel(
  value: number,
  invert = false
): "low" | "medium" | "high" {
  const v = invert ? 100 - value : value;
  if (v >= 70) return "high";
  if (v >= 40) return "medium";
  return "low";
}

const LEVEL_STYLES = {
  low:    {bar: "bg-green-500",  text: "text-green-600 dark:text-green-400",  bg: "bg-green-50 dark:bg-green-900/20",  label: "Bajo"},
  medium: {bar: "bg-yellow-400", text: "text-yellow-600 dark:text-yellow-400", bg: "bg-yellow-50 dark:bg-yellow-900/20", label: "Moderado"},
  high:   {bar: "bg-red-500",    text: "text-red-600 dark:text-red-400",    bg: "bg-red-50 dark:bg-red-900/20",    label: "Alto"},
};

function KpiCard({label, value, description, invertColor = false}: KpiCardProps) {
  const clamped = Math.max(0, Math.min(100, Math.round(value)));
  const level = riskLevel(clamped, invertColor);
  const styles = LEVEL_STYLES[level];

  return (
    <div className={`flex-1 min-w-0 rounded-xl p-5 ${styles.bg} border border-black/5`}>
      <div className="flex items-start justify-between gap-2 mb-3">
        <p className="text-xs font-semibold uppercase tracking-wide text-gray-500 dark:text-[#9AAEBE]">
          {label}
        </p>
        <span
          className={`shrink-0 text-xs font-medium px-2 py-0.5 rounded-full
            bg-white/70 ${styles.text}`}
        >
          {styles.label}
        </span>
      </div>

      <p className={`text-4xl font-bold tabular-nums mb-3 ${styles.text}`}>
        {clamped}
        <span className="text-lg font-normal text-gray-400 dark:text-[#6D8294] ml-1">/100</span>
      </p>

      <div className="w-full h-2 bg-black/10 rounded-full overflow-hidden mb-2">
        <div
          className={`h-full rounded-full transition-all duration-700 ${styles.bar}`}
          style={{width: `${clamped}%`}}
        />
      </div>

      <p className="text-xs text-gray-500 dark:text-[#9AAEBE] leading-snug">{description}</p>
    </div>
  );
}

export default function RiskVectorWidget({
  vectorRiesgo,
  indicePresionSocial,
  indiceClimaInversion,
}: RiskVectorWidgetProps) {
  return (
    <div className="bg-white-eske dark:bg-[#18324A] rounded-xl shadow-md p-6">
      <h3 className="text-sm font-bold uppercase tracking-wider text-gray-400 dark:text-[#9AAEBE] mb-4">
        Índices de riesgo
      </h3>
      <div className="flex flex-col sm:flex-row gap-3">
        <KpiCard
          label="Vector de Riesgo"
          value={vectorRiesgo}
          description="Riesgo político-social-económico global"
        />
        <KpiCard
          label="Presión Social"
          value={indicePresionSocial}
          description="Tensión acumulada en la dimensión social"
        />
        <KpiCard
          label="Clima de Inversión"
          value={indiceClimaInversion}
          description="Favorabilidad del entorno (100 = óptimo)"
          invertColor
        />
      </div>
    </div>
  );
}

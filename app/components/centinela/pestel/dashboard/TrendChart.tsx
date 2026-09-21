// app/components/centinela/pestel/dashboard/TrendChart.tsx

interface TrendChartProps {
  data: unknown[];
  label: string;
}

export default function TrendChart({ data, label }: TrendChartProps) {
  void data;
  return (
    <div className="p-4 bg-white-eske dark:bg-[#18324A] rounded-lg border border-gray-eske-10 dark:border-white/10 text-gray-eske-90 dark:text-[#6D8294] text-sm">
      [ TrendChart — {label} — pendiente ]
    </div>
  );
}

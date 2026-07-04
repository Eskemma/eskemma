// app/components/centinela/pestel/monitoreo/AlertsFeed.tsx
// Shows recent alerts for the project with polling (30s).

"use client";

import { useState, useEffect, useCallback } from "react";
import type { PESTELAlertV2 } from "@/types/pestel.types";

interface Props {
  projectId: string;
  onAlertsChange?: (alerts: PESTELAlertV2[]) => void;
}

const POLL_INTERVAL_MS = 30_000;

const ALERT_ICONS: Record<string, string> = {
  mentions_spike: "🔺",
  sentiment_drop: "📉",
  economic_change: "💹",
  bias_detected: "⚖️",
  coverage_low: "📡",
};

function formatRelative(value: unknown): string {
  try {
    const d =
      typeof value === "string"
        ? new Date(value)
        : new Date(
            (value as { _seconds: number })._seconds * 1000
          );
    const diffMs = Date.now() - d.getTime();
    const diffMin = Math.floor(diffMs / 60_000);
    if (diffMin < 2) return "hace un momento";
    if (diffMin < 60) return `hace ${diffMin} min`;
    const diffH = Math.floor(diffMin / 60);
    if (diffH < 24) return `hace ${diffH}h`;
    return d.toLocaleDateString("es-MX", {
      day: "numeric",
      month: "short",
    });
  } catch {
    return "";
  }
}

export default function AlertsFeed({ projectId, onAlertsChange }: Props) {
  const [alerts, setAlerts] = useState<PESTELAlertV2[]>([]);
  const [loading, setLoading] = useState(true);
  const [markingRead, setMarkingRead] = useState<string | null>(null);

  const fetchAlerts = useCallback(async () => {
    try {
      const res = await fetch(
        `/api/centinela/pestel/project/${projectId}/alerts`
      );
      if (!res.ok) return;
      const data = (await res.json()) as { alerts: PESTELAlertV2[] };
      setAlerts(data.alerts);
      onAlertsChange?.(data.alerts);
    } catch {
      // silent — keep showing last known state
    } finally {
      setLoading(false);
    }
  }, [projectId, onAlertsChange]);

  useEffect(() => {
    fetchAlerts();
    const interval = setInterval(fetchAlerts, POLL_INTERVAL_MS);
    return () => clearInterval(interval);
  }, [fetchAlerts]);

  async function handleMarkRead(alertId: string) {
    setMarkingRead(alertId);
    try {
      await fetch(`/api/centinela/pestel/alerts/${alertId}/read`, {
        method: "POST",
      });
      // Optimistic update
      setAlerts((prev) =>
        prev.map((a) =>
          a.id === alertId ? { ...a, readAt: new Date().toISOString() } : a
        )
      );
    } finally {
      setMarkingRead(null);
    }
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center py-8">
        <div
          className="w-5 h-5 border-2 border-bluegreen-eske border-t-transparent
            rounded-full animate-spin"
          aria-label="Cargando alertas"
        />
      </div>
    );
  }

  if (alerts.length === 0) {
    return (
      <div className="text-center py-8 px-4">
        <p className="text-2xl mb-2" aria-hidden="true">
          🟢
        </p>
        <p className="text-sm font-medium text-black-eske dark:text-[#EAF2F8]">
          Sin alertas recientes
        </p>
        <p className="text-xs text-black-eske dark:text-[#9AAEBE] mt-1">
          Las alertas se generarán en cada análisis cuando el riesgo supere el umbral configurado para el proyecto.
        </p>
      </div>
    );
  }

  return (
    <ul className="flex flex-col divide-y divide-gray-eske-10 dark:divide-white/10" role="list">
      {alerts.map((alert) => {
        const isRead = Boolean(alert.readAt);
        return (
          <li
            key={alert.id}
            className={`px-0 py-3 flex gap-3 ${isRead ? "opacity-60" : ""}`}
          >
            <span
              className="text-base shrink-0 mt-0.5"
              aria-hidden="true"
            >
              {alert.isCrisis ? "🔴" : (ALERT_ICONS[alert.type] ?? "🔔")}
            </span>
            <div className="flex-1 min-w-0">
              <p className="text-sm text-black-eske dark:text-[#C7D6E0] leading-snug">
                {alert.description}
              </p>
              <p className="text-xs text-black-eske dark:text-[#9AAEBE] mt-0.5">
                {formatRelative(alert.generadoEn)}
                {alert.isCrisis && (
                  <span className="ml-2 inline-block px-1.5 py-0.5 bg-red-eske/10
                    text-red-eske text-xs rounded-full border border-red-eske/20">
                    Crisis
                  </span>
                )}
              </p>
            </div>
            {!isRead && (
              <button
                type="button"
                onClick={() => handleMarkRead(alert.id)}
                disabled={markingRead === alert.id}
                className="shrink-0 text-xs text-gray-eske-50 dark:text-[#6D8294] hover:text-bluegreen-eske dark:hover:text-[#6BA4C6]
                  transition-colors disabled:opacity-40"
                aria-label="Marcar como leída"
              >
                {markingRead === alert.id ? "…" : "✓"}
              </button>
            )}
          </li>
        );
      })}
    </ul>
  );
}

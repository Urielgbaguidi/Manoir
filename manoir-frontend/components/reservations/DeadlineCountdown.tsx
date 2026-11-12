"use client";

import { Clock } from "lucide-react";
import { useEffect, useState } from "react";
import { cn } from "@/lib/utils";

const HOUR = 60 * 60 * 1000;

/** Compte à rebours jusqu'à l'heure limite de paiement fixée à la validation. */
export default function DeadlineCountdown({
  deadline,
  startedAt,
  label = "Temps restant pour régler votre séjour",
  onExpire
}: {
  deadline: string;
  startedAt?: string | null;
  label?: string;
  onExpire?: () => void;
}) {
  const [nowMs, setNowMs] = useState(() => Date.now());

  useEffect(() => {
    const timer = window.setInterval(() => setNowMs(Date.now()), 1000);
    return () => window.clearInterval(timer);
  }, []);

  const deadlineMs = new Date(deadline).getTime();
  const startMs = startedAt ? new Date(startedAt).getTime() : NaN;
  const totalMs = Math.max(
    1,
    deadlineMs - (Number.isNaN(startMs) ? deadlineMs - 12 * HOUR : startMs)
  );
  const remainingMs = Math.max(0, deadlineMs - nowMs);
  const expired = !Number.isNaN(deadlineMs) && remainingMs <= 0;
  const urgent = !expired && remainingMs <= 2 * HOUR;

  useEffect(() => {
    if (expired) onExpire?.();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [expired]);

  if (Number.isNaN(deadlineMs)) return null;

  const totalSeconds = Math.floor(remainingMs / 1000);
  const parts = [
    { label: "Heures", value: Math.floor(totalSeconds / 3600) },
    { label: "Minutes", value: Math.floor((totalSeconds % 3600) / 60) },
    { label: "Secondes", value: totalSeconds % 60 }
  ];

  return (
    <div
      className={cn(
        "rounded-2xl border p-4 text-xs",
        expired
          ? "border-terracotta/40 bg-terracotta/15 text-terracotta-light"
          : urgent
            ? "border-terracotta/30 bg-terracotta/10 text-terracotta-light"
            : "border-gold/20 bg-white/5 text-cream"
      )}
    >
      <div className="flex items-start gap-3">
        <Clock className="mt-0.5 h-4 w-4 shrink-0" />
        <div className="min-w-0 flex-1">
          <p className="font-semibold">
            À régler avant le{" "}
            {new Date(deadline).toLocaleString("fr-FR", {
              day: "numeric",
              month: "long",
              hour: "2-digit",
              minute: "2-digit"
            })}
          </p>
          <p className="mt-1 text-[10px] uppercase tracking-widest opacity-60">{label}</p>

          {expired ? (
            <p className="mt-3 rounded-xl border border-terracotta/30 bg-terracotta/15 px-3 py-2 text-[11px] font-bold">
              Délai expiré : le paiement est fermé et l&apos;appartement est de nouveau proposé à la
              location.
            </p>
          ) : (
            <>
              <div className="mt-3 grid grid-cols-3 gap-2">
                {parts.map((item) => (
                  <div
                    key={item.label}
                    className="rounded-xl border border-current/10 bg-white/5 px-3 py-2 text-center"
                  >
                    <p className="font-display text-lg font-bold leading-none">
                      {String(item.value).padStart(2, "0")}
                    </p>
                    <p className="mt-1 text-[8px] font-black uppercase tracking-widest opacity-55">
                      {item.label}
                    </p>
                  </div>
                ))}
              </div>
              <div className="mt-3 h-1.5 overflow-hidden rounded-full bg-current/10">
                <div
                  className={cn(
                    "h-full rounded-full transition-all duration-500",
                    urgent ? "bg-terracotta" : "bg-gold"
                  )}
                  style={{ width: `${Math.max(0, Math.min(100, (remainingMs / totalMs) * 100))}%` }}
                />
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  );
}

"use client";

import { Download } from "lucide-react";
import { useState } from "react";
import { useToast } from "@/context/ToastContext";
import { api } from "@/lib/api";
import { saveBlob } from "@/lib/reservationDisplay";
import { cn } from "@/lib/utils";
import { errorMessage } from "./useIdempotentIntent";

/** Télécharge un Bon de Séjour (PDF généré par le serveur après paiement). */
export default function VoucherButton({
  voucherId,
  label = "Télécharger le Bon de Séjour",
  variant = "primary",
  className
}: {
  voucherId: number;
  label?: string;
  variant?: "primary" | "outline" | "icon";
  className?: string;
}) {
  const { showToast } = useToast();
  const [downloading, setDownloading] = useState(false);

  const download = async () => {
    if (downloading) return;
    setDownloading(true);
    try {
      const { blob, filename } = await api.downloadVoucherPdf(voucherId);
      saveBlob(blob, filename);
    } catch (error) {
      showToast(errorMessage(error, "Impossible de télécharger le Bon de Séjour."), "error");
    } finally {
      setDownloading(false);
    }
  };

  if (variant === "icon") {
    return (
      <button
        type="button"
        onClick={download}
        disabled={downloading}
        aria-label={label}
        title={label}
        className={cn(
          "inline-flex size-9 items-center justify-center rounded-lg border border-gold/15 text-cream/60 transition hover:border-gold/40 hover:text-gold-light disabled:cursor-wait disabled:opacity-60",
          className
        )}
      >
        {downloading ? (
          <span className="inline-block size-4 animate-spin rounded-full border-2 border-current border-t-transparent" />
        ) : (
          <Download size={17} />
        )}
      </button>
    );
  }

  return (
    <button
      type="button"
      onClick={download}
      disabled={downloading}
      className={cn(
        "inline-flex items-center justify-center gap-2 transition disabled:cursor-wait disabled:opacity-60",
        variant === "primary"
          ? "rounded-full bg-gradient-to-br from-gold-light to-gold px-5 py-3 text-[11px] font-bold uppercase tracking-[0.14em] text-night hover:brightness-105"
          : "rounded-xl border border-gold/20 px-4 py-2.5 text-[10px] font-black uppercase tracking-wider text-cream hover:border-gold/40 hover:bg-white/10 hover:text-gold-light",
        className
      )}
    >
      {downloading ? (
        <span className="inline-block h-3.5 w-3.5 animate-spin rounded-full border-2 border-current border-t-transparent" />
      ) : (
        <Download size={14} />
      )}
      {label}
    </button>
  );
}

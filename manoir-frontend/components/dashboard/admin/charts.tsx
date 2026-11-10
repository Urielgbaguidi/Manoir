"use client";

import type { ApexOptions } from "apexcharts";
import dynamic from "next/dynamic";
import { useMemo, useState } from "react";
import { useThemeMode } from "@/lib/useThemeMode";
import { cn } from "@/lib/utils";

// ApexCharts manipule le DOM : chargement côté client uniquement (comme TailAdmin).
const Chart = dynamic(() => import("react-apexcharts"), {
  ssr: false,
  loading: () => <div className="h-full min-h-[180px] w-full animate-pulse rounded-xl bg-white/5" />
});

export const MONTHS = ["Jan", "Fév", "Mar", "Avr", "Mai", "Juin", "Juil", "Août", "Sep", "Oct", "Nov", "Déc"];

const palette = {
  gold: "#C9A45C",
  goldLight: "#E4C888",
  olive: "#6B7B3E",
  oliveLight: "#8A9E52",
  terracotta: "#8B5A2B",
  sand: "#D4C4A8"
};

function useChartTheme() {
  const mode = useThemeMode();
  const dark = mode === "dark";
  return {
    mode,
    label: dark ? "#BFB3A0" : "#6B5B45",
    grid: dark ? "rgba(228,200,136,0.10)" : "rgba(61,40,23,0.08)",
    strong: dark ? "#F5F0E6" : "#2C2416",
    track: dark ? "rgba(228,200,136,0.12)" : "#EBE5D5"
  };
}

const compactFcfa = (value: number) =>
  value >= 1_000_000
    ? `${(value / 1_000_000).toLocaleString("fr-FR", { maximumFractionDigits: 1 })} M`
    : value >= 1_000
      ? `${Math.round(value / 1_000).toLocaleString("fr-FR")} k`
      : value.toLocaleString("fr-FR");

/** Chiffre d'affaires mensuel (barres) — reprise de « Monthly Sales » TailAdmin. */
export function MonthlyRevenueChart({ data }: { data: number[] }) {
  const theme = useChartTheme();

  const options: ApexOptions = {
    colors: [palette.gold],
    chart: { fontFamily: "inherit", type: "bar", toolbar: { show: false }, background: "transparent" },
    theme: { mode: theme.mode },
    plotOptions: {
      bar: { horizontal: false, columnWidth: "42%", borderRadius: 6, borderRadiusApplication: "end" }
    },
    dataLabels: { enabled: false },
    stroke: { show: true, width: 3, colors: ["transparent"] },
    xaxis: {
      categories: MONTHS,
      axisBorder: { show: false },
      axisTicks: { show: false },
      labels: { style: { colors: theme.label } }
    },
    yaxis: { labels: { style: { colors: [theme.label] }, formatter: compactFcfa } },
    grid: { borderColor: theme.grid, yaxis: { lines: { show: true } } },
    fill: {
      type: "gradient",
      gradient: {
        type: "vertical",
        opacityFrom: 1,
        opacityTo: 1,
        stops: [0, 100],
        colorStops: [
          { offset: 0, color: palette.goldLight, opacity: 1 },
          { offset: 100, color: palette.terracotta, opacity: 1 }
        ]
      }
    },
    legend: { show: false },
    tooltip: { theme: theme.mode, y: { formatter: (value: number) => `${value.toLocaleString("fr-FR")} FCFA` } }
  };

  return (
    <div className="-ml-4 min-w-[640px] xl:min-w-full">
      <Chart options={options} series={[{ name: "Encaissements", data }]} type="bar" height={200} />
    </div>
  );
}

/** Jauge d'occupation — reprise de « Monthly Target » TailAdmin. */
export function OccupancyGauge({ value }: { value: number }) {
  const theme = useChartTheme();
  const safe = Math.max(0, Math.min(100, Number(value) || 0));

  const options: ApexOptions = {
    colors: [palette.gold],
    chart: { fontFamily: "inherit", type: "radialBar", sparkline: { enabled: true } },
    plotOptions: {
      radialBar: {
        startAngle: -85,
        endAngle: 85,
        hollow: { size: "78%" },
        track: { background: theme.track, strokeWidth: "100%", margin: 5 },
        dataLabels: {
          name: { show: false },
          value: {
            fontSize: "34px",
            fontWeight: "600",
            offsetY: -38,
            color: theme.strong,
            formatter: (val: number) => `${Math.round(val)}%`
          }
        }
      }
    },
    fill: {
      type: "gradient",
      gradient: {
        shade: "light",
        type: "horizontal",
        gradientToColors: [palette.olive],
        stops: [0, 100],
        colorStops: [
          { offset: 0, color: palette.goldLight, opacity: 1 },
          { offset: 100, color: palette.oliveLight, opacity: 1 }
        ]
      }
    },
    stroke: { lineCap: "round" },
    labels: ["Occupation"]
  };

  return (
    <div className="max-h-[200px] overflow-hidden">
      <Chart options={options} series={[safe]} type="radialBar" height={330} />
    </div>
  );
}

type StatTab = "overview" | "requests" | "confirmed";

/** Activité mensuelle (aires) — reprise de « Statistics » TailAdmin, avec onglets. */
export function ActivityChart({ requests, confirmed }: { requests: number[]; confirmed: number[] }) {
  const theme = useChartTheme();
  const [tab, setTab] = useState<StatTab>("overview");

  const series = useMemo(() => {
    if (tab === "requests") return [{ name: "Demandes", data: requests }];
    if (tab === "confirmed") return [{ name: "Séjours confirmés", data: confirmed }];
    return [
      { name: "Demandes", data: requests },
      { name: "Séjours confirmés", data: confirmed }
    ];
  }, [tab, requests, confirmed]);

  const colors =
    tab === "requests" ? [palette.gold] : tab === "confirmed" ? [palette.oliveLight] : [palette.gold, palette.oliveLight];

  const options: ApexOptions = {
    colors,
    legend: { show: false },
    chart: { fontFamily: "inherit", type: "area", toolbar: { show: false }, background: "transparent" },
    theme: { mode: theme.mode },
    stroke: { curve: "smooth", width: 2 },
    fill: { type: "gradient", gradient: { opacityFrom: 0.45, opacityTo: 0 } },
    markers: { size: 0, hover: { size: 6 } },
    grid: { borderColor: theme.grid, xaxis: { lines: { show: false } }, yaxis: { lines: { show: true } } },
    dataLabels: { enabled: false },
    tooltip: { theme: theme.mode, shared: true, intersect: false },
    xaxis: {
      type: "category",
      categories: MONTHS,
      axisBorder: { show: false },
      axisTicks: { show: false },
      tooltip: { enabled: false },
      labels: { style: { colors: theme.label } }
    },
    yaxis: { labels: { style: { colors: [theme.label] }, formatter: (val: number) => String(Math.round(val)) } }
  };

  const tabs: { key: StatTab; label: string }[] = [
    { key: "overview", label: "Vue d'ensemble" },
    { key: "requests", label: "Demandes" },
    { key: "confirmed", label: "Confirmés" }
  ];

  return (
    <>
      <div className="mb-4 flex w-full items-center gap-0.5 rounded-lg bg-white/5 p-0.5 sm:w-fit">
        {tabs.map((item) => (
          <button
            key={item.key}
            type="button"
            onClick={() => setTab(item.key)}
            className={cn(
              "flex-1 rounded-md px-3 py-2 text-sm font-medium transition sm:flex-none",
              tab === item.key ? "admin-panel text-cream shadow" : "text-cream/55 hover:text-cream"
            )}
          >
            {item.label}
          </button>
        ))}
      </div>
      <div className="overflow-x-auto">
        <div className="min-w-[760px] xl:min-w-full">
          <Chart options={options} series={series} type="area" height={300} />
        </div>
      </div>
    </>
  );
}

/** Répartition des réservations par catégorie (donut). */
export function CategoryDonut({ labels, values }: { labels: string[]; values: number[] }) {
  const theme = useChartTheme();
  const total = values.reduce((sum, value) => sum + value, 0);

  const options: ApexOptions = {
    labels,
    colors: [palette.gold, palette.oliveLight, palette.terracotta],
    chart: { fontFamily: "inherit", type: "donut", background: "transparent" },
    theme: { mode: theme.mode },
    stroke: { width: 0 },
    dataLabels: { enabled: false },
    legend: { show: false },
    tooltip: { theme: theme.mode },
    plotOptions: {
      pie: {
        donut: {
          size: "72%",
          labels: {
            show: true,
            name: { color: theme.label, offsetY: 18 },
            value: { color: theme.strong, fontSize: "26px", fontWeight: 600, offsetY: -14 },
            total: {
              show: true,
              label: "Réservations",
              color: theme.label,
              formatter: () => String(total)
            }
          }
        }
      }
    }
  };

  return <Chart options={options} series={total > 0 ? values : [0, 0, 0]} type="donut" height={240} />;
}

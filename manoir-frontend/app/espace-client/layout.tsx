import type { Metadata } from "next";
import ClientShell from "@/components/dashboard/client/ClientShell";

export const metadata: Metadata = {
  title: "Espace client | Le Manoir"
};

export default function EspaceClientLayout({ children }: { children: React.ReactNode }) {
  return <ClientShell>{children}</ClientShell>;
}

import type { Metadata } from "next";
import AdminShell from "@/components/dashboard/admin/AdminShell";

export const metadata: Metadata = {
  title: "Back-office | Le Manoir"
};

export default function AdminLayout({ children }: { children: React.ReactNode }) {
  return <AdminShell>{children}</AdminShell>;
}

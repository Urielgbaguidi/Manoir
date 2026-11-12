"use client";

import SecurityPanel from "@/components/account/SecurityPanel";
import { AdminPageHeader } from "@/components/dashboard/admin/AdminShell";

/**
 * Sécurité du compte administrateur : double authentification (fortement
 * recommandée) et appareils connectés.
 */
export default function AdminSecurityPage() {
  return (
    <div className="space-y-6">
      <AdminPageHeader title="Sécurité du compte" />
      <SecurityPanel />
    </div>
  );
}

import { Suspense } from "react";
import InvoiceClient from "./InvoiceClient";

export default function Page() {
  return (
    <Suspense
      fallback={
        <div className="flex h-screen items-center justify-center">Chargement de la facture...</div>
      }
    >
      <InvoiceClient />
    </Suspense>
  );
}

import type { Metadata } from "next";
import NotFoundView from "@/components/ui/NotFoundView";

export const metadata: Metadata = {
  title: "Page introuvable | Le Manoir",
  robots: { index: false }
};

export default function NotFound() {
  return <NotFoundView />;
}

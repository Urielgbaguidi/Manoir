import type { Metadata, Viewport } from "next";
import { Bricolage_Grotesque, Inter } from "next/font/google";
import Footer from "@/components/layout/Footer";
import Navbar from "@/components/layout/Navbar";
import AmbientBackground from "@/components/visual/AmbientBackground";
import { AuthProvider } from "@/context/AuthContext";
import { ToastProvider } from "@/context/ToastContext";
import "./globals.css";

const inter = Inter({
  subsets: ["latin"],
  variable: "--font-body",
  display: "swap"
});

const bricolage = Bricolage_Grotesque({
  subsets: ["latin"],
  variable: "--font-display",
  display: "swap",
  weight: ["400", "500", "600", "700", "800"]
});

export const metadata: Metadata = {
  title: "Le Manoir | Maison d'hôtes de prestige — Cotonou",
  description:
    "Le Manoir, une parenthèse enchantée au cœur de Cotonou. Appartements de prestige, séjours d'exception et réservation en ligne.",
  keywords: ["Le Manoir", "maison d'hôtes", "appartements", "luxe", "Cotonou", "réservation"]
};

export const viewport: Viewport = {
  themeColor: "#120D07"
};

export default function RootLayout({
  children
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="fr" data-theme="dark" className={`${inter.variable} ${bricolage.variable}`}>
      <head>
        <script
          dangerouslySetInnerHTML={{
            __html:
              "(function(){try{var t=localStorage.getItem('theme')||'dark';document.documentElement.setAttribute('data-theme',t);}catch(e){}})();"
          }}
        />
      </head>
      <body className="relative min-h-screen bg-night font-body text-cream/90 antialiased">
        <AmbientBackground />
        <AuthProvider>
          <ToastProvider>
            <Navbar />
            {children}
            <Footer />
          </ToastProvider>
        </AuthProvider>
      </body>
    </html>
  );
}

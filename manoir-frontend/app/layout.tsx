import type { Metadata, Viewport } from "next";
import { Bricolage_Grotesque, Inter } from "next/font/google";
import Footer from "@/components/layout/Footer";
import Navbar from "@/components/layout/Navbar";
import SiteChrome from "@/components/layout/SiteChrome";
import AmbientBackground from "@/components/visual/AmbientBackground";
import NavigationProgress from "@/components/ui/NavigationProgress";
import { AuthProvider } from "@/context/AuthContext";
import { ToastProvider } from "@/context/ToastContext";
import { CONTENT_SECURITY_POLICY } from "@/lib/security";
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
  title: "Le Manoir | Maison d'hôtes de prestige à Cotonou",
  description:
    "Le Manoir, une parenthèse enchantée au cœur de Cotonou. Appartements de prestige, séjours d'exception et réservation en ligne.",
  keywords: ["Le Manoir", "maison d'hôtes", "appartements", "luxe", "Cotonou", "réservation"]
};

export const viewport: Viewport = {
  themeColor: "#F5F0E6"
};

export default function RootLayout({
  children
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html
      lang="fr"
      data-theme="light"
      data-scroll-behavior="smooth"
      suppressHydrationWarning
      className={`${inter.variable} ${bricolage.variable}`}
    >
      <head>
        {/* En dev, `next dev` a besoin d'eval (rechargement à chaud) : la CSP
            ne s'applique qu'au build de production. */}
        {process.env.NODE_ENV === "production" && (
          <meta httpEquiv="Content-Security-Policy" content={CONTENT_SECURITY_POLICY} />
        )}
        <meta name="referrer" content="strict-origin-when-cross-origin" />
        <script
          dangerouslySetInnerHTML={{
            __html:
              "(function(){try{var t=localStorage.getItem('theme')||'light';document.documentElement.setAttribute('data-theme',t);}catch(e){}})();"
          }}
        />
      </head>
      {/*
        suppressHydrationWarning : les extensions de navigateur (gestionnaires de
        mots de passe, correcteurs orthographiques) ajoutent leurs propres
        attributs sur <body> avant que React ne s'hydrate, ce qui declenche a tort
        une erreur de correspondance serveur/client. Ne masque que les attributs de
        cet element, pas les erreurs d'hydratation de ses enfants.
      */}
      <body
        suppressHydrationWarning
        className="relative min-h-screen bg-night font-body text-cream/90 antialiased"
      >
        <AmbientBackground />
        <NavigationProgress />
        <AuthProvider>
          <ToastProvider>
            <SiteChrome>
              <Navbar />
            </SiteChrome>
            {children}
            <SiteChrome>
              <Footer />
            </SiteChrome>
          </ToastProvider>
        </AuthProvider>
      </body>
    </html>
  );
}

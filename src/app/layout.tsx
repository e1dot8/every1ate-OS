import type { Metadata, Viewport } from "next";
import { Arimo, Courier_Prime } from "next/font/google";
import { AppNav } from "@/components/nav/app-nav";
import "./globals.css";

const arimo = Arimo({ variable: "--font-arimo", subsets: ["latin"], display: "swap" });
const courierPrime = Courier_Prime({
  variable: "--font-courier-prime",
  subsets: ["latin"],
  weight: ["400", "700"],
  display: "swap",
});

export const metadata: Metadata = {
  title: { default: "Every1.ate OS", template: "%s · Every1.ate OS" },
  description: "Outil interne de pilotage de l'agence EVERY1.ATE.",
  applicationName: "Every1.ate OS",
  // Application privée : jamais indexée.
  robots: { index: false, follow: false },
  appleWebApp: { capable: true, title: "E1.ATE OS", statusBarStyle: "default" },
  formatDetection: { telephone: false },
};

export const viewport: Viewport = {
  themeColor: "#ffffff",
  width: "device-width",
  initialScale: 1,
  viewportFit: "cover",
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html lang="fr" className={`${arimo.variable} ${courierPrime.variable}`}>
      <body className="min-h-dvh">
        <a
          href="#contenu"
          className="sr-only focus:not-sr-only focus:fixed focus:top-2 focus:left-2 focus:z-50 focus:rounded-md focus:bg-background focus:px-3 focus:py-2"
        >
          Aller au contenu
        </a>
        <div className="md:flex">
          <AppNav />
          <main
            id="contenu"
            className="mx-auto w-full max-w-5xl px-4 pt-6 pb-[calc(var(--bottom-nav-height)+env(safe-area-inset-bottom)+1.5rem)] md:px-8 md:pb-10"
          >
            {children}
          </main>
        </div>
      </body>
    </html>
  );
}

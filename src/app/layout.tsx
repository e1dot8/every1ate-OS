import type { Metadata, Viewport } from "next";
import { Arimo, Courier_Prime } from "next/font/google";
import "./globals.css";
import { PwaManager } from "@/components/pwa/pwa-manager";

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
        <PwaManager />
        {children}
      </body>
    </html>
  );
}

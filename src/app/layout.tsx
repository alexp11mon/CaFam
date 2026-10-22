import type { Metadata, Viewport } from "next";
import { Inter_Tight } from "next/font/google";
import { ServiceWorkerRegister } from "@/components/pwa/service-worker-register";
import "./globals.css";

// One neo-grotesk with tabular figures for every screen (spec 005 plan D1).
const interTight = Inter_Tight({
  variable: "--font-inter-tight",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: { default: "CalenderFam", template: "%s · CalenderFam" },
  // iOS ignores the manifest icons and name (RF-22, plan R7).
  appleWebApp: { capable: true, title: "CaFam", statusBarStyle: "default" },
  icons: { apple: "/icons/apple-touch-icon.png" },
};

// Mobile-first (RF-24): device width, user zoom stays enabled for accessibility.
export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  themeColor: "#2563EB",
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html
      lang="es"
      // Browser extensions (e.g. Dark Reader) add attributes to <html> before hydration.
      suppressHydrationWarning
      className={`${interTight.variable} h-full antialiased`}
    >
      <body className="min-h-full flex flex-col">
        {children}
        <ServiceWorkerRegister />
      </body>
    </html>
  );
}

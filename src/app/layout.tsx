import type { Metadata, Viewport } from "next";
import { Figtree } from "next/font/google";
import { ServiceWorkerRegister } from "@/components/pwa/service-worker-register";
import { THEME_COLOR, THEME_SCRIPT } from "@/lib/theme/theme";
import "./globals.css";

// One friendly geometric family with tabular figures for every screen
// (constitution, amendment 10; spec 025 RF-5, plan D5).
const figtree = Figtree({
  variable: "--font-figtree",
  subsets: ["latin"],
  display: "swap",
});

export const metadata: Metadata = {
  title: { default: "CaFam", template: "%s · CaFam" },
  // iOS ignores the manifest icons and name (RF-22, plan R7).
  appleWebApp: { capable: true, title: "CaFam", statusBarStyle: "default" },
  // The favicon is linked explicitly: the file convention alone left no <link> in the HTML.
  icons: { icon: "/icon.svg", apple: "/icons/apple-touch-icon.png" },
};

// Mobile-first (RF-24): device width, user zoom stays enabled for accessibility.
export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  // The system bar takes the stone ground of each theme; the boot script
  // overrides both with the theme picked (spec 011 RF-11, plan D12).
  themeColor: [
    { media: "(prefers-color-scheme: light)", color: THEME_COLOR.light },
    { media: "(prefers-color-scheme: dark)", color: THEME_COLOR.dark },
  ],
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html
      lang="es"
      // Browser extensions (e.g. Dark Reader) add attributes to <html> before hydration.
      suppressHydrationWarning
      className={`${figtree.variable} h-full antialiased`}
    >
      <head>
        {/* Before the first paint, so the theme never flashes (spec 011 RF-7). */}
        <script dangerouslySetInnerHTML={{ __html: THEME_SCRIPT }} />
      </head>
      <body className="min-h-full flex flex-col">
        {children}
        <ServiceWorkerRegister />
      </body>
    </html>
  );
}

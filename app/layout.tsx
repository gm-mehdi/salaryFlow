import type { Metadata, Viewport } from "next";
import { Sora } from "next/font/google";
import { Providers } from "./providers";
import { PwaRegister } from "./pwa-register";
import "./globals.css";

const sora = Sora({
  subsets: ["latin"],
  weight: ["400", "500", "600", "700", "800"],
  variable: "--font-sora",
  display: "swap",
});

export const metadata: Metadata = {
  title: "SalaryFlow",
  description: "Personal salary and expense manager",
  applicationName: "SalaryFlow",
  appleWebApp: {
    capable: true,
    statusBarStyle: "default",
    title: "SalaryFlow",
  },
  formatDetection: {
    telephone: false,
  },
  icons: {
    icon: [
      { url: "/icons/icon-192.png", sizes: "192x192", type: "image/png" },
      { url: "/icons/icon-512.png", sizes: "512x512", type: "image/png" },
    ],
    apple: [{ url: "/icons/apple-touch-icon.png", sizes: "180x180", type: "image/png" }],
  },
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  viewportFit: "cover",
  colorScheme: "light dark",
  themeColor: [
    { media: "(prefers-color-scheme: light)", color: "#0e6b5c" },
    { media: "(prefers-color-scheme: dark)", color: "#0d1512" },
  ],
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" className={sora.variable}>
      <body>
        <Providers>
          <div className="hatch-space-root" data-hatch-space-root="">
            {children}
          </div>
          <PwaRegister />
        </Providers>
      </body>
    </html>
  );
}

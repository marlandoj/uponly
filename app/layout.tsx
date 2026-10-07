import type { Metadata, Viewport } from "next";
import { Press_Start_2P } from "next/font/google";
import ArcadeBackground from "./components/ArcadeBackground";
import "./globals.css";

const pixel = Press_Start_2P({ weight: "400", subsets: ["latin"], display: "swap", variable: "--font-pixel" });

export const metadata: Metadata = {
  title: "UpOnly",
  description: "Positive-only chore game. Your chore level only ever rises.",
  appleWebApp: { capable: true, title: "UpOnly", statusBarStyle: "default" },
  icons: { apple: "/icons/apple-touch-icon.png" },
};

export const viewport: Viewport = {
  themeColor: "#0a0a18",
  width: "device-width",
  initialScale: 1,
  viewportFit: "cover",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" className={pixel.variable}>
      <body>
        <ArcadeBackground />
        <main className="shell">{children}</main>
      </body>
    </html>
  );
}

import type { Metadata, Viewport } from "next";
import { Black_Ops_One, Press_Start_2P, Russo_One } from "next/font/google";
import Link from "next/link";
import "./globals.css";

// Display: stencil (tactical) · UI: chunky block sans · Accents: pixel
const stencil = Black_Ops_One({ weight: "400", subsets: ["latin"], display: "swap", variable: "--font-stencil" });
const chunky = Russo_One({ weight: "400", subsets: ["latin"], display: "swap", variable: "--font-chunky" });
const pixel = Press_Start_2P({ weight: "400", subsets: ["latin"], display: "swap", variable: "--font-pixel" });

export const metadata: Metadata = {
  title: "ChoreQuest",
  description: "Real-life chores, epic in-game loot. The chore game where your level only ever rises.",
  appleWebApp: { capable: true, title: "ChoreQuest", statusBarStyle: "default" },
  icons: { apple: "/icons/apple-touch-icon.png" },
};

export const viewport: Viewport = {
  themeColor: "#0b0f0c",
  width: "device-width",
  initialScale: 1,
  viewportFit: "cover",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" className={`${stencil.variable} ${chunky.variable} ${pixel.variable}`}>
      <body>
        <header className="brand-bar">
          <Link href="/" className="wordmark" aria-label="ChoreQuest home">
            <span className="logo-blocks" aria-hidden="true">
              <i />
              <i />
              <i />
              <i />
            </span>
            <span>
              Chore<b>Quest</b>
            </span>
          </Link>
          <span className="tagline">Real-life chores, EPIC in-game loot.</span>
        </header>
        <main className="shell">{children}</main>
      </body>
    </html>
  );
}

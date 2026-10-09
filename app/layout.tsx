import type { Metadata, Viewport } from "next";
import { Black_Ops_One, Press_Start_2P, Russo_One } from "next/font/google";
import Link from "next/link";
import ChoreCrew from "./ChoreCrew";
import MusicToggle from "./MusicToggle";
import SfxClicks from "./SfxClicks";
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
  openGraph: {
    title: "ChoreQuest",
    description: "Real-life chores, EPIC in-game loot. Do the chore, earn the drop.",
    type: "website",
  },
  twitter: {
    card: "summary_large_image",
    title: "ChoreQuest",
    description: "Real-life chores, EPIC in-game loot. Do the chore, earn the drop.",
  },
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
        <ChoreCrew />
        <SfxClicks />
        <header className="brand-bar">
          <Link href="/" className="wordmark" aria-label="ChoreQuest home">
            {/* eslint-disable-next-line @next/next/no-img-element -- static brand logo */}
            <img src="/img/logo.webp" alt="ChoreQuest" width={240} height={80} className="brand-logo" />
          </Link>
          <span className="tagline">Real-life chores, EPIC in-game loot.</span>
        </header>
        <main className="shell">{children}</main>
        <MusicToggle />
      </body>
    </html>
  );
}

import "@/app/globals.css";

const SITE_URL =
  process.env.NEXT_PUBLIC_SITE_URL ?? "https://wastelens-global.vercel.app";

export const metadata = {
  metadataBase: new URL(SITE_URL),
  title: "WasteLens Global — Statutory Waste Compliance",
  description:
    "Photograph waste, get the statute. Perception proposes. The law decides. Deterministic corpus lookups — India SWM 2026, NYC Local Law 19 of 1989 (§16-301 et seq.), England SI 2025/140.",
  openGraph: {
    title: "WasteLens Global — Statutory Waste Compliance",
    description: "Perception proposes. The law decides.",
    url: SITE_URL,
    siteName: "WasteLens Global",
    locale: "en_US",
    type: "website",
  },
  twitter: {
    card: "summary_large_image",
    title: "WasteLens Global — Statutory Waste Compliance",
    description: "Perception proposes. The law decides.",
  },
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body className="font-sans antialiased">{children}</body>
    </html>
  );
}
import "@/app/globals.css";

export const metadata = {
  title: "WasteLens Global — Statutory Waste Compliance",
  description: "Perception proposes. The law decides.",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body className="font-sans antialiased">{children}</body>
    </html>
  );
}
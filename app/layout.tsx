import "@/app/globals.css";
import { Inter } from "next/font/google";
const inter = Inter({ subsets: ["latin"] });
export const metadata = {
  title: "WasteLens Global — Statutory Waste Compliance",
  description: "Perception proposes. The law decides.",
};
export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body className={inter.className}>{children}</body>
    </html>
  );
}

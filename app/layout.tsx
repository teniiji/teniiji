import type { Metadata } from "next";
import { Sarabun } from "next/font/google";
import "./globals.css";

const sarabun = Sarabun({
  variable: "--font-sarabun",
  subsets: ["thai", "latin"],
  weight: ["400", "500", "600", "700"],
});

export const metadata: Metadata = {
  title: "แอปบริหารสหกรณ์ออมทรัพย์ครู",
  description: "ระบบเงินฝาก-หุ้น-เงินกู้ของสมาชิก (MVP โมดูล 1)",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="th" className={`${sarabun.variable} antialiased`}>
      <body className="min-h-screen bg-paper text-ink">{children}</body>
    </html>
  );
}

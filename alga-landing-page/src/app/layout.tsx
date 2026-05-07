import type { Metadata } from "next";
import { Inter } from "next/font/google";
import "./globals.css";

const inter = Inter({ subsets: ["latin"], variable: "--font-sans" });

export const metadata: Metadata = {
  title: "Alga | The Ultimate Retro Emulator Launcher",
  description: "Experience your favorite GBA, NDS, and 3DS games on Android with precision, speed, and a beautiful interface.",
  keywords: ["emulator", "android", "GBA", "NDS", "3DS", "retro gaming", "RetroArch", "Alga"],
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" className="dark">
      <body className={`${inter.variable} font-sans antialiased`}>
        {children}
      </body>
    </html>
  );
}

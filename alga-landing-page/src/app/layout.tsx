import type { Metadata } from "next";
import { Inter } from "next/font/google";
import "./globals.css";

const inter = Inter({ subsets: ["latin"], variable: "--font-sans" });

export const metadata: Metadata = {
  title: "Alga Emulator | Trình giả lập Game Retro đỉnh cao trên Android",
  description: "Trải nghiệm mượt mà các dòng game GBA, NDS, 3DS và nhiều hệ máy khác ngay trên điện thoại Android của bạn với giao diện hiện đại và tốc độ tối ưu.",
  keywords: ["giả lập", "android emulator", "GBA", "NDS", "3DS", "retro gaming", "Alga Emulator", "chơi game retro"],
  openGraph: {
    title: "Alga Emulator | Trình giả lập Game Retro đỉnh cao trên Android",
    description: "Trải nghiệm mượt mà các dòng game cổ điển với tốc độ tối ưu và giao diện tuyệt đẹp.",
    images: [{ url: "/shop.avif" }],
  }
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

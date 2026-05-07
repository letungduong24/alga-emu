"use client";

import Link from "next/link";

export default function Navbar() {
  return (
    <nav className="fixed top-0 w-full z-50 glass">
      <div className="container mx-auto px-4 h-16 flex items-center justify-between">
        <Link href="/" className="flex items-center gap-2">
          <span className="text-xl font-bold tracking-tight text-white">ALGA</span>
        </Link>
        
        <div className="flex items-center gap-6 md:gap-8">
          <Link href="#features" className="text-sm font-medium text-slate-300 hover:text-white transition-colors">Tính năng</Link>
          <Link href="#emulators" className="text-sm font-medium text-slate-300 hover:text-white transition-colors">Giả lập</Link>
          <Link href="#download" className="text-sm font-medium text-slate-300 hover:text-white transition-colors">Tải về</Link>
        </div>
      </div>
    </nav>
  );
}

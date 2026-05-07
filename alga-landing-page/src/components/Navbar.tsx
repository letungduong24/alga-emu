"use client";

import Link from "next/link";

export default function Navbar() {
  return (
    <nav className="fixed top-0 w-full z-50 glass px-6">
      <div className="mx-auto h-20 flex items-center justify-between max-w-[1400px]">
        {/* Left Section - Text Logo */}
        <Link href="/" className="text-2xl font-black text-white tracking-tighter">
          Alga
        </Link>

        {/* Right Section - Navigation Links */}
        <div className="flex items-center gap-8">
          <Link href="/" className="text-sm font-bold text-slate-400 hover:text-white transition-colors uppercase tracking-widest">Trang chủ</Link>
          <Link href="#features" className="text-sm font-bold text-slate-400 hover:text-white transition-colors uppercase tracking-widest">Tính năng</Link>
          <Link href="#download" className="text-sm font-bold text-slate-400 hover:text-white transition-colors uppercase tracking-widest">Tải về</Link>
        </div>
      </div>
    </nav>
  );
}

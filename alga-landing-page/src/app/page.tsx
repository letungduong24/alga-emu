"use client";

import { useState, useEffect } from "react";
import { motion } from "framer-motion";
import Image from "next/image";
import { 
  Download,
  Star
} from "lucide-react";
import Navbar from "@/components/Navbar";

const games = [
  {
    id: "zelda",
    title: "Zelda",
    image: "/zelda.avif",
    color: "bg-purple-600",
    tilt: -15,
    x: -440,
    y: 40,
    z: 10
  },
  {
    id: "mario",
    title: "Mario",
    image: "/mario_card1.png",
    color: "bg-rose-500",
    tilt: -10,
    x: -220,
    y: 20,
    z: 20
  },
  {
    id: "kirby",
    title: "Kirby",
    image: "/kirby_card.png",
    color: "bg-sky-500",
    tilt: 0,
    x: 0,
    y: 0,
    z: 30,
    active: true
  },
  {
    id: "pokemon",
    title: "Pokemon",
    image: "/pokemon_card2.png",
    color: "bg-emerald-500",
    tilt: 10,
    x: 220,
    y: 20,
    z: 20
  },
  {
    id: "dragonball",
    title: "Dragon Ball",
    image: "/dragonball.avif",
    color: "bg-blue-600",
    tilt: 15,
    x: 440,
    y: 40,
    z: 10
  }
];

export default function LandingPage() {
  const [isMobile, setIsMobile] = useState(false);

  useEffect(() => {
    const checkMobile = () => setIsMobile(window.innerWidth < 1024);
    checkMobile();
    window.addEventListener("resize", checkMobile);
    return () => window.removeEventListener("resize", checkMobile);
  }, []);
  return (
    <div className="min-h-screen bg-[#0a0a0a] text-white selection:bg-blue-500/30 overflow-hidden font-sans">
      <Navbar />

      <main className="relative bg-grid min-h-screen flex flex-col items-center pt-32">
        {/* Hero Section */}
        <section className="relative z-10 text-center px-4 max-w-4xl">
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.8 }}
          >
            <h1 className="text-6xl md:text-8xl font-black mb-8 tracking-tighter text-glow">
              Chơi Game Cực Đã<br />
              <span className="text-white">Cùng Alga</span>
            </h1>
            
            <p className="text-slate-400 text-sm md:text-base max-w-lg mx-auto leading-relaxed mb-8 opacity-80">
              Khám phá bộ sưu tập trò chơi kinh điển được tuyển chọn kỹ lưỡng. Trải nghiệm mượt mà mọi hệ máy giả lập bạn yêu thích ngay trên Android.
            </p>
          </motion.div>
        </section>

        {/* Carousel Section */}
        <section className="relative w-full mt-4 md:mt-10 pb-12 md:pb-20">
          <div className="relative flex justify-center items-end h-[350px] md:h-[500px] max-w-[1400px] mx-auto px-4">
            {games.map((game, i) => (
              <motion.div
                key={game.id}
                initial={{ opacity: 0, scale: 0.8, x: isMobile ? game.x / 4 : game.x, y: 100 }}
                animate={{ 
                  opacity: 1, 
                  scale: isMobile ? (game.active ? 0.85 : 0.65) : (game.active ? 1.05 : 0.9), 
                  x: isMobile ? (game.x / 4.5) : game.x, 
                  y: isMobile ? (game.active ? -10 : game.y / 2) : (game.active ? -20 : game.y),
                  rotate: isMobile ? game.tilt / 1.5 : game.tilt,
                  zIndex: game.z
                }}
                whileHover={{ 
                  y: isMobile ? -20 : (game.active ? -40 : game.y - 20),
                  scale: isMobile ? (game.active ? 0.9 : 0.7) : (game.active ? 1.1 : 0.95),
                  transition: { duration: 0.3 }
                }}
                className={`absolute w-[180px] md:w-[280px] h-[260px] md:h-[400px] rounded-[30px] md:rounded-[40px] overflow-hidden card-shadow cursor-pointer group`}
                style={{ WebkitMaskImage: "-webkit-radial-gradient(white, black)", transform: "translateZ(0)" }}
              >
                {/* Card Background */}
                <div className={`absolute inset-0 ${game.color} opacity-90 group-hover:opacity-100 transition-opacity`} />
                
                {/* Game Image */}
                <div className="absolute inset-0 flex items-center justify-center p-4">
                  <Image 
                    src={game.image} 
                    alt={game.title} 
                    fill 
                    className="object-cover transform group-hover:scale-110 transition-transform duration-500"
                  />
                </div>

                {/* Card Content Overlay */}
                <div className="absolute inset-0 bg-gradient-to-t from-black/60 via-transparent to-transparent" />
                
                <div className="absolute top-6 left-6 right-6">
                  <div className="flex justify-between items-start">
                    <div>
                      <h3 className="bg-black/20 backdrop-blur-sm rounded-full px-3 py-1 text-2xl font-black text-white leading-none mb-1">{game.title}</h3>
                    </div>
                  </div>
                </div>

                {/* Bottom Icon */}
                <div className="absolute bottom-6 left-6">
                  <div className="w-8 h-8 rounded-full bg-white/20 backdrop-blur-md flex items-center justify-center">
                    <Star className="w-4 h-4 text-white fill-white" />
                  </div>
                </div>
              </motion.div>
            ))}
          </div>

          {/* Download CTA */}
          <motion.div 
            initial={{ opacity: 0 }}
            whileInView={{ opacity: 1 }}
            className="flex justify-center mt-20"
          >
            <a href="https://duongle.dev/app-release.apk" download="alga-emulator.apk">
              <button className="bg-white text-black font-black px-12 py-5 rounded-full text-xl hover:scale-105 active:scale-95 transition-all flex items-center gap-3 card-shadow">
                TẢI ALGA APK
                <Download className="w-6 h-6" />
              </button>
            </a>
          </motion.div>
        </section>

        {/* Introduction Section - Supported Emulators */}
        <section id="features" className="w-full py-20 relative">
          <div className="max-w-[1200px] mx-auto px-6">
            <div className="text-center mb-20">
              <h2 className="text-4xl md:text-5xl font-black mb-6 tracking-tight">Hệ máy hỗ trợ</h2>
              <p className="text-slate-400 max-w-2xl mx-auto">Alga mang đến trải nghiệm giả lập mượt mà nhất trên Android .</p>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-12">
              {[
                { image: "/emu_3ds.png", name: "Nintendo 3DS" },
                { image: "/emu_nds.png", name: "Nintendo DS" },
                { image: "/emu_gba.png", name: "Game Boy Advance" }
              ].map((emu, i) => (
                <motion.div
                  key={i}
                  initial={{ opacity: 0, scale: 0.9 }}
                  whileInView={{ opacity: 1, scale: 1 }}
                  transition={{ delay: i * 0.1 }}
                  className="text-center group"
                >
                  <div className="relative aspect-square mb-6 overflow-hidden rounded-[40px] bg-white/5 border border-white/10 flex items-center justify-center p-8 group-hover:bg-white/[0.08] transition-all">
                    <Image src={emu.image} alt={emu.name} fill className="object-contain p-10 transform group-hover:scale-110 transition-all duration-500" />
                  </div>
                  <p className="text-slate-200 text-lg font-bold tracking-tight">{emu.name}</p>
                </motion.div>
              ))}
            </div>

            <div className="mt-16 text-center">
              <div className="inline-block bg-white/5 rounded-full px-6 py-3 border border-white/5">
                <p className="text-sm font-bold text-slate-400">
                  Sắp ra mắt: <span className="text-white">PSP, PS1, N64, GameCube</span> và nhiều hệ máy khác...
                </p>
              </div>
            </div>
          </div>
        </section>

        {/* Gamepad Support Section */}
        <section className="w-full py-12 md:py-20 relative">
          <div className="max-w-[1200px] mx-auto px-6 flex flex-col md:flex-row-reverse items-center gap-10 md:gap-20">
            <div className="flex-1 text-center md:text-left">
              <h2 className="text-4xl md:text-5xl font-black mb-6 md:mb-8 tracking-tighter">Hỗ trợ tay cầm</h2>
              <p className="text-lg md:text-xl text-slate-400 max-w-xl leading-relaxed">
                Trải nghiệm chơi game chuyên nghiệp với khả năng hỗ trợ tay cầm toàn diện. Tương thích hoàn hảo với GameSir, Xbox, DualShock và nhiều thiết bị ngoại vi khác. Chỉ cần cắm và chạy.
              </p>
            </div>
            <div className="flex-1 w-full relative group">
              <div className="w-full aspect-video bg-white/5 rounded-[30px] md:rounded-[40px] overflow-hidden relative shadow-2xl">
                <Image 
                  src="/gamesir.jpg" 
                  alt="Gamepad Support" 
                  fill 
                  className="object-cover transform group-hover:scale-105 transition-transform duration-700" 
                />
              </div>
            </div>
          </div>
        </section>

        {/* Store Section - Normal Info Section */}
        <section className="w-full py-12 md:py-20 relative">
          <div className="max-w-[1200px] mx-auto px-6 flex flex-col md:flex-row items-center gap-10 md:gap-20">
            <div className="flex-1 text-center md:text-left">
              <h2 className="text-4xl md:text-5xl font-black mb-6 md:mb-8 tracking-tighter">Alga Store</h2>
              <p className="text-lg md:text-xl text-slate-400 max-w-xl leading-relaxed">
                Khám phá kho tàng game retro khổng lồ. Tải trực tiếp, quản lý thư viện và cập nhật metadata chỉ với một cú chạm. Hệ thống server tốc độ cao đảm bảo trải nghiệm tải game không gián đoạn.
              </p>
            </div>
            <div className="flex-1 w-full relative group">
              <div className="w-full aspect-video bg-gradient-to-br from-blue-600/20 to-indigo-600/20 rounded-[30px] md:rounded-[40px] border border-white/10 overflow-hidden relative shadow-2xl shadow-blue-500/10">
                <Image 
                  src="/shop.avif" 
                  alt="Alga Store" 
                  fill 
                  className="object-cover transform group-hover:scale-105 transition-transform duration-700" 
                />
                <div className="absolute inset-0 bg-gradient-to-t from-black/20 to-transparent" />
              </div>
            </div>
          </div>
        </section>

        {/* Main CTA Section - Download APK */}
        <section id="download" className="w-full py-12 md:py-20 mb-10">
          <div className="max-w-[1200px] mx-auto px-6">
            <div className="bg-gradient-to-br from-blue-600 to-indigo-700 rounded-[40px] md:rounded-[60px] p-10 md:p-24 text-center relative overflow-hidden shadow-2xl shadow-blue-900/40">
              <div className="absolute top-0 right-0 w-[500px] h-[500px] bg-white/10 blur-[120px] rounded-full translate-x-1/2 -translate-y-1/2" />
              
              <div className="relative z-10">
                <h2 className="text-3xl md:text-6xl font-black text-white mb-6 md:mb-8">Sẵn sàng chơi chưa?</h2>
                <p className="text-blue-100 text-base md:text-lg mb-8 md:mb-12 max-w-xl mx-auto leading-relaxed">Tải bản Alga APK mới nhất ngay bây giờ và bắt đầu hành trình retro của bạn.</p>
                <a 
                  href="https://duongle.dev/app-release.apk" 
                  download="alga-emulator.apk"
                >
                  <button className="bg-white text-blue-600 font-black px-8 md:px-12 py-4 md:py-5 rounded-full text-lg md:text-xl hover:scale-105 active:scale-95 transition-all shadow-xl">
                    TẢI APK NGAY
                  </button>
                </a>
              </div>
            </div>
          </div>
        </section>
      </main>

      <footer className="py-10 border-t border-white/5 bg-[#0a0a0a]">
        <div className="max-w-[1400px] mx-auto px-6 flex flex-col md:flex-row justify-center items-center gap-6 text-center">
          <div className="flex items-center gap-4 opacity-50">
             <span className="text-xl font-black tracking-tighter text-white">Alga</span>
             <span className="text-xs font-bold tracking-widest uppercase">Project © 2026</span>
          </div>
        </div>
      </footer>
    </div>
  );
}

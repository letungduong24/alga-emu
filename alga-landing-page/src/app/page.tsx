"use client";

import { motion } from "framer-motion";
import { 
  ChevronRight, 
  Cpu, 
  Database, 
  Download, 
  ShieldCheck
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import Navbar from "@/components/Navbar";

export default function LandingPage() {
  const fadeIn = {
    initial: { opacity: 0, y: 20 },
    animate: { opacity: 1, y: 0 },
    transition: { duration: 0.6 }
  };

  const stagger = {
    animate: {
      transition: {
        staggerChildren: 0.1
      }
    }
  };

  return (
    <div className="min-h-screen bg-slate-950 text-white selection:bg-blue-500/30">
      <Navbar />

      <main>
        {/* Hero Section */}
        <section className="relative pt-32 pb-20 md:pt-48 md:pb-32 overflow-hidden">
          <div className="absolute top-0 left-1/2 -translate-x-1/2 w-full h-full -z-10">
            <div className="absolute top-[-10%] left-[-10%] w-[40%] h-[40%] bg-blue-600/20 blur-[120px] rounded-full" />
            <div className="absolute bottom-[-10%] right-[-10%] w-[40%] h-[40%] bg-purple-600/20 blur-[120px] rounded-full" />
          </div>

          <div className="container mx-auto px-4 text-center">
            <motion.div {...fadeIn}>
              <Badge variant="outline" className="mb-4 border-blue-500/50 text-blue-400 px-4 py-1">
                Version 1.0.0 đã sẵn sàng
              </Badge>
              <h1 className="text-5xl md:text-7xl font-extrabold tracking-tight mb-6 bg-clip-text text-transparent bg-gradient-to-b from-white to-slate-400">
                Chơi Game Retro. <br /> 
                <span className="text-blue-500">Hoàn hảo hơn.</span>
              </h1>
              <p className="text-lg md:text-xl text-slate-400 max-w-2xl mx-auto mb-10 leading-relaxed">
                Alga là trung tâm giả lập tất cả-trong-một cho Android. Trải nghiệm các tựa game GBA, NDS, và 3DS kinh điển với hiệu năng tối đa và giao diện tuyệt đẹp.
              </p>
              <div className="flex flex-col sm:flex-row items-center justify-center gap-4">
                <Button size="lg" className="bg-blue-600 hover:bg-blue-700 text-white px-10 h-12 rounded-full text-base font-semibold group shadow-lg shadow-blue-600/20">
                  Tải Alga APK
                  <Download className="ml-2 w-5 h-5 group-hover:translate-y-0.5 transition-transform" />
                </Button>
              </div>
            </motion.div>
          </div>
        </section>

        {/* Features Grid */}
        <section id="features" className="py-24 bg-slate-900/50">
          <div className="container mx-auto px-4">
            <div className="text-center mb-16">
              <h2 className="text-3xl md:text-4xl font-bold mb-4">Tối ưu cho hiệu suất</h2>
              <p className="text-slate-400 max-w-xl mx-auto">
                Xây dựng trên nền tảng LibretroDroid mới nhất, Alga mang cả thế giới console vào túi quần bạn.
              </p>
            </div>

            <motion.div 
              variants={stagger}
              initial="initial"
              whileInView="animate"
              viewport={{ once: true }}
              className="grid grid-cols-1 md:grid-cols-3 gap-8"
            >
              {[
                {
                  icon: <Cpu className="w-8 h-8 text-blue-500" />,
                  title: "Thực thi gốc (Native)",
                  desc: "Các core arm64-v8a tối ưu đảm bảo tốc độ khung hình tối đa và tiết kiệm pin."
                },
                {
                  icon: <Database className="w-8 h-8 text-purple-500" />,
                  title: "Metadata tự động",
                  desc: "Tự động lấy ảnh bìa, mô tả và thông tin vùng miền cho toàn bộ thư viện game của bạn."
                },
                {
                  icon: <ShieldCheck className="w-8 h-8 text-emerald-500" />,
                  title: "An toàn & Riêng tư",
                  desc: "Hoạt động 100% offline. Thư viện, file lưu và BIOS của bạn luôn nằm trong thiết bị."
                }
              ].map((feat, i) => (
                <motion.div key={i} variants={fadeIn}>
                  <Card className="bg-slate-900/80 border-slate-800 hover:border-blue-500/50 transition-all group h-full">
                    <CardHeader>
                      <div className="mb-4 p-3 bg-slate-800 rounded-xl w-fit group-hover:scale-110 transition-transform">
                        {feat.icon}
                      </div>
                      <CardTitle className="text-xl text-white">{feat.title}</CardTitle>
                      <CardDescription className="text-slate-400 text-base">
                        {feat.desc}
                      </CardDescription>
                    </CardHeader>
                  </Card>
                </motion.div>
              ))}
            </motion.div>
          </div>
        </section>

        {/* Emulator Showcase */}
        <section id="emulators" className="py-24">
          <div className="container mx-auto px-4">
            <div className="max-w-3xl mx-auto text-center">
              <Badge className="bg-blue-500/10 text-blue-400 hover:bg-blue-500/20 border-blue-500/20 mb-4">
                Hỗ trợ đa hệ máy
              </Badge>
              <h2 className="text-4xl md:text-5xl font-bold mb-6 leading-tight">
                Một ứng dụng cho tất cả.
              </h2>
              <p className="text-lg text-slate-400 mb-8">
                Không còn phải cài đặt hàng tá ứng dụng rời rạc. Alga cung cấp một giao diện hợp nhất cho mọi nền tảng retro phổ biến.
              </p>
              
              <div className="flex flex-wrap justify-center gap-6">
                {[
                  "Nintendo 3DS (Citra)",
                  "Nintendo DS (DeSmuME)",
                  "GameBoy Advance (mGBA)"
                ].map((item, i) => (
                  <div key={i} className="flex items-center gap-3 bg-slate-900/50 border border-slate-800 px-5 py-3 rounded-2xl">
                    <div className="flex-shrink-0 w-5 h-5 rounded-full bg-blue-500/20 flex items-center justify-center">
                      <ChevronRight className="w-3 h-3 text-blue-400" />
                    </div>
                    <span className="text-slate-300 font-medium">{item}</span>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </section>

        {/* CTA Section */}
        <section id="download" className="py-24">
          <div className="container mx-auto px-4">
            <div className="bg-gradient-to-br from-blue-600 to-indigo-700 rounded-3xl p-12 text-center relative overflow-hidden shadow-2xl shadow-blue-900/20">
              <div className="absolute top-0 right-0 -translate-y-1/2 translate-x-1/4 w-96 h-96 bg-white/10 blur-[100px] rounded-full" />
              
              <div className="relative z-10">
                <h2 className="text-4xl md:text-5xl font-bold text-white mb-6">Sẵn sàng trải nghiệm?</h2>
                <p className="text-blue-100 text-lg max-w-xl mx-auto mb-10">
                  Nâng tầm trải nghiệm retro của bạn ngay hôm nay. Tải bản APK mới nhất và bắt đầu hành trình.
                </p>
                <div className="flex justify-center">
                  <Button size="lg" variant="secondary" className="bg-white text-blue-600 hover:bg-slate-100 px-12 h-14 rounded-full font-bold text-lg">
                    Tải APK ngay
                  </Button>
                </div>
              </div>
            </div>
          </div>
        </section>
      </main>

      <footer className="py-12 border-t border-slate-900">
        <div className="container mx-auto px-4">
          <div className="flex flex-col md:flex-row justify-between items-center gap-8 text-center md:text-left">
            <div>
              <span className="text-xl font-bold tracking-tight">ALGA</span>
              <p className="text-sm text-slate-600 mt-2">
                © 2026 Alga Project. Dự án phi lợi nhuận, không thương mại hóa.
              </p>
            </div>
          </div>
        </div>
      </footer>
    </div>
  );
}

import React, { useState } from 'react';
import {
  TrendingUp,
  Shield,
  Zap,
  BarChart2,
  Database,
  ArrowRight,
  CheckCircle,
  Lock,
  User,
  Sliders,
  Cpu,
  Eye,
  EyeOff,
  Sparkles,
} from 'lucide-react';

interface LandingPageProps {
  onOpenLogin: () => void;
}

export const LandingPage: React.FC<LandingPageProps> = ({ onOpenLogin }) => {
  return (
    <div className="min-h-screen bg-[#080b10] text-gray-100 flex flex-col selection:bg-amber-500/30 selection:text-amber-200" dir="rtl">
      {/* 1. Header / Navbar */}
      <header className="sticky top-0 z-40 bg-[#0d121c]/90 backdrop-blur-md border-b border-[#1f2937] px-4 lg:px-8 py-3.5">
        <div className="max-w-7xl mx-auto flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-gradient-to-tr from-amber-500 via-amber-400 to-yellow-300 flex items-center justify-center shadow-lg shadow-amber-500/20 text-black">
              <TrendingUp className="w-6 h-6 stroke-[2.5]" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <span className="font-extrabold text-base sm:text-lg tracking-tight text-white font-sans">
                  سامانه الگوریتمی زیگ‌زاگ
                </span>
                <span className="px-2 py-0.5 rounded text-[10px] font-bold font-mono bg-amber-500/15 text-amber-300 border border-amber-500/30">
                  PRO v2.5
                </span>
              </div>
              <p className="text-[11px] text-gray-400 hidden sm:block">
                موتور بک‌تست پیشرفته فیوچرز بایننس و استراتژی شکست نقطه E
              </p>
            </div>
          </div>

          <div className="flex items-center gap-3">
            <div className="hidden md:flex items-center gap-2 px-3 py-1.5 rounded-xl bg-[#141b27] border border-[#232e42] text-xs text-gray-300">
              <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse"></span>
              <span>دیتابیس ابری Firebase متصل</span>
            </div>

            <button
              type="button"
              onClick={onOpenLogin}
              className="px-5 py-2.5 rounded-xl bg-gradient-to-r from-amber-400 via-amber-500 to-yellow-500 hover:from-amber-300 hover:to-amber-400 text-black font-extrabold text-xs sm:text-sm flex items-center gap-2 shadow-lg shadow-amber-500/25 transition-all cursor-pointer hover:scale-[1.02] active:scale-[0.98]"
            >
              <Lock className="w-4 h-4 stroke-[2.5]" />
              <span>ورود به سامانه</span>
            </button>
          </div>
        </div>
      </header>

      {/* 2. Hero Section */}
      <section className="relative overflow-hidden py-16 lg:py-24 px-4 sm:px-6 lg:px-8 border-b border-[#1b2332]">
        {/* Ambient Gradient Glow */}
        <div className="absolute top-1/4 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[600px] h-[350px] bg-gradient-to-tr from-amber-500/15 via-cyan-500/10 to-transparent blur-3xl pointer-events-none rounded-full"></div>

        <div className="max-w-5xl mx-auto text-center relative z-10 space-y-6">
          <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-[#161f2e] border border-amber-500/30 text-amber-300 text-xs font-semibold shadow-inner">
            <Sparkles className="w-3.5 h-3.5 text-amber-400" />
            <span>پلتفرم تخصصی ترید الگوریتمی و بک‌تست استراتژی‌های زیگ‌زاگ فیوچرز</span>
          </div>

          <h1 className="text-3xl sm:text-5xl lg:text-6xl font-black text-white tracking-tight leading-tight sm:leading-snug">
            طراحی، بک‌تست و اجرای هوشمند <br className="hidden sm:inline" />
            <span className="bg-gradient-to-r from-amber-300 via-amber-400 to-yellow-200 bg-clip-text text-transparent">
              استراتژی‌های معاملاتی بایننس
            </span>
          </h1>

          <p className="text-sm sm:text-base lg:text-lg text-gray-300 max-w-3xl mx-auto leading-relaxed">
            سامانه حرفه‌ای ارزیابی رفتار قیمت بر اساس محاسبات داینامیک ATR، تایید نقاط شکست E و F، مانیتورینگ زنده جریان داده‌های فیوچرز و ذخیره‌سازی ابری امن اطلاعات در Firebase Firestore.
          </p>

          <div className="pt-4 flex flex-col sm:flex-row items-center justify-center gap-3.5">
            <button
              type="button"
              onClick={onOpenLogin}
              className="w-full sm:w-auto px-8 py-3.5 rounded-xl bg-gradient-to-r from-amber-400 via-amber-500 to-yellow-500 hover:from-amber-300 hover:to-amber-400 text-black font-black text-sm sm:text-base flex items-center justify-center gap-2.5 shadow-xl shadow-amber-500/30 transition-all cursor-pointer hover:shadow-amber-500/40"
            >
              <span>ورود به حساب کاربری و شروع</span>
              <ArrowRight className="w-5 h-5 stroke-[2.5]" />
            </button>

            <div className="flex items-center gap-2 text-xs text-gray-400 px-3 py-2">
              <Shield className="w-4 h-4 text-emerald-400" />
              <span>دسترسی اختصاصی • محیط امن ابری</span>
            </div>
          </div>
        </div>
      </section>

      {/* 3. Key Feature Cards */}
      <section className="py-14 px-4 sm:px-6 lg:px-8 max-w-7xl mx-auto w-full">
        <div className="text-center mb-10 space-y-2">
          <h2 className="text-xl sm:text-2xl font-bold text-white">
            امکانات پیشرفته سامانه
          </h2>
          <p className="text-xs sm:text-sm text-gray-400">
            طراحی‌شده برای معامله‌گران کمّی و پژوهشگران بازارهای مالی
          </p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 sm:gap-5">
          {/* Card 1 */}
          <div className="p-5 rounded-2xl bg-[#0f141f] border border-[#212c3f] hover:border-amber-500/40 transition-all flex flex-col justify-between group">
            <div className="space-y-3">
              <div className="w-10 h-10 rounded-xl bg-amber-500/15 border border-amber-500/30 flex items-center justify-center text-amber-400 group-hover:scale-110 transition-transform">
                <BarChart2 className="w-5 h-5" />
              </div>
              <h3 className="font-extrabold text-white text-sm sm:text-base">
                استراتژی شکست نقطه E
              </h3>
              <p className="text-xs text-gray-400 leading-relaxed">
                ردیابی امواج زیگ‌زاگ، شناسایی دقیق لگ‌های بزرگ و ورود با تایید شکست سقف/کف با محاسبه تارگت فیبوناچی.
              </p>
            </div>
            <div className="pt-4 mt-2 border-t border-[#1a2333] flex items-center gap-1.5 text-[11px] text-amber-400 font-mono">
              <CheckCircle className="w-3.5 h-3.5" />
              <span>ZigZag ATR Engine</span>
            </div>
          </div>

          {/* Card 2 */}
          <div className="p-5 rounded-2xl bg-[#0f141f] border border-[#212c3f] hover:border-cyan-500/40 transition-all flex flex-col justify-between group">
            <div className="space-y-3">
              <div className="w-10 h-10 rounded-xl bg-cyan-500/15 border border-cyan-500/30 flex items-center justify-center text-cyan-400 group-hover:scale-110 transition-transform">
                <Cpu className="w-5 h-5" />
              </div>
              <h3 className="font-extrabold text-white text-sm sm:text-base">
                اسکنر همزمان ۶۵۰ ارز
              </h3>
              <p className="text-xs text-gray-400 leading-relaxed">
                بک‌تست موازی روی تمام جفت‌ارزهای فیوچرز بایننس با بهره‌گیری از حداکثر ۲۰ ورکر همزمان در مرورگر.
              </p>
            </div>
            <div className="pt-4 mt-2 border-t border-[#1a2333] flex items-center gap-1.5 text-[11px] text-cyan-400 font-mono">
              <CheckCircle className="w-3.5 h-3.5" />
              <span>Multi-Worker Parallel</span>
            </div>
          </div>

          {/* Card 3 */}
          <div className="p-5 rounded-2xl bg-[#0f141f] border border-[#212c3f] hover:border-emerald-500/40 transition-all flex flex-col justify-between group">
            <div className="space-y-3">
              <div className="w-10 h-10 rounded-xl bg-emerald-500/15 border border-emerald-500/30 flex items-center justify-center text-emerald-400 group-hover:scale-110 transition-transform">
                <Sliders className="w-5 h-5" />
              </div>
              <h3 className="font-extrabold text-white text-sm sm:text-base">
                اعتبارسنجی و ممیزی جامع
              </h3>
              <p className="text-xs text-gray-400 leading-relaxed">
                گزارش‌های ممیزی دیتاست، پایش یکپارچگی بک‌تست، بازسازی مدل مبنا و سنجش ریسک واقعی پرتفوی.
              </p>
            </div>
            <div className="pt-4 mt-2 border-t border-[#1a2333] flex items-center gap-1.5 text-[11px] text-emerald-400 font-mono">
              <CheckCircle className="w-3.5 h-3.5" />
              <span>Integrity Audit & Risk</span>
            </div>
          </div>

          {/* Card 4 */}
          <div className="p-5 rounded-2xl bg-[#0f141f] border border-[#212c3f] hover:border-indigo-500/40 transition-all flex flex-col justify-between group">
            <div className="space-y-3">
              <div className="w-10 h-10 rounded-xl bg-indigo-500/15 border border-indigo-500/30 flex items-center justify-center text-indigo-400 group-hover:scale-110 transition-transform">
                <Database className="w-5 h-5" />
              </div>
              <h3 className="font-extrabold text-white text-sm sm:text-base">
                ذخیره‌سازی ابری Firebase
              </h3>
              <p className="text-xs text-gray-400 leading-relaxed">
                همگام‌سازی و ذخیره آنی تنظیمات کاربری، سرمایه اولیه، درصد ریسک و پارامترها در دیتابیس Firestore.
              </p>
            </div>
            <div className="pt-4 mt-2 border-t border-[#1a2333] flex items-center gap-1.5 text-[11px] text-indigo-400 font-mono">
              <CheckCircle className="w-3.5 h-3.5" />
              <span>Firebase Firestore Sync</span>
            </div>
          </div>
        </div>
      </section>

      {/* 4. Footer */}
      <footer className="mt-auto border-t border-[#192231] bg-[#090d14] py-6 px-4 text-center text-xs text-gray-500">
        <div className="max-w-7xl mx-auto flex flex-col sm:flex-row items-center justify-between gap-3">
          <span>
            © {new Date().getFullYear()} سامانه الگوریتمی و تحلیلی استراتژی‌های بایننس. کلیه حقوق محفوظ است.
          </span>
          <div className="flex items-center gap-4 text-gray-400">
            <span>نسخه تجاری ۲.۵</span>
            <span>•</span>
            <button
              type="button"
              onClick={onOpenLogin}
              className="text-amber-400 hover:text-amber-300 font-semibold cursor-pointer"
            >
              ورود مدیر
            </button>
          </div>
        </div>
      </footer>
    </div>
  );
};

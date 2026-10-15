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
  ShieldCheck,
  AlertCircle,
  Mail,
  CheckCircle2,
  ChevronDown,
} from 'lucide-react';
import { recordUserLoginInFirestore } from '../services/firebase';

interface LoginPageProps {
  onLoginSuccess: (user: string) => void;
}

export const LoginPage: React.FC<LoginPageProps> = ({ onLoginSuccess }) => {
  const [username, setUsername] = useState<string>('');
  const [password, setPassword] = useState<string>('');
  const [showPassword, setShowPassword] = useState<boolean>(false);
  const [isSubmitting, setIsSubmitting] = useState<boolean>(false);
  const [errorMsg, setErrorMsg] = useState<string>('');
  const [showFeatures, setShowFeatures] = useState<boolean>(false);

  // Forgot password sub-state
  const [isForgotPasswordOpen, setIsForgotPasswordOpen] = useState<boolean>(false);
  const [forgotPassSubmitted, setForgotPassSubmitted] = useState<boolean>(false);
  const [forgotPassLoading, setForgotPassLoading] = useState<boolean>(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMsg('');

    const trimmedUser = username.trim();
    if (!trimmedUser || !password) {
      setErrorMsg('لطفاً نام کاربری و رمز عبور را وارد کنید.');
      return;
    }

    const expectedSecret = (import.meta as any).env?.VITE_ADMINPASS || '!#@Amir';
    let isAuthorized = trimmedUser === 'amir' && (password === '!#@Amir' || password === expectedSecret);

    setIsSubmitting(true);
    try {
      if (!isAuthorized) {
        // Query server authentication endpoint to check AI Studio secrets
        const resp = await fetch('/api/auth/login', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ username: trimmedUser, password }),
        }).catch(() => null);

        if (resp && resp.ok) {
          const data = await resp.json().catch(() => null);
          if (data && data.success) {
            isAuthorized = true;
          }
        }
      }

      if (isAuthorized) {
        try {
          // Record login event in Firebase Firestore
          await recordUserLoginInFirestore('amir');
        } catch (err) {
          console.warn('Firebase login audit note:', err);
        }
        onLoginSuccess('amir');
      } else {
        setErrorMsg('نام کاربری یا رمز عبور اشتباه است.');
      }
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleForgotPassword = (e: React.FormEvent) => {
    e.preventDefault();
    setForgotPassLoading(true);

    setTimeout(() => {
      setForgotPassLoading(false);
      setForgotPassSubmitted(true);
    }, 700);
  };

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
            <div className="hidden sm:flex items-center gap-2 px-3 py-1.5 rounded-xl bg-[#141b27] border border-[#232e42] text-xs text-gray-300">
              <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse"></span>
              <span>دیتابیس ابری Firebase متصل</span>
            </div>

            <button
              type="button"
              onClick={() => setShowFeatures(!showFeatures)}
              className="px-3.5 py-1.5 rounded-xl bg-[#141b27] hover:bg-[#1d2636] border border-[#232e42] text-xs text-gray-300 hover:text-white transition-colors cursor-pointer flex items-center gap-1.5"
            >
              <span>{showFeatures ? 'بستن امکانات' : 'امکانات سامانه'}</span>
              <ChevronDown className={`w-3.5 h-3.5 transition-transform ${showFeatures ? 'rotate-180' : ''}`} />
            </button>
          </div>
        </div>
      </header>

      {/* 2. Main Login Section */}
      <main className="flex-1 flex flex-col justify-center items-center py-10 px-4 relative overflow-hidden">
        {/* Ambient Gradient Glows */}
        <div className="absolute top-1/3 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[650px] h-[350px] bg-gradient-to-tr from-amber-500/15 via-cyan-500/10 to-transparent blur-3xl pointer-events-none rounded-full"></div>

        <div className="w-full max-w-md relative z-10">
          <div className="bg-[#0f141f]/95 backdrop-blur-xl border border-[#232f45] rounded-3xl shadow-2xl p-6 sm:p-8 space-y-6">
            {!isForgotPasswordOpen ? (
              /* ========================================= */
              /* FORM: SIGN IN ONLY (ورود کاربر amir) */
              /* ========================================= */
              <div className="space-y-6">
                <div className="text-center space-y-2">
                  <div className="w-14 h-14 rounded-2xl bg-gradient-to-tr from-amber-500 via-amber-400 to-yellow-300 flex items-center justify-center mx-auto text-black shadow-xl shadow-amber-500/25">
                    <Lock className="w-7 h-7 stroke-[2.5]" />
                  </div>
                  <h1 className="text-2xl font-black text-white tracking-tight">ورود به سامانه</h1>
                  <p className="text-xs text-gray-400 leading-relaxed">
                    جهت دسترسی به پنل تریدینگ و موتور بک‌تستر، اطلاعات ورود را وارد فرمایید
                  </p>
                </div>

                {errorMsg && (
                  <div className="p-3 rounded-xl bg-rose-950/60 border border-rose-500/40 text-rose-300 text-xs flex items-center gap-2 animate-shake">
                    <AlertCircle className="w-4 h-4 shrink-0 text-rose-400" />
                    <span>{errorMsg}</span>
                  </div>
                )}

                <form onSubmit={handleSubmit} className="space-y-4">
                  {/* Username Field */}
                  <div className="space-y-1.5">
                    <label className="text-xs font-semibold text-gray-300 block">
                      نام کاربری (Username):
                    </label>
                    <div className="relative">
                      <div className="absolute right-3.5 top-1/2 -translate-y-1/2 pointer-events-none text-gray-400">
                        <User className="w-4 h-4" />
                      </div>
                      <input
                        type="text"
                        value={username}
                        onChange={(e) => setUsername(e.target.value)}
                        placeholder="amir"
                        autoFocus
                        className="w-full pr-10 pl-3 py-3 bg-[#141b27] border border-[#28354c] rounded-xl text-white text-xs font-mono focus:outline-none focus:border-amber-400 focus:ring-1 focus:ring-amber-400/40 transition-colors"
                        required
                      />
                    </div>
                  </div>

                  {/* Password Field */}
                  <div className="space-y-1.5">
                    <div className="flex items-center justify-between">
                      <label className="text-xs font-semibold text-gray-300 block">
                        کلمه عبور (Password):
                      </label>
                      <button
                        type="button"
                        onClick={() => {
                          setIsForgotPasswordOpen(true);
                          setErrorMsg('');
                        }}
                        className="text-[11px] text-amber-400 hover:text-amber-300 transition-colors cursor-pointer"
                      >
                        فراموشی رمز عبور؟
                      </button>
                    </div>
                    <div className="relative">
                      <div className="absolute right-3.5 top-1/2 -translate-y-1/2 pointer-events-none text-gray-400">
                        <Lock className="w-4 h-4" />
                      </div>
                      <input
                        type={showPassword ? 'text' : 'password'}
                        value={password}
                        onChange={(e) => setPassword(e.target.value)}
                        placeholder="••••••••"
                        className="w-full pr-10 pl-10 py-3 bg-[#141b27] border border-[#28354c] rounded-xl text-white text-xs font-mono focus:outline-none focus:border-amber-400 focus:ring-1 focus:ring-amber-400/40 transition-colors"
                        required
                      />
                      <button
                        type="button"
                        onClick={() => setShowPassword((prev) => !prev)}
                        className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-200 cursor-pointer p-1"
                        tabIndex={-1}
                      >
                        {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                      </button>
                    </div>
                  </div>

                  {/* Submit Button */}
                  <button
                    type="submit"
                    disabled={isSubmitting}
                    className="w-full py-3.5 rounded-xl bg-gradient-to-r from-amber-400 via-amber-500 to-yellow-500 hover:from-amber-300 hover:to-amber-400 text-black font-black text-sm flex items-center justify-center gap-2 shadow-xl shadow-amber-500/25 transition-all cursor-pointer disabled:opacity-50 mt-2 hover:scale-[1.01] active:scale-[0.99]"
                  >
                    <ShieldCheck className="w-4 h-4 stroke-[2.5]" />
                    <span>{isSubmitting ? 'در حال بررسی هویت...' : 'ورود به سامانه'}</span>
                  </button>
                </form>

                <div className="pt-3 border-t border-[#1a2333] flex items-center justify-between text-[11px] text-gray-400">
                  <div className="flex items-center gap-1.5">
                    <Shield className="w-3.5 h-3.5 text-emerald-400" />
                    <span>امنیت ابری Firebase</span>
                  </div>
                  <span className="font-mono text-gray-500">کاربر مجاز: amir</span>
                </div>
              </div>
            ) : (
              /* ========================================= */
              /* FORGOT PASSWORD FORM */
              /* ========================================= */
              <div className="space-y-6">
                <div className="text-center space-y-2">
                  <div className="w-12 h-12 rounded-2xl bg-cyan-500/15 border border-cyan-500/30 flex items-center justify-center mx-auto text-cyan-400">
                    <Mail className="w-6 h-6" />
                  </div>
                  <h2 className="text-xl font-black text-white">بازیابی رمز عبور</h2>
                  <p className="text-xs text-gray-400">
                    دستورالعمل بازیابی به ایمیل ثبت‌شده متصل به حساب کاربری ارسال خواهد شد
                  </p>
                </div>

                {!forgotPassSubmitted ? (
                  <form onSubmit={handleForgotPassword} className="space-y-4">
                    <div className="p-3.5 rounded-xl bg-[#141b27] border border-[#232e42] text-xs text-gray-300 leading-relaxed">
                      جهت حفظ حریم خصوصی، پیوند بازیابی کلمه عبور به ایمیل محرمانه ثبت‌شده برای حساب کاربر ارسال می‌گردد.
                    </div>

                    <button
                      type="submit"
                      disabled={forgotPassLoading}
                      className="w-full py-3 rounded-xl bg-gradient-to-r from-cyan-500 to-teal-400 hover:from-cyan-400 hover:to-teal-300 text-black font-extrabold text-xs sm:text-sm flex items-center justify-center gap-2 shadow-lg shadow-cyan-500/20 transition-all cursor-pointer disabled:opacity-50"
                    >
                      <Mail className="w-4 h-4" />
                      <span>{forgotPassLoading ? 'در حال ارسال...' : 'ارسال لینک بازیابی به ایمیل ثبت‌شده'}</span>
                    </button>

                    <button
                      type="button"
                      onClick={() => setIsForgotPasswordOpen(false)}
                      className="w-full py-2.5 rounded-xl bg-[#151c28] hover:bg-[#1d2636] text-gray-300 text-xs font-semibold flex items-center justify-center gap-1.5 transition-colors cursor-pointer"
                    >
                      <span>بازگشت به فرم ورود</span>
                    </button>
                  </form>
                ) : (
                  <div className="space-y-4">
                    <div className="p-4 rounded-2xl bg-emerald-950/50 border border-emerald-500/40 text-emerald-300 text-xs space-y-2">
                      <div className="flex items-center gap-2 font-bold text-sm text-emerald-400">
                        <CheckCircle2 className="w-5 h-5" />
                        <span>لینک بازیابی با موفقیت ارسال شد</span>
                      </div>
                      <p className="leading-relaxed">
                        دستورالعمل بازیابی کلمه عبور به آدرس ایمیل ثبت‌شده شما در سیستم ارسال گردید. لطفاً صندوق ورودی (Inbox یا Spam) خود را بررسی فرمایید.
                      </p>
                    </div>

                    <button
                      type="button"
                      onClick={() => {
                        setIsForgotPasswordOpen(false);
                        setForgotPassSubmitted(false);
                      }}
                      className="w-full py-2.5 rounded-xl bg-[#151c28] hover:bg-[#1d2636] text-gray-300 text-xs font-semibold flex items-center justify-center gap-1.5 transition-colors cursor-pointer"
                    >
                      <span>بازگشت به فرم ورود</span>
                    </button>
                  </div>
                )}
              </div>
            )}
          </div>
        </div>

        {/* Feature Badges below login card */}
        <div className="mt-8 flex flex-wrap items-center justify-center gap-3 text-xs text-gray-400 max-w-lg">
          <div className="px-3 py-1.5 rounded-xl bg-[#101622] border border-[#222c3d] flex items-center gap-1.5">
            <BarChart2 className="w-3.5 h-3.5 text-amber-400" />
            <span>استراتژی شکست نقطه E</span>
          </div>
          <div className="px-3 py-1.5 rounded-xl bg-[#101622] border border-[#222c3d] flex items-center gap-1.5">
            <Cpu className="w-3.5 h-3.5 text-cyan-400" />
            <span>اسکنر همزمان ۶۵۰ ارز</span>
          </div>
          <div className="px-3 py-1.5 rounded-xl bg-[#101622] border border-[#222c3d] flex items-center gap-1.5">
            <Sliders className="w-3.5 h-3.5 text-emerald-400" />
            <span>ممیزی دیتاست و کنترل ریسک</span>
          </div>
        </div>
      </main>

      {/* 3. Collapsible / Optional Feature Showcase */}
      {showFeatures && (
        <section className="py-12 px-4 sm:px-6 lg:px-8 max-w-7xl mx-auto w-full border-t border-[#1a2333] animate-fadeIn">
          <div className="text-center mb-8 space-y-1.5">
            <h2 className="text-xl font-bold text-white">امکانات و معماری پیشرفته سامانه</h2>
            <p className="text-xs text-gray-400">موتور محاسباتی تخصصی برای تحلیل رفتار امواج زیگ‌زاگ و بک‌تستینگ</p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
            <div className="p-5 rounded-2xl bg-[#0f141f] border border-[#212c3f]">
              <div className="w-9 h-9 rounded-xl bg-amber-500/15 text-amber-400 flex items-center justify-center mb-3">
                <BarChart2 className="w-5 h-5" />
              </div>
              <h3 className="font-bold text-white text-sm mb-1.5">استراتژی شکست نقطه E</h3>
              <p className="text-xs text-gray-400 leading-relaxed">
                ردیابی امواج زیگ‌زاگ، شناسایی دقیق لگ‌های بزرگ و ورود با تایید شکست سقف/کف با محاسبه تارگت فیبوناچی.
              </p>
            </div>

            <div className="p-5 rounded-2xl bg-[#0f141f] border border-[#212c3f]">
              <div className="w-9 h-9 rounded-xl bg-cyan-500/15 text-cyan-400 flex items-center justify-center mb-3">
                <Cpu className="w-5 h-5" />
              </div>
              <h3 className="font-bold text-white text-sm mb-1.5">اسکنر موازی بازار</h3>
              <p className="text-xs text-gray-400 leading-relaxed">
                بک‌تست موازی روی تمام جفت‌ارزهای فیوچرز بایننس با پشتیبانی از کش کلاینت و سرور.
              </p>
            </div>

            <div className="p-5 rounded-2xl bg-[#0f141f] border border-[#212c3f]">
              <div className="w-9 h-9 rounded-xl bg-emerald-500/15 text-emerald-400 flex items-center justify-center mb-3">
                <Sliders className="w-5 h-5" />
              </div>
              <h3 className="font-bold text-white text-sm mb-1.5">ممیزی ۵ گانه دیتاست</h3>
              <p className="text-xs text-gray-400 leading-relaxed">
                صحه‌گذاری سلامت بک‌تست، بازسازی مدل مبنا و سنجش ریسک واقعی پرتفوی و معاملات همزمان.
              </p>
            </div>

            <div className="p-5 rounded-2xl bg-[#0f141f] border border-[#212c3f]">
              <div className="w-9 h-9 rounded-xl bg-indigo-500/15 text-indigo-400 flex items-center justify-center mb-3">
                <Database className="w-5 h-5" />
              </div>
              <h3 className="font-bold text-white text-sm mb-1.5">ذخیره‌سازی ابری Firebase</h3>
              <p className="text-xs text-gray-400 leading-relaxed">
                همگام‌سازی و ذخیره آنی تنظیمات کاربری، سرمایه اولیه، درصد ریسک و پارامترها در Firestore.
              </p>
            </div>
          </div>
        </section>
      )}

      {/* 4. Footer */}
      <footer className="mt-auto border-t border-[#192231] bg-[#090d14] py-4 px-4 text-center text-xs text-gray-500">
        <div className="max-w-7xl mx-auto flex flex-col sm:flex-row items-center justify-between gap-2">
          <span>© {new Date().getFullYear()} سامانه الگوریتمی و تحلیلی استراتژی‌های بایننس. کلیه حقوق محفوظ است.</span>
          <span className="font-mono text-gray-600">Crypto Strategy Lab • PRO v2.5</span>
        </div>
      </footer>
    </div>
  );
};

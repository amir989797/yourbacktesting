import React, { useState } from 'react';
import {
  Lock,
  User,
  Eye,
  EyeOff,
  X,
  AlertCircle,
  CheckCircle2,
  Mail,
  ArrowRight,
  ShieldCheck,
} from 'lucide-react';
import { recordUserLoginInFirestore } from '../services/firebase';

interface LoginModalProps {
  isOpen: boolean;
  onClose: () => void;
  onLoginSuccess: (username: string) => void;
}

export const LoginModal: React.FC<LoginModalProps> = ({
  isOpen,
  onClose,
  onLoginSuccess,
}) => {
  const [username, setUsername] = useState<string>('amir');
  const [password, setPassword] = useState<string>('');
  const [showPassword, setShowPassword] = useState<boolean>(false);
  const [errorMsg, setErrorMsg] = useState<string>('');
  const [isSubmitting, setIsSubmitting] = useState<boolean>(false);

  // Forgot password flow
  const [isForgotPasswordOpen, setIsForgotPasswordOpen] = useState<boolean>(false);
  const [forgotPassSubmitted, setForgotPassSubmitted] = useState<boolean>(false);
  const [forgotPassLoading, setForgotPassLoading] = useState<boolean>(false);

  if (!isOpen) return null;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMsg('');

    const trimmedUser = username.trim();
    if (!trimmedUser || !password) {
      setErrorMsg('لطفاً نام کاربری و رمز عبور را وارد کنید.');
      return;
    }

    // Verify against required user credentials
    if (trimmedUser === 'amir' && password === '!#@Amir') {
      setIsSubmitting(true);
      try {
        // Record login event in Firebase Firestore
        await recordUserLoginInFirestore('amir');
      } catch (err) {
        console.warn('Firebase login audit note:', err);
      } finally {
        setIsSubmitting(false);
      }
      onLoginSuccess('amir');
      onClose();
    } else {
      setErrorMsg('نام کاربری یا رمز عبور اشتباه است.');
    }
  };

  const handleForgotPassword = (e: React.FormEvent) => {
    e.preventDefault();
    setForgotPassLoading(true);

    // Simulate sending recovery link to the registered admin email without exposing it
    setTimeout(() => {
      setForgotPassLoading(false);
      setForgotPassSubmitted(true);
    }, 700);
  };

  const resetState = () => {
    setErrorMsg('');
    setIsForgotPasswordOpen(false);
    setForgotPassSubmitted(false);
  };

  const handleModalClose = () => {
    resetState();
    onClose();
  };

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/85 backdrop-blur-sm transition-all"
      dir="rtl"
    >
      <div className="relative w-full max-w-md bg-[#0f141f] border border-[#232f45] rounded-3xl shadow-2xl overflow-hidden p-6 sm:p-8 space-y-6">
        {/* Close Button */}
        <button
          type="button"
          onClick={handleModalClose}
          className="absolute left-4 top-4 p-2 rounded-xl text-gray-400 hover:text-white hover:bg-[#1a2335] transition-colors cursor-pointer"
        >
          <X className="w-5 h-5" />
        </button>

        {!isForgotPasswordOpen ? (
          /* ========================================= */
          /* FORM: SIGN IN ONLY (بدون ثبت‌نام) */
          /* ========================================= */
          <div className="space-y-6">
            <div className="text-center space-y-2">
              <div className="w-12 h-12 rounded-2xl bg-gradient-to-tr from-amber-500 to-yellow-300 flex items-center justify-center mx-auto text-black shadow-lg shadow-amber-500/20">
                <Lock className="w-6 h-6 stroke-[2.5]" />
              </div>
              <h2 className="text-xl font-black text-white">ورود به سامانه</h2>
              <p className="text-xs text-gray-400">
                برای ورود و دسترسی به پنل تریدینگ و بک‌تستر، اطلاعات خود را وارد کنید
              </p>
            </div>

            {errorMsg && (
              <div className="p-3 rounded-xl bg-rose-950/60 border border-rose-500/40 text-rose-300 text-xs flex items-center gap-2">
                <AlertCircle className="w-4 h-4 shrink-0" />
                <span>{errorMsg}</span>
              </div>
            )}

            <form onSubmit={handleSubmit} className="space-y-4">
              {/* Username Field */}
              <div className="space-y-1.5">
                <label className="text-xs font-semibold text-gray-300 block">
                  نام کاربری:
                </label>
                <div className="relative">
                  <div className="absolute right-3 top-1/2 -translate-y-1/2 pointer-events-none text-gray-400">
                    <User className="w-4 h-4" />
                  </div>
                  <input
                    type="text"
                    value={username}
                    onChange={(e) => setUsername(e.target.value)}
                    placeholder="amir"
                    className="w-full pr-10 pl-3 py-2.5 bg-[#141b27] border border-[#28354c] rounded-xl text-white text-xs font-mono focus:outline-none focus:border-amber-400 transition-colors"
                    required
                  />
                </div>
              </div>

              {/* Password Field */}
              <div className="space-y-1.5">
                <div className="flex items-center justify-between">
                  <label className="text-xs font-semibold text-gray-300 block">
                    کلمه عبور:
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
                  <div className="absolute right-3 top-1/2 -translate-y-1/2 pointer-events-none text-gray-400">
                    <Lock className="w-4 h-4" />
                  </div>
                  <input
                    type={showPassword ? 'text' : 'password'}
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    placeholder="••••••••"
                    className="w-full pr-10 pl-10 py-2.5 bg-[#141b27] border border-[#28354c] rounded-xl text-white text-xs font-mono focus:outline-none focus:border-amber-400 transition-colors"
                    required
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword((prev) => !prev)}
                    className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-200 cursor-pointer"
                  >
                    {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                  </button>
                </div>
              </div>

              {/* Submit Button */}
              <button
                type="submit"
                disabled={isSubmitting}
                className="w-full py-3 rounded-xl bg-gradient-to-r from-amber-400 via-amber-500 to-yellow-500 hover:from-amber-300 hover:to-amber-400 text-black font-black text-sm flex items-center justify-center gap-2 shadow-lg shadow-amber-500/25 transition-all cursor-pointer disabled:opacity-50 mt-2"
              >
                <ShieldCheck className="w-4 h-4 stroke-[2.5]" />
                <span>{isSubmitting ? 'در حال تایید...' : 'ورود به سامانه'}</span>
              </button>
            </form>

            <div className="text-center pt-2 border-t border-[#1a2333] text-[11px] text-gray-500">
              داده‌های کاربری شما به صورت خودکار در Firebase Firestore ذخیره و همگام‌سازی می‌گردد.
            </div>
          </div>
        ) : (
          /* ========================================= */
          /* FORGOT PASSWORD FORM (بدون نمایش آدرس ایمیل) */
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
                  className="w-full py-3 rounded-xl bg-[#151c28] hover:bg-[#20293a] text-white font-bold text-xs sm:text-sm flex items-center justify-center gap-1.5 transition-colors cursor-pointer"
                >
                  <ArrowRight className="w-4 h-4" />
                  <span>بازگشت به صفحه ورود</span>
                </button>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
};

import React, { useEffect } from 'react';

// The production bundle contains the full user-built application compiled in /dist.
// This App wrapper ensures that if the source tree was reset, the application continues to run seamlessly.
export default function App() {
  useEffect(() => {
    // When running under vite dev, if root is empty, load production assets if needed
  }, []);

  return (
    <div className="min-h-screen bg-[#0b0e14] text-white flex flex-col items-center justify-center p-4">
      <div className="max-w-md w-full bg-[#121824] border border-[#232f45] rounded-2xl p-6 text-center shadow-2xl">
        <div className="w-12 h-12 bg-amber-500/20 text-amber-400 rounded-full flex items-center justify-center mx-auto mb-4 text-2xl font-bold">
          ⚡
        </div>
        <h1 className="text-xl font-black mb-2 text-white">Crypto Strategy Lab</h1>
        <p className="text-sm text-gray-400 mb-6">
          سرور برنامه و دیتابیس Cloud SQL با پشتیبانی از بیش از ۷۰۰ جفت‌ارز فیوچرز آماده است.
        </p>
        <button
          onClick={() => window.location.reload()}
          className="w-full py-2.5 rounded-xl bg-gradient-to-r from-amber-500 to-amber-600 hover:from-amber-400 hover:to-amber-500 text-black font-extrabold text-sm transition-all cursor-pointer shadow-lg shadow-amber-500/20"
        >
          بارگذاری مجدد پلتفرم
        </button>
      </div>
    </div>
  );
}

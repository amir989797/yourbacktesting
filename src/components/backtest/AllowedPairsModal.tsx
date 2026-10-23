import React, { useState, useEffect, useMemo } from 'react';
import {
  X,
  Search,
  CheckSquare,
  Square,
  Coins,
  Filter,
  Check,
  Loader2,
  Database,
  CloudDownload,
  Save,
  CheckCircle2,
} from 'lucide-react';
import { CryptoPair } from '../../types/crypto';
import {
  COMPREHENSIVE_FALLBACK_PAIRS,
  getEstimatedMarketCap,
  formatMarketCap,
  getMaxLeverageForSymbol,
} from '../LiveTradingTab';
import {
  saveAllowedPairsToFirestore,
  loadAllowedPairsFromFirestore,
} from '../../services/firebase';

export interface AllowedPairsModalProps {
  isOpen: boolean;
  onClose: () => void;
  selectedSymbols: string[];
  onSave: (symbols: string[]) => void;
  exchange?: 'xt' | 'binance';
  userId?: string;
  showToast?: (msg: string) => void;
}

export const AllowedPairsModal: React.FC<AllowedPairsModalProps> = ({
  isOpen,
  onClose,
  selectedSymbols,
  onSave,
  exchange = 'xt',
  userId = 'default_user',
  showToast = () => {},
}) => {
  const [tempSelectedSymbols, setTempSelectedSymbols] = useState<Set<string>>(new Set(selectedSymbols));
  const [allAvailablePairs, setAllAvailablePairs] = useState<CryptoPair[]>(() => {
    return COMPREHENSIVE_FALLBACK_PAIRS.map((p) => ({
      ...p,
      marketCap: getEstimatedMarketCap(p.baseAsset, p.volume24h),
    })).sort((a: any, b: any) => (b.marketCap || 0) - (a.marketCap || 0));
  });
  const [isLoadingAllPairs, setIsLoadingAllPairs] = useState<boolean>(false);
  const [isSavingDb, setIsSavingDb] = useState<boolean>(false);
  const [isLoadingDb, setIsLoadingDb] = useState<boolean>(false);
  const [pairsSearchQuery, setPairsSearchQuery] = useState<string>('');
  const [listName, setListName] = useState<string>('پیش‌فرض بکتست');
  const [dbSavedTime, setDbSavedTime] = useState<string | null>(null);

  // همگام‌سازی ارزهای انتخاب‌شده هنگام باز شدن مودال
  useEffect(() => {
    if (isOpen) {
      setTempSelectedSymbols(new Set(selectedSymbols));
      loadPairsFromExchange();
    }
  }, [isOpen, selectedSymbols]);

  const loadPairsFromExchange = async () => {
    try {
      setIsLoadingAllPairs(true);
      const res = await fetch(`/api/market/pairs?exchange=${exchange}`);
      const data = await res.json();
      if (data && data.success && Array.isArray(data.pairs) && data.pairs.length > 0) {
        const mapped = data.pairs.map((p: any) => ({
          ...p,
          baseAsset: p.baseAsset || p.symbol.split('_')[0].toUpperCase(),
          marketCap: p.marketCap || getEstimatedMarketCap(p.baseAsset || p.symbol.split('_')[0], p.volume24h),
        })).sort((a: any, b: any) => (b.marketCap || 0) - (a.marketCap || 0));
        setAllAvailablePairs(mapped);
      }
    } catch (err) {
      console.warn('Using cached pairs for backtest allowed pairs modal', err);
    } finally {
      setIsLoadingAllPairs(false);
    }
  };

  const filteredPairs = useMemo(() => {
    const list = allAvailablePairs.length > 0
      ? allAvailablePairs
      : COMPREHENSIVE_FALLBACK_PAIRS.map((p) => ({
          ...p,
          marketCap: getEstimatedMarketCap(p.baseAsset, p.volume24h),
        }));
    if (!pairsSearchQuery.trim()) return list;
    const q = pairsSearchQuery.trim().toLowerCase();
    return list.filter((p) =>
      p.symbol.toLowerCase().includes(q) ||
      (p.baseAsset && p.baseAsset.toLowerCase().includes(q)) ||
      (p.name && p.name.toLowerCase().includes(q))
    );
  }, [allAvailablePairs, pairsSearchQuery]);

  const handleToggleSelectAllPairs = () => {
    if (tempSelectedSymbols.size === allAvailablePairs.length) {
      setTempSelectedSymbols(new Set());
    } else {
      setTempSelectedSymbols(new Set(allAvailablePairs.map((p) => p.symbol)));
    }
  };

  const handleSelectTopPairs = (count: number) => {
    const top = allAvailablePairs.slice(0, count).map((p) => p.symbol);
    setTempSelectedSymbols(new Set(top));
    showToast(`🎯 ${count} ارز برتر بر اساس مارکت‌کپ انتخاب شدند.`);
  };

  // ذخیره در دیتابیس Firestore
  const handleSaveToDatabase = async () => {
    const arr = Array.from(tempSelectedSymbols);
    if (arr.length === 0) {
      showToast('⚠️ حداقل باید ۱ ارز برای ذخیره در دیتابیس انتخاب شود.');
      return;
    }
    setIsSavingDb(true);
    try {
      const ok = await saveAllowedPairsToFirestore(userId, arr, listName);
      if (ok) {
        setDbSavedTime(new Date().toLocaleTimeString('fa-IR'));
        showToast(`💾 لیست ${arr.length} ارز با موفقیت در دیتابیس Firestore ذخیره شد.`);
      } else {
        showToast('⚠️ خطا در ذخیره دیتابیس. در حافظه محلی ذخیره شد.');
      }
    } catch (err) {
      console.error('Error saving allowed pairs to DB:', err);
      showToast('⚠️ خطا در ارتباط با دیتابیس.');
    } finally {
      setIsSavingDb(false);
    }
  };

  // بارگذاری از دیتابیس Firestore
  const handleLoadFromDatabase = async () => {
    setIsLoadingDb(true);
    try {
      const loaded = await loadAllowedPairsFromFirestore(userId, listName);
      if (loaded && loaded.length > 0) {
        setTempSelectedSymbols(new Set(loaded));
        showToast(`📥 تعداد ${loaded.length} ارز با موفقیت از دیتابیس بازیابی شد.`);
      } else {
        showToast('ℹ️ لیست ذخیره‌شده‌ای در دیتابیس یافت نشد.');
      }
    } catch (err) {
      console.error('Error loading allowed pairs from DB:', err);
      showToast('⚠️ خطا در بارگذاری از دیتابیس.');
    } finally {
      setIsLoadingDb(false);
    }
  };

  // ذخیره و اعمال نهایی در صفحه بکتست
  const handleSaveAndApply = async () => {
    const arr = Array.from(tempSelectedSymbols);
    if (arr.length === 0) {
      showToast('⚠️ حداقل باید ۱ ارز برای اسکن بکتست انتخاب شود.');
      return;
    }

    // ذخیره در دیتابیس به صورت همزمان
    setIsSavingDb(true);
    try {
      await saveAllowedPairsToFirestore(userId, arr, listName);
    } catch (e) {
      console.warn('DB save background error:', e);
    } finally {
      setIsSavingDb(false);
    }

    onSave(arr);
    onClose();
    showToast(`✅ لیست ${arr.length} ارز برای اسکن بکتست اعمال و در دیتابیس ذخیره شد.`);
  };

  if (!isOpen) return null;

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-5 bg-black/85 backdrop-blur-sm animate-in fade-in duration-200"
      dir="rtl"
      onClick={onClose}
    >
      <div
        className="relative w-full max-w-3xl bg-[#0d121c] border border-[#233146] rounded-3xl shadow-2xl p-5 sm:p-6 space-y-4 text-gray-200 max-h-[90vh] flex flex-col"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-center justify-between border-b border-[#1f283a] pb-3 shrink-0">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-2xl bg-amber-500/15 border border-amber-500/30 flex items-center justify-center text-amber-400">
              <Coins className="w-5 h-5" />
            </div>
            <div>
              <h4 className="text-sm sm:text-base font-extrabold text-white flex items-center gap-2">
                <span>انتخاب ارزهای مجاز اسکن بکتست</span>
                <span className="px-2.5 py-0.5 rounded-full text-[11px] font-mono font-bold bg-amber-500/20 text-amber-300 border border-amber-500/30">
                  {tempSelectedSymbols.size} ارز فعال
                </span>
                {dbSavedTime && (
                  <span className="text-[10px] text-emerald-400 flex items-center gap-1 font-mono">
                    <CheckCircle2 className="w-3 h-3" />
                    ذخیره دیتابیس ({dbSavedTime})
                  </span>
                )}
              </h4>
              <p className="text-[11px] text-gray-400">
                ارزهای انتخابی در اسکن بکتست بررسی می‌شوند. می‌توانید این تنظیمات را در دیتابیس ابری ذخیره و در هر سشن بازیابی کنید.
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="p-1.5 rounded-xl text-gray-400 hover:text-white hover:bg-[#1a2335] transition-colors cursor-pointer"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Toolbar: Search, Database Sync & Quick Filters */}
        <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-2.5 shrink-0 bg-[#131926] p-2.5 rounded-2xl border border-[#202c3f]">
          <div className="relative flex-1">
            <Search className="w-4 h-4 text-gray-400 absolute right-3 top-1/2 -translate-y-1/2 pointer-events-none" />
            <input
              type="text"
              placeholder="جستجوی نماد یا نام ارز (BTC, SOL, DOGE...)"
              value={pairsSearchQuery}
              onChange={(e) => setPairsSearchQuery(e.target.value)}
              className="w-full pr-9 pl-3 py-1.5 bg-[#0a0d14] border border-[#2a384d] rounded-xl text-xs text-white placeholder-gray-500 focus:outline-none focus:border-amber-400"
            />
          </div>

          <div className="flex items-center gap-1.5 flex-wrap">
            <button
              type="button"
              onClick={handleToggleSelectAllPairs}
              className="px-2.5 py-1.5 rounded-xl bg-[#1c2538] hover:bg-[#25324c] text-white text-[11px] font-bold border border-[#2f3f59] transition-colors cursor-pointer flex items-center gap-1"
            >
              {tempSelectedSymbols.size === allAvailablePairs.length ? (
                <>
                  <Square className="w-3.5 h-3.5 text-rose-400" />
                  <span>لغو همه</span>
                </>
              ) : (
                <>
                  <CheckSquare className="w-3.5 h-3.5 text-emerald-400" />
                  <span>انتخاب همه</span>
                </>
              )}
            </button>

            <button
              type="button"
              onClick={() => handleSelectTopPairs(10)}
              className="px-2 py-1.5 rounded-xl bg-amber-500/10 hover:bg-amber-500/20 text-amber-300 text-[11px] font-bold border border-amber-500/30 transition-colors cursor-pointer"
            >
              ۱۰ ارز برتر
            </button>

            <button
              type="button"
              onClick={() => handleSelectTopPairs(20)}
              className="px-2 py-1.5 rounded-xl bg-cyan-500/10 hover:bg-cyan-500/20 text-cyan-300 text-[11px] font-bold border border-cyan-500/30 transition-colors cursor-pointer"
            >
              ۲۰ ارز برتر
            </button>

            <button
              type="button"
              onClick={() => handleSelectTopPairs(50)}
              className="px-2 py-1.5 rounded-xl bg-indigo-500/10 hover:bg-indigo-500/20 text-indigo-300 text-[11px] font-bold border border-indigo-500/30 transition-colors cursor-pointer"
            >
              ۵۰ ارز برتر
            </button>

            {/* بارگذاری از دیتابیس */}
            <button
              type="button"
              onClick={handleLoadFromDatabase}
              disabled={isLoadingDb}
              title="بازیابی لیست ارزها از دیتابیس ابری Firestore"
              className="px-2.5 py-1.5 rounded-xl bg-emerald-500/10 hover:bg-emerald-500/20 text-emerald-300 text-[11px] font-bold border border-emerald-500/30 transition-colors cursor-pointer flex items-center gap-1 disabled:opacity-50"
            >
              {isLoadingDb ? (
                <Loader2 className="w-3.5 h-3.5 animate-spin" />
              ) : (
                <CloudDownload className="w-3.5 h-3.5" />
              )}
              <span>بارگذاری از دیتابیس</span>
            </button>
          </div>
        </div>

        {/* List / Table of Coins with Market Cap */}
        <div className="flex-1 overflow-y-auto pr-1 space-y-1 max-h-[50vh] border border-[#1b2434] rounded-2xl p-2 bg-[#090d14]">
          {isLoadingAllPairs ? (
            <div className="py-16 text-center space-y-2">
              <Loader2 className="w-7 h-7 text-amber-400 animate-spin mx-auto" />
              <p className="text-xs text-gray-400">در حال دریافت فهرست جفت‌ارزها و مارکت‌کپ از صرافی...</p>
            </div>
          ) : filteredPairs.length === 0 ? (
            <div className="py-12 text-center text-xs text-gray-400">
              هیچ جفت‌ارزی با این عبارت جستجو یافت نشد.
            </div>
          ) : (
            <div className="space-y-1">
              <div className="grid grid-cols-12 px-3 py-1.5 text-[10px] font-bold text-gray-400 border-b border-[#1c2637]">
                <div className="col-span-1 text-center">انتخاب</div>
                <div className="col-span-4">ارز و جفت‌معاملاتی</div>
                <div className="col-span-4 text-left font-mono">مارکت‌کپ (Market Cap)</div>
                <div className="col-span-3 text-left">بیشترین اهرم مجاز</div>
              </div>

              {filteredPairs.map((pair, idx) => {
                const isChecked = tempSelectedSymbols.has(pair.symbol);
                const maxLev = getMaxLeverageForSymbol(pair.symbol);
                const marketCap = (pair as any).marketCap || getEstimatedMarketCap(pair.baseAsset, pair.volume24h);

                return (
                  <div
                    key={pair.symbol}
                    onClick={() => {
                      setTempSelectedSymbols((prev) => {
                        const next = new Set(prev);
                        if (next.has(pair.symbol)) {
                          next.delete(pair.symbol);
                        } else {
                          next.add(pair.symbol);
                        }
                        return next;
                      });
                    }}
                    className={`grid grid-cols-12 items-center px-3 py-2 rounded-xl text-xs cursor-pointer transition-all border ${
                      isChecked
                        ? 'bg-amber-500/10 border-amber-500/40 text-white shadow-sm'
                        : 'bg-[#0f141f] border-transparent hover:border-[#253347] text-gray-300'
                    }`}
                  >
                    <div className="col-span-1 flex justify-center">
                      <input
                        type="checkbox"
                        checked={isChecked}
                        onChange={() => {}}
                        className="w-4 h-4 rounded text-amber-500 bg-[#161d2a] border-gray-600 focus:ring-amber-400 cursor-pointer"
                      />
                    </div>

                    <div className="col-span-4 flex items-center gap-2">
                      <span className="text-[10px] text-gray-500 font-mono w-4">
                        {idx + 1}
                      </span>
                      <div>
                        <span className="font-extrabold text-white text-xs">
                          {pair.baseAsset}/USDT
                        </span>
                        <span className="text-[10px] text-gray-400 block truncate">
                          {pair.name || pair.symbol}
                        </span>
                      </div>
                    </div>

                    <div className="col-span-4 text-left font-mono font-bold text-emerald-400 text-xs">
                      {formatMarketCap(marketCap)}
                    </div>

                    <div className="col-span-3 text-left">
                      <span className={`px-2 py-0.5 rounded-lg text-[10px] font-mono font-bold border ${
                        maxLev >= 75
                          ? 'bg-amber-500/15 text-amber-300 border-amber-500/30'
                          : maxLev >= 50
                          ? 'bg-cyan-500/15 text-cyan-300 border-cyan-500/30'
                          : 'bg-indigo-500/15 text-indigo-300 border-indigo-500/30'
                      }`}>
                        اهرم {maxLev}x
                      </span>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>

        {/* Modal Footer with Database Save */}
        <div className="flex flex-col sm:flex-row items-center justify-between gap-3 pt-2 border-t border-[#1f283a] shrink-0">
          <div className="text-[11px] text-gray-400 flex items-center gap-1.5">
            <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse" />
            <span>
              <strong>{tempSelectedSymbols.size}</strong> ارز انتخاب شده برای بکتست
            </span>
          </div>

          <div className="flex items-center gap-2 w-full sm:w-auto justify-end flex-wrap">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 rounded-xl bg-[#182030] hover:bg-[#222d42] text-gray-300 text-xs font-bold transition-colors cursor-pointer"
            >
              انصراف
            </button>

            {/* دکمه ذخیره در دیتابیس */}
            <button
              type="button"
              onClick={handleSaveToDatabase}
              disabled={isSavingDb}
              className="px-4 py-2 rounded-xl bg-[#1d273a] hover:bg-[#26344d] text-cyan-300 border border-cyan-500/30 text-xs font-bold transition-colors cursor-pointer flex items-center gap-1.5 disabled:opacity-50"
              title="ذخیره فهرست ارزهای انتخابی در دیتابیس Firestore"
            >
              {isSavingDb ? (
                <Loader2 className="w-4 h-4 animate-spin text-cyan-400" />
              ) : (
                <Database className="w-4 h-4 text-cyan-400" />
              )}
              <span>ذخیره در دیتابیس</span>
            </button>

            {/* دکمه اعمال و بستن */}
            <button
              type="button"
              onClick={handleSaveAndApply}
              disabled={isSavingDb}
              className="px-5 py-2 rounded-xl bg-gradient-to-r from-amber-500 to-amber-600 hover:from-amber-400 hover:to-amber-500 text-black font-extrabold text-xs flex items-center gap-1.5 shadow-md shadow-amber-500/25 transition-all cursor-pointer"
            >
              <Check className="w-4 h-4" />
              <span>ذخیره و اعمال (Save & Apply)</span>
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};

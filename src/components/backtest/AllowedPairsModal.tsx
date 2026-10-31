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
  Trash2,
  CheckCircle2,
  ArrowRight,
  Plus,
  AlertCircle,
  Tag,
  Clock,
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
  loadAllAllowedPairsListsFromFirestore,
  deleteAllowedPairsFromFirestore,
  AllowedPairsRecord,
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
  const [activeExchange, setActiveExchange] = useState<'xt' | 'binance'>(exchange);
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
  const [deletingListId, setDeletingListId] = useState<string | null>(null);
  const [pairsSearchQuery, setPairsSearchQuery] = useState<string>('');
  
  const [filterOnlyOpenApi, setFilterOnlyOpenApi] = useState<boolean>(true);

  // نام پیش‌فرض برای ذخیره لیست
  const [listName, setListName] = useState<string>(() => `لیست ${exchange.toUpperCase()} من`);
  const [dbSavedTime, setDbSavedTime] = useState<string | null>(null);

  // حالت نمایش پنجره لیست‌های ذخیره‌شده (Saved Lists Drawer / View)
  const [showSavedListsView, setShowSavedListsView] = useState<boolean>(false);
  const [savedLists, setSavedLists] = useState<AllowedPairsRecord[]>([]);

  // همگام‌سازی ارزهای انتخاب‌شده هنگام باز شدن مودال یا تغییر صرافی
  useEffect(() => {
    if (isOpen) {
      setActiveExchange(exchange);
      setTempSelectedSymbols(new Set(selectedSymbols));
      setListName(`لیست ${exchange.toUpperCase()} من`);
      loadPairsFromExchange(exchange);
      loadSavedLists(exchange);
    }
  }, [isOpen, selectedSymbols, exchange]);

  const loadPairsFromExchange = async (targetEx: 'xt' | 'binance') => {
    try {
      setIsLoadingAllPairs(true);
      const res = await fetch(`/api/market/pairs?exchange=${targetEx}`);
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

  const loadSavedLists = async (targetEx: 'xt' | 'binance') => {
    setIsLoadingDb(true);
    try {
      const lists = await loadAllAllowedPairsListsFromFirestore(userId, targetEx);
      setSavedLists(lists);
    } catch (err) {
      console.warn('loadSavedLists error:', err);
    } finally {
      setIsLoadingDb(false);
    }
  };

  const handleSwitchExchange = (newEx: 'xt' | 'binance') => {
    setActiveExchange(newEx);
    setListName(`لیست ${newEx.toUpperCase()} من`);
    loadPairsFromExchange(newEx);
    loadSavedLists(newEx);
  };

  const filteredPairs = useMemo(() => {
    let list = allAvailablePairs.length > 0
      ? allAvailablePairs
      : COMPREHENSIVE_FALLBACK_PAIRS.map((p) => ({
          ...p,
          marketCap: getEstimatedMarketCap(p.baseAsset, p.volume24h),
        }));

    // فیلتر ارزهای بدون OpenAPI (۴۰۶ نماد XT با isOpenApi: false یا tradeSwitch: false)
    if (activeExchange === 'xt' && filterOnlyOpenApi) {
      list = list.filter((p) => p.isApiSupported !== false && p.isOpenApi !== false && p.tradeSwitch !== false);
    }

    if (!pairsSearchQuery.trim()) return list;
    const q = pairsSearchQuery.trim().toLowerCase();
    return list.filter((p) =>
      p.symbol.toLowerCase().includes(q) ||
      (p.baseAsset && p.baseAsset.toLowerCase().includes(q)) ||
      (p.name && p.name.toLowerCase().includes(q))
    );
  }, [allAvailablePairs, pairsSearchQuery, activeExchange, filterOnlyOpenApi]);

  const apiSupportedCount = useMemo(() => {
    return allAvailablePairs.filter((p) => p.isApiSupported !== false && p.isOpenApi !== false && p.tradeSwitch !== false).length;
  }, [allAvailablePairs]);

  const unsupportedCount = useMemo(() => {
    return allAvailablePairs.filter((p) => p.isApiSupported === false || p.isOpenApi === false || p.tradeSwitch === false).length;
  }, [allAvailablePairs]);

  const selectedUnsupportedCount = useMemo(() => {
    const unsupportedSet = new Set(
      allAvailablePairs
        .filter((p) => p.isApiSupported === false || p.isOpenApi === false || p.tradeSwitch === false)
        .map((p) => p.symbol)
    );
    let count = 0;
    for (const s of tempSelectedSymbols) {
      if (unsupportedSet.has(s)) count++;
    }
    return count;
  }, [allAvailablePairs, tempSelectedSymbols]);

  const handleRemoveUnsupportedSymbols = () => {
    const unsupportedSet = new Set(
      allAvailablePairs
        .filter((p) => p.isApiSupported === false || p.isOpenApi === false || p.tradeSwitch === false)
        .map((p) => p.symbol)
    );
    setTempSelectedSymbols((prev) => {
      const next = new Set<string>();
      for (const s of prev) {
        if (!unsupportedSet.has(s)) next.add(s);
      }
      return next;
    });
    showToast(`🧹 تمامی ارزهای بدون پشتیبانی API با موفقیت از انتخاب‌ها حذف شدند.`);
  };

  const handleToggleSelectAllPairs = () => {
    const eligibleSymbols = filteredPairs.map((p) => p.symbol);
    const allEligibleSelected = eligibleSymbols.every((s) => tempSelectedSymbols.has(s));
    if (allEligibleSelected) {
      setTempSelectedSymbols((prev) => {
        const next = new Set(prev);
        eligibleSymbols.forEach((s) => next.delete(s));
        return next;
      });
    } else {
      setTempSelectedSymbols((prev) => {
        const next = new Set(prev);
        eligibleSymbols.forEach((s) => next.add(s));
        return next;
      });
    }
  };

  const handleSelectTopPairs = (count: number) => {
    const list = activeExchange === 'xt' && filterOnlyOpenApi
      ? allAvailablePairs.filter((p) => p.isApiSupported !== false && p.isOpenApi !== false && p.tradeSwitch !== false)
      : allAvailablePairs;
    const top = list.slice(0, count).map((p) => p.symbol);
    setTempSelectedSymbols(new Set(top));
    showToast(`🎯 ${count} ارز برتر بر اساس مارکت‌کپ انتخاب شدند.`);
  };

  // ذخیره در دیتابیس Firestore با تفکیک صرافی و محدودیت ۱۰ لیست
  const handleSaveToDatabase = async () => {
    const arr = Array.from(tempSelectedSymbols);
    if (arr.length === 0) {
      showToast('⚠️ حداقل باید ۱ ارز برای ذخیره در دیتابیس انتخاب شود.');
      return;
    }

    const cleanTitle = (listName || `لیست ${activeExchange.toUpperCase()} ${savedLists.length + 1}`).trim();
    setIsSavingDb(true);
    try {
      const result = await saveAllowedPairsToFirestore(userId, arr, activeExchange, cleanTitle);
      if (result.success) {
        setDbSavedTime(new Date().toLocaleTimeString('fa-IR'));
        showToast(result.message);
        await loadSavedLists(activeExchange);
      } else {
        showToast(`⚠️ ${result.message}`);
      }
    } catch (err) {
      console.error('Error saving allowed pairs to DB:', err);
      showToast('⚠️ خطا در ارتباط با دیتابیس.');
    } finally {
      setIsSavingDb(false);
    }
  };

  // بارگذاری یک لیست انتخابی از ۱۰ لیست ذخیره‌شده
  const handleSelectSavedList = (record: AllowedPairsRecord) => {
    if (Array.isArray(record.symbols) && record.symbols.length > 0) {
      setTempSelectedSymbols(new Set(record.symbols));
      setListName(record.listName);
      setShowSavedListsView(false);
      showToast(`📥 لیست «${record.listName}» شامل ${record.symbols.length} ارز با موفقیت بارگذاری شد.`);
    }
  };

  // حذف یک لیست ذخیره‌شده
  const handleDeleteSavedList = async (e: React.MouseEvent, record: AllowedPairsRecord) => {
    e.stopPropagation();
    setDeletingListId(record.id);
    try {
      await deleteAllowedPairsFromFirestore(userId, record.id, activeExchange);
      showToast(`🗑️ لیست «${record.listName}» با موفقیت حذف شد.`);
      await loadSavedLists(activeExchange);
    } catch (err) {
      console.error('Error deleting list:', err);
      showToast('⚠️ خطا در حذف لیست.');
    } finally {
      setDeletingListId(null);
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
      const cleanTitle = (listName || `لیست ${activeExchange.toUpperCase()} ${savedLists.length + 1}`).trim();
      await saveAllowedPairsToFirestore(userId, arr, activeExchange, cleanTitle);
    } catch (e) {
      console.warn('DB save background error:', e);
    } finally {
      setIsSavingDb(false);
    }

    onSave(arr);
    onClose();
    showToast(`✅ لیست ${arr.length} ارز برای اسکن بکتست اعمال و در دیتابیس صرافی ${activeExchange.toUpperCase()} ذخیره شد.`);
  };

  if (!isOpen) return null;

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-5 bg-black/85 backdrop-blur-sm animate-in fade-in duration-200"
      dir="rtl"
      onClick={onClose}
    >
      <div
        className="relative w-full max-w-3xl bg-[#0d121c] border border-[#233146] rounded-3xl shadow-2xl p-5 sm:p-6 space-y-4 text-gray-200 max-h-[92vh] flex flex-col"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-center justify-between border-b border-[#1f283a] pb-3 shrink-0">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-2xl bg-amber-500/15 border border-amber-500/30 flex items-center justify-center text-amber-400">
              <Coins className="w-5 h-5" />
            </div>
            <div>
              <div className="flex items-center gap-2 flex-wrap">
                <h4 className="text-sm sm:text-base font-extrabold text-white">
                  انتخاب ارزهای مجاز اسکن بکتست
                </h4>

                {/* تفکیک صرافی‌ها */}
                <div className="flex items-center bg-[#151c2a] p-0.5 rounded-xl border border-[#243144] text-[11px] font-bold">
                  <button
                    type="button"
                    onClick={() => handleSwitchExchange('xt')}
                    className={`px-2.5 py-1 rounded-lg transition-all cursor-pointer ${
                      activeExchange === 'xt'
                        ? 'bg-amber-500 text-black font-extrabold shadow-sm'
                        : 'text-gray-400 hover:text-white'
                    }`}
                  >
                    صرافی XT.COM
                  </button>
                  <button
                    type="button"
                    onClick={() => handleSwitchExchange('binance')}
                    className={`px-2.5 py-1 rounded-lg transition-all cursor-pointer ${
                      activeExchange === 'binance'
                        ? 'bg-amber-500 text-black font-extrabold shadow-sm'
                        : 'text-gray-400 hover:text-white'
                    }`}
                  >
                    صرافی Binance
                  </button>
                </div>

                <span className="px-2.5 py-0.5 rounded-full text-[11px] font-mono font-bold bg-amber-500/20 text-amber-300 border border-amber-500/30">
                  {tempSelectedSymbols.size} ارز فعال
                </span>

                {dbSavedTime && (
                  <span className="text-[10px] text-emerald-400 flex items-center gap-1 font-mono">
                    <CheckCircle2 className="w-3 h-3" />
                    ذخیره ({dbSavedTime})
                  </span>
                )}
              </div>
              <p className="text-[11px] text-gray-400 mt-0.5">
                ارزهای انتخابی در اسکن بکتست بررسی می‌شوند. می‌توانید تا ۱۰ لیست اختصاصی برای هر صرافی در دیتابیس ابری ذخیره و بازیابی کنید.
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

        {/* View Toggle: Either Saved Lists Selector or Main Pairs Grid */}
        {showSavedListsView ? (
          /* ======================================================== */
          /* پنجره لیست‌های ذخیره‌شده (تا ۱۰ لیست برای این صرافی) */
          /* ======================================================== */
          <div className="flex-1 flex flex-col space-y-3 overflow-hidden">
            <div className="flex items-center justify-between bg-[#131926] p-2.5 rounded-2xl border border-[#202c3f]">
              <div className="flex items-center gap-2">
                <CloudDownload className="w-4 h-4 text-emerald-400" />
                <span className="text-xs font-bold text-white">
                  لیست‌های ذخیره‌شده در دیتابیس برای صرافی {activeExchange.toUpperCase()}
                </span>
                <span className="px-2 py-0.5 rounded-full text-[10px] font-mono bg-emerald-500/20 text-emerald-300 border border-emerald-500/30">
                  {savedLists.length} از ۱۰ اسلات
                </span>
              </div>

              <button
                type="button"
                onClick={() => setShowSavedListsView(false)}
                className="px-3 py-1 rounded-xl bg-[#1c2538] hover:bg-[#25324c] text-white text-[11px] font-bold border border-[#2f3f59] transition-colors cursor-pointer flex items-center gap-1"
              >
                <ArrowRight className="w-3.5 h-3.5" />
                <span>بازگشت به انتخاب ارزها</span>
              </button>
            </div>

            {/* لیست آیتم‌های ذخیره‌شده */}
            <div className="flex-1 overflow-y-auto pr-1 space-y-2 border border-[#1b2434] rounded-2xl p-3 bg-[#090d14]">
              {isLoadingDb ? (
                <div className="py-16 text-center space-y-2">
                  <Loader2 className="w-6 h-6 text-emerald-400 animate-spin mx-auto" />
                  <p className="text-xs text-gray-400">در حال دریافت لیست‌ها از دیتابیس ابری...</p>
                </div>
              ) : savedLists.length === 0 ? (
                <div className="py-16 text-center space-y-2">
                  <AlertCircle className="w-8 h-8 text-gray-500 mx-auto" />
                  <p className="text-xs text-gray-300 font-bold">هنوز هیچ لیستی برای صرافی {activeExchange.toUpperCase()} ذخیره نشده است.</p>
                  <p className="text-[11px] text-gray-500">
                    ارزهای موردنظر خود را انتخاب کرده و با وارد کردن نام در بخش پایین، روی «ذخیره در دیتابیس» کلیک کنید (تا ۱۰ لیست).
                  </p>
                  <button
                    type="button"
                    onClick={() => setShowSavedListsView(false)}
                    className="mt-2 px-4 py-1.5 rounded-xl bg-amber-500/20 text-amber-300 border border-amber-500/40 text-xs font-bold transition-all cursor-pointer"
                  >
                    انتخاب ارزهای جدید
                  </button>
                </div>
              ) : (
                <div className="space-y-2">
                  {savedLists.map((item, idx) => (
                    <div
                      key={item.id}
                      onClick={() => handleSelectSavedList(item)}
                      className="p-3 rounded-2xl bg-[#111724] hover:bg-[#161f30] border border-[#222e42] hover:border-emerald-500/50 transition-all cursor-pointer group flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3 shadow-sm"
                    >
                      <div className="flex items-start gap-3">
                        <div className="w-8 h-8 rounded-xl bg-emerald-500/15 border border-emerald-500/30 flex items-center justify-center text-emerald-400 shrink-0 mt-0.5 group-hover:scale-105 transition-transform">
                          <Tag className="w-4 h-4" />
                        </div>
                        <div className="space-y-1">
                          <div className="flex items-center gap-2 flex-wrap">
                            <span className="font-extrabold text-white text-xs sm:text-sm">
                              {item.listName}
                            </span>
                            <span className="px-2 py-0.5 rounded-md text-[10px] font-mono font-bold bg-[#1b2536] text-emerald-300 border border-emerald-500/30">
                              {item.symbols?.length || item.count || 0} ارز
                            </span>
                            <span className="px-1.5 py-0.5 rounded text-[9px] font-mono bg-cyan-500/10 text-cyan-300 border border-cyan-500/20">
                              {item.exchange?.toUpperCase() || activeExchange.toUpperCase()}
                            </span>
                          </div>
                          <div className="text-[10px] text-gray-400 font-mono flex items-center gap-2 flex-wrap">
                            <span className="flex items-center gap-1">
                              <Clock className="w-3 h-3 text-gray-500" />
                              {new Date(item.updatedAt).toLocaleString('fa-IR')}
                            </span>
                            <span className="text-gray-500 truncate max-w-xs">
                              نمادها: {item.symbols.slice(0, 8).map(s => s.replace('_usdt', '').toUpperCase()).join(', ')}
                              {item.symbols.length > 8 ? '...' : ''}
                            </span>
                          </div>
                        </div>
                      </div>

                      <div className="flex items-center gap-2 justify-end shrink-0">
                        <button
                          type="button"
                          onClick={() => handleSelectSavedList(item)}
                          className="px-3.5 py-1.5 rounded-xl bg-emerald-500/20 hover:bg-emerald-500/30 text-emerald-300 text-xs font-bold border border-emerald-500/40 transition-all cursor-pointer flex items-center gap-1 group-hover:bg-emerald-500 group-hover:text-black"
                        >
                          <Check className="w-3.5 h-3.5" />
                          <span>انتخاب و بارگذاری</span>
                        </button>

                        <button
                          type="button"
                          onClick={(e) => handleDeleteSavedList(e, item)}
                          disabled={deletingListId === item.id}
                          className="p-2 rounded-xl bg-rose-500/10 hover:bg-rose-500/25 text-rose-400 border border-rose-500/30 transition-colors cursor-pointer disabled:opacity-50"
                          title="حذف این لیست از دیتابیس"
                        >
                          {deletingListId === item.id ? (
                            <Loader2 className="w-3.5 h-3.5 animate-spin" />
                          ) : (
                            <Trash2 className="w-3.5 h-3.5" />
                          )}
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        ) : (
          /* ======================================================== */
          /* پنجره اصلی جدول ارزها، جستجو و فیلترهای سریع */
          /* ======================================================== */
          <>
            {/* Toolbar: Search, Load Selector & Quick Filters */}
            <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-2.5 shrink-0 bg-[#131926] p-2.5 rounded-2xl border border-[#202c3f]">
              <div className="relative flex-1">
                <Search className="w-4 h-4 text-gray-400 absolute right-3 top-1/2 -translate-y-1/2 pointer-events-none" />
                <input
                  type="text"
                  placeholder={`جستجو در ارزهای ${activeExchange.toUpperCase()} (BTC, SOL, DOGE...)`}
                  value={pairsSearchQuery}
                  onChange={(e) => setPairsSearchQuery(e.target.value)}
                  className="w-full pr-9 pl-3 py-1.5 bg-[#0a0d14] border border-[#2a384d] rounded-xl text-xs text-white placeholder-gray-500 focus:outline-none focus:border-amber-400"
                />
              </div>

              <div className="flex items-center gap-1.5 flex-wrap">
                {/* دکمه فیلتر هوشمند مجازهای OpenAPI (حذف ۴۰۶ ارز بدون API) */}
                {activeExchange === 'xt' && (
                  <button
                    type="button"
                    onClick={() => setFilterOnlyOpenApi((prev) => !prev)}
                    className={`px-2.5 py-1.5 rounded-xl text-[11px] font-bold border transition-all cursor-pointer flex items-center gap-1.5 ${
                      filterOnlyOpenApi
                        ? 'bg-emerald-500/20 text-emerald-300 border-emerald-500/40 shadow-xs'
                        : 'bg-[#182232] text-gray-400 border-[#2a384d] hover:text-white'
                    }`}
                    title="فیلتر ارزهایی که توسط صرافی XT برای معاملات خودکار OpenAPI مجاز نیستند"
                  >
                    <Filter className="w-3.5 h-3.5" />
                    <span>فقط مجازهای OpenAPI</span>
                    <span className={`px-1.5 py-0.5 rounded-md text-[10px] font-mono ${filterOnlyOpenApi ? 'bg-emerald-950 text-emerald-300' : 'bg-gray-800 text-gray-400'}`}>
                      {filterOnlyOpenApi ? `${apiSupportedCount || allAvailablePairs.length} ارز` : `همه (${unsupportedCount} بدون API)`}
                    </span>
                  </button>
                )}

                <button
                  type="button"
                  onClick={handleToggleSelectAllPairs}
                  className="px-2.5 py-1.5 rounded-xl bg-[#1c2538] hover:bg-[#25324c] text-white text-[11px] font-bold border border-[#2f3f59] transition-colors cursor-pointer flex items-center gap-1"
                >
                  {filteredPairs.length > 0 && filteredPairs.every((p) => tempSelectedSymbols.has(p.symbol)) ? (
                    <>
                      <Square className="w-3.5 h-3.5 text-rose-400" />
                      <span>لغو این لیست</span>
                    </>
                  ) : (
                    <>
                      <CheckSquare className="w-3.5 h-3.5 text-emerald-400" />
                      <span>انتخاب همه ({filteredPairs.length})</span>
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

                {/* دکمه پاکسازی نمادهای بدون API در صورت وجود در انتخاب‌ها */}
                {selectedUnsupportedCount > 0 && (
                  <button
                    type="button"
                    onClick={handleRemoveUnsupportedSymbols}
                    className="px-2 py-1.5 rounded-xl bg-rose-500/15 hover:bg-rose-500/25 text-rose-300 text-[11px] font-bold border border-rose-500/40 transition-colors cursor-pointer flex items-center gap-1"
                    title="حذف نمادهایی که در صرافی XT فاقد قابلیت OpenAPI هستند"
                  >
                    <Trash2 className="w-3.5 h-3.5 text-rose-400" />
                    <span>حذف {selectedUnsupportedCount} ارز بدون API</span>
                  </button>
                )}

                {/* دکمه باز کردن لیست‌های ذخیره‌شده (تا ۱۰ لیست) */}
                <button
                  type="button"
                  onClick={() => setShowSavedListsView(true)}
                  disabled={isLoadingDb}
                  title={`مشاهده و انتخاب از بین ${savedLists.length} لیست ذخیره‌شده صرافی ${activeExchange.toUpperCase()}`}
                  className="px-2.5 py-1.5 rounded-xl bg-emerald-500/15 hover:bg-emerald-500/25 text-emerald-300 text-[11px] font-bold border border-emerald-500/30 transition-colors cursor-pointer flex items-center gap-1"
                >
                  <CloudDownload className="w-3.5 h-3.5 text-emerald-400" />
                  <span>بارگذاری از دیتابیس ({savedLists.length}/۱۰)</span>
                </button>
              </div>
            </div>

            {/* هشدار در صورت انتخاب ارزهای فاقد پشتیبانی OpenAPI */}
            {selectedUnsupportedCount > 0 && (
              <div className="bg-rose-950/40 border border-rose-500/40 rounded-2xl px-3 py-2 flex items-center justify-between text-xs text-rose-300 shrink-0">
                <div className="flex items-center gap-2">
                  <AlertCircle className="w-4 h-4 text-rose-400 shrink-0" />
                  <span>
                    توجه: <strong>{selectedUnsupportedCount}</strong> ارز انتخاب‌شده توسط صرافی {activeExchange.toUpperCase()} برای سفارش‌گذاری خودکار API مجاز نیستند (OpenAPI Disabled) و در صورت ارسال سیگنال خطا خواهند داد.
                  </span>
                </div>
                <button
                  type="button"
                  onClick={handleRemoveUnsupportedSymbols}
                  className="px-2.5 py-1 rounded-lg bg-rose-600 hover:bg-rose-500 text-white font-bold text-[11px] cursor-pointer whitespace-nowrap"
                >
                  حذف خودکار این ارزها
                </button>
              </div>
            )}

            {/* List / Table of Coins with Market Cap */}
            <div className="flex-1 overflow-y-auto pr-1 space-y-1 max-h-[46vh] border border-[#1b2434] rounded-2xl p-2 bg-[#090d14]">
              {isLoadingAllPairs ? (
                <div className="py-16 text-center space-y-2">
                  <Loader2 className="w-7 h-7 text-amber-400 animate-spin mx-auto" />
                  <p className="text-xs text-gray-400">در حال دریافت فهرست جفت‌ارزها و مارکت‌کپ از {activeExchange.toUpperCase()}...</p>
                </div>
              ) : filteredPairs.length === 0 ? (
                <div className="py-12 text-center text-xs text-gray-400">
                  {filterOnlyOpenApi
                    ? 'هیچ ارز دارای OpenAPI با این عبارت جستجو یافت نشد.'
                    : 'هیچ جفت‌ارزی با این عبارت جستجو یافت نشد.'}
                </div>
              ) : (
                <div className="space-y-1">
                  <div className="grid grid-cols-12 px-3 py-1.5 text-[10px] font-bold text-gray-400 border-b border-[#1c2637]">
                    <div className="col-span-1 text-center">انتخاب</div>
                    <div className="col-span-4">ارز و جفت‌معاملاتی</div>
                    <div className="col-span-3 text-left font-mono">مارکت‌کپ (Market Cap)</div>
                    <div className="col-span-2 text-left">بیشترین اهرم</div>
                    <div className="col-span-2 text-center">وضعیت OpenAPI</div>
                  </div>

                  {filteredPairs.map((pair, idx) => {
                    const isChecked = tempSelectedSymbols.has(pair.symbol);
                    const maxLev = getMaxLeverageForSymbol(pair.symbol);
                    const marketCap = (pair as any).marketCap || getEstimatedMarketCap(pair.baseAsset, pair.volume24h);
                    const isApiAllowed = pair.isApiSupported !== false && pair.isOpenApi !== false && pair.tradeSwitch !== false;

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
                            : !isApiAllowed
                            ? 'bg-rose-950/20 border-rose-900/30 text-gray-300 hover:border-rose-700/50'
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

                        <div className="col-span-3 text-left font-mono font-bold text-emerald-400 text-xs">
                          {formatMarketCap(marketCap)}
                        </div>

                        <div className="col-span-2 text-left">
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

                        <div className="col-span-2 text-center">
                          {isApiAllowed ? (
                            <span className="px-1.5 py-0.5 rounded text-[9px] font-bold bg-emerald-950/60 text-emerald-400 border border-emerald-500/30">
                              مجاز در API
                            </span>
                          ) : (
                            <span className="px-1.5 py-0.5 rounded text-[9px] font-bold bg-rose-950/80 text-rose-400 border border-rose-500/40" title="معاملات OpenAPI توسط صرافی برای این جفت‌ارز بسته است">
                              ⛔ بدون API
                            </span>
                          )}
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          </>
        )}

        {/* Modal Footer with Save Name Input and Action Buttons */}
        <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3 pt-2 border-t border-[#1f283a] shrink-0">
          {/* ورودی نام لیست جهت ذخیره در دیتابیس */}
          <div className="flex items-center gap-2 flex-1 max-w-sm">
            <span className="text-[11px] text-gray-400 whitespace-nowrap">نام لیست:</span>
            <input
              type="text"
              value={listName}
              onChange={(e) => setListName(e.target.value)}
              placeholder="مثلا: ۱۰ ارز برتر یا اسکلپ"
              className="flex-1 px-2.5 py-1.5 bg-[#0b0e14] border border-[#2b394e] rounded-xl text-xs text-white placeholder-gray-500 focus:outline-none focus:border-cyan-400"
            />
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
              className="px-3.5 py-2 rounded-xl bg-[#1d273a] hover:bg-[#26344d] text-cyan-300 border border-cyan-500/30 text-xs font-bold transition-colors cursor-pointer flex items-center gap-1.5 disabled:opacity-50"
              title={`ذخیره در دیتابیس Firestore برای صرافی ${activeExchange.toUpperCase()} (${savedLists.length}/۱۰)`}
            >
              {isSavingDb ? (
                <Loader2 className="w-4 h-4 animate-spin text-cyan-400" />
              ) : (
                <Database className="w-4 h-4 text-cyan-400" />
              )}
              <span>ذخیره در دیتابیس ({savedLists.length}/۱۰)</span>
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

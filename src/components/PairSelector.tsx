import React, { useState, useRef, useEffect } from 'react';
import { Search, ChevronDown, Check, TrendingUp, TrendingDown, Star, Sparkles } from 'lucide-react';
import { CryptoPair, Ticker24h } from '../types/crypto';
import { POPULAR_PAIRS, fetchFuturesMarketPairs, fetchUSDTMarketPairs } from '../services/binance';
import { formatPrice } from '../utils/indicators';

interface PairSelectorProps {
  selectedPair: CryptoPair;
  onSelectPair: (pair: CryptoPair) => void;
  ticker?: Ticker24h | null;
}

export const PairSelector: React.FC<PairSelectorProps> = ({
  selectedPair,
  onSelectPair,
  ticker,
}) => {
  const [isOpen, setIsOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [activeCategory, setActiveCategory] = useState<string>('All');
  const [availablePairs, setAvailablePairs] = useState<CryptoPair[]>(POPULAR_PAIRS);
  const dropdownRef = useRef<HTMLDivElement>(null);

  // دریافت پیش‌فرض جفت‌ارزهای فیوچرز بایننس (USDT-M Futures)
  useEffect(() => {
    let isMounted = true;
    fetchFuturesMarketPairs(200_000).then((futuresPairs) => {
      if (isMounted && futuresPairs.length > 0) {
        // ادغام با جفت‌ارزهای محبوب جهت حفظ دسته‌بندی‌ها
        const map = new Map<string, CryptoPair>();
        for (const p of POPULAR_PAIRS) map.set(p.symbol, p);
        for (const p of futuresPairs) {
          if (!map.has(p.symbol)) {
            map.set(p.symbol, p);
          }
        }
        setAvailablePairs(Array.from(map.values()));
      }
    }).catch(() => {
      // Fallback
      fetchUSDTMarketPairs(1_000_000).then((pairs) => {
        if (isMounted && pairs.length > 0) {
          setAvailablePairs(pairs);
        }
      });
    });
    return () => {
      isMounted = false;
    };
  }, []);

  // Close dropdown on outside click
  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        setIsOpen(false);
      }
    }
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const categories = ['All', 'Futures', 'Popular', 'Layer 1', 'DeFi', 'Meme', 'AI & Tech'];

  const filteredPairs = availablePairs.filter((pair) => {
    const matchesSearch =
      pair.symbol.toLowerCase().includes(searchQuery.toLowerCase()) ||
      pair.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      pair.baseAsset.toLowerCase().includes(searchQuery.toLowerCase());

    const matchesCategory =
      activeCategory === 'All' ||
      pair.category === activeCategory ||
      (activeCategory === 'Futures' && (pair.category === 'Futures' || pair.symbol.endsWith('USDT')));

    return matchesSearch && matchesCategory;
  });

  const handleCustomSymbolSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const clean = searchQuery.trim().toUpperCase();
    if (!clean) return;

    let symbol = clean;
    let base = clean;
    if (clean.endsWith('USDT')) {
      base = clean.replace('USDT', '');
    } else {
      symbol = `${clean}USDT`;
    }

    const customPair: CryptoPair = {
      symbol,
      baseAsset: base,
      quoteAsset: 'USDT',
      name: base,
      category: 'Popular',
    };

    onSelectPair(customPair);
    setIsOpen(false);
    setSearchQuery('');
  };

  const isPositive = (ticker?.priceChangePercent ?? 0) >= 0;

  return (
    <div className="relative inline-block text-left" ref={dropdownRef}>
      {/* Trigger Button: Styled like Binance / TradingView pair selector */}
      <button
        type="button"
        onClick={() => setIsOpen(!isOpen)}
        className="flex items-center gap-2.5 px-3 py-1.5 rounded-lg bg-[#1e2329] hover:bg-[#2b313a] border border-[#2e3542] transition-colors cursor-pointer group"
      >
        <div className="flex items-center gap-2">
          <div className="w-7 h-7 rounded-full bg-gradient-to-br from-amber-500/20 to-yellow-500/30 border border-amber-500/40 flex items-center justify-center font-bold text-amber-400 text-xs shadow-inner">
            {selectedPair.baseAsset.slice(0, 3)}
          </div>
          <div className="text-left">
            <div className="flex items-center gap-1.5 leading-none">
              <span className="font-bold text-white text-base tracking-wide group-hover:text-amber-400 transition-colors">
                {selectedPair.baseAsset}
              </span>
              <span className="text-xs text-gray-400 font-medium">/{selectedPair.quoteAsset}</span>
            </div>
            <span className="text-[11px] text-gray-400 block leading-tight">{selectedPair.name}</span>
          </div>
        </div>

        <ChevronDown
          className={`w-4 h-4 text-gray-400 transition-transform duration-200 ${isOpen ? 'rotate-180' : ''}`}
        />
      </button>

      {/* Dropdown Menu */}
      {isOpen && (
        <div className="absolute top-full left-0 mt-2 w-84 sm:w-96 rounded-xl bg-[#181d24] border border-[#2b313a] shadow-2xl z-50 overflow-hidden backdrop-blur-md">
          {/* Search bar */}
          <div className="p-3 border-b border-[#2b313a] bg-[#14181f]">
            <form onSubmit={handleCustomSymbolSubmit} className="relative">
              <Search className="w-4 h-4 text-gray-400 absolute left-3 top-1/2 -translate-y-1/2" />
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="جستجوی نماد (مثلا BTC, SOL, PEPE)..."
                autoFocus
                className="w-full pl-9 pr-4 py-2 bg-[#1e2329] border border-[#2f3642] rounded-lg text-sm text-white placeholder-gray-500 focus:outline-none focus:border-amber-400 transition-all"
              />
            </form>

            {/* Category tabs */}
            <div className="flex items-center gap-1.5 mt-2.5 overflow-x-auto pb-1 text-xs no-scrollbar">
              {categories.map((cat) => (
                <button
                  key={cat}
                  onClick={() => setActiveCategory(cat)}
                  className={`px-2.5 py-1 rounded-md whitespace-nowrap transition-colors cursor-pointer ${
                    activeCategory === cat
                      ? 'bg-amber-400/15 text-amber-400 font-semibold border border-amber-400/30'
                      : 'text-gray-400 hover:text-gray-200 hover:bg-[#222831]'
                  }`}
                >
                  {cat === 'All' ? 'همه' : cat}
                </button>
              ))}
            </div>
          </div>

          {/* List of Pairs */}
          <div className="max-h-72 overflow-y-auto divide-y divide-[#232934] scrollbar-thin">
            {filteredPairs.length > 0 ? (
              filteredPairs.map((pair) => {
                const isSelected = pair.symbol === selectedPair.symbol;
                return (
                  <button
                    key={pair.symbol}
                    type="button"
                    onClick={() => {
                      onSelectPair(pair);
                      setIsOpen(false);
                      setSearchQuery('');
                    }}
                    className={`w-full px-3 py-2.5 flex items-center justify-between hover:bg-[#222832] transition-colors text-left cursor-pointer ${
                      isSelected ? 'bg-[#1f2735]' : ''
                    }`}
                  >
                    <div className="flex items-center gap-2.5">
                      <div className="w-6 h-6 rounded-full bg-[#2a313d] flex items-center justify-center text-[10px] font-bold text-gray-300">
                        {pair.baseAsset.slice(0, 2)}
                      </div>
                      <div>
                        <div className="flex items-center gap-1">
                          <span className="font-semibold text-white text-sm">{pair.baseAsset}</span>
                          <span className="text-xs text-gray-500">/{pair.quoteAsset}</span>
                        </div>
                        <span className="text-[11px] text-gray-400">{pair.name}</span>
                      </div>
                    </div>

                    <div className="flex items-center gap-2">
                      <span className="text-xs px-2 py-0.5 rounded bg-[#252c38] text-gray-300 font-mono">
                        {pair.category}
                      </span>
                      {isSelected && <Check className="w-4 h-4 text-amber-400" />}
                    </div>
                  </button>
                );
              })
            ) : (
              <div className="p-4 text-center">
                <p className="text-gray-400 text-xs mb-2">نماد «{searchQuery}» در لیست پیش‌فرض یافت نشد.</p>
                <button
                  type="button"
                  onClick={handleCustomSymbolSubmit}
                  className="px-3 py-1.5 bg-amber-500 hover:bg-amber-400 text-black font-semibold text-xs rounded-lg transition-colors cursor-pointer"
                >
                  دریافت مستقیم {searchQuery.toUpperCase()}USDT از بایننس
                </button>
              </div>
            )}
          </div>

          {/* Footer note */}
          <div className="px-3 py-2 bg-[#12161c] border-t border-[#232934] flex items-center justify-between text-[11px] text-gray-400">
            <span className="flex items-center gap-1">
              <Sparkles className="w-3.5 h-3.5 text-amber-400" />
              داده‌های اسپات آنلاین بایننس (Binance Spot)
            </span>
            <span className="font-mono text-gray-400">{filteredPairs.length} جفت‌ارز</span>
          </div>
        </div>
      )}
    </div>
  );
};

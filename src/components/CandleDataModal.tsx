import React, { useState } from 'react';
import { X, Download, Copy, Check, Table, Search } from 'lucide-react';
import { CandleData, CryptoPair, Timeframe } from '../types/crypto';
import { formatPrice, formatVolume } from '../utils/indicators';

interface CandleDataModalProps {
  isOpen: boolean;
  onClose: () => void;
  candles: CandleData[];
  pair: CryptoPair;
  timeframe: Timeframe;
}

export const CandleDataModal: React.FC<CandleDataModalProps> = ({
  isOpen,
  onClose,
  candles,
  pair,
  timeframe,
}) => {
  const [copied, setCopied] = useState(false);
  const [page, setPage] = useState(1);
  const pageSize = 50;

  if (!isOpen) return null;

  // Newest first for inspection
  const reversedCandles = [...candles].reverse();
  const totalPages = Math.ceil(reversedCandles.length / pageSize);
  const currentCandles = reversedCandles.slice((page - 1) * pageSize, page * pageSize);

  const handleCopyJson = () => {
    navigator.clipboard.writeText(JSON.stringify(candles, null, 2));
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const handleExportCsv = () => {
    const headers = 'Timestamp,Date,Open,High,Low,Close,Volume,QuoteVolume\n';
    const rows = candles
      .map((c) => {
        const d = new Date(c.time * 1000).toISOString();
        return `${c.time},${d},${c.open},${c.high},${c.low},${c.close},${c.volume},${c.quoteVolume || 0}`;
      })
      .join('\n');

    const blob = new Blob([headers + rows], { type: 'text/csv' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `${pair.symbol}_${timeframe}_binance_candles.csv`;
    a.click();
    URL.revokeObjectURL(url);
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-6 bg-black/70 backdrop-blur-xs">
      <div className="bg-[#181d26] border border-[#2e3747] w-full max-w-4xl max-h-[85vh] rounded-2xl shadow-2xl flex flex-col overflow-hidden">
        {/* Header */}
        <div className="px-5 py-4 border-b border-[#2b3342] flex items-center justify-between bg-[#151922]">
          <div className="flex items-center gap-2.5">
            <Table className="w-5 h-5 text-amber-400" />
            <div>
              <h2 className="text-sm font-bold text-white">
                داده‌های خام کندل‌استیک بایننس (OHLCV Dataset)
              </h2>
              <span className="text-xs text-gray-400">
                {pair.baseAsset}/{pair.quoteAsset} · تایم‌فریم {timeframe} · {candles.length} کندل
              </span>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <button
              onClick={handleCopyJson}
              className="px-3 py-1.5 rounded-lg bg-[#222936] hover:bg-[#2c3444] text-xs text-gray-200 transition-colors flex items-center gap-1.5 cursor-pointer"
            >
              {copied ? <Check className="w-3.5 h-3.5 text-emerald-400" /> : <Copy className="w-3.5 h-3.5" />}
              <span>{copied ? 'کپی شد' : 'کپی JSON'}</span>
            </button>

            <button
              onClick={handleExportCsv}
              className="px-3 py-1.5 rounded-lg bg-amber-500 hover:bg-amber-400 text-black font-semibold text-xs transition-colors flex items-center gap-1.5 cursor-pointer"
            >
              <Download className="w-3.5 h-3.5" />
              <span>دانلود CSV</span>
            </button>

            <button
              onClick={onClose}
              className="p-1.5 rounded-lg hover:bg-[#2b3342] text-gray-400 hover:text-white transition-colors cursor-pointer"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>

        {/* Table Body */}
        <div className="flex-1 overflow-y-auto p-4 scrollbar-thin">
          <table className="w-full text-xs font-mono text-left">
            <thead>
              <tr className="border-b border-[#2b3342] text-gray-400 bg-[#141820]">
                <th className="py-2.5 px-3">زمان (UTC / محلی)</th>
                <th className="py-2.5 px-3">Open (بازگشایی)</th>
                <th className="py-2.5 px-3">High (بیشترین)</th>
                <th className="py-2.5 px-3">Low (کمترین)</th>
                <th className="py-2.5 px-3">Close (بسته شدن)</th>
                <th className="py-2.5 px-3 text-right">Volume (حجم)</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-[#222834]">
              {currentCandles.map((c) => {
                const isGreen = c.close >= c.open;
                const d = new Date(c.time * 1000);
                const dateStr = d.toLocaleString('en-US', {
                  month: 'short',
                  day: 'numeric',
                  hour: '2-digit',
                  minute: '2-digit',
                  hour12: false,
                });

                return (
                  <tr key={c.time} className="hover:bg-[#1f2633] transition-colors">
                    <td className="py-2 px-3 text-gray-400 font-sans">{dateStr}</td>
                    <td className="py-2 px-3 text-gray-200">${formatPrice(c.open)}</td>
                    <td className="py-2 px-3 text-emerald-400">${formatPrice(c.high)}</td>
                    <td className="py-2 px-3 text-rose-400">${formatPrice(c.low)}</td>
                    <td className={`py-2 px-3 font-semibold ${isGreen ? 'text-[#0ecb81]' : 'text-[#f6465d]'}`}>
                      ${formatPrice(c.close)}
                    </td>
                    <td className="py-2 px-3 text-right text-gray-300 font-sans">
                      {formatVolume(c.volume)}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>

        {/* Pagination Footer */}
        <div className="px-5 py-3 border-t border-[#2b3342] bg-[#151922] flex items-center justify-between text-xs text-gray-400">
          <span>
            نمایش {(page - 1) * pageSize + 1} تا {Math.min(page * pageSize, candles.length)} از {candles.length} کندل
          </span>

          <div className="flex items-center gap-1.5">
            <button
              onClick={() => setPage((p) => Math.max(1, p - 1))}
              disabled={page === 1}
              className="px-2.5 py-1 rounded bg-[#222936] text-gray-300 disabled:opacity-40 cursor-pointer"
            >
              صفحه قبل
            </button>
            <span className="font-mono text-white px-2">
              {page} / {totalPages}
            </span>
            <button
              onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
              disabled={page === totalPages}
              className="px-2.5 py-1 rounded bg-[#222936] text-gray-300 disabled:opacity-40 cursor-pointer"
            >
              صفحه بعد
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};

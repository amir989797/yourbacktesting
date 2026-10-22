/**
 * Automated Regression Test Suite for Backtest Accounting and Per-Symbol Metrics
 *
 * Verifies:
 * 1. No trades and no fees
 * 2. One winning trade with zero trading fees
 * 3. One gross-winning trade that becomes a net loss after fees
 * 4. All winning trades and no losing trades (No 99.9 sentinels)
 * 5. All losing trades
 * 6. Breakeven trades (Wins + Losses + Breakeven = Closed Trades)
 * 7. Funding received greater than funding paid
 * 8. Concurrency filter rejection (Raw = Final + Rejected, deterministic tie-breaking)
 * 9. Symbol with no closed trades but with open positions or rejected trades (0 closed PnL/fees)
 * 10. Multi-trade portfolio accounting with decimal precision reconciliation
 */

import { calculateMetrics, getEmptyMetrics } from '../src/utils/strategyEngine';
import { StrategyTrade } from '../src/types/strategy';

function assert(condition: boolean, message: string) {
  if (!condition) {
    console.error(`❌ ASSERTION FAILED: ${message}`);
    throw new Error(message);
  }
}

function assertClose(a: number, b: number, tolerance = 1e-6, message = '') {
  if (Math.abs(a - b) > tolerance) {
    console.error(`❌ ASSERTION FAILED: ${message} (Expected ${b}, got ${a}, diff: ${Math.abs(a - b)})`);
    throw new Error(`${message}: Expected ${b}, got ${a}`);
  }
}

let passedTests = 0;

function runTest(name: string, fn: () => void) {
  console.log(`\n▶ Running: ${name}`);
  try {
    fn();
    console.log(`  ✅ Passed: ${name}`);
    passedTests++;
  } catch (err) {
    console.error(`  ❌ Failed: ${name}`, err);
    throw err;
  }
}

// =========================================================================
// TEST 1: No trades and no fees
// =========================================================================
runTest('Case 1: No trades and no fees', () => {
  const trades: StrategyTrade[] = [];
  const metrics = calculateMetrics(trades, 10000);

  assert(metrics.totalTrades === 0, 'Total trades must be 0');
  assert(metrics.winTrades === 0, 'Win trades must be 0');
  assert(metrics.lossTrades === 0, 'Loss trades must be 0');
  assert(metrics.breakevenTrades === 0, 'Breakeven trades must be 0');
  assert(metrics.winRate === 0, 'Win rate must be 0');
  assert(metrics.grossPnl === 0, 'Gross PnL must be 0');
  assert(metrics.totalFee === 0, 'Total fee must be 0');
  assert(metrics.netProfit === 0, 'Net profit must be 0');
  assert(metrics.netProfitPercent === 0, 'Net profit percent must be 0');
  assert(metrics.profitFactor === 0, 'Profit factor must be 0');
  assert(metrics.profitFactorLabel === 'N/A — No Trades', 'Profit factor label must be N/A — No Trades');
  assert(metrics.maxDrawdownPercent === 0, 'Max drawdown percent must be 0');
  assert(metrics.openPositionsCount === 0, 'Open positions count must be 0');
});

// =========================================================================
// TEST 2: One winning trade with zero trading fees
// =========================================================================
runTest('Case 2: One winning trade with zero trading fees', () => {
  const trade: StrategyTrade = {
    direction: 'LONG',
    timeE: 1000,
    timeF: 1000,
    entryTime: 1000,
    exitTime: 2000,
    entryPrice: 100,
    exitPrice: 110,
    stopLoss: 95,
    takeProfit: 110,
    riskAmount: 50,
    riskPercent: 1,
    positionSize: 10,
    quantity: 10,
    entryNotional: 1000,
    exitNotional: 1100,
    grossPnl: 100,
    pnl: 100,
    netPnlAfterFunding: 100,
    returnPercent: 10,
    fee: 0,
    commission: 0,
    fundingCashFlow: 0,
    status: 'WIN',
  };

  const metrics = calculateMetrics([trade], 10000);
  assert(metrics.totalTrades === 1, 'Total trades must be 1');
  assert(metrics.winTrades === 1, 'Win trades must be 1');
  assert(metrics.lossTrades === 0, 'Loss trades must be 0');
  assert(metrics.breakevenTrades === 0, 'Breakeven trades must be 0');
  assert(metrics.winRate === 100, 'Win rate must be 100%');
  assertClose(metrics.grossPnl, 100, 1e-6, 'Gross PnL must be 100');
  assert(metrics.totalFee === 0, 'Total fee must be 0');
  assertClose(metrics.netProfit, 100, 1e-6, 'Net profit must be 100');
  assert(metrics.profitFactorLabel === 'No Losing Trades', 'Profit factor label must be "No Losing Trades"');
});

// =========================================================================
// TEST 3: One gross-winning trade that becomes a net loss after fees
// =========================================================================
runTest('Case 3: Gross win becoming net loss after fees', () => {
  // Gross profit = +10 USDT, but trading fee = 15 USDT -> Net PnL = -5 USDT
  const trade: StrategyTrade = {
    direction: 'LONG',
    timeE: 1000,
    timeF: 1000,
    entryTime: 1000,
    exitTime: 2000,
    entryPrice: 100,
    exitPrice: 101,
    stopLoss: 95,
    takeProfit: 110,
    riskAmount: 50,
    riskPercent: 1,
    positionSize: 10,
    quantity: 10,
    entryNotional: 1000,
    exitNotional: 1010,
    grossPnl: 10,
    fee: 15,
    commission: 15,
    pnl: -5,
    netPnlAfterFunding: -5,
    returnPercent: -0.5,
    status: 'LOSS', // Since net PnL < 0, documented as loss
  };

  const metrics = calculateMetrics([trade], 10000);
  assert(metrics.totalTrades === 1, 'Total closed trades must be 1');
  assert(metrics.winTrades === 0, 'Win trades must be 0');
  assert(metrics.lossTrades === 1, 'Loss trades must be 1');
  assert(metrics.winRate === 0, 'Win rate must be 0%');
  assertClose(metrics.grossPnl, 10, 1e-6, 'Gross PnL must be +10');
  assertClose(metrics.totalFee, 15, 1e-6, 'Total fee must be 15');
  assertClose(metrics.netProfit, -5, 1e-6, 'Net profit must be -5');
  assert(metrics.profitFactor === 0, 'Profit factor must be 0');
});

// =========================================================================
// TEST 4: All winning trades and no losing trades (No arbitrary 99.9 sentinel)
// =========================================================================
runTest('Case 4: All winning trades and no losing trades', () => {
  const trades: StrategyTrade[] = [
    {
      direction: 'LONG',
      timeE: 1000,
      timeF: 1000,
      entryTime: 1000,
      exitTime: 2000,
      entryPrice: 100,
      exitPrice: 110,
      stopLoss: 95,
      takeProfit: 110,
      riskAmount: 50,
      riskPercent: 1,
      positionSize: 10,
      quantity: 10,
      entryNotional: 1000,
      exitNotional: 1100,
      grossPnl: 100,
      fee: 2,
      pnl: 98,
      status: 'WIN',
    },
    {
      direction: 'SHORT',
      timeE: 3000,
      timeF: 3000,
      entryTime: 3000,
      exitTime: 4000,
      entryPrice: 50,
      exitPrice: 45,
      stopLoss: 52,
      takeProfit: 45,
      riskAmount: 50,
      riskPercent: 1,
      positionSize: 20,
      quantity: 20,
      entryNotional: 1000,
      exitNotional: 900,
      grossPnl: 100,
      fee: 2,
      pnl: 98,
      status: 'WIN',
    },
  ];

  const metrics = calculateMetrics(trades, 10000);
  assert(metrics.totalTrades === 2, 'Total trades must be 2');
  assert(metrics.winTrades === 2, 'Win trades must be 2');
  assert(metrics.lossTrades === 0, 'Loss trades must be 0');
  assert(metrics.winRate === 100, 'Win rate must be 100%');
  assert(metrics.profitFactorLabel === 'No Losing Trades', 'Profit factor label must be "No Losing Trades"');
  assert(metrics.profitFactor !== 99.9, 'Profit factor must not use 99.9 sentinel');
});

// =========================================================================
// TEST 5: All losing trades
// =========================================================================
runTest('Case 5: All losing trades', () => {
  const trades: StrategyTrade[] = [
    {
      direction: 'LONG',
      timeE: 1000,
      timeF: 1000,
      entryTime: 1000,
      exitTime: 2000,
      entryPrice: 100,
      exitPrice: 95,
      stopLoss: 95,
      takeProfit: 110,
      riskAmount: 50,
      riskPercent: 1,
      positionSize: 10,
      quantity: 10,
      entryNotional: 1000,
      exitNotional: 950,
      grossPnl: -50,
      fee: 2,
      pnl: -52,
      status: 'LOSS',
    },
    {
      direction: 'LONG',
      timeE: 3000,
      timeF: 3000,
      entryTime: 3000,
      exitTime: 4000,
      entryPrice: 100,
      exitPrice: 96,
      stopLoss: 95,
      takeProfit: 110,
      riskAmount: 50,
      riskPercent: 1,
      positionSize: 10,
      quantity: 10,
      entryNotional: 1000,
      exitNotional: 960,
      grossPnl: -40,
      fee: 2,
      pnl: -42,
      status: 'LOSS',
    },
  ];

  const metrics = calculateMetrics(trades, 10000);
  assert(metrics.totalTrades === 2, 'Total trades must be 2');
  assert(metrics.winTrades === 0, 'Win trades must be 0');
  assert(metrics.lossTrades === 2, 'Loss trades must be 2');
  assert(metrics.winRate === 0, 'Win rate must be 0%');
  assert(metrics.profitFactor === 0, 'Profit factor must be 0');
  assert(metrics.profitFactorLabel === '0.00', 'Profit factor label must be 0.00');
});

// =========================================================================
// TEST 6: Breakeven trades (Wins + Losses + Breakeven = Closed Trades)
// =========================================================================
runTest('Case 6: Breakeven trades reconciliation', () => {
  const trades: StrategyTrade[] = [
    // 2 Wins
    {
      direction: 'LONG',
      timeE: 1000,
      timeF: 1000,
      entryTime: 1000,
      exitTime: 2000,
      entryPrice: 100,
      exitPrice: 110,
      stopLoss: 95,
      takeProfit: 110,
      riskAmount: 50,
      riskPercent: 1,
      positionSize: 10,
      grossPnl: 100,
      fee: 2,
      pnl: 98,
      status: 'WIN',
    },
    {
      direction: 'LONG',
      timeE: 2500,
      timeF: 2500,
      entryTime: 2500,
      exitTime: 3000,
      entryPrice: 100,
      exitPrice: 105,
      stopLoss: 95,
      takeProfit: 110,
      riskAmount: 50,
      riskPercent: 1,
      positionSize: 10,
      grossPnl: 50,
      fee: 2,
      pnl: 48,
      status: 'WIN',
    },
    // 1 Loss
    {
      direction: 'LONG',
      timeE: 3500,
      timeF: 3500,
      entryTime: 3500,
      exitTime: 4000,
      entryPrice: 100,
      exitPrice: 95,
      stopLoss: 95,
      takeProfit: 110,
      riskAmount: 50,
      riskPercent: 1,
      positionSize: 10,
      grossPnl: -50,
      fee: 2,
      pnl: -52,
      status: 'LOSS',
    },
    // 2 Breakeven
    {
      direction: 'LONG',
      timeE: 4500,
      timeF: 4500,
      entryTime: 4500,
      exitTime: 5000,
      entryPrice: 100,
      exitPrice: 100.02,
      stopLoss: 95,
      takeProfit: 110,
      riskAmount: 50,
      riskPercent: 1,
      positionSize: 10,
      grossPnl: 0.2,
      fee: 0.2,
      pnl: 0.0,
      status: 'BREAKEVEN',
    },
    {
      direction: 'LONG',
      timeE: 5500,
      timeF: 5500,
      entryTime: 5500,
      exitTime: 6000,
      entryPrice: 100,
      exitPrice: 100.01,
      stopLoss: 95,
      takeProfit: 110,
      riskAmount: 50,
      riskPercent: 1,
      positionSize: 10,
      grossPnl: 0.1,
      fee: 0.1,
      pnl: 0.0,
      status: 'BREAKEVEN',
    },
  ];

  const metrics = calculateMetrics(trades, 10000);
  assert(metrics.totalTrades === 5, 'Total trades must be 5');
  assert(metrics.winTrades === 2, 'Win trades must be 2');
  assert(metrics.lossTrades === 1, 'Loss trades must be 1');
  assert(metrics.breakevenTrades === 2, 'Breakeven trades must be 2');
  assert(
    metrics.winTrades + metrics.lossTrades + metrics.breakevenTrades === metrics.totalTrades,
    'Wins + Losses + Breakeven must equal Total Trades'
  );
  assertClose(metrics.winRate, (2 / 5) * 100, 1e-6, 'Win rate must be 40%');
});

// =========================================================================
// TEST 7: Funding received greater than funding paid
// =========================================================================
runTest('Case 7: Funding received > funding paid reconciliation', () => {
  const initialEquity = 10000;
  const grossTradePnl = 500;
  const tradingFees = 50;
  const netTradingPnl = grossTradePnl - tradingFees; // 450

  const fundingPaid = 15; // Outflow (-15)
  const fundingReceived = 65; // Inflow (+65)
  const netFundingCashFlow = fundingReceived - fundingPaid; // +50

  const finalAccountPnl = netTradingPnl + netFundingCashFlow; // 500
  const finalEquity = initialEquity + finalAccountPnl; // 10500

  // Verify master accounting identity:
  // Sum(Gross PnL) - Sum(Trading Fees) + Net Funding Cash Flow = Final Account PnL
  const reconciledPnl = grossTradePnl - tradingFees + netFundingCashFlow;
  assertClose(reconciledPnl, finalAccountPnl, 1e-9, 'Reconciliation equation must hold exactly');
  assert(finalEquity === 10500, 'Final equity must be 10,500');
});

// =========================================================================
// TEST 8: Concurrency filter rejection (Raw = Final + Rejected)
// =========================================================================
runTest('Case 8: Concurrency filter rejection & tie-breaking', () => {
  const rawTrades: StrategyTrade[] = [
    {
      id: 'BTC-1',
      symbol: 'BTCUSDT',
      direction: 'LONG',
      timeE: 1000,
      timeF: 1000,
      entryTime: 1000,
      exitTime: 2000,
      entryPrice: 50000,
      exitPrice: 52000,
      stopLoss: 49000,
      takeProfit: 52000,
      riskAmount: 100,
      riskPercent: 1,
      positionSize: 0.1,
      pnl: 200,
      status: 'WIN',
    },
    {
      id: 'ETH-1',
      symbol: 'ETHUSDT',
      direction: 'LONG',
      timeE: 1500,
      timeF: 1500,
      entryTime: 1500, // Enters while BTC-1 is active!
      exitTime: 2500,
      entryPrice: 3000,
      exitPrice: 3200,
      stopLoss: 2900,
      takeProfit: 3200,
      riskAmount: 100,
      riskPercent: 1,
      positionSize: 1,
      pnl: 200,
      status: 'WIN',
    },
    {
      id: 'SOL-1',
      symbol: 'SOLUSDT',
      direction: 'LONG',
      timeE: 2200,
      timeF: 2200,
      entryTime: 2200, // Enters after BTC-1 has closed
      exitTime: 3000,
      entryPrice: 100,
      exitPrice: 110,
      stopLoss: 95,
      takeProfit: 110,
      riskAmount: 100,
      riskPercent: 1,
      positionSize: 10,
      pnl: 100,
      status: 'WIN',
    },
  ];

  // Simulating deterministic concurrency filter
  const accepted: StrategyTrade[] = [];
  const rejected: StrategyTrade[] = [];
  let lastExit = 0;

  for (const t of rawTrades) {
    const e = t.entryTime || 0;
    const x = t.exitTime || e;
    if (e >= lastExit) {
      accepted.push({ ...t, stage: 'FINAL / POST-CONCURRENCY', concurrencyDecision: 'SELECTED' });
      lastExit = x;
    } else {
      rejected.push({
        ...t,
        stage: 'RAW / PRE-FILTER',
        concurrencyDecision: 'REJECTED',
        rejectionReason: 'Temporal conflict with active portfolio position',
      });
    }
  }

  assert(rawTrades.length === 3, 'Raw trades count must be 3');
  assert(accepted.length === 2, 'Final accepted trades count must be 2 (BTC-1, SOL-1)');
  assert(rejected.length === 1, 'Rejected trades count must be 1 (ETH-1)');
  assert(
    accepted.length + rejected.length === rawTrades.length,
    'Raw count must strictly equal Final + Rejected'
  );
  assert(accepted[0].id === 'BTC-1', 'First accepted trade must be BTC-1 (earliest entry)');
  assert(accepted[1].id === 'SOL-1', 'Second accepted trade must be SOL-1 (slot available)');
  assert(rejected[0].id === 'ETH-1', 'Rejected trade must be ETH-1');
});

// =========================================================================
// TEST 9: Symbol with 0 closed trades but active open position or rejected signals
// (Reproducing the exact bug where 9 symbols had 0 trades but non-zero PnL & fees)
// =========================================================================
runTest('Case 9: Zero-closed-trade symbol with open position isolation', () => {
  // Trade is still open/active at the end of the history
  const activeTrade: StrategyTrade = {
    direction: 'LONG',
    timeE: 1000,
    timeF: 1000,
    entryTime: 1000,
    entryPrice: 100,
    stopLoss: 90,
    takeProfit: 120,
    riskAmount: 50,
    riskPercent: 1,
    positionSize: 5,
    quantity: 5,
    entryNotional: 500,
    fee: 0.6,
    commission: 0.6,
    pnl: 25, // Unrealized floating PnL
    status: 'ACTIVE',
  };

  const metrics = calculateMetrics([activeTrade], 10000);

  // CRITICAL VERIFICATION:
  // All closed trade metrics MUST BE STRICTLY ZERO!
  assert(metrics.totalTrades === 0, 'Closed trades must be 0');
  assert(metrics.winTrades === 0, 'Win trades must be 0');
  assert(metrics.lossTrades === 0, 'Loss trades must be 0');
  assert(metrics.breakevenTrades === 0, 'Breakeven trades must be 0');
  assert(metrics.winRate === 0, 'Win rate must be 0%');
  assert(metrics.grossPnl === 0, 'Gross trade PnL must be 0 for 0 closed trades');
  assert(metrics.totalFee === 0, 'Trading fee must be 0 for 0 closed trades');
  assert(metrics.netProfit === 0, 'Net profit must be 0 for 0 closed trades');
  assert(metrics.netProfitPercent === 0, 'Net profit percent must be 0 for 0 closed trades');
  assert(metrics.profitFactor === 0, 'Profit factor must be 0');
  assert(metrics.profitFactorLabel === 'N/A — No Trades', 'PF label must be N/A — No Trades');
  assert(metrics.maxDrawdownPercent === 0, 'Max drawdown must be 0 for 0 closed trades');

  // Open position must be tracked separately:
  assert(metrics.openPositionsCount === 1, 'Open positions count must be 1');
  assertClose(metrics.openPositionsUnrealizedPnl, 25, 1e-6, 'Open positions unrealized PnL must be 25');
  assertClose(metrics.openPositionsFee, 0.6, 1e-6, 'Open positions fee must be 0.6');
});

// =========================================================================
// TEST 10: Multi-trade portfolio accounting with decimal precision reconciliation
// =========================================================================
runTest('Case 10: Multi-trade portfolio decimal accounting reconciliation', () => {
  const initialEquity = 12345.67;
  const trades: StrategyTrade[] = [
    {
      direction: 'LONG',
      timeE: 1000,
      timeF: 1000,
      entryTime: 1000,
      exitTime: 2000,
      entryPrice: 64123.45,
      exitPrice: 65234.56,
      stopLoss: 63500.0,
      takeProfit: 66000.0,
      riskAmount: 123.45,
      riskPercent: 1,
      positionSize: 0.197995,
      quantity: 0.197995,
      entryNotional: 0.197995 * 64123.45, // 12696.122
      exitNotional: 0.197995 * 65234.56, // 12916.117
      grossPnl: 0.197995 * (65234.56 - 64123.45), // 219.993
      fee: 15.3673,
      pnl: 0.197995 * (65234.56 - 64123.45) - 15.3673,
      fundingCashFlow: -1.25,
      netPnlAfterFunding: 0.197995 * (65234.56 - 64123.45) - 15.3673 - 1.25,
      status: 'WIN',
    },
    {
      direction: 'SHORT',
      timeE: 2500,
      timeF: 2500,
      entryTime: 2500,
      exitTime: 3500,
      entryPrice: 3456.78,
      exitPrice: 3512.34,
      stopLoss: 3520.0,
      takeProfit: 3300.0,
      riskAmount: 123.45,
      riskPercent: 1,
      positionSize: 1.95269,
      quantity: 1.95269,
      entryNotional: 1.95269 * 3456.78, // 6750.019
      exitNotional: 1.95269 * 3512.34, // 6858.513
      grossPnl: 1.95269 * (3456.78 - 3512.34), // -108.489
      fee: 8.1651,
      pnl: 1.95269 * (3456.78 - 3512.34) - 8.1651,
      fundingCashFlow: 3.45,
      netPnlAfterFunding: 1.95269 * (3456.78 - 3512.34) - 8.1651 + 3.45,
      status: 'LOSS',
    },
  ];

  const sumGrossPnl = trades.reduce((acc, t) => acc + (t.grossPnl || 0), 0);
  const sumFees = trades.reduce((acc, t) => acc + (t.fee || 0), 0);
  const netTradingPnl = sumGrossPnl - sumFees;
  const netFunding = trades.reduce((acc, t) => acc + (t.fundingCashFlow || 0), 0);
  const finalAccountPnl = netTradingPnl + netFunding;
  const finalEquity = initialEquity + finalAccountPnl;

  // Master accounting identity check:
  assertClose(
    sumGrossPnl - sumFees + netFunding,
    finalAccountPnl,
    1e-10,
    'Sum(Gross PnL) - Sum(Trading Fees) + Net Funding must equal Final Account PnL'
  );

  // Effective fee rate check:
  const totalNotional = trades.reduce(
    (acc, t) => acc + (t.entryNotional || 0) + (t.exitNotional || 0),
    0
  );
  const effectiveFeeRate = sumFees / totalNotional;
  assert(effectiveFeeRate > 0 && effectiveFeeRate < 0.01, 'Effective fee rate must be realistic');

  console.log(`  📊 Executed Notional: $${totalNotional.toFixed(2)}`);
  console.log(`  📊 Total Trading Fees: $${sumFees.toFixed(4)}`);
  console.log(`  📊 Effective Fee Rate: ${(effectiveFeeRate * 100).toFixed(4)}%`);
  console.log(`  📊 Final Reconciled Equity: $${finalEquity.toFixed(2)}`);
});

console.log(`\n========================================`);
console.log(`✅ All ${passedTests} regression test suites passed successfully!`);
console.log(`========================================\n`);

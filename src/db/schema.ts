import { boolean, doublePrecision, index, integer, pgTable, serial, text, timestamp } from 'drizzle-orm/pg-core';

// 1. Users table
export const users = pgTable('users', {
  id: serial('id').primaryKey(),
  uid: text('uid').notNull().unique(), // Auth UID
  email: text('email'),
  displayName: text('display_name'),
  createdAt: timestamp('created_at').defaultNow(),
});

// 2. Market Candle Datasets Metadata
export const candleDatasets = pgTable('candle_datasets', {
  id: text('id').primaryKey(), // e.g. range_xt_5m_1704067200000_1706745600000
  name: text('name').notNull(),
  userId: text('user_id').notNull(),
  timeframe: text('timeframe').notNull(),
  exchange: text('exchange').default('xt'),
  startTime: text('start_time'),
  endTime: text('end_time'),
  symbolCount: integer('symbol_count').default(0),
  totalCandles: integer('total_candles').default(0),
  symbolsList: text('symbols_list'), // JSON string of symbols array
  dataSizeBytes: integer('data_size_bytes').default(0),
  dataSizeFormatted: text('data_size_formatted'),
  isTemporary: boolean('is_temporary').default(false),
  status: text('status').default('COMPLETED'), // 'DOWNLOADING' | 'ANALYZING' | 'COMPLETED' | 'ERROR'
  resultsJson: text('results_json'), // Serialized backtest results
  strategyId: text('strategy_id'),
  strategyConfigJson: text('strategy_config_json'),
  createdAt: timestamp('created_at').defaultNow(),
  updatedAt: timestamp('updated_at').defaultNow(),
}, (table) => [
  index('idx_candle_datasets_user_id').on(table.userId),
  index('idx_candle_datasets_range').on(table.exchange, table.timeframe, table.startTime, table.endTime),
]);

// 3. Candle Chunks for fast partitioned storage
export const candleChunks = pgTable('candle_chunks', {
  id: serial('id').primaryKey(),
  datasetId: text('dataset_id').notNull(),
  chunkIndex: integer('chunk_index').notNull(),
  itemsJson: text('items_json').notNull(), // JSON string of candle chunk tuples
  createdAt: timestamp('created_at').defaultNow(),
}, (table) => [
  index('idx_candle_chunks_dataset').on(table.datasetId, table.chunkIndex),
]);

// 4. Test Parameter Configurations
export const testConfigs = pgTable('test_configs', {
  id: text('id').primaryKey(),
  name: text('name').notNull(),
  userId: text('user_id').notNull(),
  timeframe: text('timeframe').notNull(),
  capital: integer('capital').default(1000),
  riskPercent: text('risk_percent').default('2'),
  selectedStrategyId: text('selected_strategy_id').notNull(),
  configDataJson: text('config_data_json').notNull(), // JSON string of test parameters
  createdAt: timestamp('created_at').defaultNow(),
  updatedAt: timestamp('updated_at').defaultNow(),
}, (table) => [
  index('idx_test_configs_user_id').on(table.userId),
]);

// 5. Live Scanner Signals
export const liveSignals = pgTable('live_signals', {
  id: serial('id').primaryKey(),
  symbol: text('symbol').notNull(),
  posSide: text('pos_side').notNull(), // 'LONG' | 'SHORT'
  side: text('side').notNull(),       // 'BUY' | 'SELL'
  curPrice: doublePrecision('cur_price').notNull(),
  stopLoss: doublePrecision('stop_loss').notNull(),
  takeProfit: doublePrecision('take_profit').notNull(),
  contractQty: doublePrecision('contract_qty').notNull(),
  maxLeverage: integer('max_leverage').notNull(),
  requiredMargin: doublePrecision('required_margin').notNull(),
  notionalUsdt: doublePrecision('notional_usdt').notNull(),
  riskUsdt: doublePrecision('risk_usdt').notNull(),
  targetRiskUsdt: doublePrecision('target_risk_usdt'),
  strategyName: text('strategy_name').notNull(),
  discoveredAt: timestamp('discovered_at').defaultNow(),
}, (table) => [
  index('idx_live_signals_symbol').on(table.symbol),
  index('idx_live_signals_discovered').on(table.discoveredAt),
]);

// 6. Live Trade Orders & Exchange Executions
export const liveTrades = pgTable('live_trades', {
  id: text('id').primaryKey(), // exec_... or order-...
  orderId: text('order_id'),
  userId: text('user_id').default('default'),
  exchange: text('exchange').notNull().default('xt'), // 'xt' | 'binance'
  symbol: text('symbol').notNull(),
  side: text('side').notNull(),       // 'BUY' | 'SELL'
  posSide: text('pos_side').notNull(), // 'LONG' | 'SHORT'
  price: doublePrecision('price').notNull(),
  amount: doublePrecision('amount').notNull(),
  status: text('status').notNull().default('NEW'), // 'SUCCESS' | 'FILLED' | 'FAILED' | 'CANCELED'
  stopLoss: doublePrecision('stop_loss'),
  takeProfit: doublePrecision('take_profit'),
  realizedPnl: doublePrecision('realized_pnl').default(0),
  strategyName: text('strategy_name'),
  payloadJson: text('payload_json'),
  responseJson: text('response_json'),
  errorMessage: text('error_message'),
  createdAt: timestamp('created_at').defaultNow(),
}, (table) => [
  index('idx_live_trades_user_id').on(table.userId),
  index('idx_live_trades_symbol').on(table.symbol),
  index('idx_live_trades_created_at').on(table.createdAt),
]);

// 7. Allowed Pairs Custom Watchlists
export const allowedPairs = pgTable('allowed_pairs', {
  id: text('id').primaryKey(),
  userId: text('user_id').notNull(),
  name: text('name').notNull(),
  exchange: text('exchange').notNull().default('xt'),
  symbolsList: text('symbols_list').notNull(), // JSON string of symbols array
  createdAt: timestamp('created_at').defaultNow(),
  updatedAt: timestamp('updated_at').defaultNow(),
}, (table) => [
  index('idx_allowed_pairs_user_exchange').on(table.userId, table.exchange),
]);


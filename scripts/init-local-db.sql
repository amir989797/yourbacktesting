-- ============================================================================
-- Crypto Strategy Lab - PostgreSQL Database Initialization Script
-- Compatible with PostgreSQL 13+ (Self-Hosted / Local)
-- ============================================================================

-- Optional: Create Database & Connect (run if starting completely from scratch)
-- CREATE DATABASE crypto_strategy_lab;
-- \c crypto_strategy_lab;

-- 1. Users Table
CREATE TABLE IF NOT EXISTS users (
    id SERIAL PRIMARY KEY,
    uid TEXT NOT NULL UNIQUE,
    email TEXT,
    display_name TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- 2. Market Candle Datasets Metadata
CREATE TABLE IF NOT EXISTS candle_datasets (
    id TEXT PRIMARY KEY,
    name TEXT NOT NULL,
    user_id TEXT NOT NULL,
    timeframe TEXT NOT NULL,
    symbol_count INTEGER DEFAULT 0,
    total_candles INTEGER DEFAULT 0,
    symbols_list TEXT,
    data_size_bytes INTEGER DEFAULT 0,
    data_size_formatted TEXT,
    is_temporary BOOLEAN DEFAULT FALSE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_candle_datasets_user_id ON candle_datasets(user_id);

-- 3. Candle Chunks (Partitioned fast storage for multi-coin candlestick data)
CREATE TABLE IF NOT EXISTS candle_chunks (
    id SERIAL PRIMARY KEY,
    dataset_id TEXT NOT NULL,
    chunk_index INTEGER NOT NULL,
    items_json TEXT NOT NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_candle_chunks_dataset ON candle_chunks(dataset_id, chunk_index);

-- 4. Test Parameter Configurations
CREATE TABLE IF NOT EXISTS test_configs (
    id TEXT PRIMARY KEY,
    name TEXT NOT NULL,
    user_id TEXT NOT NULL,
    timeframe TEXT NOT NULL,
    capital INTEGER DEFAULT 1000,
    risk_percent TEXT DEFAULT '2',
    selected_strategy_id TEXT NOT NULL,
    config_data_json TEXT NOT NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_test_configs_user_id ON test_configs(user_id);

-- 5. Live Scanner Signals
CREATE TABLE IF NOT EXISTS live_signals (
    id SERIAL PRIMARY KEY,
    symbol TEXT NOT NULL,
    pos_side TEXT NOT NULL,
    side TEXT NOT NULL,
    cur_price DOUBLE PRECISION NOT NULL,
    stop_loss DOUBLE PRECISION NOT NULL,
    take_profit DOUBLE PRECISION NOT NULL,
    contract_qty DOUBLE PRECISION NOT NULL,
    max_leverage INTEGER NOT NULL,
    required_margin DOUBLE PRECISION NOT NULL,
    notional_usdt DOUBLE PRECISION NOT NULL,
    risk_usdt DOUBLE PRECISION NOT NULL,
    target_risk_usdt DOUBLE PRECISION,
    strategy_name TEXT NOT NULL,
    discovered_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_live_signals_symbol ON live_signals(symbol);
CREATE INDEX IF NOT EXISTS idx_live_signals_discovered ON live_signals(discovered_at DESC);

-- 6. Live Trade Orders & Exchange Executions
CREATE TABLE IF NOT EXISTS live_trades (
    id TEXT PRIMARY KEY,
    order_id TEXT,
    user_id TEXT DEFAULT 'default',
    exchange TEXT NOT NULL DEFAULT 'xt',
    symbol TEXT NOT NULL,
    side TEXT NOT NULL,
    pos_side TEXT NOT NULL,
    price DOUBLE PRECISION NOT NULL,
    amount DOUBLE PRECISION NOT NULL,
    status TEXT NOT NULL DEFAULT 'NEW',
    stop_loss DOUBLE PRECISION,
    take_profit DOUBLE PRECISION,
    realized_pnl DOUBLE PRECISION DEFAULT 0,
    strategy_name TEXT,
    payload_json TEXT,
    response_json TEXT,
    error_message TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_live_trades_user_id ON live_trades(user_id);
CREATE INDEX IF NOT EXISTS idx_live_trades_symbol ON live_trades(symbol);
CREATE INDEX IF NOT EXISTS idx_live_trades_created_at ON live_trades(created_at DESC);

-- 7. Allowed Pairs Custom Watchlists
CREATE TABLE IF NOT EXISTS allowed_pairs (
    id TEXT PRIMARY KEY,
    user_id TEXT NOT NULL,
    name TEXT NOT NULL,
    exchange TEXT NOT NULL DEFAULT 'xt',
    symbols_list TEXT NOT NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_allowed_pairs_user_exchange ON allowed_pairs(user_id, exchange);

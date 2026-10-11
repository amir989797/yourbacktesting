import { boolean, integer, pgTable, serial, text, timestamp } from 'drizzle-orm/pg-core';

// Users table
export const users = pgTable('users', {
  id: serial('id').primaryKey(),
  uid: text('uid').notNull().unique(), // Firebase Auth UID
  email: text('email'),
  displayName: text('display_name'),
  createdAt: timestamp('created_at').defaultNow(),
});

// Market Candle Datasets Metadata (both temporary live session buffers and permanent datasets)
export const candleDatasets = pgTable('candle_datasets', {
  id: text('id').primaryKey(), // e.g. dataset_1791... or temp_amir_5m
  name: text('name').notNull(),
  userId: text('user_id').notNull(),
  timeframe: text('timeframe').notNull(),
  symbolCount: integer('symbol_count').default(0),
  totalCandles: integer('total_candles').default(0),
  symbolsList: text('symbols_list'), // JSON string of symbols array
  dataSizeBytes: integer('data_size_bytes').default(0),
  dataSizeFormatted: text('data_size_formatted'),
  isTemporary: boolean('is_temporary').default(false),
  createdAt: timestamp('created_at').defaultNow(),
  updatedAt: timestamp('updated_at').defaultNow(),
});

// Candle Chunks for fast relational partitioned storage
export const candleChunks = pgTable('candle_chunks', {
  id: serial('id').primaryKey(),
  datasetId: text('dataset_id').notNull(),
  chunkIndex: integer('chunk_index').notNull(),
  itemsJson: text('items_json').notNull(), // JSON string of candle chunk tuples
  createdAt: timestamp('created_at').defaultNow(),
});

// Test Parameter Configurations
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
});

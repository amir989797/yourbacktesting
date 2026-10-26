import { defineConfig } from 'drizzle-kit';

export default defineConfig({
  schema: './src/db/schema.ts',
  out: './drizzle',
  dialect: 'postgresql',
  dbCredentials: {
    url: process.env.DATABASE_URL || 'postgresql://admin:x3Yuxl6T89GaWF0y1R@193.142.58.196:5432/crypto_strategy_lab',
    ssl: false,
  },
});

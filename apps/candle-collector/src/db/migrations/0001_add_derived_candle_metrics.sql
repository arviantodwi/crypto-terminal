-- Add derived candle metric columns as nullable first to allow backfill of any existing rows
ALTER TABLE "ohlcv_candles" ADD COLUMN "pct_change" double precision;
ALTER TABLE "ohlcv_candles" ADD COLUMN "candle_range" double precision;
ALTER TABLE "ohlcv_candles" ADD COLUMN "body_ratio" double precision;

-- Backfill any existing rows before enforcing NOT NULL
UPDATE "ohlcv_candles"
SET
  pct_change   = ((close - open) / open) * 100,
  candle_range = ((high - low) / open) * 100,
  body_ratio   = CASE WHEN high = low THEN 1.0 ELSE ABS(close - open) / (high - low) END;

-- Enforce NOT NULL now that all rows have values
ALTER TABLE "ohlcv_candles" ALTER COLUMN "pct_change" SET NOT NULL;
ALTER TABLE "ohlcv_candles" ALTER COLUMN "candle_range" SET NOT NULL;
ALTER TABLE "ohlcv_candles" ALTER COLUMN "body_ratio" SET NOT NULL;

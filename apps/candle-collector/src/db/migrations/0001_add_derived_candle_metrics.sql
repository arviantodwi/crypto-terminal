-- Add derived candle metric columns as nullable first to allow backfill of any existing rows
ALTER TABLE "ohlcv_candles" ADD COLUMN "pct_change" double precision;
ALTER TABLE "ohlcv_candles" ADD COLUMN "candle_range" double precision;
ALTER TABLE "ohlcv_candles" ADD COLUMN "body_ratio" double precision;

-- Backfill any existing rows before enforcing NOT NULL
UPDATE "ohlcv_candles"
SET
  pct_change   = CASE WHEN open = 0 THEN 0 ELSE ((close - open) / open) * 100 END,
  candle_range = CASE WHEN open = 0 THEN 0 ELSE ((high - low) / open) * 100 END,
  -- When high = low (zero-range / doji candle), treat body as 100% of range by convention
  body_ratio   = CASE WHEN high = low THEN 1.0 ELSE ABS(close - open) / (high - low) END;

-- Enforce NOT NULL now that all rows have values
ALTER TABLE "ohlcv_candles" ALTER COLUMN "pct_change" SET NOT NULL;
ALTER TABLE "ohlcv_candles" ALTER COLUMN "candle_range" SET NOT NULL;
ALTER TABLE "ohlcv_candles" ALTER COLUMN "body_ratio" SET NOT NULL;

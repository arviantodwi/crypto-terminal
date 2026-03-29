-- Should return 0 rows if clean (primary key already prevents exact dupes,
-- but this catches logical duplicates if the PK were ever bypassed)
SELECT instrument, open_time, timeframe, COUNT(*) AS cnt
FROM ohlcv_candles
GROUP BY instrument, open_time, timeframe
HAVING COUNT(*) > 1;

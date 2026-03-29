-- Returns rows where the gap to the next candle is not exactly 300 seconds.
-- An empty result means every consecutive pair is exactly 5 minutes apart.
SELECT
  instrument,
  timeframe,
  open_time                                           AS current_open,
  to_timestamp(open_time)  AT TIME ZONE 'UTC'         AS current_open_utc,
  next_open_time                                      AS next_open,
  to_timestamp(next_open_time) AT TIME ZONE 'UTC'     AS next_open_utc,
  (next_open_time - open_time)                        AS gap_seconds
FROM (
  SELECT
    instrument,
    timeframe,
    open_time,
    LEAD(open_time) OVER (
      PARTITION BY instrument, timeframe
      ORDER BY open_time
    ) AS next_open_time
  FROM ohlcv_candles
) gaps
WHERE next_open_time IS NOT NULL
  AND (next_open_time - open_time) <> 300
ORDER BY instrument, timeframe, open_time;

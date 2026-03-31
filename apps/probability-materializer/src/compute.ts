import { classifyCandle } from '@crypto-terminal/trade-formula';

interface OhlcvRow {
  pct_change: number;
  body_ratio: number;
}

interface PatternAccumulator {
  up_count: number;
  down_count: number;
}

export interface ComputedRow {
  instrument: string;
  timeframe: string;
  c1_label: string;
  c2_label: string;
  c3_label: string;
  occurrences: number;
  up_count: number;
  down_count: number;
  up_probability: number;
  down_probability: number;
}

export interface ComputeResult {
  rows: ComputedRow[];
  total_windows: number;
  skipped_windows: number;
}

export function computeProbabilities(
  candles: OhlcvRow[],
  instrument: string,
  timeframe: string,
): ComputeResult {
  const accumulator = new Map<string, PatternAccumulator>();
  let total_windows = 0;
  let skipped_windows = 0;

  for (let i = 0; i <= candles.length - 4; i++) {
    total_windows++;

    const c1 = candles[i]!;
    const c2 = candles[i + 1]!;
    const c3 = candles[i + 2]!;
    const c4 = candles[i + 3]!;

    const c1_label = classifyCandle(c1.pct_change, c1.body_ratio);
    const c2_label = classifyCandle(c2.pct_change, c2.body_ratio);
    const c3_label = classifyCandle(c3.pct_change, c3.body_ratio);

    if (c1_label === 'flat' || c2_label === 'flat' || c3_label === 'flat') {
      skipped_windows++;
      continue;
    }

    const c4_label = classifyCandle(c4.pct_change, c4.body_ratio);

    if (c4_label === 'flat') {
      skipped_windows++;
      continue;
    }

    const key = `${c1_label}|${c2_label}|${c3_label}`;
    const existing = accumulator.get(key) ?? { up_count: 0, down_count: 0 };

    if (c4_label.startsWith('up_')) {
      existing.up_count++;
    } else {
      existing.down_count++;
    }

    accumulator.set(key, existing);
  }

  const rows: ComputedRow[] = [];

  for (const [key, counts] of accumulator.entries()) {
    const parts = key.split('|');
    const c1_label = parts[0]!;
    const c2_label = parts[1]!;
    const c3_label = parts[2]!;
    const occurrences = counts.up_count + counts.down_count;
    const up_probability = (counts.up_count / occurrences) * 100;
    const down_probability = (counts.down_count / occurrences) * 100;

    rows.push({
      instrument,
      timeframe,
      c1_label,
      c2_label,
      c3_label,
      occurrences,
      up_count: counts.up_count,
      down_count: counts.down_count,
      up_probability,
      down_probability,
    });
  }

  return { rows, total_windows, skipped_windows };
}

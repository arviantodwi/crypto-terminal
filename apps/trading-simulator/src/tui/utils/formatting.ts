// ── Currency / percent formatting ─────────────────────────────────────────────

export function formatCurrency(value: number): string {
  return `$${value.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
}

export function formatPercent(value: number): string {
  const sign = value >= 0 ? '+' : '';
  return `${sign}${value.toFixed(2)}%`;
}

/** "MM-DD HH:mm" */
export function formatTimestamp(date: Date): string {
  const mm = String(date.getMonth() + 1).padStart(2, '0');
  const dd = String(date.getDate()).padStart(2, '0');
  const hh = String(date.getHours()).padStart(2, '0');
  const min = String(date.getMinutes()).padStart(2, '0');
  return `${mm}-${dd} ${hh}:${min}`;
}

export function formatNumber(value: number, decimals = 3): string {
  if (Number.isNaN(value)) return 'NaN';
  if (!Number.isFinite(value)) return value > 0 ? '∞' : '-∞';
  return value.toFixed(decimals);
}

// ── Equity curve ASCII chart ──────────────────────────────────────────────────

/**
 * Render a filled ASCII bar chart from a list of balance values.
 *
 * Returns an array of strings, one per row (top to bottom).
 * Each string is exactly `width` characters wide.
 */
export function renderEquityCurve(values: number[], width: number, height: number): string[] {
  if (values.length === 0 || width === 0 || height === 0) {
    return Array(height).fill(' '.repeat(width));
  }

  const min = Math.min(...values);
  const max = Math.max(...values);
  const range = max - min;

  // Sample values to fit width
  const sampled: number[] = [];
  for (let i = 0; i < width; i++) {
    const idx = Math.floor((i / width) * values.length);
    sampled.push(values[Math.min(idx, values.length - 1)]!);
  }

  // Normalize each sample to a row index (0 = bottom, height-1 = top)
  const normalized = sampled.map((v) =>
    range > 0
      ? Math.round(((v - min) / range) * (height - 1))
      : Math.floor(height / 2),
  );

  // Build rows from top (height-1) to bottom (0)
  const rows: string[] = [];
  for (let row = height - 1; row >= 0; row--) {
    let line = '';
    for (let col = 0; col < width; col++) {
      line += (normalized[col] ?? 0) >= row ? '█' : ' ';
    }
    rows.push(line);
  }

  return rows;
}

// ── Speed level label ─────────────────────────────────────────────────────────

export function formatSpeed(speed: number): string {
  return speed === 0 ? 'MAX' : `${speed}x`;
}

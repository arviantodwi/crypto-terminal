// ── Currency / percent formatting ─────────────────────────────────────────────

export function formatCurrency(value: number): string {
  return `$${value.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
}

export function formatPercent(value: number): string {
  const sign = value >= 0 ? '+' : '';
  return `${sign}${value.toFixed(2)}%`;
}

/** "YYYY-MM-DD HH:mm" */
export function formatTimestamp(date: Date): string {
  const yyyy = String(date.getFullYear());
  const mm = String(date.getMonth() + 1).padStart(2, '0');
  const dd = String(date.getDate()).padStart(2, '0');
  const hh = String(date.getHours()).padStart(2, '0');
  const min = String(date.getMinutes()).padStart(2, '0');
  return `${yyyy}-${mm}-${dd} ${hh}:${min}`;
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

  const min = values.reduce((a, b) => (b < a ? b : a), values[0]!);
  const max = values.reduce((a, b) => (b > a ? b : a), values[0]!);
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

// ── Relative elapsed time ─────────────────────────────────────────────────────

/**
 * Parse a timeframe string like "5m", "1h", "4h", "1d" into minutes.
 * Returns 0 if the format is unrecognised.
 */
function timeframeToMinutes(timeframe: string): number {
  const match = timeframe.match(/^(\d+)([mhd])$/);
  if (!match) return 0;
  const n = parseInt(match[1]!, 10);
  switch (match[2]) {
    case 'm': return n;
    case 'h': return n * 60;
    case 'd': return n * 60 * 24;
    default:  return 0;
  }
}

/**
 * Format total elapsed minutes as a human-readable relative duration.
 * Examples: "5m", "59m", "1h 43m", "1d 13h 9m", "1mo 9d 8h 11m", "1y 4mo 12d 19h 3m"
 */
export function formatRelativeTime(candlesProcessed: number, timeframe: string): string {
  const totalMinutes = candlesProcessed * timeframeToMinutes(timeframe);
  if (totalMinutes <= 0) return '—';

  const MINS_IN_YEAR  = 60 * 24 * 365;
  const MINS_IN_MONTH = 60 * 24 * 30;
  const MINS_IN_DAY   = 60 * 24;
  const MINS_IN_HOUR  = 60;

  let remaining = Math.floor(totalMinutes);
  const years  = Math.floor(remaining / MINS_IN_YEAR);  remaining %= MINS_IN_YEAR;
  const months = Math.floor(remaining / MINS_IN_MONTH); remaining %= MINS_IN_MONTH;
  const days   = Math.floor(remaining / MINS_IN_DAY);   remaining %= MINS_IN_DAY;
  const hours  = Math.floor(remaining / MINS_IN_HOUR);  remaining %= MINS_IN_HOUR;
  const mins   = remaining;

  const hh  = String(hours).padStart(2, '0');
  const mm  = String(mins).padStart(2, '0');

  const parts: string[] = [];
  if (years)  parts.push(`${years}y`);
  if (months) parts.push(`${months}mo`);
  if (days)   parts.push(`${days}d`);
  if (hours || parts.length > 0) parts.push(`${hh}h`);
  if (mins  || parts.length > 0) parts.push(`${mm}m`);
  if (parts.length === 0) parts.push('00m');

  return parts.join(' ');
}

// ── Speed level label ─────────────────────────────────────────────────────────

export function formatSpeed(speed: number): string {
  return speed === 0 ? 'MAX' : `${speed}x`;
}

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

export interface CurveRow { label: string; line: string; }
export interface EquityCurveResult { rows: CurveRow[]; xAxis: string; }

/**
 * Render a filled bar chart with a ▀ top-edge indicator from equity curve points.
 *
 * Each column is filled with █ from the bottom up to the normalized value,
 * with ▀ placed at the top cell to suggest a continuous line.
 * Returns labeled rows (Y-axis % label + chart line) and an X-axis date string.
 */
export function renderEquityCurve(
  points: { timestamp: Date; balance: number }[],
  width: number,
  height: number,
): EquityCurveResult {
  const empty = (w: number) => ' '.repeat(Math.max(0, w));

  if (points.length < 2 || width <= 0 || height <= 0) {
    const rows = Array.from({ length: height }, () => ({ label: '  ', line: empty(width) }));
    return { rows, xAxis: empty(width) };
  }

  const initialBalance = points[0]!.balance;
  const balances = points.map((p) => p.balance);
  const minBal = Math.min(...balances);
  const maxBal = Math.max(...balances);
  const range = maxBal - minBal;

  // Y-axis: one label per row (top → bottom maps maxPct → minPct)
  const toPct = (b: number) => ((b - initialBalance) / initialBalance) * 100;
  const minPct = toPct(minBal);
  const maxPct = toPct(maxBal);

  const yLabels: string[] = Array.from({ length: height }, (_, i) => {
    const pct = height === 1 ? maxPct : maxPct - ((maxPct - minPct) * i) / (height - 1);
    const sign = pct >= 0 ? '+' : '';
    return `${sign}${pct.toFixed(0)}%`;
  });

  const yAxisWidth = Math.max(...yLabels.map((l) => l.length)) + 1;
  const chartWidth = Math.max(1, width - yAxisWidth);

  // Sample balances to chartWidth columns
  const sampled: number[] = Array.from({ length: chartWidth }, (_, i) => {
    const idx = Math.min(Math.floor((i / chartWidth) * points.length), points.length - 1);
    return points[idx]!.balance;
  });

  // Normalize to row index (0 = bottom, height-1 = top)
  const norm = (b: number) =>
    range > 0 ? Math.round(((b - minBal) / range) * (height - 1)) : Math.floor(height / 2);
  const normalized = sampled.map(norm);

  // Build grid: filled bar with ▀ at top edge
  // grid rows: 0 = top display row, height-1 = bottom display row
  const grid: string[][] = Array.from({ length: height }, () => Array(chartWidth).fill(' '));

  for (let col = 0; col < chartWidth; col++) {
    const cur = normalized[col]!;
    const topRow = height - 1 - cur; // grid row index for the top of this column
    // Fill body rows below top with █
    for (let r = topRow + 1; r < height; r++) {
      grid[r]![col] = '█';
    }
    // Top edge gets ▄ (lower half block): dark top, colored bottom — connects to █ below
    grid[topRow]![col] = '▄';
  }

  const rows: CurveRow[] = grid.map((rowCells, i) => ({
    label: yLabels[i]!.padStart(yAxisWidth),
    line:  rowCells.join(''),
  }));

  // X-axis: 5 evenly spaced date labels
  const timestamps = points.map((p) => p.timestamp);
  const labelCount = 5;
  const xAxisChars = Array(chartWidth).fill(' ');
  for (let li = 0; li < labelCount; li++) {
    const col = Math.floor((li / (labelCount - 1)) * (chartWidth - 1));
    const ptIdx = Math.min(Math.floor((col / chartWidth) * points.length), points.length - 1);
    const d = timestamps[ptIdx]!;
    const months = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'];
    const label = `${months[d.getMonth()]} ${String(d.getDate()).padStart(2, '0')}`;
    const startCol = li === labelCount - 1 ? chartWidth - label.length : col;
    for (let c = 0; c < label.length && startCol + c < chartWidth; c++) {
      xAxisChars[startCol + c] = label[c];
    }
  }

  const xAxis = ' '.repeat(yAxisWidth) + xAxisChars.join('');

  return { rows, xAxis };
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

// ── Hold time formatting ──────────────────────────────────────────────────────

/**
 * Format an average hold time (in fractional hours) as a human-readable string.
 * Examples: "24m", "1h 12m", "2h 00m"
 */
export function formatHoldTime(hours: number): string {
  const totalMinutes = Math.round(hours * 60);
  const h = Math.floor(totalMinutes / 60);
  const m = totalMinutes % 60;
  if (h === 0) return `${m}m`;
  return `${h}h ${String(m).padStart(2, '0')}m`;
}

// ── Speed level label ─────────────────────────────────────────────────────────

export function formatSpeed(speed: number): string {
  return speed === 0 ? 'MAX' : `${speed}x`;
}

import { describe, expect, it } from 'vitest';
import {
  averageHoldTime,
  averageLoss,
  averageWin,
  buildEquityCurve,
  calculateMetrics,
  expectedValue,
  largestLoss,
  largestWin,
  losingTrades,
  maxDrawdown,
  profitFactor,
  sharpeRatio,
  totalPnLPercent,
  totalTrades,
  winRate,
  winningTrades,
} from '../src/shared/metrics.js';
import type { ExecutedTrade } from '../src/engine/types.js';

// ── Fixtures ──────────────────────────────────────────────────────────────────

function makeTrade(
  pnlPercent: number,
  pnlDollar: number,
  opts: Partial<ExecutedTrade> = {},
): ExecutedTrade {
  return {
    id: 1,
    entryTimestamp: new Date('2026-01-01T00:00:00Z'),
    exitTimestamp: new Date('2026-01-01T01:00:00Z'),
    direction: 'LONG',
    entryPrice: 100,
    slPrice: 98,
    tpPrice: 104,
    exitPrice: pnlPercent >= 0 ? 104 : 98,
    exitReason: pnlPercent >= 0 ? 'TP' : 'SL',
    pnlPercent,
    pnlDollar,
    leverage: 5,
    metadata: {},
    ...opts,
  };
}

const WIN = makeTrade(2, 20);
const LOSS = makeTrade(-1, -10);
const BREAKEVEN = makeTrade(0, 0);

const SAMPLE_TRADES: ExecutedTrade[] = [
  makeTrade(3, 30),
  makeTrade(-1, -10),
  makeTrade(2, 20),
  makeTrade(-2, -20),
  makeTrade(5, 50),
];

// ── Edge cases ────────────────────────────────────────────────────────────────

describe('edge cases — empty trade array', () => {
  it('totalTrades returns 0', () => expect(totalTrades([])).toBe(0));
  it('winningTrades returns 0', () => expect(winningTrades([])).toBe(0));
  it('losingTrades returns 0', () => expect(losingTrades([])).toBe(0));
  it('winRate returns 0', () => expect(winRate([])).toBe(0));
  it('totalPnLPercent returns 0', () => expect(totalPnLPercent([], 1000)).toBe(0));
  it('maxDrawdown returns 0', () => expect(maxDrawdown([], 1000)).toBe(0));
  it('sharpeRatio returns 0 for < 2 trades', () => expect(sharpeRatio([WIN])).toBe(0));
  it('profitFactor returns 0 for empty', () => expect(profitFactor([])).toBe(0));
  it('expectedValue returns 0', () => expect(expectedValue([])).toBe(0));
  it('averageWin returns 0', () => expect(averageWin([])).toBe(0));
  it('averageLoss returns 0', () => expect(averageLoss([])).toBe(0));
  it('largestWin returns 0', () => expect(largestWin([])).toBe(0));
  it('largestLoss returns 0', () => expect(largestLoss([])).toBe(0));
  it('averageHoldTime returns 0', () => expect(averageHoldTime([])).toBe(0));
});

describe('edge cases — all wins', () => {
  const allWins = [makeTrade(2, 20), makeTrade(3, 30), makeTrade(1, 10)];

  it('losingTrades is 0', () => expect(losingTrades(allWins)).toBe(0));
  it('winRate is 100', () => expect(winRate(allWins)).toBe(100));
  it('profitFactor is Infinity', () => expect(profitFactor(allWins)).toBe(Infinity));
  it('averageLoss is 0', () => expect(averageLoss(allWins)).toBe(0));
  it('largestLoss is 0', () => expect(largestLoss(allWins)).toBe(0));
});

describe('edge cases — all losses', () => {
  const allLosses = [makeTrade(-1, -10), makeTrade(-2, -20), makeTrade(-3, -30)];

  it('winningTrades is 0', () => expect(winningTrades(allLosses)).toBe(0));
  it('winRate is 0', () => expect(winRate(allLosses)).toBe(0));
  it('profitFactor is 0', () => expect(profitFactor(allLosses)).toBe(0));
  it('averageWin is 0', () => expect(averageWin(allLosses)).toBe(0));
  it('largestWin is 0', () => expect(largestWin(allLosses)).toBe(0));
  it('maxDrawdown is negative', () => expect(maxDrawdown(allLosses, 1000)).toBeLessThan(0));
});

// ── Correctness tests ─────────────────────────────────────────────────────────

describe('totalTrades', () => {
  it('counts all trades', () => expect(totalTrades(SAMPLE_TRADES)).toBe(5));
});

describe('winningTrades / losingTrades', () => {
  it('counts wins (pnlPercent > 0)', () => expect(winningTrades(SAMPLE_TRADES)).toBe(3));
  it('counts losses (pnlPercent < 0)', () => expect(losingTrades(SAMPLE_TRADES)).toBe(2));
  it('breakeven trade is neither win nor loss', () => {
    const trades = [WIN, BREAKEVEN, LOSS];
    expect(winningTrades(trades)).toBe(1);
    expect(losingTrades(trades)).toBe(1);
  });
});

describe('winRate', () => {
  it('returns 60 for 3 wins out of 5', () => expect(winRate(SAMPLE_TRADES)).toBe(60));
  it('returns 0 for empty', () => expect(winRate([])).toBe(0));
});

describe('totalPnLPercent', () => {
  it('computes total dollar P&L as % of initialBalance', () => {
    // 30 - 10 + 20 - 20 + 50 = 70 on 1000 = 7%
    expect(totalPnLPercent(SAMPLE_TRADES, 1000)).toBeCloseTo(7, 5);
  });

  it('returns 0 for zero initialBalance', () => {
    expect(totalPnLPercent(SAMPLE_TRADES, 0)).toBe(0);
  });
});

describe('maxDrawdown', () => {
  it('returns 0 when balance never falls below peak', () => {
    const increasing = [makeTrade(1, 10), makeTrade(2, 20), makeTrade(3, 30)];
    expect(maxDrawdown(increasing, 1000)).toBe(0);
  });

  it('computes correct drawdown for a known sequence', () => {
    // 1000 → +100 → 1100 (peak) → -200 → 900 → drawdown = (900-1100)/1100 * 100 ≈ -18.18%
    const trades = [makeTrade(10, 100), makeTrade(-20, -200)];
    const dd = maxDrawdown(trades, 1000);
    expect(dd).toBeCloseTo(-18.18, 1);
  });
});

describe('profitFactor', () => {
  it('computes gross profit / gross loss using pnlPercent', () => {
    // gross profit (percent): 3+2+5=10, gross loss (percent): 1+2=3 → pf = 10/3 ≈ 3.33
    expect(profitFactor(SAMPLE_TRADES)).toBeCloseTo(10 / 3, 5);
  });
});

describe('expectedValue', () => {
  it('returns average pnlPercent', () => {
    // (3 - 1 + 2 - 2 + 5) / 5 = 7/5 = 1.4
    expect(expectedValue(SAMPLE_TRADES)).toBeCloseTo(1.4, 5);
  });
});

describe('averageWin / averageLoss', () => {
  it('averageWin averages positive pnlPercent', () => {
    // (3+2+5)/3 = 10/3 ≈ 3.33
    expect(averageWin(SAMPLE_TRADES)).toBeCloseTo(10 / 3, 5);
  });

  it('averageLoss averages negative pnlPercent', () => {
    // (-1-2)/2 = -1.5
    expect(averageLoss(SAMPLE_TRADES)).toBeCloseTo(-1.5, 5);
  });
});

describe('largestWin / largestLoss', () => {
  it('largestWin returns maximum positive pnlPercent', () => {
    expect(largestWin(SAMPLE_TRADES)).toBe(5);
  });

  it('largestLoss returns minimum (most negative) pnlPercent', () => {
    expect(largestLoss(SAMPLE_TRADES)).toBe(-2);
  });
});

describe('averageHoldTime', () => {
  it('returns 1 hour for 1-hour trades', () => {
    const trades = [WIN, LOSS]; // both use 1h hold time
    expect(averageHoldTime(trades)).toBeCloseTo(1, 5);
  });

  it('handles mixed hold times', () => {
    const t1 = makeTrade(1, 10, {
      entryTimestamp: new Date('2026-01-01T00:00:00Z'),
      exitTimestamp: new Date('2026-01-01T02:00:00Z'), // 2 hours
    });
    const t2 = makeTrade(-1, -10, {
      entryTimestamp: new Date('2026-01-01T00:00:00Z'),
      exitTimestamp: new Date('2026-01-01T04:00:00Z'), // 4 hours
    });
    expect(averageHoldTime([t1, t2])).toBeCloseTo(3, 5);
  });
});

describe('buildEquityCurve', () => {
  it('starts with initialBalance and appends one point per trade', () => {
    const curve = buildEquityCurve(SAMPLE_TRADES, 1000);
    // 1 initial + 5 trades = 6 points
    expect(curve).toHaveLength(6);
    expect(curve[0].balance).toBe(1000);
  });

  it('correctly tracks running balance', () => {
    const trades = [makeTrade(10, 100), makeTrade(-5, -50)];
    const curve = buildEquityCurve(trades, 1000);
    expect(curve[1].balance).toBe(1100);
    expect(curve[2].balance).toBe(1050);
  });

  it('returns single-element array for empty trades', () => {
    const start = new Date('2026-01-01T00:00:00Z');
    const curve = buildEquityCurve([], 1000, start);
    expect(curve).toHaveLength(1);
    expect(curve[0].balance).toBe(1000);
    expect(curve[0].timestamp).toEqual(start);
  });

  it('empty trades with no startTimestamp defaults to epoch (new Date(0))', () => {
    const curve = buildEquityCurve([], 1000);
    expect(curve[0].timestamp).toEqual(new Date(0));
  });
});

describe('sharpeRatio', () => {
  it('returns 0 for fewer than 2 trades', () => {
    expect(sharpeRatio([])).toBe(0);
    expect(sharpeRatio([WIN])).toBe(0);
  });

  it('returns 0 when all returns are identical (zero std dev)', () => {
    const identical = [makeTrade(2, 20), makeTrade(2, 20), makeTrade(2, 20)];
    expect(sharpeRatio(identical)).toBe(0);
  });

  it('returns positive value for overall positive returns', () => {
    const trades = [makeTrade(3, 30), makeTrade(2, 20), makeTrade(4, 40)];
    expect(sharpeRatio(trades)).toBeGreaterThan(0);
  });

  it('non-zero riskFreeReturnPercent lowers the ratio', () => {
    const trades = [makeTrade(3, 30), makeTrade(2, 20), makeTrade(4, 40)];
    const withoutRfr = sharpeRatio(trades, 0);
    const withRfr = sharpeRatio(trades, 1); // 1% per-trade risk-free return
    expect(withRfr).toBeLessThan(withoutRfr);
  });
});

describe('calculateMetrics — aggregate', () => {
  it('returns correct totalTrades', () => {
    const m = calculateMetrics(SAMPLE_TRADES, 1000);
    expect(m.totalTrades).toBe(5);
  });

  it('returns correct winRate', () => {
    const m = calculateMetrics(SAMPLE_TRADES, 1000);
    expect(m.winRate).toBe(60);
  });

  it('equityCurve has correct length', () => {
    const m = calculateMetrics(SAMPLE_TRADES, 1000);
    expect(m.equityCurve).toHaveLength(6);
  });

  it('handles empty trade array gracefully', () => {
    const m = calculateMetrics([], 1000);
    expect(m.totalTrades).toBe(0);
    expect(m.winRate).toBe(0);
    expect(m.maxDrawdown).toBe(0);
    expect(m.profitFactor).toBe(0);
    expect(m.equityCurve).toHaveLength(1);
  });
});

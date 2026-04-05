import { describe, expect, it } from 'vitest';
import { Portfolio } from '../src/engine/portfolio.js';
import type { OhlcCandle, TradeSignal } from '../src/engine/types.js';

// ── Fixtures ──────────────────────────────────────────────────────────────────

function makeCandle(opts: Partial<OhlcCandle> = {}): OhlcCandle {
  return {
    open_time: 1000,
    open: 100,
    high: 105,
    low: 95,
    close: 102,
    volume: 100,
    quote_volume: 10200,
    num_trades: 50,
    pct_change: 0.5,
    candle_range: 10,
    body_ratio: 0.4,
    ...opts,
  };
}

function makeLongSignal(opts: Partial<TradeSignal> = {}): TradeSignal {
  return {
    direction: 'LONG',
    entryPrice: 100,
    slPrice: 97,   // 3 below entry
    tpPrice: 106,  // 6 above entry (2× SL distance)
    leverage: 5,
    dollarRisk: 30,
    metadata: {},
    ...opts,
  };
}

function makeShortSignal(opts: Partial<TradeSignal> = {}): TradeSignal {
  return {
    direction: 'SHORT',
    entryPrice: 100,
    slPrice: 103,  // 3 above entry
    tpPrice: 94,   // 6 below entry (2× SL distance)
    leverage: 5,
    dollarRisk: 30,
    metadata: {},
    ...opts,
  };
}

// ── Construction ──────────────────────────────────────────────────────────────

describe('Portfolio construction', () => {
  it('starts with the provided balance', () => {
    const p = new Portfolio(1000);
    expect(p.getBalance()).toBe(1000);
  });

  it('throws when initialBalance is zero', () => {
    expect(() => new Portfolio(0)).toThrow('initialBalance must be positive');
  });

  it('throws when initialBalance is negative', () => {
    expect(() => new Portfolio(-500)).toThrow('initialBalance must be positive');
  });

  it('starts with no open position', () => {
    const p = new Portfolio(1000);
    expect(p.hasOpenPosition()).toBe(false);
    expect(p.getOpenPosition()).toBeNull();
  });

  it('starts with an empty trade list', () => {
    const p = new Portfolio(1000);
    expect(p.getTrades()).toHaveLength(0);
  });
});

// ── openPosition ──────────────────────────────────────────────────────────────

describe('openPosition()', () => {
  it('opens a LONG position and records it', () => {
    const p = new Portfolio(1000);
    p.openPosition(makeLongSignal(), 1000);
    expect(p.hasOpenPosition()).toBe(true);
    expect(p.getOpenPosition()?.side).toBe('LONG');
  });

  it('opens a SHORT position and records it', () => {
    const p = new Portfolio(1000);
    p.openPosition(makeShortSignal(), 1000);
    expect(p.hasOpenPosition()).toBe(true);
    expect(p.getOpenPosition()?.side).toBe('SHORT');
  });

  it('throws when a position is already open', () => {
    const p = new Portfolio(1000);
    p.openPosition(makeLongSignal(), 1000);
    expect(() => p.openPosition(makeLongSignal(), 2000)).toThrow('close the existing position');
  });

  it('throws when dollarRisk is zero', () => {
    const p = new Portfolio(1000);
    expect(() =>
      p.openPosition(makeLongSignal({ dollarRisk: 0 }), 1000),
    ).toThrow('dollarRisk must be positive');
  });

  it('throws when entryPrice is zero', () => {
    const p = new Portfolio(1000);
    expect(() =>
      p.openPosition(makeLongSignal({ entryPrice: 0, slPrice: -3, tpPrice: 6 }), 1000),
    ).toThrow('entryPrice must be positive');
  });

  it('throws for LONG when slPrice >= entryPrice', () => {
    const p = new Portfolio(1000);
    expect(() =>
      p.openPosition(makeLongSignal({ slPrice: 100 }), 1000),
    ).toThrow('slPrice');
    expect(() =>
      p.openPosition(makeLongSignal({ slPrice: 101 }), 1000),
    ).toThrow('slPrice');
  });

  it('throws for LONG when tpPrice <= entryPrice', () => {
    const p = new Portfolio(1000);
    expect(() =>
      p.openPosition(makeLongSignal({ tpPrice: 100 }), 1000),
    ).toThrow('tpPrice');
    expect(() =>
      p.openPosition(makeLongSignal({ tpPrice: 99 }), 1000),
    ).toThrow('tpPrice');
  });

  it('throws for SHORT when slPrice <= entryPrice', () => {
    const p = new Portfolio(1000);
    expect(() =>
      p.openPosition(makeShortSignal({ slPrice: 100 }), 1000),
    ).toThrow('slPrice');
  });

  it('throws for SHORT when tpPrice >= entryPrice', () => {
    const p = new Portfolio(1000);
    expect(() =>
      p.openPosition(makeShortSignal({ tpPrice: 100 }), 1000),
    ).toThrow('tpPrice');
  });
});

// ── checkStopLoss ─────────────────────────────────────────────────────────────

describe('checkStopLoss()', () => {
  it('returns false when no position is open', () => {
    const p = new Portfolio(1000);
    expect(p.checkStopLoss(makeCandle())).toBe(false);
  });

  it('triggers LONG SL when candle.low <= slPrice', () => {
    const p = new Portfolio(1000);
    p.openPosition(makeLongSignal(), 1000); // SL at 97
    const candle = makeCandle({ low: 97 }); // exactly hits SL
    expect(p.checkStopLoss(candle)).toBe(true);
    expect(p.hasOpenPosition()).toBe(false);
  });

  it('does not trigger LONG SL when candle.low > slPrice', () => {
    const p = new Portfolio(1000);
    p.openPosition(makeLongSignal(), 1000); // SL at 97
    expect(p.checkStopLoss(makeCandle({ low: 98 }))).toBe(false);
    expect(p.hasOpenPosition()).toBe(true);
  });

  it('triggers SHORT SL when candle.high >= slPrice', () => {
    const p = new Portfolio(1000);
    p.openPosition(makeShortSignal(), 1000); // SL at 103
    const candle = makeCandle({ high: 103 });
    expect(p.checkStopLoss(candle)).toBe(true);
    expect(p.hasOpenPosition()).toBe(false);
  });

  it('does not trigger SHORT SL when candle.high < slPrice', () => {
    const p = new Portfolio(1000);
    p.openPosition(makeShortSignal(), 1000); // SL at 103
    expect(p.checkStopLoss(makeCandle({ high: 102 }))).toBe(false);
  });

  it('records SL trade with negative pnlDollar equal to -dollarRisk', () => {
    const p = new Portfolio(1000);
    p.openPosition(makeLongSignal({ dollarRisk: 30 }), 1000); // SL at 97
    p.checkStopLoss(makeCandle({ low: 96, open_time: 2000 }));
    const [trade] = p.getTrades();
    expect(trade!.exitReason).toBe('SL');
    expect(trade!.dollarRisk).toBe(30);
    expect(trade!.pnlDollar).toBeCloseTo(-30, 5);
  });
});

// ── checkTakeProfit ───────────────────────────────────────────────────────────

describe('checkTakeProfit()', () => {
  it('returns false when no position is open', () => {
    const p = new Portfolio(1000);
    expect(p.checkTakeProfit(makeCandle())).toBe(false);
  });

  it('triggers LONG TP when candle.high >= tpPrice', () => {
    const p = new Portfolio(1000);
    p.openPosition(makeLongSignal(), 1000); // TP at 106
    expect(p.checkTakeProfit(makeCandle({ high: 106 }))).toBe(true);
    expect(p.hasOpenPosition()).toBe(false);
  });

  it('does not trigger LONG TP when candle.high < tpPrice', () => {
    const p = new Portfolio(1000);
    p.openPosition(makeLongSignal(), 1000); // TP at 106
    expect(p.checkTakeProfit(makeCandle({ high: 105 }))).toBe(false);
  });

  it('triggers SHORT TP when candle.low <= tpPrice', () => {
    const p = new Portfolio(1000);
    p.openPosition(makeShortSignal(), 1000); // TP at 94
    expect(p.checkTakeProfit(makeCandle({ low: 94 }))).toBe(true);
    expect(p.hasOpenPosition()).toBe(false);
  });

  it('records TP trade with positive pnlDollar equal to dollarRisk × (tpDist/slDist)', () => {
    // entry=100, sl=97 (dist=3), tp=106 (dist=6), dollarRisk=30
    // pnlDollar = 30 × (6/3) = 60
    const p = new Portfolio(1000);
    p.openPosition(makeLongSignal({ dollarRisk: 30 }), 1000);
    p.checkTakeProfit(makeCandle({ high: 110, open_time: 2000 }));
    const [trade] = p.getTrades();
    expect(trade!.exitReason).toBe('TP');
    expect(trade!.dollarRisk).toBe(30);
    expect(trade!.pnlDollar).toBeCloseTo(60, 5);
  });
});

// ── P&L and balance tracking ──────────────────────────────────────────────────

describe('balance and P&L tracking', () => {
  it('balance increases after a winning trade', () => {
    const p = new Portfolio(1000);
    p.openPosition(makeLongSignal({ dollarRisk: 30 }), 1000);
    p.checkTakeProfit(makeCandle({ high: 110, open_time: 2000 }));
    expect(p.getBalance()).toBeGreaterThan(1000);
  });

  it('balance decreases after a losing trade', () => {
    const p = new Portfolio(1000);
    p.openPosition(makeLongSignal({ dollarRisk: 30 }), 1000);
    p.checkStopLoss(makeCandle({ low: 90, open_time: 2000 }));
    expect(p.getBalance()).toBeLessThan(1000);
  });

  it('assigns sequential IDs to trades', () => {
    const p = new Portfolio(1000);
    p.openPosition(makeLongSignal(), 1000);
    p.checkStopLoss(makeCandle({ low: 90, open_time: 2000 }));
    p.openPosition(makeLongSignal(), 3000);
    p.checkStopLoss(makeCandle({ low: 90, open_time: 4000 }));
    const trades = p.getTrades();
    expect(trades[0]!.id).toBe(1);
    expect(trades[1]!.id).toBe(2);
  });

  it('pnlPercent is computed relative to balance at exit time', () => {
    const p = new Portfolio(1000);
    // dollarRisk = 30, balance = 1000 → pnlPercent = -30/1000 * 100 = -3%
    p.openPosition(makeLongSignal({ dollarRisk: 30 }), 1000);
    p.checkStopLoss(makeCandle({ low: 90, open_time: 2000 }));
    const [trade] = p.getTrades();
    expect(trade!.pnlPercent).toBeCloseTo(-3, 5);
  });
});

// ── closePosition ─────────────────────────────────────────────────────────────

describe('closePosition()', () => {
  it('returns null when no position is open', () => {
    const p = new Portfolio(1000);
    expect(p.closePosition(100, 'SL', 2000)).toBeNull();
  });

  it('returns the completed trade', () => {
    const p = new Portfolio(1000);
    p.openPosition(makeLongSignal(), 1000);
    const trade = p.closePosition(97, 'SL', 2000);
    expect(trade).not.toBeNull();
    expect(trade!.exitReason).toBe('SL');
    expect(trade!.exitPrice).toBe(97);
  });
});

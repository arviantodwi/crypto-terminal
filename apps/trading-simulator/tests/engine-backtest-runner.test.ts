import { describe, expect, it, vi } from 'vitest';
import { BacktestRunner } from '../src/engine/backtest-runner.js';
import type { ExecutedTrade, OhlcCandle, StrategyRunner, TradeSignal } from '../src/engine/types.js';

// ── Fixtures ──────────────────────────────────────────────────────────────────

function makeCandle(open_time: number, close: number, opts: Partial<OhlcCandle> = {}): OhlcCandle {
  return {
    open_time,
    open: close,
    high: close + 5,
    low: close - 5,
    close,
    volume: 100,
    quote_volume: close * 100,
    num_trades: 10,
    pct_change: 0,
    candle_range: 10,
    body_ratio: 0.5,
    ...opts,
  };
}

/** Builds a candle series with monotonically increasing timestamps. */
function makeCandles(count: number, basePrice = 100): OhlcCandle[] {
  return Array.from({ length: count }, (_, i) => makeCandle((i + 1) * 1000, basePrice));
}

/** Strategy that never signals — useful for baseline tests. */
const nullStrategy: StrategyRunner = {
  name: 'null',
  version: '0.0.1',
  analyze: () => null,
  onTradeExecuted: () => {},
  reset: () => {},
};

/** Creates a strategy that emits one LONG signal on the first analyze() call. */
function oneShotLongStrategy(entryPrice = 100, slDist = 3, tpDist = 6): StrategyRunner {
  let fired = false;
  return {
    name: 'one-shot-long',
    version: '0.0.1',
    analyze(candles): TradeSignal | null {
      if (fired) return null;
      fired = true;
      const entry = candles[2].close;
      return {
        direction: 'LONG',
        entryPrice: entry,
        slPrice: entry - slDist,
        tpPrice: entry + tpDist,
        leverage: 1,
        dollarRisk: 30,
        metadata: {},
      };
    },
    onTradeExecuted: () => {},
    reset: () => {},
  };
}

// ── Basic operation ───────────────────────────────────────────────────────────

describe('BacktestRunner — basic operation', () => {
  it('returns zero trades for a null strategy', () => {
    const candles = makeCandles(10);
    const runner = new BacktestRunner({ candles, strategy: nullStrategy, initialBalance: 1000 });
    const results = runner.run();
    expect(results.totalTrades).toBe(0);
    expect(results.initialBalance).toBe(1000);
    expect(results.finalBalance).toBe(1000);
    expect(results.winCount).toBe(0);
    expect(results.lossCount).toBe(0);
    expect(results.strategyErrorCount).toBe(0);
  });

  it('emits done event with final results', () => {
    const candles = makeCandles(5);
    const runner = new BacktestRunner({ candles, strategy: nullStrategy, initialBalance: 1000 });
    const doneSpy = vi.fn();
    runner.on('done', doneSpy);
    runner.run();
    expect(doneSpy).toHaveBeenCalledOnce();
    expect(doneSpy.mock.calls[0]![0].totalTrades).toBe(0);
  });

  it('emits candle event for every window', () => {
    // 5 candles → 3 windows
    const candles = makeCandles(5);
    const runner = new BacktestRunner({ candles, strategy: nullStrategy, initialBalance: 1000 });
    let candleCount = 0;
    runner.on('candle', () => candleCount++);
    runner.run();
    expect(candleCount).toBe(3); // 5 - 2 = 3 windows
  });
});

// ── Trade lifecycle ───────────────────────────────────────────────────────────

describe('BacktestRunner — trade lifecycle', () => {
  it('emits tradeOpened when strategy returns a signal', () => {
    // Candles with stable price so SL/TP are not hit until a candle with wider range
    const candles = makeCandles(10, 100);
    const runner = new BacktestRunner({
      candles,
      strategy: oneShotLongStrategy(100, 3, 6),
      initialBalance: 1000,
    });
    const openSpy = vi.fn();
    runner.on('tradeOpened', openSpy);
    runner.run();
    expect(openSpy).toHaveBeenCalledOnce();
  });

  it('records a TP trade when price reaches tpPrice', () => {
    // Build a series: first 3 candles at 100, then one candle that hits TP
    const candles = [
      makeCandle(1000, 100),
      makeCandle(2000, 100),
      makeCandle(3000, 100), // signal fires here: entry=100, sl=97, tp=106
      makeCandle(4000, 100, { high: 110, low: 99 }), // TP hit (high >= 106)
      makeCandle(5000, 100),
    ];

    const runner = new BacktestRunner({
      candles,
      strategy: oneShotLongStrategy(),
      initialBalance: 1000,
    });
    const results = runner.run();

    expect(results.totalTrades).toBe(1);
    expect(results.winCount).toBe(1);
    expect(results.lossCount).toBe(0);
    // pnlDollar = 30 × (6/3) = 60
    expect(results.trades[0]!.pnlDollar).toBeCloseTo(60, 5);
    expect(results.trades[0]!.exitReason).toBe('TP');
  });

  it('records an SL trade when price reaches slPrice', () => {
    const candles = [
      makeCandle(1000, 100),
      makeCandle(2000, 100),
      makeCandle(3000, 100), // entry=100, sl=97, tp=106
      makeCandle(4000, 100, { high: 101, low: 95 }), // SL hit (low <= 97)
      makeCandle(5000, 100),
    ];

    const runner = new BacktestRunner({
      candles,
      strategy: oneShotLongStrategy(),
      initialBalance: 1000,
    });
    const results = runner.run();

    expect(results.totalTrades).toBe(1);
    expect(results.winCount).toBe(0);
    expect(results.lossCount).toBe(1);
    expect(results.trades[0]!.pnlDollar).toBeCloseTo(-30, 5);
    expect(results.trades[0]!.exitReason).toBe('SL');
  });

  it('SL takes priority when both SL and TP are hit on the same candle', () => {
    const candles = [
      makeCandle(1000, 100),
      makeCandle(2000, 100),
      makeCandle(3000, 100), // entry=100, sl=97, tp=106
      makeCandle(4000, 100, { high: 110, low: 90 }), // both SL and TP hit — SL wins
      makeCandle(5000, 100),
    ];

    const runner = new BacktestRunner({
      candles,
      strategy: oneShotLongStrategy(),
      initialBalance: 1000,
    });
    const results = runner.run();

    expect(results.trades[0]!.exitReason).toBe('SL');
    expect(results.trades[0]!.pnlDollar).toBeCloseTo(-30, 5);
  });

  it('emits tradeClosed and calls onTradeExecuted', () => {
    const candles = [
      makeCandle(1000, 100),
      makeCandle(2000, 100),
      makeCandle(3000, 100),
      makeCandle(4000, 100, { high: 110, low: 99 }),
    ];

    const onTradeExecuted = vi.fn();
    const strategy: StrategyRunner = {
      ...oneShotLongStrategy(),
      onTradeExecuted,
    };

    const runner = new BacktestRunner({ candles, strategy, initialBalance: 1000 });
    const closeSpy = vi.fn();
    runner.on('tradeClosed', closeSpy);
    runner.run();

    expect(closeSpy).toHaveBeenCalledOnce();
    expect(onTradeExecuted).toHaveBeenCalledOnce();
  });
});

// ── Error handling ────────────────────────────────────────────────────────────

describe('BacktestRunner — strategy error handling', () => {
  it('continues after strategy error by default', () => {
    const errorStrategy: StrategyRunner = {
      name: 'error-prone',
      version: '0.0.1',
      analyze: () => {
        throw new Error('strategy boom');
      },
      onTradeExecuted: () => {},
      reset: () => {},
    };

    const candles = makeCandles(5);
    const runner = new BacktestRunner({ candles, strategy: errorStrategy, initialBalance: 1000 });
    const errorEvents: unknown[] = [];
    runner.on('strategyError', (err) => errorEvents.push(err));

    // Should NOT throw
    const results = runner.run();
    expect(results.strategyErrorCount).toBeGreaterThan(0);
    expect(errorEvents.length).toBeGreaterThan(0);
  });

  it('halts on first error when haltOnStrategyError is true', () => {
    const errorStrategy: StrategyRunner = {
      name: 'error-prone',
      version: '0.0.1',
      analyze: () => {
        throw new Error('strategy boom');
      },
      onTradeExecuted: () => {},
      reset: () => {},
    };

    const candles = makeCandles(5);
    const runner = new BacktestRunner({
      candles,
      strategy: errorStrategy,
      initialBalance: 1000,
      haltOnStrategyError: true,
    });

    expect(() => runner.run()).toThrow('strategy boom');
  });

  it('emits strategyError event with candles context', () => {
    const errorStrategy: StrategyRunner = {
      name: 'error-prone',
      version: '0.0.1',
      analyze: () => {
        throw new Error('analyze failed');
      },
      onTradeExecuted: () => {},
      reset: () => {},
    };

    const candles = makeCandles(4);
    const runner = new BacktestRunner({ candles, strategy: errorStrategy, initialBalance: 1000 });

    let capturedCandles: [OhlcCandle, OhlcCandle, OhlcCandle] | null = null;
    runner.on('strategyError', (_err, c) => {
      capturedCandles = c;
    });
    runner.run();
    expect(capturedCandles).not.toBeNull();
    expect(capturedCandles).toHaveLength(3);
  });
});

// ── Results integrity ─────────────────────────────────────────────────────────

describe('BacktestRunner — results integrity', () => {
  it('winRate is 0 when no trades', () => {
    const results = new BacktestRunner({
      candles: makeCandles(5),
      strategy: nullStrategy,
      initialBalance: 1000,
    }).run();
    expect(results.winRate).toBe(0);
  });

  it('finalBalance equals initialBalance + sum of pnlDollar', () => {
    const candles = [
      makeCandle(1000, 100),
      makeCandle(2000, 100),
      makeCandle(3000, 100),
      makeCandle(4000, 100, { high: 110, low: 99 }), // TP hit → +60
    ];
    const results = new BacktestRunner({
      candles,
      strategy: oneShotLongStrategy(),
      initialBalance: 1000,
    }).run();
    const expectedFinal =
      results.initialBalance +
      results.trades.reduce((s: number, t: ExecutedTrade) => s + t.pnlDollar, 0);
    expect(results.finalBalance).toBeCloseTo(expectedFinal, 5);
  });

  it('strategyErrorCount is 0 when strategy never throws', () => {
    const results = new BacktestRunner({
      candles: makeCandles(5),
      strategy: nullStrategy,
      initialBalance: 1000,
    }).run();
    expect(results.strategyErrorCount).toBe(0);
  });
});

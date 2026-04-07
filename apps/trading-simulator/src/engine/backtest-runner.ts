import { EventEmitter } from 'node:events';
import type { OhlcCandle, BacktestResults, ExecutedTrade, StrategyRunner, TradeSignal } from './types.js';
import { TimeMachine } from './time-machine.js';
import { TimeSync, type TimeSyncTick } from './time-sync.js';
import { Portfolio } from './portfolio.js';

// ── Event map ─────────────────────────────────────────────────────────────────

export interface BacktestEvents {
  candle: [candles: [OhlcCandle, OhlcCandle, OhlcCandle], progress: string];
  tradeOpened: [candle: OhlcCandle, signal: TradeSignal];
  tradeClosed: [trade: ExecutedTrade];
  /** Emitted when strategy.analyze() throws. Backtest continues by skipping the candle. */
  strategyError: [error: unknown, candles: [OhlcCandle, OhlcCandle, OhlcCandle]];
  done: [results: BacktestResults];
}

export interface BacktestRunnerOptions {
  candles: OhlcCandle[];
  strategy: StrategyRunner;
  initialBalance: number;
  /** Instrument being backtested — tagged on every ExecutedTrade. */
  instrument?: string;
  /** Log progress every N candles. Default 1000. */
  progressInterval?: number;
  /**
   * Whether to halt the backtest on the first strategy error.
   * Default false — errors are emitted via 'strategyError' and the candle is skipped.
   */
  haltOnStrategyError?: boolean;
}

/**
 * Main backtest orchestration engine.
 *
 * Usage:
 * ```ts
 * const runner = new BacktestRunner({ candles, strategy, initialBalance: 1000 });
 * runner.on('tradeClosed', (trade) => console.log(trade));
 * const results = runner.run();
 * ```
 */
export class BacktestRunner extends EventEmitter {
  private readonly candles: OhlcCandle[];
  private readonly strategy: StrategyRunner;
  private readonly initialBalance: number;
  private readonly instrument: string;
  private readonly progressInterval: number;
  private readonly haltOnStrategyError: boolean;

  constructor(options: BacktestRunnerOptions) {
    super();
    this.candles = options.candles;
    this.strategy = options.strategy;
    this.initialBalance = options.initialBalance;
    this.instrument = options.instrument ?? '';
    this.progressInterval = options.progressInterval ?? 1000;
    this.haltOnStrategyError = options.haltOnStrategyError ?? false;
  }

  run(): BacktestResults {
    const timeMachine = new TimeMachine(this.candles);
    const portfolio = new Portfolio(this.initialBalance, this.instrument);

    let windowCount = 0;
    let strategyErrorCount = 0;
    let window: [OhlcCandle, OhlcCandle, OhlcCandle] | null;

    while ((window = timeMachine.next()) !== null) {
      windowCount++;
      const [, , c3] = window;

      this.emit('candle', window, timeMachine.progress());

      if (portfolio.hasOpenPosition()) {
        // SL is checked first — if both SL and TP levels are within the same candle,
        // SL takes priority (conservative assumption).
        const slHit = portfolio.checkStopLoss(c3);
        const tpHit = !slHit && portfolio.checkTakeProfit(c3);
        if (slHit || tpHit) {
          const trades = portfolio.getTrades();
          const closedTrade = trades[trades.length - 1]!;
          this.emit('tradeClosed', closedTrade);
          this.strategy.onTradeExecuted(closedTrade);
        }
      }

      if (!portfolio.hasOpenPosition()) {
        let signal: TradeSignal | null = null;
        try {
          signal = this.strategy.analyze(window);
        } catch (err) {
          strategyErrorCount++;
          this.emit('strategyError', err, window);
          if (this.haltOnStrategyError) {
            throw new Error(
              `[backtest] Strategy "${this.strategy.name}" threw on candle ${windowCount} — halting. ` +
                `Original error: ${err instanceof Error ? err.message : String(err)}`,
              { cause: err },
            );
          }
          // Skip this candle — continue to next window
        }
        if (signal !== null) {
          portfolio.openPosition(signal, c3.open_time);
          this.emit('tradeOpened', c3, signal);
        }
      }

      if (windowCount % this.progressInterval === 0 && process.stdout.isTTY) {
        process.stdout.write(`\r[backtest] ${timeMachine.progress()}`);
      }
    }

    // Clear the progress line
    if (process.stdout.isTTY) {
      process.stdout.write('\n');
    }

    // Warn if a position is still open at the end of the dataset — it is never
    // closed, so its unrealized P&L is silently excluded from finalBalance and
    // trades[]. Callers comparing finalBalance - initialBalance vs totalPnlDollar
    // will see them agree, but the open position's value is not reflected.
    if (portfolio.hasOpenPosition()) {
      process.stderr.write(
        '[backtest] WARNING: backtest ended with an open position — unrealized P&L excluded from results\n',
      );
    }

    const trades = portfolio.getTrades();
    const winCount = trades.filter((t) => t.pnlDollar > 0).length;
    const lossCount = trades.filter((t) => t.pnlDollar < 0).length;
    const breakEvenCount = trades.filter((t) => t.pnlDollar === 0).length;
    const totalPnlDollar = trades.reduce((sum, t) => sum + t.pnlDollar, 0);

    const results: BacktestResults = {
      initialBalance: this.initialBalance,
      finalBalance: portfolio.getBalance(),
      totalTrades: trades.length,
      winCount,
      lossCount,
      breakEvenCount,
      // winRate denominator is ALL trades (wins + losses + breakevens), so a
      // 50W/50L/10B record yields 50/110 = 45.5%, not 50/100 = 50%.
      winRate: trades.length > 0 ? (winCount / trades.length) * 100 : 0,
      totalPnlDollar,
      strategyErrorCount,
      trades,
    };

    this.emit('done', results);
    // NOTE: listeners are not removed after 'done'. For long-lived processes
    // running multiple sequential backtests on the same instance, call
    // runner.removeAllListeners() between runs to prevent listener accumulation.
    return results;
  }
}

// ── Multi-instrument runner ────────────────────────────────────────────────────

export interface MultiInstrumentBacktestResults {
  initialBalance: number;
  finalBalance: number;
  totalTrades: number;
  winCount: number;
  lossCount: number;
  breakEvenCount: number;
  winRate: number;
  totalPnlDollar: number;
  strategyErrorCount: number;
  trades: ExecutedTrade[];
  /** Number of unique timestamps processed across all instruments. */
  totalTimestamps: number;
}

export interface MultiInstrumentBacktestRunnerOptions {
  instrumentCandles: Map<string, OhlcCandle[]>;
  strategies: Map<string, StrategyRunner>;
  initialBalance: number;
  /**
   * When true (default), all instruments share a single balance pool.
   * When false, the initial balance is split evenly across all instruments,
   * and each trades in its own pot until that pot reaches zero.
   */
  sharedBalance?: boolean;
  haltOnStrategyError?: boolean;
}

export interface MultiBacktestEvents {
  tradeClosed: [trade: ExecutedTrade];
  strategyError: [error: unknown, instrument: string, candles: [OhlcCandle, OhlcCandle, OhlcCandle]];
  done: [results: MultiInstrumentBacktestResults];
}

/**
 * Runs a backtest across multiple instruments simultaneously, aligned by
 * timestamp. At each timestamp tick, every instrument that has a candle at
 * that time is evaluated together, and all instruments share a single balance
 * pool.
 *
 * This replaces sequential per-instrument runs where each instrument consumed
 * an independent balance, causing misleading aggregate stats.
 */
export class MultiInstrumentBacktestRunner extends EventEmitter {
  private readonly instrumentCandles: Map<string, OhlcCandle[]>;
  private readonly strategies: Map<string, StrategyRunner>;
  private readonly initialBalance: number;
  private readonly sharedBalance: boolean;
  private readonly haltOnStrategyError: boolean;

  constructor(options: MultiInstrumentBacktestRunnerOptions) {
    super();
    this.instrumentCandles = options.instrumentCandles;
    this.strategies = options.strategies;
    this.initialBalance = options.initialBalance;
    this.sharedBalance = options.sharedBalance ?? true;
    this.haltOnStrategyError = options.haltOnStrategyError ?? false;
  }

  run(): MultiInstrumentBacktestResults {
    const numInstruments = this.instrumentCandles.size;
    const portfolios = new Map<string, Portfolio>();

    if (this.sharedBalance) {
      const sharedBalance = { value: this.initialBalance };
      for (const [instrument] of this.instrumentCandles) {
        portfolios.set(instrument, new Portfolio(sharedBalance, instrument));
      }
    } else {
      const perInstrumentBalance = this.initialBalance / numInstruments;
      for (const [instrument] of this.instrumentCandles) {
        portfolios.set(instrument, new Portfolio(perInstrumentBalance, instrument));
      }
    }

    const timeSync = new TimeSync(this.instrumentCandles);
    let strategyErrorCount = 0;
    let tick: TimeSyncTick | null;

    while ((tick = timeSync.next()) !== null) {
      for (const [instrument, window] of tick.windows) {
        const portfolio = portfolios.get(instrument)!;
        const strategy = this.strategies.get(instrument)!;
        const c3 = window[2];

        if (portfolio.hasOpenPosition()) {
          const slHit = portfolio.checkStopLoss(c3);
          const tpHit = !slHit && portfolio.checkTakeProfit(c3);
          if (slHit || tpHit) {
            const trades = portfolio.getTrades();
            const closedTrade = trades[trades.length - 1]!;
            this.emit('tradeClosed', closedTrade);
            strategy.onTradeExecuted(closedTrade);
          }
        }

        if (!portfolio.hasOpenPosition() && portfolio.getBalance() > 0) {
          let signal: TradeSignal | null = null;
          try {
            signal = strategy.analyze(window);
          } catch (err) {
            strategyErrorCount++;
            this.emit('strategyError', err, instrument, window);
            if (this.haltOnStrategyError) {
              throw new Error(
                `[multi-backtest] Strategy for "${instrument}" threw — halting. ` +
                  `Original error: ${err instanceof Error ? err.message : String(err)}`,
                { cause: err },
              );
            }
          }
          if (signal !== null) {
            portfolio.openPosition(signal, c3.open_time);
          }
        }
      }
    }

    const allTrades: ExecutedTrade[] = [];
    for (const portfolio of portfolios.values()) {
      allTrades.push(...portfolio.getTrades());
    }
    // Sort by entry time so trades appear chronologically in results
    allTrades.sort((a, b) => a.entryTimestamp.getTime() - b.entryTimestamp.getTime());

    const winCount = allTrades.filter((t) => t.pnlDollar > 0).length;
    const lossCount = allTrades.filter((t) => t.pnlDollar < 0).length;
    const breakEvenCount = allTrades.filter((t) => t.pnlDollar === 0).length;
    const totalPnlDollar = allTrades.reduce((sum, t) => sum + t.pnlDollar, 0);

    const finalBalance = this.sharedBalance
      ? portfolios.values().next().value?.getBalance() ?? 0
      : Array.from(portfolios.values()).reduce((sum, p) => sum + p.getBalance(), 0);

    const results: MultiInstrumentBacktestResults = {
      initialBalance: this.initialBalance,
      finalBalance,
      totalTrades: allTrades.length,
      winCount,
      lossCount,
      breakEvenCount,
      winRate: allTrades.length > 0 ? (winCount / allTrades.length) * 100 : 0,
      totalPnlDollar,
      strategyErrorCount,
      trades: allTrades,
      totalTimestamps: timeSync.total,
    };

    this.emit('done', results);
    return results;
  }
}

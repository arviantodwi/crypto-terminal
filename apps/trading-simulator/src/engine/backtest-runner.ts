import { EventEmitter } from 'node:events';
import type { OhlcCandle, BacktestResults, ExecutedTrade, StrategyRunner, TradeSignal } from './types.js';
import { TimeMachine } from './time-machine.js';
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

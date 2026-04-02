import { EventEmitter } from 'node:events';
import type { OhlcCandle, BacktestResults, ExecutedTrade, StrategyRunner } from './types.js';
import { TimeMachine } from './time-machine.js';
import { Portfolio } from './portfolio.js';

// ── Event map ─────────────────────────────────────────────────────────────────

export interface BacktestEvents {
  candle: [candles: [OhlcCandle, OhlcCandle, OhlcCandle], progress: string];
  tradeOpened: [candle: OhlcCandle, signal: ReturnType<StrategyRunner['analyze']>];
  tradeClosed: [trade: ExecutedTrade];
  done: [results: BacktestResults];
}

export interface BacktestRunnerOptions {
  candles: OhlcCandle[];
  strategy: StrategyRunner;
  initialBalance: number;
  /** Log progress every N candles. Default 1000. */
  progressInterval?: number;
}

/**
 * Main backtest orchestration engine.
 *
 * Usage:
 * ```ts
 * const runner = new BacktestRunner({ candles, strategy, initialBalance: 1000 });
 * runner.on('tradeClosed', (trade) => console.log(trade));
 * const results = await runner.run();
 * ```
 */
export class BacktestRunner extends EventEmitter {
  private readonly candles: OhlcCandle[];
  private readonly strategy: StrategyRunner;
  private readonly initialBalance: number;
  private readonly progressInterval: number;

  constructor(options: BacktestRunnerOptions) {
    super();
    this.candles = options.candles;
    this.strategy = options.strategy;
    this.initialBalance = options.initialBalance;
    this.progressInterval = options.progressInterval ?? 1000;
  }

  async run(): Promise<BacktestResults> {
    const timeMachine = new TimeMachine(this.candles);
    const portfolio = new Portfolio(this.initialBalance);

    let windowCount = 0;
    let window: [OhlcCandle, OhlcCandle, OhlcCandle] | null;

    while ((window = timeMachine.next()) !== null) {
      windowCount++;
      const [, , c3] = window;

      this.emit('candle', window, timeMachine.progress());

      if (portfolio.hasOpenPosition()) {
        // SL is checked first — if both SL and TP levels are within the same candle,
        // SL takes priority (conservative assumption).
        const slHit = portfolio.checkStopLoss(c3);
        if (!slHit) {
          const tpHit = portfolio.checkTakeProfit(c3);
          if (tpHit) {
            const trades = portfolio.getTrades();
            const closedTrade = trades[trades.length - 1]!;
            this.emit('tradeClosed', closedTrade);
            this.strategy.onTradeExecuted(closedTrade);
          }
        } else {
          const trades = portfolio.getTrades();
          const closedTrade = trades[trades.length - 1]!;
          this.emit('tradeClosed', closedTrade);
          this.strategy.onTradeExecuted(closedTrade);
        }
      }

      if (!portfolio.hasOpenPosition()) {
        const signal = this.strategy.analyze(window);
        if (signal !== null) {
          portfolio.openPosition(signal);
          this.emit('tradeOpened', c3, signal);
        }
      }

      if (windowCount % this.progressInterval === 0) {
        process.stdout.write(`\r[backtest] ${timeMachine.progress()}`);
      }
    }

    // Clear the progress line
    process.stdout.write('\n');

    const trades = portfolio.getTrades();
    const winCount = trades.filter((t) => t.pnlDollar > 0).length;
    const lossCount = trades.filter((t) => t.pnlDollar <= 0).length;
    const totalPnlDollar = trades.reduce((sum, t) => sum + t.pnlDollar, 0);

    const results: BacktestResults = {
      initialBalance: this.initialBalance,
      finalBalance: portfolio.getBalance(),
      totalTrades: trades.length,
      winCount,
      lossCount,
      winRate: trades.length > 0 ? (winCount / trades.length) * 100 : 0,
      totalPnlDollar,
      trades,
    };

    this.emit('done', results);
    return results;
  }
}

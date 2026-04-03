import { writeFileSync } from 'node:fs';
import pg from 'pg';
import pino from 'pino';
import { config } from './config.js';
import { createDb } from './db/client.js';
import { fetchAllCandles } from './db/queries.js';
import { BacktestRunner } from './engine/backtest-runner.js';
import type { ExecutedTrade, OhlcCandle, StrategyRunner, TradeSignal } from './engine/types.js';
import { calculateMetrics } from './shared/metrics.js';
import { InMemoryTradeLog } from './shared/execution-log.js';
import { loadStrategy } from './strategies/loader.js';

const log = pino({ level: config.logLevel });
const { Pool } = pg;

// ── Parse CLI args ────────────────────────────────────────────────────────────

const args = process.argv.slice(2);

function getArg(prefix: string): string | undefined {
  return args.find((a) => a.startsWith(prefix))?.split('=')[1];
}

function hasFlag(flag: string): boolean {
  return args.includes(flag);
}

const strategyArg = getArg('--strategy=') ?? 'dummy';
const balanceArg = getArg('--balance=');
const riskArg = getArg('--risk=');
const outputArg = getArg('--output=');
const headless = hasFlag('--headless');
const haltOnError = hasFlag('--halt-on-error');

// CLI args override environment variables
const initialBalance = (() => {
  if (balanceArg !== undefined) {
    const v = Number(balanceArg);
    if (isNaN(v) || v <= 0) {
      console.error(`[cli] --balance must be a positive number, got: ${balanceArg}`);
      process.exit(1);
    }
    return v;
  }
  return config.initialBalance;
})();

const riskPct = (() => {
  if (riskArg !== undefined) {
    const v = Number(riskArg);
    if (isNaN(v) || v <= 0 || v > 100) {
      console.error(`[cli] --risk must be between 0 and 100, got: ${riskArg}`);
      process.exit(1);
    }
    return v;
  }
  return undefined; // use strategy default
})();

// ── Dummy strategy (no-op — always returns null) ──────────────────────────────

const dummyStrategy: StrategyRunner = {
  name: 'dummy',
  version: '0.0.1',
  analyze(_candles: [OhlcCandle, OhlcCandle, OhlcCandle]): TradeSignal | null {
    return null;
  },
  onTradeExecuted(_trade: ExecutedTrade): void {
    // no-op
  },
};

// ── Save results ──────────────────────────────────────────────────────────────

function saveResults(
  strategyName: string,
  trades: ExecutedTrade[],
  initialBal: number,
  finalBal: number,
  strategyErrorCount: number,
  outputPath?: string,
): void {
  const metrics = calculateMetrics(trades, initialBal);
  const timestamp = new Date().toISOString();
  const safeStrategy = strategyName.replace(/[^a-z0-9-]/gi, '-');
  const safeTimestamp = timestamp.replace(/[:.]/g, '-').slice(0, 19);

  const jsonPath = outputPath ?? `backtest-${safeStrategy}-${safeTimestamp}.json`;
  const csvPath = jsonPath.replace(/\.json$/, '.csv');

  const payload = {
    metadata: {
      strategy: strategyName,
      instrument: config.instrument,
      timeframe: config.timeframe,
      initialBalance: initialBal,
      finalBalance: finalBal,
      runDate: timestamp,
      strategyErrors: strategyErrorCount,
    },
    trades,
    metrics: {
      totalTrades: metrics.totalTrades,
      winRate: metrics.winRate,
      totalPnL: metrics.totalPnL,
      maxDrawdown: metrics.maxDrawdown,
      sharpeRatio: metrics.sharpeRatio,
      profitFactor: metrics.profitFactor,
      expectedValue: metrics.expectedValue,
      averageWin: metrics.averageWin,
      averageLoss: metrics.averageLoss,
      largestWin: metrics.largestWin,
      largestLoss: metrics.largestLoss,
      averageHoldTime: metrics.averageHoldTime,
    },
  };

  writeFileSync(jsonPath, JSON.stringify(payload, null, 2), 'utf-8');
  log.info({ path: jsonPath }, '[save] Results saved to JSON');

  // CSV export via InMemoryTradeLog
  const tradeLog = new InMemoryTradeLog();
  for (const trade of trades) {
    tradeLog.logTrade(trade, strategyName, strategyName);
  }
  tradeLog.exportToCSV(csvPath);
  log.info({ path: csvPath }, '[save] Trades exported to CSV');
}

// ── Main ──────────────────────────────────────────────────────────────────────

async function main() {
  const pool = new Pool({ connectionString: config.database.url });

  try {
    try {
      const client = await pool.connect();
      await client.query('SELECT 1');
      client.release();
      log.info('[db] Database connection established');
    } catch (err) {
      log.error({ err }, '[db] Failed to connect to database');
      process.exit(1);
    }

    const db = createDb(pool);

    let strategy: StrategyRunner;
    if (strategyArg === 'dummy') {
      strategy = dummyStrategy;
    } else {
      try {
        strategy = await loadStrategy(strategyArg, db, {
          instrument: config.instrument,
          timeframe: config.timeframe,
          initialBalance,
          ...(riskPct !== undefined && { riskPct }),
        });
        log.info({ strategy: strategyArg }, '[cli] Strategy loaded');
      } catch (err) {
        log.error({ err, strategy: strategyArg }, '[cli] Failed to load strategy');
        process.exit(1);
      }
    }

    log.info(
      { instrument: config.instrument, timeframe: config.timeframe },
      '[backtest] Fetching candles',
    );

    const candles = await fetchAllCandles(db, config.instrument, config.timeframe);

    log.info({ count: candles.length }, '[backtest] Candles loaded');

    if (candles.length < 3) {
      log.error({ count: candles.length }, '[backtest] Not enough candles to run a backtest');
      process.exit(1);
    }

    log.info(
      {
        strategy: strategy.name,
        version: strategy.version,
        initialBalance,
        headless,
        haltOnError,
      },
      '[backtest] Starting',
    );

    const runner = new BacktestRunner({
      candles,
      strategy,
      initialBalance,
      haltOnStrategyError: haltOnError,
    });

    runner.on('tradeClosed', (trade) => {
      log.info(
        {
          id: trade.id,
          direction: trade.direction,
          exitReason: trade.exitReason,
          pnlDollar: trade.pnlDollar.toFixed(2),
          pnlPercent: trade.pnlPercent.toFixed(2),
        },
        '[trade] Closed',
      );
    });

    runner.on('strategyError', (err, candles) => {
      log.warn(
        { err, c3Time: candles[2].open_time },
        '[strategy] Error in analyze() — skipping candle',
      );
    });

    const results = runner.run();

    log.info(
      {
        initialBalance: results.initialBalance.toFixed(2),
        finalBalance: results.finalBalance.toFixed(2),
        totalPnl: results.totalPnlDollar.toFixed(2),
        totalTrades: results.totalTrades,
        wins: results.winCount,
        losses: results.lossCount,
        winRate: `${results.winRate.toFixed(1)}%`,
        strategyErrors: results.strategyErrorCount,
      },
      '[backtest] Complete',
    );

    // In headless mode (or when --output is specified), auto-save results
    if (headless || outputArg) {
      saveResults(
        strategy.name,
        results.trades,
        results.initialBalance,
        results.finalBalance,
        results.strategyErrorCount,
        outputArg,
      );
    }

    if (headless) {
      process.exit(0);
    }
  } finally {
    await pool.end();
  }
}

main().catch((err) => {
  log.error({ err }, '[backtest] Unrecoverable error');
  process.exit(1);
});

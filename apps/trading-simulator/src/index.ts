import pg from 'pg';
import pino from 'pino';
import { config } from './config.js';
import { createDb } from './db/client.js';
import { fetchAllCandles } from './db/queries.js';
import { BacktestRunner } from './engine/backtest-runner.js';
import type { ExecutedTrade, OhlcCandle, StrategyRunner, TradeSignal } from './engine/types.js';
import { loadStrategy } from './strategies/loader.js';

const log = pino({ level: config.logLevel });
const { Pool } = pg;

// ── Parse CLI args ────────────────────────────────────────────────────────────

const args = process.argv.slice(2);
const strategyArg = args.find((a) => a.startsWith('--strategy='))?.split('=')[1] ?? 'dummy';

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
          initialBalance: config.initialBalance,
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
        initialBalance: config.initialBalance,
      },
      '[backtest] Starting',
    );

    const runner = new BacktestRunner({
      candles,
      strategy,
      initialBalance: config.initialBalance,
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
      },
      '[backtest] Complete',
    );
  } finally {
    await pool.end();
  }
}

main().catch((err) => {
  log.error({ err }, '[backtest] Unrecoverable error');
  process.exit(1);
});

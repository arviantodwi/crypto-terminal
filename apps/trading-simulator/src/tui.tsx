/**
 * TUI entry point for the backtest simulator.
 *
 * Usage:
 *   tsx --env-file .env src/tui.tsx [--strategy=pattern-based-v1]
 *
 * Environment variables (same as index.ts):
 *   DATABASE_URL      – PostgreSQL connection string
 *   INSTRUMENT        – e.g. BTCUSDT (default)
 *   TIMEFRAME         – e.g. 5m (default)
 *   INITIAL_BALANCE   – starting USD balance (default 1000)
 */
import pg from 'pg';
import { render } from 'ink';
import { config } from './config.js';
import { createDb } from './db/client.js';
import { fetchAllCandles } from './db/queries.js';
import { loadStrategy, KNOWN_STRATEGIES } from './strategies/loader.js';
import { BASE_STRATEGY_CONFIG } from './strategies/base-config.js';
import type { OhlcCandle, StrategyRunner, TradeSignal, ExecutedTrade } from './engine/types.js';
import { App } from './tui/App.js';

const { Pool } = pg;

// ── Parse CLI args ────────────────────────────────────────────────────────────

const args = process.argv.slice(2);
const strategyArg = args.find((a) => a.startsWith('--strategy='))?.split('=')[1] || 'dummy';
const riskArg = args.find((a) => a.startsWith('--risk='))?.split('=')[1];

const riskPct = (() => {
  if (riskArg !== undefined) {
    const v = Number(riskArg);
    if (isNaN(v) || v <= 0 || v > 100) {
      process.stderr.write(`[tui] --risk must be between 0 and 100, got: ${riskArg}\n`);
      process.exit(1);
    }
    return v;
  }
  return undefined; // use strategy default
})();

const VALID_STRATEGIES = ['dummy', ...KNOWN_STRATEGIES] as const;
if (!VALID_STRATEGIES.includes(strategyArg as (typeof VALID_STRATEGIES)[number])) {
  process.stderr.write(
    `[tui] Unknown strategy: "${strategyArg}". Valid strategies: ${VALID_STRATEGIES.join(', ')}\n`,
  );
  process.exit(1);
}

// ── Dummy strategy (no-op) ────────────────────────────────────────────────────

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
  process.stdout.write('[tui] Starting backtest TUI…\n');

  const pool = new Pool({ connectionString: config.database.url });

  try {
    // Verify DB connection
    const client = await pool.connect();
    await client.query('SELECT 1');
    client.release();

    const db = createDb(pool);

    // Load strategy
    let strategy: StrategyRunner;
    if (strategyArg === 'dummy') {
      strategy = dummyStrategy;
    } else {
      strategy = await loadStrategy(
        strategyArg as Parameters<typeof loadStrategy>[0],
        db,
        {
          instrument: config.instrument,
          timeframe: config.timeframe,
          initialBalance: config.initialBalance,
          ...(riskPct !== undefined && { riskPct }),
        },
      );
    }

    process.stdout.write(`[tui] Strategy loaded: ${strategy.name} v${strategy.version}\n`);

    // Fetch candles
    process.stdout.write('[tui] Loading candles…\n');
    const candles = await fetchAllCandles(db, config.instrument, config.timeframe);
    process.stdout.write(`[tui] Loaded ${candles.length} candles\n`);

    if (candles.length < 3) {
      process.stderr.write('[tui] Not enough candles to run (need at least 3)\n');
      process.exit(1);
    }

    // Close pool (TUI loop takes over from here — no more DB needed)
    await pool.end();

    // Clear terminal (screen + scrollback, same as Cmd+K on macOS)
    process.stdout.write('\x1b[2J\x1b[3J\x1b[H');

    // Render TUI
    render(
      <App
        candles={candles}
        strategy={strategy}
        strategyName={strategy.name}
        instrument={config.instrument}
        timeframe={config.timeframe}
        initialBalance={config.initialBalance}
        riskPercent={riskPct ?? BASE_STRATEGY_CONFIG.riskPct}
        tpMultiplier={BASE_STRATEGY_CONFIG.tpMultiplier}
      />,
    );
  } catch (err) {
    await pool.end().catch(() => undefined);
    process.stderr.write(`[tui] Fatal: ${String(err)}\n`);
    process.exit(1);
  }
}

main();

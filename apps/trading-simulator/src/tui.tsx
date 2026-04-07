/**
 * TUI entry point for the backtest simulator.
 *
 * Usage:
 *   tsx --env-file .env src/tui.tsx [--strategy=pattern-based-v1] [--instruments=BTCUSDT,ETHUSDT]
 *
 * Environment variables:
 *   DATABASE_URL      – PostgreSQL connection string
 *   TIMEFRAME         – e.g. 5m (default)
 *   INITIAL_BALANCE   – starting USD balance per instrument (default 1000)
 */
import pg from 'pg';
import { render } from 'ink';
import { config } from './config.js';
import { createDb } from './db/client.js';
import { fetchAllCandles, fetchAvailableInstruments } from './db/queries.js';
import { loadStrategy, KNOWN_STRATEGIES } from './strategies/loader.js';
import { BASE_STRATEGY_CONFIG } from './strategies/base-config.js';
import type { OhlcCandle, StrategyRunner, TradeSignal, ExecutedTrade } from './engine/types.js';
import { App } from './tui/App.js';
import type { InstrumentData } from './tui/types.js';
import { promptInstrumentSelection } from './shared/instrument-selector.js';

const { Pool } = pg;

// ── Parse CLI args ────────────────────────────────────────────────────────────

const args = process.argv.slice(2);
const strategyArg = args.find((a) => a.startsWith('--strategy='))?.split('=')[1] || 'dummy';
const balanceArg = args.find((a) => a.startsWith('--balance='))?.split('=')[1];
const riskArg = args.find((a) => a.startsWith('--risk='))?.split('=')[1];
const tpArg = args.find((a) => a.startsWith('--tp-multiplier='))?.split('=')[1];
const instrumentsArg = args.find((a) => a.startsWith('--instruments='))?.split('=')[1];
const sharedBalance = args.includes('--shared-balance');

const initialBalance = (() => {
  if (balanceArg !== undefined) {
    const v = Number(balanceArg);
    if (isNaN(v) || v <= 0) {
      process.stderr.write(`[tui] --balance must be a positive number, got: ${balanceArg}\n`);
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
      process.stderr.write(`[tui] --risk must be between 0 and 100, got: ${riskArg}\n`);
      process.exit(1);
    }
    return v;
  }
  return undefined; // use strategy default
})();

const tpMultiplier = (() => {
  if (tpArg !== undefined) {
    const v = Number(tpArg);
    if (isNaN(v) || v <= 0) {
      process.stderr.write(`[tui] --tp-multiplier must be a positive number, got: ${tpArg}\n`);
      process.exit(1);
    }
    return v;
  }
  return undefined;
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
  reset(): void {
    // no-op — dummy strategy has no internal state
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

    // Fetch available instruments
    process.stdout.write('[tui] Fetching available instruments…\n');
    const availableInstruments = await fetchAvailableInstruments(db);

    // Resolve instrument selection
    let selectedInstruments: string[];
    if (instrumentsArg) {
      selectedInstruments = instrumentsArg
        .split(',')
        .map((s) => s.trim())
        .filter((s) => s !== '');

      // Validate against DB
      const invalid = selectedInstruments.filter((i) => !availableInstruments.includes(i));
      if (invalid.length > 0) {
        process.stderr.write(
          `[tui] Unknown instrument(s): ${invalid.join(', ')}. Available: ${availableInstruments.join(', ')}\n`,
        );
        process.exit(1);
      }
      if (selectedInstruments.length === 0) {
        process.stderr.write('[tui] --instruments argument is empty. Specify at least one instrument.\n');
        process.exit(1);
      }
    } else {
      try {
        selectedInstruments = await promptInstrumentSelection(availableInstruments, '[tui]');
      } catch (err) {
        process.stderr.write(`[tui] ${String(err)}\n`);
        process.exit(1);
      }
    }

    process.stdout.write(`[tui] Selected instruments: ${selectedInstruments.join(', ')}\n`);

    // Calculate per-instrument balance for split mode
    const perInstrumentBalance = sharedBalance
      ? initialBalance
      : initialBalance / selectedInstruments.length;

    process.stdout.write(
      `[tui] Balance mode: ${sharedBalance ? 'shared' : 'split'} (total: ${initialBalance}, per-instrument: ${perInstrumentBalance.toFixed(2)})\n`,
    );

    // Load strategy and candles for each instrument
    const instrumentDataList: InstrumentData[] = [];

    for (const instrument of selectedInstruments) {
      let strategy: StrategyRunner;
      if (strategyArg === 'dummy') {
        strategy = dummyStrategy;
      } else {
        strategy = await loadStrategy(
          strategyArg as Parameters<typeof loadStrategy>[0],
          db,
          {
            instrument,
            timeframe: config.timeframe,
            initialBalance: perInstrumentBalance,
            ...(riskPct !== undefined && { riskPct }),
            ...(tpMultiplier !== undefined && { tpMultiplier }),
          },
        );
      }

      process.stdout.write(`[tui] Loading candles for ${instrument}…\n`);
      const candles = await fetchAllCandles(db, instrument, config.timeframe);
      process.stdout.write(`[tui] Loaded ${candles.length} candles for ${instrument}\n`);

      if (candles.length < 3) {
        process.stderr.write(`[tui] Not enough candles for ${instrument} (need at least 3)\n`);
        process.exit(1);
      }

      instrumentDataList.push({ instrument, candles, strategy });
    }

    // Close pool (TUI loop takes over from here — no more DB needed)
    await pool.end();

    // Clear terminal (screen + scrollback, same as Cmd+K on macOS)
    process.stdout.write('\x1b[2J\x1b[3J\x1b[H');

    // Render TUI
    render(
      <App
        instruments={instrumentDataList}
        strategyName={strategyArg}
        timeframe={config.timeframe}
        initialBalance={initialBalance}
        sharedBalance={sharedBalance}
        perInstrumentBalance={perInstrumentBalance}
        riskPercent={riskPct ?? BASE_STRATEGY_CONFIG.riskPct}
        tpMultiplier={tpMultiplier ?? BASE_STRATEGY_CONFIG.tpMultiplier}
      />,
    );
  } catch (err) {
    await pool.end().catch(() => undefined);
    process.stderr.write(`[tui] Fatal: ${String(err)}\n`);
    process.exit(1);
  }
}

main();

import { mkdirSync, readFileSync, rmSync } from 'node:fs';
import { join } from 'node:path';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { InMemoryTradeLog } from '../src/shared/execution-log.js';
import type { ExecutedTrade } from '../src/engine/types.js';

// ── Fixtures ──────────────────────────────────────────────────────────────────

function makeTrade(overrides: Partial<ExecutedTrade> = {}): ExecutedTrade {
  return {
    id: 1,
    entryTimestamp: new Date('2026-01-01T00:00:00Z'),
    exitTimestamp: new Date('2026-01-01T01:00:00Z'),
    direction: 'LONG',
    entryPrice: 100,
    slPrice: 98,
    tpPrice: 104,
    exitPrice: 104,
    exitReason: 'TP',
    dollarRisk: 10,
    pnlPercent: 2,
    pnlDollar: 20,
    leverage: 5,
    metadata: { route: 'Trend' },
    ...overrides,
  };
}

const STRATEGY_A = 'strategy-a';
const STRATEGY_B = 'strategy-b';
const VERSION = '1.0.0';

let tmpDir: string;

beforeEach(() => {
  tmpDir = join('/tmp', `trade-log-test-${Date.now()}`);
  mkdirSync(tmpDir, { recursive: true });
});

afterEach(() => {
  rmSync(tmpDir, { recursive: true, force: true });
});

// ── Tests ─────────────────────────────────────────────────────────────────────

describe('InMemoryTradeLog — basic operations', () => {
  it('starts empty', () => {
    const log = new InMemoryTradeLog();
    expect(log.getAllTrades()).toHaveLength(0);
  });

  it('logTrade adds a trade with strategy metadata', () => {
    const log = new InMemoryTradeLog();
    log.logTrade(makeTrade({ id: 1 }), STRATEGY_A, VERSION);

    const trades = log.getAllTrades();
    expect(trades).toHaveLength(1);
    expect(trades[0].strategyName).toBe(STRATEGY_A);
    expect(trades[0].strategyVersion).toBe(VERSION);
    expect(trades[0].id).toBe(1);
  });

  it('getAllTrades returns a copy — mutations do not affect the log', () => {
    const log = new InMemoryTradeLog();
    log.logTrade(makeTrade(), STRATEGY_A, VERSION);

    const trades = log.getAllTrades();
    trades.push({ ...makeTrade({ id: 99 }), strategyName: STRATEGY_A, strategyVersion: VERSION });

    expect(log.getAllTrades()).toHaveLength(1);
  });

  it('clearLog empties the store', () => {
    const log = new InMemoryTradeLog();
    log.logTrade(makeTrade(), STRATEGY_A, VERSION);
    log.clearLog();
    expect(log.getAllTrades()).toHaveLength(0);
  });
});

describe('InMemoryTradeLog — getTradesByStrategy', () => {
  it('filters trades by strategy name', () => {
    const log = new InMemoryTradeLog();
    log.logTrade(makeTrade({ id: 1 }), STRATEGY_A, VERSION);
    log.logTrade(makeTrade({ id: 2 }), STRATEGY_B, VERSION);
    log.logTrade(makeTrade({ id: 3 }), STRATEGY_A, VERSION);

    const aOnly = log.getTradesByStrategy(STRATEGY_A);
    expect(aOnly).toHaveLength(2);
    expect(aOnly.every((t) => t.strategyName === STRATEGY_A)).toBe(true);
  });

  it('returns empty array for unknown strategy', () => {
    const log = new InMemoryTradeLog();
    log.logTrade(makeTrade(), STRATEGY_A, VERSION);
    expect(log.getTradesByStrategy('unknown')).toHaveLength(0);
  });
});

describe('InMemoryTradeLog — exportToJSON', () => {
  it('writes valid JSON containing all trades', () => {
    const log = new InMemoryTradeLog();
    log.logTrade(makeTrade({ id: 1 }), STRATEGY_A, VERSION);
    log.logTrade(makeTrade({ id: 2 }), STRATEGY_B, VERSION);

    const file = join(tmpDir, 'trades.json');
    log.exportToJSON(file);

    const raw = readFileSync(file, 'utf-8');
    const parsed = JSON.parse(raw);
    expect(Array.isArray(parsed)).toBe(true);
    expect(parsed).toHaveLength(2);
    expect(parsed[0].id).toBe(1);
  });

  it('exports empty array JSON for empty log', () => {
    const log = new InMemoryTradeLog();
    const file = join(tmpDir, 'empty.json');
    log.exportToJSON(file);

    const parsed = JSON.parse(readFileSync(file, 'utf-8'));
    expect(parsed).toEqual([]);
  });
});

describe('InMemoryTradeLog — exportToCSV', () => {
  it('writes empty string for empty log', () => {
    const log = new InMemoryTradeLog();
    const file = join(tmpDir, 'empty.csv');
    log.exportToCSV(file);
    expect(readFileSync(file, 'utf-8')).toBe('');
  });

  it('CSV has header row and one data row per trade', () => {
    const log = new InMemoryTradeLog();
    log.logTrade(makeTrade({ id: 1 }), STRATEGY_A, VERSION);

    const file = join(tmpDir, 'trades.csv');
    log.exportToCSV(file);

    const lines = readFileSync(file, 'utf-8').split('\n');
    expect(lines).toHaveLength(2); // header + 1 row
    expect(lines[0]).toContain('id');
    expect(lines[0]).toContain('strategyName');
    expect(lines[0]).toContain('dollarRisk');
    expect(lines[1]).toContain(STRATEGY_A);
  });

  it('CSV values with commas are quoted', () => {
    const log = new InMemoryTradeLog();
    log.logTrade(makeTrade(), 'strategy,with,commas', VERSION);

    const file = join(tmpDir, 'quoted.csv');
    log.exportToCSV(file);

    const content = readFileSync(file, 'utf-8');
    expect(content).toContain('"strategy,with,commas"');
  });

  it('CSV values starting with formula trigger characters are quoted', () => {
    const log = new InMemoryTradeLog();

    for (const prefix of ['=', '+', '-', '@']) {
      const stratName = `${prefix}SUM(A1:A10)`;
      log.logTrade(makeTrade(), stratName, VERSION);
    }

    const file = join(tmpDir, 'formula.csv');
    log.exportToCSV(file);

    const content = readFileSync(file, 'utf-8');
    // Each strategy name that starts with a formula trigger must be quoted
    expect(content).toContain('"=SUM(A1:A10)"');
    expect(content).toContain('"+SUM(A1:A10)"');
    expect(content).toContain('"-SUM(A1:A10)"');
    expect(content).toContain('"@SUM(A1:A10)"');
  });
});

import { useState, useEffect, useRef, useCallback } from 'react';
import { classifyCandle } from '@crypto-terminal/trade-formula';
import { writeFileSync, mkdirSync } from 'node:fs';
import type { OhlcCandle, ExecutedTrade, StrategyRunner, TradeSignal } from '../../engine/types.js';
import { TimeMachine } from '../../engine/time-machine.js';
import { Portfolio } from '../../engine/portfolio.js';
import { calculateMetrics } from '../../shared/metrics.js';
import { InMemoryTradeLog } from '../../shared/execution-log.js';
import type { BacktestState, BacktestStatus, PatternAnalysisData, SpeedLevel } from '../types.js';

// ── Speed → { intervalMs, batchSize } ────────────────────────────────────────

interface SpeedConfig {
  intervalMs: number;
  batchSize: number;
}

const SPEED_CONFIG: Record<SpeedLevel, SpeedConfig> = {
  1:    { intervalMs: 100, batchSize: 1 },
  10:   { intervalMs: 10,  batchSize: 1 },
  100:  { intervalMs: 10,  batchSize: 10 },
  1000: { intervalMs: 10,  batchSize: 100 },
  0:    { intervalMs: 10,  batchSize: 5000 }, // MAX
};

export const SPEED_LEVELS: SpeedLevel[] = [1, 10, 100, 1000, 0];

// ── Pattern data extraction ───────────────────────────────────────────────────

function extractPatternData(
  candles: [OhlcCandle, OhlcCandle, OhlcCandle],
  signal: TradeSignal | null,
): PatternAnalysisData {
  const [c1, c2, c3] = candles;
  const c1Label = classifyCandle(c1.pct_change, c1.body_ratio);
  const c2Label = classifyCandle(c2.pct_change, c2.body_ratio);
  const c3Label = classifyCandle(c3.pct_change, c3.body_ratio);

  const base: PatternAnalysisData = { c1Label, c2Label, c3Label };

  if (signal?.metadata) {
    const m = signal.metadata;
    const ms = m['momentum_scores'];
    const wr = m['wick_ratios'];
    return {
      ...base,
      upProbability: typeof m['up_probability'] === 'number' ? m['up_probability'] : undefined,
      downProbability: typeof m['down_probability'] === 'number' ? m['down_probability'] : undefined,
      momentumScores:
        Array.isArray(ms) && ms.length === 3
          ? (ms as [number, number, number])
          : undefined,
      sequenceSlope: typeof m['sequence_slope'] === 'number' ? m['sequence_slope'] : undefined,
      volatilityProxy: typeof m['volatility_proxy'] === 'number' ? m['volatility_proxy'] : undefined,
      directionalAgreement:
        typeof m['directional_agreement'] === 'number' ? m['directional_agreement'] : undefined,
      wickRatios:
        Array.isArray(wr) && wr.length === 3 ? (wr as [number, number, number]) : undefined,
      route: typeof m['route'] === 'string' ? m['route'] : undefined,
      conviction: typeof m['conviction'] === 'string' ? m['conviction'] : undefined,
    };
  }

  return base;
}

// ── Initial state ─────────────────────────────────────────────────────────────

function buildInitialState(candles: OhlcCandle[], initialBalance: number): BacktestState {
  return {
    status: 'IDLE',
    currentCandles: null,
    patternData: null,
    tradeSignal: null,
    currentBalance: initialBalance,
    candlesProcessed: 0,
    totalCandles: candles.length,
    currentTimestamp: new Date(0),
    progress: 0,
    trades: [],
    metrics: calculateMetrics([], initialBalance),
    strategyErrorCount: 0,
  };
}

// ── useBacktest hook ──────────────────────────────────────────────────────────

export function useBacktest(
  candles: OhlcCandle[],
  strategy: StrategyRunner,
  initialBalance: number,
) {
  const [state, setState] = useState<BacktestState>(() =>
    buildInitialState(candles, initialBalance),
  );
  const [speed, setSpeedState] = useState<SpeedLevel>(10);

  const timeMachineRef = useRef<TimeMachine | null>(null);
  const portfolioRef = useRef<Portfolio | null>(null);
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const statusRef = useRef<BacktestStatus>('IDLE');
  const speedRef = useRef<SpeedLevel>(10);
  const recentTradesRef = useRef<ExecutedTrade[]>([]);
  const strategyErrorCountRef = useRef<number>(0);

  // ── Helpers ─────────────────────────────────────────────────────────────────

  const stopInterval = useCallback(() => {
    if (intervalRef.current !== null) {
      clearInterval(intervalRef.current);
      intervalRef.current = null;
    }
  }, []);

  // ── Tick: process N candles and update state ─────────────────────────────────

  const tick = useCallback(() => {
    const tm = timeMachineRef.current;
    const portfolio = portfolioRef.current;
    if (!tm || !portfolio || statusRef.current !== 'RUNNING') return;

    const { batchSize } = SPEED_CONFIG[speedRef.current];
    const prevTradeCount = portfolio.getTrades().length;

    let lastWindow: [OhlcCandle, OhlcCandle, OhlcCandle] | null = null;
    let lastSignal: TradeSignal | null = null;
    let done = false;

    for (let i = 0; i < batchSize; i++) {
      const window = tm.next();
      if (!window) {
        done = true;
        break;
      }

      const [, , c3] = window;

      // Check open position exit
      if (portfolio.hasOpenPosition()) {
        const slHit = portfolio.checkStopLoss(c3);
        if (!slHit) portfolio.checkTakeProfit(c3);
      }

      // Analyze for new entry
      let signal: TradeSignal | null = null;
      if (!portfolio.hasOpenPosition()) {
        try {
          signal = strategy.analyze(window);
        } catch {
          // Skip candle on strategy error — consistent with BacktestRunner behaviour
          strategyErrorCountRef.current++;
        }
        if (signal) portfolio.openPosition(signal, c3.open_time);
      }

      lastWindow = window;
      lastSignal = signal;
    }

    // Notify strategy of trades closed during this batch
    const allTrades = portfolio.getTrades();
    const newTrades = allTrades.slice(prevTradeCount);
    for (const trade of newTrades) {
      strategy.onTradeExecuted(trade);
    }

    // Maintain a capped ring buffer of the 10 most recent trades
    if (newTrades.length > 0) {
      const combined = recentTradesRef.current.concat(newTrades);
      recentTradesRef.current = combined.length > 10 ? combined.slice(-10) : combined;
    }

    if (done) {
      statusRef.current = 'COMPLETE';
      stopInterval();
    }

    const progressStr = tm.progress();
    const parts = progressStr.split(' / ');
    const rawProcessed = parseInt((parts[0] ?? '0').replace(/,/g, ''), 10);
    const rawTotal = parseInt((parts[1] ?? '1').replace(/,/g, ''), 10);
    const processed = Number.isNaN(rawProcessed) ? 0 : rawProcessed;
    const total = Number.isNaN(rawTotal) ? 1 : rawTotal;

    setState({
      status: done ? 'COMPLETE' : statusRef.current,
      currentCandles: lastWindow,
      patternData: lastWindow ? extractPatternData(lastWindow, lastSignal) : null,
      tradeSignal: lastSignal,
      currentBalance: portfolio.getBalance(),
      candlesProcessed: processed,
      totalCandles: total,
      currentTimestamp: lastWindow ? new Date(lastWindow[2].open_time * 1000) : new Date(0),
      progress: total > 0 ? (processed / total) * 100 : 0,
      trades: recentTradesRef.current,
      metrics: calculateMetrics(allTrades, initialBalance),
      strategyErrorCount: strategyErrorCountRef.current,
      effectiveTpMultiplier: strategy.getEffectiveTpMultiplier?.(),
      effectiveRiskPct: strategy.getEffectiveRiskPct?.(),
    });
  }, [strategy, initialBalance, stopInterval]);

  // ── Start interval at given speed ────────────────────────────────────────────

  const startInterval = useCallback(
    (s: SpeedLevel) => {
      stopInterval();
      const { intervalMs } = SPEED_CONFIG[s];
      intervalRef.current = setInterval(tick, Math.max(intervalMs, 1));
    },
    [stopInterval, tick],
  );

  // ── Init / reset engine state ────────────────────────────────────────────────

  const initEngine = useCallback(() => {
    timeMachineRef.current = new TimeMachine(candles);
    portfolioRef.current = new Portfolio(initialBalance);
    statusRef.current = 'IDLE';
  }, [candles, initialBalance]);

  // ── Public controls ──────────────────────────────────────────────────────────

  const start = useCallback(() => {
    if (statusRef.current !== 'IDLE') return;
    statusRef.current = 'RUNNING';
    setState((prev) => ({ ...prev, status: 'RUNNING' }));
    startInterval(speedRef.current);
  }, [startInterval]);

  const pause = useCallback(() => {
    if (statusRef.current !== 'RUNNING') return;
    statusRef.current = 'PAUSED';
    stopInterval();
    setState((prev) => ({ ...prev, status: 'PAUSED' }));
  }, [stopInterval]);

  const resume = useCallback(() => {
    if (statusRef.current !== 'PAUSED') return;
    statusRef.current = 'RUNNING';
    setState((prev) => ({ ...prev, status: 'RUNNING' }));
    startInterval(speedRef.current);
  }, [startInterval]);

  const restart = useCallback(() => {
    stopInterval();
    strategy.reset();
    initEngine();
    recentTradesRef.current = [];
    strategyErrorCountRef.current = 0;
    setState(buildInitialState(candles, initialBalance));
  }, [stopInterval, strategy, initEngine, candles, initialBalance]);

  const saveResults = useCallback(() => {
    const allTrades = portfolioRef.current?.getTrades() ?? [];
    const balance = portfolioRef.current?.getBalance() ?? initialBalance;
    const metrics = calculateMetrics(allTrades, initialBalance);
    const timestamp = new Date().toISOString();
    const safeTimestamp = timestamp.replace(/[:.]/g, '-').slice(0, 19);
    const exportDir = './export';
    mkdirSync(exportDir, { recursive: true });
    const basename = `${exportDir}/backtest-${strategy.name}-${safeTimestamp}`;

    // JSON
    const payload = {
      metadata: {
        strategy: strategy.name,
        version: strategy.version,
        initialBalance,
        finalBalance: balance,
        runDate: timestamp,
      },
      trades: allTrades,
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
    writeFileSync(`${basename}.json`, JSON.stringify(payload, null, 2));

    // CSV via shared InMemoryTradeLog
    const tradeLog = new InMemoryTradeLog();
    for (const trade of allTrades) {
      tradeLog.logTrade(trade, strategy.name, strategy.version);
    }
    tradeLog.exportToCSV(`${basename}.csv`);
  }, [strategy, initialBalance]);

  const setSpeed = useCallback(
    (newSpeed: SpeedLevel) => {
      speedRef.current = newSpeed;
      setSpeedState(newSpeed);
      if (statusRef.current === 'RUNNING') startInterval(newSpeed);
    },
    [startInterval],
  );

  const increaseSpeed = useCallback(() => {
    const idx = SPEED_LEVELS.indexOf(speedRef.current);
    const newSpeed = SPEED_LEVELS[Math.min(idx + 1, SPEED_LEVELS.length - 1)] ?? speedRef.current;
    setSpeed(newSpeed);
  }, [setSpeed]);

  const decreaseSpeed = useCallback(() => {
    const idx = SPEED_LEVELS.indexOf(speedRef.current);
    const newSpeed = SPEED_LEVELS[Math.max(idx - 1, 0)] ?? speedRef.current;
    setSpeed(newSpeed);
  }, [setSpeed]);

  // ── Lifecycle ────────────────────────────────────────────────────────────────

  useEffect(() => {
    initEngine();
    return stopInterval;
  }, [initEngine, stopInterval]);

  return {
    state,
    speed,
    start,
    pause,
    resume,
    restart,
    saveResults,
    setSpeed,
    increaseSpeed,
    decreaseSpeed,
  };
}

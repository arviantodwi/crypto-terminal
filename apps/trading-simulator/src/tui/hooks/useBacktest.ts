import { useState, useEffect, useRef, useCallback } from 'react';
import { classifyCandle } from '@crypto-terminal/trade-formula';
import { writeFileSync, mkdirSync } from 'node:fs';
import type { OhlcCandle, ExecutedTrade, StrategyRunner, TradeSignal } from '../../engine/types.js';
import { TimeMachine } from '../../engine/time-machine.js';
import { Portfolio } from '../../engine/portfolio.js';
import { calculateMetrics } from '../../shared/metrics.js';
import { InMemoryTradeLog } from '../../shared/execution-log.js';
import type { BacktestState, BacktestStatus, PatternAnalysisData, SpeedLevel, InstrumentData } from '../types.js';

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

// ── Per-instrument runtime state ──────────────────────────────────────────────

interface InstrumentRuntime {
  instrument: string;
  strategy: StrategyRunner;
  timeMachine: TimeMachine;
  portfolio: Portfolio;
  done: boolean;
}

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

function buildInitialState(instruments: InstrumentData[], initialBalance: number): BacktestState {
  const totalCandles = instruments.reduce((sum, { candles }) => sum + candles.length, 0);
  return {
    status: 'IDLE',
    currentCandles: null,
    patternData: null,
    tradeSignal: null,
    currentBalance: initialBalance * instruments.length,
    candlesProcessed: 0,
    totalCandles,
    currentTimestamp: new Date(0),
    progress: 0,
    trades: [],
    metrics: calculateMetrics([], initialBalance),
    strategyErrorCount: 0,
  };
}

// ── useBacktest hook ──────────────────────────────────────────────────────────

export function useBacktest(
  instruments: InstrumentData[],
  initialBalance: number,
) {
  const [state, setState] = useState<BacktestState>(() =>
    buildInitialState(instruments, initialBalance),
  );
  const [speed, setSpeedState] = useState<SpeedLevel>(10);

  const runtimesRef = useRef<InstrumentRuntime[]>([]);
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

  // ── Tick: process N candles per instrument and update state ──────────────────

  const tick = useCallback(() => {
    const runtimes = runtimesRef.current;
    if (runtimes.length === 0 || statusRef.current !== 'RUNNING') return;

    const { batchSize } = SPEED_CONFIG[speedRef.current];

    let lastWindow: [OhlcCandle, OhlcCandle, OhlcCandle] | null = null;
    let lastSignal: TradeSignal | null = null;
    const batchNewTrades: ExecutedTrade[] = [];

    for (const runtime of runtimes) {
      if (runtime.done) continue;

      const { timeMachine, portfolio, strategy } = runtime;
      const prevTradeCount = portfolio.getTrades().length;

      let localLastWindow: [OhlcCandle, OhlcCandle, OhlcCandle] | null = null;
      let localLastSignal: TradeSignal | null = null;

      for (let i = 0; i < batchSize; i++) {
        const window = timeMachine.next();
        if (!window) {
          runtime.done = true;
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
            strategyErrorCountRef.current++;
          }
          if (signal) portfolio.openPosition(signal, c3.open_time);
        }

        localLastWindow = window;
        localLastSignal = signal;
      }

      // Notify strategy of trades closed during this batch
      const allTrades = portfolio.getTrades();
      const newTrades = allTrades.slice(prevTradeCount);
      for (const trade of newTrades) {
        strategy.onTradeExecuted(trade);
        batchNewTrades.push(trade);
      }

      if (localLastWindow) {
        lastWindow = localLastWindow;
        lastSignal = localLastSignal;
      }
    }

    // Maintain a capped ring buffer of the 10 most recent trades across all instruments
    if (batchNewTrades.length > 0) {
      const combined = recentTradesRef.current.concat(batchNewTrades);
      recentTradesRef.current = combined.length > 10 ? combined.slice(-10) : combined;
    }

    const allDone = runtimes.every((r) => r.done);
    if (allDone) {
      statusRef.current = 'COMPLETE';
      stopInterval();
    }

    // Aggregate state across all instruments
    const allTrades = runtimes.flatMap((r) => r.portfolio.getTrades());
    const totalBalance = runtimes.reduce((sum, r) => sum + r.portfolio.getBalance(), 0);

    // Sum progress across all instruments
    let totalProcessed = 0;
    let totalCandlesSum = 0;
    for (const runtime of runtimes) {
      const progressStr = runtime.timeMachine.progress();
      const parts = progressStr.split(' / ');
      const rawProcessed = parseInt((parts[0] ?? '0').replace(/,/g, ''), 10);
      totalProcessed += Number.isNaN(rawProcessed) ? 0 : rawProcessed;
      totalCandlesSum += runtime.timeMachine.total;
    }

    setState({
      status: allDone ? 'COMPLETE' : statusRef.current,
      currentCandles: lastWindow,
      patternData: lastWindow ? extractPatternData(lastWindow, lastSignal) : null,
      tradeSignal: lastSignal,
      currentBalance: totalBalance,
      candlesProcessed: totalProcessed,
      totalCandles: totalCandlesSum,
      currentTimestamp: lastWindow ? new Date(lastWindow[2].open_time * 1000) : new Date(0),
      progress: totalCandlesSum > 0 ? (totalProcessed / totalCandlesSum) * 100 : 0,
      trades: recentTradesRef.current,
      metrics: calculateMetrics(allTrades, initialBalance * runtimes.length),
      strategyErrorCount: strategyErrorCountRef.current,
      effectiveTpMultiplier: runtimes[0]?.strategy.getEffectiveTpMultiplier?.(),
      effectiveRiskPct: runtimes[0]?.strategy.getEffectiveRiskPct?.(),
    });
  }, [initialBalance, stopInterval]);

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
    runtimesRef.current = instruments.map(({ instrument, candles, strategy }) => ({
      instrument,
      strategy,
      timeMachine: new TimeMachine(candles),
      portfolio: new Portfolio(initialBalance, instrument),
      done: false,
    }));
    statusRef.current = 'IDLE';
  }, [instruments, initialBalance]);

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
    for (const runtime of runtimesRef.current) {
      runtime.strategy.reset();
    }
    initEngine();
    recentTradesRef.current = [];
    strategyErrorCountRef.current = 0;
    setState(buildInitialState(instruments, initialBalance));
  }, [stopInterval, initEngine, instruments, initialBalance]);

  const saveResults = useCallback(() => {
    const runtimes = runtimesRef.current;
    const allTrades = runtimes.flatMap((r) => r.portfolio.getTrades());
    const totalBalance = runtimes.reduce((sum, r) => sum + r.portfolio.getBalance(), 0);
    const totalInitialBalance = initialBalance * runtimes.length;
    const metrics = calculateMetrics(allTrades, totalInitialBalance);
    const timestamp = new Date().toISOString();
    const safeTimestamp = timestamp.replace(/[:.]/g, '-').slice(0, 19);
    const exportDir = './export';
    mkdirSync(exportDir, { recursive: true });

    const strategyName = runtimes[0]?.strategy.name ?? 'unknown';
    const strategyVersion = runtimes[0]?.strategy.version ?? '0.0.0';
    const basename = `${exportDir}/backtest-${strategyName}-${safeTimestamp}`;

    // JSON
    const payload = {
      metadata: {
        strategy: strategyName,
        version: strategyVersion,
        instruments: runtimes.map((r) => r.instrument),
        initialBalance,
        totalInitialBalance,
        finalBalance: totalBalance,
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
      tradeLog.logTrade(trade, strategyName, strategyVersion);
    }
    tradeLog.exportToCSV(`${basename}.csv`);
  }, [initialBalance]);

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

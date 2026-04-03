import { useApp } from 'ink';
import { Box } from 'ink';
import type { TuiAppProps } from './types.js';
import { useBacktest } from './hooks/useBacktest.js';
import { useKeyboard } from './hooks/useKeyboard.js';
import { Header } from './components/Header.js';
import { Configuration } from './components/Configuration.js';
import { PerformanceMetrics } from './components/PerformanceMetrics.js';
import { TradeLog } from './components/TradeLog.js';
import { PatternDisplay } from './components/PatternDisplay.js';
import { Footer } from './components/Footer.js';

export function App({
  candles,
  strategy,
  strategyName,
  instrument,
  timeframe,
  initialBalance,
  riskPercent,
  tpMultiplier,
}: TuiAppProps) {
  const { exit } = useApp();

  const {
    state,
    speed,
    start,
    pause,
    resume,
    restart,
    saveResults,
    increaseSpeed,
    decreaseSpeed,
  } = useBacktest(candles, strategy, initialBalance);

  useKeyboard({
    status: state.status,
    onStart:     start,
    onPause:     pause,
    onResume:    resume,
    onRestart:   restart,
    onSave:      saveResults,
    onQuit:      exit,
    onSpeedUp:   increaseSpeed,
    onSpeedDown: decreaseSpeed,
  });

  return (
    <Box flexDirection="column" height="100%">
      {/* Header */}
      <Header
        strategy={strategyName}
        instrument={instrument}
        timeframe={timeframe}
        status={state.status}
        progress={state.progress}
      />

      {/* Main content */}
      <Box flexDirection="row" flexGrow={1}>
        {/* Left column: 70% */}
        <Box flexDirection="column" width="70%">
          <Configuration
            initialBalance={initialBalance}
            currentBalance={state.currentBalance}
            riskPercent={riskPercent}
            tpMultiplier={tpMultiplier}
            currentTimestamp={state.currentTimestamp}
            candlesProcessed={state.candlesProcessed}
            totalCandles={state.totalCandles}
          />
          <PerformanceMetrics metrics={state.metrics} />
          <TradeLog trades={state.trades} />
        </Box>

        {/* Right column: 30% */}
        <Box width="30%">
          <PatternDisplay
            candles={state.currentCandles}
            patternData={state.patternData}
            tradeSignal={state.tradeSignal}
          />
        </Box>
      </Box>

      {/* Footer */}
      <Footer status={state.status} speed={speed} />
    </Box>
  );
}

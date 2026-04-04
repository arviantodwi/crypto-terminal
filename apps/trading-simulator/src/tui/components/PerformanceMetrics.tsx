import type { ReactNode } from 'react';
import { Box, Text } from 'ink';
import type { PerformanceMetrics } from '../../shared/metrics.js';
import { formatPercent, formatNumber, formatHoldTime, renderEquityCurve } from '../utils/formatting.js';

interface PerformanceMetricsProps {
  metrics: PerformanceMetrics;
}

function MetricRow({ label, value, valueColor }: { label: string; value: string; valueColor?: string }) {
  return (
    <Box paddingX={1}>
      <Box flexGrow={1}>
        <Text color="gray">{label}</Text>
      </Box>
      <Text color={valueColor ?? 'white'}>{value}</Text>
    </Box>
  );
}

function SubPanel({ title, children }: { title: string; children: ReactNode }) {
  return (
    <Box flexDirection="column" flexGrow={1} flexBasis={0} flexShrink={1} borderStyle="single" borderColor="gray">
      <Box paddingX={1}>
        <Text bold color="yellow"> {title}</Text>
      </Box>
      {children}
    </Box>
  );
}

function pnlColor(v: number) {
  return v > 0 ? 'green' : v < 0 ? 'red' : 'white';
}

export function PerformanceMetrics({ metrics }: PerformanceMetricsProps) {
  const equityValues = metrics.equityCurve.map((p) => p.balance);

  // Fill 70% column minus PerformanceMetrics border (2) minus paddingX (2)
  const curveWidth = Math.max(10, Math.floor((process.stdout.columns ?? 80) * 0.7) - 4);
  const curveHeight = 5;
  const curveLines = renderEquityCurve(equityValues, curveWidth, curveHeight);
  const profitFactorStr = isNaN(metrics.profitFactor)
    ? 'N/A'
    : metrics.profitFactor === Infinity
      ? '∞'
      : formatNumber(metrics.profitFactor, 2);

  return (
    <Box borderStyle="single" borderColor="gray" flexDirection="column">
      <Box paddingX={1}>
        <Text bold color="white"> PERFORMANCE METRICS</Text>
      </Box>
      <Box flexDirection="row" gap={1}>
        {/* Overall */}
        <SubPanel title="OVERALL">
          <MetricRow label="Total Trades" value={String(metrics.totalTrades)} />
          <MetricRow label="Winning" value={String(metrics.winningTrades)} valueColor="green" />
          <MetricRow label="Losing" value={String(metrics.losingTrades)} valueColor="red" />
          <MetricRow
            label="Win Rate"
            value={formatPercent(metrics.winRate)}
            valueColor={pnlColor(metrics.winRate - 50)}
          />
          <MetricRow
            label="Total P&L"
            value={formatPercent(metrics.totalPnL)}
            valueColor={pnlColor(metrics.totalPnL)}
          />
        </SubPanel>

        {/* Risk metrics */}
        <SubPanel title="RISK">
          <MetricRow
            label="Max Drawdown"
            value={formatPercent(metrics.maxDrawdown)}
            valueColor="red"
          />
          <MetricRow
            label="Sharpe Ratio"
            value={formatNumber(metrics.sharpeRatio, 2)}
            valueColor={pnlColor(metrics.sharpeRatio)}
          />
          <MetricRow label="Profit Factor" value={profitFactorStr} />
          <MetricRow
            label="Expected Value"
            value={formatPercent(metrics.expectedValue)}
            valueColor={pnlColor(metrics.expectedValue)}
          />
        </SubPanel>

        {/* Trade statistics */}
        <SubPanel title="TRADE STATS">
          <MetricRow
            label="Avg Win"
            value={formatPercent(metrics.averageWin)}
            valueColor="green"
          />
          <MetricRow
            label="Avg Loss"
            value={formatPercent(metrics.averageLoss)}
            valueColor="red"
          />
          <MetricRow
            label="Largest Win"
            value={formatPercent(metrics.largestWin)}
            valueColor="green"
          />
          <MetricRow
            label="Largest Loss"
            value={formatPercent(metrics.largestLoss)}
            valueColor="red"
          />
          <MetricRow
            label="Avg Hold Time"
            value={formatHoldTime(metrics.averageHoldTime)}
          />
        </SubPanel>
      </Box>

      {/* P&L Curve */}
      <Box flexDirection="column" paddingX={1} paddingY={0}>
        <Text bold color="gray"> P&L CURVE</Text>
        {curveLines.map((line, i) => (
          <Text key={i} color={metrics.totalPnL >= 0 ? 'green' : 'red'}>
            {line}
          </Text>
        ))}
      </Box>
    </Box>
  );
}

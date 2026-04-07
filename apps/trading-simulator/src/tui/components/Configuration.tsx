import { Box, Text } from 'ink';
import { formatCurrency, formatPercent, formatTimestamp, formatRelativeTime } from '../utils/formatting.js';

interface ConfigurationProps {
  initialBalance: number;
  currentBalance: number;
  riskPercent: number;
  effectiveRiskPct?: number;
  tpMultiplier: number;
  currentTimestamp: Date;
  candlesProcessed: number;
  totalCandles: number;
  timeframe: string;
}

function Row({ label, value, valueColor }: { label: string; value: string; valueColor?: string }) {
  return (
    <Box justifyContent="space-between" paddingX={1}>
      <Text color="gray">{label}</Text>
      <Text color={valueColor ?? 'white'}>{value}</Text>
    </Box>
  );
}

export function Configuration({
  initialBalance,
  currentBalance,
  riskPercent,
  effectiveRiskPct,
  tpMultiplier,
  currentTimestamp,
  candlesProcessed,
  totalCandles,
  timeframe,
}: ConfigurationProps) {
  const balanceDiff = currentBalance - initialBalance;
  const balanceColor = balanceDiff >= 0 ? 'green' : 'red';
  const timestampValid = currentTimestamp.getTime() > 0;

  return (
    <Box
      borderStyle="single"
      borderColor="gray"
      flexDirection="column"
      paddingY={0}
    >
      <Box paddingX={1}>
        <Text bold color="white"> CONFIGURATION</Text>
      </Box>
      <Row label="Initial Balance" value={formatCurrency(initialBalance)} />
      <Row
        label="Current Balance"
        value={formatCurrency(currentBalance)}
        valueColor={balanceColor}
      />
      <Row
        label="Risk / Trade"
        value={formatPercent(effectiveRiskPct ?? riskPercent)}
        valueColor={effectiveRiskPct !== undefined && effectiveRiskPct !== riskPercent ? 'yellow' : undefined}
      />
      <Row label="TP Multiplier" value={`${tpMultiplier.toFixed(2)}x`} />
      <Row
        label="Current Time"
        value={timestampValid ? formatTimestamp(currentTimestamp) : '—'}
      />
      <Row
        label="Elapsed"
        value={candlesProcessed > 0 ? formatRelativeTime(candlesProcessed, timeframe) : '—'}
      />
      <Row
        label="Candles"
        value={`${candlesProcessed.toLocaleString()} / ${totalCandles.toLocaleString()}`}
      />
    </Box>
  );
}

import { Box, Text } from 'ink';
import type { PerInstrumentStats } from '../types.js';

interface InstrumentStatsProps {
  stats: PerInstrumentStats[];
}

function formatCurrency(value: number): string {
  const prefix = value >= 0 ? '$' : '-$';
  return `${prefix}${Math.abs(value).toFixed(2)}`;
}

function formatPercent(value: number | undefined): string {
  return value !== undefined ? `${value.toFixed(1)}%` : '—';
}

export function InstrumentStats({ stats }: InstrumentStatsProps) {
  if (stats.length === 0) {
    return (
      <Box borderStyle="single" borderColor="gray" paddingX={1} paddingY={0}>
        <Text bold color="white"> INSTRUMENT STATS</Text>
        <Text color="gray"> — Waiting for trades...</Text>
      </Box>
    );
  }

  return (
    <Box flexDirection="column" borderStyle="single" borderColor="gray" paddingX={1} paddingY={0}>
      <Box>
        <Text bold color="white"> INSTRUMENT STATS</Text>
      </Box>
      <Box paddingY={0}>
        <Text color="gray">
          {' '}
          {'Instrument'.padEnd(12)}
          {'Trades'.padStart(8)}
          {'Win%'.padStart(8)}
          {'PnL'.padStart(12)}
          {'Risk'.padStart(10)}
          {'TPx'.padStart(8)}
        </Text>
      </Box>
      {stats.map((s) => (
        <Box key={s.instrument} paddingY={0}>
          <Text>
            {` ${s.instrument.padEnd(12)}`}
            <Text color="white">{String(s.trades).padStart(8)}</Text>
            <Text color={s.winRate >= 50 ? 'green' : s.winRate > 0 ? 'yellow' : 'red'}>
              {`${s.winRate.toFixed(1)}%`.padStart(8)}
            </Text>
            <Text color={s.pnlDollar >= 0 ? 'green' : 'red'}>
              {formatCurrency(s.pnlDollar).padStart(12)}
            </Text>
            <Text color="cyan">{formatPercent(s.effectiveRiskPct).padStart(10)}</Text>
            <Text color="magenta">{s.effectiveTpMultiplier?.toFixed(2)?.padStart(8) ?? '—'.padStart(8)}</Text>
          </Text>
        </Box>
      ))}
    </Box>
  );
}
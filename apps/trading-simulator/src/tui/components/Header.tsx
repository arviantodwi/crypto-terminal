import { Box, Text } from 'ink';
import type { BacktestStatus } from '../types.js';

interface HeaderProps {
  strategy: string;
  instrument: string;
  timeframe: string;
  status: BacktestStatus;
  progress: number;
}

const STATUS_COLORS: Record<BacktestStatus, string> = {
  IDLE:     'gray',
  RUNNING:  'green',
  PAUSED:   'yellow',
  COMPLETE: 'cyan',
};

const STATUS_LABELS: Record<BacktestStatus, string> = {
  IDLE:     '○ IDLE',
  RUNNING:  '● RUNNING',
  PAUSED:   '⏸ PAUSED',
  COMPLETE: '✓ COMPLETE',
};

export function Header({ strategy, instrument, timeframe, status, progress }: HeaderProps) {
  const color = STATUS_COLORS[status];
  const label = STATUS_LABELS[status];
  const progressStr =
    status === 'RUNNING' || status === 'PAUSED' || status === 'COMPLETE'
      ? ` (${progress.toFixed(1)}% complete)`
      : '';

  return (
    <Box
      borderStyle="double"
      borderColor="cyan"
      paddingX={1}
      justifyContent="space-between"
    >
      <Text bold color="cyan">
        PHANTOM TERMINAL — BACKTEST SIMULATOR
      </Text>
      <Box gap={3}>
        <Text color="white">
          Strategy: <Text bold>{strategy}</Text>
        </Text>
        <Text color="white">
          {instrument} {timeframe}
        </Text>
        <Text color={color}>
          {label}
          {progressStr}
        </Text>
      </Box>
    </Box>
  );
}

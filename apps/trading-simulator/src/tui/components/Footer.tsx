import { Box, Text } from 'ink';
import type { BacktestStatus } from '../types.js';
import { formatSpeed } from '../utils/formatting.js';

interface FooterProps {
  status: BacktestStatus;
  speed: number;
}

export function Footer({ status, speed }: FooterProps) {
  const spaceLabel =
    status === 'IDLE'    ? '[SPACE] Start'   :
    status === 'RUNNING' ? '[SPACE] Pause'   :
    status === 'PAUSED'  ? '[SPACE] Resume'  :
                           '[SPACE] —';

  return (
    <Box
      borderStyle="single"
      borderColor="gray"
      paddingX={1}
      justifyContent="space-between"
    >
      <Box gap={3}>
        <Text color="cyan">{spaceLabel}</Text>
        <Text color="cyan">[R] Restart</Text>
        <Text color="cyan">[S] Save Results</Text>
        <Text color="cyan">[Q] Quit</Text>
        <Text color="cyan">[↑/↓] Speed</Text>
      </Box>
      <Text color="yellow">Speed: <Text bold>{formatSpeed(speed)}</Text></Text>
    </Box>
  );
}

import { Box, Text } from 'ink';
import type { ExecutedTrade } from '../../engine/types.js';
import { formatCurrency, formatTimestamp } from '../utils/formatting.js';

interface TradeLogProps {
  trades: ExecutedTrade[];
}

const COL_WIDTHS = {
  num:    4,
  time:   11,
  type:   6,
  entry:  12,
  sl:     12,
  tp:     12,
  exit:   12,
  pnl:    9,
  result: 6,
};

function pad(s: string, width: number, right = false): string {
  if (right) return s.padStart(width);
  return s.padEnd(width);
}

function HeaderRow() {
  return (
    <Box paddingX={1}>
      <Text bold color="gray">
        {pad('#',      COL_WIDTHS.num,    false)}
        {pad('Time',   COL_WIDTHS.time,   false)}
        {pad('Type',   COL_WIDTHS.type,   false)}
        {pad('Entry',  COL_WIDTHS.entry,  true)}
        {'  '}
        {pad('SL',     COL_WIDTHS.sl,     true)}
        {'  '}
        {pad('TP',     COL_WIDTHS.tp,     true)}
        {'  '}
        {pad('Exit',   COL_WIDTHS.exit,   true)}
        {'  '}
        {pad('P&L',    COL_WIDTHS.pnl,    true)}
        {'  '}
        {'Result'}
      </Text>
    </Box>
  );
}

function TradeRow({ trade }: { trade: ExecutedTrade }) {
  const isWin = trade.exitReason === 'TP';
  const pnlColor = trade.pnlPercent > 0 ? 'green' : trade.pnlPercent < 0 ? 'red' : 'white';
  const directionColor = trade.direction === 'LONG' ? 'green' : 'red';
  const pnlStr = (trade.pnlPercent >= 0 ? '+' : '') + trade.pnlPercent.toFixed(2) + '%';

  return (
    <Box paddingX={1}>
      <Text>
        {pad(String(trade.id), COL_WIDTHS.num, false)}
        {pad(formatTimestamp(trade.entryTimestamp), COL_WIDTHS.time, false)}
      </Text>
      <Text color={directionColor}>
        {pad(trade.direction, COL_WIDTHS.type, false)}
      </Text>
      <Text>
        {pad(formatCurrency(trade.entryPrice), COL_WIDTHS.entry, true)}
        {'  '}
        {pad(formatCurrency(trade.slPrice),    COL_WIDTHS.sl,    true)}
        {'  '}
        {pad(formatCurrency(trade.tpPrice),    COL_WIDTHS.tp,    true)}
        {'  '}
        {pad(formatCurrency(trade.exitPrice),  COL_WIDTHS.exit,  true)}
        {'  '}
      </Text>
      <Text color={pnlColor}>
        {pad(pnlStr, COL_WIDTHS.pnl, true)}
      </Text>
      <Text>{'  '}</Text>
      <Text color={isWin ? 'green' : 'red'}>
        {isWin ? '✓ TP' : '✗ SL'}
      </Text>
    </Box>
  );
}

export function TradeLog({ trades }: TradeLogProps) {
  return (
    <Box borderStyle="single" borderColor="gray" flexDirection="column">
      <Box paddingX={1}>
        <Text bold color="white"> TRADE LOG</Text>
        <Text color="gray"> (last {trades.length})</Text>
      </Box>
      <HeaderRow />
      {trades.length === 0 ? (
        <Box paddingX={1}>
          <Text color="gray">No trades yet</Text>
        </Box>
      ) : (
        trades.map((trade) => <TradeRow key={trade.id} trade={trade} />)
      )}
    </Box>
  );
}

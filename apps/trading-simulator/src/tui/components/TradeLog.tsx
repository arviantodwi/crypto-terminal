import { Box, Text } from 'ink';
import type { ExecutedTrade } from '../../engine/types.js';
import { formatCurrency, formatTimestamp, formatPercent } from '../utils/formatting.js';

interface TradeLogProps {
  trades: ExecutedTrade[];
}

const COL_WIDTHS = {
  num:        6,
  ticker:     10,
  time:       16,
  type:       5,
  entry:      12,
  sl:         12,
  tp:         12,
  exit:       12,
  riskDollar: 9,
  pnlDollar:  10,
  pnlPct:     7,
  result:     6,
};

function pad(s: string, width: number, right = false): string {
  if (right) return s.padStart(width);
  return s.padEnd(width);
}

function HeaderRow() {
  return (
    <Box paddingX={1}>
      <Text bold color="gray">
        {pad('#',       COL_WIDTHS.num,        false)}
        {'  '}
        {pad('Ticker',  COL_WIDTHS.ticker,     false)}
        {'  '}
        {pad('Time',    COL_WIDTHS.time,       false)}
        {'  '}
        {pad('Type',    COL_WIDTHS.type,       false)}
        {'  '}
        {pad('Entry',   COL_WIDTHS.entry,      true)}
        {'  '}
        {pad('SL',      COL_WIDTHS.sl,         true)}
        {'  '}
        {pad('TP',      COL_WIDTHS.tp,         true)}
        {'  '}
        {pad('Exit',    COL_WIDTHS.exit,       true)}
        {'  '}
        {pad('Risk $',  COL_WIDTHS.riskDollar, true)}
        {'  '}
        {pad('P&L $',   COL_WIDTHS.pnlDollar,  true)}
        {'  '}
        {pad('P&L %',   COL_WIDTHS.pnlPct,     true)}
        {'  '}
        {pad('Result',  COL_WIDTHS.result,     false)}
      </Text>
    </Box>
  );
}

function TradeRow({ trade }: { trade: ExecutedTrade }) {
  const isWin = trade.exitReason === 'TP';
  const pnlColor = trade.pnlPercent > 0 ? 'green' : trade.pnlPercent < 0 ? 'red' : 'white';
  const directionColor = trade.direction === 'LONG' ? 'green' : 'red';
  const pnlDollarStr = (trade.pnlDollar >= 0 ? '+' : '-') + formatCurrency(Math.abs(trade.pnlDollar));

  return (
    <Box paddingX={1}>
      <Text>
        {pad(String(trade.id),                              COL_WIDTHS.num,        false)}
        {'  '}
        {pad(trade.instrument,                              COL_WIDTHS.ticker,     false)}
        {'  '}
        {pad(formatTimestamp(trade.entryTimestamp),         COL_WIDTHS.time,       false)}
        {'  '}
        <Text color={directionColor}>
          {pad(trade.direction,                             COL_WIDTHS.type,       false)}
        </Text>
        {'  '}
        {pad(formatCurrency(trade.entryPrice),              COL_WIDTHS.entry,      true)}
        {'  '}
        {pad(formatCurrency(trade.slPrice),                 COL_WIDTHS.sl,         true)}
        {'  '}
        {pad(formatCurrency(trade.tpPrice),                 COL_WIDTHS.tp,         true)}
        {'  '}
        {pad(formatCurrency(trade.exitPrice),               COL_WIDTHS.exit,       true)}
        {'  '}
        {pad(formatCurrency(trade.dollarRisk),              COL_WIDTHS.riskDollar, true)}
        {'  '}
        <Text color={pnlColor}>
          {pad(pnlDollarStr,                                COL_WIDTHS.pnlDollar,  true)}
        </Text>
        {'  '}
        <Text color={pnlColor}>
          {pad(formatPercent(trade.pnlPercent),             COL_WIDTHS.pnlPct,     true)}
        </Text>
        {'  '}
        <Text color={isWin ? 'green' : 'red'}>
          {pad(isWin ? '✓ TP' : '✗ SL',                    COL_WIDTHS.result,     false)}
        </Text>
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
        trades.map((trade) => <TradeRow key={`${trade.instrument}-${trade.id}`} trade={trade} />)
      )}
    </Box>
  );
}

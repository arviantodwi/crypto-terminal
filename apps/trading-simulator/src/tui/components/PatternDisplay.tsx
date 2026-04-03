import type { ReactNode } from 'react';
import { Box, Text } from 'ink';
import { render3CandleWindow, formatPattern } from '../../shared/pattern-display.js';
import type { OhlcCandle, TradeSignal } from '../../engine/types.js';
import type { PatternAnalysisData } from '../types.js';
import { formatCurrency, formatPercent, formatNumber } from '../utils/formatting.js';

interface PatternDisplayProps {
  candles: [OhlcCandle, OhlcCandle, OhlcCandle] | null;
  patternData: PatternAnalysisData | null;
  tradeSignal: TradeSignal | null;
}

const CANDLE_RENDER_HEIGHT = 8;

function Section({ title, children }: { title: string; children: ReactNode }) {
  return (
    <Box flexDirection="column" marginTop={1}>
      <Text bold color="yellow">{title}</Text>
      {children}
    </Box>
  );
}

function KV({ label, value, valueColor }: { label: string; value: string; valueColor?: string }) {
  return (
    <Box>
      <Text color="gray">{label}: </Text>
      <Text color={valueColor ?? 'white'}>{value}</Text>
    </Box>
  );
}

export function PatternDisplay({ candles, patternData, tradeSignal }: PatternDisplayProps) {
  return (
    <Box
      borderStyle="single"
      borderColor="gray"
      flexDirection="column"
      paddingX={1}
      width="100%"
    >
      <Text bold color="white"> PATTERN DISPLAY</Text>

      {/* 3-Candle window */}
      <Section title="─ 3-CANDLE WINDOW">
        {candles ? (
          <Box flexDirection="column">
            {render3CandleWindow(candles, CANDLE_RENDER_HEIGHT).map((line, i) => (
              <Text key={i} color="white">{line}</Text>
            ))}
            <Box gap={2} marginTop={0}>
              <Text color="gray"> C1</Text>
              <Text color="gray">    C2</Text>
              <Text color="gray">    C3</Text>
            </Box>
          </Box>
        ) : (
          <Text color="gray">Waiting for candles…</Text>
        )}
      </Section>

      {/* Pattern classification */}
      {patternData ? (
        <Section title="─ CLASSIFICATION">
          <KV label="C1" value={patternData.c1Label} />
          <KV label="C2" value={patternData.c2Label} />
          <KV label="C3" value={patternData.c3Label} />
          <KV
            label="Pattern"
            value={formatPattern([patternData.c1Label, patternData.c2Label, patternData.c3Label])}
          />
          {patternData.upProbability !== undefined && (
            <KV
              label="Probability"
              value={`${patternData.upProbability.toFixed(0)}% UP / ${patternData.downProbability?.toFixed(0) ?? '?'}% DOWN`}
            />
          )}
        </Section>
      ) : (
        <Section title="─ CLASSIFICATION">
          <Text color="gray">—</Text>
        </Section>
      )}

      {/* Pre-computation values */}
      {patternData?.momentumScores ? (
        <Section title="─ PRE-COMPUTE">
          <Box>
            <Text color="gray">Momentum: </Text>
            <Text>
              C1:{formatNumber(patternData.momentumScores[0])}  C2:{formatNumber(patternData.momentumScores[1])}  C3:{formatNumber(patternData.momentumScores[2])}
            </Text>
          </Box>
          {patternData.sequenceSlope !== undefined && (
            <KV
              label="Seq Slope"
              value={formatNumber(patternData.sequenceSlope)}
              valueColor={patternData.sequenceSlope >= 0 ? 'green' : 'red'}
            />
          )}
          {patternData.volatilityProxy !== undefined && (
            <KV label="Volatility" value={`${formatNumber(patternData.volatilityProxy)}%`} />
          )}
          {patternData.directionalAgreement !== undefined && (
            <KV
              label="Dir Agree"
              value={String(patternData.directionalAgreement)}
              valueColor={patternData.directionalAgreement > 0 ? 'green' : patternData.directionalAgreement < 0 ? 'red' : 'white'}
            />
          )}
          {patternData.wickRatios && (
            <Box>
              <Text color="gray">Wick: </Text>
              <Text>
                C1:{formatNumber(patternData.wickRatios[0])}  C2:{formatNumber(patternData.wickRatios[1])}  C3:{formatNumber(patternData.wickRatios[2])}
              </Text>
            </Box>
          )}
          {patternData.route && (
            <KV label="Route" value={patternData.route} valueColor="cyan" />
          )}
          {patternData.conviction && (
            <KV label="Conviction" value={patternData.conviction} valueColor="yellow" />
          )}
        </Section>
      ) : null}

      {/* Trade decision */}
      {tradeSignal ? (
        <Section title="─ TRADE SIGNAL">
          <KV
            label="Direction"
            value={tradeSignal.direction}
            valueColor={tradeSignal.direction === 'LONG' ? 'green' : 'red'}
          />
          {patternData?.route && (
            <KV label="Route" value={patternData.route} valueColor="cyan" />
          )}
          {patternData?.conviction && (
            <KV
              label="Conviction"
              value={`${patternData.conviction} (${patternData.upProbability ?? patternData.downProbability ?? '?'}%)`}
              valueColor="yellow"
            />
          )}
          <KV label="Entry" value={formatCurrency(tradeSignal.entryPrice)} />
          <KV label="Stop Loss" value={formatCurrency(tradeSignal.slPrice)} valueColor="red" />
          <KV label="Take Profit" value={formatCurrency(tradeSignal.tpPrice)} valueColor="green" />
          <KV label="Leverage" value={`${tradeSignal.leverage}x`} valueColor="yellow" />
          <KV label="Dollar Risk" value={formatCurrency(tradeSignal.dollarRisk)} />
        </Section>
      ) : (
        <Section title="─ TRADE SIGNAL">
          <Text color="gray">No signal this candle</Text>
        </Section>
      )}
    </Box>
  );
}

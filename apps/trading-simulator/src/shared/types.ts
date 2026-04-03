import type { ExecutedTrade } from '../engine/types.js';

// ── Logged trade (ExecutedTrade + strategy identity) ──────────────────────────

/**
 * An executed trade annotated with the strategy that produced it.
 * Used by InMemoryTradeLog to support multi-strategy audit trails.
 */
export interface LoggedTrade extends ExecutedTrade {
  strategyName: string;
  strategyVersion: string;
}

// ── Equity curve point ────────────────────────────────────────────────────────

export interface EquityPoint {
  timestamp: Date;
  balance: number;
}

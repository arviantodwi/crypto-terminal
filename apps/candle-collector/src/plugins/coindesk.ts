import fp from 'fastify-plugin';
import type { FastifyInstance } from 'fastify';
import { config } from '../config.js';

interface CoindeskRecord {
  TIMESTAMP: number;
  OPEN: number;
  HIGH: number;
  LOW: number;
  CLOSE: number;
  VOLUME: number;
  QUOTE_VOLUME: number;
  TOTAL_TRADES: number;
}

interface CoindeskResponse {
  Data?: CoindeskRecord[];
  Err?: Record<string, unknown>;
}

interface AppError extends Error {
  statusCode?: number;
  details?: unknown;
}

declare module 'fastify' {
  interface FastifyInstance {
    coindesk: {
      fetchPage: (options: { instrument: string; toTs: number; aggregate: number }) => Promise<CoindeskRecord[]>;
    };
  }
}

async function coindeskPlugin(fastify: FastifyInstance): Promise<void> {
  const { baseUrl, apiKey } = config.coindesk;

  async function fetchPage({
    instrument,
    toTs,
    aggregate,
  }: {
    instrument: string;
    toTs: number;
    aggregate: number;
  }): Promise<CoindeskRecord[]> {
    const url = new URL('/spot/v1/historical/minutes', baseUrl);
    url.searchParams.set('market', 'binance');
    url.searchParams.set('instrument', instrument);
    url.searchParams.set('groups', 'OHLC,Trade,Volume');
    url.searchParams.set('limit', '1000');
    url.searchParams.set('fill', 'true');
    url.searchParams.set('apply_mapping', 'true');
    url.searchParams.set('aggregate', String(aggregate));
    url.searchParams.set('to_ts', String(toTs));

    const response = await fetch(url.toString(), {
      headers: {
        Authorization: `Bearer ${apiKey}`,
      },
    });

    if (response.status !== 200) {
      const body = await response.text().catch(() => '');
      const error: AppError = new Error(`CoinDesk returned HTTP ${response.status}`);
      error.statusCode = 502;
      error.details = { httpStatus: response.status, body };
      throw error;
    }

    const json: CoindeskResponse = await response.json();

    if (json.Err && Object.keys(json.Err).length > 0) {
      const error: AppError = new Error('CoinDesk returned a structured error');
      error.statusCode = 502;
      error.details = { coinDeskError: json.Err };
      throw error;
    }

    return json.Data ?? [];
  }

  fastify.decorate('coindesk', { fetchPage });
}

export default fp(coindeskPlugin, { name: 'coindesk' });

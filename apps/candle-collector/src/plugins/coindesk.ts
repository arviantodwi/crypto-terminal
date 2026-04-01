import fp from 'fastify-plugin';
import type { FastifyInstance } from 'fastify';
import { config } from '../config';
import type { CoindeskRecord } from '../routes/ohlc/shared';

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
      fetchPage: (options: {
        instrument: string;
        toTs: number;
        aggregate: number;
      }) => Promise<{ data: CoindeskRecord[]; ratelimitRemaining: number | null }>;
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
  }): Promise<{ data: CoindeskRecord[]; ratelimitRemaining: number | null }> {
    const url = new URL('/futures/v1/historical/minutes', baseUrl);
    url.searchParams.set('market', 'binance');
    url.searchParams.set('instrument', instrument);
    url.searchParams.set('groups', 'OHLC,Trade,Volume');
    url.searchParams.set('limit', String(Math.floor(2000 / aggregate)));
    url.searchParams.set('fill', 'true');
    url.searchParams.set('apply_mapping', 'true');
    url.searchParams.set('aggregate', String(aggregate));
    url.searchParams.set('to_ts', String(toTs));

    const response = await fetch(url.toString(), {
      headers: {
        Authorization: `Bearer ${apiKey}`,
      },
    });

    const ratelimitRemainingHeader = response.headers.get('X-Ratelimit-Remaining');
    const ratelimitRemaining = ratelimitRemainingHeader !== null ? Number(ratelimitRemainingHeader) : null;

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

    return { data: json.Data ?? [], ratelimitRemaining };
  }

  fastify.decorate('coindesk', { fetchPage });
}

export default fp(coindeskPlugin, { name: 'coindesk' });

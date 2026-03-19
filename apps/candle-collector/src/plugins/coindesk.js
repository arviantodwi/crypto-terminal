import fp from 'fastify-plugin';
import { config } from '../config.js';

async function coindeskPlugin(fastify) {
  const { baseUrl, apiKey } = config.coindesk;

  /**
   * Fetch one page of OHLC data from CoinDesk.
   * @param {{ instrument: string, toTs: number }} options
   * @returns {Promise<Array>} Raw Data array from the response
   */
  async function fetchPage({ instrument, toTs }) {
    const url = new URL('/spot/v1/historical/minutes', baseUrl);
    url.searchParams.set('market', 'binance');
    url.searchParams.set('instrument', instrument);
    url.searchParams.set('groups', 'OHLC,VOLUME');
    url.searchParams.set('limit', '1000');
    url.searchParams.set('fill', 'true');
    url.searchParams.set('apply_mapping', 'true');
    url.searchParams.set('aggregate', '5');
    url.searchParams.set('to_ts', String(toTs));

    const response = await fetch(url.toString(), {
      headers: {
        Authorization: `Bearer ${apiKey}`,
      },
    });

    if (response.status !== 200) {
      const body = await response.text().catch(() => '');
      const error = new Error(`CoinDesk returned HTTP ${response.status}`);
      error.statusCode = 502;
      error.details = { httpStatus: response.status, body };
      throw error;
    }

    const json = await response.json();

    if (json.Err && Object.keys(json.Err).length > 0) {
      const error = new Error('CoinDesk returned a structured error');
      error.statusCode = 502;
      error.details = { coinDeskError: json.Err };
      throw error;
    }

    return json.Data ?? [];
  }

  fastify.decorate('coindesk', { fetchPage });
}

export default fp(coindeskPlugin, { name: 'coindesk' });

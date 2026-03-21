const QUOTE_SUFFIXES = ['USDT', 'BUSD', 'BTC', 'ETH', 'BNB'] as const;

/**
 * Strips the quote currency suffix from a Binance instrument string.
 * e.g. SOLUSDT → SOL, ETHBTC → ETH
 */
export function coinFromInstrument(instrument: string): string {
  for (const suffix of QUOTE_SUFFIXES) {
    if (instrument.endsWith(suffix)) {
      return instrument.slice(0, instrument.length - suffix.length);
    }
  }
  return instrument;
}

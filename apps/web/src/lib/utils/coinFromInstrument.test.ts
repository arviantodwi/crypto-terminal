import { describe, expect, it } from 'vitest';
import { coinFromInstrument } from './coinFromInstrument';

describe('coinFromInstrument', () => {
  it('strips USDT suffix', () => {
    expect(coinFromInstrument('SOLUSDT')).toBe('SOL');
    expect(coinFromInstrument('BTCUSDT')).toBe('BTC');
    expect(coinFromInstrument('ETHUSDT')).toBe('ETH');
  });

  it('strips BUSD suffix', () => {
    expect(coinFromInstrument('BNBBUSD')).toBe('BNB');
    expect(coinFromInstrument('ETHBUSD')).toBe('ETH');
    expect(coinFromInstrument('SOLBUSD')).toBe('SOL');
  });

  it('strips BTC suffix', () => {
    expect(coinFromInstrument('ETHBTC')).toBe('ETH');
    expect(coinFromInstrument('SOLBTC')).toBe('SOL');
    expect(coinFromInstrument('BNBBTC')).toBe('BNB');
  });

  it('strips ETH suffix', () => {
    expect(coinFromInstrument('BNBETH')).toBe('BNB');
    expect(coinFromInstrument('SOLETH')).toBe('SOL');
  });

  it('strips BNB suffix', () => {
    expect(coinFromInstrument('ETHBNB')).toBe('ETH');
    expect(coinFromInstrument('SOLBNB')).toBe('SOL');
  });

  it('returns the instrument unchanged when no known suffix matches', () => {
    expect(coinFromInstrument('SOL')).toBe('SOL');
    expect(coinFromInstrument('UNKNOWN')).toBe('UNKNOWN');
    expect(coinFromInstrument('')).toBe('');
  });
});

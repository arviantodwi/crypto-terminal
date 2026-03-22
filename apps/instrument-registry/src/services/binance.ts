export interface BinanceSymbol {
  symbol: string;
  pair: string;
  contractType: string;
  deliveryDate: number;
  status: string;
}

interface BinanceExchangeInfoResponse {
  symbols: BinanceSymbol[];
}

export async function fetchExchangeInfo(baseUrl: string): Promise<BinanceSymbol[]> {
  const url = `${baseUrl}/fapi/v1/exchangeInfo`;
  const response = await fetch(url);

  if (!response.ok) {
    throw new Error(`Binance REST API returned HTTP ${response.status} for ${url}`);
  }

  const data: BinanceExchangeInfoResponse = await response.json();
  return data.symbols;
}

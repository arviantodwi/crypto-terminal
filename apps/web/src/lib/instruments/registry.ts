/**
 * Fetches the active instrument list from `instrument-registry` on startup
 * and maintains an in-memory set of active symbols for ticker filtering.
 *
 * Gracefully degrades to allowing all tickers through if the service is
 * unreachable.
 */

interface Instrument {
  symbol: string;
  pair: string;
  contractType: string;
  deliveryDate: number;
  status: string;
  lastSyncedAt: string;
}

let activeSymbols: Set<string> | null = null;
let initialized = false;

export async function initInstrumentRegistry(): Promise<void> {
  if (initialized) return;
  initialized = true;

  const baseUrl = process.env.INSTRUMENT_REGISTRY_URL;
  if (!baseUrl) {
    console.warn(
      '[instruments] INSTRUMENT_REGISTRY_URL is not set — ticker filter disabled, all tickers allowed through',
    );
    return;
  }

  try {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 5_000);
    let res: Response;
    try {
      res = await fetch(`${baseUrl}/instruments`, { signal: controller.signal });
    } finally {
      clearTimeout(timeout);
    }

    if (!res.ok) {
      throw new Error(`HTTP ${res.status}`);
    }

    const data = (await res.json()) as Instrument[];
    activeSymbols = new Set(data.map((i) => i.symbol.toUpperCase()));
    console.info(
      `[instruments] Loaded ${activeSymbols.size} active instruments from instrument-registry`,
    );
  } catch (err) {
    console.warn(
      '[instruments] Failed to fetch instruments from instrument-registry — ticker filter disabled, all tickers allowed through:',
      err,
    );
    activeSymbols = null;
  }
}

/**
 * Returns true if the given symbol is in the active instrument list.
 * When the registry was unreachable on startup, all symbols are allowed through.
 */
export function isActiveInstrument(symbol: string): boolean {
  if (activeSymbols === null) return true;
  return activeSymbols.has(symbol.toUpperCase());
}

/**
 * Returns a snapshot of the active symbols set, or null if unavailable.
 */
export function getActiveSymbols(): Set<string> | null {
  return activeSymbols;
}

/**
 * Updates the active symbol list with the result of an instrument change event.
 * Called by the instruments stream handler when Redis publishes changes.
 */
export function applyInstrumentChanges(changes: {
  newListings: string[];
  delistings: string[];
}): void {
  if (activeSymbols === null) {
    // Registry was unreachable at startup; initialise from the change event
    activeSymbols = new Set();
  }
  for (const symbol of changes.newListings) {
    activeSymbols.add(symbol.toUpperCase());
  }
  for (const symbol of changes.delistings) {
    activeSymbols.delete(symbol.toUpperCase());
  }
}

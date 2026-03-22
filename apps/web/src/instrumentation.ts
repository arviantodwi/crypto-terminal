/**
 * Next.js instrumentation hook — runs once on server startup (Node.js runtime).
 * Used to fetch the active instrument list from `instrument-registry` so the
 * 24-hour ticker filter is ready before any requests arrive.
 *
 * https://nextjs.org/docs/app/building-your-application/optimizing/instrumentation
 */
export async function register() {
  if (process.env.NEXT_RUNTIME === 'nodejs') {
    const { initInstrumentRegistry } = await import('@/lib/instruments/registry');
    await initInstrumentRegistry();
  }
}

import type { Article, CacheEntry } from '@/lib/news/cache';
import { getCoinCache, setCoinCache } from '@/lib/news/cache';

const POLL_INTERVAL = 60_000;
const FETCH_TIMEOUT = 5_000;

function parseArticle(raw: unknown): Article | null {
  if (!raw || typeof raw !== 'object') return null;
  const r = raw as Record<string, unknown>;
  const link =
    typeof r.link === 'string' ? r.link : typeof r.url === 'string' ? r.url : '';
  if (!link) return null;
  const title = typeof r.title === 'string' ? r.title : '';
  const description = typeof r.description === 'string' ? r.description : '';
  const pubDate =
    typeof r.pubDate === 'string'
      ? r.pubDate
      : typeof r.publishedAt === 'string'
        ? r.publishedAt
        : '';
  const source =
    typeof r.source === 'string'
      ? r.source
      : r.source !== null &&
          typeof r.source === 'object' &&
          typeof (r.source as Record<string, unknown>).name === 'string'
        ? ((r.source as Record<string, unknown>).name as string)
        : '';
  const timeAgo = typeof r.timeAgo === 'string' ? r.timeAgo : '';
  return { description, link, pubDate, source, timeAgo, title };
}

function mapArticles(data: unknown): Article[] {
  if (Array.isArray(data)) {
    return data.map(parseArticle).filter((a): a is Article => a !== null);
  }
  if (data && typeof data === 'object') {
    const d = data as Record<string, unknown>;
    if (Array.isArray(d.data)) {
      return d.data.map(parseArticle).filter((a): a is Article => a !== null);
    }
    if (Array.isArray(d.articles)) {
      return d.articles.map(parseArticle).filter((a): a is Article => a !== null);
    }
  }
  return [];
}

async function fetchWithTimeout(url: string): Promise<Response> {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), FETCH_TIMEOUT);
  try {
    const res = await fetch(url, { signal: controller.signal });
    clearTimeout(timeout);
    return res;
  } catch (err) {
    clearTimeout(timeout);
    throw err;
  }
}

async function fetchCoinNews(coin: string): Promise<Article[] | null> {
  const url = `https://cryptocurrency.cv/api/search?q=${encodeURIComponent(coin)}&limit=20`;
  try {
    const res = await fetchWithTimeout(url);
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    const data: unknown = await res.json();
    return mapArticles(data);
  } catch (err) {
    console.error(
      `[news/coin] Fetch failed for coin=${coin} at ${new Date().toISOString()}:`,
      err,
    );
    return null;
  }
}

export async function GET(request: Request): Promise<Response> {
  const { searchParams } = new URL(request.url);
  const coin = searchParams.get('coin');

  if (!coin) {
    return new Response(JSON.stringify({ error: 'Missing required query param: coin' }), {
      headers: { 'Content-Type': 'application/json' },
      status: 400,
    });
  }

  const encoder = new TextEncoder();

  const stream = new ReadableStream({
    async start(controller) {
      const enqueue = (entry: CacheEntry) => {
        const payload = JSON.stringify({
          articles: entry.articles,
          fetchedAt: new Date(entry.fetchedAt).toISOString(),
        });
        controller.enqueue(encoder.encode(`data: ${payload}\n\n`));
      };

      const initial = getCoinCache(coin);
      const initialEntry: CacheEntry = initial ?? { articles: [], fetchedAt: Date.now() };
      enqueue(initialEntry);

      let lastLinks = new Set(initialEntry.articles.map(a => a.link));

      const poll = async () => {
        if (request.signal.aborted) return;
        const articles = await fetchCoinNews(coin);
        if (articles === null) return;
        const fetchedAt = Date.now();
        const entry: CacheEntry = { articles, fetchedAt };
        setCoinCache(coin, entry);
        const newLinks = new Set(articles.map(a => a.link));
        const changed =
          articles.some(a => !lastLinks.has(a.link)) ||
          [...lastLinks].some(l => !newLinks.has(l));
        if (changed) {
          lastLinks = newLinks;
          enqueue(entry);
        }
      };

      const interval = setInterval(poll, POLL_INTERVAL);

      request.signal.addEventListener('abort', () => {
        clearInterval(interval);
        controller.close();
      });
    },
  });

  return new Response(stream, {
    headers: {
      'Cache-Control': 'no-cache',
      'Connection': 'keep-alive',
      'Content-Type': 'text/event-stream',
    },
  });
}

import { applyInstrumentChanges } from '@/lib/instruments/registry';
import { INSTRUMENTS_CHANNEL, createRedisSubscriber } from '@/lib/redis';

export async function GET(request: Request): Promise<Response> {
  const encoder = new TextEncoder();

  const stream = new ReadableStream({
    async start(controller) {
      const redis = createRedisSubscriber();

      redis.on('error', (err) => {
        console.error('[instruments/stream] Redis error:', err);
      });

      try {
        await redis.connect();
      } catch (err) {
        console.error('[instruments/stream] Failed to connect to Redis:', err);
        controller.close();
        return;
      }

      redis.on('message', (_channel: string, message: string) => {
        try {
          const event = JSON.parse(message) as {
            type: string;
            newListings?: string[];
            delistings?: string[];
          };

          if (event.type === 'instruments_changed') {
            applyInstrumentChanges({
              newListings: event.newListings ?? [],
              delistings: event.delistings ?? [],
            });
          }

          controller.enqueue(encoder.encode(`data: ${message}\n\n`));
        } catch (err) {
          console.error('[instruments/stream] Failed to parse Redis message:', err);
        }
      });

      await redis.subscribe(INSTRUMENTS_CHANNEL);

      request.signal.addEventListener('abort', async () => {
        await redis.unsubscribe(INSTRUMENTS_CHANNEL);
        redis.disconnect();
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

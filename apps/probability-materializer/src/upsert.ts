import { sql } from 'drizzle-orm';
import type { Db } from './db/client.js';
import { patternProbabilities } from './db/schema.js';
import type { ComputedRow } from './compute.js';

export async function upsertProbabilities(db: Db, rows: ComputedRow[]): Promise<number> {
  if (rows.length === 0) return 0;

  const now = new Date();
  const values = rows.map((row) => ({ ...row, computed_at: now }));

  await db
    .insert(patternProbabilities)
    .values(values)
    .onConflictDoUpdate({
      target: [
        patternProbabilities.instrument,
        patternProbabilities.timeframe,
        patternProbabilities.c1_label,
        patternProbabilities.c2_label,
        patternProbabilities.c3_label,
      ],
      set: {
        occurrences: sql`excluded.occurrences`,
        up_count: sql`excluded.up_count`,
        down_count: sql`excluded.down_count`,
        up_probability: sql`excluded.up_probability`,
        down_probability: sql`excluded.down_probability`,
        computed_at: sql`excluded.computed_at`,
      },
    });

  return rows.length;
}

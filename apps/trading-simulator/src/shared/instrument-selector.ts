import readline from 'node:readline';

/**
 * Displays an interactive numbered list of instruments and prompts the user
 * to select one or more. Returns the selected instrument symbols.
 *
 * @param instruments - Available instrument symbols fetched from the DB.
 * @param label       - Context label shown in the prompt header (e.g. "[tui]").
 * @throws Error if no instruments are available, or if the user's input is invalid.
 */
export async function promptInstrumentSelection(
  instruments: string[],
  label = '[sim]',
): Promise<string[]> {
  if (instruments.length === 0) {
    throw new Error('No instruments found in the database. Make sure candle data has been collected.');
  }

  process.stdout.write(`\n${label} Available instruments:\n`);
  for (let i = 0; i < instruments.length; i++) {
    process.stdout.write(`  [${i + 1}] ${instruments[i]}\n`);
  }
  process.stdout.write('\n');

  const answer = await question(
    `${label} Enter instrument numbers (comma-separated) or "all": `,
  );

  const trimmed = answer.trim().toLowerCase();

  if (trimmed === 'all') {
    process.stdout.write('\n');
    return [...instruments];
  }

  const parsed = trimmed
    .split(',')
    .map((s) => s.trim())
    .filter((s) => s !== '');

  if (parsed.length === 0) {
    throw new Error('No instruments selected. You must select at least one instrument to run the simulation.');
  }

  const selected: string[] = [];
  for (const token of parsed) {
    const idx = Number(token) - 1;
    if (!Number.isInteger(idx) || idx < 0 || idx >= instruments.length) {
      throw new Error(
        `Invalid selection: "${token}". Enter numbers between 1 and ${instruments.length}, or "all".`,
      );
    }
    const instrument = instruments[idx]!;
    if (!selected.includes(instrument)) {
      selected.push(instrument);
    }
  }

  process.stdout.write('\n');
  return selected;
}

// ── Internal helpers ──────────────────────────────────────────────────────────

function question(prompt: string): Promise<string> {
  return new Promise((resolve) => {
    const rl = readline.createInterface({ input: process.stdin, output: process.stdout });
    rl.question(prompt, (answer) => {
      rl.close();
      resolve(answer);
    });
  });
}

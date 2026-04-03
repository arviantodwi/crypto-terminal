import { useInput } from 'ink';
import type { BacktestStatus } from '../types.js';

interface UseKeyboardOptions {
  status: BacktestStatus;
  onStart: () => void;
  onPause: () => void;
  onResume: () => void;
  onRestart: () => void;
  onSave: () => void;
  onQuit: () => void;
  onSpeedUp: () => void;
  onSpeedDown: () => void;
}

/**
 * Binds keyboard controls to backtest actions.
 *
 * Keys:
 *   SPACE   – Start (IDLE) / Pause (RUNNING) / Resume (PAUSED)
 *   R       – Restart
 *   S       – Save results
 *   Q       – Quit
 *   ↑       – Increase speed
 *   ↓       – Decrease speed
 */
export function useKeyboard({
  status,
  onStart,
  onPause,
  onResume,
  onRestart,
  onSave,
  onQuit,
  onSpeedUp,
  onSpeedDown,
}: UseKeyboardOptions): void {
  useInput((input, key) => {
    if (input === ' ') {
      if (status === 'IDLE') onStart();
      else if (status === 'RUNNING') onPause();
      else if (status === 'PAUSED') onResume();
      return;
    }

    if (input === 'r' || input === 'R') {
      onRestart();
      return;
    }

    if (input === 's' || input === 'S') {
      onSave();
      return;
    }

    if (input === 'q' || input === 'Q') {
      onQuit();
      return;
    }

    if (key.upArrow) {
      onSpeedUp();
      return;
    }

    if (key.downArrow) {
      onSpeedDown();
    }
  });
}

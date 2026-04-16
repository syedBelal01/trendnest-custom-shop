import { useEffect, useState } from 'react';

/**
 * Prevents loading UI flicker by only turning `true` after a delay.
 * - When `flag` becomes true: returns true only after `delayMs`.
 * - When `flag` becomes false: returns false immediately.
 */
export function useDelayedFlag(flag: boolean, delayMs = 250) {
  const [on, setOn] = useState(false);

  useEffect(() => {
    if (!flag) {
      setOn(false);
      return;
    }
    const t = window.setTimeout(() => setOn(true), Math.max(0, delayMs));
    return () => window.clearTimeout(t);
  }, [flag, delayMs]);

  return on;
}


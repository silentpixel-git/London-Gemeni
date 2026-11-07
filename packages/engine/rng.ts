/** The engine draws randomness only through this, and every draw is recorded in an Event. */
export interface Rng { next(): number }

/** mulberry32: small, fast, good enough for choosing among a handful of Rules. */
export function seededRng(seed: number): Rng {
  let a = seed >>> 0;
  return {
    next() {
      a = (a + 0x6D2B79F5) >>> 0;
      let t = a;
      t = Math.imul(t ^ (t >>> 15), t | 1);
      t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
      return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    },
  };
}

/** Derives the per-turn generator from the Investigation seed, so replay needs no stored RNG state. */
export function turnRng(seed: number, turn: number): Rng {
  return seededRng((seed ^ Math.imul(turn + 1, 0x9E3779B9)) >>> 0);
}

/** A generator that returns fixed values in order; the prover uses it to branch over every choice. */
export function fixedRng(values: number[]): Rng {
  let i = 0;
  return { next: () => values[Math.min(i++, values.length - 1)] ?? 0 };
}

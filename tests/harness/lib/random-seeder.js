// @ts-check

/**
 * Mulberry32 – a simple, fast, seedable 32-bit PRNG.
 * Returns a function that produces a float in [0, 1) on each call.
 *
 * @param {number} seed
 * @returns {() => number}
 */
export function createSeededRandom(seed) {
  let state = seed | 0

  return function next() {
    state = (state + 0x6d2b79f5) | 0
    let t = Math.imul(state ^ (state >>> 15), 1 | state)
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296
  }
}

/**
 * Fisher-Yates shuffle using a seeded RNG. Returns a new array.
 *
 * @template T
 * @param {T[]} array
 * @param {() => number} rng - A function returning floats in [0, 1)
 * @returns {T[]}
 */
export function seededShuffle(array, rng) {
  const copy = [...array]
  for (let i = copy.length - 1; i > 0; i--) {
    const j = Math.floor(rng() * (i + 1))
    ;[copy[i], copy[j]] = [copy[j], copy[i]]
  }
  return copy
}

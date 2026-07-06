// Small deterministic RNG (mulberry32) so exam #N is always assembled the
// same way, and 50 exams can be generated reproducibly from seeds 1..50.

export function mulberry32(seed) {
  let a = seed >>> 0
  return function () {
    a |= 0; a = (a + 0x6D2B79F5) | 0
    let t = Math.imul(a ^ (a >>> 15), 1 | a)
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296
  }
}

export function makeRng(seed) {
  const rand = mulberry32(seed)
  return {
    random: rand,
    /** integer in [0, n) */
    int: (n) => Math.floor(rand() * n),
    /** random element */
    pick: (arr) => arr[Math.floor(rand() * arr.length)],
    /** n distinct elements (n <= arr.length) */
    sample(arr, n) {
      const copy = arr.slice()
      const out = []
      while (out.length < n && copy.length) {
        out.push(copy.splice(Math.floor(rand() * copy.length), 1)[0])
      }
      return out
    },
    /** Fisher-Yates shuffle (returns new array) */
    shuffle(arr) {
      const a = arr.slice()
      for (let i = a.length - 1; i > 0; i--) {
        const j = Math.floor(rand() * (i + 1))
        ;[a[i], a[j]] = [a[j], a[i]]
      }
      return a
    },
    chance: (p) => rand() < p,
  }
}

/** Non-deterministic rng for practice drills */
export function randomRng() {
  return makeRng((Date.now() ^ (Math.random() * 0xffffffff)) >>> 0)
}

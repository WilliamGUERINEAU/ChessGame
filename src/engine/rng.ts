/**
 * Générateur pseudo-aléatoire déterministe (mulberry32).
 *
 * Tout le hasard du moteur (génération de niveaux, récompenses, IA) passe par
 * ce générateur : un même seed rejoue exactement le même run.
 */
export interface Rng {
  /** Flottant dans [0, 1). */
  next(): number
  /** Entier dans [min, max] (bornes incluses). */
  int(min: number, max: number): number
  /** Élément aléatoire d'une liste non vide. */
  pick<T>(items: readonly T[]): T
  /** Copie mélangée (Fisher-Yates), la liste d'origine n'est pas modifiée. */
  shuffle<T>(items: readonly T[]): T[]
  /** État interne, pour sauvegarder puis reprendre un run. */
  readonly state: number
}

export function createRng(seed: number): Rng {
  let s = seed >>> 0

  const next = (): number => {
    s = (s + 0x6d2b79f5) >>> 0
    let t = s
    t = Math.imul(t ^ (t >>> 15), t | 1)
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61)
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296
  }

  const int = (min: number, max: number): number => {
    if (!Number.isInteger(min) || !Number.isInteger(max) || max < min) {
      throw new RangeError(`Bornes invalides : [${min}, ${max}]`)
    }
    return min + Math.floor(next() * (max - min + 1))
  }

  return {
    next,
    int,
    pick<T>(items: readonly T[]): T {
      if (items.length === 0) throw new RangeError('Liste vide')
      return items[int(0, items.length - 1)]
    },
    shuffle<T>(items: readonly T[]): T[] {
      const out = [...items]
      for (let i = out.length - 1; i > 0; i--) {
        const j = int(0, i)
        ;[out[i], out[j]] = [out[j], out[i]]
      }
      return out
    },
    get state() {
      return s
    },
  }
}

/** Convertit un seed texte (ex. « graine du jour ») en entier 32 bits (FNV-1a). */
export function seedFromString(text: string): number {
  let h = 0x811c9dc5
  for (let i = 0; i < text.length; i++) {
    h ^= text.charCodeAt(i)
    h = Math.imul(h, 0x01000193)
  }
  return h >>> 0
}

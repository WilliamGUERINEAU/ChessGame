import { describe, expect, it } from 'vitest'
import { createRng, seedFromString } from './rng'

describe('createRng', () => {
  it('est déterministe pour un même seed', () => {
    const a = createRng(42)
    const b = createRng(42)
    const seqA = Array.from({ length: 20 }, () => a.next())
    const seqB = Array.from({ length: 20 }, () => b.next())
    expect(seqA).toEqual(seqB)
  })

  it('produit des suites différentes pour des seeds différents', () => {
    const a = createRng(1)
    const b = createRng(2)
    expect(a.next()).not.toBe(b.next())
  })

  it('reprend exactement depuis un état sauvegardé', () => {
    const a = createRng(7)
    a.next()
    a.next()
    const resumed = createRng(a.state)
    expect(resumed.next()).toBe(a.next())
  })

  it('int reste dans les bornes et les atteint', () => {
    const rng = createRng(123)
    const seen = new Set<number>()
    for (let i = 0; i < 1000; i++) {
      const v = rng.int(1, 6)
      expect(v).toBeGreaterThanOrEqual(1)
      expect(v).toBeLessThanOrEqual(6)
      seen.add(v)
    }
    expect(seen.size).toBe(6)
  })

  it('int refuse des bornes invalides', () => {
    expect(() => createRng(1).int(5, 2)).toThrow(RangeError)
  })

  it('shuffle conserve les éléments sans modifier la liste source', () => {
    const src = [1, 2, 3, 4, 5]
    const out = createRng(9).shuffle(src)
    expect(src).toEqual([1, 2, 3, 4, 5])
    expect([...out].sort()).toEqual(src)
  })

  it('pick refuse une liste vide', () => {
    expect(() => createRng(1).pick([])).toThrow(RangeError)
  })
})

describe('seedFromString', () => {
  it('est stable et sensible au texte', () => {
    expect(seedFromString('2026-11-26')).toBe(seedFromString('2026-11-26'))
    expect(seedFromString('2026-11-26')).not.toBe(seedFromString('2026-11-27'))
  })
})

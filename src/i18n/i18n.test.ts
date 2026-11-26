import { describe, expect, it } from 'vitest'
import en from './locales/en.json'
import fr from './locales/fr.json'

/** Liste les clés « a.b.c » d'un objet de traduction. */
function keys(obj: Record<string, unknown>, prefix = ''): string[] {
  return Object.entries(obj).flatMap(([k, v]) =>
    v !== null && typeof v === 'object'
      ? keys(v as Record<string, unknown>, `${prefix}${k}.`)
      : [`${prefix}${k}`],
  )
}

describe('traductions', () => {
  it('FR et EN ont exactement les mêmes clés', () => {
    expect(keys(en).sort()).toEqual(keys(fr).sort())
  })
})

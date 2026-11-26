import type { TFunction } from 'i18next'
import { powerCount, type PowerId } from '../engine'

/** Noms des pouvoirs, regroupés : « Vigueur ×2, Bouclier ». */
export function powerNames(powers: readonly PowerId[], t: TFunction): string[] {
  return [...new Set(powers)].map((power) => {
    const count = powerCount(powers, power)
    const name = t(`powers.${power}.name`)
    return count > 1 ? `${name} ×${count}` : name
  })
}

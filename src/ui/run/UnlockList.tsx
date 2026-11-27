import { useTranslation } from 'react-i18next'
import type { Unlock } from '../../run/profile'

/** Liste de déblocages, avec ce qu'ils apportent. */
export function UnlockList({ unlocks }: { unlocks: readonly Unlock[] }) {
  const { t } = useTranslation()
  return (
    <ul className="unlock-list">
      {unlocks.map((unlock) => (
        <li key={unlock.id}>
          {unlock.kind === 'class'
            ? t('unlock.class', { name: t(`classes.${unlock.classId}.name`) })
            : t('unlock.powers', { names: unlock.powers.map((power) => t(`powers.${power}.name`)).join(', ') })}
        </li>
      ))}
    </ul>
  )
}

import { useEffect, useId, useRef, type ReactNode } from 'react'

export interface DialogAction {
  readonly label: string
  readonly onClick: () => void
  readonly variant?: 'primary' | 'secondary' | 'danger'
}

export interface DialogProps {
  readonly title: string
  /** Couleur du titre : victoire, défaite ou neutre. */
  readonly tone?: 'won' | 'lost' | 'neutral'
  readonly children?: ReactNode
  readonly actions: readonly DialogAction[]
  /** Fermeture par Échap (absent : le dialogue ne se ferme que par ses boutons). */
  readonly onDismiss?: () => void
}

/** Fenêtre modale : en bas de l'écran sur mobile, au centre sur grand écran. */
export function Dialog({ title, tone = 'neutral', children, actions, onDismiss }: DialogProps) {
  const titleId = useId()
  const bodyId = useId()
  const firstButton = useRef<HTMLButtonElement>(null)

  useEffect(() => {
    firstButton.current?.focus()
  }, [])

  return (
    <div
      className="dialog-backdrop"
      onKeyDown={(event) => {
        if (event.key === 'Escape' && onDismiss) onDismiss()
      }}
    >
      <div className="dialog" role="dialog" aria-modal="true" aria-labelledby={titleId} aria-describedby={bodyId}>
        <h2 id={titleId} className={`dialog-title dialog-title--${tone}`}>
          {title}
        </h2>
        <div id={bodyId}>{children}</div>
        <div className="dialog-actions">
          {actions.map((action, index) => (
            <button
              key={action.label}
              ref={index === 0 ? firstButton : undefined}
              type="button"
              className={`button-${action.variant ?? 'secondary'}`}
              onClick={action.onClick}
            >
              {action.label}
            </button>
          ))}
        </div>
      </div>
    </div>
  )
}

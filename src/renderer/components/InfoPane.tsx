import type { SpriteImage } from '@shared/types'
import styles from './InfoPane.module.css'

interface Props {
  /** Active sprite's absolute path, or null when nothing/unresolved is selected. */
  path: string | null
  /** true when a selection exists but has no backing file (unresolved region). */
  unresolved: boolean
  image: SpriteImage | null
  onOpenEditor: () => void
  onReplace: () => void
}

const baseName = (p: string): string => p.split(/[\\/]/).pop() ?? p

export function InfoPane({ path, unresolved, image, onOpenEditor, onReplace }: Props): JSX.Element {
  if (!path) {
    return (
      <div className={styles.pane}>
        <p className={styles.empty}>{unresolved ? 'Selected item has no sprite file' : 'No sprite selected'}</p>
      </div>
    )
  }

  return (
    <div className={styles.pane}>
      <h2 className={styles.name} title={path}>
        {baseName(path)}
      </h2>
      <dl className={styles.props}>
        <dt>Dimensions</dt>
        <dd>{image ? `${image.width} × ${image.height} px` : '—'}</dd>
      </dl>

      <div className={styles.actions}>
        <button className={styles.action} onClick={onOpenEditor}>
          Open in editor
        </button>
        <button className={styles.action} onClick={onReplace}>
          Replace…
        </button>
      </div>
    </div>
  )
}

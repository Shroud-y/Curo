import type { SpriteImage, SpriteNode } from '@shared/types'
import styles from './InfoPane.module.css'

interface Props {
  sprite: SpriteNode | null
  image: SpriteImage | null
}

export function InfoPane({ sprite, image }: Props): JSX.Element {
  if (!sprite) {
    return (
      <div className={styles.pane}>
        <p className={styles.empty}>No sprite selected</p>
      </div>
    )
  }

  return (
    <div className={styles.pane}>
      <h2 className={styles.name} title={sprite.name}>
        {sprite.name}
      </h2>
      <dl className={styles.props}>
        <dt>Dimensions</dt>
        <dd>{image ? `${image.width} × ${image.height} px` : '—'}</dd>
      </dl>
    </div>
  )
}

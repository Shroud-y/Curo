import type { SpriteImage } from '@shared/types'
import styles from './PreviewPane.module.css'

interface Props {
  image: SpriteImage | null
  zoom: number
  onZoomChange: (zoom: number) => void
}

const ZOOM_LEVELS = [100, 200, 400, 800]

export function PreviewPane({ image, zoom, onZoomChange }: Props): JSX.Element {
  return (
    <div className={styles.pane}>
      <div className={styles.toolbar}>
        <span className={styles.toolbarLabel}>Zoom</span>
        {ZOOM_LEVELS.map((level) => (
          <button
            key={level}
            className={`${styles.zoomBtn} ${zoom === level ? styles.active : ''}`}
            onClick={() => onZoomChange(level)}
          >
            {level}%
          </button>
        ))}
      </div>

      <div className={styles.canvas}>
        {image ? (
          <img
            className={styles.sprite}
            src={image.dataUrl}
            width={image.width * (zoom / 100)}
            height={image.height * (zoom / 100)}
            alt=""
            draggable={false}
          />
        ) : (
          <span className={styles.placeholder}>Select a sprite</span>
        )}
      </div>
    </div>
  )
}

import type { SpriteImage } from '@shared/types'
import { PixelViewport } from './PixelViewport'
import styles from './PreviewPane.module.css'

interface Props {
  image: SpriteImage | null
  /** Changes when a *new* sprite is selected — same on live-reload (keeps view). */
  fitKey: string | null
}

/** Single-sprite preview: the shared pixel viewport wrapping one <img>. */
export function PreviewPane({ image, fitKey }: Props): JSX.Element {
  if (!image) {
    return (
      <div className={styles.empty}>
        <span>Select a sprite</span>
      </div>
    )
  }
  return (
    <PixelViewport width={image.width} height={image.height} fitKey={fitKey}>
      <img
        className={styles.sprite}
        src={image.dataUrl}
        width={image.width}
        height={image.height}
        alt=""
        draggable={false}
      />
    </PixelViewport>
  )
}

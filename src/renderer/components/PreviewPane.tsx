import type { SpriteImage } from '@shared/types'
import { PixelViewport } from './PixelViewport'
import styles from './PreviewPane.module.css'

interface Props {
  image: SpriteImage | null
  /** Changes when a *new* sprite is selected — same on live-reload (keeps view). */
  fitKey: string | null
  /** App-level category tabs, pinned left of the toolbar. */
  leading?: React.ReactNode
}

/** Single-sprite preview: the shared pixel viewport wrapping one <img>. Always
 *  renders the viewport (even with no sprite) so the toolbar/tabs stay visible. */
export function PreviewPane({ image, fitKey, leading }: Props): JSX.Element {
  return (
    <PixelViewport
      width={image?.width ?? 0}
      height={image?.height ?? 0}
      fitKey={fitKey}
      leading={leading}
    >
      {image ? (
        <img
          className={styles.sprite}
          src={image.dataUrl}
          width={image.width}
          height={image.height}
          alt=""
          draggable={false}
        />
      ) : null}
    </PixelViewport>
  )
}

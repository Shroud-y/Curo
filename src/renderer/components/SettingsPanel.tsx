import styles from './SettingsPanel.module.css'

interface Props {
  editorPath: string | undefined
  onChooseEditor: () => void
  onClose: () => void
}

/** Small modal to configure the external editor executable. */
export function SettingsPanel({ editorPath, onChooseEditor, onClose }: Props): JSX.Element {
  return (
    <div className={styles.overlay} onClick={onClose}>
      <div className={styles.modal} onClick={(e) => e.stopPropagation()}>
        <div className={styles.header}>
          <h2 className={styles.title}>Settings</h2>
          <button className={styles.close} onClick={onClose}>
            ✕
          </button>
        </div>

        <label className={styles.label}>External editor</label>
        <p className={styles.path} title={editorPath}>
          {editorPath || 'Not set'}
        </p>
        <button className={styles.choose} onClick={onChooseEditor}>
          Choose editor…
        </button>
        <p className={styles.hint}>
          The editor launches with the sprite&apos;s path as its argument (e.g. Aseprite).
        </p>
      </div>
    </div>
  )
}

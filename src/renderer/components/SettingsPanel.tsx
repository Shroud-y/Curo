import styles from './SettingsPanel.module.css'

interface Props {
  editorPath: string | undefined
  vanillaPath: string | undefined
  onChooseEditor: () => void
  onChooseVanilla: () => void
  onClose: () => void
}

/** Small modal to configure the external editor + vanilla sprites folder. */
export function SettingsPanel({
  editorPath,
  vanillaPath,
  onChooseEditor,
  onChooseVanilla,
  onClose
}: Props): JSX.Element {
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

        <label className={styles.label}>Vanilla sprites folder</label>
        <p className={styles.path} title={vanillaPath}>
          {vanillaPath || 'Not set'}
        </p>
        <button className={styles.choose} onClick={onChooseVanilla}>
          Choose vanilla folder…
        </button>
        <p className={styles.hint}>
          An unpacked Mindustry sprites folder, used as comparison references in Compare mode.
        </p>
      </div>
    </div>
  )
}

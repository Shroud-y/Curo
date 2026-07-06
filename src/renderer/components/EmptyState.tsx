import styles from './EmptyState.module.css'

interface Props {
  onPick: () => void
  /** Optional error to show above the button, e.g. a bad-folder message. */
  error?: string | null
}

export function EmptyState({ onPick, error }: Props): JSX.Element {
  return (
    <div className={styles.wrap}>
      <div className={styles.card}>
        <h1 className={styles.title}>Curo</h1>
        <p className={styles.sub}>Mindustry sprite manager</p>
        {error && <p className={styles.error}>{error}</p>}
        <button className={styles.pickBtn} onClick={onPick}>
          Pick mod folder
        </button>
      </div>
    </div>
  )
}

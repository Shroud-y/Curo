import styles from './EmptyState.module.css'

interface Props {
  onPick: () => void
}

export function EmptyState({ onPick }: Props): JSX.Element {
  return (
    <div className={styles.wrap}>
      <div className={styles.card}>
        <h1 className={styles.title}>Curo</h1>
        <p className={styles.sub}>Mindustry sprite manager</p>
        <button className={styles.pickBtn} onClick={onPick}>
          Pick mod folder
        </button>
      </div>
    </div>
  )
}

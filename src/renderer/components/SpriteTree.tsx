import { useState } from 'react'
import type { SpriteNode } from '@shared/types'
import styles from './SpriteTree.module.css'

interface Props {
  node: SpriteNode
  selectedPath: string | null
  onSelect: (node: SpriteNode) => void
  /** Nesting depth, used only for indentation. Root starts at 0. */
  depth?: number
}

/**
 * Renders one tree node. Folders are collapsible (root open by default);
 * sprites are selectable rows. Recurses for folder children.
 */
export function SpriteTree({ node, selectedPath, onSelect, depth = 0 }: Props): JSX.Element {
  const [open, setOpen] = useState(depth === 0)
  const indent = { paddingLeft: `${6 + depth * 14}px` }

  if (node.type === 'folder') {
    return (
      <div>
        <div
          className={styles.row}
          style={indent}
          onClick={() => setOpen((o) => !o)}
          role="button"
        >
          <span className={styles.chevron}>{open ? '▾' : '▸'}</span>
          <span className={styles.folderIcon}>📁</span>
          <span className={styles.label}>{node.name}</span>
        </div>
        {open &&
          node.children?.map((child) => (
            <SpriteTree
              key={child.path}
              node={child}
              selectedPath={selectedPath}
              onSelect={onSelect}
              depth={depth + 1}
            />
          ))}
      </div>
    )
  }

  const isSelected = node.path === selectedPath
  return (
    <div
      className={`${styles.row} ${styles.sprite} ${isSelected ? styles.selected : ''}`}
      style={indent}
      onClick={() => onSelect(node)}
      role="button"
    >
      <span className={styles.chevron} />
      <span className={styles.spriteIcon}>🖼</span>
      <span className={styles.label}>{node.name}</span>
    </div>
  )
}

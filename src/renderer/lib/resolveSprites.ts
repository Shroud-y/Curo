import type { SpriteNode } from '@shared/types'
import type { UnitEntity } from '@shared/content'

/** A flattened sprite leaf with a forward-slash-normalized path. */
export interface Leaf {
  /** basename without extension, e.g. "decimator-cannon". */
  stem: string
  /** normalized absolute path. */
  path: string
}

/** Per-weapon resolution outcome. */
export interface WeaponResolution {
  region: string
  /** Matched sprite path, or null if unresolved. */
  file: string | null
  /** true when region is "" — no sprite expected. */
  noRegion: boolean
}

/** Full resolution for a unit, including diagnostics for the debug panel. */
export interface UnitResolution {
  /** Directory the resolver scanned, e.g. ".../units/decimator" or "(whole tree)". */
  scanDir: string
  /** How many .png files were visible in the scanned scope. */
  pngCount: number
  /** true when the unit's folder wasn't found and we fell back to the whole tree. */
  usedFallback: boolean
  weapons: WeaponResolution[]
}

/** Leaves inside a unit's own folder `.../units/<id>/` (may be empty). */
function unitFolder(leaves: Leaf[], unitId: string): Leaf[] {
  const tag = `/units/${unitId}/`.toLowerCase()
  return leaves.filter((l) => l.path.toLowerCase().includes(tag))
}

/** The base body sprite `units/<id>/<id>.png`. */
export function resolveBase(leaves: Leaf[], unitId: string): string | null {
  const folder = unitFolder(leaves, unitId)
  return folder.find((l) => l.stem === unitId)?.path ?? null
}

/** The team-cell sprite `units/<id>/<id>-cell.png` (or any `*-cell` in folder). */
export function resolveCell(leaves: Leaf[], unitId: string): string | null {
  const folder = unitFolder(leaves, unitId)
  return (
    folder.find((l) => l.stem === `${unitId}-cell`)?.path ??
    folder.find((l) => l.stem.endsWith('-cell'))?.path ??
    null
  )
}

/** Collect all sprite leaves under a group tree, paths normalized to `/`. */
export function flattenLeaves(groups: SpriteNode[]): Leaf[] {
  const out: Leaf[] = []
  const walk = (n: SpriteNode): void => {
    if (n.type === 'sprite') {
      out.push({ stem: n.name.replace(/\.png$/i, ''), path: n.path.replace(/\\/g, '/') })
    } else n.children?.forEach(walk)
  }
  groups.forEach(walk)
  return out
}

/** Match a key against a scope: exact stem first, then suffix (prefix-tolerant). */
function matchLeaf(scope: Leaf[], key: string): string | null {
  if (!key) return null
  const exact = scope.find((l) => l.stem === key)
  if (exact) return exact.path
  const suffix = scope.find((l) => l.stem.endsWith(key))
  return suffix ? suffix.path : null
}

/**
 * Resolve every weapon of a unit to a sprite file.
 * - Scans the unit's own folder `.../units/<id>/` when present, else the whole
 *   tree (flagged as fallback).
 * - Strips the mod prefix (e.g. "jababarium-") from the region before matching,
 *   then tries stripped-exact, stripped-suffix, and finally the raw region — so
 *   both "jababarium-decimator-cannon" and un-prefixed "scout-gun" resolve.
 * - Empty region = no sprite (noRegion), not a failure.
 */
export function resolveUnit(leaves: Leaf[], unit: UnitEntity, modPrefix: string): UnitResolution {
  const tag = `/units/${unit.id}/`.toLowerCase()
  const inFolder = leaves.filter((l) => l.path.toLowerCase().includes(tag))
  const usedFallback = inFolder.length === 0
  const scope = usedFallback ? leaves : inFolder

  let scanDir = '(whole tree)'
  if (!usedFallback) {
    const p = inFolder[0].path
    const i = p.toLowerCase().indexOf(tag)
    scanDir = p.slice(0, i + tag.length - 1) // include ".../units/<id>", drop trailing slash
  }

  const weapons: WeaponResolution[] = unit.weapons.map((w) => {
    if (!w.region) return { region: w.region, file: null, noRegion: true }
    const stripped =
      modPrefix && w.region.startsWith(modPrefix) ? w.region.slice(modPrefix.length) : w.region
    // Unit folder first (stripped, then raw), then whole tree as a last resort
    // for cross-unit / shared weapon sprites.
    const file =
      matchLeaf(scope, stripped) ??
      matchLeaf(scope, w.region) ??
      (usedFallback ? null : matchLeaf(leaves, stripped) ?? matchLeaf(leaves, w.region))
    return { region: w.region, file, noRegion: false }
  })

  return { scanDir, pngCount: scope.length, usedFallback, weapons }
}

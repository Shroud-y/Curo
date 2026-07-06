import type { DefEntity } from '@shared/content'
import type { Leaf } from './resolveSprites'
import { resolveBlockMain, resolveBlockPart, resolveFoundation } from './resolveSprites'

/** A resolved region-part sprite for a block. */
export interface BlockPartView {
  suffix: string
  file: string | null
  label: string
}

/** A block prepared for the composite renderer + content tree. */
export interface BlockView {
  block: DefEntity
  isTurret: boolean
  size: number
  /** Foundation file from turretBase/ (turrets only), or null. */
  foundation: string | null
  /** Display label for the foundation, e.g. "block-5" or "abbys-base". */
  foundationLabel: string
  /** Main `<id>.png` sprite, or null (pure code-drawn block). */
  main: string | null
  parts: BlockPartView[]
  /** Unnamed/custom RegionParts with no nameable sprite (procedural draw). */
  codeDrawn: string[]
}

/** A single isolated block component picked from the tree (Component mode). */
export interface BlockComponentSel {
  kind: 'foundation' | 'base' | 'part'
  file: string | null
  label: string
}

const stemOf = (path: string): string =>
  path.replace(/\\/g, '/').split('/').pop()?.replace(/\.png$/i, '') ?? path

/** Build render-ready views for every block, resolving foundation/main/parts. */
export function buildBlockViews(blocks: DefEntity[], leaves: Leaf[]): BlockView[] {
  return blocks.map((block) => {
    const foundation = block.isTurret ? resolveFoundation(leaves, block.id, block.size) : null

    const parts: BlockPartView[] = []
    const codeDrawn: string[] = []
    block.regionParts.forEach((rp, i) => {
      if (rp.suffix === null) {
        codeDrawn.push(`custom part ${i + 1}`)
        return
      }
      parts.push({
        suffix: rp.suffix,
        file: resolveBlockPart(leaves, block.id, rp.suffix),
        label: rp.suffix
      })
    })

    return {
      block,
      isTurret: block.isTurret,
      size: block.size,
      foundation,
      foundationLabel: foundation ? stemOf(foundation) : '',
      main: resolveBlockMain(leaves, block.id),
      parts,
      codeDrawn
    }
  })
}

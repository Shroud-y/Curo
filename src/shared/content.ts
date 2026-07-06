/**
 * Structured output of the content-definition parser. A discriminated union
 * (`kind`) so the upcoming composite renderer can switch on the entity type.
 */

export interface WeaponDef {
  /** Sprite region from WeaponBuilder.create("<region>"); may be "". */
  region: string
  pos: { x: number; y: number }
  mirror: boolean
  rotate: boolean
  top: boolean
}

export interface UnitEntity {
  kind: 'unit'
  /** Java variable name (lhs), e.g. `decimator`. */
  name: string
  /** UnitBuilder.create("<id>"). */
  id: string
  /** true unless `.noCell()` appears in the unit's chain. */
  hasCell: boolean
  weapons: WeaponDef[]
  /** Source file this entity came from (absolute path). */
  file: string
}

/** A draw part inside a block's drawer. `suffix` is null for an unnamed/custom
 *  part (e.g. `new RegionPart()` with no string arg). */
export interface RegionPartRef {
  suffix: string | null
}

/** Non-unit content, sub-categorized by class name. */
export type DefKind = 'block' | 'item' | 'liquid' | 'other'

export interface DefEntity {
  kind: DefKind
  name: string
  /** new <ClassName>("<id>"). */
  id: string
  className: string
  regionParts: RegionPartRef[]
  file: string
}

export type ContentEntity = UnitEntity | DefEntity

export interface ParseResult {
  entities: ContentEntity[]
  /** Absolute paths of the .java files that were scanned. */
  files: string[]
  /** Mod sprite prefix derived from mod.(h)json name, e.g. "jababarium-" (or ""). */
  modPrefix: string
}

import type {
  ContentEntity,
  DefEntity,
  DefKind,
  RegionPartRef,
  UnitEntity,
  WeaponDef
} from '@shared/content'

/**
 * Tolerant regex parser for a Mindustry mod's custom content builders.
 *
 * Strategy: strip comments, then for each unit/block "anchor" match, scope its
 * chain by a brace-depth scan (chains span many lines and nest anonymous
 * classes / Effects / semicolons — naive line matching would break). Anything
 * unrecognized is skipped silently; the parser never throws or invents data.
 */

/**
 * Remove `//` line and block comments while preserving string/char literals
 * (ids and regions live in strings). Everything downstream assumes comments
 * are gone, so brace/semicolon scans can't be fooled by commented-out code.
 */
function stripComments(src: string): string {
  let out = ''
  let i = 0
  let inStr = false
  let inChar = false
  let inLine = false
  let inBlock = false

  while (i < src.length) {
    const c = src[i]
    const n = src[i + 1]

    if (inLine) {
      if (c === '\n') {
        inLine = false
        out += c
      }
      i++
    } else if (inBlock) {
      if (c === '*' && n === '/') {
        inBlock = false
        i += 2
      } else {
        i++
      }
    } else if (inStr) {
      out += c
      if (c === '\\') {
        out += n ?? ''
        i += 2
      } else {
        if (c === '"') inStr = false
        i++
      }
    } else if (inChar) {
      out += c
      if (c === '\\') {
        out += n ?? ''
        i += 2
      } else {
        if (c === "'") inChar = false
        i++
      }
    } else if (c === '/' && n === '/') {
      inLine = true
      i += 2
    } else if (c === '/' && n === '*') {
      inBlock = true
      i += 2
    } else {
      if (c === '"') inStr = true
      else if (c === "'") inChar = true
      out += c
      i++
    }
  }
  return out
}

/**
 * From `start`, return the substring up to the statement-terminating `;` that
 * sits at brace-depth 0 relative to `start`. Semicolons inside nested `{...}`
 * (anonymous classes) and inside string literals are ignored, so the returned
 * slice is exactly one full builder chain (`... .build();`).
 */
function scopeStatement(src: string, start: number): string {
  let depth = 0
  let inStr = false
  let i = start
  for (; i < src.length; i++) {
    const c = src[i]
    if (inStr) {
      if (c === '\\') i++
      else if (c === '"') inStr = false
      continue
    }
    if (c === '"') inStr = true
    else if (c === '{') depth++
    else if (c === '}') depth--
    else if (c === ';' && depth === 0) break
  }
  return src.slice(start, i)
}

/** Parse a `.<name>(true|false)` flag from a chain; returns `def` if absent. */
function boolFlag(chain: string, name: string, def: boolean): boolean {
  const m = new RegExp(`\\.${name}\\(\\s*(true|false)\\s*\\)`).exec(chain)
  return m ? m[1] === 'true' : def
}

// `.pos(x, y)` with optional trailing `f` float suffix; defaults to 0,0.
const POS_RE = /\.pos\(\s*(-?\d*\.?\d+)f?\s*,\s*(-?\d*\.?\d+)f?\s*\)/

// Anchors. Unit vars: `x = UnitBuilder.create("id")`. Block vars:
// `x = new ClassName("id")` (ClassName must start uppercase to skip `new int[]`
// and similar). Weapons: create / createAlwaysFire. Region parts: the three
// draw-part constructors, capturing their suffix string.
const UNIT_RE = /(\w+)\s*=\s*UnitBuilder\.create\(\s*"([^"]*)"/g
const BLOCK_RE = /(\w+)\s*=\s*new\s+([A-Z]\w*)\s*\(\s*"([^"]*)"/g
const WEAPON_RE = /WeaponBuilder\.create(?:AlwaysFire)?\(\s*"([^"]*)"/g
// Draw parts: RegionPart / DrawRegion / DrawGlowRegion. The string arg is
// OPTIONAL — `new RegionPart()` (or with a non-string arg) is an unnamed/custom
// part we still record. Trailing `{ ... }` overrides are naturally ignored.
const REGION_PART_RE = /new\s+(?:RegionPart|DrawRegion|DrawGlowRegion)\s*\(\s*(?:"([^"]*)")?/g

/**
 * Classify a non-unit definition by its constructor class name. Only the
 * explicit non-block content families are split out; everything else (turrets,
 * drawers, distribution, production, …) is a block.
 */
function classifyDef(className: string): DefKind {
  if (/Item$/.test(className)) return 'item'
  if (/Liquid$/.test(className)) return 'liquid'
  if (/OreBlock$/.test(className) || /StatusEffect$/.test(className)) return 'other'
  return 'block'
}

/** Extract all draw parts in a block chain, preserving unnamed/custom ones. */
function parseRegionParts(chain: string): RegionPartRef[] {
  const parts: RegionPartRef[] = []
  REGION_PART_RE.lastIndex = 0
  let r: RegExpExecArray | null
  while ((r = REGION_PART_RE.exec(chain))) {
    parts.push({ suffix: r[1] ?? null })
  }
  return parts
}

/** Extract the weapons within a unit chain. Each weapon owns the props between
 *  its `WeaponBuilder.create` and the next weapon (or the chain end). */
function parseWeapons(chain: string): WeaponDef[] {
  const anchors: Array<{ index: number; region: string }> = []
  WEAPON_RE.lastIndex = 0
  let m: RegExpExecArray | null
  while ((m = WEAPON_RE.exec(chain))) {
    anchors.push({ index: m.index, region: m[1] })
  }

  return anchors.map((a, i) => {
    const end = i + 1 < anchors.length ? anchors[i + 1].index : chain.length
    const seg = chain.slice(a.index, end)
    const pos = POS_RE.exec(seg)
    return {
      region: a.region,
      pos: pos ? { x: parseFloat(pos[1]), y: parseFloat(pos[2]) } : { x: 0, y: 0 },
      mirror: boolFlag(seg, 'mirror', false),
      rotate: boolFlag(seg, 'rotate', false),
      // Mindustry's Weapon.top defaults to true (weapon drawn OVER the body);
      // only an explicit .top(false) puts it under.
      top: boolFlag(seg, 'top', true)
    }
  })
}

/** Parse a single .java file's text into content entities, in source order. */
export function parseContentFile(text: string, file: string): ContentEntity[] {
  const src = stripComments(text)
  const found: Array<{ index: number; entity: ContentEntity }> = []

  UNIT_RE.lastIndex = 0
  let u: RegExpExecArray | null
  while ((u = UNIT_RE.exec(src))) {
    const chain = scopeStatement(src, u.index)
    const entity: UnitEntity = {
      kind: 'unit',
      name: u[1],
      id: u[2],
      hasCell: !/\.noCell\s*\(/.test(chain),
      weapons: parseWeapons(chain),
      file
    }
    found.push({ index: u.index, entity })
  }

  BLOCK_RE.lastIndex = 0
  let b: RegExpExecArray | null
  // End index of the current top-level block's chain. Any `new X(...)` anchor
  // whose index falls before this is nested (a drawer/part) and must NOT become
  // its own entity — its parts are already captured by the enclosing chain.
  let openUntil = -1
  while ((b = BLOCK_RE.exec(src))) {
    if (b.index < openUntil) continue
    // Empty id is also a drawer signature (e.g. `new DrawTurret("")`).
    if (b[3] === '') continue
    const chain = scopeStatement(src, b.index)
    openUntil = b.index + chain.length
    // `size = N` (default 1). \bsize avoids matching hexSize/liquidCapacity etc.
    const sizeMatch = /\bsize\s*=\s*(\d+)/.exec(chain)
    const entity: DefEntity = {
      kind: classifyDef(b[2]),
      name: b[1],
      id: b[3],
      className: b[2],
      regionParts: parseRegionParts(chain),
      size: sizeMatch ? parseInt(sizeMatch[1], 10) : 1,
      // Turret = draws a shared foundation via DrawTurret (or a *Turret class).
      isTurret: /new\s+DrawTurret\b/.test(chain) || /Turret$/.test(b[2]),
      file
    }
    found.push({ index: b.index, entity })
  }

  return found.sort((a, c) => a.index - c.index).map((f) => f.entity)
}

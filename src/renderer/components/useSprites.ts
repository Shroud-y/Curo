import { useEffect, useState } from 'react'

export interface Loaded {
  img: HTMLImageElement
  width: number
  height: number
}

/**
 * Load a set of sprite paths (dataURL + dims) into decoded images. Reloads
 * whenever the file set OR `version` changes — a Replace/live-reload bumps
 * `version`, so an edited file at the same path is refetched, not served stale.
 */
export function useSprites(files: string[], version: number): { imgs: Map<string, Loaded> } {
  const [imgs, setImgs] = useState<Map<string, Loaded>>(new Map())
  const key = files.slice().sort().join('|')

  useEffect(() => {
    let cancelled = false
    void Promise.all(
      files
        .filter(Boolean)
        .map(async (file): Promise<[string, Loaded]> => {
          const s = await window.api.readSprite(file)
          const img = new Image()
          await new Promise<void>((res) => {
            img.onload = () => res()
            img.onerror = () => res()
            img.src = s.dataUrl
          })
          return [file, { img, width: s.width, height: s.height }]
        })
    ).then((entries) => {
      if (!cancelled) setImgs(new Map(entries))
    })
    return () => {
      cancelled = true
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [key, version])

  return { imgs }
}

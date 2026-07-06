/**
 * Single source of truth for IPC channel names.
 * Imported by both main and renderer so the two sides never drift.
 *
 * A plain (non-const) enum is used because `const enum` members cannot be
 * accessed across modules when `isolatedModules` is enabled, which
 * esbuild/Vite require.
 */
export enum IpcChannel {
  PickModFolder = 'sprites:pick-mod-folder',
  ReadSpriteTree = 'sprites:read-tree',
  ReadSprite = 'sprites:read-sprite'
}

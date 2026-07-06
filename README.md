# Curo

Lightweight Electron + Vite + React + TypeScript desktop app for managing and
previewing Mindustry mod sprites.

This step: pick a mod folder, browse its `sprites/` tree, and preview PNGs
crisp (nearest-neighbor) with a checkerboard background and zoom. Compositing,
weapons, editor-spawn, and content parsing come later.

## Run

```bash
npm install
npm run dev        # launch in dev (hot reload)
```

Other scripts:

```bash
npm run typecheck  # tsc, strict, both configs
npm run build      # bundle main + preload + renderer into out/
npm run preview    # run the production build
```

## Usage

1. Launch → **Pick mod folder** → choose a Mindustry mod root (the folder that
   contains a `sprites/` subfolder).
2. Left column: collapsible folder/sprite tree. Click a sprite to select it.
3. Center: preview pane with checkerboard, `100/200/400/800%` zoom, no smoothing.
4. Right: info pane showing the selected sprite's `W × H` in pixels.

## Layout

- `src/main` — Electron main process. `ipc/sprites.ts` handles the folder
  picker, recursive `sprites/` tree read (`.png` only, hidden files ignored),
  and single-sprite read (data URL + PNG IHDR dimensions).
- `src/preload` — context-isolated bridge exposing `window.api`.
- `src/shared` — IPC channel names + shared types, imported by both sides.
- `src/renderer` — React UI (`App.tsx` + small components, CSS modules).

# Curo

Lightweight Electron + Vite + React + TypeScript desktop app for managing and
previewing Mindustry mod sprites. I made this in order to make my mod developing easier, so it's most likely some functions won't work with you architecture, but base functional will work properly. 

## Run

```bash
pnpm install
pnpm run dev        # launch in dev (hot reload)
```

Other scripts:

```bash
pnpm run typecheck  # tsc, strict, both configs
pnpm run build      # bundle main + preload + renderer into out/
pnpm run preview    # run the production build
```

## Layout

- `src/main` — Electron main process. `ipc/sprites.ts` handles the folder
  picker, recursive `sprites/` tree read (`.png` only, hidden files ignored),
  and single-sprite read (data URL + PNG IHDR dimensions).
- `src/preload` — context-isolated bridge exposing `window.api`.
- `src/shared` — IPC channel names + shared types, imported by both sides.
- `src/renderer` — React UI (`App.tsx` + small components, CSS modules).

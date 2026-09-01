# jsx-playground

A runnable demo project for the **JSX-only Vue fork**: the runtime works everywhere and
there is no template compiler — you write components in JSX/TSX.

## Run

```sh
# from the repo root
pnpm --filter jsx-playground dev       # dev server (http://localhost:5173)
pnpm --filter jsx-playground build     # production build into dist/
pnpm --filter jsx-playground preview   # serve the production build
```

No `pnpm install` is needed after adding this package — the workspace deps
(`vue`, `@vue/babel-plugin-jsx`) are already linked.

## How it wires together

- `vite.config.ts` uses `@rolldown/plugin-babel` + the workspace
  `@vue/babel-plugin-jsx` to transform `.tsx` / `.jsx` files, and reuses
  `scripts/aliases.js` so every `@vue/*` import resolves to the TypeScript
  sources inside this repo — you are always running the fork's actual code.
- `vue` resolves to `packages/vue/src/index.ts`, the runtime-only entry.

## What it demonstrates

| Feature | Where |
| --- | --- |
| Reactivity (`ref` / `computed`) | `src/components/Counter.tsx` |
| Events + conditional rendering | `src/App.tsx` |
| `v-show` directive in JSX | `src/App.tsx` |
| Function children (slot replacement) | `src/components/Card.tsx` |
| Typed props + `onXxx` emit convention | `src/components/Greeting.tsx` |
| Keyed list rendering | `src/components/TodoList.tsx` |
| Attrs / props fallthrough | `src/App.tsx` (footer) |

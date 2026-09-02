# vue

**Runtime-only fork.** The template compiler, SFC toolchain (`compiler-sfc`,
`compiler-dom`, `compiler-core`) and everything template-dependent have been
removed — this package is the runtime (`reactivity` + `runtime-core` +
`runtime-dom` + `server-renderer`) only.

## Writing components

There is no `template:` option and no runtime compilation. Use:

- **JSX / TSX** — compiled by `@vue/babel-plugin-jsx`
  (optionally with `@vue/babel-plugin-auto-define-component` for React-style
  function components), see `packages-private/jsx-playground` for a runnable
  demo.
- **render functions** (`h()`, `createVNode`).
- **options / setup components** without a `template` key.

## Package entry points

| Path | Purpose |
| --- | --- |
| `vue` | runtime entry (aliases to `packages/vue/src/index.ts` in dev) |
| `vue/server-renderer` | SSR bridge → `@vue/server-renderer` |
| `vue/jsx-runtime`, `vue/jsx-dev-runtime` | JSX runtime helpers (`jsx`, `jsxs`, `jsxDEV`) |
| `vue/jsx` | JSX type declarations |

## Building

```sh
pnpm build           # rollup build — dist/* artifacts (runtime-only formats)
```

The `dist/` folder is a build output (gitignored); `index.js` / `index.mjs`
are publish-time CJS/ESM bridges that consume it.

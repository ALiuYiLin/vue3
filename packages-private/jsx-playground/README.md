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

- `vite.config.ts` uses `@rolldown/plugin-babel` with two workspace babel
  plugins: `@vue/babel-plugin-jsx` (JSX → `createVNode`) and
  `@vue/babel-plugin-auto-define-component` (React-style function components →
  `defineComponent`). `scripts/aliases.js` makes every `@vue/*` import resolve
  to the TypeScript sources inside this repo — you are always running the
  fork's actual code.
- `vue` resolves to `packages/vue/src/index.ts`, the runtime-only entry.

## What it demonstrates

| Feature | Where |
| --- | --- |
| React-style function components (stateful via auto-define) | every component |
| Reactivity (`ref` / `computed`) | `src/components/Counter.tsx` |
| Events + conditional rendering | `src/App.tsx` |
| `v-show` directive in JSX | `src/App.tsx` |
| Function children (slot replacement) | `src/components/Card.tsx` |
| Typed props + `onXxx` emit convention | `src/components/Greeting.tsx` |
| Keyed list rendering | `src/components/TodoList.tsx` |
| Attrs / props fallthrough | `src/App.tsx` (footer) |

## Auto-define: React semantics on top of the Vue model

`@vue/babel-plugin-auto-define-component` compiles React-style components into
Vue components:

```tsx
function Counter() {
  const count = ref(0)          // ← function body = setup, runs once
  return <span>{count.value}</span>  // ← returned JSX = render, runs per render
}
```

compiles to

```js
export default defineComponent(function Counter() {
  const count = ref(0)
  return () => _createVNode("span", null, count.value)
})
```

- `ref` / `computed` / lifecycle hooks declared in the body survive re-renders.
- A type annotation on the first parameter is compiled into a runtime `props`
  declaration (`function TodoList(props: { items: string[] })` →
  `{ props: { items: { type: Array, required: true } } }`); without an
  annotation, `props.xxx` member accesses are collected into a loose
  declaration.
- `export default function App() {}` and `const App = (props) => <JSX/>` are
  supported too.
- Explicit Vue style (`return () => <JSX/>` inside the component, or manual
  `defineComponent`) is left untouched; returning a render function from the
  component body is a compile error — write `return <JSX/>` directly.

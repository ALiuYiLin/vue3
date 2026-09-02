import { transformSync } from '@babel/core'
import { expect, test } from 'vitest'
import { createApp, nextTick, ref } from 'vue'
import autoDefinePlugin from '../src/index.ts'
import jsxPlugin from '../../babel-plugin-jsx/src/index.ts'

// eslint-disable-next-line @typescript-eslint/no-explicit-any
const tsxParser: any = { plugins: [['typescript', { isTSX: true }], 'jsx'] }
// eslint-disable-next-line @typescript-eslint/no-explicit-any
const babelPlugins: any = [[jsxPlugin], [autoDefinePlugin]]

/**
 * NOTE: this test file itself is transformed with
 * `babel-plugin-auto-define-component` (see vitest.auto-define.config.ts),
 * so every PascalCase function component declared below is compiled into a
 * `defineComponent(...)` — which is exactly what these tests exercise.
 */

test('function component with local refs becomes stateful', async () => {
  function Counter() {
    const count = ref(0)
    return (
      <div class="counter">
        <button onClick={() => count.value++}>+</button>
        <span class="count">{count.value}</span>
      </div>
    )
  }

  const root = document.createElement('div')
  createApp(Counter).mount(root)
  expect(root.querySelector('.count')!.textContent).toBe('0')

  root.querySelector('button')!.dispatchEvent(new MouseEvent('click'))
  await nextTick()
  expect(root.querySelector('.count')!.textContent).toBe('1')

  root.querySelector('button')!.dispatchEvent(new MouseEvent('click'))
  await nextTick()
  expect(root.querySelector('.count')!.textContent).toBe('2')
})

test('arrow component with block body', async () => {
  const Ticker = () => {
    const n = ref(0)
    return <span class="ticker">{n.value}</span>
  }

  const root = document.createElement('div')
  createApp(Ticker).mount(root)
  expect(root.querySelector('.ticker')!.textContent).toBe('0')
})

test('typed props are extracted into a runtime declaration', async () => {
  function Greeting(props: { msg: string; step?: number }) {
    return (
      <div class="greeting">
        <span class="msg">{props.msg}</span>
        <span class="step">{props.step ?? 0}</span>
      </div>
    )
  }
  const Parent = () => <Greeting msg="hi" step={2} />

  const root = document.createElement('div')
  createApp(Parent).mount(root)
  expect(root.querySelector('.msg')!.textContent).toBe('hi')
  expect(root.querySelector('.step')!.textContent).toBe('2')
})

test('untyped props are collected from member accesses', async () => {
  // no type annotation — the plugin falls back to collecting `props.xxx`
  function Badge(props: any) {
    return <span class="badge">{props.label}</span>
  }
  const Parent = () => <Badge label="new" />

  const root = document.createElement('div')
  createApp(Parent).mount(root)
  expect(root.querySelector('.badge')!.textContent).toBe('new')
})

test('undeclared attrs fall through to the root element', async () => {
  function Box(props: { title: string }) {
    return <div class="box">{props.title}</div>
  }
  // spread with `as any` so TS accepts the undeclared attr (which is the
  // whole point of the test)
  const Parent = () => <Box {...({ title: 't', id: 'box-id' } as any)} />

  const root = document.createElement('div')
  createApp(Parent).mount(root)
  const box = root.querySelector('.box')!
  // `id` is not declared → falls through as an attr
  expect(box.getAttribute('id')).toBe('box-id')
  expect(box.textContent).toBe('t')
})

test('export default function component is wrapped', () => {
  const code = `
    export default function App(props) {
      return <div>app</div>
    }
  `
  const { code: out } = transformSync(code, {
    babelrc: false,
    configFile: false,
    filename: 'default-export.tsx',
    parserOpts: tsxParser,
    plugins: babelPlugins,
  })!
  // the import may be aliased (_defineComponent) to avoid collisions
  expect(out).toMatch(/export default \w*defineComponent\(/)
  expect(out).toContain(`from "vue"`)
})

test('manually wrapped defineComponent is left untouched', () => {
  const code = `
    import { defineComponent } from 'vue'
    const App = defineComponent({
      setup() {
        return () => <div>app</div>
      },
    })
    export default App
  `
  const { code: out } = transformSync(code, {
    babelrc: false,
    configFile: false,
    filename: 'manual.tsx',
    parserOpts: tsxParser,
    plugins: babelPlugins,
  })!
  // import + call — no double wrap
  expect(out!.match(/defineComponent/g)!.length).toBe(2)
})

test('setup-returning-render is an illegal form', () => {
  const code = `
    function Bad() {
      return () => <div>bad</div>
    }
  `
  expect(() =>
    transformSync(code, {
      babelrc: false,
      configFile: false,
      filename: 'bad.tsx',
      parserOpts: tsxParser,
      plugins: babelPlugins,
    }),
  ).toThrow(/return <JSX\/>/)
})

test('non-PascalCase functions with JSX are not wrapped', () => {
  const code = `
    function renderRow(item) {
      return <div>{item}</div>
    }
  `
  const { code: out } = transformSync(code, {
    babelrc: false,
    configFile: false,
    filename: 'helper.tsx',
    parserOpts: tsxParser,
    plugins: babelPlugins,
  })!
  expect(out).not.toContain('defineComponent')
})

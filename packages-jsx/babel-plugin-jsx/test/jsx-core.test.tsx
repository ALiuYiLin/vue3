/**
 * JSX 验收基线（refactor baseline）
 *
 * 只覆盖改造后必须存活的核心能力：
 * props / children / 函数 props / emit / 自定义指令 / v-show / 响应式 / 生命周期 /
 * Fragment / keyed diff / 条件渲染 / refs / h() / SSR。
 * 不覆盖将被移除的能力（插槽、v-model、内置组件等）。
 */
import { renderToString } from '@vue/server-renderer'
import {
  computed,
  createApp,
  createSSRApp,
  defineComponent,
  effect,
  h,
  nextTick,
  onBeforeUnmount,
  onMounted,
  onUpdated,
  reactive,
  ref,
  watch,
  withDirectives,
  type Directive,
} from 'vue'
import { describe, expect, test, vi } from 'vitest'

function mount(component: any) {
  const root = document.createElement('div')
  const app = createApp(component)
  app.mount(root)
  return { root, app }
}

describe('mount & render', () => {
  test('mounts and renders JSX elements', () => {
    const { root } = mount(() => <div class="a">hello</div>)
    expect(root.innerHTML).toBe('<div class="a">hello</div>')
  })

  test('mixed text and element children', () => {
    const { root } = mount(() => (
      <div>
        a<span>b</span>c
      </div>
    ))
    expect(root.innerHTML).toBe('<div>a<span>b</span>c</div>')
  })

  test('Fragment multi-root', () => {
    const { root } = mount(() => (
      <>
        <span>a</span>
        <span>b</span>
      </>
    ))
    expect(root.innerHTML).toBe('<span>a</span><span>b</span>')
  })

  test('h() API renders', () => {
    const { root } = mount(() => h('div', { id: 'h' }, 'from h'))
    expect(root.innerHTML).toBe('<div id="h">from h</div>')
  })
})

describe('reactivity', () => {
  test('ref updates DOM', async () => {
    const count = ref(0)
    const { root } = mount(() => <button>{count.value}</button>)
    expect(root.textContent).toBe('0')
    count.value++
    await nextTick()
    expect(root.textContent).toBe('1')
  })

  test('reactive + computed + watch', async () => {
    const state = reactive({ n: 1 })
    const double = computed(() => state.n * 2)
    const spy = vi.fn()
    watch(() => state.n, spy)
    const { root } = mount(() => <div>{double.value}</div>)
    expect(root.textContent).toBe('2')
    state.n = 5
    await nextTick()
    expect(root.textContent).toBe('10')
    // vue 3.5+ watch callback receives an `onCleanup` third argument
    expect(spy).toHaveBeenCalledWith(5, 1, expect.any(Function))
  })

  test('effect tracks ref', () => {
    const src = ref(1)
    let total = 0
    effect(() => {
      total += src.value
    })
    src.value = 2
    expect(total).toBe(3)
  })
})

describe('props & events', () => {
  test('props passing and attrs fallthrough', () => {
    const Child = defineComponent({
      props: { msg: String },
      setup(props) {
        return () => <div class="child">{props.msg}</div>
      },
    })
    const { root } = mount(() => <Child msg="hi" class="outer" />)
    const el = root.firstElementChild!
    expect(el.className).toContain('child')
    expect(el.className).toContain('outer')
    expect(el.textContent).toBe('hi')
  })

  test('component emit with payload', () => {
    const Child = defineComponent({
      emits: ['ok'],
      setup(_, { emit }) {
        return () => <button onClick={() => emit('ok', 42)}>go</button>
      },
    })
    const spy = vi.fn()
    const { root } = mount(() => <Child onOk={spy} />)
    root.querySelector('button')!.click()
    expect(spy).toHaveBeenCalledWith(42)
  })

  test('function props (render-prop pattern)', () => {
    const Panel = defineComponent({
      props: { title: Function },
      setup(props) {
        return () => <div>{props.title!('vue')}</div>
      },
    })
    const { root } = mount(() => <Panel title={(x: string) => <b>{x}</b>} />)
    expect(root.innerHTML).toBe('<div><b>vue</b></div>')
  })

  test('element spread props + event', () => {
    const clicked = ref(0)
    const { root } = mount(() => (
      <button {...{ id: 'btn' }} class="go" onClick={() => clicked.value++}>
        click
      </button>
    ))
    const btn = root.firstElementChild as HTMLElement
    expect(btn.id).toBe('btn')
    expect(btn.className).toBe('go')
    btn.click()
    expect(clicked.value).toBe(1)
  })

  test('innerHTML prop (v-html replacement path)', () => {
    const { root } = mount(() => <div innerHTML="<b>bold</b>" />)
    expect(root.firstElementChild!.innerHTML).toBe('<b>bold</b>')
  })
})

describe('dynamic structure', () => {
  test('conditional rendering via JSX expression', async () => {
    const show = ref(true)
    const { root } = mount(() => (
      <div>{show.value ? <p>yes</p> : <p>no</p>}</div>
    ))
    expect(root.textContent).toBe('yes')
    show.value = false
    await nextTick()
    expect(root.textContent).toBe('no')
  })

  test('keyed list diff (reorder & remove)', async () => {
    const list = ref([1, 2, 3])
    const { root } = mount(() => (
      <div>
        {list.value.map(n => (
          <span key={n}>{n}</span>
        ))}
      </div>
    ))
    expect(root.textContent).toBe('123')
    list.value = [3, 1, 2]
    await nextTick()
    expect(root.textContent).toBe('312')
    list.value = [1, 2]
    await nextTick()
    expect(root.textContent).toBe('12')
  })

  test('v-show toggles display', async () => {
    const show = ref(true)
    const { root } = mount(() => <div v-show={show.value}>text</div>)
    const el = root.firstElementChild as HTMLElement
    expect(el.style.display).not.toBe('none')
    show.value = false
    await nextTick()
    expect(el.style.display).toBe('none')
  })
})

describe('directives', () => {
  test('custom directive via app.directive + v-xxx', () => {
    const spy = vi.fn()
    const dir: Directive = {
      mounted(el, binding) {
        spy(el, binding.value)
      },
    }
    const app = createApp(() => <div v-mydir="val" />)
    app.directive('mydir', dir)
    const root = document.createElement('div')
    app.mount(root)
    expect(spy).toHaveBeenCalledTimes(1)
    expect(spy.mock.calls[0][0]).toBe(root.firstElementChild)
    expect(spy.mock.calls[0][1]).toBe('val')
  })

  test('custom directive via withDirectives API', () => {
    const spy = vi.fn()
    const dir: Directive = {
      mounted: el => spy(el),
    }
    const { root } = mount(() => withDirectives(<div />, [[dir, 1]]))
    expect(spy).toHaveBeenCalledTimes(1)
    expect(spy.mock.calls[0][0]).toBe(root.firstElementChild)
  })
})

describe('lifecycle & refs', () => {
  test('mounted / updated / beforeUnmount hooks and unmount cleanup', async () => {
    const mounted = vi.fn()
    const updated = vi.fn()
    const unmounted = vi.fn()
    const n = ref(0)
    const Comp = defineComponent({
      setup() {
        onMounted(mounted)
        onUpdated(updated)
        onBeforeUnmount(unmounted)
        return () => <div>{n.value}</div>
      },
    })
    const app = createApp(Comp)
    const root = document.createElement('div')
    app.mount(root)
    expect(mounted).toHaveBeenCalledTimes(1)
    n.value++
    await nextTick()
    expect(updated).toHaveBeenCalledTimes(1)
    app.unmount()
    expect(unmounted).toHaveBeenCalledTimes(1)
    expect(root.innerHTML).toBe('')
  })

  test('refs on elements', () => {
    const elRef = ref<HTMLElement | null>(null)
    const { root } = mount(() => <div ref={elRef}>r</div>)
    expect(elRef.value).toBe(root.firstElementChild)
  })
})

describe('SSR', () => {
  test('renderToString a vnode', async () => {
    expect(await renderToString(<div id="a">hello</div>)).toBe(
      '<div id="a">hello</div>',
    )
  })

  test('renderToString an app with JSX component', async () => {
    const app = createSSRApp(() => <div id="b">app</div>)
    expect(await renderToString(app)).toBe('<div id="b">app</div>')
  })
})

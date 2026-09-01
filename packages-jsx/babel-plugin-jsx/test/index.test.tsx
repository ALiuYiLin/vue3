import { describe, expect, test } from 'vitest'
import { type CSSProperties, createApp, defineComponent, nextTick } from 'vue'

type Wrapper = {
  root: HTMLElement
  app: ReturnType<typeof createApp>
  vm: any
  subTree: () => any
  html: () => string
  text: () => string
  get: (selector: string) => Element
  classes: (selector?: string) => string[]
  attributes: (selector?: string) => Record<string, string>
  trigger: (selector: string, event?: string) => Promise<void>
}

// Mount with the fork's own runtime (no @vue/test-utils: it bundles an
// upstream Vue that cannot render our children-in-props vnodes).
const mounted: { app: ReturnType<typeof createApp>; root: HTMLElement }[] = []
function mount(component: any): Wrapper {
  // tear down the previous app so the document never holds duplicate ids
  // (jsdom's id cache breaks querySelector when ids are duplicated)
  for (const m of mounted) {
    m.app.unmount()
    m.root.remove()
  }
  mounted.length = 0
  const root = document.createElement('div')
  document.body.appendChild(root)
  const app = createApp(component)
  app.mount(root)
  mounted.push({ app, root })
  const instance = app._instance!
  return {
    root,
    app,
    vm: instance.proxy!,
    subTree: () => instance.subTree,
    html: () => root.innerHTML,
    text: () => root.textContent!,
    get(selector: string) {
      const el = root.querySelector(selector)
      if (!el)
        throw new Error(
          `no element matching ${selector}; root.innerHTML=${root.innerHTML}`,
        )
      return el
    },
    classes(selector?: string) {
      const el = selector
        ? root.querySelector(selector)!
        : root.firstElementChild!
      return Array.from(el.classList)
    },
    attributes(selector?: string) {
      const el = selector
        ? root.querySelector(selector)!
        : root.firstElementChild!
      const attrs: Record<string, string> = {}
      for (const attr of Array.from(el.attributes)) {
        attrs[attr.name] = attr.value
      }
      return attrs
    },
    async trigger(selector: string, event = 'click') {
      const el = root.querySelector(selector)!
      el.dispatchEvent(new MouseEvent(event, { bubbles: true }))
      await nextTick()
    },
  }
}

describe('Transform JSX', () => {
  test('should render with render function', () => {
    const wrapper = mount({
      render() {
        return <div>123</div>
      },
    })
    expect(wrapper.text()).toBe('123')
  })

  test('should render with setup', () => {
    const wrapper = mount({
      setup() {
        return () => <div>123</div>
      },
    })
    expect(wrapper.text()).toBe('123')
  })

  test('Extracts attrs', () => {
    const wrapper = mount({
      setup() {
        return () => <div id="hi" />
      },
    })
    expect(wrapper.attributes()['id']).toBe('hi')
  })

  test('Binds attrs', () => {
    const id = 'foo'
    const wrapper = mount({
      setup() {
        return () => <div>{id}</div>
      },
    })
    expect(wrapper.text()).toBe('foo')
  })

  test('should not fallthrough with inheritAttrs: false', () => {
    const Child = defineComponent({
      props: {
        foo: Number,
      },
      setup(props) {
        return () => <div class="child">{props.foo}</div>
      },
    })

    Child.inheritAttrs = false

    const wrapper = mount({
      render() {
        return <Child class="parent" foo={1} />
      },
    })
    expect(wrapper.classes()).toStrictEqual(['child'])
    expect(wrapper.text()).toBe('1')
  })

  test('Fragment', () => {
    const Child = () => <div>123</div>

    Child.inheritAttrs = false

    const wrapper = mount({
      setup() {
        return () => (
          <>
            <Child />
            <div>456</div>
          </>
        )
      },
    })

    expect(wrapper.html()).toBe('<div>123</div><div>456</div>')
  })

  test('nested component', () => {
    const A = {
      B: defineComponent({
        setup() {
          return () => <div>123</div>
        },
      }),
    }

    A.B.inheritAttrs = false

    const wrapper = mount(() => <A.B />)

    expect(wrapper.html()).toBe('<div>123</div>')
  })

  test('xlink:href', () => {
    const wrapper = mount({
      setup() {
        return () => <use xlinkHref={'#name'}></use>
      },
    })
    expect(wrapper.attributes()['xlink:href']).toBe('#name')
  })

  test('Merge class', () => {
    const wrapper = mount({
      setup() {
        // @ts-expect-error
        return () => <div class="a" {...{ class: 'b' }} />
      },
    })
    expect(wrapper.classes().toSorted()).toEqual(['a', 'b'].toSorted())
  })

  test('Merge style', () => {
    const propsA = {
      style: {
        color: 'red',
      } satisfies CSSProperties,
    }
    const propsB = {
      style: {
        color: 'blue',
        width: '300px',
        height: '300px',
      } satisfies CSSProperties,
    }
    const wrapper = mount({
      setup() {
        // @ts-ignore
        return () => <div {...propsA} {...propsB} />
      },
    })
    expect(wrapper.html()).toBe(
      '<div style="color: blue; width: 300px; height: 300px;"></div>',
    )
  })

  test('JSXSpreadChild', () => {
    const a = ['1', '2']
    const wrapper = mount({
      setup() {
        return () => <div>{[...a]}</div>
      },
    })
    expect(wrapper.text()).toBe('12')
  })

  test('domProps input[value]', () => {
    const val = 'foo'
    const wrapper = mount({
      setup() {
        return () => <input type="text" value={val} />
      },
    })
    expect(wrapper.html()).toBe('<input type="text" value="foo">')
  })

  test('domProps input[checked]', () => {
    const val = true
    const wrapper = mount({
      setup() {
        return () => <input checked={val} />
      },
    })

    expect(wrapper.subTree()?.props?.checked).toBe(val)
  })

  test('domProps option[selected]', () => {
    const val = true
    const wrapper = mount({
      render() {
        return <option selected={val} />
      },
    })
    expect(wrapper.subTree()?.props?.selected).toBe(val)
  })

  test('domProps video[muted]', () => {
    const val = true
    const wrapper = mount({
      render() {
        return <video muted={val} />
      },
    })

    expect(wrapper.subTree()?.props?.muted).toBe(val)
  })

  test('Spread (single object expression)', () => {
    const props = {
      id: '1',
    }
    const wrapper = mount({
      render() {
        return <div {...props}>123</div>
      },
    })
    expect(wrapper.html()).toBe('<div id="1">123</div>')
  })

  test('Spread (mixed)', async () => {
    const calls: number[] = []
    const data = {
      id: 'hehe',
      onClick() {
        calls.push(3)
      },
      innerHTML: '2',
      class: ['a', 'b'],
    }

    const wrapper = mount({
      setup() {
        return () => (
          <button
            type="button"
            {...data}
            class={{ c: true }}
            onClick={() => calls.push(4)}
          />
        )
      },
    })

    expect(wrapper.attributes('button')['id']).toBe('hehe')
    expect(wrapper.attributes('button')['type']).toBe('button')
    expect(wrapper.text()).toBe('2')
    expect(wrapper.classes('button')).toEqual(
      expect.arrayContaining(['a', 'b', 'c']),
    )

    await wrapper.trigger('button')

    expect(calls).toEqual(expect.arrayContaining([3, 4]))
  })

  test('empty string', () => {
    const wrapper = mount({
      setup() {
        return () => <h1 title=""></h1>
      },
    })
    expect(wrapper.html()).toBe('<h1 title=""></h1>')
  })
})

describe('variables outside slots', () => {
  const A = defineComponent({
    props: {
      inc: Function,
      children: null,
    },
    render() {
      return this.$props.children
    },
  })

  A.inheritAttrs = false

  test('internal', async () => {
    const wrapper = mount(
      defineComponent({
        data() {
          return {
            val: 0,
          }
        },
        methods: {
          inc() {
            this.val += 1
          },
        },
        render() {
          const attrs = {
            innerHTML: String(this.val),
          }
          return (
            <A inc={this.inc}>
              <div>
                <textarea id="textarea" {...attrs} />
              </div>
              <button id="button" onClick={this.inc}>
                +1
              </button>
            </A>
          )
        },
      }),
    )

    expect(wrapper.get('#textarea').innerHTML).toBe('0')
    await wrapper.trigger('#button')
    expect(wrapper.get('#textarea').innerHTML).toBe('1')
  })

  test('forwarded', async () => {
    const wrapper = mount(
      defineComponent({
        data() {
          return {
            val: 0,
          }
        },
        methods: {
          inc() {
            this.val += 1
          },
        },
        render() {
          const attrs = {
            innerHTML: String(this.val),
          }
          const textarea = <textarea id="textarea" {...attrs} />
          return (
            <A inc={this.inc}>
              <div>{textarea}</div>
              <button id="button" onClick={this.inc}>
                +1
              </button>
            </A>
          )
        },
      }),
    )

    expect(wrapper.get('#textarea').innerHTML).toBe('0')
    await wrapper.trigger('#button')
    expect(wrapper.get('#textarea').innerHTML).toBe('1')
  })
})

test('reassign variable as component should work', () => {
  let a: any = 1

  const A = defineComponent({
    setup(props: any) {
      return () => <span>{props.children}</span>
    },
  })

  const _a2 = 2
  a = _a2
  a = <A>{a}</A>

  const wrapper = mount({
    render() {
      return a
    },
  })

  expect(wrapper.html()).toBe('<span>2</span>')
})

describe('should support passing children via JSX', () => {
  const A = defineComponent({
    setup(props: any) {
      return () => <span>{props.children}</span>
    },
  })

  test('single expression, non-literal value', () => {
    const foo = () => 1

    const wrapper = mount({
      render() {
        return <A>{foo()}</A>
      },
    })

    expect(wrapper.html()).toBe('<span>1</span>')
  })

  test('single expression, function expression', () => {
    const wrapper = mount({
      render() {
        return <A>{() => 'foo'}</A>
      },
    })

    expect(wrapper.html()).toBe('<span>foo</span>')
  })

  test('single expression, function expression variable', () => {
    const foo = () => 'foo'

    const wrapper = mount({
      render() {
        return <A>{foo}</A>
      },
    })

    expect(wrapper.html()).toBe('<span>foo</span>')
  })

  test('single expression, array map expression', () => {
    const data = ['A', 'B', 'C']

    const wrapper = mount({
      render() {
        return (
          <>
            {data.map(item => (
              <A>
                <span>{item}</span>
              </A>
            ))}
          </>
        )
      },
    })

    expect(wrapper.html()).toMatchInlineSnapshot(
      `"<span><span>A</span></span><span><span>B</span></span><span><span>C</span></span>"`,
    )
  })

  test('function expression returning vnode', () => {
    const data = ['A', 'B', 'C']

    const wrapper = mount({
      render() {
        return (
          <>
            {data.map(item => (
              <A>{() => <span>{item}</span>}</A>
            ))}
          </>
        )
      },
    })

    expect(wrapper.html()).toMatchInlineSnapshot(
      `"<span><span>A</span></span><span><span>B</span></span><span><span>C</span></span>"`,
    )
  })
})

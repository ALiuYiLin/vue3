/**
 * @vitest-environment jsdom
 */

import {
  type ObjectDirective,
  type VNode,
  createCommentVNode,
  createElementVNode,
  createSSRApp,
  createStaticVNode,
  createTextVNode,
  createVNode,
  defineAsyncComponent,
  defineComponent,
  h,
  nextTick,
  onMounted,
  onServerPrefetch,
  reactive,
  ref,
  renderSlot,
  useCssVars,
  vModelCheckbox,
  vShow,
  withCtx,
  withDirectives,
} from '@vue/runtime-dom'
import type { HMRRuntime } from '../src/hmr'
import { renderToString } from '@vue/server-renderer'
import { normalizeStyle } from '@vue/shared'

declare var __VUE_HMR_RUNTIME__: HMRRuntime
const { reload } = __VUE_HMR_RUNTIME__

function mountWithHydration(html: string, render: () => any) {
  const container = document.createElement('div')
  container.innerHTML = html
  const app = createSSRApp({
    render,
  })
  return {
    vnode: app.mount(container).$.subTree as VNode<Node, Element> & {
      el: Element
    },
    container,
  }
}

const triggerEvent = (type: string, el: Element) => {
  const event = new Event(type)
  el.dispatchEvent(event)
}

describe('SSR hydration', () => {
  beforeEach(() => {
    document.body.innerHTML = ''
  })

  test('text', async () => {
    const msg = ref('foo')
    const { vnode, container } = mountWithHydration('foo', () => msg.value)
    expect(vnode.el).toBe(container.firstChild)
    expect(container.textContent).toBe('foo')
    msg.value = 'bar'
    await nextTick()
    expect(container.textContent).toBe('bar')
  })

  test('empty text', async () => {
    const { container } = mountWithHydration('<div></div>', () =>
      h('div', createTextVNode('')),
    )
    expect(container.textContent).toBe('')
    expect(`Hydration children mismatch in <div>`).not.toHaveBeenWarned()
  })

  test('text w/ newlines', async () => {
    mountWithHydration('<div>1\n2\n3</div>', () => h('div', '1\r\n2\r3'))
    expect(`Hydration text mismatch`).not.toHaveBeenWarned()
  })

  test('comment', () => {
    const { vnode, container } = mountWithHydration('<!---->', () => null)
    expect(vnode.el).toBe(container.firstChild)
    expect(vnode.el.nodeType).toBe(8) // comment
  })

  test('static', () => {
    const html = '<div><span>hello</span></div>'
    const { vnode, container } = mountWithHydration(html, () =>
      createStaticVNode('', 1),
    )
    expect(vnode.el).toBe(container.firstChild)
    expect(vnode.el.outerHTML).toBe(html)
    expect(vnode.anchor).toBe(container.firstChild)
    expect(vnode.children).toBe(html)
  })

  test('static (multiple elements)', () => {
    const staticContent = '<div></div><span>hello</span>'
    const html = `<div><div>hi</div>` + staticContent + `<div>ho</div></div>`

    const n1 = h('div', 'hi')
    const s = createStaticVNode('', 2)
    const n2 = h('div', 'ho')

    const { container } = mountWithHydration(html, () => h('div', [n1, s, n2]))

    const div = container.firstChild!

    expect(n1.el).toBe(div.firstChild)
    expect(n2.el).toBe(div.lastChild)
    expect(s.el).toBe(div.childNodes[1])
    expect(s.anchor).toBe(div.childNodes[2])
    expect(s.children).toBe(staticContent)
  })

  // #6008
  test('static (with text node as starting node)', () => {
    const html = ` A <span>foo</span> B`
    const { vnode, container } = mountWithHydration(html, () =>
      createStaticVNode(` A <span>foo</span> B`, 3),
    )
    expect(vnode.el).toBe(container.firstChild)
    expect(vnode.anchor).toBe(container.lastChild)
    expect(`Hydration node mismatch`).not.toHaveBeenWarned()
  })

  test('static with content adoption', () => {
    const html = ` A <span>foo</span> B`
    const { vnode, container } = mountWithHydration(html, () =>
      createStaticVNode(``, 3),
    )
    expect(vnode.el).toBe(container.firstChild)
    expect(vnode.anchor).toBe(container.lastChild)
    expect(vnode.children).toBe(html)
    expect(`Hydration node mismatch`).not.toHaveBeenWarned()
  })

  test('element with text children', async () => {
    const msg = ref('foo')
    const { vnode, container } = mountWithHydration(
      '<div class="foo">foo</div>',
      () => h('div', { class: msg.value }, msg.value),
    )
    expect(vnode.el).toBe(container.firstChild)
    expect(container.firstChild!.textContent).toBe('foo')
    msg.value = 'bar'
    await nextTick()
    expect(container.innerHTML).toBe(`<div class="bar">bar</div>`)
  })

  // #7285
  test('element with multiple continuous text vnodes', async () => {
    // should no mismatch warning
    const { container } = mountWithHydration('<div>foo0o</div>', () =>
      h('div', ['fo', createTextVNode('o'), 0, 'o']),
    )
    expect(container.textContent).toBe('foo0o')
  })

  test('element with elements children', async () => {
    const msg = ref('foo')
    const fn = vi.fn()
    const { vnode, container } = mountWithHydration(
      '<div><span>foo</span><span class="foo"></span></div>',
      () =>
        h('div', [
          h('span', msg.value),
          h('span', { class: msg.value, onClick: fn }),
        ]),
    )
    expect(vnode.el).toBe(container.firstChild)
    expect((vnode.children as VNode[])[0].el).toBe(
      container.firstChild!.childNodes[0],
    )
    expect((vnode.children as VNode[])[1].el).toBe(
      container.firstChild!.childNodes[1],
    )

    // event handler
    triggerEvent('click', vnode.el.querySelector('.foo')!)
    expect(fn).toHaveBeenCalled()

    msg.value = 'bar'
    await nextTick()
    expect(vnode.el.innerHTML).toBe(`<span>bar</span><span class="bar"></span>`)
  })

  test('element with ref', () => {
    const el = ref()
    const { vnode, container } = mountWithHydration('<div></div>', () =>
      h('div', { ref: el }),
    )
    expect(vnode.el).toBe(container.firstChild)
    expect(el.value).toBe(vnode.el)
  })

  test('Fragment', async () => {
    const msg = ref('foo')
    const fn = vi.fn()
    const { vnode, container } = mountWithHydration(
      '<div><!--[--><span>foo</span><!--[--><span class="foo"></span><!--]--><!--]--></div>',
      () =>
        h('div', [
          [
            h('span', msg.value),
            [h('span', { class: msg.value, onClick: fn })],
          ],
        ]),
    )
    expect(vnode.el).toBe(container.firstChild)

    expect(vnode.el.innerHTML).toBe(
      `<!--[--><span>foo</span><!--[--><span class="foo"></span><!--]--><!--]-->`,
    )

    // start fragment 1
    const fragment1 = (vnode.children as VNode[])[0]
    expect(fragment1.el).toBe(vnode.el.childNodes[0])
    const fragment1Children = fragment1.children as VNode[]

    // first <span>
    expect(fragment1Children[0].el!.tagName).toBe('SPAN')
    expect(fragment1Children[0].el).toBe(vnode.el.childNodes[1])

    // start fragment 2
    const fragment2 = fragment1Children[1]
    expect(fragment2.el).toBe(vnode.el.childNodes[2])
    const fragment2Children = fragment2.children as VNode[]

    // second <span>
    expect(fragment2Children[0].el!.tagName).toBe('SPAN')
    expect(fragment2Children[0].el).toBe(vnode.el.childNodes[3])

    // end fragment 2
    expect(fragment2.anchor).toBe(vnode.el.childNodes[4])

    // end fragment 1
    expect(fragment1.anchor).toBe(vnode.el.childNodes[5])

    // event handler
    triggerEvent('click', vnode.el.querySelector('.foo')!)
    expect(fn).toHaveBeenCalled()

    msg.value = 'bar'
    await nextTick()
    expect(vnode.el.innerHTML).toBe(
      `<!--[--><span>bar</span><!--[--><span class="bar"></span><!--]--><!--]-->`,
    )
  })

  // #7285
  test('Fragment (multiple continuous text vnodes)', async () => {
    // should no mismatch warning
    const { container } = mountWithHydration('<!--[-->fooo<!--]-->', () => [
      'fo',
      createTextVNode('o'),
      'o',
    ])
    expect(container.textContent).toBe('fooo')
  })

  // #6152
  test('with data-allow-mismatch component when using onServerPrefetch', async () => {
    const Comp = {
      template: `
        <div>Comp2</div>
      `,
    }
    let foo: any
    const App = {
      setup() {
        const flag = ref(true)
        foo = () => {
          flag.value = false
        }
        onServerPrefetch(() => (flag.value = false))
        return { flag }
      },
      components: {
        Comp,
      },
      template: `
        <span data-allow-mismatch>
          <Comp v-if="flag"></Comp>
        </span>
      `,
    }
    // hydrate
    const container = document.createElement('div')
    container.innerHTML = await renderToString(h(App))
    createSSRApp(App).mount(container)
    expect(container.innerHTML).toBe(
      '<span data-allow-mismatch=""><div>Comp2</div></span>',
    )
    foo()
    await nextTick()
    expect(container.innerHTML).toBe(
      '<span data-allow-mismatch=""><!--v-if--></span>',
    )
  })

  // compile SSR + client render fn from the same template & hydrate
  test('full compiler integration', async () => {
    const mounted: string[] = []
    const log = vi.fn()
    const toggle = ref(true)

    const Child = {
      data() {
        return {
          count: 0,
          text: 'hello',
          style: {
            color: 'red',
          },
        }
      },
      mounted() {
        mounted.push('child')
      },
      template: `
      <div>
        <span class="count" :style="style">{{ count }}</span>
        <button class="inc" @click="count++">inc</button>
        <button class="change" @click="style.color = 'green'" >change color</button>
        <button class="emit" @click="$emit('foo')">emit</button>
        <span class="text">{{ text }}</span>
        <input v-model="text">
      </div>
      `,
    }

    const App = {
      setup() {
        return { toggle }
      },
      mounted() {
        mounted.push('parent')
      },
      template: `
        <div>
          <span>hello</span>
          <template v-if="toggle">
            <Child @foo="log('child')"/>
            <template v-if="true">
              <button class="parent-click" @click="log('click')">click me</button>
            </template>
          </template>
          <span>hello</span>
        </div>`,
      components: {
        Child,
      },
      methods: {
        log,
      },
    }

    const container = document.createElement('div')
    // server render
    container.innerHTML = await renderToString(h(App))
    // hydrate
    createSSRApp(App).mount(container)

    // assert interactions
    // 1. parent button click
    triggerEvent('click', container.querySelector('.parent-click')!)
    expect(log).toHaveBeenCalledWith('click')

    // 2. child inc click + text interpolation
    const count = container.querySelector('.count') as HTMLElement
    expect(count.textContent).toBe(`0`)
    triggerEvent('click', container.querySelector('.inc')!)
    await nextTick()
    expect(count.textContent).toBe(`1`)

    // 3. child color click + style binding
    expect(count.style.color).toBe('red')
    triggerEvent('click', container.querySelector('.change')!)
    await nextTick()
    expect(count.style.color).toBe('green')

    // 4. child event emit
    triggerEvent('click', container.querySelector('.emit')!)
    expect(log).toHaveBeenCalledWith('child')

    // 5. child v-model
    const text = container.querySelector('.text')!
    const input = container.querySelector('input')!
    expect(text.textContent).toBe('hello')
    input.value = 'bye'
    triggerEvent('input', input)
    await nextTick()
    expect(text.textContent).toBe('bye')
  })

  test('handle click error in ssr mode', async () => {
    const App = {
      setup() {
        const throwError = () => {
          throw new Error('Sentry Error')
        }
        return { throwError }
      },
      template: `
        <div>
          <button class="parent-click" @click="throwError">click me</button>
        </div>`,
    }

    const container = document.createElement('div')
    // server render
    container.innerHTML = await renderToString(h(App))
    // hydrate
    const app = createSSRApp(App)
    const handler = (app.config.errorHandler = vi.fn())
    app.mount(container)
    // assert interactions
    // parent button click
    triggerEvent('click', container.querySelector('.parent-click')!)
    expect(handler).toHaveBeenCalled()
  })

  test('handle blur error in ssr mode', async () => {
    const App = {
      setup() {
        const throwError = () => {
          throw new Error('Sentry Error')
        }
        return { throwError }
      },
      template: `
        <div>
          <input class="parent-click" @blur="throwError"/>
        </div>`,
    }

    const container = document.createElement('div')
    // server render
    container.innerHTML = await renderToString(h(App))
    // hydrate
    const app = createSSRApp(App)
    const handler = (app.config.errorHandler = vi.fn())
    app.mount(container)
    // assert interactions
    // parent blur event
    triggerEvent('blur', container.querySelector('.parent-click')!)
    expect(handler).toHaveBeenCalled()
  })

  // #6638
  test('async component', async () => {
    const spy = vi.fn()
    const Comp = () =>
      h(
        'button',
        {
          onClick: spy,
        },
        'hello!',
      )

    let serverResolve: any
    let AsyncComp = defineAsyncComponent(
      () =>
        new Promise(r => {
          serverResolve = r
        }),
    )

    const App = {
      render() {
        return ['hello', h(AsyncComp), 'world']
      },
    }

    // server render
    const htmlPromise = renderToString(h(App))
    serverResolve(Comp)
    const html = await htmlPromise
    expect(html).toMatchInlineSnapshot(
      `"<!--[-->hello<button>hello!</button>world<!--]-->"`,
    )

    // hydration
    let clientResolve: any
    AsyncComp = defineAsyncComponent(
      () =>
        new Promise(r => {
          clientResolve = r
        }),
    )

    const container = document.createElement('div')
    container.innerHTML = html
    createSSRApp(App).mount(container)

    // hydration not complete yet
    triggerEvent('click', container.querySelector('button')!)
    expect(spy).not.toHaveBeenCalled()

    // resolve
    clientResolve(Comp)
    await new Promise(r => setTimeout(r))

    // should be hydrated now
    triggerEvent('click', container.querySelector('button')!)
    expect(spy).toHaveBeenCalled()
  })

  test('update async wrapper before resolve', async () => {
    const Comp = {
      render() {
        return h('h1', 'Async component')
      },
    }
    let serverResolve: any
    let AsyncComp = defineAsyncComponent(
      () =>
        new Promise(r => {
          serverResolve = r
        }),
    )

    const toggle = ref(true)
    const App = {
      setup() {
        onMounted(() => {
          // change state, this makes updateComponent(AsyncComp) execute before
          // the async component is resolved
          toggle.value = false
        })

        return () => {
          return [toggle.value ? 'hello' : 'world', h(AsyncComp)]
        }
      },
    }

    // server render
    const htmlPromise = renderToString(h(App))
    serverResolve(Comp)
    const html = await htmlPromise
    expect(html).toMatchInlineSnapshot(
      `"<!--[-->hello<h1>Async component</h1><!--]-->"`,
    )

    // hydration
    let clientResolve: any
    AsyncComp = defineAsyncComponent(
      () =>
        new Promise(r => {
          clientResolve = r
        }),
    )

    const container = document.createElement('div')
    container.innerHTML = html
    createSSRApp(App).mount(container)

    // resolve
    clientResolve(Comp)
    await new Promise(r => setTimeout(r))

    // should be hydrated now
    expect(`Hydration node mismatch`).not.toHaveBeenWarned()
    expect(container.innerHTML).toMatchInlineSnapshot(
      `"<!--[-->world<h1>Async component</h1><!--]-->"`,
    )
  })

  // #13510
  test('update async component after parent mount before async component resolve', async () => {
    const Comp = {
      props: ['toggle'],
      render(this: any) {
        return h('h1', [
          this.toggle ? 'Async component' : 'Updated async component',
        ])
      },
    }
    let serverResolve: any
    let AsyncComp = defineAsyncComponent(
      () =>
        new Promise(r => {
          serverResolve = r
        }),
    )

    const toggle = ref(true)
    const App = {
      setup() {
        onMounted(() => {
          // change state, after mount and before async component resolve
          nextTick(() => (toggle.value = false))
        })

        return () => {
          return h(AsyncComp, { toggle: toggle.value })
        }
      },
    }

    // server render
    const htmlPromise = renderToString(h(App))
    serverResolve(Comp)
    const html = await htmlPromise
    expect(html).toMatchInlineSnapshot(`"<h1>Async component</h1>"`)

    // hydration
    let clientResolve: any
    AsyncComp = defineAsyncComponent(
      () =>
        new Promise(r => {
          clientResolve = r
        }),
    )

    const container = document.createElement('div')
    container.innerHTML = html
    createSSRApp(App).mount(container)

    // resolve
    clientResolve(Comp)
    await new Promise(r => setTimeout(r))

    // prevent lazy hydration since the component has been patched
    expect('Skipping lazy hydration for component').toHaveBeenWarned()
    expect(`Hydration node mismatch`).not.toHaveBeenWarned()
    expect(container.innerHTML).toMatchInlineSnapshot(
      `"<h1>Updated async component</h1>"`,
    )
  })

  // #3787
  test('unmount async wrapper before load', async () => {
    let resolve: any
    const AsyncComp = defineAsyncComponent(
      () =>
        new Promise(r => {
          resolve = r
        }),
    )

    const show = ref(true)
    const root = document.createElement('div')
    root.innerHTML = '<div><div>async</div></div>'

    createSSRApp({
      render() {
        return h('div', [show.value ? h(AsyncComp) : h('div', 'hi')])
      },
    }).mount(root)

    show.value = false
    await nextTick()
    expect(root.innerHTML).toBe('<div><div>hi</div></div>')
    resolve({})
  })

  //#12362
  test('nested async wrapper', async () => {
    const Toggle = defineAsyncComponent(
      () =>
        new Promise(r => {
          r(
            defineComponent({
              setup(_, { slots }) {
                const show = ref(false)
                onMounted(() => {
                  nextTick(() => {
                    show.value = true
                  })
                })
                return () =>
                  withDirectives(
                    h('div', null, [renderSlot(slots, 'default')]),
                    [[vShow, show.value]],
                  )
              },
            }) as any,
          )
        }),
    )

    const Wrapper = defineAsyncComponent(() => {
      return new Promise(r => {
        r(
          defineComponent({
            render(this: any) {
              return renderSlot(this.$slots, 'default')
            },
          }) as any,
        )
      })
    })

    const count = ref(0)
    const fn = vi.fn()
    const Child = {
      setup() {
        onMounted(() => {
          fn()
          count.value++
        })
        return () => h('div', count.value)
      },
    }

    const App = {
      render() {
        return h(Toggle, null, {
          default: () =>
            h(Wrapper, null, {
              default: () =>
                h(Wrapper, null, {
                  default: () => h(Child),
                }),
            }),
        })
      },
    }

    const root = document.createElement('div')
    root.innerHTML = await renderToString(h(App))
    expect(root.innerHTML).toMatchInlineSnapshot(
      `"<div style="display:none;"><!--[--><!--[--><!--[--><div>0</div><!--]--><!--]--><!--]--></div>"`,
    )

    createSSRApp(App).mount(root)
    await nextTick()
    await nextTick()
    expect(root.innerHTML).toMatchInlineSnapshot(
      `"<div style=""><!--[--><!--[--><!--[--><div>1</div><!--]--><!--]--><!--]--></div>"`,
    )
    expect(fn).toBeCalledTimes(1)
  })

  test('unmount async wrapper before load (fragment)', async () => {
    let resolve: any
    const AsyncComp = defineAsyncComponent(
      () =>
        new Promise(r => {
          resolve = r
        }),
    )

    const show = ref(true)
    const root = document.createElement('div')
    root.innerHTML = '<div><!--[-->async<!--]--></div>'

    createSSRApp({
      render() {
        return h('div', [show.value ? h(AsyncComp) : h('div', 'hi')])
      },
    }).mount(root)

    show.value = false
    await nextTick()
    expect(root.innerHTML).toBe('<div><div>hi</div></div>')
    resolve({})
  })

  test('elements with camel-case in svg ', () => {
    const { vnode, container } = mountWithHydration(
      '<animateTransform></animateTransform>',
      () => h('animateTransform'),
    )
    expect(vnode.el).toBe(container.firstChild)
    expect(`Hydration node mismatch`).not.toHaveBeenWarned()
  })

  test('SVG as a mount container', () => {
    const svgContainer = document.createElement('svg')
    svgContainer.innerHTML = '<g></g>'
    const app = createSSRApp({
      render: () => h('g'),
    })

    expect(
      (
        app.mount(svgContainer).$.subTree as VNode<Node, Element> & {
          el: Element
        }
      ).el instanceof SVGElement,
    )
  })

  test('force hydrate prop with `.prop` modifier', () => {
    const { container } = mountWithHydration('<input type="checkbox">', () =>
      h('input', {
        type: 'checkbox',
        '.indeterminate': true,
      }),
    )
    expect((container.firstChild! as any).indeterminate).toBe(true)
  })

  test('force hydrate input v-model with non-string value bindings', () => {
    const { container } = mountWithHydration(
      '<input type="checkbox" value="true">',
      () =>
        withDirectives(
          createVNode('input', { type: 'checkbox', 'true-value': true }, null),
          [[vModelCheckbox, true]],
        ),
    )
    expect((container.firstChild as any)._trueValue).toBe(true)
  })

  test('force hydrate checkbox with indeterminate', () => {
    const { container } = mountWithHydration(
      '<input type="checkbox" indeterminate>',
      () => createVNode('input', { type: 'checkbox', indeterminate: '' }, null),
    )
    expect((container.firstChild as any).indeterminate).toBe(true)
  })

  test('force hydrate select option with non-string value bindings', () => {
    const { container } = mountWithHydration(
      '<select><option value="true">ok</option></select>',
      () =>
        h('select', [
          // hoisted because bound value is a constant...
          createVNode('option', { value: true }, null),
        ]),
    )
    expect((container.firstChild!.firstChild as any)._value).toBe(true)
  })

  // #7203
  test('force hydrate custom element with dynamic props', () => {
    class MyElement extends HTMLElement {
      foo = ''
      constructor() {
        super()
      }
    }
    customElements.define('my-element-7203', MyElement)

    const msg = ref('bar')
    const container = document.createElement('div')
    container.innerHTML = '<my-element-7203></my-element-7203>'
    const app = createSSRApp({
      render: () => h('my-element-7203', { foo: msg.value }),
    })
    app.mount(container)
    expect((container.firstChild as any).foo).toBe(msg.value)
  })

  // #14274
  test('should not render ref on custom element during hydration', () => {
    const container = document.createElement('div')
    container.innerHTML = '<my-element>hello</my-element>'
    const root = ref()
    const app = createSSRApp({
      render: () =>
        h('my-element', {
          ref: root,
          innerHTML: 'hello',
        }),
    })
    app.mount(container)
    expect(container.innerHTML).toBe('<my-element>hello</my-element>')
    expect((container.firstChild as Element).hasAttribute('ref')).toBe(false)
    expect(root.value).toBe(container.firstChild)
  })

  // #5728
  test('empty text node in slot', () => {
    const Comp = {
      render(this: any) {
        return renderSlot(this.$slots, 'default', {}, () => [
          createTextVNode(''),
        ])
      },
    }
    const { container, vnode } = mountWithHydration('<!--[--><!--]-->', () =>
      h(Comp),
    )
    expect(container.childNodes.length).toBe(3)
    const text = container.childNodes[1]
    expect(text.nodeType).toBe(3)
    expect(vnode.el).toBe(container.childNodes[0])
    // component => slot fragment => text node
    expect((vnode as any).component?.subTree.children[0].el).toBe(text)
  })

  // #7215
  test('empty text node', () => {
    const Comp = {
      render(this: any) {
        return h('p', [''])
      },
    }
    const { container } = mountWithHydration('<p></p>', () => h(Comp))
    expect(container.childNodes.length).toBe(1)
    const p = container.childNodes[0]
    expect(p.childNodes.length).toBe(1)
    const text = p.childNodes[0]
    expect(text.nodeType).toBe(3)
  })

  // #11372
  test('object style value tracking in prod', async () => {
    __DEV__ = false
    try {
      const style = reactive({ color: 'red' })
      const Comp = {
        render(this: any) {
          return createVNode(
            'div',
            {
              style: normalizeStyle(style),
            },
            null,
          )
        },
      }
      const { container } = mountWithHydration(
        `<div style="color: red;"></div>`,
        () => h(Comp),
      )
      style.color = 'green'
      await nextTick()
      expect(container.innerHTML).toBe(`<div style="color: green;"></div>`)
    } finally {
      __DEV__ = true
    }
  })

  test('app.unmount()', async () => {
    const container = document.createElement('DIV')
    container.innerHTML = '<button></button>'
    const App = defineComponent({
      setup(_, { expose }) {
        const count = ref(0)

        expose({ count })

        return () =>
          h('button', {
            onClick: () => count.value++,
          })
      },
    })

    const app = createSSRApp(App)
    const vm = app.mount(container)
    await nextTick()
    expect((container as any)._vnode).toBeDefined()
    // @ts-expect-error - expose()'d properties are not available on vm type
    expect(vm.count).toBe(0)

    app.unmount()
    expect((container as any)._vnode).toBe(null)
  })

  // #6637
  test('stringified root fragment', () => {
    mountWithHydration(`<!--[--><div></div><!--]-->`, () =>
      createStaticVNode(`<div></div>`, 1),
    )
    expect(`mismatch`).not.toHaveBeenWarned()
  })

  // #13394
  // #10607
  test('update component stable slot (prod + optimized mode)', async () => {
    __DEV__ = false
    try {
      const container = document.createElement('div')
      container.innerHTML = `<template><div show="false"><!--[--><div><div><!----></div></div><div>0</div><!--]--></div></template>`
      const Comp = {
        render(this: any) {
          return createVNode('div', null, [renderSlot(this.$slots, 'default')])
        },
      }
      const show = ref(false)
      const clicked = ref(false)

      const Wrapper = {
        setup() {
          const items = ref<number[]>([])
          onMounted(() => {
            items.value = [1]
          })
          return () => {
            return createVNode(Comp, null, {
              default: withCtx(() => [
                createElementVNode('div', null, [
                  createElementVNode('div', null, [
                    clicked.value
                      ? createVNode('div', { key: 0 }, 'foo')
                      : createCommentVNode('v-if'),
                  ]),
                ]),
                createElementVNode('div', null, items.value.length),
              ]),
              _: 1 /* STABLE */,
            })
          }
        },
      }
      createSSRApp({
        components: { Wrapper },
        data() {
          return { show }
        },
        template: `<Wrapper :show="show"/>`,
      }).mount(container)

      await nextTick()
      expect(container.innerHTML).toBe(
        `<div show="false"><!--[--><div><div><!----></div></div><div>1</div><!--]--></div>`,
      )

      show.value = true
      await nextTick()
      expect(async () => {
        clicked.value = true
        await nextTick()
      }).not.toThrow("Cannot read properties of null (reading 'insertBefore')")

      await nextTick()
      expect(container.innerHTML).toBe(
        `<div show="true"><!--[--><div><div><div>foo</div></div></div><div>1</div><!--]--></div>`,
      )
    } catch (e) {
      throw e
    } finally {
      __DEV__ = true
    }
  })

  test('hmr root reload', async () => {
    const appId = 'test-app-id'
    const App = {
      __hmrId: appId,
      template: `<div>foo</div>`,
    }

    const root = document.createElement('div')
    root.innerHTML = await renderToString(h(App))
    createSSRApp(App).mount(root)
    expect(root.innerHTML).toBe('<div>foo</div>')

    reload(appId, {
      __hmrId: appId,
      template: `<div>bar</div>`,
    })
    await nextTick()
    expect(root.innerHTML).toBe('<div>bar</div>')
  })

  describe('mismatch handling', () => {
    test('text node', () => {
      const { container } = mountWithHydration(`foo`, () => 'bar')
      expect(container.textContent).toBe('bar')
      expect(`Hydration text mismatch`).toHaveBeenWarned()
    })

    test('element text content', () => {
      const { container } = mountWithHydration(`<div>foo</div>`, () =>
        h('div', 'bar'),
      )
      expect(container.innerHTML).toBe('<div>bar</div>')
      expect(`Hydration text content mismatch`).toHaveBeenWarned()
    })

    test('not enough children', () => {
      const { container } = mountWithHydration(`<div></div>`, () =>
        h('div', [h('span', 'foo'), h('span', 'bar')]),
      )
      expect(container.innerHTML).toBe(
        '<div><span>foo</span><span>bar</span></div>',
      )
      expect(`Hydration children mismatch`).toHaveBeenWarned()
    })

    test('too many children', () => {
      const { container } = mountWithHydration(
        `<div><span>foo</span><span>bar</span></div>`,
        () => h('div', [h('span', 'foo')]),
      )
      expect(container.innerHTML).toBe('<div><span>foo</span></div>')
      expect(`Hydration children mismatch`).toHaveBeenWarned()
    })

    test('children mismatch is checked once when removing excess nodes', () => {
      const hasAttribute = vi.spyOn(Element.prototype, 'hasAttribute')

      try {
        const { container } = mountWithHydration(
          `<div><span>foo</span><span>bar</span><span>baz</span></div>`,
          () => h('div', [h('span', 'foo')]),
        )
        const el = container.firstChild as Element
        const allowMismatchCheckCount = hasAttribute.mock.calls.filter(
          ([key], i) =>
            key === 'data-allow-mismatch' &&
            hasAttribute.mock.contexts[i] === el,
        ).length

        expect(container.innerHTML).toBe('<div><span>foo</span></div>')
        expect(`Hydration children mismatch`).toHaveBeenWarnedTimes(1)
        expect(allowMismatchCheckCount).toBe(1)
      } finally {
        hasAttribute.mockRestore()
      }
    })

    test('children mismatch is checked once when mounting missing nodes', () => {
      const hasAttribute = vi.spyOn(Element.prototype, 'hasAttribute')

      try {
        const { container } = mountWithHydration(`<div></div>`, () =>
          h('div', [h('span', 'foo'), h('span', 'bar'), h('span', 'baz')]),
        )
        const el = container.firstChild as Element
        const allowMismatchCheckCount = hasAttribute.mock.calls.filter(
          ([key], i) =>
            key === 'data-allow-mismatch' &&
            hasAttribute.mock.contexts[i] === el,
        ).length

        expect(container.innerHTML).toBe(
          '<div><span>foo</span><span>bar</span><span>baz</span></div>',
        )
        expect(`Hydration children mismatch`).toHaveBeenWarnedTimes(1)
        expect(allowMismatchCheckCount).toBe(1)
      } finally {
        hasAttribute.mockRestore()
      }
    })

    test('complete mismatch', () => {
      const { container } = mountWithHydration(
        `<div><span>foo</span><span>bar</span></div>`,
        () => h('div', [h('div', 'foo'), h('p', 'bar')]),
      )
      expect(container.innerHTML).toBe('<div><div>foo</div><p>bar</p></div>')
      expect(`Hydration node mismatch`).toHaveBeenWarnedTimes(2)
    })

    test('fragment mismatch removal', () => {
      const { container } = mountWithHydration(
        `<div><!--[--><div>foo</div><div>bar</div><!--]--></div>`,
        () => h('div', [h('span', 'replaced')]),
      )
      expect(container.innerHTML).toBe('<div><span>replaced</span></div>')
      expect(`Hydration node mismatch`).toHaveBeenWarned()
    })

    test('fragment not enough children', () => {
      const { container } = mountWithHydration(
        `<div><!--[--><div>foo</div><!--]--><div>baz</div></div>`,
        () => h('div', [[h('div', 'foo'), h('div', 'bar')], h('div', 'baz')]),
      )
      expect(container.innerHTML).toBe(
        '<div><!--[--><div>foo</div><div>bar</div><!--]--><div>baz</div></div>',
      )
      expect(`Hydration node mismatch`).toHaveBeenWarned()
    })

    test('fragment too many children', () => {
      const { container } = mountWithHydration(
        `<div><!--[--><div>foo</div><div>bar</div><!--]--><div>baz</div></div>`,
        () => h('div', [[h('div', 'foo')], h('div', 'baz')]),
      )
      expect(container.innerHTML).toBe(
        '<div><!--[--><div>foo</div><!--]--><div>baz</div></div>',
      )
      // fragment ends early and attempts to hydrate the extra <div>bar</div>
      // as 2nd fragment child.
      expect(`Hydration text content mismatch`).toHaveBeenWarned()
      // excessive children removal
      expect(`Hydration children mismatch`).toHaveBeenWarned()
    })

    test('comment mismatch (element)', () => {
      const { container } = mountWithHydration(`<div><span></span></div>`, () =>
        h('div', [createCommentVNode('hi')]),
      )
      expect(container.innerHTML).toBe('<div><!--hi--></div>')
      expect(`Hydration node mismatch`).toHaveBeenWarned()
    })

    test('comment mismatch (text)', () => {
      const { container } = mountWithHydration(`<div>foobar</div>`, () =>
        h('div', [createCommentVNode('hi')]),
      )
      expect(container.innerHTML).toBe('<div><!--hi--></div>')
      expect(`Hydration node mismatch`).toHaveBeenWarned()
    })

    test('class mismatch', () => {
      mountWithHydration(`<div class="foo bar"></div>`, () =>
        h('div', { class: ['foo', 'bar'] }),
      )
      mountWithHydration(`<div class="foo bar"></div>`, () =>
        h('div', { class: { foo: true, bar: true } }),
      )
      mountWithHydration(`<div class="foo bar"></div>`, () =>
        h('div', { class: 'foo bar' }),
      )
      // SVG classes
      mountWithHydration(`<svg class="foo bar"></svg>`, () =>
        h('svg', { class: 'foo bar' }),
      )
      // class with different order
      mountWithHydration(`<div class="foo bar"></div>`, () =>
        h('div', { class: 'bar foo' }),
      )
      expect(`Hydration class mismatch`).not.toHaveBeenWarned()
      mountWithHydration(`<div class="foo bar"></div>`, () =>
        h('div', { class: 'foo' }),
      )
      expect(`Hydration class mismatch`).toHaveBeenWarned()
    })

    test('style mismatch', () => {
      mountWithHydration(`<div style="color:red;"></div>`, () =>
        h('div', { style: { color: 'red' } }),
      )
      mountWithHydration(`<div style="color:red;"></div>`, () =>
        h('div', { style: `color:red;` }),
      )
      mountWithHydration(
        `<div style="color:red; font-size: 12px;"></div>`,
        () => h('div', { style: `font-size: 12px; color:red;` }),
      )
      mountWithHydration(`<div style="color:red;display:none;"></div>`, () =>
        withDirectives(createVNode('div', { style: 'color: red' }, ''), [
          [vShow, false],
        ]),
      )
      expect(`Hydration style mismatch`).not.toHaveBeenWarned()
      mountWithHydration(`<div style="color:red;"></div>`, () =>
        h('div', { style: { color: 'green' } }),
      )
      expect(`Hydration style mismatch`).toHaveBeenWarnedTimes(1)
    })

    test('style mismatch when no style attribute is present', () => {
      mountWithHydration(`<div></div>`, () =>
        h('div', { style: { color: 'red' } }),
      )
      expect(`Hydration style mismatch`).toHaveBeenWarnedTimes(1)
    })

    test('style mismatch w/ v-show', () => {
      mountWithHydration(`<div style="color:red;display:none"></div>`, () =>
        withDirectives(createVNode('div', { style: 'color: red' }, ''), [
          [vShow, false],
        ]),
      )
      expect(`Hydration style mismatch`).not.toHaveBeenWarned()
      mountWithHydration(`<div style="color:red;"></div>`, () =>
        withDirectives(createVNode('div', { style: 'color: red' }, ''), [
          [vShow, false],
        ]),
      )
      expect(`Hydration style mismatch`).toHaveBeenWarnedTimes(1)
    })

    test('attr mismatch', () => {
      mountWithHydration(`<div id="foo"></div>`, () => h('div', { id: 'foo' }))
      mountWithHydration(`<div spellcheck></div>`, () =>
        h('div', { spellcheck: '' }),
      )
      mountWithHydration(`<div></div>`, () => h('div', { id: undefined }))
      // boolean
      mountWithHydration(`<select multiple></div>`, () =>
        h('select', { multiple: true }),
      )
      mountWithHydration(`<select multiple></div>`, () =>
        h('select', { multiple: 'multiple' }),
      )
      expect(`Hydration attribute mismatch`).not.toHaveBeenWarned()

      mountWithHydration(`<div></div>`, () => h('div', { id: 'foo' }))
      expect(`Hydration attribute mismatch`).toHaveBeenWarnedTimes(1)

      mountWithHydration(`<div id="bar"></div>`, () => h('div', { id: 'foo' }))
      expect(`Hydration attribute mismatch`).toHaveBeenWarnedTimes(2)
    })

    test('attr special case: textarea value', () => {
      mountWithHydration(`<textarea>foo</textarea>`, () =>
        h('textarea', { value: 'foo' }),
      )
      mountWithHydration(`<textarea></textarea>`, () =>
        h('textarea', { value: '' }),
      )
      expect(`Hydration attribute mismatch`).not.toHaveBeenWarned()

      mountWithHydration(`<textarea>foo</textarea>`, () =>
        h('textarea', { value: 'bar' }),
      )
      expect(`Hydration attribute mismatch`).toHaveBeenWarned()
    })

    // #11873
    test('<textarea> with newlines at the beginning', async () => {
      const render = () => h('textarea', null, '\nhello')
      const html = await renderToString(createSSRApp({ render }))
      mountWithHydration(html, render)
      expect(`Hydration text content mismatch`).not.toHaveBeenWarned()
    })

    test('<pre> with newlines at the beginning', async () => {
      const render = () => h('pre', null, '\n')
      const html = await renderToString(createSSRApp({ render }))
      mountWithHydration(html, render)
      expect(`Hydration text content mismatch`).not.toHaveBeenWarned()
    })

    test('boolean attr handling', () => {
      mountWithHydration(`<input />`, () => h('input', { readonly: false }))
      expect(`Hydration attribute mismatch`).not.toHaveBeenWarned()

      mountWithHydration(`<input readonly />`, () =>
        h('input', { readonly: true }),
      )
      expect(`Hydration attribute mismatch`).not.toHaveBeenWarned()

      mountWithHydration(`<input readonly="readonly" />`, () =>
        h('input', { readonly: true }),
      )
      expect(`Hydration attribute mismatch`).not.toHaveBeenWarned()
    })

    test('client value is null or undefined', () => {
      mountWithHydration(`<div></div>`, () =>
        h('div', { draggable: undefined }),
      )
      expect(`Hydration attribute mismatch`).not.toHaveBeenWarned()

      mountWithHydration(`<input />`, () => h('input', { type: null }))
      expect(`Hydration attribute mismatch`).not.toHaveBeenWarned()
    })

    test('should not warn against object values', () => {
      mountWithHydration(`<input />`, () => h('input', { from: {} }))
      expect(`Hydration attribute mismatch`).not.toHaveBeenWarned()
    })

    test('should not warn on falsy bindings of non-property keys', () => {
      mountWithHydration(`<button />`, () => h('button', { href: undefined }))
      expect(`Hydration attribute mismatch`).not.toHaveBeenWarned()
    })

    test('should not warn on non-renderable option values', () => {
      mountWithHydration(`<select><option>hello</option></select>`, () =>
        h('select', [h('option', { value: ['foo'] }, 'hello')]),
      )
      expect(`Hydration attribute mismatch`).not.toHaveBeenWarned()
    })

    test('should not warn css v-bind', () => {
      const container = document.createElement('div')
      container.innerHTML = `<div style="--foo:red;color:var(--foo);" />`
      const app = createSSRApp({
        setup() {
          useCssVars(() => ({
            foo: 'red',
          }))
          return () => h('div', { style: { color: 'var(--foo)' } })
        },
      })
      app.mount(container)
      expect(`Hydration style mismatch`).not.toHaveBeenWarned()
    })

    // #10317 - test case from #10325
    test('css vars should only be added to expected on component root dom', () => {
      const container = document.createElement('div')
      container.innerHTML = `<div style="--foo:red;"><div style="color:var(--foo);" /></div>`
      const app = createSSRApp({
        setup() {
          useCssVars(() => ({
            foo: 'red',
          }))
          return () =>
            h('div', null, [h('div', { style: { color: 'var(--foo)' } })])
        },
      })
      app.mount(container)
      expect(`Hydration style mismatch`).not.toHaveBeenWarned()
    })

    // #11188
    test('css vars support fallthrough', () => {
      const container = document.createElement('div')
      container.innerHTML = `<div style="padding: 4px;--foo:red;"></div>`
      const app = createSSRApp({
        setup() {
          useCssVars(() => ({
            foo: 'red',
          }))
          return () => h(Child)
        },
      })
      const Child = {
        setup() {
          return () => h('div', { style: 'padding: 4px' })
        },
      }
      app.mount(container)
      expect(`Hydration style mismatch`).not.toHaveBeenWarned()
    })

    // #11189
    test('should not warn for directives that mutate DOM in created', () => {
      const container = document.createElement('div')
      container.innerHTML = `<div class="test red"></div>`
      const vColor: ObjectDirective = {
        created(el, binding) {
          el.classList.add(binding.value)
        },
      }
      const app = createSSRApp({
        setup() {
          return () =>
            withDirectives(h('div', { class: 'test' }), [[vColor, 'red']])
        },
      })
      app.mount(container)
      expect(`Hydration style mismatch`).not.toHaveBeenWarned()
    })

    test('escape css var name', () => {
      const container = document.createElement('div')
      container.innerHTML = `<div style="padding: 4px;--foo\\.bar:red;"></div>`
      const app = createSSRApp({
        setup() {
          useCssVars(() => ({
            'foo.bar': 'red',
          }))
          return () => h(Child)
        },
      })
      const Child = {
        setup() {
          return () => h('div', { style: 'padding: 4px' })
        },
      }
      app.mount(container)
      expect(`Hydration style mismatch`).not.toHaveBeenWarned()
    })
  })

  describe('data-allow-mismatch', () => {
    test('element text content', () => {
      const { container } = mountWithHydration(
        `<div data-allow-mismatch="text">foo</div>`,
        () => h('div', 'bar'),
      )
      expect(container.innerHTML).toBe(
        '<div data-allow-mismatch="text">bar</div>',
      )
      expect(`Hydration text content mismatch`).not.toHaveBeenWarned()
    })

    test('not enough children', () => {
      const { container } = mountWithHydration(
        `<div data-allow-mismatch="children"></div>`,
        () => h('div', [h('span', 'foo'), h('span', 'bar')]),
      )
      expect(container.innerHTML).toBe(
        '<div data-allow-mismatch="children"><span>foo</span><span>bar</span></div>',
      )
      expect(`Hydration children mismatch`).not.toHaveBeenWarned()
    })

    test('too many children', () => {
      const { container } = mountWithHydration(
        `<div data-allow-mismatch="children"><span>foo</span><span>bar</span></div>`,
        () => h('div', [h('span', 'foo')]),
      )
      expect(container.innerHTML).toBe(
        '<div data-allow-mismatch="children"><span>foo</span></div>',
      )
      expect(`Hydration children mismatch`).not.toHaveBeenWarned()
    })

    test('complete mismatch', () => {
      const { container } = mountWithHydration(
        `<div data-allow-mismatch="children"><span>foo</span><span>bar</span></div>`,
        () => h('div', [h('div', 'foo'), h('p', 'bar')]),
      )
      expect(container.innerHTML).toBe(
        '<div data-allow-mismatch="children"><div>foo</div><p>bar</p></div>',
      )
      expect(`Hydration node mismatch`).not.toHaveBeenWarned()
    })

    test('fragment mismatch removal', () => {
      const { container } = mountWithHydration(
        `<div data-allow-mismatch="children"><!--[--><div>foo</div><div>bar</div><!--]--></div>`,
        () => h('div', [h('span', 'replaced')]),
      )
      expect(container.innerHTML).toBe(
        '<div data-allow-mismatch="children"><span>replaced</span></div>',
      )
      expect(`Hydration node mismatch`).not.toHaveBeenWarned()
    })

    test('fragment not enough children', () => {
      const { container } = mountWithHydration(
        `<div data-allow-mismatch="children"><!--[--><div>foo</div><!--]--><div>baz</div></div>`,
        () => h('div', [[h('div', 'foo'), h('div', 'bar')], h('div', 'baz')]),
      )
      expect(container.innerHTML).toBe(
        '<div data-allow-mismatch="children"><!--[--><div>foo</div><div>bar</div><!--]--><div>baz</div></div>',
      )
      expect(`Hydration node mismatch`).not.toHaveBeenWarned()
    })

    test('fragment too many children', () => {
      const { container } = mountWithHydration(
        `<div data-allow-mismatch="children"><!--[--><div>foo</div><div>bar</div><!--]--><div>baz</div></div>`,
        () => h('div', [[h('div', 'foo')], h('div', 'baz')]),
      )
      expect(container.innerHTML).toBe(
        '<div data-allow-mismatch="children"><!--[--><div>foo</div><!--]--><div>baz</div></div>',
      )
      // fragment ends early and attempts to hydrate the extra <div>bar</div>
      // as 2nd fragment child.
      expect(`Hydration text content mismatch`).not.toHaveBeenWarned()
      // excessive children removal
      expect(`Hydration children mismatch`).not.toHaveBeenWarned()
    })

    test('comment mismatch (element)', () => {
      const { container } = mountWithHydration(
        `<div data-allow-mismatch="children"><span></span></div>`,
        () => h('div', [createCommentVNode('hi')]),
      )
      expect(container.innerHTML).toBe(
        '<div data-allow-mismatch="children"><!--hi--></div>',
      )
      expect(`Hydration node mismatch`).not.toHaveBeenWarned()
    })

    test('comment mismatch (v-if)', () => {
      const { container } = mountWithHydration(`<!--v-if-->`, () =>
        h('div', { 'data-allow-mismatch': '' }, [h('span', 'value')]),
      )
      expect(container.innerHTML).toBe(
        '<div data-allow-mismatch=""><span>value</span></div>',
      )
      expect(`Hydration node mismatch`).not.toHaveBeenWarned()
    })

    test('comment mismatch (v-if branch removed)', () => {
      const { container } = mountWithHydration(
        `<div data-allow-mismatch=""><span>value</span></div>`,
        () => createCommentVNode('v-if'),
      )
      expect(container.innerHTML).toBe('<!--v-if-->')
      expect(`Hydration node mismatch`).not.toHaveBeenWarned()
    })

    test('node mismatch (v-else branches)', () => {
      const { container } = mountWithHydration(
        `<span data-allow-mismatch="">server</span>`,
        () => h('div', { 'data-allow-mismatch': '' }, 'client'),
      )
      expect(container.innerHTML).toBe(
        '<div data-allow-mismatch="">client</div>',
      )
      expect(`Hydration node mismatch`).not.toHaveBeenWarned()
    })

    test('comment mismatch (v-if) only allows children mismatches', () => {
      const { container } = mountWithHydration(`<!--v-if-->`, () =>
        h('div', { 'data-allow-mismatch': 'class' }, [h('span', 'value')]),
      )
      expect(container.innerHTML).toBe(
        '<div data-allow-mismatch="class"><span>value</span></div>',
      )
      expect(`Hydration node mismatch`).toHaveBeenWarned()
    })

    test('comment mismatch (text)', () => {
      const { container } = mountWithHydration(
        `<div data-allow-mismatch="children">foobar</div>`,
        () => h('div', [createCommentVNode('hi')]),
      )
      expect(container.innerHTML).toBe(
        '<div data-allow-mismatch="children"><!--hi--></div>',
      )
      expect(`Hydration node mismatch`).not.toHaveBeenWarned()
    })

    test('class mismatch', () => {
      mountWithHydration(
        `<div class="foo bar" data-allow-mismatch="class"></div>`,
        () => h('div', { class: 'foo' }),
      )
      expect(`Hydration class mismatch`).not.toHaveBeenWarned()
    })

    test('style mismatch', () => {
      mountWithHydration(
        `<div style="color:red;" data-allow-mismatch="style"></div>`,
        () => h('div', { style: { color: 'green' } }),
      )
      expect(`Hydration style mismatch`).not.toHaveBeenWarned()
    })

    test('attr mismatch', () => {
      mountWithHydration(`<div data-allow-mismatch="attribute"></div>`, () =>
        h('div', { id: 'foo' }),
      )
      mountWithHydration(
        `<div id="bar" data-allow-mismatch="attribute"></div>`,
        () => h('div', { id: 'foo' }),
      )
      expect(`Hydration attribute mismatch`).not.toHaveBeenWarned()
    })

    // #9033
    test('force patch dynamic props when hydrating', () => {
      __DEV__ = false
      try {
        const { container } = mountWithHydration(
          `<div><div>server</div></div>`,
          () =>
            createVNode('div', null, [
              createElementVNode('div', { innerHTML: 'client' }, null),
            ]),
        )
        expect(container.innerHTML).toBe(`<div><div>client</div></div>`)
      } finally {
        __DEV__ = true
      }
    })

    test('only patches declared dynamic props when hydrating', () => {
      const { container } = mountWithHydration(
        `<div data-allow-mismatch="attribute" id="server" value="server"></div>`,
        () =>
          createVNode(
            'div',
            {
              'data-allow-mismatch': 'attribute',
              id: 'client',
              value: 'client',
            },
            null,
          ),
      )
      const el = container.firstChild as Element

      expect(el.getAttribute('id')).toBe('client')
      expect(el.getAttribute('value')).toBe('server')
    })
  })
})

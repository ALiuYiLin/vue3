import { createApp, createVNode, h } from 'vue'
import { renderToString } from '../src/renderToString'
import { ssrRenderAttrs, ssrRenderComponent, ssrRenderVNode } from '../src'

describe('ssr: scopedId runtime behavior', () => {
  test('id on component root', async () => {
    const Child = {
      ssrRender: (ctx: any, push: any, parent: any, attrs: any) => {
        push(`<div${ssrRenderAttrs(attrs)}></div>`)
      },
    }

    const Comp = {
      __scopeId: 'parent',
      ssrRender: (ctx: any, push: any, parent: any) => {
        push(ssrRenderComponent(Child), null, null, parent)
      },
    }

    const result = await renderToString(createApp(Comp))
    expect(result).toBe(`<div parent></div>`)
  })

  // #2892
  // #3513
  test('scopeId inheritance across ssr-compiled and on-ssr compiled parent chain', async () => {
    const Child = {
      ssrRender: (ctx: any, push: any, parent: any, attrs: any) => {
        push(`<div${ssrRenderAttrs(attrs)}></div>`)
      },
    }

    const Middle = {
      render() {
        return h(Child)
      },
    }

    const Comp = {
      __scopeId: 'parent',
      ssrRender: (ctx: any, push: any, parent: any) => {
        push(ssrRenderComponent(Middle, null, null, parent))
      },
    }

    const result = await renderToString(createApp(Comp)) // output: `<div></div>`
    expect(result).toBe(`<div parent></div>`)
  })

  // #6093
  // #12159
  test('avoid duplicate scopeId through recursive ssr vnode roots', async () => {
    let count = 2

    const Comp = {
      __scopeId: 'comp',
      ssrRender: (ctx: any, push: any, parent: any, attrs: any) => {
        if (--count) {
          push(ssrRenderComponent(Comp, attrs, null, parent))
        } else {
          ssrRenderVNode(push, createVNode('div', attrs, 'vuejs'), parent)
        }
      },
    }

    const result = await renderToString(createApp(Comp))
    expect(result).toBe(`<div comp>vuejs</div>`)
  })

  test('avoid duplicate scopeId through recursive render roots', async () => {
    let count = 2

    const Comp = {
      __scopeId: 'comp',
      render(this: any) {
        return --count ? h(Comp, this.$attrs) : h('div', this.$attrs, 'vuejs')
      },
    }

    const result = await renderToString(createApp(Comp))
    expect(result).toBe(`<div comp>vuejs</div>`)
  })
})

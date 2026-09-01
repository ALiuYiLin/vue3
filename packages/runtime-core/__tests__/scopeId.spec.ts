import {
  h,
  nodeOps,
  popScopeId,
  pushScopeId,
  render,
  serializeInner,
} from '@vue/runtime-test'

describe('scopeId runtime support', () => {
  test('should attach scopeId', () => {
    const App = {
      __scopeId: 'parent',
      render: () => h('div', [h('div')]),
    }
    const root = nodeOps.createElement('div')
    render(h(App), root)
    expect(serializeInner(root)).toBe(`<div parent><div parent></div></div>`)
  })

  test('should attach scopeId to components in parent component', () => {
    const Child = {
      __scopeId: 'child',
      render: () => h('div'),
    }
    const App = {
      __scopeId: 'parent',
      render: () => h('div', [h(Child)]),
    }

    const root = nodeOps.createElement('div')
    render(h(App), root)
    expect(serializeInner(root)).toBe(
      `<div parent><div child parent></div></div>`,
    )
  })

  // #1988
  test('should inherit scopeId through nested HOCs with inheritAttrs: false', () => {
    const App = {
      __scopeId: 'parent',
      render: () => {
        return h(Child)
      },
    }

    function Child() {
      return h(Child2, { class: 'foo' })
    }

    function Child2() {
      return h('div')
    }
    Child2.inheritAttrs = false

    const root = nodeOps.createElement('div')
    render(h(App), root)

    expect(serializeInner(root)).toBe(`<div parent></div>`)
  })

  test('hoisted nodes', async () => {
    pushScopeId('foobar')
    const hoisted = h('div', 'hello')
    popScopeId()

    const App = {
      __scopeId: 'foobar',
      render: () => h('div', [hoisted]),
    }

    const root = nodeOps.createElement('div')
    render(h(App), root)

    expect(serializeInner(root)).toBe(
      `<div foobar><div foobar>hello</div></div>`,
    )
  })
})

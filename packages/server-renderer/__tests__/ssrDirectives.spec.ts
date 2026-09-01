import { renderToString } from '../src/renderToString'
import {
  createApp,
  h,
  mergeProps,
  ref,
  resolveDirective,
  unref,
  vShow,
  withDirectives,
} from 'vue'
import { ssrGetDirectiveProps, ssrRenderAttrs } from '../src'

describe('ssr: directives', () => {
  describe('vnode v-show', () => {
    test('basic', async () => {
      expect(
        await renderToString(
          createApp({
            render() {
              return withDirectives(h('div'), [[vShow, true]])
            },
          }),
        ),
      ).toBe(`<div></div>`)

      expect(
        await renderToString(
          createApp({
            render() {
              return withDirectives(h('div'), [[vShow, false]])
            },
          }),
        ),
      ).toBe(`<div style="display:none;"></div>`)
    })

    test('with merge', async () => {
      expect(
        await renderToString(
          createApp({
            render() {
              return withDirectives(
                h('div', {
                  style: {
                    color: 'red',
                  },
                }),
                [[vShow, false]],
              )
            },
          }),
        ),
      ).toBe(`<div style="color:red;display:none;"></div>`)
    })
  })

  test('custom directive w/ getSSRProps (vdom)', async () => {
    expect(
      await renderToString(
        createApp({
          render() {
            return withDirectives(h('div'), [
              [
                {
                  getSSRProps({ value }) {
                    return { id: value }
                  },
                },
                'foo',
              ],
            ])
          },
        }),
      ),
    ).toBe(`<div id="foo"></div>`)
  })

  test('custom directive w/ getSSRProps (optimized)', async () => {
    expect(
      await renderToString(
        createApp({
          data() {
            return {
              x: 'foo',
            }
          },
          directives: {
            xxx: {
              getSSRProps({ value, arg, modifiers }) {
                return { id: [value, arg, modifiers.ok].join('-') }
              },
            },
          },
          ssrRender(_ctx, _push, _parent, _attrs) {
            const _directive_xxx = resolveDirective('xxx')!
            _push(
              `<div${ssrRenderAttrs(
                ssrGetDirectiveProps(_ctx, _directive_xxx, _ctx.x, 'arg', {
                  ok: true,
                }),
              )}></div>`,
            )
          },
        }),
      ),
    ).toBe(`<div id="foo-arg-true"></div>`)
  })

  // #7499
  test('custom directive w/ getSSRProps (expose)', async () => {
    let exposeVars: null | string | undefined = null
    const useTestDirective = () => ({
      vTest: {
        getSSRProps({ instance }: any) {
          if (instance) {
            exposeVars = instance.x
          }
          return { id: exposeVars }
        },
      },
    })
    const { vTest } = useTestDirective()

    const renderString = await renderToString(
      createApp({
        setup(props, { expose }) {
          const x = ref('foo')
          expose({ x })
          const __returned__ = { useTestDirective, vTest, ref, x }
          Object.defineProperty(__returned__, '__isScriptSetup', {
            enumerable: false,
            value: true,
          })
          return __returned__
        },
        ssrRender(_ctx, _push, _parent, _attrs) {
          _push(
            `<div${ssrRenderAttrs(
              mergeProps(_attrs!, ssrGetDirectiveProps(_ctx, unref(vTest))),
            )}></div>`,
          )
        },
      }),
    )
    expect(renderString).toBe(`<div id="foo"></div>`)
    expect(exposeVars).toBe('foo')
  })
})

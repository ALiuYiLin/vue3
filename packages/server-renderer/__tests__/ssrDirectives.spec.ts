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
  describe('template v-show', () => {
    test('basic', async () => {
      expect(
        await renderToString(
          createApp({
            template: `<div v-show="true"/>`,
          }),
        ),
      ).toBe(`<div style=""></div>`)

      expect(
        await renderToString(
          createApp({
            template: `<div v-show="false"/>`,
          }),
        ),
      ).toBe(`<div style="display:none;"></div>`)
    })

    test('with static style', async () => {
      expect(
        await renderToString(
          createApp({
            template: `<div style="color:red" v-show="false"/>`,
          }),
        ),
      ).toBe(`<div style="color:red;display:none;"></div>`)
    })

    test('with dynamic style', async () => {
      expect(
        await renderToString(
          createApp({
            data: () => ({ style: { color: 'red' } }),
            template: `<div :style="style" v-show="false"/>`,
          }),
        ),
      ).toBe(`<div style="color:red;display:none;"></div>`)
    })

    test('with static + dynamic style', async () => {
      expect(
        await renderToString(
          createApp({
            data: () => ({ style: { color: 'red' } }),
            template: `<div :style="style" style="font-size:12;" v-show="false"/>`,
          }),
        ),
      ).toBe(`<div style="color:red;font-size:12;display:none;"></div>`)
    })
  })

  describe('template with v-text / v-html', () => {
    test('element with v-html', async () => {
      expect(
        await renderToString(
          createApp({
            data: () => ({ foo: 'hello' }),
            template: `<span v-html="foo"/>`,
          }),
        ),
      ).toBe(`<span>hello</span>`)
    })

    test('textarea with v-text', async () => {
      expect(
        await renderToString(
          createApp({
            data: () => ({ foo: 'hello' }),
            template: `<textarea v-text="foo"/>`,
          }),
        ),
      ).toBe(`<textarea>hello</textarea>`)
    })

    test('textarea with v-html', async () => {
      expect(
        await renderToString(
          createApp({
            data: () => ({ foo: 'hello' }),
            template: `<textarea v-html="foo"/>`,
          }),
        ),
      ).toBe(`<textarea>hello</textarea>`)
    })
  })

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

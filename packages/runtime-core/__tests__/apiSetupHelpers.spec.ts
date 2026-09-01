import { shallowReactive } from '@vue/runtime-test'
import {
  createPropsRestProxy,
  defineEmits,
  defineExpose,
  defineProps,
  mergeDefaults,
  mergeModels,
  withDefaults,
} from '../src/apiSetupHelpers'

describe('SFC <script setup> helpers', () => {
  test('should warn runtime usage', () => {
    defineProps()
    expect(`defineProps() is a compiler-hint`).toHaveBeenWarned()

    defineEmits()
    expect(`defineEmits() is a compiler-hint`).toHaveBeenWarned()

    defineExpose()
    expect(`defineExpose() is a compiler-hint`).toHaveBeenWarned()

    withDefaults({}, {})
    expect(`withDefaults() is a compiler-hint`).toHaveBeenWarned()
  })

  describe('mergeDefaults', () => {
    test('object syntax', () => {
      const merged = mergeDefaults(
        {
          foo: null,
          bar: { type: String, required: false },
          baz: String,
        },
        {
          foo: 1,
          bar: 'baz',
          baz: 'qux',
        },
      )
      expect(merged).toMatchObject({
        foo: { default: 1 },
        bar: { type: String, required: false, default: 'baz' },
        baz: { type: String, default: 'qux' },
      })
    })

    test('array syntax', () => {
      const merged = mergeDefaults(['foo', 'bar', 'baz'], {
        foo: 1,
        bar: 'baz',
        baz: 'qux',
      })
      expect(merged).toMatchObject({
        foo: { default: 1 },
        bar: { default: 'baz' },
        baz: { default: 'qux' },
      })
    })

    test('merging with skipFactory', () => {
      const fn = () => {}
      const merged = mergeDefaults(['foo', 'bar', 'baz'], {
        foo: fn,
        __skip_foo: true,
      })
      expect(merged).toMatchObject({
        foo: { default: fn, skipFactory: true },
      })
    })

    test('should warn missing', () => {
      mergeDefaults({}, { foo: 1 })
      expect(
        `props default key "foo" has no corresponding declaration`,
      ).toHaveBeenWarned()
    })
  })

  describe('mergeModels', () => {
    test('array syntax', () => {
      expect(mergeModels(['foo', 'bar'], ['baz'])).toMatchObject([
        'foo',
        'bar',
        'baz',
      ])
    })

    test('object syntax', () => {
      expect(
        mergeModels({ foo: null, bar: { required: true } }, ['baz']),
      ).toMatchObject({
        foo: null,
        bar: { required: true },
        baz: {},
      })

      expect(
        mergeModels(['baz'], { foo: null, bar: { required: true } }),
      ).toMatchObject({
        foo: null,
        bar: { required: true },
        baz: {},
      })
    })

    test('overwrite', () => {
      expect(
        mergeModels(
          { foo: null, bar: { required: true } },
          { bar: {}, baz: {} },
        ),
      ).toMatchObject({
        foo: null,
        bar: {},
        baz: {},
      })
    })
  })

  test('createPropsRestProxy', () => {
    const original = shallowReactive({
      foo: 1,
      bar: 2,
      baz: 3,
    })
    const rest = createPropsRestProxy(original, ['foo', 'bar'])
    expect('foo' in rest).toBe(false)
    expect('bar' in rest).toBe(false)
    expect(rest.baz).toBe(3)
    expect(Object.keys(rest)).toEqual(['baz'])

    original.baz = 4
    expect(rest.baz).toBe(4)
  })
})

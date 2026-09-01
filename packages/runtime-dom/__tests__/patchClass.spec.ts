import { patchProp } from '../src/patchProp'
import { svgNS } from '../src/nodeOps'

describe('runtime-dom: class patching', () => {
  test('basics', () => {
    const el = document.createElement('div')
    patchProp(el, 'class', null, 'foo')
    expect(el.className).toBe('foo')
    patchProp(el, 'class', null, null)
    expect(el.className).toBe('')
  })

  test('svg', () => {
    const el = document.createElementNS(svgNS, 'svg')
    patchProp(el, 'class', null, 'foo', 'svg')
    expect(el.getAttribute('class')).toBe('foo')
  })
})

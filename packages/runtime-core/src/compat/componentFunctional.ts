import {
  type ComponentOptions,
  type FunctionalComponent,
  getCurrentInstance,
} from '../component'
import { resolveInjections } from '../componentOptions'
import { getCompatListeners } from './instanceListeners'
import { compatH } from './renderFn'

const normalizedFunctionalComponentMap = new WeakMap<
  ComponentOptions,
  FunctionalComponent
>()

export function convertLegacyFunctionalComponent(
  comp: ComponentOptions,
): FunctionalComponent {
  if (normalizedFunctionalComponentMap.has(comp)) {
    return normalizedFunctionalComponentMap.get(comp)!
  }

  const legacyFn = comp.render as any

  const Func: FunctionalComponent = (props, ctx) => {
    const instance = getCurrentInstance()!

    const legacyCtx = {
      props,
      children: (instance.vnode.props && instance.vnode.props.children) || [],
      data: instance.vnode.props || {},
      parent: instance.parent && instance.parent.proxy,
      // slots are removed in this fork
      scopedSlots: {},
      slots: () => ({}),
      get listeners() {
        return getCompatListeners(instance)
      },
      get injections() {
        if (comp.inject) {
          const injections = {}
          resolveInjections(comp.inject, injections)
          return injections
        }
        return {}
      },
    }
    return legacyFn(compatH, legacyCtx)
  }
  Func.props = comp.props
  Func.displayName = comp.name
  Func.compatConfig = comp.compatConfig
  // v2 functional components do not inherit attrs
  Func.inheritAttrs = false

  normalizedFunctionalComponentMap.set(comp, Func)
  return Func
}

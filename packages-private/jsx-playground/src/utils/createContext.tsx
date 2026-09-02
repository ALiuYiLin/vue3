import {
  Fragment,
  type Reactive,
  defineComponent,
  h,
  inject,
  provide,
} from '@vue/runtime-core'

export interface Context<T> {
  /** 内部唯一键（Symbol）：对象身份即键 */
  readonly _key: symbol
  /** vue 组件对象形态的 setup——<Ctx value={v}> 直接作组件用（React 19 风格） */
  setup: (props: any, setupCtx: any) => any
  name?: string
  /** <Ctx.Provider value={v}> 经典风格 */
  Provider: Context<T>
  /** 消费：返回注入表中原样存储的值；无 Provider 时返回 defaultValue */
  use: () => T;
  /** 类型层面伪装 call signature，让 <Ctx value=...> 通过 JSX 类型检查 */
  (props: { value?: T; children?: any }): any
}

export function createContext<T extends object>(
  defaultValue: Reactive<T>,
): Context<T>
export function createContext<T>(defaultValue: T): Context<T>
export function createContext(defaultValue: any): Context<any> {
  const key: symbol = Symbol('vue-context')

  const Provider = defineComponent({
    name: 'VueContext.Provider',
    props: {
      value: { type: null },
    },
    setup(props: any) {
      provide(key, props.value ?? defaultValue)
      // fork 契约：children 在 props.children（无 slots）
      return () => h(Fragment, null, props.children ?? null)
    },
  })

  const ctx = {
    _key: key,
    name: 'VueContext',
    Provider: Provider as any,
    // React 19 风格 <Ctx value={v}>：Context 直接作组件——
    // vue 组件对象 setup 形态（provide + 渲染 children）
    setup(props: any, setupCtx: any) {
      // 无 props 声明的组件：传入属性在 attrs（props.value 兜底 attrs）
      const attrsValue = setupCtx.attrs ? setupCtx.attrs.value : undefined
      const value = props.value ?? attrsValue ?? defaultValue
      provide(key, value)
      return () => h(Fragment, null, props.children ?? null)
    },
    use() {
      return inject(key, defaultValue)
    },
  } as Context<any>
  return ctx
}

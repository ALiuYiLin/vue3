import { declare } from '@babel/helper-plugin-utils'
import type { PluginAPI, PluginObject, PluginPass } from '@babel/core'
import { createAutoDefineVisitor } from './auto-define-component.ts'

export interface Options {
  /**
   * Module the `defineComponent` import is taken from.
   * @default 'vue'
   */
  defineComponentSource?: string
}

interface State {
  file?: import('@babel/core').File
}

const plugin: (
  api: PluginAPI,
  options: Options,
  dirname: string,
) => PluginObject<State & PluginPass> = declare<State, Options>(
  (api, options) => {
    api.assertVersion(8)

    const state: State & { usedDefineComponent: boolean; source: string } = {
      usedDefineComponent: false,
      source: options.defineComponentSource || 'vue',
      file: undefined,
    }

    return {
      name: 'babel-plugin-auto-define-component',
      pre(file) {
        state.file = file
        state.usedDefineComponent = false
      },
      visitor: createAutoDefineVisitor(state),
    }
  },
)

export default plugin

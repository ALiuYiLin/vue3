import type { File } from '@babel/core'
import type { Options } from '@vue/babel-plugin-resolve-type'

export type State = {
  get: (name: string) => any
  set: (name: string, value: any) => any
  opts: VueJSXPluginOptions
  file: File
}

export interface VueJSXPluginOptions {
  /** transform `on: { click: xx }` to `onClick: xxx` */
  transformOn?: boolean
  /** merge static and dynamic class / style attributes / onXXX handlers */
  mergeProps?: boolean
  /** configuring custom elements */
  isCustomElement?: (tag: string) => boolean
  /** Replace the function used when compiling JSX expressions */
  pragma?: string
  /**
   * (**Experimental**) Infer component metadata from types (e.g. `props`, `emits`, `name`)
   * @default false
   */
  resolveType?: Options | boolean
}

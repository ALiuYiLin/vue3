import type { Expression, Node, Program, Statement } from '@babel/types'
import type { ParserPlugin } from '@babel/parser'
import type { TypeScope } from './resolveType.ts'

/**
 * Minimal local stand-ins for the compiler-sfc types that
 * `script/resolveType.ts` originally imported. Only the fields actually
 * consumed by the type-resolution / runtime-extraction code are declared.
 */

export interface ImportBinding {
  source: string
  imported: string
  isTypeOnly?: boolean
}

export type FS = {
  fileExists: (file: string) => boolean
  readFile: (file: string) => string | undefined
  realpath?: (path: string) => string
}

export interface SFCScriptCompileOptionsLite {
  globalTypeFiles?: string[]
  fs?: FS
  babelParserPlugins?: ParserPlugin[]
  isProd?: boolean
}

export type PropsDestructureBindings = Record<
  string, // public prop key
  {
    local: string // local identifier, may be different
    default?: Expression
  }
>

export interface ScriptCompileContextLite {
  source: string
  filename: string
  error(msg: string, node: Node, scope?: unknown): never
  warn(msg: string, node: Node): void
  helper(key: string): string
  getString(node: Node | { start: number; end: number }): string
  propsTypeDecl?: Node
  propsRuntimeDefaults?: Expression
  propsDestructuredBindings?: PropsDestructureBindings
  emitsTypeDecl?: Node
  isCE?: boolean
  scope?: TypeScope
  globalScopes?: TypeScope[]
  deps?: Set<string>
  fs?: FS
  ast?: Statement[]
  scriptAst?: Program
  scriptSetupAst?: Program
  startOffset?: number
  userImports?: Record<string, ImportBinding>
  bindingMetadata?: Record<string, string>
  options: SFCScriptCompileOptionsLite
  silentOnExtendsFailure?: boolean
}

/** @see @vue/compiler-core BindingTypes (only the values used here) */
export enum BindingTypes {
  PROPS = 'props',
}

const TS_NODE_TYPES: string[] = [
  'TSAsExpression', // foo as number
  'TSTypeAssertion', // (<number>foo)
  'TSNonNullExpression', // foo!
  'TSInstantiationExpression', // foo<string>
  'TSSatisfiesExpression', // foo satisfies T
]

export function unwrapTSNode(node: Node): Node {
  if (TS_NODE_TYPES.includes(node.type)) {
    return unwrapTSNode((node as any).expression)
  } else {
    return node
  }
}

export const isFunctionType = (node: Node): node is Function & Node => {
  return /Function(?:Expression|Declaration)$|Method$/.test(node.type)
}

/**
 * The original compiler-sfc implementation uses an LRU cache; a plain Map is
 * sufficient for a long-running Babel process.
 */
export function createCache<T extends {}>(_max = 500): Map<string, T> {
  return new Map<string, T>()
}

export function resolveParserPlugins(
  lang: string,
  userPlugins?: ParserPlugin[],
  dts = false,
): ParserPlugin[] {
  const plugins: ParserPlugin[] = []
  // Babel 8: import attributes and explicit resource management are always
  // enabled, so there is no plugin to register for them.
  if (lang === 'jsx' || lang === 'tsx' || lang === 'mtsx') {
    plugins.push('jsx')
  } else if (userPlugins) {
    // If don't match the case of adding jsx
    // should remove the jsx from user options
    userPlugins = userPlugins.filter(p => p !== 'jsx')
  }
  if (
    lang === 'ts' ||
    lang === 'mts' ||
    lang === 'tsx' ||
    lang === 'cts' ||
    lang === 'mtsx'
  ) {
    plugins.push(['typescript', { dts }])
    if (!userPlugins || !userPlugins.includes('decorators')) {
      plugins.push('decorators-legacy')
    }
  }
  if (userPlugins) {
    plugins.push(...userPlugins)
  }
  return plugins
}

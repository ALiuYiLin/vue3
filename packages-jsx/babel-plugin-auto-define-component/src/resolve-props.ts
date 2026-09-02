// ============================================================
// resolve-props — compile-time props extraction (type annotation →
// runtime props declaration), reusing the vendored resolve-type
// machinery (the same extractRuntimeProps used by <script setup>
// defineProps<T> / @vue/babel-plugin-resolve-type).
//
//   function App(props: { step?: number }) { return <JSX/> }
//   const App = (props: CardProps) => <JSX/>
//   function App(props: Props = {}) { ... }             (default param)
//
//   → defineComponent(fn, { props: { step: { type: Number, required: false } } })
//
//   With a runtime props declaration, declared keys land in `props` (setup's
//   first argument) and undeclared ones (class / data-v-* / events / extra
//   attrs) fall through to the root element.
//
//   ⚠️ `children` is always filtered out of the declaration: it is the
//   special props.children channel in this fork and must not be consumed as
//   a regular prop (it would bypass the children special-casing in
//   setFullProps).
//
//   Tolerance: unresolvable annotations (cross-file references, complex
//   generics) → warn and skip injection; the component falls back to the
//   no-declaration semantics (props === attrs) without blocking the build.
// ============================================================

import { parseExpression } from '@babel/parser'
import type { File } from '@babel/core'
import * as t from '@babel/types'
// cross-package relative import (instead of the package specifier) so the
// resolve-type TS sources get bundled when this plugin is loaded by Vite /
// Vitest config loaders — the package specifier would be externalized and
// loaded with Node's TS strip-only mode, which rejects parameter properties
// in resolveType.ts
import { extractRuntimeProps } from '../../babel-plugin-resolve-type/src/extractRuntimeProps.ts'
import type { ScriptCompileContextLite } from '../../babel-plugin-resolve-type/src/types.ts'

/**
 * Extract a runtime `props` declaration object from the component function's
 * first parameter type annotation.
 *
 * @param fn   the component function being wrapped
 * @param file the Babel File (provides source / AST for type resolution)
 * @returns an object expression for `options.props`, or undefined when there
 *          is no annotation or it cannot be resolved
 */
export function resolveComponentProps(
  fn: t.FunctionDeclaration | t.FunctionExpression | t.ArrowFunctionExpression,
  file: File,
): t.ObjectExpression | undefined {
  const first = fn.params[0]

  // no props parameter at all
  if (!first) return undefined

  // default-value parameter (`props = {}`): the annotation lives on `.left`
  let param: t.Node = first
  if (t.isAssignmentPattern(first)) param = first.left

  if (!t.isIdentifier(param) || !param.typeAnnotation) {
    // no type annotation — fall back to collecting `props.xxx` member
    // accesses so wrapped components still receive their props
    return collectPropsAccess(fn)
  }
  const ann = param.typeAnnotation
  if (!t.isTSTypeAnnotation(ann)) return undefined
  // `props: any` / `props: unknown` — nothing to extract; fall back to
  // member-access collection
  if (
    t.isTSAnyKeyword(ann.typeAnnotation) ||
    t.isTSUnknownKeyword(ann.typeAnnotation)
  ) {
    return collectPropsAccess(fn)
  }

  const ctx: ScriptCompileContextLite = {
    filename: file.opts.filename || 'unknown.jsx',
    source: file.code,
    options: {},
    ast: file.ast.program.body,
    isCE: false,
    warn() {},
    error(msg, node) {
      const loc = node?.loc
        ? ` @${node.loc.start.line}:${node.loc.start.column + 1}`
        : ''
      throw new Error(`unresolvable props type: ${msg}${loc}`)
    },
    helper: key => `_${key}`,
    getString: node => file.code.slice(node.start!, node.end!),
    propsTypeDecl: ann.typeAnnotation,
    propsRuntimeDefaults: undefined,
    propsDestructuredBindings: {},
    emitsTypeDecl: undefined,
    silentOnExtendsFailure: true,
  }

  let runtimeProps: string | undefined
  try {
    runtimeProps = extractRuntimeProps(ctx)
  } catch (e) {
    // cross-file / complex types are common and not user errors — warn and
    // fall back to no-declaration semantics
    console.warn(
      `[babel-plugin-auto-define-component] skip props extraction: ${(e as Error).message}`,
    )
    return undefined
  }
  if (!runtimeProps) return undefined

  // filter `children` out of the declaration (special props channel)
  const parsed = parseExpression(runtimeProps) as t.Expression
  if (t.isObjectExpression(parsed)) {
    parsed.properties = parsed.properties.filter(p => {
      if (!t.isObjectProperty(p)) return true
      const key = p.key
      const name = t.isIdentifier(key)
        ? key.name
        : t.isStringLiteral(key)
          ? key.value
          : null
      return name !== 'children'
    })
  }
  return parsed as t.ObjectExpression
}

/**
 * Fallback for components without a type annotation: collect `props.xxx`
 * member accesses (and destructured bindings) from the function body and
 * emit a loose declaration `{ xxx: null }` (null = any type), so the
 * wrapped component still receives its props through setup's first
 * argument. `children` is always excluded (special props channel).
 */
function collectPropsAccess(
  fn: t.FunctionDeclaration | t.FunctionExpression | t.ArrowFunctionExpression,
): t.ObjectExpression | undefined {
  const first = fn.params[0]
  if (!first) return undefined
  let param: t.Node = first
  if (t.isAssignmentPattern(first)) param = first.left

  const keys = new Set<string>()
  const addKey = (name: string | null | undefined) => {
    if (name && name !== 'children') keys.add(name)
  }

  if (t.isIdentifier(param)) {
    const name = param.name
    const visit = (n: any) => {
      if (!n || typeof n !== 'object') return
      if (t.isMemberExpression(n) && !n.computed) {
        if (t.isIdentifier(n.object) && n.object.name === name) {
          addKey(t.isIdentifier(n.property) ? n.property.name : null)
        }
      }
      for (const key of Object.keys(n)) {
        if (
          key === 'loc' ||
          key === 'start' ||
          key === 'end' ||
          key === 'extra' ||
          key === 'comments' ||
          key === 'leadingComments' ||
          key === 'innerComments' ||
          key === 'trailingComments'
        ) {
          continue
        }
        const v = (n as any)[key]
        if (Array.isArray(v)) {
          for (const item of v) visit(item)
        } else if (v && typeof v === 'object') {
          visit(v)
        }
      }
    }
    visit(fn.body)
  } else if (t.isObjectPattern(param)) {
    // destructured props: ({ title }) => ...
    for (const prop of param.properties) {
      if (t.isObjectProperty(prop) && !prop.computed) {
        addKey(t.isIdentifier(prop.key) ? prop.key.name : null)
      } else if (t.isRestElement(prop)) {
        // ({ ...rest }) — cannot know the keys; give up on the fallback
        return undefined
      }
    }
  } else {
    return undefined
  }

  if (!keys.size) return undefined
  return t.objectExpression(
    Array.from(keys).map(key =>
      t.objectProperty(t.identifier(key), t.nullLiteral()),
    ),
  )
}

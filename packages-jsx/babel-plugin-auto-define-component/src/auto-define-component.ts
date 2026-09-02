// ============================================================
// auto-define-component — React-style function components with
// automatic defineComponent wrapping (stateful by default).
//
//   function App(props) { const n = ref(0); return <JSX/> }   (declaration)
//   const App = (props) => <JSX/>                             (arrow, expr body)
//   export default function App() { return <JSX/> }           (default export)
//
//   → const App = defineComponent(function App(props) { ... })
//
//   Component contract (Vue model):
//     function body  = setup    — runs once; refs / lifecycle hooks live here
//     returned JSX   = render   — runs on every render; reactive deps are
//                                 collected here
//   This is the opposite of React ("function body runs on every render"),
//   which is exactly why refs declared in the function body survive updates.
//
//   ⚠️ `return () => <JSX/>` (setup returning a render function, i.e. the
//   explicit Vue style) is an ILLEGAL form here — the compiler throws and
//   asks you to write `return <JSX/>` directly.
//
//   Detection: PascalCase name + JSX in the function body (checked on enter,
//   before the JSX plugin runs; wrapping happens on exit, after JSX has been
//   compiled to _createVNode calls).
//
//   Props: a type annotation on the first parameter is compiled into a
//   runtime `props` option (see resolve-props.ts), so `props.xxx` inside
//   setup works like a declared prop (no attrs fallthrough surprises).
// ============================================================

import * as t from '@babel/types'
import { addNamed } from '@babel/helper-module-imports'
import type { File, NodePath } from '@babel/core'
import { resolveComponentProps } from './resolve-props.ts'

const COMPONENT_RE = /^[A-Z]/

/** Does the node tree contain JSX? (checked before the JSX transform) */
function hasJSX(node: any): boolean {
  let found = false
  const visit = (n: any) => {
    if (found || !n || typeof n !== 'object') return
    if (t.isJSXElement(n) || t.isJSXFragment(n)) {
      found = true
      return
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
  visit(node)
  return found
}

/** Illegal form: setup returning a render function (explicit Vue style) */
const ILLEGAL_RENDER_MSG =
  `Component functions must return JSX directly: \`return <JSX/>\`.\n` +
  `\`return () => <JSX/>\` (setup returning render) is not allowed in this ` +
  `mode — the function body IS the setup, the returned JSX is wrapped into ` +
  `the render function automatically.`

/**
 * If the last return statement of the function body directly returns a VNode
 * (a call, JSX, or a conditional / logical expression containing branches),
 * wrap it into a render function: `return () => <JSX/>`.
 *
 * ⚠️ Only called after the JSX transform (exit phase): the newly created
 * arrow function is not re-visited, so the wrapped expression must already
 * be _createVNode calls.
 */
function ensureRenderReturn(body: t.BlockStatement, path?: NodePath<any>) {
  for (let i = body.body.length - 1; i >= 0; i--) {
    const stmt = body.body[i]
    if (!t.isReturnStatement(stmt) || !stmt.argument) continue
    const arg = stmt.argument
    if (t.isArrowFunctionExpression(arg) || t.isFunctionExpression(arg)) {
      // illegal: setup returning render
      throw (
        path?.buildCodeFrameError(ILLEGAL_RENDER_MSG) ??
        new Error(`[babel-plugin-auto-define-component] ${ILLEGAL_RENDER_MSG}`)
      )
    }
    if (
      t.isCallExpression(arg) ||
      t.isJSXElement(arg) ||
      t.isConditionalExpression(arg) ||
      t.isLogicalExpression(arg)
    ) {
      // JSX is compiled to _createVNode(...) by the time we run (exit phase)
      stmt.argument = t.arrowFunctionExpression([], arg)
      return
    }
    return
  }
}

/**
 * Normalize the component function for use as a defineComponent argument:
 * direct `return <JSX/>` gets wrapped into `return () => <JSX/>` (render),
 * arrow expression bodies (`() => <JSX/>`) become `() => () => <JSX/>`.
 */
export function normalizeSetupFunction(
  fn: t.FunctionExpression | t.ArrowFunctionExpression,
  path?: NodePath<any>,
): void {
  if (t.isArrowFunctionExpression(fn) && !t.isBlockStatement(fn.body)) {
    if (
      t.isArrowFunctionExpression(fn.body) ||
      t.isFunctionExpression(fn.body)
    ) {
      // illegal: () => () => <JSX/> — setup returning render
      throw (
        path?.buildCodeFrameError(ILLEGAL_RENDER_MSG) ??
        new Error(`[babel-plugin-auto-define-component] ${ILLEGAL_RENDER_MSG}`)
      )
    }
    // arrow with expression body (`() => <JSX/>`): wrap once —
    // defineComponent(() => () => <JSX/>)
    fn.body = t.arrowFunctionExpression([], fn.body)
  } else if (t.isArrowFunctionExpression(fn) || t.isFunctionExpression(fn)) {
    ensureRenderReturn(fn.body as t.BlockStatement, path)
  }
}

/** Build the `defineComponent(fn[, options])` call. */
function buildDefineComponentCall(
  importName: t.Identifier,
  fn: t.FunctionDeclaration | t.FunctionExpression | t.ArrowFunctionExpression,
  options?: t.ObjectExpression,
  path?: NodePath<any>,
): t.CallExpression {
  let expr: t.FunctionExpression | t.ArrowFunctionExpression
  if (t.isFunctionDeclaration(fn)) {
    expr = t.functionExpression(
      fn.id,
      fn.params,
      fn.body,
      fn.generator,
      fn.async,
    )
    expr.typeParameters = (fn as any).typeParameters
  } else {
    expr = fn
  }
  normalizeSetupFunction(expr, path)
  const args: t.Expression[] = [expr]
  if (options) args.push(options)
  return t.callExpression(importName, args)
}

/**
 * Compile-time props extraction: a type annotation on the first parameter
 * becomes a runtime `props` declaration (see resolve-props.ts).
 * Unresolvable / missing annotations → undefined (no injection).
 */
function buildOptions(
  state: AutoDefineComponentState,
  fn: t.FunctionDeclaration | t.FunctionExpression | t.ArrowFunctionExpression,
): t.ObjectExpression | undefined {
  if (!state.file) return undefined
  const props = resolveComponentProps(fn, state.file)
  if (!props) return undefined
  return t.objectExpression([t.objectProperty(t.identifier('props'), props)])
}

export interface AutoDefineComponentState {
  usedDefineComponent: boolean
  /** module the defineComponent import is taken from (default 'vue') */
  source: string
  /** Babel File (set in Program.enter, used for props type resolution) */
  file?: File
}

export function createAutoDefineVisitor(state: AutoDefineComponentState) {
  const programOf = (path: NodePath<any>): NodePath<t.Program> | undefined =>
    (path.findParent(p => p.isProgram()) ?? state.file?.path) as
      | NodePath<t.Program>
      | undefined

  return {
    FunctionDeclaration: {
      enter(path: NodePath<t.FunctionDeclaration>): void {
        const id = path.node.id
        if (!id || !COMPONENT_RE.test(id.name)) return
        // `export default function App()` is handled by the
        // ExportDefaultDeclaration visitor — skip it here to avoid
        // replacing the declaration twice
        const parent = path.parentPath
        if (
          parent &&
          parent.isExportDefaultDeclaration() &&
          parent.node.declaration === path.node
        ) {
          return
        }
        if (hasJSX(path.node.body)) {
          path.setData('adcComponent', true)
        }
      },
      exit(path: NodePath<t.FunctionDeclaration>): void {
        if (!path.getData('adcComponent')) return
        const id = path.node.id!
        const program = programOf(path)
        if (!program) return
        const importId = addNamed(program, 'defineComponent', state.source)
        state.usedDefineComponent = true
        path.replaceWith(
          t.variableDeclaration('const', [
            t.variableDeclarator(
              id,
              buildDefineComponentCall(
                importId,
                path.node,
                buildOptions(state, path.node),
                path,
              ),
            ),
          ]),
        )
      },
    },
    VariableDeclarator: {
      enter(path: NodePath<t.VariableDeclarator>): void {
        const id = path.node.id
        if (!t.isIdentifier(id) || !COMPONENT_RE.test(id.name)) return
        const init = path.node.init
        if (!init) return
        // skip code already wrapped in defineComponent
        if (
          t.isCallExpression(init) &&
          t.isIdentifier(init.callee) &&
          init.callee.name === 'defineComponent'
        ) {
          return
        }
        if (
          !t.isFunctionExpression(init) &&
          !t.isArrowFunctionExpression(init)
        ) {
          return
        }
        const body =
          t.isArrowFunctionExpression(init) && !t.isBlockStatement(init.body)
            ? init.body
            : (init as t.FunctionExpression).body
        if (hasJSX(body)) {
          path.setData('adcComponent', true)
        }
      },
      exit(path: NodePath<t.VariableDeclarator>): void {
        if (!path.getData('adcComponent')) return
        const init = path.node.init!
        const program = programOf(path)
        if (!program) return
        const importId = addNamed(program, 'defineComponent', state.source)
        state.usedDefineComponent = true
        path.node.init = buildDefineComponentCall(
          importId,
          init as t.FunctionExpression | t.ArrowFunctionExpression,
          buildOptions(
            state,
            init as t.FunctionExpression | t.ArrowFunctionExpression,
          ),
          path,
        )
      },
    },
    ExportDefaultDeclaration: {
      enter(path: NodePath<t.ExportDefaultDeclaration>): void {
        const decl = path.node.declaration
        if (
          !t.isFunctionDeclaration(decl) &&
          !t.isFunctionExpression(decl) &&
          !t.isArrowFunctionExpression(decl)
        ) {
          return
        }
        const body =
          t.isArrowFunctionExpression(decl) && !t.isBlockStatement(decl.body)
            ? decl.body
            : (decl as t.FunctionDeclaration).body
        if (hasJSX(body)) {
          path.setData('adcComponent', true)
        }
      },
      exit(path: NodePath<t.ExportDefaultDeclaration>): void {
        if (!path.getData('adcComponent')) return
        const decl = path.node.declaration as
          | t.FunctionDeclaration
          | t.FunctionExpression
          | t.ArrowFunctionExpression
        const program = programOf(path)
        if (!program) return
        const importId = addNamed(program, 'defineComponent', state.source)
        state.usedDefineComponent = true
        path.node.declaration = buildDefineComponentCall(
          importId,
          decl,
          buildOptions(state, decl),
          path,
        )
      },
    },
  }
}

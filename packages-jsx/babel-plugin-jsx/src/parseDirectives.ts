import * as t from '@babel/types'
import { createIdentifier } from './utils.ts'
import type { State } from './interface.ts'
import type { NodePath } from '@babel/core'

export type Tag =
  | t.Identifier
  | t.MemberExpression
  | t.StringLiteral
  | t.CallExpression

function parseDirectives(params: {
  name: string
  path: NodePath<t.JSXAttribute>
  value: t.Expression | null
  state: State
  tag: Tag
  isComponent: boolean
}): {
  directiveName: string
  directive: t.Expression[]
} {
  const { path, value, state, tag } = params
  const args: Array<t.Expression | t.NullLiteral> = []

  let directiveName: string
  let directiveArgument: string | undefined
  let directiveModifiers: string[]
  if ('namespace' in path.node.name) {
    directiveName = path.node.name.namespace.name
    directiveArgument = path.node.name.name.name
    directiveModifiers = directiveArgument.split('_').slice(1)
  } else {
    const underscoreModifiers = params.name.split('_')
    directiveName = underscoreModifiers.shift() || ''
    directiveModifiers = underscoreModifiers
  }
  directiveName = directiveName
    .replace(/^v/, '')
    .replace(/^-/, '')
    .replace(/^\S/, (s: string) => s.toLowerCase())

  if (directiveArgument) {
    args.push(t.stringLiteral(directiveArgument.split('_', 1)[0]))
  }

  const modifiers = new Set(directiveModifiers)

  return {
    directiveName,
    directive: [
      resolveDirective(path, state, tag, directiveName),
      value,
      args[0] ||
        (modifiers.size
          ? t.unaryExpression('void', t.numericLiteral(0), true)
          : undefined),
      modifiers.size &&
        t.objectExpression(
          [...modifiers].map(modifier =>
            t.objectProperty(t.identifier(modifier), t.booleanLiteral(true)),
          ),
        ),
    ].filter(Boolean) as t.Expression[],
  }
}

function resolveDirective(
  path: NodePath<t.JSXAttribute>,
  state: State,
  tag: Tag,
  directiveName: string,
) {
  if (directiveName === 'show') {
    return createIdentifier(state, 'vShow')
  }
  const referenceName = `v${directiveName[0].toUpperCase()}${directiveName.slice(1)}`
  if (path.scope.getProgramParent().referencesSet.has(referenceName)) {
    return t.identifier(referenceName)
  }
  return t.callExpression(createIdentifier(state, 'resolveDirective'), [
    t.stringLiteral(directiveName),
  ])
}

export default parseDirectives

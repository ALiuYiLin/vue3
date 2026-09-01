import { addDefault } from '@babel/helper-module-imports'
import * as t from '@babel/types'
import parseDirectives from './parseDirectives.ts'
import {
  checkIsComponent,
  createIdentifier,
  dedupeProperties,
  getJSXAttributeName,
  getTag,
  isDirective,
  transformJSXExpressionContainer,
  transformJSXSpreadAttribute,
  transformJSXSpreadChild,
  transformJSXText,
  transformText,
} from './utils.ts'
import type { State } from './interface.ts'
import type { NodePath, Visitor } from '@babel/core'

const xlinkRE = /^xlink([A-Z])/

function getJSXAttributeValue(
  path: NodePath<t.JSXAttribute>,
  state: State,
): t.StringLiteral | t.Expression | null {
  const valuePath = path.get('value')
  if (valuePath.isJSXElement()) {
    return transformJSXElement(valuePath, state)
  }
  if (valuePath.isStringLiteral()) {
    return t.stringLiteral(transformText(valuePath.node.value))
  }
  if (valuePath.isJSXExpressionContainer()) {
    return transformJSXExpressionContainer(valuePath)
  }

  return null
}

function buildProps(path: NodePath<t.JSXElement>, state: State) {
  const tag = getTag(path, state)
  const isComponent = checkIsComponent(path.get('openingElement'), state)
  const props = path.get('openingElement').get('attributes')
  const directives: t.ArrayExpression[] = []

  if (props.length === 0) {
    return {
      tag,
      isComponent,
      props: t.nullLiteral(),
      directives,
    }
  }

  let properties: t.ObjectProperty[] = []

  const mergeArgs: (t.CallExpression | t.ObjectExpression | t.Identifier)[] = []
  const { mergeProps = true } = state.opts
  props.forEach(prop => {
    if (prop.isJSXAttribute()) {
      let name = getJSXAttributeName(prop)

      const attributeValue = getJSXAttributeValue(prop, state)

      if (state.opts.transformOn && (name === 'on' || name === 'nativeOn')) {
        if (!state.get('transformOn')) {
          state.set(
            'transformOn',
            addDefault(path, '@vue/babel-helper-vue-transform-on', {
              nameHint: '_transformOn',
            }),
          )
        }
        mergeArgs.push(
          t.callExpression(state.get('transformOn'), [
            attributeValue || t.booleanLiteral(true),
          ]),
        )
        return
      }
      if (isDirective(name)) {
        const { directive } = parseDirectives({
          tag,
          isComponent,
          name,
          path: prop,
          state,
          value: attributeValue,
        })
        if (directive) {
          directives.push(t.arrayExpression(directive))
        }
      } else {
        if (xlinkRE.test(name)) {
          name = name.replace(
            xlinkRE,
            (_, firstCharacter) => `xlink:${firstCharacter.toLowerCase()}`,
          )
        }
        properties.push(
          t.objectProperty(
            t.stringLiteral(name),
            attributeValue || t.booleanLiteral(true),
          ),
        )
      }
    } else {
      if (properties.length && mergeProps) {
        mergeArgs.push(
          t.objectExpression(dedupeProperties(properties, mergeProps)),
        )
        properties = []
      }

      // JSXSpreadAttribute
      transformJSXSpreadAttribute(
        path as NodePath,
        prop as NodePath<t.JSXSpreadAttribute>,
        mergeProps,
        mergeProps ? mergeArgs : properties,
      )
    }
  })

  let propsExpression: t.Expression | t.ObjectProperty | t.Literal =
    t.nullLiteral()
  if (mergeArgs.length) {
    if (properties.length) {
      mergeArgs.push(
        t.objectExpression(dedupeProperties(properties, mergeProps)),
      )
    }
    if (mergeArgs.length > 1) {
      propsExpression = t.callExpression(
        createIdentifier(state, 'mergeProps'),
        mergeArgs,
      )
    } else {
      // single no need for a mergeProps call
      propsExpression = mergeArgs[0]
    }
  } else if (properties.length) {
    // single no need for spread
    if (properties.length === 1 && t.isSpreadElement(properties[0])) {
      propsExpression = (properties[0] as unknown as t.SpreadElement).argument
    } else {
      propsExpression = t.objectExpression(
        dedupeProperties(properties, mergeProps),
      )
    }
  }

  return {
    tag,
    props: propsExpression,
    isComponent,
    directives,
  }
}

/**
 * Get children from Array of JSX children
 * @param paths Array<JSXText | JSXExpressionContainer  | JSXElement | JSXFragment>
 * @returns Array<Expression | SpreadElement>
 */
function getChildren(
  paths: NodePath<
    | t.JSXText
    | t.JSXExpressionContainer
    | t.JSXSpreadChild
    | t.JSXElement
    | t.JSXFragment
  >[],
  state: State,
): t.Expression[] {
  return paths
    .map((path: any) => {
      if (path.isJSXText()) {
        const transformedText = transformJSXText(path)
        if (transformedText) {
          return t.callExpression(createIdentifier(state, 'createTextVNode'), [
            transformedText,
          ])
        }
        return transformedText
      }
      if (path.isJSXExpressionContainer()) {
        return transformJSXExpressionContainer(path)
      }
      if (path.isJSXSpreadChild()) {
        return transformJSXSpreadChild(path)
      }
      if (path.isCallExpression()) {
        return (path as NodePath<t.CallExpression>).node
      }
      if (path.isJSXElement()) {
        return transformJSXElement(path, state)
      }
      throw new Error(`getChildren: ${path.type} is not supported`)
    })
    .filter(
      ((value: any) => value != null && !t.isJSXEmptyExpression(value)) as any,
    ) as t.Expression[]
}

function transformJSXElement(
  path: NodePath<t.JSXElement>,
  state: State,
): t.CallExpression {
  const children = getChildren(path.get('children'), state)
  const { tag, props, directives } = buildProps(path, state)

  // children are passed through as-is: the runtime normalizes them into
  // `props.children` (string | VNode | VNode[] | (() => any))
  let VNodeChild: t.Expression | null = null

  if (children.length > 1) {
    VNodeChild = t.arrayExpression(children)
  } else if (children.length === 1) {
    // a single spread child must stay inside an array literal
    VNodeChild = t.isSpreadElement(children[0])
      ? t.arrayExpression(children)
      : children[0]
  }

  const createVNode = t.callExpression(createIdentifier(state, 'createVNode'), [
    tag,
    props,
    VNodeChild || t.nullLiteral(),
  ])

  if (!directives.length) {
    return createVNode
  }

  return t.callExpression(createIdentifier(state, 'withDirectives'), [
    createVNode,
    t.arrayExpression(directives),
  ])
}

const visitor: Visitor<State> = {
  JSXElement: {
    exit(path, state) {
      path.replaceWith(transformJSXElement(path, state))
    },
  },
}

export default visitor

import { addNamed, addNamespace, isModule } from '@babel/helper-module-imports'
import { declare } from '@babel/helper-plugin-utils'
import syntaxJsx from '@babel/plugin-syntax-jsx'
import * as t from '@babel/types'
import ResolveType from '@vue/babel-plugin-resolve-type'
import sugarFragment from './sugar-fragment.ts'
import transformVueJSX from './transform-vue-jsx.ts'
import type { State, VueJSXPluginOptions } from './interface.ts'
import type {
  NodePath,
  PluginAPI,
  PluginObject,
  PluginPass,
  Visitor,
} from '@babel/core'

export type { VueJSXPluginOptions }

function hasJSX(parentPath: NodePath<t.Program>) {
  return t.traverseFast(parentPath.node, node => {
    if (t.isJSXElement(node) || t.isJSXFragment(node)) {
      return t.traverseFast.stop
    }
  })
}

const JSX_ANNOTATION_REGEX = /\*?\s*@jsx\s+(\S+)/

const plugin: (
  api: PluginAPI,
  options: VueJSXPluginOptions,
  dirname: string,
) => PluginObject<State & PluginPass> = declare<State, VueJSXPluginOptions>(
  (api, opt, dirname) => {
    const { types } = api
    let resolveType: PluginObject<PluginPass> | undefined
    if (opt.resolveType) {
      if (typeof opt.resolveType === 'boolean') opt.resolveType = {}
      resolveType = ResolveType(api, opt.resolveType, dirname)
    }
    return {
      ...resolveType,
      name: 'babel-plugin-jsx',
      inherits: syntaxJsx,
      // eslint-disable-next-line @typescript-eslint/consistent-type-assertions
      visitor: {
        ...resolveType?.visitor,
        ...transformVueJSX,
        ...sugarFragment,
        Program: {
          enter(path, state) {
            if (hasJSX(path)) {
              const importNames = [
                'createVNode',
                'Fragment',
                'resolveComponent',
                'withDirectives',
                'vShow',
                'resolveDirective',
                'mergeProps',
                'createTextVNode',
                'isVNode',
              ]
              if (isModule(path)) {
                // import { createVNode } from "vue";
                const importMap: Record<
                  string,
                  t.MemberExpression | t.Identifier
                > = {}
                importNames.forEach(name => {
                  state.set(name, () => {
                    if (importMap[name]) {
                      return types.cloneNode(importMap[name])
                    }
                    const identifier = addNamed(path, name, 'vue', {
                      ensureLiveReference: true,
                    })
                    importMap[name] = identifier
                    return identifier
                  })
                })
              } else {
                // var _vue = require('vue');
                let sourceName: t.Identifier
                importNames.forEach(name => {
                  state.set(name, () => {
                    if (!sourceName) {
                      sourceName = addNamespace(path, 'vue', {
                        ensureLiveReference: true,
                      }) as t.Identifier
                    }
                    return t.memberExpression(sourceName, t.identifier(name))
                  })
                })
              }
            }

            const {
              opts: { pragma = '' },
              file,
            } = state

            if (pragma) {
              state.set('createVNode', () => t.identifier(pragma))
            }

            if (file.ast.comments) {
              for (const comment of file.ast.comments) {
                const jsxMatches = JSX_ANNOTATION_REGEX.exec(comment.value)
                if (jsxMatches) {
                  state.set('createVNode', () => t.identifier(jsxMatches[1]))
                }
              }
            }
          },
        },
      } as Visitor<State>,
    }
  },
)

export default plugin
export { plugin as 'module.exports' }

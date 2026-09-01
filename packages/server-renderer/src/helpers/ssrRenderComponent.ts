import {
  type Component,
  type ComponentInternalInstance,
  createVNode,
} from 'vue'
import { type Props, type SSRBuffer, renderComponentVNode } from '../render'

export function ssrRenderComponent(
  comp: Component,
  props: Props | null = null,
  children: unknown = null,
  parentComponent: ComponentInternalInstance | null = null,
  slotScopeId?: string,
): SSRBuffer | Promise<SSRBuffer> {
  return renderComponentVNode(
    createVNode(comp, props, children),
    parentComponent,
    slotScopeId,
  )
}

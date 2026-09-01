/**
 * Suspense types & utilities.
 *
 * The <Suspense> component itself has been removed from this build, so no
 * suspense boundary is ever created and `parentSuspense` is always null at
 * runtime. The types are kept to avoid churning every renderer signature;
 * they may be removed together with the remaining `parentSuspense` plumbing.
 */
import type { VNode } from './vnode'
import type { ComponentInternalInstance } from './component'
import type {
  ElementNamespace,
  MoveType,
  RendererElement,
  RendererNode,
  SetupRenderEffectFn,
} from './renderer'
import { queuePostFlushCb } from './scheduler'

export interface SuspenseBoundary {
  vnode: VNode<RendererNode, RendererElement>
  parent: SuspenseBoundary | null
  parentComponent: ComponentInternalInstance | null
  namespace: ElementNamespace
  container: RendererElement
  hiddenContainer: RendererElement
  activeBranch: VNode | null
  isFallbackMountPending: boolean
  pendingBranch: VNode | null
  deps: number
  pendingId: number
  timeout: number
  isInFallback: boolean
  isHydrating: boolean
  isUnmounted: boolean
  effects: Function[]
  resolve(force?: boolean, sync?: boolean): void
  fallback(fallbackVNode: VNode): void
  move(
    container: RendererElement,
    anchor: RendererNode | null,
    type: MoveType,
  ): void
  next(): RendererNode | null
  registerDep(
    instance: ComponentInternalInstance,
    setupRenderEffect: SetupRenderEffectFn,
  ): void
  unmount(parentSuspense: SuspenseBoundary | null, doRemove?: boolean): void
}

export function queueEffectWithSuspense(
  fn: Function | Function[],
  suspense: SuspenseBoundary | null,
): void {
  // no suspense boundaries exist in this build; just queue as a post-flush cb
  queuePostFlushCb(fn)
}

export function isSuspense(type: any): boolean {
  return type && type.__isSuspense === true
}

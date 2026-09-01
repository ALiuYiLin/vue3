/**
 * Transition types & utilities.
 *
 * The <Transition> component itself has been removed from this build, so no
 * transition hooks are ever attached at runtime. The types are kept to avoid
 * churning every renderer signature; they may be removed together with the
 * remaining `transition` plumbing.
 */
import type { VNode } from './vnode'
import type { RendererElement } from './renderer'

export interface TransitionHooks<HostElement = RendererElement> {
  mode: 'out-in' | 'in-out' | 'default' | undefined
  persisted: boolean
  beforeEnter(el: HostElement): void
  enter(el: HostElement): void
  leave(el: HostElement, remove: () => void): void
  clone(vnode: VNode): TransitionHooks<HostElement>
  // optional
  afterLeave?(): void
  delayLeave?(
    el: HostElement,
    earlyRemove: () => void,
    delayedLeave: () => void,
  ): void
  delayedLeave?(): void
}

export type PendingCallback = (cancelled?: boolean) => void

export const leaveCbKey: unique symbol = Symbol('_leaveCb')

export interface TransitionElement {
  [leaveCbKey]?: PendingCallback
}

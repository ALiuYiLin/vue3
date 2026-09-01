import type { Props, PushFn } from '../render'

// Slots are removed from this fork: components receive children via
// `props.children` instead. These helpers are kept only because
// compiler-ssr generated code may still reference them; they render the
// fallback content directly.

export type SSRSlots = Record<string, never>
export type SSRSlot = never

export function ssrRenderSlot(
  _slots: unknown,
  _slotName: string,
  _slotProps: Props,
  fallbackRenderFn: (() => void) | null,
  push: PushFn,
  _parentComponent: unknown,
  _slotScopeId?: string,
): void {
  // template-compiled slots are always rendered as fragments
  push(`<!--[-->`)
  if (fallbackRenderFn) fallbackRenderFn()
  push(`<!--]-->`)
}

export function ssrRenderSlotInner(
  _slots: unknown,
  _slotName: string,
  _slotProps: Props,
  fallbackRenderFn: (() => void) | null,
  push: PushFn,
  _parentComponent: unknown,
  _slotScopeId?: string,
  _transition?: boolean,
): void {
  if (fallbackRenderFn) fallbackRenderFn()
}

// This entry is the runtime-only build: template compilation is not
// supported in this fork (no compiler / SFC packages are shipped).
import { initDev } from './dev'

if (__DEV__) {
  initDev()
}

export * from '@vue/runtime-dom'

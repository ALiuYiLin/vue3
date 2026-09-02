import { defineConfig } from 'vite'
import babel from '@rolldown/plugin-babel'
import AutoDefine from '../../packages-jsx/babel-plugin-auto-define-component/src/index.ts'
import Jsx from '../../packages-jsx/babel-plugin-jsx/src/index.ts'
import { entries } from '../../scripts/aliases.js'

const flags = {
  // build-time feature flags consumed by the runtime sources
  __DEV__: 'true',
  __TEST__: 'false',
  __VERSION__: '"0.0.0"',
  __BROWSER__: 'true',
  __GLOBAL__: 'false',
  __ESM_BUNDLER__: 'true',
  __ESM_BROWSER__: 'false',
  __CJS__: 'false',
  __SSR__: 'false',
  __FEATURE_OPTIONS_API__: 'true',
  __FEATURE_SUSPENSE__: 'true',
  __FEATURE_PROD_DEVTOOLS__: 'false',
  __FEATURE_PROD_HYDRATION_MISMATCH_DETAILS__: 'false',
}

export default defineConfig({
  define: flags,
  resolve: {
    // point every @vue/* import at the workspace TS sources
    alias: entries,
  },
  esbuild: {
    // let @rolldown/plugin-babel handle .tsx / .jsx files
    jsx: 'preserve',
    // rolldown-vite applies esbuild.define to every transformed module,
    // including ones reached through /@fs URLs
    define: flags,
  },
  plugins: [
    babel({
      babelrc: false,
      configFile: false,
      plugins: [
        Jsx,
        // React-style function components become stateful
        // defineComponent wrappers automatically
        AutoDefine,
      ],
      include: /\.[jt]sx$/,
    }),
  ],
})

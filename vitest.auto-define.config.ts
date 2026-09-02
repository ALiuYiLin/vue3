import { entries } from './scripts/aliases.js'
import babel from '@rolldown/plugin-babel'
import { defineConfig } from 'vitest/config'
import AutoDefine from './packages-jsx/babel-plugin-auto-define-component/src/index.ts'
import Jsx from './packages-jsx/babel-plugin-jsx/src/index.ts'

export default defineConfig({
  define: {
    __DEV__: true,
    __TEST__: true,
    __VERSION__: '"test"',
    __BROWSER__: false,
    __GLOBAL__: false,
    __ESM_BUNDLER__: true,
    __ESM_BROWSER__: false,
    __CJS__: true,
    __SSR__: true,
    __FEATURE_OPTIONS_API__: true,
    __FEATURE_SUSPENSE__: true,
    __FEATURE_PROD_DEVTOOLS__: false,
    __FEATURE_PROD_HYDRATION_MISMATCH_DETAILS__: false,
  },
  oxc: {
    jsx: 'preserve',
  },
  resolve: {
    // test against the workspace runtime source instead of the published vue
    alias: entries,
    // resolve `vue-jsx-source` export condition of packages-jsx workspace packages
    conditions: ['vue-jsx-source'],
  },
  plugins: [
    babel({
      include: [/\.[jt]sx$/],
      plugins: [
        [
          Jsx,
          {
            isCustomElement: (tag: string) => tag.startsWith('x-'),
          },
        ],
        [AutoDefine, {}],
      ],
    }),
  ],
  test: {
    globals: true,
    environment: 'jsdom',
    include: [
      'packages-jsx/babel-plugin-auto-define-component/test/*.{test,spec}.{ts,tsx}',
    ],
  },
})

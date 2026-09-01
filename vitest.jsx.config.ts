import babel from '@rolldown/plugin-babel'
import { defineConfig } from 'vitest/config'
import Jsx from './packages-jsx/babel-plugin-jsx/src/index.ts'

export default defineConfig({
  oxc: {
    jsx: 'preserve',
  },
  resolve: {
    // resolve `vue-jsx-source` export condition of workspace packages
    conditions: ['vue-jsx-source'],
  },
  plugins: [
    babel({
      include: [/\.[jt]sx$/],
      plugins: [
        [
          Jsx,
          {
            optimize: true,
            isCustomElement: (tag: string) => tag.startsWith('x-'),
          },
        ],
      ],
    }),
  ],
  test: {
    globals: true,
    environment: 'jsdom',
    include: ['packages-jsx/**/*.{test,spec}.{ts,tsx}'],
  },
})

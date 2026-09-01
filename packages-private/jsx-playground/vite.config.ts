import { defineConfig } from 'vite'
import babel from '@rolldown/plugin-babel'
import Jsx from '@vue/babel-plugin-jsx'
import { entries } from '../../scripts/aliases.js'

export default defineConfig({
  resolve: {
    // point every @vue/* import at the workspace TS sources
    alias: entries,
  },
  esbuild: {
    // let @rolldown/plugin-babel handle .tsx / .jsx files
    jsx: 'preserve',
  },
  plugins: [
    babel({
      babelrc: false,
      configFile: false,
      plugins: [Jsx],
      include: /\.[jt]sx$/,
    }),
  ],
})

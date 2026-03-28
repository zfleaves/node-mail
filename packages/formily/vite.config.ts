import { defineConfig } from 'vite'
import dts from 'vite-plugin-dts'
import { resolve } from 'path'

export default defineConfig({
  plugins: [
    dts({
      tsconfigPath: './tsconfig.json',
      rollupTypes: true
    })
  ],
  build: {
    lib: {
      entry: resolve(__dirname, 'src/index.ts'),
      name: 'Formily',
      fileName: (format) => `index.${format}.js`
    },
    rollupOptions: {
      external: ['vue', '@formily/core', '@formily/vue'],
      output: {
        globals: {
          vue: 'Vue',
          '@formily/core': 'FormilyCore',
          '@formily/vue': 'FormilyVue'
        }
      }
    }
  }
})
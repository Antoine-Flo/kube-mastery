import { defineConfig } from 'astro/config'
import { fileURLToPath } from 'node:url'
import remarkCalloutColons from './src/plugins/remark-callout-colons.js'
import remarkBeautifulMermaidBlocks from './src/plugins/remark-beautiful-mermaid-blocks.js'

import cloudflare from '@astrojs/cloudflare'

import astroExpressiveCode from 'astro-expressive-code'

export default defineConfig({
  site: 'https://kubemastery.com',

  markdown: {
    remarkPlugins: [remarkCalloutColons, remarkBeautifulMermaidBlocks]
  },

  integrations: [
    astroExpressiveCode({
      themes: ['one-dark-pro', 'one-light']
    })
  ],

  vite: {
    resolve: {
      alias: { '~': fileURLToPath(new URL('./src', import.meta.url)) }
    },
    css: {
      transformer: 'lightningcss'
    },
    build: {
      cssMinify: 'lightningcss'
    },
    optimizeDeps: {
      include: [
        '@codemirror/state',
        '@codemirror/view',
        '@codemirror/commands',
        '@codemirror/language',
        '@codemirror/lang-yaml',
        '@codemirror/theme-one-dark',
        '@xterm/xterm',
        '@xterm/addon-fit'
      ]
    }
  },

  output: 'server',

  redirects: {
    '/': '/en',
    '/terms-of-service': '/en/terms-of-service',
    '/privacy-policy': '/en/privacy-policy',
    '/courses': '/en/courses'
  },

  adapter: cloudflare()
})

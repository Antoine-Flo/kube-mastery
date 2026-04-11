import { defineConfig } from 'astro/config'
import { fileURLToPath } from 'node:url'
import remarkCalloutColons from './src/plugins/remark-callout-colons.js'
import remarkBeautifulMermaidBlocks from './src/plugins/remark-beautiful-mermaid-blocks.js'
import remarkQuizBlocks from './src/plugins/remark-quiz-blocks.js'
import remarkDrillSolutionBlocks from './src/plugins/remark-drill-solution-blocks.js'

import cloudflare from '@astrojs/cloudflare'

import astroExpressiveCode from 'astro-expressive-code'

export default defineConfig({
  site: 'https://kubemastery.com',

  // Inline Astro-scoped CSS into HTML (fewer blocking stylesheet requests; larger HTML per response).
  build: {
    inlineStylesheets: 'always'
  },

  experimental: {
    queuedRendering: {
      enabled: true
    }
  },

  markdown: {
    remarkPlugins: [
      remarkCalloutColons,
      remarkQuizBlocks,
      remarkDrillSolutionBlocks,
      remarkBeautifulMermaidBlocks
    ]
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
    build: {
      // Merge Vite CSS chunks into one file when a separate asset is still emitted (e.g. integrations).
      cssCodeSplit: false,
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
    '/courses': '/en/courses',
  },

  adapter: cloudflare()
})

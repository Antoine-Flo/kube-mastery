import { defineConfig } from 'astro/config'
import { fileURLToPath } from 'node:url'
import mermaid from 'astro-mermaid'
import sitemap from '@astrojs/sitemap'
import remarkCalloutColons from './src/plugins/remark-callout-colons.js'

import cloudflare from '@astrojs/cloudflare'

import astroExpressiveCode from 'astro-expressive-code'

export default defineConfig({
  site: 'https://kubemastery.com',

  markdown: {
    remarkPlugins: [remarkCalloutColons]
  },

  integrations: [
    mermaid({
      theme: 'dark',
      autoTheme: true
    }),
    sitemap(),
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

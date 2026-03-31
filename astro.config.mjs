import { defineConfig } from 'astro/config'
import { fileURLToPath } from 'node:url'
import mermaid from 'astro-mermaid'
import remarkCalloutColons from './src/plugins/remark-callout-colons.js'

import cloudflare from '@astrojs/cloudflare'

import astroExpressiveCode from 'astro-expressive-code'

import indexnow from 'astro-indexnow'

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
    astroExpressiveCode({
      themes: ['one-dark-pro', 'one-light']
    }),
    indexnow({
      key: '07487d75a5674a3fa5000bfe5ba20486'
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
    '/courses': '/en/courses',
    '/blog': '/en/news',
    '/en/blog': '/en/news',
    '/fr/blog': '/fr/news'
  },

  adapter: cloudflare()
})

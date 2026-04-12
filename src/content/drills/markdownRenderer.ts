import { createMarkdownProcessor, type MarkdownProcessor } from '@astrojs/markdown-remark'
import rehypeExpressiveCode from 'rehype-expressive-code'
import remarkCalloutColons from '../../plugins/remark-callout-colons.js'
import remarkBeautifulMermaidBlocks from '../../plugins/remark-beautiful-mermaid-blocks.js'
import remarkQuizBlocks from '../../plugins/remark-quiz-blocks.js'

let markdownProcessorPromise: Promise<MarkdownProcessor> | null = null

async function getMarkdownProcessor(): Promise<MarkdownProcessor> {
  if (!markdownProcessorPromise) {
    markdownProcessorPromise = createMarkdownProcessor({
      syntaxHighlight: false,
      remarkPlugins: [
        remarkCalloutColons,
        remarkQuizBlocks,
        remarkBeautifulMermaidBlocks
      ],
      rehypePlugins: [
        [rehypeExpressiveCode as any, {
          themes: ['one-dark-pro', 'one-light'],
          frames: false,
          shiki: {
            engine: 'javascript',
            bundledLangs: ['bash', 'yaml', 'json', 'plaintext'],
            langAlias: {
              sh: 'bash',
              shell: 'bash',
              yml: 'yaml',
              text: 'plaintext',
              console: 'plaintext'
            }
          }
        }]
      ]
    })
  }
  return markdownProcessorPromise
}

export async function renderDrillMarkdown(markdown: string): Promise<string> {
  const processor = await getMarkdownProcessor()
  const rendered = await processor.render(markdown)
  return rendered.code
}

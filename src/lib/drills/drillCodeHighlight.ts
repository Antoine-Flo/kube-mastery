import { createHighlighterCore } from '@shikijs/core'
import { createJavaScriptRegexEngine } from '@shikijs/engine-javascript'
import bash from '@shikijs/langs/bash'
import yaml from '@shikijs/langs/yaml'
import oneDarkPro from '@shikijs/themes/one-dark-pro'
import type { DrillSolutionCodeLang } from '../../content/drills/types'

let highlighterPromise: Promise<Awaited<ReturnType<typeof createHighlighterCore>>> | null = null

async function getDrillHighlighter() {
  if (highlighterPromise === null) {
    highlighterPromise = createHighlighterCore({
      engine: createJavaScriptRegexEngine(),
      langs: [bash, yaml],
      themes: [oneDarkPro]
    })
  }

  return highlighterPromise
}

export async function renderDrillCodeBlock(
  code: string,
  lang: DrillSolutionCodeLang
): Promise<string> {
  const highlighter = await getDrillHighlighter()

  return highlighter.codeToHtml(code, {
    lang,
    theme: 'one-dark-pro'
  })
}

/** Strip numeric prefix from folder name: "01-onboarding" -> "onboarding" */
export function stripNumericPrefix(name: string): string {
  return name.replace(/^\d+-/, '')
}

/**
 * Topic folder names starting with "_" are omitted from outlines, lesson counts,
 * and sitemap (local draft; files stay in the repo).
 */
export function isHiddenTopicDir(topicDir: string): boolean {
  return topicDir.startsWith('_')
}

/** Parse first H1 from markdown content: "# Title" -> "Title" */
export function parseH1(content: string): string {
  const line = content.split('\n').find((l) => l.startsWith('#'))
  if (!line) {
    return ''
  }
  return line.replace(/^#\s*/, '').trim()
}

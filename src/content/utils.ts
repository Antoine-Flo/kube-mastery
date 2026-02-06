/** Strip numeric prefix from folder name: "01-onboarding" -> "onboarding" */
export function stripNumericPrefix(name: string): string {
  return name.replace(/^\d+-/, '')
}

/** Parse first H1 from markdown content: "# Title" -> "Title" */
export function parseH1(content: string): string {
  const line = content.split('\n').find((l) => l.startsWith('#'))
  if (!line) {
    return ''
  }
  return line.replace(/^#\s*/, '').trim()
}

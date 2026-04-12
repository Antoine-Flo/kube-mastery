/** Turns `x` into <code>, escapes all text. Trailing ` without pair is literal. */
export function inlineBackticksToHtml(s: string): string {
  let out = ''
  let i = 0
  while (i < s.length) {
    const open = s.indexOf('`', i)
    if (open === -1) {
      out += escapeHtml(s.slice(i))
      break
    }
    out += escapeHtml(s.slice(i, open))
    const close = s.indexOf('`', open + 1)
    if (close === -1) {
      out += escapeHtml(s.slice(open))
      break
    }
    out += `<code>${escapeHtml(s.slice(open + 1, close))}</code>`
    i = close + 1
  }
  return out
}

function escapeHtml(t: string): string {
  return t
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
}

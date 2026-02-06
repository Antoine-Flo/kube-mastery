// ═══════════════════════════════════════════════════════════════════════════
// QUIZ - Your practice environment (kubectl + cluster)
// ═══════════════════════════════════════════════════════════════════════════

import type { Quiz } from '~/types/quiz'

export const quiz: Quiz = {
  questions: [
    {
      id: 'q1',
      type: 'terminal-command',
      question: 'Create a new file called "test.txt"',
      expectedCommand: 'touch test.txt',
      validationMode: 'contains',
      normalizeCommand: true,
      hint: 'Type "touch test.txt" in the terminal on the right side of the screen.'
    }
  ]
}

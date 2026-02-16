// ═══════════════════════════════════════════════════════════════════════════
// QUIZ - runAsUser and runAsNonRoot
// ═══════════════════════════════════════════════════════════════════════════

import type { Quiz } from '~/types/quiz'

export const quiz: Quiz = {
  questions: [
    {
      id: 'q1',
      type: 'multiple-choice',
      question: 'What UID represents root in Linux?',
      options: [
        '1',
        '0',
        '1000',
        '65534'
      ],
      correctAnswer: 1
    },
    {
      id: 'q2',
      type: 'multiple-choice',
      question: 'What does runAsNonRoot: true do?',
      options: [
        'Forces the container to run as UID 0',
        'Rejects the Pod if it would run as root',
        'Creates a new user in /etc/passwd',
        'Disables root in the container'
      ],
      correctAnswer: 1
    }
  ]
}

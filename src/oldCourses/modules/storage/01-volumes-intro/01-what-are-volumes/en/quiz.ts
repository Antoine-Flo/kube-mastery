// ═══════════════════════════════════════════════════════════════════════════
// QUIZ - What are Volumes?
// ═══════════════════════════════════════════════════════════════════════════

import type { Quiz } from '~/types/quiz'

export const quiz: Quiz = {
  questions: [
    {
      id: 'q1',
      type: 'multiple-choice',
      question: 'At which level are Volumes defined in Kubernetes?',
      options: [
        'Container level',
        'Pod level',
        'Namespace level',
        'Node level'
      ],
      correctAnswer: 1
    },
    {
      id: 'q2',
      type: 'multiple-choice',
      question:
        'What happens to container filesystem data when a container restarts?',
      options: [
        'It is preserved in a temporary cache',
        'It is lost (ephemeral)',
        'It is backed up automatically',
        'It is migrated to a new container'
      ],
      correctAnswer: 1
    }
  ]
}

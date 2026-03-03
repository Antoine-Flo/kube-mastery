// ═══════════════════════════════════════════════════════════════════════════
// QUIZ - Container and Code Security
// ═══════════════════════════════════════════════════════════════════════════

import type { Quiz } from '~/types/quiz'

export const quiz: Quiz = {
  questions: [
    {
      id: 'q1',
      type: 'multiple-choice',
      question: 'What does runAsNonRoot: true in a Pod securityContext do?',
      options: [
        'Forces the container to run as root',
        'Prevents the container from running as root',
        'Creates a new user for the container',
        'Disables user namespace'
      ],
      correctAnswer: 1
    },
    {
      id: 'q2',
      type: 'multiple-choice',
      question:
        'Why should you avoid using the latest tag for container images?',
      options: [
        'It is slower to pull',
        'It makes deployments less reproducible and can introduce unexpected changes',
        'It is not supported by Kubernetes',
        'It uses more storage'
      ],
      correctAnswer: 1
    }
  ]
}

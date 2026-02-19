// ═══════════════════════════════════════════════════════════════════════════
// QUIZ - The Kubernetes API
// ═══════════════════════════════════════════════════════════════════════════

import type { Quiz } from '~/types/quiz'

export const quiz: Quiz = {
  questions: [
    {
      id: 'q1',
      type: 'multiple-choice',
      question:
        'What is the core component that exposes the Kubernetes HTTP API?',
      options: ['kubelet', 'kube-apiserver', 'etcd', 'kube-scheduler'],
      correctAnswer: 1
    },
    {
      id: 'q2',
      type: 'multiple-choice',
      question:
        'Which tool is commonly used to interact with the Kubernetes API?',
      options: ['docker', 'kubectl', 'kubeadm', 'containerd'],
      correctAnswer: 1
    }
  ]
}

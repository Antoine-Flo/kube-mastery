// ═══════════════════════════════════════════════════════════════════════════
// QUIZ - L'API Kubernetes
// ═══════════════════════════════════════════════════════════════════════════

import type { Quiz } from '~/types/quiz';

export const quiz: Quiz = {
  questions: [
    {
      id: 'q1',
      type: 'multiple-choice',
      question: 'Quel est le composant central qui expose l\'API HTTP de Kubernetes ?',
      options: [
        'kubelet',
        'kube-apiserver',
        'etcd',
        'kube-scheduler',
      ],
      correctAnswer: 1,
    },
    {
      id: 'q2',
      type: 'multiple-choice',
      question: 'Quel outil est couramment utilisé pour interagir avec l\'API Kubernetes ?',
      options: [
        'docker',
        'kubectl',
        'kubeadm',
        'containerd',
      ],
      correctAnswer: 1,
    },
  ],
};

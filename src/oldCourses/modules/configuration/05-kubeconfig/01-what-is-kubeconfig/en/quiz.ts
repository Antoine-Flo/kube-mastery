import type { Quiz } from '~/types/quiz'

export const quiz: Quiz = {
  questions: [
    {
      id: 'q1',
      type: 'multiple-choice',
      question: 'What does a kubeconfig file store?',
      options: [
        'Only Deployment manifests',
        'Cluster endpoints, users, and contexts',
        'Only container images',
        'Node operating system settings'
      ],
      correctAnswer: 1
    },
    {
      id: 'q2',
      type: 'multiple-choice',
      question: 'What is the default kubeconfig path used by kubectl?',
      options: [
        '/etc/kubernetes/kubeconfig',
        '~/.kube/config',
        '/var/lib/kubelet/config',
        './kubeconfig.yaml'
      ],
      correctAnswer: 1
    }
  ]
}

import type { Quiz } from '~/types/quiz'

export const quiz: Quiz = {
  questions: [
    {
      id: 'q1',
      type: 'multiple-choice',
      question: 'Which command is commonly used to read logs from a Pod?',
      options: [
        'kubectl logs <pod-name>',
        'kubectl describe logs <pod-name>',
        'kubectl get logs <pod-name>',
        'kubectl show logs <pod-name>'
      ],
      correctAnswer: 0
    },
    {
      id: 'q2',
      type: 'multiple-choice',
      question:
        'Where does Kubernetes expect container logs to be written by default?',
      options: [
        'A custom NFS share',
        'Standard output and standard error',
        '/var/log/app.log only',
        'The API server audit log'
      ],
      correctAnswer: 1
    }
  ]
}

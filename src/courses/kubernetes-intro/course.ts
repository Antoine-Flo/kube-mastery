import type { LocalCourse } from '../types';

export const course: LocalCourse = {
    title: {
        en: 'Kubernetes Essentials',
        fr: 'Essentiels Kubernetes',
    },
    shortDescription: {
        en: 'Learn the fundamentals of Kubernetes in 1-2 hours. Master kubectl, Pods, Deployments, Services, and ConfigMaps through hands-on exercises.',
        fr: 'Apprenez les fondamentaux de Kubernetes en 1-2 heures. Maîtrisez kubectl, Pods, Deployments, Services et ConfigMaps grâce à des exercices pratiques.',
    },
    description: {
        en: 'Get started with Kubernetes in 1-2 hours. This comprehensive introduction course will teach you the fundamentals of container orchestration with Kubernetes.\n\n**What you\'ll learn:**\nYou\'ll learn how to use kubectl to interact with your cluster, understand core concepts like Pods (the smallest deployable units), Deployments (for managing application updates), Services (for networking and load balancing), and ConfigMaps (for configuration management).\n\n**Hands-on practice:**\nThrough hands-on exercises in a real Kubernetes environment, you\'ll gain practical experience deploying and managing containerized applications.\n\nPerfect for developers and DevOps engineers who want to master the basics of Kubernetes.',
        fr: 'Démarrez avec Kubernetes en 1-2 heures. Ce cours d\'introduction complet vous enseignera les fondamentaux de l\'orchestration de conteneurs avec Kubernetes.\n\n**Ce que vous apprendrez :**\nVous apprendrez à utiliser kubectl pour interagir avec votre cluster, comprendre les concepts essentiels comme les Pods (les plus petites unités déployables), les Deployments (pour gérer les mises à jour d\'applications), les Services (pour le networking et la répartition de charge), et les ConfigMaps (pour la gestion de configuration).\n\n**Pratique concrète :**\nGrâce à des exercices pratiques dans un environnement Kubernetes réel, vous acquerrez une expérience concrète du déploiement et de la gestion d\'applications conteneurisées.\n\nParfait pour les développeurs et ingénieurs DevOps qui souhaitent maîtriser les bases de Kubernetes.',
    },
    isActive: true,
    price: 0,
    isFree: true,
    comingSoon: false,
    order: 1,
    level: {
        en: 'Beginner',
        fr: 'Débutant',
    },
};


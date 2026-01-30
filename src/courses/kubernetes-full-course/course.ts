import type { LocalCourse } from '../types';

export const course: LocalCourse = {
    title: {
        en: 'Kubernetes Complete Course',
        fr: 'Formation complète Kubernetes',
    },
    shortDescription: {
        en: 'Master Kubernetes from A to Z with 95 comprehensive chapters covering all essential concepts.',
        fr: 'Maîtrisez Kubernetes de A à Z avec 95 chapitres complets couvrant tous les concepts essentiels.',
    },
    description: {
        en: 'A comprehensive Kubernetes course covering everything from fundamentals to advanced topics. This 95-chapter course is designed for developers and operators who want a deep understanding of Kubernetes.\n\n**What you\'ll learn:**\n- **Foundations**: Overview, architecture, API concepts, namespaces, labels, annotations\n- **Containers & Pods**: Images, lifecycle, multi-container patterns, QoS\n- **Workloads**: Deployments, StatefulSets, DaemonSets, Jobs, CronJobs, autoscaling\n- **Networking**: Services, DNS, Ingress, Gateway API, Network Policies\n- **Storage**: Volumes, PV/PVC, StorageClasses, CSI\n- **Configuration**: ConfigMaps, Secrets, resource management, probes\n- **Security**: RBAC, ServiceAccounts, Pod Security Standards, Linux security\n- **Operations**: Policies, observability, certificates, admission webhooks\n- **Extensions**: CRDs, Operators, API aggregation\n\n**Course structure:**\n11 parts organized progressively from basics to advanced topics. Each chapter builds on previous knowledge with hands-on practice.\n\nPerfect for DevOps engineers, system administrators, and developers preparing for CKA/CKAD certifications or wanting to become Kubernetes experts.',
        fr: 'Une formation Kubernetes complète couvrant tout des fondamentaux aux sujets avancés. Ce cours de 95 chapitres est conçu pour les développeurs et opérateurs qui veulent une compréhension approfondie de Kubernetes.\n\n**Ce que vous apprendrez :**\n- **Fondations** : Overview, architecture, concepts API, namespaces, labels, annotations\n- **Containers & Pods** : Images, lifecycle, patterns multi-containers, QoS\n- **Workloads** : Deployments, StatefulSets, DaemonSets, Jobs, CronJobs, autoscaling\n- **Networking** : Services, DNS, Ingress, Gateway API, Network Policies\n- **Storage** : Volumes, PV/PVC, StorageClasses, CSI\n- **Configuration** : ConfigMaps, Secrets, gestion des ressources, probes\n- **Sécurité** : RBAC, ServiceAccounts, Pod Security Standards, sécurité Linux\n- **Opérations** : Policies, observability, certificats, admission webhooks\n- **Extensions** : CRDs, Operators, API aggregation\n\n**Structure du cours :**\n11 parties organisées progressivement des bases aux sujets avancés. Chaque chapitre s\'appuie sur les connaissances précédentes avec de la pratique.\n\nParfait pour les ingénieurs DevOps, administrateurs système et développeurs préparant les certifications CKA/CKAD ou souhaitant devenir experts Kubernetes.',
    },
    isActive: true,
    comingSoon: true,
    price: 0,
    isFree: false,
    order: 2,
};

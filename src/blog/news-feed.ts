export type NewsLang = 'en' | 'fr'

export interface NewsItem {
  id: string
  publishedAt: string
  sourceName: string
  sourceUrl: string
  headline: string
  tldr: string
  whyItMatters: string
  tags: string[]
}

// Tone guide for tldr and whyItMatters:
// Write like you're explaining the news to a colleague over coffee.
// Be clear and direct, but not robotic. Avoid bullet-point-in-disguise phrasing.
// tldr: 2-3 sentences max, hard limit 60 words. Tell what happened in plain language,
//   keep key facts (CVEs, tool names, versions) but make it readable in one go.
// whyItMatters: 1-2 sentences max, hard limit 30 words. Lead with the real-world consequence.
//   Prefer "you" and "your" over passive constructions.
const englishNews: NewsItem[] = [
  {
    id: 'broadcom-velero-cncf',
    publishedAt: '2026-03-24',
    sourceName: 'The New Stack',
    sourceUrl: 'https://thenewstack.io/broadcom-velero-cncf-kubernetes/',
    headline:
      'Broadcom donates Velero to CNCF, reshaping Kubernetes backup and disaster recovery',
    tldr: 'Broadcom is handing Velero to the CNCF, making the go-to Kubernetes backup tool community-owned. VKS 3.6 also ships bring-your-own-CNI and performance profiles for AI and database workloads.',
    whyItMatters:
      'Kubernetes has no built-in backup. Velero under neutral governance is less vendor lock-in and more long-term confidence.',
    tags: ['cncf', 'backup', 'open-source', 'velero']
  },
  {
    id: 'trivy-supply-chain-attack',
    publishedAt: '2026-03-23',
    sourceName: 'The Hacker News',
    sourceUrl:
      'https://thehackernews.com/2026/03/trivy-hack-spreads-infostealer-via.html',
    headline:
      'Trivy supply chain attack spreads infostealer via Docker and deploys Kubernetes wiper',
    tldr: 'Stolen Aqua Security credentials were used to push malicious Trivy versions (0.69.4-0.69.6) to Docker Hub. That kicked off a self-spreading worm on npm and a wiper that nuked Kubernetes clusters via privileged DaemonSets. CVE-2026-33634, CVSS 9.4.',
    whyItMatters:
      'One compromised bot account bridging two GitHub orgs escalated from a scanner to live cluster destruction. Pin your Actions by commit SHA now.',
    tags: ['security', 'supply-chain', 'docker', 'cve']
  },
  {
    id: 'meshery-v1-release',
    publishedAt: '2026-03-25',
    sourceName: 'Network World',
    sourceUrl:
      'https://www.networkworld.com/article/4150130/meshery-1-0-debuts-offering-new-layer-of-control-for-cloud-native-infrastructure.html',
    headline:
      'Meshery 1.0 ships a visual governance layer for Kubernetes infrastructure',
    tldr: 'Meshery hits v1.0 after six years. Instead of raw YAML, your team works in Kanvas, a visual designer that shows infrastructure as a connected diagram, validates changes via OPA, and supports 300+ integrations. It sits on top of your existing IaC tooling.',
    whyItMatters:
      'When AI generates infra config faster than teams can review it, a visual layer that catches conflicts before production is the guardrail that actually gets used.',
    tags: ['cncf', 'open-source', 'tooling', 'governance']
  },
  {
    id: 'k8s-pod-restart-mechanics',
    publishedAt: '2026-03-17',
    sourceName: 'CNCF Blog',
    sourceUrl:
      'https://www.cncf.io/blog/2026/03/17/when-kubernetes-restarts-your-pod-and-when-it-doesnt/',
    headline:
      'A production guide to when Kubernetes actually restarts your pod',
    tldr: 'A CNCF maintainer breaks down exactly when Kubernetes restarts a container, recreates a pod, or does nothing. Covers ConfigMaps, image updates, in-place resize (GA in 1.35), Istio, and Stakater Reloader, each with lab-verified output.',
    whyItMatters:
      'Most incident time is wasted because engineers mix up container restarts and pod recreations. This gives you a decision matrix you can use at 2am.',
    tags: ['kubernetes', 'pods', 'internals', 'cncf']
  },
  {
    id: 'kubescape-4-release',
    publishedAt: '2026-03-26',
    sourceName: 'CNCF Blog',
    sourceUrl:
      'https://www.cncf.io/blog/2026/03/26/announcing-kubescape-4-0-enterprise-stability-meets-the-ai-era/',
    headline:
      'Kubescape 4.0 ships runtime threat detection GA and AI agent security scanning',
    tldr: 'Kubescape 4.0 marks runtime threat detection and dedicated security storage as stable and production-ready, and drops the intrusive host-sensor DaemonSet. It also ships a plugin for AI agents to scan cluster security posture, plus 15 controls for securing KAgent deployments.',
    whyItMatters:
      'AI agents managing infrastructure need to be secured too. Kubescape 4.0 covers both sides of that problem.',
    tags: ['security', 'cncf', 'open-source', 'ai']
  }
]

// Guide de ton pour tldr et whyItMatters :
// Ecrire comme si on expliquait l'actu a un collegue autour d'un cafe.
// Clair et direct, mais pas robotique. Eviter les phrases qui ressemblent a des listes deguisees.
// tldr : 2-3 phrases max, limite stricte a 60 mots. Raconter ce qui s'est passe en langage naturel,
//   garder les faits cles (CVE, noms d'outils, versions) mais lisible en un seul souffle.
// whyItMatters : 1-2 phrases max, limite stricte a 30 mots. Commencer par la consequence concrete.
//   Privilegier "vous" ou "tu" plutot que les tournures passives.
const frenchNews: NewsItem[] = [
  {
    id: 'broadcom-velero-cncf-fr',
    publishedAt: '2026-03-24',
    sourceName: 'The New Stack',
    sourceUrl: 'https://thenewstack.io/broadcom-velero-cncf-kubernetes/',
    headline:
      'Broadcom donne Velero a la CNCF, rebattant les cartes du backup Kubernetes',
    tldr: 'Broadcom cede Velero a la CNCF, le backup Kubernetes de reference devient communautaire. VKS 3.6 ajoute le bring-your-own-CNI et des profils de performance pour les bases de donnees et workloads IA.',
    whyItMatters:
      'Kubernetes n a pas de backup natif. Velero sous gouvernance neutre, c est moins de dependance editeur et plus de perenite.',
    tags: ['cncf', 'backup', 'open-source', 'velero']
  },
  {
    id: 'trivy-supply-chain-attack-fr',
    publishedAt: '2026-03-23',
    sourceName: 'The Hacker News',
    sourceUrl:
      'https://thehackernews.com/2026/03/trivy-hack-spreads-infostealer-via.html',
    headline:
      'Attaque supply chain sur Trivy : infostealer Docker et wiper Kubernetes deployés',
    tldr: 'Des identifiants Aqua Security voles ont permis de pousser des versions piégées de Trivy (0.69.4-0.69.6) sur Docker Hub. Ca a declenche un ver sur npm et un wiper qui detruisait des clusters Kubernetes via des DaemonSets privilegies. CVE-2026-33634, CVSS 9.4.',
    whyItMatters:
      'Un seul compte bot a suffi pour passer d un scanner a la destruction de clusters en prod. Passez vos Actions en pin par commit SHA.',
    tags: ['security', 'supply-chain', 'docker', 'cve']
  },
  {
    id: 'meshery-v1-release-fr',
    publishedAt: '2026-03-25',
    sourceName: 'Network World',
    sourceUrl:
      'https://www.networkworld.com/article/4150130/meshery-1-0-debuts-offering-new-layer-of-control-for-cloud-native-infrastructure.html',
    headline:
      'Meshery 1.0 : une couche de gouvernance visuelle pour l infrastructure Kubernetes',
    tldr: 'Meshery passe en v1.0 apres six ans. Plutot que du YAML brut, votre equipe travaille dans Kanvas, un designer visuel qui valide les changements via OPA et supporte 300+ integrations. Ca se pose au-dessus de vos outils IaC existants.',
    whyItMatters:
      'Quand l IA genere de la config plus vite qu on peut la relire, une couche visuelle qui detecte les conflits avant la prod devient indispensable.',
    tags: ['cncf', 'open-source', 'tooling', 'governance']
  },
  {
    id: 'k8s-pod-restart-mechanics-fr',
    publishedAt: '2026-03-17',
    sourceName: 'CNCF Blog',
    sourceUrl:
      'https://www.cncf.io/blog/2026/03/17/when-kubernetes-restarts-your-pod-and-when-it-doesnt/',
    headline: 'Guide de prod : quand Kubernetes redémarre vraiment votre pod',
    tldr: 'Un maintainer CNCF detaille exactement ce qui declenche un restart de container, une recreation de pod, ou rien du tout. ConfigMaps, mises a jour d image, resize in-place (GA en 1.35), Istio et Stakater Reloader, chaque scenario avec des sorties de lab verifiees.',
    whyItMatters:
      'La plupart des investigations perdent du temps a confondre restart et recreation. Cet article donne une matrice de decision utilisable en incident.',
    tags: ['kubernetes', 'pods', 'internals', 'cncf']
  },
  {
    id: 'kubescape-4-release-fr',
    publishedAt: '2026-03-26',
    sourceName: 'CNCF Blog',
    sourceUrl:
      'https://www.cncf.io/blog/2026/03/26/announcing-kubescape-4-0-enterprise-stability-meets-the-ai-era/',
    headline:
      'Kubescape 4.0 : detection de menaces en temps reel GA et scan de securite pour agents IA',
    tldr: 'Kubescape 4.0 passe la detection de menaces en temps reel et le stockage de securite en production stable, et supprime le DaemonSet host-sensor intrusif. Un plugin permet aux agents IA de scanner la posture du cluster, et 15 controles securisent les deployments KAgent.',
    whyItMatters:
      'Les agents IA qui gerent l infrastructure doivent etre securises eux aussi. Kubescape 4.0 couvre les deux cotes du probleme.',
    tags: ['security', 'cncf', 'open-source', 'ai']
  }
]

function toTimestamp(dateValue: string): number {
  const timestamp = Date.parse(dateValue)
  if (Number.isNaN(timestamp)) {
    return 0
  }
  return timestamp
}

export function getNewsFeed(lang: NewsLang): NewsItem[] {
  const source = lang === 'fr' ? frenchNews : englishNews
  return [...source].sort(
    (left, right) =>
      toTimestamp(right.publishedAt) - toTimestamp(left.publishedAt)
  )
}
